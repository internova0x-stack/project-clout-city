-- Hardening (owner, Oct 15: "check to see if there are any elements in the game that can let players
-- hack the economy by editing inspect element"; "fix them all"). Nothing here was exploitable for cash;
-- these close the gaps the audit found.
--   * Invites: the first 5 friends pay at sign-up; every friend after that pays once they come back on a
--     second day (owner), so throwaway accounts stop farming clout. economy.invites.paidAtOnce = 5.
--   * Dev tools (staging only) also need a Story Studio admin, so switching them on can't hand any
--     player free products, prediction answers or a moved clock. dev_grant_entitlement is for story
--     arcs only.
--   * Gossip, hunts: the trip has to be over (as for every other place action since 0042), and a hunt
--     line needs you at the place now, not just earlier today.
--   * Presence: you only show on a VIP floor you can get into.
--   * Story price multipliers stay between 0.6 and 2 (a story can't make buy-then-sell profitable or
--     a price negative).
--   * Internal helpers can't be called from the browser (Supabase grants new functions to
--     'authenticated' by default; revoking from public alone doesn't stop it).

do $$
begin
  if to_regclass('public.player_businesses') is null then
    raise exception 'Run migration 0048_ownership.sql first: 0049 builds on it.';
  end if;
end $$;

update public.game_settings set value = '{"birthLottery":{"min":5000,"max":10000,"step":100},"phoneBill":60,"firstParty":{"entry":150,"cashReward":300,"cloutReward":100,"confidence":15,"energy":20},"invites":{"cloutPerInvite":50,"cliqueSize":5,"cliqueBonus":500,"paidAtOnce":5},"startingStats":{"energy":100,"mood":60,"confidence":40},"playersOnlineThreshold":1,"homes":[{"id":"astoria_studio","rent":1750},{"id":"jackson_heights_1br","rent":2600},{"id":"sunnyside_gardens","rent":3200,"moveClout":1000,"signup":false},{"id":"lic_highrise","rent":4500,"moveClout":3000}],"moving":{"brokerWeeks":1}}'::jsonb, updated_at = now() where key = 'economy';

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
/** Whether a player has come back on a later New York day than the one they signed up on. */
create function public.came_back(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ledger l, public.players p
     where p.id = p_player and l.player_id = p_player
       and (l.created_at at time zone 'America/New_York')::date > (p.created_at at time zone 'America/New_York')::date)
$$;

/** 0003's payout: the first paidAtOnce invites at once, the rest once the friend has come back. */
create or replace function public.pay_invite_rewards(p_inviter uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.economy() -> 'invites';
  per int := (cfg ->> 'cloutPerInvite')::int;
  size int := (cfg ->> 'cliqueSize')::int;
  bonus int := (cfg ->> 'cliqueBonus')::int;
  at_once int := coalesce((cfg ->> 'paidAtOnce')::int, 5);
  inv record;
  total int;
begin
  perform 1 from public.players where id = p_inviter for update;
  for inv in
    select i.id, i.invitee_id,
           (select count(*) from public.invites j where j.inviter_id = p_inviter and (j.created_at, j.id) < (i.created_at, i.id)) as before
      from public.invites i where i.inviter_id = p_inviter and i.reward_paid_at is null order by i.created_at, i.id
  loop
    if inv.before >= at_once and not public.came_back(inv.invitee_id) then continue; end if;
    if public.ledger_once(p_inviter, 'clout', per, 'invite', inv.invitee_id::text) then
      update public.players set clout = clout + per where id = p_inviter;
    end if;
    update public.invites set reward_paid_at = now() where id = inv.id;
  end loop;

  select count(*) into total from public.invites where inviter_id = p_inviter;
  if total >= size and public.ledger_once(p_inviter, 'clout', bonus, 'clique_bonus', 'clique') then
    update public.players set clout = clout + bonus where id = p_inviter;
  end if;
end;
$$;
revoke all on function public.pay_invite_rewards(uuid) from public, anon, authenticated;

/** A friend's first ledger row on a later day pays the invite that was waiting for them. */
create function public.invite_came_back_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
declare inviter uuid;
begin
  select i.inviter_id into inviter from public.invites i where i.invitee_id = new.player_id and i.reward_paid_at is null;
  if inviter is not null and public.came_back(new.player_id) then perform public.pay_invite_rewards(inviter); end if;
  return new;
end;
$$;
create trigger ledger_invite_came_back after insert on public.ledger
  for each row execute function public.invite_came_back_trigger();

-- ---------------------------------------------------------------------------
-- Dev tools: staging only, and only for a Story Studio admin
-- ---------------------------------------------------------------------------
create or replace function public.require_dev_tools() returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce((select (value ->> 'tools')::boolean from public.game_settings where key = 'dev'), false) is not true then
    raise exception 'dev_tools_off' using errcode = '42501';
  end if;
  perform public.require_story_admin();
end;
$$;

create or replace function public.dev_set_clock_offset(p_hours numeric)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_dev_tools();
  update public.game_settings
     set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb((p_hours * 3600)::bigint)), updated_at = now()
   where key = 'dev';
  return public.game_now();
end;
$$;

create or replace function public.dev_grant_entitlement(p_sku text, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_dev_tools();
  -- Story arcs only: never chat passes, tickets or anything else sold for real money.
  if exists (select 1 from public.store_products where sku = p_sku and product_type <> 'side_arc') then
    raise exception 'not_a_story' using errcode = '22023';
  end if;
  if p_on then
    insert into public.entitlements (player_id, sku, product_type, status) values (auth.uid(), p_sku, 'side_arc', 'active')
    on conflict (player_id, sku) do update set status = 'active';
  else
    update public.entitlements set status = 'revoked' where player_id = auth.uid() and sku = p_sku;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Story prices stay between 0.6× and 2×
-- ---------------------------------------------------------------------------
create or replace function public.story_price(p_tags jsonb, p_kind text, out multiplier numeric, out reason text)
language sql stable security definer set search_path = public
as $$
  select greatest(0.6, coalesce(max(least(2, (effect ->> 'multiplier')::numeric)), 1)),
         (array_agg(effect ->> 'reason' order by (effect ->> 'multiplier')::numeric desc))[1]
    from public.world_effects()
   where effect ->> 'type' = 'price_multiplier' and effect ->> 'applies_to' = p_kind
     and (effect -> 'tags') ?| array(select jsonb_array_elements_text(coalesce(p_tags, '[]')))
$$;

-- ---------------------------------------------------------------------------
-- Gossip: 0046's gossip_find, after the trip is over
-- ---------------------------------------------------------------------------
create or replace function public.gossip_find(p_place text, p_via text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  r record;
  v_found jsonb := '[]'::jsonb;
  later jsonb := null;
  finished jsonb := '[]'::jsonb;
  sid text;
  task_cash int;
  b jsonb := public.city() -> 'economy' -> 'gossip' -> 'restroom';
  v_bclout int := 0;
  v_bmood int := 0;
begin
  if p_via not in ('overheard', 'regular', 'restroom') then raise exception 'bad_via' using errcode = '22023'; end if;
  -- #19: the restroom is downstairs at a club or the lounge.
  if p_via = 'restroom' and jsonb_typeof((select p -> 'club' from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place)) is distinct from 'object' then
    raise exception 'no_restroom' using errcode = '22023';
  end if;
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place then raise exception 'gossip_not_here' using errcode = '22023'; end if;
  -- 0049: the trip has to be over, as for every other place action (0042).
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  for r in
    select l.story ->> 'id' as story, l.story ->> 'title' as title, p.n - 1 as piece, p.x
      from public.gossip_live() l, jsonb_array_elements(l.story -> 'pieces') with ordinality p(x, n)
     where p.x ->> 'place' = p_place
       -- #19: the restroom hears its own pieces and what's said upstairs.
       and (p.x ->> 'source' = p_via or (p_via = 'restroom' and p.x ->> 'source' = 'overheard'))
       and not exists (select 1 from public.gossip_found f where f.player_id = uid and f.story_id = l.story ->> 'id' and f.piece = p.n - 1)
     order by l.week, l.story ->> 'id', p.n
  loop
    if public.gossip_in_window(r.x -> 'hours') then
      insert into public.gossip_found (player_id, story_id, piece, via) values (uid, r.story, r.piece, p_via) on conflict do nothing;
      -- #19: a restroom piece pays a story's clout and Mood again, on the spot (once, ledger 'gossip_restroom').
      if r.x ->> 'source' = 'restroom'
         and public.ledger_once(uid, 'clout', (b ->> 'clout')::int, 'gossip_restroom', r.story || ':' || r.piece) then
        update public.players set clout = clout + (b ->> 'clout')::int, mood = least(100, mood + (b ->> 'mood')::int) where id = uid;
        v_bclout := v_bclout + (b ->> 'clout')::int;
        v_bmood := v_bmood + (b ->> 'mood')::int;
      end if;
      v_found := v_found || jsonb_build_object('story', r.story, 'title', r.title, 'piece', r.piece, 'text', r.x ->> 'text',
        'count', (select count(*) from public.gossip_found f where f.player_id = uid and f.story_id = r.story));
    elsif later is null then
      later := r.x -> 'hours';
    end if;
  end loop;
  for sid in select distinct x ->> 'story' from jsonb_array_elements(v_found) x loop
    if public.gossip_finish(uid, sid) then finished := finished || to_jsonb(sid); end if;
  end loop;
  -- v0.11: talking to the regular (or listening in) where a gossip task sent you completes it,
  -- whether or not there was anything new to hear (a crewmate may have shared it first).
  task_cash := public.complete_task(uid, p_place, 'gossip-' || p_via);
  return jsonb_build_object('found', v_found, 'later', later, 'finished', finished, 'taskCash', task_cash,
                            'bonus', jsonb_build_object('clout', v_bclout, 'mood', v_bmood));
end;
$$;

-- ---------------------------------------------------------------------------
-- Hunts: 0018's hunt_talk, at the place now
-- ---------------------------------------------------------------------------
create or replace function public.hunt_talk(p_place text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.hunts := public.hunt_current();
  pr public.hunt_progress;
  s jsonb;
begin
  if h.id is null then raise exception 'not_here' using errcode = '22023'; end if;
  select * into pr from public.hunt_progress where player_id = uid and hunt_id = h.id for update;
  if pr.player_id is null or pr.completed_at is not null or h.data -> 'places' ->> pr.step is distinct from p_place then
    raise exception 'not_here' using errcode = '22023';
  end if;
  -- 0049: you have to be there now (arrived), not just earlier today.
  if not exists (select 1 from public.players where id = uid and at_place = p_place and (arrives_at is null or arrives_at <= clock_timestamp())) then
    raise exception 'not_here' using errcode = '22023';
  end if;
  if not exists (select 1 from public.place_visits where player_id = uid and place_id = p_place and ny_date = public.ny_today()) then
    raise exception 'visit_first' using errcode = '22023';
  end if;
  s := h.data -> 'tracks' -> pr.style -> 'steps' -> pr.step;
  if s ? 'question' then
    update public.hunt_progress set talked = true where player_id = uid and hunt_id = h.id;
  else
    update public.hunt_progress set step = step + 1, talked = false, wrong_at = null where player_id = uid and hunt_id = h.id;
  end if;
  return jsonb_build_object(
    'line', jsonb_build_object('say', s ->> 'say', 'question',
      case when s ? 'question' then jsonb_build_object('q', s -> 'question' ->> 'q', 'choices', s -> 'question' -> 'choices') end),
    'state', public.hunt_state());
end;
$$;

-- ---------------------------------------------------------------------------
-- Presence: 0048's place_presence, on a VIP floor only with access
-- ---------------------------------------------------------------------------
create or replace function public.place_presence(p_place text, p_floor int default 1) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('chat');
  fresh timestamptz := now() - make_interval(mins => (cfg ->> 'hereMinutes')::int);
  me public.players;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place or me.arrives_at > clock_timestamp() then
    return jsonb_build_object('count', 0, 'people', '[]'::jsonb);
  end if;
  -- 0049: upstairs (VIP) only if you can get in; otherwise you count as downstairs.
  update public.players set seen_at = now(),
         at_floor = case when coalesce(p_floor, 1) > 1 and public.vip_access(uid, p_place) is null then 1
                         else greatest(0, least(9, coalesce(p_floor, 1))) end
   where id = uid;
  return (
    with here as (
      select p.*, p.id in (select id from public.crew_of(uid)) as crew
        from public.players p
       where p.at_place = p_place and p.id <> uid and p.seen_at > fresh and p.banned_at is null and p.home_id is not null
         and (p.arrives_at is null or p.arrives_at <= clock_timestamp())
         and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = p.id) or (b.blocker = p.id and b.blocked = uid))
    )
    select jsonb_build_object(
      'count', (select count(*) from here),
      'people', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.display_name, 'style', h.starting_style, 'look', h.look,
                                                              'crew', h.crew, 'floor', h.at_floor, 'clout', h.clout, 'netWorth', public.net_worth(h.id))
                                           order by h.crew desc, h.seen_at desc)
                          from (select * from here order by crew desc, seen_at desc limit (cfg ->> 'hereMax')::int) h), '[]'::jsonb)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers: not callable from the browser
-- ---------------------------------------------------------------------------
revoke all on function public.came_back(uuid) from public, anon, authenticated;
revoke all on function public.invite_came_back_trigger() from public, anon, authenticated;
revoke all on function public.business_def(text) from public, anon, authenticated;
revoke all on function public.business_hype(bigint) from public, anon, authenticated;
revoke all on function public.business_worth(text, int, boolean, bigint) from public, anon, authenticated;
revoke all on function public.business_pay(text, int) from public, anon, authenticated;
revoke all on function public.rank_level(bigint, bigint) from public, anon, authenticated;
-- Who pays for unlimited chat is private; chat_status() tells you your own.
revoke all on function public.chat_unlimited(uuid) from public, anon, authenticated;
