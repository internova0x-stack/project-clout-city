-- 0151: the Player Economy, the shared core and Phase 1 (owner, Oct 31: "build the 3 phases"; docs/PLAYER-ECONOMY.md v0.1).
-- Value moves between players only as an item, a job's pay or (later) an asset: never as free cash.
--
--   * Settings: game_settings 'player_economy' (mirrored by lib/playerEconomy.ts, tests/playerEconomy.test.ts): the phase
--     switches (gifting: phase 1, gifts and player jobs; marketplace: phase 2; assets: phase 3), the unlock (account 7 days
--     old and Rank 2), the city fee by kind (5% on job pay and sales, 10% on assets, none on gifts), the weekly cap, the
--     price band (50% to 150%), the 14-day no-resale hold and the abuse-flag thresholds.
--   * The core every phase calls (internal, never the browser):
--       economy_can(player, kind, amount, direction) raises 'economy_frozen', 'phase_off', 'too_new', 'economy_locked' or
--         'weekly_limit'; economy_note(kind, ref, from, to, value, fee, label, cash, meta) logs a transfer once per
--         (kind, ref), counts it in economy_limits (sent and received per New York week) and runs the automatic flags;
--         economy_release(log) undoes a note (a declined gift, a cancelled trade).
--       economy_fee(kind, amount); economy_pay(to, gross, fee, kind, ref) pays gross under the feature's ledger kind and
--         takes the fee back under 'economy_fee' (ref '<kind>:<ref>'): the fee is paid to nobody. economy_hold(player,
--         amount, kind, ref) takes escrow.
--       economy_band(reference) / economy_band_check(players, reference, price, ref) for phases 2 and 3 (flags trades at
--         the band's edges). economy_flag(rule, players, ref, detail). economy_friends(a, b): crew, partner or a chat
--         both sides wrote in; economy_visible(viewer, owner): friends, or both on the open board (players.economy_open).
--       economy_item_tradable(item): a C$ Shop item past its no-resale hold (phase 2's check).
--   * Rank fairness: net_worth counts items received from players at Shop value at most, and C$ from player jobs (later
--     sales) only up to worthCap.weekly a week (economy_limits.uncounted is the rest, subtracted).
--   * Gifting: gift_send / gift_answer / gift_inbox / gift_candidates. The giver buys a C$ Shop item for a friend; the
--     recipient accepts (the item, held 14 days: no selling back, no trading) or declines (the item goes to the giver, or
--     the price back if they own it). Expires after 7 days. 5 a week. A push; Lola's Blotter for C$1,000+ (not opt-outs).
--   * Jobs board (migration 0050) upgrades: the economy's unlock instead of 2 days, friends-or-open-board visibility, the 5%
--     fee on pay and manager cuts, the weekly caps, workers rate clients (rate_client), and two game-verified kinds
--     (post_task): errands (check in at 2 to 4 named places: place_visits) and event support (be at a club event during its
--     time: event_attendance). Escrow on post, refunded at the deadline, paid on verification; flags for repeated trivial jobs.
--   * Studio: admin_economy, admin_economy_set (phase switches), admin_economy_flag (review), admin_economy_freeze.
--   * economy_state, economy_set_open, economy_history for the player (Phone → Bank → Trades & gifts).
-- Safe to run more than once.

do $$
begin
  if to_regprocedure('public.gala_donate(integer)') is null then
    raise exception 'Run migration 0150_underworld_part2.sql first: 0151 builds on it.';
  end if;
end $$;

insert into public.game_settings (key, value) values ('player_economy', '{"phases":{"gifting":true,"marketplace":false,"assets":false},"kinds":{"gift":"gifting","job":"gifting","trade":"marketplace","sale":"marketplace","asset":"assets"},"unlock":{"minAccountDays":7,"minRank":2},"fees":{"gift":0,"job":0.05,"trade":0.05,"sale":0.05,"asset":0.1},"weeklyCap":{"min":5000,"earningsShare":0.5,"earningsDays":28,"notEarnings":["job_pay","job_cut","job_refund","gift_refund","sale","economy_fee","market_sale","asset_sale"]},"worthCap":{"weekly":5000},"band":{"min":0.5,"max":1.5,"edge":0.05},"noResaleDays":14,"gifts":{"perWeek":5,"messageMax":140,"expireDays":7,"headlineMin":1000,"categories":["fashion","accessories","home","luxury","makeup"]},"jobs":{"payMin":100,"payMax":5000,"payChoices":[250,500,1000,2500],"hours":[6,24,72],"errandPlaces":{"min":2,"max":4},"clout":10,"trivialPerStep":1000},"flags":{"pairTransfers":3,"pairDays":7,"newAccountDays":14,"newHeavyValue":3000,"trivialJobs":2}}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Columns and tables
-- ---------------------------------------------------------------------------
alter table public.players add column if not exists economy_open boolean not null default false;
alter table public.players add column if not exists economy_frozen_at timestamptz;
alter table public.players add column if not exists economy_frozen_reason text;
-- How an item came from another player ('gift'; phase 2 adds 'trade'), and when it may be sold or traded again.
alter table public.player_items add column if not exists received_via text;
alter table public.player_items add column if not exists no_resale_until timestamptz;

create table if not exists public.economy_limits (
  player_id  uuid not null references public.players (id) on delete cascade,
  week       date not null,
  sent       bigint not null default 0,
  received   bigint not null default 0,
  -- C$ the player received as cash from other players (job pay after the fee; later sales), and the part over
  -- worthCap.weekly, which net_worth leaves out.
  earned     bigint not null default 0,
  uncounted  bigint not null default 0,
  gifts_sent int not null default 0,
  primary key (player_id, week)
);
alter table public.economy_limits enable row level security;
revoke all on public.economy_limits from anon, authenticated;

create table if not exists public.economy_log (
  id          bigint generated always as identity primary key,
  kind        text not null,
  ref         text not null,
  from_player uuid references public.players (id) on delete set null,
  to_player   uuid references public.players (id) on delete set null,
  value       bigint not null default 0,
  fee         bigint not null default 0,
  label       text,
  cash        boolean not null default false,
  status      text not null default 'done' check (status in ('done', 'reversed')),
  week        date not null,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists economy_log_from_idx on public.economy_log (from_player, created_at desc);
create index if not exists economy_log_to_idx on public.economy_log (to_player, created_at desc);
alter table public.economy_log enable row level security;
revoke all on public.economy_log from anon, authenticated;

create table if not exists public.economy_flags (
  id          bigint generated always as identity primary key,
  rule        text not null,
  players     uuid[] not null,
  ref         text not null,
  detail      jsonb not null default '{}',
  status      text not null default 'open' check (status in ('open', 'reviewed')),
  outcome     text check (outcome in ('cleared', 'frozen', 'noted')),
  note        text check (char_length(note) <= 300),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (rule, ref)
);
create index if not exists economy_flags_open_idx on public.economy_flags (status, created_at desc);
alter table public.economy_flags enable row level security;
revoke all on public.economy_flags from anon, authenticated;

create table if not exists public.gifts (
  id          bigint generated always as identity primary key,
  giver       uuid not null references public.players (id) on delete cascade,
  recipient   uuid not null references public.players (id) on delete cascade,
  sku         text not null,
  name        text not null,
  category    text not null,
  price       bigint not null,
  value       bigint not null,
  message     text check (char_length(message) <= 140),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  item_id     bigint,
  log_id      bigint,
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists gifts_recipient_idx on public.gifts (recipient, status, created_at desc);
create index if not exists gifts_giver_idx on public.gifts (giver, created_at desc);
alter table public.gifts enable row level security;
revoke all on public.gifts from anon, authenticated;

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in ('ban', 'unban', 'creator_rate', 'creator_length', 'creator_status', 'creator_attribution', 'couture_name',
                    'plaza_remove', 'economy_freeze', 'economy_unfreeze'));

-- Jobs (migration 0050): two game-verified kinds, a deadline and the fee, and the worker's rating of the client.
alter table public.jobs drop constraint if exists jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check check (kind in ('decorator', 'manager', 'errand', 'event'));
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('open', 'active', 'done', 'kept', 'undone', 'ended', 'cancelled', 'expired'));
alter table public.jobs add column if not exists target jsonb;
alter table public.jobs add column if not exists deadline timestamptz;
alter table public.jobs add column if not exists fee bigint not null default 0;
alter table public.jobs add column if not exists progress jsonb not null default '[]';
alter table public.jobs add column if not exists verified_at timestamptz;
alter table public.jobs add column if not exists worker_stars smallint check (worker_stars between 1 and 5);

-- ---------------------------------------------------------------------------
-- The core
-- ---------------------------------------------------------------------------
create or replace function public.economy_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select coalesce(public.game_settings_value('player_economy'), '{}'::jsonb) $$;

/** Is the phase behind this kind ('gift', 'job', 'trade', 'sale', 'asset') switched on? */
create or replace function public.economy_phase_on(p_kind text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((s -> 'phases' ->> (s -> 'kinds' ->> p_kind))::boolean, false) from (select public.economy_settings() s) x
$$;

/** Why a player can't trade yet (null when they can): 'no_player', 'economy_frozen', 'too_new' or 'economy_locked' (Rank 2). */
create or replace function public.economy_unlock(p_player uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  s jsonb := public.economy_settings();
  me public.players;
begin
  select * into me from public.players where id = p_player;
  if me.id is null or me.home_id is null or me.banned_at is not null then return 'no_player'; end if;
  if me.economy_frozen_at is not null then return 'economy_frozen'; end if;
  if me.created_at > now() - make_interval(days => coalesce((s -> 'unlock' ->> 'minAccountDays')::int, 7)) then return 'too_new'; end if;
  -- Campaign Mode's Rank 2 check (migration 0127): the best rank so far, or today's.
  if greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)) < coalesce((s -> 'unlock' ->> 'minRank')::int, 2) then
    return 'economy_locked';
  end if;
  return null;
end;
$$;

/** This week's cap, sent and received alike: the larger of weeklyCap.min and earningsShare × the last earningsDays' earnings ÷ 4. */
create or replace function public.economy_cap(p_player uuid) returns bigint
language sql stable security definer set search_path = public
as $$
  with s as (select public.economy_settings() -> 'weeklyCap' c)
  select greatest(coalesce((c ->> 'min')::bigint, 5000),
                  floor(coalesce((select sum(l.amount) from public.ledger l
                                   where l.player_id = p_player and l.currency = 'cash' and l.amount > 0
                                     and l.created_at > now() - make_interval(days => coalesce((c ->> 'earningsDays')::int, 28))
                                     and not ((c -> 'notEarnings') ? l.kind)), 0)
                        * coalesce((c ->> 'earningsShare')::numeric, 0.5) / 4)::bigint)
    from s
$$;

/** What's left of this week's cap: direction 'send' or 'receive'. */
create or replace function public.economy_room(p_player uuid, p_direction text) returns bigint
language sql stable security definer set search_path = public
as $$
  select greatest(0, public.economy_cap(p_player)
                   - coalesce((select case when p_direction = 'send' then l.sent else l.received end
                                 from public.economy_limits l where l.player_id = p_player and l.week = public.ny_week()), 0))
$$;

/** The gate every feature calls before value moves. Raises with the reason; true otherwise. */
create or replace function public.economy_can(p_player uuid, p_kind text, p_amount bigint, p_direction text) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  why text;
begin
  if p_direction not in ('send', 'receive') then raise exception 'bad_direction' using errcode = '22023'; end if;
  if not public.economy_phase_on(p_kind) then raise exception 'phase_off' using errcode = '22023'; end if;
  why := public.economy_unlock(p_player);
  if why = 'no_player' then raise exception 'no_player' using errcode = '28000'; end if;
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  if coalesce(p_amount, 0) > public.economy_room(p_player, p_direction) then
    raise exception 'weekly_limit' using errcode = '22023', hint = p_direction;
  end if;
  return true;
end;
$$;

/** The city's fee on a transfer of this kind (floor of amount × rate). */
create or replace function public.economy_fee(p_kind text, p_amount bigint) returns bigint
language sql stable security definer set search_path = public
as $$ select greatest(0, floor(coalesce(p_amount, 0) * coalesce((public.economy_settings() -> 'fees' ->> p_kind)::numeric, 0)))::bigint $$;

/** Escrow: takes the amount from the player's bank (ledger p_kind, −amount). */
create or replace function public.economy_hold(p_player uuid, p_amount bigint, p_kind text, p_ref text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_amount <= 0 then return; end if;
  update public.players set bank_cash = bank_cash - p_amount where id = p_player and bank_cash >= p_amount;
  if not found then raise exception 'cant_afford' using errcode = '22023'; end if;
  perform public.ledger_once(p_player, 'cash', -p_amount, p_kind, p_ref);
end;
$$;

/** Pays gross under the feature's ledger kind and takes the fee straight back under 'economy_fee': nobody gets the fee. Returns net. */
create or replace function public.economy_pay(p_to uuid, p_gross bigint, p_fee bigint, p_kind text, p_ref text) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_fee bigint := least(greatest(coalesce(p_fee, 0), 0), greatest(p_gross, 0));
begin
  if p_gross <= 0 then return 0; end if;
  if not public.ledger_once(p_to, 'cash', p_gross, p_kind, p_ref) then return 0; end if;
  update public.players set bank_cash = bank_cash + p_gross - v_fee where id = p_to;
  if v_fee > 0 then perform public.ledger_once(p_to, 'cash', -v_fee, 'economy_fee', p_kind || ':' || p_ref); end if;
  return p_gross - v_fee;
end;
$$;

/** Two players who know each other: crew, partners, or a chat both of them wrote in. Never blocked. */
create or replace function public.economy_friends(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_a is distinct from p_b and not public.is_blocked_pair(p_a, p_b)
     and (p_b in (select id from public.crew_of(p_a))
          or coalesce(public.couple_partner(p_a) = p_b, false)
          or exists (select 1 from public.conversations c
                      where c.a = least(p_a, p_b) and c.b = greatest(p_a, p_b)
                        and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender = p_a)
                        and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender = p_b)))
$$;

/** Who sees whose offers: friends, or both players on the open board. */
create or replace function public.economy_visible(p_viewer uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select public.economy_friends(p_viewer, p_owner)
      or (not public.is_blocked_pair(p_viewer, p_owner)
          and coalesce((select economy_open from public.players where id = p_viewer), false)
          and coalesce((select economy_open from public.players where id = p_owner), false))
$$;

/** An automatic flag for the Studio's review queue (once per rule and ref). */
create or replace function public.economy_flag(p_rule text, p_players uuid[], p_ref text, p_detail jsonb default '{}') returns void
language sql security definer set search_path = public
as $$
  insert into public.economy_flags (rule, players, ref, detail) values (p_rule, p_players, p_ref, coalesce(p_detail, '{}'))
  on conflict (rule, ref) do nothing
$$;

/** The automatic flags after a transfer: the same pair again and again, new accounts moving a lot. */
create or replace function public.economy_flag_scan(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  f jsonb := public.economy_settings() -> 'flags';
  n int;
  v bigint;
  who uuid;
begin
  if p_a is null or p_b is null then return; end if;
  select count(*) into n from public.economy_log
   where status = 'done' and created_at > now() - make_interval(days => coalesce((f ->> 'pairDays')::int, 7))
     and ((from_player = p_a and to_player = p_b) or (from_player = p_b and to_player = p_a));
  if n >= coalesce((f ->> 'pairTransfers')::int, 3) then
    perform public.economy_flag('repeat_pair', array[least(p_a, p_b), greatest(p_a, p_b)],
      'pair:' || least(p_a, p_b) || ':' || greatest(p_a, p_b) || ':' || public.ny_week(), jsonb_build_object('transfers', n));
  end if;
  foreach who in array array[p_a, p_b] loop
    if (select created_at from public.players where id = who) > now() - make_interval(days => coalesce((f ->> 'newAccountDays')::int, 14)) then
      select coalesce(sum(value), 0) into v from public.economy_log
       where status = 'done' and created_at > now() - interval '7 days' and who in (from_player, to_player);
      if v >= coalesce((f ->> 'newHeavyValue')::bigint, 3000) then
        perform public.economy_flag('new_heavy', array[who], 'new:' || who || ':' || public.ny_week(), jsonb_build_object('value', v));
      end if;
    end if;
  end loop;
end;
$$;

/** Logs a transfer once per (kind, ref) and counts it in both players' week. p_cash: the recipient got C$ (job pay, a sale). */
create or replace function public.economy_note(p_kind text, p_ref text, p_from uuid, p_to uuid, p_value bigint, p_fee bigint default 0,
  p_label text default null, p_cash boolean default false, p_meta jsonb default '{}') returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  wk date := public.ny_week();
  v_id bigint;
  cap bigint := coalesce((public.economy_settings() -> 'worthCap' ->> 'weekly')::bigint, 5000);
  net bigint := greatest(0, coalesce(p_value, 0) - coalesce(p_fee, 0));
begin
  insert into public.economy_log (kind, ref, from_player, to_player, value, fee, label, cash, week, meta)
  values (p_kind, p_ref, p_from, p_to, coalesce(p_value, 0), coalesce(p_fee, 0), left(p_label, 120), p_cash, wk, coalesce(p_meta, '{}'))
  on conflict (kind, ref) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;
  if p_from is not null then
    insert into public.economy_limits as l (player_id, week, sent, gifts_sent)
    values (p_from, wk, coalesce(p_value, 0), case when p_kind = 'gift' then 1 else 0 end)
    on conflict (player_id, week) do update set sent = l.sent + excluded.sent, gifts_sent = l.gifts_sent + excluded.gifts_sent;
  end if;
  if p_to is not null then
    insert into public.economy_limits as l (player_id, week, received, earned, uncounted)
    values (p_to, wk, coalesce(p_value, 0), case when p_cash then net else 0 end, case when p_cash then greatest(0, net - cap) else 0 end)
    on conflict (player_id, week) do update
      set received = l.received + excluded.received,
          earned = l.earned + excluded.earned,
          uncounted = greatest(0, l.earned + excluded.earned - cap);
  end if;
  perform public.economy_flag_scan(p_from, p_to);
  return v_id;
end;
$$;

/** Undoes a note: a declined or expired gift, a cancelled trade. The week it was counted in gets it back. */
create or replace function public.economy_release(p_log bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  e public.economy_log;
  cap bigint := coalesce((public.economy_settings() -> 'worthCap' ->> 'weekly')::bigint, 5000);
  net bigint;
begin
  update public.economy_log set status = 'reversed' where id = p_log and status = 'done' returning * into e;
  if e.id is null then return; end if;
  net := greatest(0, e.value - e.fee);
  update public.economy_limits set sent = greatest(0, sent - e.value) where player_id = e.from_player and week = e.week;
  update public.economy_limits
     set received = greatest(0, received - e.value),
         earned = greatest(0, earned - case when e.cash then net else 0 end),
         uncounted = greatest(0, greatest(0, earned - case when e.cash then net else 0 end) - cap)
   where player_id = e.to_player and week = e.week;
end;
$$;

/** The price band around a reference value (phases 2 and 3). */
create or replace function public.economy_band(p_reference bigint) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('min', ceil(p_reference * coalesce((b ->> 'min')::numeric, 0.5))::bigint,
                            'max', floor(p_reference * coalesce((b ->> 'max')::numeric, 1.5))::bigint)
    from (select public.economy_settings() -> 'band' b) x
$$;

/** Refuses a price outside the band ('out_of_band') and flags one at either edge ('band_edge'). */
create or replace function public.economy_band_check(p_players uuid[], p_reference bigint, p_price bigint, p_ref text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  b jsonb := public.economy_settings() -> 'band';
  lo numeric := coalesce((b ->> 'min')::numeric, 0.5);
  hi numeric := coalesce((b ->> 'max')::numeric, 1.5);
  edge numeric := coalesce((b ->> 'edge')::numeric, 0.05);
  r numeric;
begin
  if p_reference is null or p_reference <= 0 then raise exception 'no_reference' using errcode = '22023'; end if;
  r := p_price::numeric / p_reference;
  if r < lo or r > hi then raise exception 'out_of_band' using errcode = '22023'; end if;
  if r <= lo + edge or r >= hi - edge then
    perform public.economy_flag('band_edge', p_players, p_ref, jsonb_build_object('reference', p_reference, 'price', p_price));
  end if;
end;
$$;

/** Phase 2's check: a C$ Shop item that may change hands (never real money, rewards, story pieces, houses or cars yet). */
create or replace function public.economy_item_tradable(p_item bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select i.acquired = 'bought'
       and (i.no_resale_until is null or i.no_resale_until <= now())
       and not coalesce((s ->> 'collector')::boolean, false)
       and not coalesce((s ->> 'reward')::boolean, false)
       and not coalesce((s ->> 'storyOnly')::boolean, false)
       and (public.economy_settings() -> 'gifts' -> 'categories') ? i.category
      from public.player_items i cross join lateral (select public.shop_item(i.sku) s) x
     where i.id = p_item), false)
$$;

/** A Shop item a player can buy as a gift: C$ only, never Couture, real money, rewards or story pieces; the gift categories. */
create or replace function public.economy_giftable(p_sku text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select coalesce((s ->> 'price')::bigint, 0) > 0
       and not coalesce((s ->> 'collector')::boolean, false)
       and not coalesce((s ->> 'reward')::boolean, false)
       and not coalesce((s ->> 'storyOnly')::boolean, false)
       and (public.economy_settings() -> 'gifts' -> 'categories') ? (s ->> 'category')
       and public.shop_on_sale(p_sku)
      from (select public.shop_item(p_sku) s) x where s is not null), false)
$$;

-- ---------------------------------------------------------------------------
-- Rank fairness: net worth (migration 0048)
-- ---------------------------------------------------------------------------
create or replace function public.net_worth(p_player uuid) returns bigint
language sql stable security definer set search_path = public
as $$
  with raw as (
    select p.bank_cash
           -- Items from other players count at their Shop value at most (0151).
           + coalesce((select sum(case when i.received_via is null then i.value
                                       else least(i.value, coalesce((public.shop_item(i.sku) ->> 'price')::bigint, i.value)) end)
                         from public.player_items i where i.player_id = p.id), 0)
           + coalesce((select sum(public.business_worth(b.business_id, b.level, b.went_public, p.clout))
                         from public.player_businesses b where b.player_id = p.id), 0) as w
      from public.players p where p.id = p_player
  )
  -- C$ from other players over the weekly cap doesn't count (0151).
  select w - least(greatest(w, 0), coalesce((select sum(l.uncounted) from public.economy_limits l where l.player_id = p_player), 0))
    from raw
$$;

-- Start over (migration 0114) resets cash, so what it earned from players stops mattering too.
create or replace function public.economy_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.economy_limits set earned = 0, uncounted = 0 where player_id = new.player_id;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists player_restarts_economy on public.player_restarts;
create trigger player_restarts_economy after insert on public.player_restarts for each row execute function public.economy_on_restart();

-- ---------------------------------------------------------------------------
-- No resale: selling a gift back to the game (migration 0073's sell_item) waits out its hold
-- ---------------------------------------------------------------------------
create or replace function public.sell_item(p_item bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.player_items;
  v_amount int;
  today date := public.ny_today();
  v_every interval := (public.city() -> 'economy' -> 'bills' ->> 'every')::interval;
begin
  select * into it from public.player_items where id = p_item and player_id = uid for update;
  if it.id is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if it.acquired = 'collector' then raise exception 'not_sellable' using errcode = '22023'; end if;
  if coalesce((public.shop_item(it.sku) ->> 'reward')::boolean, false) then raise exception 'reward_unsellable' using errcode = '22023'; end if;
  -- 0151: otherwise a gift would be a 60% cash transfer.
  if it.no_resale_until is not null and it.no_resale_until > now() then raise exception 'no_resale' using errcode = '22023'; end if;
  v_amount := floor(it.value * (public.city() -> 'economy' ->> 'sellRate')::numeric);
  delete from public.player_items where id = it.id;
  update public.players
     set bank_cash = bank_cash + v_amount,
         house_sku = case when it.category = 'houses' then null else house_sku end,
         next_rent_due = case when it.category = 'houses' then (today + v_every)::date else next_rent_due end,
         car_sku = case when it.category = 'cars' then null else car_sku end,
         car_mode = case when it.category = 'cars' then null else car_mode end,
         next_car_due = case when it.category = 'cars' then null else next_car_due end
   where id = uid;
  perform public.ledger_once(uid, 'cash', v_amount, 'sale', it.id::text);
  return v_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- The player's side
-- ---------------------------------------------------------------------------
create or replace function public.economy_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.economy_settings();
  me public.players;
  l public.economy_limits;
  cap bigint;
  why text;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into l from public.economy_limits where player_id = uid and week = public.ny_week();
  cap := public.economy_cap(uid);
  why := public.economy_unlock(uid);
  return jsonb_build_object(
    'phases', s -> 'phases',
    'unlocked', why is null,
    'reason', why,
    'unlocksAt', me.created_at + make_interval(days => coalesce((s -> 'unlock' ->> 'minAccountDays')::int, 7)),
    'rank', greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)),
    'open', me.economy_open,
    'week', jsonb_build_object('start', public.ny_week(), 'cap', cap,
              'sent', coalesce(l.sent, 0), 'received', coalesce(l.received, 0),
              'giftsSent', coalesce(l.gifts_sent, 0), 'giftsLeft', greatest(0, coalesce((s -> 'gifts' ->> 'perWeek')::int, 5) - coalesce(l.gifts_sent, 0))),
    'uncounted', coalesce((select sum(x.uncounted) from public.economy_limits x where x.player_id = uid), 0));
end;
$$;

create or replace function public.economy_set_open(p_open boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.players set economy_open = coalesce(p_open, false) where id = auth.uid() and home_id is not null;
  if not found then raise exception 'no_player' using errcode = '28000'; end if;
  return public.economy_state();
end;
$$;

/** Everything the player sent and received: gifts and jobs now, trades and sales later. Names only, never amounts of others' cash. */
create or replace function public.economy_history(p_limit int default 50) returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'at') desc, (x ->> 'id')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', e.id, 'kind', e.kind, 'ref', e.ref, 'label', e.label, 'value', e.value, 'fee', e.fee, 'cash', e.cash,
      'status', e.status, 'at', e.created_at,
      'direction', case when e.from_player = auth.uid() then 'sent' else 'received' end,
      'with', o.id, 'withName', coalesce(o.display_name, 'a former player'), 'withStyle', o.starting_style) x
      from public.economy_log e
      left join public.players o on o.id = case when e.from_player = auth.uid() then e.to_player else e.from_player end
     where auth.uid() in (e.from_player, e.to_player)
     order by e.created_at desc, e.id desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) s
$$;

-- ---------------------------------------------------------------------------
-- Gifting
-- ---------------------------------------------------------------------------
/** Settles one pending gift (internal): accept gives the item; decline or expiry returns it to the giver (or their money). */
create or replace function public.gift_settle(p_id bigint, p_accept boolean, p_status text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  g public.gifts;
  v_item bigint;
  back text := 'item';
  noresale int := coalesce((public.economy_settings() ->> 'noResaleDays')::int, 14);
  hm bigint := coalesce((public.economy_settings() -> 'gifts' ->> 'headlineMin')::bigint, 1000);
  gv public.players;
  rc public.players;
begin
  select * into g from public.gifts where id = p_id for update;
  if g.id is null or g.status <> 'pending' then raise exception 'gift_gone' using errcode = '22023'; end if;
  if p_accept then
    if exists (select 1 from public.player_items where player_id = g.recipient and sku = g.sku) then
      raise exception 'already_owned' using errcode = '22023';
    end if;
    insert into public.player_items (player_id, sku, category, value, received_via, no_resale_until)
    values (g.recipient, g.sku, g.category, g.value, 'gift', now() + make_interval(days => noresale))
    returning id into v_item;
    update public.gifts set status = 'accepted', answered_at = now(), item_id = v_item where id = p_id;
    -- Lola notices the big gestures (never for News opt-outs, either side).
    if g.price >= hm then
      select * into gv from public.players where id = g.giver;
      select * into rc from public.players where id = g.recipient;
      if not coalesce(gv.news_opt_out, false) and not coalesce(rc.news_opt_out, false) then
        begin
          insert into public.choice_headlines (player_id, text, kind)
          values (g.giver, left('🎁 @' || gv.display_name || ' just gave @' || rc.display_name || ' a ' || lower(g.name)
                    || '. Lola is not saying it means something. Lola is saying it out loud, twice.', 260), 'win');
        exception when others then null;
        end;
      end if;
    end if;
    return jsonb_build_object('status', 'accepted', 'item', v_item);
  end if;
  -- Back to the giver: the item if they don't own one (and it's still on sale), otherwise the price.
  begin
    if exists (select 1 from public.player_items where player_id = g.giver and sku = g.sku) then raise exception 'owned'; end if;
    insert into public.player_items (player_id, sku, category, value) values (g.giver, g.sku, g.category, g.value) returning id into v_item;
  exception when others then
    back := 'cash';
    update public.players set bank_cash = bank_cash + g.price where id = g.giver;
    perform public.ledger_once(g.giver, 'cash', g.price, 'gift_refund', 'gift:' || g.id);
  end;
  update public.gifts set status = p_status, answered_at = now(), item_id = v_item where id = p_id;
  if g.log_id is not null then perform public.economy_release(g.log_id); end if;
  return jsonb_build_object('status', p_status, 'back', back);
end;
$$;

/** Expires gifts nobody answered (internal; run by the inbox). */
create or replace function public.gifts_settle_due(p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  g record;
begin
  for g in select id from public.gifts
            where status = 'pending' and p_player in (giver, recipient)
              and created_at < now() - make_interval(days => coalesce((public.economy_settings() -> 'gifts' ->> 'expireDays')::int, 7))
  loop
    perform public.gift_settle(g.id, false, 'expired');
  end loop;
end;
$$;

/** Who the player can send a gift to: crew, their partner and people they've chatted with (both ways). */
create or replace function public.gift_candidates() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  partner uuid := public.couple_partner(uid);
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.display_name, 'style', p.starting_style,
      'crew', p.id in (select id from public.crew_of(uid)), 'partner', coalesce(p.id = partner, false),
      'canReceive', public.economy_unlock(p.id) is null) order by coalesce(p.id = partner, false) desc, p.display_name)
    from public.players p
   where p.id <> uid and p.banned_at is null and p.home_id is not null
     and (p.id in (select id from public.crew_of(uid)) or p.id = partner
          or p.id in (select case when c.a = uid then c.b else c.a end from public.conversations c where uid in (c.a, c.b)))
     and public.economy_friends(uid, p.id)), '[]'::jsonb);
end;
$$;

create or replace function public.gift_send(p_to uuid, p_sku text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.economy_settings();
  item jsonb := public.shop_item(p_sku);
  me public.players;
  them public.players;
  v_price bigint;
  v_value bigint;
  msg text := nullif(trim(coalesce(p_message, '')), '');
  v_id bigint;
  v_log bigint;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if item is null or not public.economy_giftable(p_sku) then raise exception 'not_giftable' using errcode = '22023'; end if;
  if p_to = uid then raise exception 'own_gift' using errcode = '22023'; end if;
  if msg is not null and char_length(msg) > coalesce((s -> 'gifts' ->> 'messageMax')::int, 140) then raise exception 'message_too_long' using errcode = '22023'; end if;
  perform public.tick(uid);
  perform 1 from public.players where id in (uid, p_to) order by id for update;
  select * into me from public.players where id = uid;
  select * into them from public.players where id = p_to;
  if them.id is null or them.home_id is null or them.banned_at is not null then raise exception 'unknown_player' using errcode = '22023'; end if;
  if not public.economy_friends(uid, p_to) then raise exception 'not_friends' using errcode = '22023'; end if;
  v_value := (item ->> 'price')::bigint;
  v_price := round(v_value * (select multiplier from public.story_price(jsonb_build_array(p_sku, item ->> 'category'), 'shop_price')));
  perform public.economy_can(uid, 'gift', v_value, 'send');
  begin
    perform public.economy_can(p_to, 'gift', v_value, 'receive');
  exception when others then
    -- The recipient's reasons, named as theirs.
    if sqlerrm = 'weekly_limit' then raise exception 'their_weekly_limit' using errcode = '22023'; end if;
    if sqlerrm in ('too_new', 'economy_locked', 'economy_frozen') then raise exception 'they_cant_receive' using errcode = '22023'; end if;
    raise;
  end;
  if coalesce((select gifts_sent from public.economy_limits where player_id = uid and week = public.ny_week()), 0)
     >= coalesce((s -> 'gifts' ->> 'perWeek')::int, 5) then
    raise exception 'gift_limit' using errcode = '22023';
  end if;
  if exists (select 1 from public.player_items where player_id = p_to and sku = p_sku)
     or exists (select 1 from public.gifts where recipient = p_to and sku = p_sku and status = 'pending') then
    raise exception 'they_own_it' using errcode = '22023';
  end if;
  if them.clout < coalesce((item ->> 'cloutReq')::int, 0) then raise exception 'they_need_clout' using errcode = '22023'; end if;
  if me.bank_cash < v_price then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.gifts (giver, recipient, sku, name, category, price, value, message)
  values (uid, p_to, p_sku, coalesce(item ->> 'name', p_sku), item ->> 'category', v_price, v_value,
          case when msg is null then null else public.chat_filter(msg) end)
  returning id into v_id;
  perform public.economy_hold(uid, v_price, 'gift_send', 'gift:' || v_id);
  v_log := public.economy_note('gift', 'gift:' || v_id, uid, p_to, v_value, 0, coalesce(item ->> 'name', p_sku));
  update public.gifts set log_id = v_log where id = v_id;
  begin
    perform public.push_enqueue(p_to, 'gift_received', 'gift:' || v_id, '🎁 @' || me.display_name || ' sent you a gift',
      'A ' || lower(coalesce(item ->> 'name', 'something')) || ' is waiting. Open it before it goes back.', '/home?open=gifts', null, true, 'gift');
  exception when others then null;
  end;
  return jsonb_build_object('id', v_id, 'cash', -v_price);
end;
$$;

create or replace function public.gift_answer(p_id bigint, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.gifts;
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.gifts_settle_due(uid);
  select * into g from public.gifts where id = p_id and recipient = uid;
  if g.id is null or g.status <> 'pending' then raise exception 'gift_gone' using errcode = '22023'; end if;
  return public.gift_settle(p_id, coalesce(p_accept, false), 'declined');
end;
$$;

create or replace function public.gift_inbox() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.gifts_settle_due(uid);
  return jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(jsonb_build_object(
        'id', g.id, 'sku', g.sku, 'name', g.name, 'value', g.value, 'message', g.message, 'createdAt', g.created_at,
        'expiresAt', g.created_at + make_interval(days => coalesce((public.economy_settings() -> 'gifts' ->> 'expireDays')::int, 7)),
        'from', p.id, 'fromName', p.display_name, 'fromStyle', p.starting_style) order by g.created_at)
      from public.gifts g join public.players p on p.id = g.giver
     where g.recipient = uid and g.status = 'pending'), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object(
        'id', g.id, 'sku', g.sku, 'name', g.name, 'price', g.price, 'status', g.status, 'createdAt', g.created_at,
        'to', p.id, 'toName', p.display_name, 'toStyle', p.starting_style) order by g.created_at desc)
      from public.gifts g join public.players p on p.id = g.recipient
     where g.giver = uid and (g.status = 'pending' or g.answered_at > now() - interval '2 days')), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs (migration 0050), upgraded
-- ---------------------------------------------------------------------------
/** A job's title for the history ("Errand: 3 places"). */
create or replace function public.job_label(j public.jobs) returns text
language sql stable security definer set search_path = public
as $$
  select case j.kind
    when 'decorator' then 'Interior decorator'
    when 'manager' then 'Business manager'
    when 'errand' then 'Errands: ' || jsonb_array_length(coalesce(j.target -> 'places', '[]')) || ' check-ins'
    when 'event' then 'Event support: ' || coalesce((select e ->> 'name' from jsonb_array_elements(public.city() -> 'events') e
                                                       where e ->> 'id' = j.target ->> 'event'), 'a night out')
    else j.kind end
$$;

/** Pays a finished job (internal): pay minus the fee to the worker, clout, the history, flags and pushes. */
create or replace function public.job_pay_out(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
  v_fee bigint;
  v_clout int;
  cfg jsonb := public.economy_settings() -> 'jobs';
  steps int;
  n int;
begin
  select * into j from public.jobs where id = p_id for update;
  if j.id is null or j.worker is null or j.status not in ('active', 'done') then return; end if;
  v_fee := public.economy_fee('job', j.pay);
  v_clout := case when j.kind = 'decorator' then (public.city() -> 'economy' -> 'jobs' -> 'decorator' ->> 'clout')::int
                else coalesce((cfg ->> 'clout')::int, 10) end;
  perform public.economy_pay(j.worker, j.pay, v_fee, 'job_pay', 'job:' || j.id);
  if v_clout > 0 and public.ledger_once(j.worker, 'clout', v_clout, 'job_pay', 'job:' || j.id) then
    update public.players set clout = clout + v_clout where id = j.worker;
  end if;
  update public.jobs set status = 'kept', settled_at = now(), verified_at = coalesce(verified_at, now()), earned = j.pay - v_fee, fee = v_fee
   where id = p_id;
  perform public.economy_note('job', 'job:' || j.id, j.poster, j.worker, j.pay, v_fee, public.job_label(j), true,
                              jsonb_build_object('jobKind', j.kind));
  -- Repeated trivial jobs between the same two: a lot of pay for very little work.
  steps := case j.kind when 'errand' then greatest(1, jsonb_array_length(coalesce(j.target -> 'places', '[]'))) else 1 end;
  if j.kind in ('errand', 'event') and j.pay::numeric / steps > coalesce((cfg ->> 'trivialPerStep')::numeric, 1000) then
    select count(*) into n from public.jobs x
     where x.poster = j.poster and x.worker = j.worker and x.status = 'kept' and x.kind in ('errand', 'event')
       and x.settled_at > now() - interval '7 days'
       and x.pay::numeric / (case x.kind when 'errand' then greatest(1, jsonb_array_length(coalesce(x.target -> 'places', '[]'))) else 1 end)
           > coalesce((cfg ->> 'trivialPerStep')::numeric, 1000);
    if n >= coalesce((public.economy_settings() -> 'flags' ->> 'trivialJobs')::int, 2) then
      perform public.economy_flag('trivial_jobs', array[j.poster, j.worker], 'trivial:' || j.poster || ':' || j.worker || ':' || public.ny_week(),
                                  jsonb_build_object('jobs', n));
    end if;
  end if;
  begin
    perform public.push_enqueue(j.worker, 'job_paid', 'job_paid:' || j.id, '💼 Paid: ' || public.job_label(j),
      'C$' || to_char(j.pay - v_fee, 'FM999,999,999') || ' after the city fee. Rate your client in Jobs.', '/home?open=jobs', null, false, 'job');
  exception when others then null;
  end;
end;
$$;

/** Decorator jobs (migration 0050) settle with the fee now. */
create or replace function public.job_keep(p_id bigint, p_keep boolean) returns void
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_id for update;
  if j.status <> 'done' then return; end if;
  if p_keep and j.worker is not null then
    perform public.job_pay_out(p_id);
  else
    update public.players set home_layout = j.layout_before, bank_cash = bank_cash + j.pay where id = j.poster;
    perform public.ledger_once(j.poster, 'cash', j.pay, 'job_refund', 'job:' || j.id);
    update public.jobs set status = 'undone', settled_at = now() where id = p_id;
  end if;
end;
$$;

/** Expires errands and event jobs past their deadline (the pay back to the poster), checks finished work, and the 0050 rules. */
create or replace function public.jobs_settle_due(p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  d jsonb := public.city() -> 'economy' -> 'jobs' -> 'decorator';
  j record;
begin
  update public.jobs set status = 'done', finished_at = taken_at + make_interval(mins => (d ->> 'minutes')::int)
   where kind = 'decorator' and status = 'active' and p_player in (poster, worker)
     and taken_at + make_interval(mins => (d ->> 'minutes')::int) < now();
  for j in select id from public.jobs
            where kind = 'decorator' and status = 'done' and p_player in (poster, worker)
              and finished_at + make_interval(hours => (d ->> 'autoKeepHours')::int) < now()
  loop
    perform public.job_keep(j.id, true);
  end loop;
  for j in select id, poster, pay from public.jobs
            where kind in ('errand', 'event') and status in ('open', 'active') and p_player in (poster, worker) and deadline < now()
  loop
    update public.jobs set status = 'expired', settled_at = now() where id = j.id;
    if j.pay > 0 then
      update public.players set bank_cash = bank_cash + j.pay where id = j.poster;
      perform public.ledger_once(j.poster, 'cash', j.pay, 'job_refund', 'job:' || j.id);
    end if;
  end loop;
end;
$$;

/** Is the work done? Errands: a check-in at every place since the job was taken. Events: there during the event. */
create or replace function public.job_verified(p_id bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select case j.kind
    when 'errand' then jsonb_array_length(coalesce(j.target -> 'places', '[]')) > 0
                       and not exists (select 1 from jsonb_array_elements_text(j.target -> 'places') p where not (j.progress ? p))
    when 'event' then j.progress ? (j.target ->> 'event')
    else false end
    from public.jobs j where j.id = p_id
$$;

/** Check-ins (place_visits: any activity at a place) count toward the player's errands. Never breaks the visit. */
create or replace function public.economy_job_visit() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  j record;
begin
  for j in select id from public.jobs
            where worker = new.player_id and kind = 'errand' and status = 'active' and deadline >= now()
              and (target -> 'places') ? new.place_id and not (progress ? new.place_id)
  loop
    update public.jobs set progress = progress || to_jsonb(new.place_id) where id = j.id;
    if public.job_verified(j.id) then perform public.job_pay_out(j.id); end if;
  end loop;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists place_visits_economy_jobs on public.place_visits;
create trigger place_visits_economy_jobs after insert or update on public.place_visits
  for each row execute function public.economy_job_visit();

/** Attending the event (attend_event, which checks its time) finishes event support. */
create or replace function public.economy_job_event() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  j record;
begin
  for j in select id from public.jobs
            where worker = new.player_id and kind = 'event' and status = 'active' and deadline >= now()
              and target ->> 'event' = new.event_id
  loop
    update public.jobs set progress = progress || to_jsonb(new.event_id) where id = j.id;
    perform public.job_pay_out(j.id);
  end loop;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists event_attendance_economy_jobs on public.event_attendance;
create trigger event_attendance_economy_jobs after insert on public.event_attendance
  for each row execute function public.economy_job_event();

/** Ratings both ways: as a worker (clients' stars) and as a client (workers' stars). */
create or replace function public.job_rating(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('hired', count(*) filter (where worker = p_player and taken_at is not null),
                            'rating', round(avg(stars) filter (where worker = p_player)::numeric, 1),
                            'rated', count(stars) filter (where worker = p_player),
                            'clientRating', round(avg(worker_stars) filter (where poster = p_player)::numeric, 1),
                            'clientRated', count(worker_stars) filter (where poster = p_player))
    from public.jobs where p_player in (worker, poster)
$$;

create or replace function public.post_job(p_kind text, p_pay bigint, p_cut int, p_note text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.city() -> 'economy' -> 'jobs';
  me public.players;
  v_id bigint;
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_kind in ('errand', 'event') then raise exception 'use_post_task' using errcode = '22023'; end if;
  if p_kind = 'decorator' and (p_pay is null or p_pay < (cfg -> 'decorator' ->> 'payMin')::bigint or p_pay > (cfg -> 'decorator' ->> 'payMax')::bigint) then
    raise exception 'bad_pay' using errcode = '22023';
  end if;
  -- 0151: the economy's unlock (7 days, Rank 2), its phase switch and the weekly cap on what's held.
  perform public.economy_can(uid, 'job', case when p_kind = 'decorator' then coalesce(p_pay, 0) else 0 end, 'send');
  if exists (select 1 from public.jobs where poster = uid and kind = p_kind and status in ('open', 'active', 'done')) then
    raise exception 'already_posted' using errcode = '22023';
  end if;
  if p_kind = 'decorator' then
    if p_pay is null or p_pay < (cfg -> 'decorator' ->> 'payMin')::bigint or p_pay > (cfg -> 'decorator' ->> 'payMax')::bigint then
      raise exception 'bad_pay' using errcode = '22023';
    end if;
    if me.bank_cash < p_pay then raise exception 'cant_afford' using errcode = '22023'; end if;
    insert into public.jobs (poster, kind, pay, note) values (uid, 'decorator', p_pay, nullif(public.chat_filter(trim(coalesce(p_note, ''))), '')) returning id into v_id;
    perform public.economy_hold(uid, p_pay, 'job_hold', 'job:' || v_id);
    return jsonb_build_object('id', v_id, 'cash', -p_pay);
  elsif p_kind = 'manager' then
    if p_cut is null or p_cut < (cfg -> 'manager' ->> 'cutMin')::int or p_cut > (cfg -> 'manager' ->> 'cutMax')::int then
      raise exception 'bad_cut' using errcode = '22023';
    end if;
    if not exists (select 1 from public.player_businesses where player_id = uid) then raise exception 'no_business' using errcode = '22023'; end if;
    insert into public.jobs (poster, kind, cut, note) values (uid, 'manager', p_cut, nullif(public.chat_filter(trim(coalesce(p_note, ''))), '')) returning id into v_id;
    return jsonb_build_object('id', v_id, 'cash', 0);
  end if;
  raise exception 'bad_kind' using errcode = '22023';
end;
$$;

/** Posts a game-verified job: 'errand' {places: [2 to 4 place ids]} or 'event' {event: id}. The pay is held until it's done. */
create or replace function public.post_task(p_kind text, p_pay bigint, p_target jsonb, p_hours int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.economy_settings() -> 'jobs';
  me public.players;
  v_id bigint;
  places jsonb;
  t jsonb;
  n int;
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_kind not in ('errand', 'event') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if p_pay is null or p_pay < (cfg ->> 'payMin')::bigint or p_pay > (cfg ->> 'payMax')::bigint then raise exception 'bad_pay' using errcode = '22023'; end if;
  if p_hours is null or not ((cfg -> 'hours') @> to_jsonb(p_hours)) then raise exception 'bad_hours' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'job', p_pay, 'send');
  if exists (select 1 from public.jobs where poster = uid and kind = p_kind and status in ('open', 'active')) then
    raise exception 'already_posted' using errcode = '22023';
  end if;
  if p_kind = 'errand' then
    if jsonb_typeof(p_target -> 'places') <> 'array' then raise exception 'bad_target' using errcode = '22023'; end if;
    select jsonb_agg(distinct x) into places from jsonb_array_elements_text(p_target -> 'places') x;
    n := coalesce(jsonb_array_length(places), 0);
    if n < (cfg -> 'errandPlaces' ->> 'min')::int or n > (cfg -> 'errandPlaces' ->> 'max')::int then raise exception 'bad_target' using errcode = '22023'; end if;
    -- Real places on the map, never story-only ones.
    if exists (select 1 from jsonb_array_elements_text(places) x
                where not exists (select 1 from jsonb_array_elements(public.city() -> 'places') p
                                   where p ->> 'id' = x and p ->> 'story' is null)) then
      raise exception 'bad_target' using errcode = '22023';
    end if;
    t := jsonb_build_object('places', places);
  else
    if not exists (select 1 from jsonb_array_elements(public.city() -> 'events') e where e ->> 'id' = p_target ->> 'event') then
      raise exception 'bad_target' using errcode = '22023';
    end if;
    t := jsonb_build_object('event', p_target ->> 'event');
  end if;
  if me.bank_cash < p_pay then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.jobs (poster, kind, pay, note, target, deadline)
  values (uid, p_kind, p_pay, nullif(public.chat_filter(trim(coalesce(p_note, ''))), ''), t, now() + make_interval(hours => p_hours))
  returning id into v_id;
  perform public.economy_hold(uid, p_pay, 'job_hold', 'job:' || v_id);
  return jsonb_build_object('id', v_id, 'cash', -p_pay, 'fee', public.economy_fee('job', p_pay));
end;
$$;

create or replace function public.take_job(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs;
  layout jsonb;
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.jobs_settle_due(uid);
  select * into j from public.jobs where id = p_id for update;
  if j.id is null or j.status <> 'open' then raise exception 'job_taken' using errcode = '22023'; end if;
  if j.poster = uid then raise exception 'own_job' using errcode = '22023'; end if;
  if public.is_blocked_pair(uid, j.poster) then raise exception 'blocked' using errcode = '42501'; end if;
  perform public.economy_can(uid, 'job', j.pay, 'receive');
  if not public.economy_visible(uid, j.poster) then raise exception 'not_friends' using errcode = '22023'; end if;
  if j.deadline is not null and j.deadline < now() then raise exception 'job_over' using errcode = '22023'; end if;
  if (select count(*) from public.jobs x
       where x.taken_at is not null and (x.taken_at at time zone 'America/New_York')::date = public.ny_today()
         and ((x.poster = j.poster and x.worker = uid) or (x.poster = uid and x.worker = j.poster)))
     >= (public.city() -> 'economy' -> 'jobs' ->> 'perPairPerDay')::int then
    raise exception 'pair_limit' using errcode = '22023';
  end if;
  if exists (select 1 from public.jobs where worker = uid and kind = j.kind and status = 'active') then
    raise exception 'already_working' using errcode = '22023';
  end if;
  if j.kind = 'decorator' then
    select home_layout into layout from public.players where id = j.poster;
  end if;
  update public.jobs set status = 'active', worker = uid, taken_at = now(), layout_before = layout where id = p_id;
  begin
    perform public.push_enqueue(j.poster, 'job_taken', 'job_taken:' || j.id, '💼 Someone took your job',
      '@' || (select display_name from public.players where id = uid) || ' is on it: ' || lower(public.job_label(j)) || '.',
      '/home?open=jobs', j.deadline, true, 'job');
  exception when others then null;
  end;
  return jsonb_build_object('id', p_id, 'kind', j.kind);
end;
$$;

/** The worker asks the game to check their errand or event (the triggers usually beat them to it). */
create or replace function public.job_check(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
begin
  perform public.jobs_settle_due(auth.uid());
  select * into j from public.jobs where id = p_id and worker = auth.uid() and kind in ('errand', 'event');
  if j.id is null then raise exception 'unknown_job' using errcode = '22023'; end if;
  if j.status = 'active' and public.job_verified(p_id) then perform public.job_pay_out(p_id); end if;
  select * into j from public.jobs where id = p_id;
  return jsonb_build_object('status', j.status, 'progress', j.progress, 'earned', j.earned);
end;
$$;

/** The worker rates the client, once, after a job is settled. */
create or replace function public.rate_client(p_id bigint, p_stars int) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_stars < 1 or p_stars > 5 then raise exception 'bad_stars' using errcode = '22023'; end if;
  update public.jobs set worker_stars = p_stars
   where id = p_id and worker = auth.uid() and worker_stars is null and status in ('kept', 'undone', 'ended');
  if not found then raise exception 'unknown_job' using errcode = '22023'; end if;
end;
$$;

/** The manager empties the client's tills and keeps their cut, minus the city fee, within both players' weekly caps. */
create or replace function public.manager_collect(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs;
  b record;
  total bigint := 0;
  my_cut bigint;
  v_fee bigint;
  stamp bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into j from public.jobs where id = p_id and worker = uid and kind = 'manager' for update;
  if j.id is null or j.status <> 'active' then raise exception 'job_over' using errcode = '22023'; end if;
  if public.is_blocked_pair(uid, j.poster) then raise exception 'blocked' using errcode = '42501'; end if;
  perform public.economy_can(uid, 'job', 0, 'receive');
  perform 1 from public.players where id in (uid, j.poster) order by id for update;
  for b in select business_id from public.player_businesses where player_id = j.poster order by bought_at loop
    total := total + public.business_collect_one(j.poster, b.business_id);
  end loop;
  -- The cut stops at what's left of either player's week.
  my_cut := least(floor(total * j.cut / 100.0)::bigint, public.economy_room(uid, 'receive'), public.economy_room(j.poster, 'send'));
  v_fee := public.economy_fee('job', my_cut);
  if my_cut > 0 then
    update public.players set bank_cash = bank_cash - my_cut where id = j.poster;
    perform public.ledger_once(j.poster, 'cash', -my_cut, 'job_cut', 'job:' || j.id || ':' || stamp);
    perform public.economy_pay(uid, my_cut, v_fee, 'job_cut', 'job:' || j.id || ':' || stamp);
    perform public.economy_note('job', 'job:' || j.id || ':' || stamp, j.poster, uid, my_cut, v_fee, 'Business manager', true,
                                jsonb_build_object('jobKind', 'manager'));
    update public.jobs set earned = earned + my_cut - v_fee, fee = fee + v_fee where id = p_id;
  end if;
  return jsonb_build_object('collected', total, 'cash', greatest(my_cut - v_fee, 0), 'fee', v_fee);
end;
$$;

/** The Jobs app: open jobs from friends (or the open board), the jobs you posted and the ones you're working. */
create or replace function public.jobs_board() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d jsonb := public.city() -> 'economy' -> 'jobs' -> 'decorator';
  why text;
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.jobs_settle_due(uid);
  why := public.economy_unlock(uid);
  return jsonb_build_object(
    'canWork', why is null and public.economy_phase_on('job'),
    'locked', case when not public.economy_phase_on('job') then 'phase_off' else why end,
    'feeRate', coalesce((public.economy_settings() -> 'fees' ->> 'job')::numeric, 0),
    'open', coalesce((select jsonb_agg(x order by sunk, at desc) from (
        select (coalesce((public.job_rating(p.id) ->> 'clientRating')::numeric, 4) < 2.5) as sunk, j.created_at as at, jsonb_build_object(
          'id', j.id, 'kind', j.kind, 'pay', j.pay, 'cut', j.cut, 'note', j.note, 'createdAt', j.created_at,
          'target', j.target, 'deadline', j.deadline, 'fee', public.economy_fee('job', j.pay),
          'poster', p.id, 'posterName', p.display_name, 'posterStyle', p.starting_style, 'homeId', p.home_id,
          'posterRating', public.job_rating(p.id), 'friend', public.economy_friends(uid, p.id),
          'businesses', (select count(*) from public.player_businesses b where b.player_id = p.id),
          'perDay', case when j.kind = 'manager'
                    then floor((select coalesce(sum(public.business_pay(b.business_id, b.level)), 0) from public.player_businesses b where b.player_id = p.id) * j.cut / 100.0)::bigint
                    end) as x
          from public.jobs j join public.players p on p.id = j.poster
         where j.status = 'open' and j.poster <> uid and p.banned_at is null and public.economy_visible(uid, j.poster)
           and (j.deadline is null or j.deadline > now())
         -- Clients rated low by workers sink down the board.
         order by 1, j.created_at desc limit 30) s), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object(
          'id', j.id, 'kind', j.kind, 'pay', j.pay, 'cut', j.cut, 'note', j.note, 'status', j.status, 'stars', j.stars,
          'moved', j.moved, 'earned', j.earned, 'createdAt', j.created_at, 'takenAt', j.taken_at, 'finishedAt', j.finished_at,
          'target', j.target, 'deadline', j.deadline, 'progress', j.progress, 'fee', j.fee,
          'endsAt', case when j.kind = 'decorator' and j.taken_at is not null then j.taken_at + make_interval(mins => (d ->> 'minutes')::int) end,
          'keepBy', case when j.status = 'done' then j.finished_at + make_interval(hours => (d ->> 'autoKeepHours')::int) end,
          'worker', w.id, 'workerName', w.display_name, 'workerStyle', w.starting_style,
          'workerRating', case when w.id is not null then public.job_rating(w.id) end) order by j.created_at desc)
        from public.jobs j left join public.players w on w.id = j.worker
       where j.poster = uid and (j.status in ('open', 'active', 'done') or j.settled_at > now() - interval '1 day')), '[]'::jsonb),
    'working', coalesce((select jsonb_agg(jsonb_build_object(
          'id', j.id, 'kind', j.kind, 'pay', j.pay, 'cut', j.cut, 'note', j.note, 'status', j.status, 'earned', j.earned,
          'takenAt', j.taken_at, 'moved', j.moved, 'target', j.target, 'deadline', j.deadline, 'progress', j.progress,
          'fee', case when j.status = 'kept' or j.kind = 'manager' then j.fee else public.economy_fee('job', j.pay) end,
          'clientStars', j.worker_stars,
          'endsAt', case when j.kind = 'decorator' then j.taken_at + make_interval(mins => (d ->> 'minutes')::int) end,
          'poster', p.id, 'posterName', p.display_name, 'posterStyle', p.starting_style) order by j.taken_at desc)
        from public.jobs j join public.players p on p.id = j.poster
       where j.worker = uid and (j.status in ('active', 'done') or j.settled_at > now() - interval '1 day')), '[]'::jsonb),
    'rating', public.job_rating(uid));
end;
$$;

-- ---------------------------------------------------------------------------
-- Studio: the Economy tab
-- ---------------------------------------------------------------------------
create or replace function public.admin_economy() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  wk date := public.ny_week();
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'settings', public.economy_settings(),
    'week', jsonb_build_object('start', wk,
      'transfers', (select count(*) from public.economy_log where week = wk and status = 'done'),
      'value', coalesce((select sum(value) from public.economy_log where week = wk and status = 'done'), 0),
      'fees', coalesce((select sum(fee) from public.economy_log where week = wk and status = 'done'), 0),
      'gifts', (select count(*) from public.economy_log where week = wk and status = 'done' and kind = 'gift'),
      'jobs', (select count(*) from public.economy_log where week = wk and status = 'done' and kind = 'job')),
    'flags', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'rule', f.rule, 'ref', f.ref, 'detail', f.detail, 'status', f.status, 'outcome', f.outcome, 'note', f.note,
        'createdAt', f.created_at, 'reviewedAt', f.reviewed_at,
        'players', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'joined', p.created_at,
                                                                 'frozen', p.economy_frozen_at is not null)), '[]'::jsonb)
                      from public.players p where p.id = any(f.players))) order by (f.status = 'open') desc, f.created_at desc)
      from (select * from public.economy_flags where status = 'open' or reviewed_at > now() - interval '14 days'
             order by created_at desc limit 100) f), '[]'::jsonb),
    'frozen', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'at', p.economy_frozen_at,
                                                            'reason', p.economy_frozen_reason) order by p.economy_frozen_at desc)
      from public.players p where p.economy_frozen_at is not null), '[]'::jsonb));
end;
$$;

create or replace function public.admin_economy_set(p_phase text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_phase not in ('gifting', 'marketplace', 'assets') then raise exception 'bad_phase' using errcode = '22023'; end if;
  update public.game_settings set value = jsonb_set(value, array['phases', p_phase], to_jsonb(coalesce(p_on, false))), updated_at = now()
   where key = 'player_economy';
  return public.admin_economy();
end;
$$;

/** Freezes (or unfreezes) a player's trading, with a reason in admin_actions. */
create or replace function public.admin_economy_freeze(p_player uuid, p_frozen boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  perform public.require_story_admin();
  if not exists (select 1 from public.players where id = p_player) then raise exception 'unknown_player' using errcode = '22023'; end if;
  update public.players
     set economy_frozen_at = case when p_frozen then coalesce(economy_frozen_at, now()) end,
         economy_frozen_reason = case when p_frozen then reason end
   where id = p_player;
  insert into public.admin_actions (admin_id, player_id, action, reason)
  values (auth.uid(), p_player, case when p_frozen then 'economy_freeze' else 'economy_unfreeze' end, reason);
  return public.admin_economy();
end;
$$;

/** Reviews a flag: 'cleared' (nothing wrong), 'noted' (watch it) or 'frozen' (freezes everyone in it). */
create or replace function public.admin_economy_flag(p_id bigint, p_outcome text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  f public.economy_flags;
  who uuid;
begin
  perform public.require_story_admin();
  if p_outcome not in ('cleared', 'noted', 'frozen') then raise exception 'bad_outcome' using errcode = '22023'; end if;
  update public.economy_flags set status = 'reviewed', outcome = p_outcome, note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id returning * into f;
  if f.id is null then raise exception 'unknown_flag' using errcode = '22023'; end if;
  if p_outcome = 'frozen' then
    foreach who in array f.players loop
      perform public.admin_economy_freeze(who, true, coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Flag: ' || f.rule));
    end loop;
  end if;
  return public.admin_economy();
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.economy_settings()', 'public.economy_phase_on(text)', 'public.economy_unlock(uuid)', 'public.economy_cap(uuid)',
    'public.economy_room(uuid, text)', 'public.economy_can(uuid, text, bigint, text)', 'public.economy_fee(text, bigint)',
    'public.economy_hold(uuid, bigint, text, text)', 'public.economy_pay(uuid, bigint, bigint, text, text)',
    'public.economy_friends(uuid, uuid)', 'public.economy_visible(uuid, uuid)', 'public.economy_flag(text, uuid[], text, jsonb)',
    'public.economy_flag_scan(uuid, uuid)', 'public.economy_note(text, text, uuid, uuid, bigint, bigint, text, boolean, jsonb)',
    'public.economy_release(bigint)', 'public.economy_band(bigint)', 'public.economy_band_check(uuid[], bigint, bigint, text)',
    'public.economy_item_tradable(bigint)', 'public.economy_giftable(text)', 'public.economy_on_restart()',
    'public.gift_settle(bigint, boolean, text)', 'public.gifts_settle_due(uuid)',
    'public.job_label(public.jobs)', 'public.job_pay_out(bigint)', 'public.job_keep(bigint, boolean)', 'public.jobs_settle_due(uuid)',
    'public.job_verified(bigint)', 'public.economy_job_visit()', 'public.economy_job_event()', 'public.net_worth(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.economy_state()', 'public.economy_set_open(boolean)', 'public.economy_history(integer)',
    'public.gift_candidates()', 'public.gift_send(uuid, text, text)', 'public.gift_answer(bigint, boolean)', 'public.gift_inbox()',
    'public.post_job(text, bigint, integer, text)', 'public.post_task(text, bigint, jsonb, integer, text)', 'public.take_job(bigint)',
    'public.job_check(bigint)', 'public.rate_client(bigint, integer)', 'public.manager_collect(bigint)', 'public.jobs_board()',
    'public.sell_item(bigint)', 'public.job_rating(uuid)',
    'public.admin_economy()', 'public.admin_economy_set(text, boolean)', 'public.admin_economy_freeze(uuid, boolean, text)',
    'public.admin_economy_flag(bigint, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
