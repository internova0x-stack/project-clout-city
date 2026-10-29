-- 0127: Campaign Mode, the test build (docs/CAMPAIGN-MODE.md, spec v0.5; owner, Oct 29). The player manages one of
-- four challengers' campaigns against Mayor Papa-Dani, one campaign week per real New York day.
--
--   * The rules run on the server in TypeScript (lib/campaignEngine.ts, called by app/home/campaignActions.ts with the
--     service role): every roll is made there and the player only ever receives a view without the hidden odds. This
--     table keeps each campaign's whole state; players have no access to it (RLS on, no policies, no grants).
--   * campaign_context(player): what starting needs (rank, clout, bank, crew, home, the 7-day rule, past wins) and the
--     player's latest campaign. campaign_begin starts one (Rank 2, one at a time, one start every 7 days, a seed of up
--     to C$1,000 from the bank: ledger 'campaign_seed'). campaign_save stores a new state against its version (a
--     conflict means someone else saved first) and pays what the week earned, once per (kind, ref):
--     ledger 'campaign_poll' and 'campaign_reward' (clout), 'campaign_skim' and 'campaign_repay' (cash). The skim cap
--     (C$1,500 a campaign) is enforced here too. A finished campaign gives the badges 'campaign-ran' and, for a win,
--     'campaign-mayor'. Each call counts against the player's 'campaign' rate bucket (60 a minute).
--   * Start over ends a running campaign (it's abandoned), and campaign goals only count campaigns since then.
--   * Goals: seven campaign goals join the ladder (lib/goals.ts), read by goal_list's new campaign checks.

create table if not exists public.campaigns (
  id          uuid primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  candidate   text not null check (candidate in ('goldcrest', 'castellano', 'kowalczyk', 'starr')),
  status      text not null default 'running' check (status in ('running', 'over', 'abandoned')),
  week        smallint not null default 1,
  ending      text check (ending in ('clean_win', 'dirty_win', 'loss')),
  debate_won  boolean,
  state       jsonb not null,
  version     int not null default 1,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  updated_at  timestamptz not null default now()
);
create unique index if not exists campaigns_one_running on public.campaigns (player_id) where status = 'running';
create index if not exists campaigns_player_idx on public.campaigns (player_id, started_at desc);
alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon, authenticated;

-- The player's campaigns since their last Start over (goals and the 7-day rule only count these).
create or replace function public.campaigns_since(p_player uuid) returns setof public.campaigns
language sql stable security definer set search_path = public
as $$
  select c.* from public.campaigns c
   where c.player_id = p_player
     and c.started_at > coalesce((select max(restarted_at) from public.player_restarts where player_id = p_player), '-infinity'::timestamptz)
$$;

create or replace function public.campaign_context(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.players;
  latest public.campaigns;
begin
  select * into me from public.players where id = p_player;
  if me.id is null then return null; end if;
  select * into latest from public.campaigns
   where player_id = p_player and status <> 'abandoned' order by started_at desc limit 1;
  return jsonb_build_object(
    'rank', greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)),
    'clout', me.clout,
    'bank', me.bank_cash,
    'home', me.home_id,
    'crew', (select count(*) from public.invites where inviter_id = p_player),
    'lastStart', (select max(started_at) from public.campaigns_since(p_player) x where x.status <> 'abandoned'),
    'won', coalesce((select jsonb_agg(distinct candidate) from public.campaigns
                     where player_id = p_player and ending in ('clean_win', 'dirty_win')), '[]'::jsonb),
    'latest', case when latest.id is null then null else jsonb_build_object(
      'id', latest.id, 'status', latest.status, 'version', latest.version, 'state', latest.state, 'endedAt', latest.ended_at) end);
end;
$$;

create or replace function public.campaign_begin(p_player uuid, p_id uuid, p_candidate text, p_state jsonb, p_seed int) returns void
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
  last_start timestamptz;
begin
  if not public.rate_hit(p_player, 'campaign', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)) < 2 then raise exception 'locked' using errcode = '22023'; end if;
  if exists (select 1 from public.campaigns where player_id = p_player and status = 'running') then
    raise exception 'running' using errcode = '22023';
  end if;
  select max(started_at) into last_start from public.campaigns_since(p_player) x where x.status <> 'abandoned';
  if last_start > now() - interval '7 days' then raise exception 'too_soon' using errcode = '22023'; end if;
  if p_seed < 0 or p_seed > 1000 then raise exception 'bad_seed' using errcode = '22023'; end if;
  if p_seed > me.bank_cash then raise exception 'no_bank' using errcode = '22023'; end if;
  insert into public.campaigns (id, player_id, candidate, state) values (p_id, p_player, p_candidate, p_state);
  if p_seed > 0 and public.ledger_once(p_player, 'cash', -p_seed, 'campaign_seed', p_id::text) then
    update public.players set bank_cash = bank_cash - p_seed where id = p_player;
  end if;
end;
$$;

create or replace function public.campaign_save(
  p_player uuid, p_id uuid, p_version int, p_state jsonb, p_week int, p_status text, p_ending text, p_debate_won boolean, p_payouts jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v int;
  p jsonb;
  kind text;
  cur text;
  amt bigint;
  skimmed bigint;
  bank bigint;
begin
  if not public.rate_hit(p_player, 'campaign', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_status not in ('running', 'over') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.campaigns
     set state = p_state, week = p_week, status = p_status, ending = p_ending, debate_won = coalesce(p_debate_won, debate_won),
         version = version + 1, updated_at = now(), ended_at = case when p_status = 'over' then now() else ended_at end
   where id = p_id and player_id = p_player and version = p_version and status = 'running'
   returning version into v;
  if v is null then raise exception 'conflict' using errcode = '40001'; end if;

  for p in select x from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) x loop
    kind := p ->> 'kind';
    cur := p ->> 'currency';
    amt := (p ->> 'amount')::bigint;
    -- Only this campaign's own kinds, refs and signs.
    continue when not (p ->> 'ref' like p_id::text || '%');
    continue when not ((kind = 'campaign_poll' and cur = 'clout' and amt between 1 and 30)
                    or (kind = 'campaign_reward' and cur = 'clout' and amt between -100 and 500)
                    or (kind = 'campaign_skim' and cur = 'cash' and amt > 0)
                    or (kind = 'campaign_repay' and cur = 'cash' and amt < 0));
    if kind = 'campaign_skim' then
      skimmed := coalesce((select sum(l.amount) from public.ledger l where l.player_id = p_player and l.kind = 'campaign_skim' and l.ref like p_id::text || '%'), 0);
      amt := least(amt, 1500 - skimmed);
      continue when amt <= 0;
    end if;
    if kind = 'campaign_repay' then
      select bank_cash into bank from public.players where id = p_player;
      amt := greatest(amt, -bank);
      continue when amt = 0;
    end if;
    if public.ledger_once(p_player, cur, amt, kind, p ->> 'ref') then
      if cur = 'cash' then update public.players set bank_cash = bank_cash + amt where id = p_player;
      else update public.players set clout = greatest(0, clout + amt) where id = p_player;
      end if;
    end if;
  end loop;

  if p_status = 'over' then
    insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'campaign-ran', 'campaign') on conflict do nothing;
    if p_ending in ('clean_win', 'dirty_win') then
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'campaign-mayor', 'campaign') on conflict do nothing;
    end if;
  end if;
  return v;
end;
$$;

-- Start over ends a running campaign.
create or replace function public.campaign_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.campaigns set status = 'abandoned', ended_at = now(), updated_at = now()
   where player_id = new.player_id and status = 'running';
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists campaign_on_restart on public.player_restarts;
create trigger campaign_on_restart after insert on public.player_restarts
  for each row execute function public.campaign_on_restart();

revoke all on function public.campaigns_since(uuid) from public, anon, authenticated;
revoke all on function public.campaign_context(uuid) from public, anon, authenticated;
revoke all on function public.campaign_begin(uuid, uuid, text, jsonb, int) from public, anon, authenticated;
revoke all on function public.campaign_save(uuid, uuid, int, jsonb, int, text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.campaign_on_restart() from public, anon, authenticated;

-- The goal ladder with the seven campaign goals (lib/goals.ts; tests/goals.test.ts keeps the two equal).
insert into public.game_settings (key, value) values ('goals', '{"ladder":[{"id":"regular","unlock":0,"reward":25,"lean":"cash","tags":["bodega"],"check":{"type":"regular","place":"ditmars-deli","days":3}},{"id":"first_purchase","unlock":0,"reward":25,"lean":"cash","tags":["boutique","shopping"],"check":{"type":"purchase"}},{"id":"first_shift","unlock":0,"reward":25,"lean":"cash","tags":[],"check":{"type":"shift"}},{"id":"full_day","unlock":0,"reward":50,"lean":"boost","tags":[],"check":{"type":"full_day"}},{"id":"first_gig","unlock":0,"reward":50,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig"}},{"id":"own_place","unlock":0,"reward":75,"lean":"cash","tags":[],"check":{"type":"solo"}},{"id":"campaign_start","unlock":0,"reward":75,"lean":"boost","tags":[],"check":{"type":"campaign_started"},"side":true},{"id":"first_crew","unlock":100,"reward":75,"lean":"boost","tags":["club","nightlife"],"check":{"type":"crew","count":1}},{"id":"save_15k","unlock":100,"reward":75,"lean":"cash","tags":[],"check":{"type":"save","cash":15000}},{"id":"skill_3","unlock":100,"reward":75,"lean":"boost","tags":["gym","campus"],"check":{"type":"skill","level":3}},{"id":"campaign_week3","unlock":100,"reward":75,"lean":"boost","tags":[],"check":{"type":"campaign_week","week":3},"side":true},{"id":"pro_gigs","unlock":500,"reward":150,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig_tier","tier":"pro"}},{"id":"first_business","unlock":500,"reward":150,"lean":"cash","tags":[],"check":{"type":"business","id":"hot-dog-cart"}},{"id":"move_up","unlock":500,"reward":150,"lean":"cash","tags":[],"check":{"type":"home","home":"jackson_heights_1br"}},{"id":"campaign_debate","unlock":500,"reward":150,"lean":"boost","tags":[],"check":{"type":"debate_won"},"side":true},{"id":"campaign_finish","unlock":500,"reward":150,"lean":"boost","tags":[],"check":{"type":"campaign_finished"},"side":true},{"id":"first_car","unlock":1000,"reward":200,"lean":"cash","tags":["dealership","cars"],"check":{"type":"car"}},{"id":"move_sunnyside","unlock":1000,"reward":200,"lean":"cash","tags":[],"check":{"type":"home","home":"sunnyside_gardens"}},{"id":"skill_5","unlock":1000,"reward":200,"lean":"boost","tags":["gym","campus"],"check":{"type":"skill","level":5}},{"id":"campaign_win","unlock":1000,"reward":200,"lean":"boost","tags":[],"check":{"type":"campaign_won"},"side":true},{"id":"big_gigs","unlock":2000,"reward":300,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig_tier","tier":"big"}},{"id":"ultraviolet","unlock":2000,"reward":300,"lean":"boost","tags":["club","nightlife"],"check":{"type":"door","place":"ultraviolet-society"}},{"id":"bodega","unlock":2000,"reward":300,"lean":"cash","tags":[],"check":{"type":"business","id":"bodega"}},{"id":"campaign_clean","unlock":2000,"reward":300,"lean":"boost","tags":[],"check":{"type":"campaign_won","clean":true},"side":true},{"id":"vip_floor","unlock":5000,"reward":500,"lean":"boost","tags":["club","nightlife"],"check":{"type":"vip","level":"medium"}},{"id":"move_highrise","unlock":5000,"reward":500,"lean":"cash","tags":[],"check":{"type":"home","home":"lic_highrise"}},{"id":"campaign_all","unlock":5000,"reward":500,"lean":"boost","tags":[],"check":{"type":"candidates_run","count":4},"side":true},{"id":"own_home","unlock":15000,"reward":1500,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-astoria-townhouse"}},{"id":"laundromat","unlock":15000,"reward":750,"lean":"cash","tags":[],"check":{"type":"business","id":"laundromat"}},{"id":"penthouse","unlock":50000,"reward":2500,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-lic-penthouse"}},{"id":"cafe","unlock":50000,"reward":2500,"lean":"cash","tags":[],"check":{"type":"business","id":"cafe"}},{"id":"duplex","unlock":150000,"reward":5000,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-hunters-point-duplex"}},{"id":"taco_trucks","unlock":150000,"reward":5000,"lean":"cash","tags":[],"check":{"type":"business","id":"taco-trucks"}},{"id":"go_public","unlock":500000,"reward":10000,"lean":"boost","tags":[],"check":{"type":"public"}}],"goalTasksPerDay":2,"streak":{"freezesPerWeek":1,"day3Clout":50,"every":7,"collectibles":["home-neon-five-sign","home-trophy-shelf","home-employee-frame","home-streak-lava-lamp"],"fallbackClout":100}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Side goals never block the suggestion: goal_current skips them unless a campaign is running (0073's, plus that).
create or replace function public.goal_current(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_list jsonb := public.goal_list(p_player);
  v_clout bigint := coalesce((select clout from public.players where id = p_player), 0);
  v_side boolean := exists (select 1 from public.campaigns where player_id = p_player and status = 'running');
  v_goal jsonb;
  v_next int;
begin
  select g - 'done' - 'unlock' - 'side' into v_goal from jsonb_array_elements(v_list) with ordinality x(g, n)
   where not (g ->> 'done')::boolean and (g ->> 'unlock')::int <= v_clout
     and (v_side or not coalesce((g ->> 'side')::boolean, false))
   order by n limit 1;
  if v_goal is not null then return v_goal; end if;
  select min((g ->> 'unlock')::int) into v_next from jsonb_array_elements(v_list) g
   where not (g ->> 'done')::boolean and (g ->> 'unlock')::int > v_clout and not coalesce((g ->> 'side')::boolean, false);
  if v_next is null then return null; end if;
  return jsonb_build_object('id', 'next_chapter', 'parts', jsonb_build_array(public.goal_part(v_clout, v_next, 'clout')), 'target', null);
end;
$$;

-- 0094's goal_list, plus the campaign checks and each goal's side flag.
create or replace function public.goal_list(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  gs jsonb := public.goals_settings();
  e jsonb := public.economy();
  c jsonb := public.city();
  me public.players;
  v_out jsonb := '[]'::jsonb;
  g jsonb;
  chk jsonb;
  gid text;
  v_done boolean;
  v_parts jsonb;
  v_target text;
  v_n numeric;
  h jsonb;
  t jsonb;
  it jsonb;
  b jsonb;
begin
  select * into me from public.players where id = p_player;
  if me.id is null or gs is null then return '[]'::jsonb; end if;
  for g in select x from jsonb_array_elements(gs -> 'ladder') x loop
    gid := g ->> 'id';
    chk := g -> 'check';
    v_target := null;
    v_parts := '[]'::jsonb;
    case chk ->> 'type'
      when 'purchase' then
        v_done := exists (select 1 from public.player_items where player_id = p_player and acquired = 'bought')
               or exists (select 1 from public.ledger where player_id = p_player and currency = 'cash' and kind = 'purchase');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'shift' then
        v_done := exists (select 1 from public.ledger where player_id = p_player and currency = 'cash' and kind = 'shift');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'full_day' then
        v_done := exists (select 1 from public.ledger where player_id = p_player and kind = 'daily_bonus');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'gig' then
        v_done := exists (select 1 from public.gig_offers where player_id = p_player and collected_at is not null);
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'crew' then
        v_n := (select count(*) from public.invites where inviter_id = p_player);
        v_done := v_n >= (chk ->> 'count')::int;
        v_parts := jsonb_build_array(public.goal_part(v_n, (chk ->> 'count')::int, 'count'));
      when 'save' then
        v_done := me.bank_cash >= (chk ->> 'cash')::int;
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash, (chk ->> 'cash')::int, 'cash'));
      when 'skill' then
        v_n := coalesce((select max(best) from public.player_skills where player_id = p_player), 0);
        v_done := v_n >= (chk ->> 'level')::int;
        v_parts := jsonb_build_array(public.goal_part(v_n, (chk ->> 'level')::int, 'count'));
      when 'gig_tier' then
        t := c -> 'economy' -> 'gigs' -> (chk ->> 'tier');
        v_done := me.clout >= coalesce((t ->> 'clout')::int, 0) and me.confidence >= coalesce((t ->> 'confidence')::int, 0);
        v_parts := jsonb_build_array(public.goal_part(me.clout, coalesce((t ->> 'clout')::int, 0), 'clout'),
                                     public.goal_part(me.confidence, coalesce((t ->> 'confidence')::int, 0), 'confidence'));
      when 'business' then
        b := (select x from jsonb_array_elements(c -> 'economy' -> 'businesses' -> 'list') x where x ->> 'id' = chk ->> 'id');
        v_done := exists (select 1 from public.player_businesses where player_id = p_player and business_id = chk ->> 'id');
        v_target := chk ->> 'id';
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash, coalesce((b ->> 'price')::int, 0), 'cash'));
      when 'home' then
        -- That home or a better one (by rent; never a campus dorm), any house, or (move_up) moving up at all.
        h := (select x from jsonb_array_elements(e -> 'homes') x where x ->> 'id' = chk ->> 'home');
        v_done := me.house_sku is not null
               or (coalesce(public.rent_for(me.home_id), 0) >= (h ->> 'rent')::int
                   and not exists (select 1 from jsonb_array_elements(e -> 'homes') x where x ->> 'id' = me.home_id and x ? 'campus'))
               or (gid = 'move_up' and me.moved_up);
        v_target := chk ->> 'home';
        if coalesce((h ->> 'moveClout')::int, 0) > 0 then
          v_parts := v_parts || jsonb_build_array(public.goal_part(me.clout, (h ->> 'moveClout')::int, 'clout'));
        end if;
        v_parts := v_parts || jsonb_build_array(public.goal_part(me.bank_cash,
                     (h ->> 'rent')::int * (1 + coalesce((e -> 'moving' ->> 'brokerWeeks')::int, 1)), 'cash'));
      when 'car' then
        select i into it from jsonb_array_elements(c -> 'shop') i
         where i ->> 'category' = 'cars' and not coalesce((i ->> 'collector')::boolean, false) and not coalesce((i ->> 'reward')::boolean, false)
         order by (i ->> 'price')::int limit 1;
        v_done := me.car_sku is not null;
        v_target := it ->> 'sku';
        if it is not null then v_parts := jsonb_build_array(public.goal_part(me.bank_cash, (it ->> 'price')::int, 'cash')); end if;
      when 'house' then
        -- That house or a dearer one (owner, Oct 18: any house finishes "own a home").
        it := (select i from jsonb_array_elements(c -> 'shop') i where i ->> 'sku' = chk ->> 'sku');
        v_done := me.house_sku is not null
              and coalesce((select (i ->> 'price')::int from jsonb_array_elements(c -> 'shop') i where i ->> 'sku' = me.house_sku), 0)
                  >= coalesce((it ->> 'price')::int, 0);
        v_target := chk ->> 'sku';
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash, coalesce((it ->> 'price')::int, 0), 'cash'));
      when 'door' then
        v_done := exists (select 1 from public.place_visits where player_id = p_player and place_id = chk ->> 'place');
        v_target := chk ->> 'place';
        v_parts := jsonb_build_array(public.goal_part(me.clout,
                     coalesce((select (p -> 'club' ->> 'doorClout')::int from jsonb_array_elements(c -> 'places') p where p ->> 'id' = chk ->> 'place'), 0), 'clout'));
      when 'vip' then
        -- Up to a VIP floor at a club of that level (0046's vip_seen, ledger clout 'vip', ref place:day).
        v_done := exists (select 1 from public.ledger l, jsonb_array_elements(c -> 'places') p
                           where l.player_id = p_player and l.kind = 'vip' and p -> 'club' ->> 'vip' = chk ->> 'level'
                             and l.ref like (p ->> 'id') || ':%');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'regular' then
        -- C3: different New York days with something done at the place (one place_visits row per day).
        v_n := (select count(*) from public.place_visits where player_id = p_player and place_id = chk ->> 'place');
        v_done := v_n >= (chk ->> 'days')::int;
        v_target := chk ->> 'place';
        v_parts := jsonb_build_array(public.goal_part(v_n, (chk ->> 'days')::int, 'count'));
      when 'solo' then
        -- C3: no roommate: a house, or a home without one. The target is the cheapest solo home anyone can pick.
        h := (select x from jsonb_array_elements(e -> 'homes') x
               where not x ? 'roommate' and not x ? 'campus' and coalesce(x ->> 'signup', 'true') <> 'false'
               order by (x ->> 'rent')::int limit 1);
        v_done := me.house_sku is not null
               or (me.home_id is not null and not exists (select 1 from jsonb_array_elements(e -> 'homes') x where x ->> 'id' = me.home_id and x ? 'roommate'));
        v_target := h ->> 'id';
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash,
                     (h ->> 'rent')::int * (1 + coalesce((e -> 'moving' ->> 'brokerWeeks')::int, 1)), 'cash'));
      when 'public' then
        v_done := exists (select 1 from public.player_businesses where player_id = p_player and went_public);
        v_parts := jsonb_build_array(public.goal_part(me.clout, coalesce((c -> 'economy' -> 'businesses' -> 'goPublic' ->> 'clout')::int, 0), 'clout'));
      -- Campaign Mode (0127): the player's campaigns since their last Start over.
      when 'campaign_started' then
        -- Before Rank 2 its progress is the clout to Rank 2 (lib/ranks.ts), so the goal says how to open the mode.
        v_done := exists (select 1 from public.campaigns_since(p_player) x where x.status <> 'abandoned');
        if not v_done and greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)) < 2 then
          v_parts := jsonb_build_array(public.goal_part(me.clout, coalesce((c -> 'economy' -> 'ranks' -> 1 ->> 'clout')::int, 100), 'clout'));
        else
          v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
        end if;
      when 'campaign_week' then
        v_n := coalesce((select max(x.week) from public.campaigns_since(p_player) x), 0);
        v_done := v_n >= (chk ->> 'week')::int;
        v_parts := jsonb_build_array(public.goal_part(least(v_n, (chk ->> 'week')::int), (chk ->> 'week')::int, 'count'));
      when 'debate_won' then
        v_done := exists (select 1 from public.campaigns_since(p_player) x where x.debate_won);
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'campaign_finished' then
        v_done := exists (select 1 from public.campaigns_since(p_player) x where x.status = 'over');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'campaign_won' then
        v_done := exists (select 1 from public.campaigns_since(p_player) x
                           where x.ending = 'clean_win' or (x.ending = 'dirty_win' and not coalesce((chk ->> 'clean')::boolean, false)));
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'candidates_run' then
        v_n := (select count(distinct x.candidate) from public.campaigns_since(p_player) x where x.status = 'over');
        v_done := v_n >= (chk ->> 'count')::int;
        v_parts := jsonb_build_array(public.goal_part(v_n, (chk ->> 'count')::int, 'count'));
      else continue;
    end case;
    v_done := v_done or exists (select 1 from public.ledger where player_id = p_player and currency = 'clout' and kind = 'goal' and ref = gid);
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', gid, 'unlock', coalesce((g ->> 'unlock')::int, 0),
                                                           'done', v_done, 'parts', v_parts, 'target', v_target,
                                                           'side', coalesce((g ->> 'side')::boolean, false)));
  end loop;
  return v_out;
end;
$$;
