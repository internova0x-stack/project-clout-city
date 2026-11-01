-- 0152: the Player Economy, Phase 2: the item marketplace and underworld jobs between players (owner, Oct 31: "build the 3
-- phases"; docs/PLAYER-ECONOMY.md sections 2, 4.2, 5 and 7). Built on 0151's core (economy_can, economy_note, economy_pay,
-- economy_hold, economy_band, economy_band_check, economy_flag, economy_visible, economy_friends, economy_item_tradable);
-- nothing here re-implements it. Everything refuses with 'phase_off' while game_settings 'player_economy' phases.marketplace
-- is off (it starts off), and while it is off open listings and swaps are handed back as players look.
--
--   * Settings: game_settings 'marketplace' (mirrored by lib/marketplace.ts, checked by tests/marketplace.test.ts).
--   * Listings: market_list(item, price) puts a tradable C$ Shop item (economy_item_tradable, not a couples piece, not worn) up
--     for C$ inside the price band around its Shop price. One listing per item (the item is locked). Visible to friends, or to
--     everyone on the open board (economy_visible). market_buy(id, sure) holds the buyer's C$ (ledger 'market_hold'), pays the
--     seller minus the 5% sale fee (ledger 'market_sale', fee 'economy_fee'), moves the item (received_via 'sale', a fresh
--     14-day no-resale hold) and logs one economy_note('sale'). market_cancel(id) any time. A player buys at most perSkuWeek
--     of one sku a New York week (counting swaps); reaching it flags 'sku_limit'.
--   * Swaps, the trade window: trade_offer / trade_edit / trade_confirm / trade_cancel. Items (1 to 4 a side) and optional C$
--     (at most half its side's value) for the other player's items; both sides must balance within the band. Confirming locks
--     that side's items and holds its C$ (escrow); any change resets both confirmations and gives everything back; the
--     version a player confirms must be the one on screen ('trade_changed'); over bigTrade needs a second confirm
--     ('confirm_big'). The second confirmation settles everything in one function (market_trade_settle). 24 hours to close.
--   * Locked items (player_items.market_lock) can't be sold to the game, deleted, equipped or moved (market_item_guard).
--   * Trade hold: listing, buying, swapping and hiring wait hold.hours after a sign-in from a new device (economy_devices,
--     recorded from the Supabase session on session_ping and on market calls; the device is the session's user agent from
--     auth.sessions when Supabase has it) or an email change (auth.users.email_change_sent_at when present): 'trade_hold'.
--   * Reversal: admin_market_reverse(kind, id, reason) within reversalDays: items and C$ go back, economy_release on the notes,
--     a market_reversals row and admin_actions 'market_reverse'. admin_market_recent() is Studio → Economy's Recent trades.
--   * Underworld jobs between players (NPC targets only; the engine is lib/underworld.ts, run by app/home/underworldActions.ts):
--     an invited player sends one of today's Pablo offers to an invited friend (a runner) for a cut held in escrow
--     (ledger 'job_hold'); the runner does it in the back room as usual; the cut is paid minus 5% ('job_pay', economy_note
--     'job' with jobKind 'underworld'), Pablo's take goes to the poster ('underworld_pay') and both get Heat. Service role
--     only: underworld_runners, underworld_hire_post, underworld_hire_list, underworld_hire_get, underworld_hire_decline,
--     underworld_hire_settle. Unanswered hires go back after 24 hours.
--   * Start over hands back the player's listings, swaps and hires first.
-- Safe to run more than once.

do $$
begin
  if to_regclass('public.economy_limits') is null then
    raise exception 'Run migration 0151_player_economy.sql first: 0152 builds on it.';
  end if;
end $$;

insert into public.game_settings (key, value) values ('marketplace', '{"listing":{"maxOpen":8,"days":14},"perSkuWeek":2,"swap":{"maxItems":4,"hours":24,"cashMaxShare":0.5},"bigTrade":2500,"hold":{"hours":72},"reversalDays":7,"hire":{"cuts":[100,250,500,1000],"perDay":1,"hours":24,"posterHeat":5,"runnerHeat":3}}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Columns and tables
-- ---------------------------------------------------------------------------
-- 'listing:<id>' or 'trade:<id>' while the item is in escrow.
alter table public.player_items add column if not exists market_lock text;

create table if not exists public.market_listings (
  id          bigint generated always as identity primary key,
  seller      uuid not null references public.players (id) on delete cascade,
  item_id     bigint references public.player_items (id) on delete set null,
  sku         text not null,
  name        text not null,
  emoji       text,
  category    text not null,
  reference   bigint not null,
  price       bigint not null check (price > 0),
  fee         bigint not null default 0,
  status      text not null default 'open' check (status in ('open', 'sold', 'cancelled', 'expired', 'reversed')),
  buyer       uuid references public.players (id) on delete set null,
  -- What the seller's copy carried, for a reversal.
  prev_via    text,
  prev_hold   timestamptz,
  log_id      bigint,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  sold_at     timestamptz,
  closed_at   timestamptz
);
create unique index if not exists market_listings_item_open on public.market_listings (item_id) where status = 'open';
create index if not exists market_listings_open_idx on public.market_listings (status, created_at desc);
create index if not exists market_listings_seller_idx on public.market_listings (seller, created_at desc);
create index if not exists market_listings_buyer_idx on public.market_listings (buyer, sold_at desc);
alter table public.market_listings enable row level security;
revoke all on public.market_listings from anon, authenticated;

create table if not exists public.market_trades (
  id          bigint generated always as identity primary key,
  -- a made the offer; b received it. Set null when an account is deleted (the other side gets everything back).
  a           uuid references public.players (id) on delete set null,
  b           uuid references public.players (id) on delete set null,
  items_a     bigint[] not null,
  items_b     bigint[] not null,
  cash_a      bigint not null default 0 check (cash_a >= 0),
  cash_b      bigint not null default 0 check (cash_b >= 0),
  value_a     bigint not null default 0,
  value_b     bigint not null default 0,
  -- [{id, sku, name, emoji, category, reference, side, via, hold}] as both players see it.
  snapshot    jsonb not null default '[]',
  version     int not null default 1,
  a_ok        boolean not null default false,
  b_ok        boolean not null default false,
  -- C$ in escrow per side, and the version it was taken at (its ledger ref).
  held_a      bigint not null default 0,
  held_b      bigint not null default 0,
  held_va     int,
  held_vb     int,
  fee_a       bigint not null default 0,
  fee_b       bigint not null default 0,
  status      text not null default 'open' check (status in ('open', 'done', 'declined', 'cancelled', 'expired', 'reversed')),
  log_a       bigint,
  log_b       bigint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  settled_at  timestamptz
);
create index if not exists market_trades_a_idx on public.market_trades (a, status);
create index if not exists market_trades_b_idx on public.market_trades (b, status);
alter table public.market_trades enable row level security;
revoke all on public.market_trades from anon, authenticated;

create table if not exists public.market_reversals (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('sale', 'trade')),
  ref_id     bigint not null,
  admin_id   uuid,
  reason     text not null check (char_length(reason) <= 300),
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);
alter table public.market_reversals enable row level security;
revoke all on public.market_reversals from anon, authenticated;

-- Devices a player has played on (the trade hold). device: 'ua:<md5>' of the session's user agent, or 'session:<id>'.
create table if not exists public.economy_devices (
  player_id  uuid not null references public.players (id) on delete cascade,
  device     text not null,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (player_id, device)
);
alter table public.economy_devices enable row level security;
revoke all on public.economy_devices from anon, authenticated;

create table if not exists public.underworld_hires (
  id          bigint generated always as identity primary key,
  poster      uuid references public.players (id) on delete set null,
  runner      uuid references public.players (id) on delete set null,
  job         text not null,
  title       text not null,
  emoji       text,
  cut         bigint not null check (cut > 0),
  fee         bigint not null default 0,
  status      text not null default 'offered' check (status in ('offered', 'done', 'declined', 'expired')),
  outcome     text,
  pay         bigint not null default 0,
  ny_date     date not null,
  log_id      bigint,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  settled_at  timestamptz
);
create index if not exists underworld_hires_poster_idx on public.underworld_hires (poster, created_at desc);
create index if not exists underworld_hires_runner_idx on public.underworld_hires (runner, status);
alter table public.underworld_hires enable row level security;
revoke all on public.underworld_hires from anon, authenticated;

-- Every admin action so far (0151's list) plus the marketplace reversal.
alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in ('ban', 'unban', 'creator_rate', 'creator_length', 'creator_status', 'creator_attribution', 'couture_name',
                    'plaza_remove', 'economy_freeze', 'economy_unfreeze', 'market_reverse'));

-- ---------------------------------------------------------------------------
-- Helpers (internal)
-- ---------------------------------------------------------------------------
create or replace function public.market_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select coalesce(public.game_settings_value('marketplace'), '{}'::jsonb) $$;

/** An item's reference value: its Shop price today (what it was bought for when the Shop no longer lists it). */
create or replace function public.market_ref(p_item bigint) returns bigint
language sql stable security definer set search_path = public
as $$
  select coalesce(nullif((public.shop_item(i.sku) ->> 'price')::bigint, 0), i.value) from public.player_items i where i.id = p_item
$$;

/** The Shop's name and emoji for a sku. */
create or replace function public.market_item_info(p_sku text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'name', coalesce((select c.name from public.shop_catalog c where c.sku = p_sku), public.shop_item(p_sku) ->> 'name', p_sku),
    'emoji', coalesce((select c.emoji from public.shop_catalog c where c.sku = p_sku), public.shop_item(p_sku) ->> 'emoji', '🛍️'))
$$;

/** Can this item go on the market: tradable by the core's rules and not a couples-only piece. */
create or replace function public.market_item_ok(p_item bigint) returns boolean
language sql stable security definer set search_path = public
as $$
  select public.economy_item_tradable(p_item)
     and not exists (select 1 from public.player_items i join public.shop_catalog c on c.sku = i.sku
                      where i.id = p_item and coalesce(c.extra ->> 'couplesOnly', 'false') = 'true')
$$;

/** Notes the device behind the current request's Supabase session (never raises). */
create or replace function public.economy_device_seen(p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  claims jsonb;
  sid text;
  ua text;
  dev text;
begin
  if p_player is null then return; end if;
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then claims := null;
  end;
  sid := claims ->> 'session_id';
  if sid is null then return; end if;
  if to_regclass('"auth"."sessions"') is not null then
    begin
      execute 'select user_agent from auth.sessions where id::text = $1' into ua using sid;
    exception when others then ua := null;
    end;
  end if;
  -- Version numbers stripped: a browser update isn't a new device.
  dev := case when nullif(trim(coalesce(ua, '')), '') is not null
              then 'ua:' || md5(regexp_replace(lower(ua), '[0-9._]+', '', 'g')) else 'session:' || sid end;
  insert into public.economy_devices (player_id, device) values (p_player, dev)
  on conflict (player_id, device) do update set last_seen = now();
exception when others then
  return;
end;
$$;

create or replace function public.economy_devices_on_ping() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.economy_device_seen(new.player_id);
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists player_sessions_economy_devices on public.player_sessions;
create trigger player_sessions_economy_devices after insert or update on public.player_sessions
  for each row execute function public.economy_devices_on_ping();

/** When a player's trade hold ends (null when there is none): a new device or an email change in the last hold.hours. */
create or replace function public.market_hold_until(p_player uuid) returns timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  hold interval := make_interval(hours => coalesce((public.market_settings() -> 'hold' ->> 'hours')::int, 72));
  v timestamptz;
  e timestamptz;
begin
  -- A device first seen lately, on an account that had played on another one before.
  select max(d.first_seen) + hold into v from public.economy_devices d
   where d.player_id = p_player and d.first_seen > now() - hold
     and exists (select 1 from public.economy_devices o where o.player_id = p_player and o.first_seen < d.first_seen - interval '1 minute');
  -- An email change (Supabase Auth keeps when it was asked for).
  if exists (select 1 from pg_attribute where attrelid = to_regclass('"auth"."users"') and attname = 'email_change_sent_at' and not attisdropped) then
    begin
      execute 'select email_change_sent_at from auth.users where id = $1' into e using p_player;
    exception when others then e := null;
    end;
    if e is not null and e > now() - hold then v := greatest(coalesce(v, e + hold), e + hold); end if;
  end if;
  return case when v > now() then v end;
end;
$$;

/** Raises 'trade_hold' (or 'their_trade_hold' for the other side) with the end of the hold as the hint. */
create or replace function public.market_check_hold(p_player uuid, p_theirs boolean default false) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v timestamptz;
begin
  if not p_theirs then perform public.economy_device_seen(p_player); end if;
  v := public.market_hold_until(p_player);
  if v is not null then
    raise exception '%', case when p_theirs then 'their_trade_hold' else 'trade_hold' end using errcode = '22023', hint = v::text;
  end if;
end;
$$;

/** economy_can for the other side of a deal: their reasons, named as theirs. */
create or replace function public.market_can_theirs(p_player uuid, p_kind text, p_amount bigint, p_direction text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.economy_can(p_player, p_kind, p_amount, p_direction);
exception when others then
  if sqlerrm = 'weekly_limit' then raise exception 'their_weekly_limit' using errcode = '22023'; end if;
  if sqlerrm in ('too_new', 'economy_locked', 'economy_frozen', 'no_player') then raise exception 'they_cant_trade' using errcode = '22023'; end if;
  raise;
end;
$$;

/** How many of one sku a player got on the market this New York week (bought or swapped for). */
create or replace function public.market_sku_bought(p_player uuid, p_sku text) returns int
language sql stable security definer set search_path = public
as $$
  select (select count(*) from public.market_listings l
           where l.buyer = p_player and l.sku = p_sku and l.status = 'sold' and l.sold_at >= public.ny_week()::timestamp at time zone 'America/New_York')::int
       + (select count(*) from public.market_trades t cross join lateral jsonb_array_elements(t.snapshot) x
           where t.status = 'done' and t.settled_at >= public.ny_week()::timestamp at time zone 'America/New_York'
             and x ->> 'sku' = p_sku
             and ((t.a = p_player and x ->> 'side' = 'b') or (t.b = p_player and x ->> 'side' = 'a')))::int
$$;

/** Is this lock still held by an open listing or swap? */
create or replace function public.market_lock_live(p_lock text) returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when p_lock like 'listing:%' then exists (select 1 from public.market_listings where id = substr(p_lock, 9)::bigint and status = 'open')
    when p_lock like 'trade:%' then exists (select 1 from public.market_trades where id = substr(p_lock, 7)::bigint and status = 'open')
    else false end
$$;

-- Locked items stay put: no selling to the game, no deleting, no wearing, no moving (except by the market itself, which
-- clears the lock as it moves the item). Account deletion (the player row already gone) and Start over (which hands
-- everything back first) go through.
create or replace function public.market_item_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.market_lock is not null and public.market_lock_live(old.market_lock)
       and exists (select 1 from public.players where id = old.player_id) then
      raise exception 'item_locked' using errcode = '22023';
    end if;
    return old;
  end if;
  if old.market_lock is not null and new.market_lock is not distinct from old.market_lock then
    if new.player_id <> old.player_id then raise exception 'item_locked' using errcode = '22023'; end if;
  end if;
  if new.market_lock is not null and new.equipped and not old.equipped then raise exception 'item_locked' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists player_items_market_guard on public.player_items;
create trigger player_items_market_guard before update or delete on public.player_items
  for each row execute function public.market_item_guard();

/** Gives back what a swap holds: unlocks both sides' items and returns held C$; both confirmations reset. */
create or replace function public.market_trade_release(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.market_trades;
begin
  select * into t from public.market_trades where id = p_id for update;
  if t.id is null then return; end if;
  update public.player_items set market_lock = null where market_lock = 'trade:' || t.id;
  if t.held_a > 0 and t.a is not null then
    if public.ledger_once(t.a, 'cash', t.held_a, 'market_sale', 'refund:trade:' || t.id || ':a:' || t.held_va) then
      update public.players set bank_cash = bank_cash + t.held_a where id = t.a;
    end if;
  end if;
  if t.held_b > 0 and t.b is not null then
    if public.ledger_once(t.b, 'cash', t.held_b, 'market_sale', 'refund:trade:' || t.id || ':b:' || t.held_vb) then
      update public.players set bank_cash = bank_cash + t.held_b where id = t.b;
    end if;
  end if;
  update public.market_trades set a_ok = false, b_ok = false, held_a = 0, held_b = 0, held_va = null, held_vb = null where id = p_id;
end;
$$;

/** Closes a listing that isn't sold (cancelled or expired) and unlocks its item. */
create or replace function public.market_listing_close(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.market_listings set status = p_status, closed_at = now() where id = p_id and status = 'open';
  if found then update public.player_items set market_lock = null where market_lock = 'listing:' || p_id; end if;
end;
$$;

/** Hands back an unanswered underworld hire: the cut to the poster, and today's offer back into their hand. */
create or replace function public.underworld_hire_close(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  h public.underworld_hires;
begin
  update public.underworld_hires set status = p_status, settled_at = now() where id = p_id and status = 'offered' returning * into h;
  if h.id is null then return; end if;
  if h.poster is not null then
    if public.ledger_once(h.poster, 'cash', h.cut, 'job_refund', 'hire:' || h.id) then
      update public.players set bank_cash = bank_cash + h.cut where id = h.poster;
    end if;
    if h.ny_date = public.ny_today() then
      update public.underworld
         set state = jsonb_set(state, '{offers,done}',
                       coalesce((select jsonb_agg(x) from jsonb_array_elements(state -> 'offers' -> 'done') x where x <> to_jsonb(h.job)), '[]'::jsonb)),
             version = version + 1, updated_at = now()
       where player_id = h.poster and state -> 'offers' ->> 'day' = h.ny_date::text and (state -> 'offers' -> 'done') ? h.job;
    end if;
  end if;
end;
$$;

/** What has run out for this player: swaps and hires after their hours, listings after their days, stale locks; and, while
 *  the marketplace is switched off, everything still open. */
create or replace function public.market_settle_due(p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  off boolean := not public.economy_phase_on('sale');
  r record;
begin
  if p_player is null then return; end if;
  for r in select id, a, b from public.market_trades
            where status = 'open' and (a = p_player or b = p_player or a is null or b is null)
              and (off or expires_at < now() or a is null or b is null)
  loop
    perform public.market_trade_release(r.id);
    update public.market_trades set status = case when off or r.a is null or r.b is null then 'cancelled' else 'expired' end,
           settled_at = now() where id = r.id;
  end loop;
  for r in select l.id, (l.item_id is null or not exists (select 1 from public.player_items i where i.id = l.item_id and i.player_id = l.seller)) as gone,
                  l.expires_at < now() as old
             from public.market_listings l
            where l.status = 'open' and l.seller = p_player
  loop
    if off or r.gone then perform public.market_listing_close(r.id, 'cancelled');
    elsif r.old then perform public.market_listing_close(r.id, 'expired');
    end if;
  end loop;
  for r in select id from public.underworld_hires where status = 'offered' and p_player in (poster, runner) and (expires_at < now() or off)
  loop
    perform public.underworld_hire_close(r.id, 'expired');
  end loop;
  update public.player_items set market_lock = null
   where player_id = p_player and market_lock is not null and not public.market_lock_live(market_lock);
end;
$$;

/** Checks a swap's contents and describes them. Raises with the reason; returns {valueA, valueB, items}. */
create or replace function public.market_trade_contents(p_a uuid, p_b uuid, p_items_a bigint[], p_items_b bigint[],
  p_cash_a bigint, p_cash_b bigint, p_trade bigint default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s jsonb := public.market_settings() -> 'swap';
  maxn int := coalesce((s ->> 'maxItems')::int, 4);
  share numeric := coalesce((s ->> 'cashMaxShare')::numeric, 0.5);
  na int := coalesce(array_length(p_items_a, 1), 0);
  nb int := coalesce(array_length(p_items_b, 1), 0);
  va bigint := 0;
  vb bigint := 0;
  ta bigint;
  tb bigint;
  items jsonb := '[]'::jsonb;
  it public.player_items;
  side text;
  owner uuid;
  x bigint;
  info jsonb;
  ref bigint;
  bd jsonb;
begin
  if na < 1 or nb < 1 then raise exception 'no_items' using errcode = '22023'; end if;
  if na > maxn or nb > maxn then raise exception 'too_many_items' using errcode = '22023'; end if;
  if coalesce(p_cash_a, 0) < 0 or coalesce(p_cash_b, 0) < 0 then raise exception 'bad_cash' using errcode = '22023'; end if;
  if (select count(distinct v) from unnest(p_items_a || p_items_b) v) <> na + nb then raise exception 'bad_items' using errcode = '22023'; end if;
  foreach side in array array['a', 'b'] loop
    owner := case when side = 'a' then p_a else p_b end;
    foreach x in array case when side = 'a' then p_items_a else p_items_b end loop
      select * into it from public.player_items where id = x;
      if it.id is null or it.player_id is distinct from owner then raise exception 'bad_items' using errcode = '22023'; end if;
      if not public.market_item_ok(x) then
        raise exception '%', case when side = 'a' then 'not_tradable' else 'their_not_tradable' end using errcode = '22023';
      end if;
      if it.equipped then raise exception '%', case when side = 'a' then 'item_worn' else 'their_item_worn' end using errcode = '22023'; end if;
      if it.market_lock is not null and it.market_lock is distinct from ('trade:' || p_trade) and public.market_lock_live(it.market_lock) then
        raise exception '%', case when side = 'a' then 'item_locked' else 'their_item_locked' end using errcode = '22023';
      end if;
      ref := public.market_ref(x);
      info := public.market_item_info(it.sku);
      if side = 'a' then va := va + ref; else vb := vb + ref; end if;
      items := items || jsonb_build_object('id', it.id, 'sku', it.sku, 'name', info ->> 'name', 'emoji', info ->> 'emoji',
                                           'category', it.category, 'reference', ref, 'side', side);
    end loop;
  end loop;
  -- The same sku on both sides would be a swap of nothing.
  if exists (select 1 from jsonb_array_elements(items) p, jsonb_array_elements(items) q
              where p ->> 'side' = 'a' and q ->> 'side' = 'b' and p ->> 'sku' = q ->> 'sku') then
    raise exception 'same_item' using errcode = '22023';
  end if;
  -- C$ only tops a side up: at most cashMaxShare of that side's total.
  if coalesce(p_cash_a, 0) * (1 - share) > va * share or coalesce(p_cash_b, 0) * (1 - share) > vb * share then
    raise exception 'too_much_cash' using errcode = '22023';
  end if;
  ta := va + coalesce(p_cash_a, 0);
  tb := vb + coalesce(p_cash_b, 0);
  bd := public.economy_band(ta);
  if tb < (bd ->> 'min')::bigint or tb > (bd ->> 'max')::bigint then raise exception 'unbalanced' using errcode = '22023'; end if;
  bd := public.economy_band(tb);
  if ta < (bd ->> 'min')::bigint or ta > (bd ->> 'max')::bigint then raise exception 'unbalanced' using errcode = '22023'; end if;
  return jsonb_build_object('valueA', va, 'valueB', vb, 'items', items);
end;
$$;

/** One side confirms: its items are locked and its C$ held (escrow). */
create or replace function public.market_trade_lock(p_id bigint, p_side text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.market_trades;
  who uuid;
  ids bigint[];
  cash bigint;
  n int;
begin
  select * into t from public.market_trades where id = p_id for update;
  who := case when p_side = 'a' then t.a else t.b end;
  ids := case when p_side = 'a' then t.items_a else t.items_b end;
  cash := case when p_side = 'a' then t.cash_a else t.cash_b end;
  if (p_side = 'a' and t.a_ok) or (p_side = 'b' and t.b_ok) then return; end if;
  if exists (select 1 from public.player_items i where i.id = any(ids)
              and (i.player_id is distinct from who or i.equipped or not public.market_item_ok(i.id)
                   or (i.market_lock is not null and i.market_lock <> 'trade:' || p_id and public.market_lock_live(i.market_lock)))) then
    raise exception 'item_changed' using errcode = '22023';
  end if;
  update public.player_items set market_lock = 'trade:' || p_id where id = any(ids) and player_id = who;
  get diagnostics n = row_count;
  if n <> coalesce(array_length(ids, 1), 0) then raise exception 'item_changed' using errcode = '22023'; end if;
  if cash > 0 then
    perform public.economy_hold(who, cash, 'market_hold', 'trade:' || p_id || ':' || p_side || ':' || t.version);
  end if;
  if p_side = 'a' then
    update public.market_trades set a_ok = true, held_a = cash, held_va = t.version where id = p_id;
  else
    update public.market_trades set b_ok = true, held_b = cash, held_vb = t.version where id = p_id;
  end if;
end;
$$;

/** Both confirmed: everything moves at once (items, C$ minus the fee, the notes), or nothing does. */
create or replace function public.market_trade_settle(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.market_trades;
  noresale int := coalesce((public.economy_settings() ->> 'noResaleDays')::int, 14);
  limit_n int := coalesce((public.market_settings() ->> 'perSkuWeek')::int, 2);
  ta bigint;
  tb bigint;
  fa bigint;
  fb bigint;
  la bigint;
  lb bigint;
  label_a text;
  label_b text;
  x jsonb;
  who uuid;
  snap jsonb;
begin
  select * into t from public.market_trades where id = p_id for update;
  if t.status <> 'open' or not (t.a_ok and t.b_ok) then return; end if;
  if t.a is null or t.b is null then raise exception 'trade_gone' using errcode = '22023'; end if;
  perform 1 from public.players where id in (t.a, t.b) order by id for update;
  ta := t.value_a + t.cash_a;
  tb := t.value_b + t.cash_b;
  -- Both sides, again, at the moment it happens (the confirmer's own reasons were checked first).
  perform public.market_can_theirs(t.a, 'trade', ta, 'send');
  perform public.market_can_theirs(t.a, 'trade', tb, 'receive');
  perform public.market_can_theirs(t.b, 'trade', tb, 'send');
  perform public.market_can_theirs(t.b, 'trade', ta, 'receive');
  if exists (select 1 from jsonb_array_elements(t.snapshot) i join public.player_items o
              on o.sku = i ->> 'sku' and o.player_id = case when i ->> 'side' = 'a' then t.b else t.a end) then
    raise exception 'already_owned' using errcode = '22023';
  end if;
  for x in select v from jsonb_array_elements(t.snapshot) v loop
    who := case when x ->> 'side' = 'a' then t.b else t.a end;
    if public.market_sku_bought(who, x ->> 'sku') >= limit_n then raise exception 'sku_limit' using errcode = '22023'; end if;
    if (select clout from public.players where id = who) < coalesce((public.shop_item(x ->> 'sku') ->> 'cloutReq')::int, 0) then
      raise exception 'need_clout' using errcode = '22023';
    end if;
  end loop;
  -- Lopsided at the band's edge: flagged for review.
  perform public.economy_band_check(array[t.a, t.b], ta, tb, 'trade:' || t.id);
  perform public.economy_band_check(array[t.a, t.b], tb, ta, 'trade:' || t.id);
  -- Keep what each piece carried, for a reversal.
  select coalesce(jsonb_agg(v || jsonb_build_object('via', i.received_via, 'hold', i.no_resale_until)), '[]'::jsonb) into snap
    from jsonb_array_elements(t.snapshot) v join public.player_items i on i.id = (v ->> 'id')::bigint;
  update public.player_items i
     set player_id = case when i.player_id = t.a then t.b else t.a end, market_lock = null, equipped = false,
         received_via = 'trade', no_resale_until = now() + make_interval(days => noresale)
   where i.market_lock = 'trade:' || t.id and i.id = any(t.items_a || t.items_b);
  fa := public.economy_fee('trade', t.held_a);
  fb := public.economy_fee('trade', t.held_b);
  if t.held_a > 0 then perform public.economy_pay(t.b, t.held_a, fa, 'market_sale', 'trade:' || t.id || ':a'); end if;
  if t.held_b > 0 then perform public.economy_pay(t.a, t.held_b, fb, 'market_sale', 'trade:' || t.id || ':b'); end if;
  select string_agg(v ->> 'name', ', ') into label_a from jsonb_array_elements(t.snapshot) v where v ->> 'side' = 'a';
  select string_agg(v ->> 'name', ', ') into label_b from jsonb_array_elements(t.snapshot) v where v ->> 'side' = 'b';
  la := public.economy_note('trade', 'trade:' || t.id || ':a', t.a, t.b, ta, fa,
          label_a || case when t.held_a > 0 then ' + C$' || t.held_a else '' end, false,
          jsonb_build_object('trade', t.id, 'cash', t.held_a, 'items', t.items_a));
  lb := public.economy_note('trade', 'trade:' || t.id || ':b', t.b, t.a, tb, fb,
          label_b || case when t.held_b > 0 then ' + C$' || t.held_b else '' end, false,
          jsonb_build_object('trade', t.id, 'cash', t.held_b, 'items', t.items_b));
  update public.market_trades set status = 'done', settled_at = now(), fee_a = fa, fee_b = fb, log_a = la, log_b = lb, snapshot = snap
   where id = t.id;
  for x in select v from jsonb_array_elements(t.snapshot) v loop
    who := case when x ->> 'side' = 'a' then t.b else t.a end;
    if public.market_sku_bought(who, x ->> 'sku') >= limit_n then
      perform public.economy_flag('sku_limit', array[who], 'sku:' || who || ':' || (x ->> 'sku') || ':' || public.ny_week(),
                                  jsonb_build_object('bought', public.market_sku_bought(who, x ->> 'sku')));
    end if;
  end loop;
  begin
    perform public.push_enqueue(t.a, 'trade_done', 'trade_done:' || t.id, '🔁 Swap done',
      'Your ' || lower(label_a) || ' went, and the ' || lower(label_b) || ' is yours.', '/home?open=market', null, true, 'market');
    perform public.push_enqueue(t.b, 'trade_done', 'trade_done:' || t.id, '🔁 Swap done',
      'Your ' || lower(label_b) || ' went, and the ' || lower(label_a) || ' is yours.', '/home?open=market', null, true, 'market');
  exception when others then null;
  end;
end;
$$;

/** One swap as a player sees it: you and them, never anyone's bank. */
create or replace function public.market_trade_view(t public.market_trades, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id, 'version', t.version, 'status', t.status, 'mine', case when t.a = p_viewer then 'a' else 'b' end,
    'createdAt', t.created_at, 'updatedAt', t.updated_at, 'expiresAt', t.expires_at, 'settledAt', t.settled_at,
    'with', o.id, 'withName', coalesce(o.display_name, 'a former player'), 'withStyle', o.starting_style,
    'you', jsonb_build_object(
      'items', coalesce((select jsonb_agg(v - 'via' - 'hold') from jsonb_array_elements(t.snapshot) v where v ->> 'side' = case when t.a = p_viewer then 'a' else 'b' end), '[]'::jsonb),
      'cash', case when t.a = p_viewer then t.cash_a else t.cash_b end,
      'value', case when t.a = p_viewer then t.value_a + t.cash_a else t.value_b + t.cash_b end,
      'ok', case when t.a = p_viewer then t.a_ok else t.b_ok end),
    'them', jsonb_build_object(
      'items', coalesce((select jsonb_agg(v - 'via' - 'hold') from jsonb_array_elements(t.snapshot) v where v ->> 'side' = case when t.a = p_viewer then 'b' else 'a' end), '[]'::jsonb),
      'cash', case when t.a = p_viewer then t.cash_b else t.cash_a end,
      'value', case when t.a = p_viewer then t.value_b + t.cash_b else t.value_a + t.cash_a end,
      'ok', case when t.a = p_viewer then t.b_ok else t.a_ok end),
    'big', greatest(t.value_a + t.cash_a, t.value_b + t.cash_b) > coalesce((public.market_settings() ->> 'bigTrade')::bigint, 2500))
    from (select 1) one left join public.players o on o.id = case when t.a = p_viewer then t.b else t.a end
$$;

-- Start over hands back the player's listings, swaps and hires before their things go.
create or replace function public.market_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  for r in select id from public.market_listings where seller = new.player_id and status = 'open' loop
    perform public.market_listing_close(r.id, 'cancelled');
  end loop;
  for r in select id from public.market_trades where status = 'open' and new.player_id in (a, b) loop
    perform public.market_trade_release(r.id);
    update public.market_trades set status = 'cancelled', settled_at = now() where id = r.id;
  end loop;
  for r in select id from public.underworld_hires where status = 'offered' and new.player_id in (poster, runner) loop
    perform public.underworld_hire_close(r.id, 'declined');
  end loop;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists player_restarts_market on public.player_restarts;
create trigger player_restarts_market after insert on public.player_restarts for each row execute function public.market_on_restart();

-- ---------------------------------------------------------------------------
-- The player's side
-- ---------------------------------------------------------------------------
/** The Market app: the phase, the hold, what friends (or the open board) list, my listings, my swaps and my things. */
create or replace function public.market_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.market_settings();
  me public.players;
  why text;
  unlocks timestamptz;
  on_ boolean := public.economy_phase_on('sale');
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.economy_device_seen(uid);
  perform public.market_settle_due(uid);
  why := public.economy_unlock(uid);
  unlocks := me.created_at + make_interval(days => coalesce((public.economy_settings() -> 'unlock' ->> 'minAccountDays')::int, 7));
  if not on_ then
    return jsonb_build_object('on', false, 'unlocked', why is null, 'reason', why, 'unlocksAt', unlocks, 'hold', null, 'open', me.economy_open,
      'browse', '[]'::jsonb, 'mine', '[]'::jsonb, 'trades', '[]'::jsonb, 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'on', true, 'unlocked', why is null, 'reason', why, 'unlocksAt', unlocks, 'hold', public.market_hold_until(uid), 'open', me.economy_open,
    'browse', coalesce((select jsonb_agg(x order by (x ->> 'friend')::boolean desc, x ->> 'createdAt' desc) from (
        select jsonb_build_object('id', l.id, 'sku', l.sku, 'name', l.name, 'emoji', l.emoji, 'category', l.category,
          'price', l.price, 'reference', l.reference, 'createdAt', l.created_at, 'expiresAt', l.expires_at,
          'seller', p.id, 'sellerName', p.display_name, 'sellerStyle', p.starting_style, 'friend', public.economy_friends(uid, p.id),
          'owned', exists (select 1 from public.player_items i where i.player_id = uid and i.sku = l.sku),
          'skuLeft', greatest(0, coalesce((s ->> 'perSkuWeek')::int, 2) - public.market_sku_bought(uid, l.sku))) x
          from public.market_listings l join public.players p on p.id = l.seller
         where l.status = 'open' and l.seller <> uid and p.banned_at is null and public.economy_visible(uid, l.seller)
         order by l.created_at desc limit 60) q), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'itemId', l.item_id, 'sku', l.sku, 'name', l.name, 'emoji', l.emoji,
          'price', l.price, 'reference', l.reference, 'fee', case when l.status = 'sold' then l.fee else public.economy_fee('sale', l.price) end,
          'status', l.status, 'createdAt', l.created_at, 'expiresAt', l.expires_at, 'soldAt', l.sold_at,
          'buyerName', b.display_name) order by l.created_at desc)
        from public.market_listings l left join public.players b on b.id = l.buyer
       where l.seller = uid and (l.status = 'open' or coalesce(l.sold_at, l.closed_at) > now() - interval '3 days')), '[]'::jsonb),
    'trades', coalesce((select jsonb_agg(public.market_trade_view(t, uid) order by t.status = 'open' desc, t.updated_at desc)
        from public.market_trades t
       where uid in (t.a, t.b) and (t.status = 'open' or t.settled_at > now() - interval '2 days')), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'sku', i.sku, 'name', inf ->> 'name', 'emoji', inf ->> 'emoji',
          'category', i.category, 'reference', ref, 'min', (public.economy_band(ref) ->> 'min')::bigint, 'max', (public.economy_band(ref) ->> 'max')::bigint,
          'ok', public.market_item_ok(i.id), 'worn', i.equipped, 'locked', i.market_lock, 'holdUntil', i.no_resale_until,
          'acquired', i.acquired) order by i.category, inf ->> 'name')
        from public.player_items i cross join lateral (select public.market_item_info(i.sku) inf, public.market_ref(i.id) ref) z
       where i.player_id = uid and (public.economy_settings() -> 'gifts' -> 'categories') ? i.category), '[]'::jsonb));
end;
$$;

/** Another player's things you could ask for in a swap (only if you can see their offers at all). */
create or replace function public.market_closet(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.economy_can(uid, 'trade', 0, 'send');
  if p_player = uid or not public.economy_visible(uid, p_player) then raise exception 'not_visible' using errcode = '22023'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'sku', i.sku, 'name', inf ->> 'name', 'emoji', inf ->> 'emoji',
           'category', i.category, 'reference', public.market_ref(i.id)) order by i.category, inf ->> 'name')
      from public.player_items i cross join lateral (select public.market_item_info(i.sku) inf) z
     where i.player_id = p_player and not i.equipped and public.market_item_ok(i.id)
       and (i.market_lock is null or not public.market_lock_live(i.market_lock))), '[]'::jsonb);
end;
$$;

/** Who you can swap with: your Crew, partner and chats (and, on the open board, sellers you see in Browse). */
create or replace function public.market_people() returns jsonb
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
      'canTrade', public.economy_unlock(p.id) is null) order by coalesce(p.id = partner, false) desc, p.display_name)
    from public.players p
   where p.id <> uid and p.banned_at is null and p.home_id is not null
     and (p.id in (select id from public.crew_of(uid)) or p.id = partner
          or p.id in (select case when c.a = uid then c.b else c.a end from public.conversations c where uid in (c.a, c.b)))
     and public.economy_friends(uid, p.id)), '[]'::jsonb);
end;
$$;

create or replace function public.market_list(p_item bigint, p_price bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.market_settings();
  it public.player_items;
  ref bigint;
  bd jsonb;
  info jsonb;
  v_id bigint;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'sale', 0, 'send');
  perform public.market_check_hold(uid);
  perform public.market_settle_due(uid);
  select * into it from public.player_items where id = p_item and player_id = uid for update;
  if it.id is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if it.market_lock is not null and public.market_lock_live(it.market_lock) then raise exception 'item_locked' using errcode = '22023'; end if;
  if it.no_resale_until is not null and it.no_resale_until > now() then raise exception 'no_resale' using errcode = '22023', hint = it.no_resale_until::text; end if;
  if not public.market_item_ok(it.id) then raise exception 'not_tradable' using errcode = '22023'; end if;
  if it.equipped then raise exception 'item_worn' using errcode = '22023'; end if;
  if (select count(*) from public.market_listings where seller = uid and status = 'open') >= coalesce((s -> 'listing' ->> 'maxOpen')::int, 8) then
    raise exception 'listing_limit' using errcode = '22023';
  end if;
  ref := public.market_ref(it.id);
  bd := public.economy_band(ref);
  if p_price is null or p_price < (bd ->> 'min')::bigint or p_price > (bd ->> 'max')::bigint then
    raise exception 'out_of_band' using errcode = '22023';
  end if;
  info := public.market_item_info(it.sku);
  insert into public.market_listings (seller, item_id, sku, name, emoji, category, reference, price, expires_at)
  values (uid, it.id, it.sku, info ->> 'name', info ->> 'emoji', it.category, ref, p_price,
          now() + make_interval(days => coalesce((s -> 'listing' ->> 'days')::int, 14)))
  returning id into v_id;
  update public.player_items set market_lock = 'listing:' || v_id where id = it.id;
  return jsonb_build_object('id', v_id, 'fee', public.economy_fee('sale', p_price));
end;
$$;

create or replace function public.market_cancel(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'sale', 0, 'send');
  if not exists (select 1 from public.market_listings where id = p_id and seller = uid and status = 'open') then
    raise exception 'listing_gone' using errcode = '22023';
  end if;
  perform public.market_listing_close(p_id, 'cancelled');
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end;
$$;

create or replace function public.market_buy(p_id bigint, p_sure boolean default false) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.market_settings();
  noresale int := coalesce((public.economy_settings() ->> 'noResaleDays')::int, 14);
  l public.market_listings;
  it public.player_items;
  me public.players;
  v_fee bigint;
  v_log bigint;
  n int;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'sale', 0, 'send');
  perform public.market_settle_due(uid);
  select * into l from public.market_listings where id = p_id for update;
  if l.id is null or l.status <> 'open' then raise exception 'listing_gone' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'sale', l.price, 'send');
  perform public.market_check_hold(uid);
  if l.seller = uid then raise exception 'own_listing' using errcode = '22023'; end if;
  if public.is_blocked_pair(uid, l.seller) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.economy_visible(uid, l.seller) then raise exception 'not_visible' using errcode = '22023'; end if;
  select * into it from public.player_items where id = l.item_id for update;
  if it.id is null or it.player_id <> l.seller or it.market_lock is distinct from 'listing:' || l.id then
    perform public.market_listing_close(l.id, 'cancelled');
    raise exception 'listing_gone' using errcode = '22023';
  end if;
  if l.price > coalesce((s ->> 'bigTrade')::bigint, 2500) and not coalesce(p_sure, false) then
    raise exception 'confirm_big' using errcode = '22023';
  end if;
  if exists (select 1 from public.player_items where player_id = uid and sku = l.sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  perform 1 from public.players where id in (uid, l.seller) order by id for update;
  select * into me from public.players where id = uid;
  if me.clout < coalesce((public.shop_item(l.sku) ->> 'cloutReq')::int, 0) then raise exception 'need_clout' using errcode = '22023'; end if;
  if public.market_sku_bought(uid, l.sku) >= coalesce((s ->> 'perSkuWeek')::int, 2) then raise exception 'sku_limit' using errcode = '22023'; end if;
  if me.bank_cash < l.price then raise exception 'cant_afford' using errcode = '22023'; end if;
  perform public.market_can_theirs(l.seller, 'sale', l.price, 'receive');
  perform public.market_check_hold(l.seller, true);
  -- Refuses a price the Shop has since moved out of the band; flags one at its edge.
  perform public.economy_band_check(array[l.seller, uid], public.market_ref(it.id), l.price, 'sale:' || l.id);
  perform public.economy_hold(uid, l.price, 'market_hold', 'sale:' || l.id);
  v_fee := public.economy_fee('sale', l.price);
  perform public.economy_pay(l.seller, l.price, v_fee, 'market_sale', 'sale:' || l.id);
  update public.player_items
     set player_id = uid, market_lock = null, equipped = false, received_via = 'sale', no_resale_until = now() + make_interval(days => noresale)
   where id = it.id;
  v_log := public.economy_note('sale', 'sale:' || l.id, uid, l.seller, l.price, v_fee, l.name, true,
                               jsonb_build_object('sku', l.sku, 'reference', l.reference, 'item', it.id));
  update public.market_listings
     set status = 'sold', buyer = uid, sold_at = now(), fee = v_fee, log_id = v_log, prev_via = it.received_via, prev_hold = it.no_resale_until
   where id = l.id;
  n := public.market_sku_bought(uid, l.sku);
  if n >= coalesce((s ->> 'perSkuWeek')::int, 2) then
    perform public.economy_flag('sku_limit', array[uid], 'sku:' || uid || ':' || l.sku || ':' || public.ny_week(), jsonb_build_object('bought', n));
  end if;
  begin
    perform public.push_enqueue(l.seller, 'market_sold', 'market_sold:' || l.id, '🏷️ Sold: ' || l.name,
      '@' || me.display_name || ' bought it. C$' || to_char(l.price - v_fee, 'FM999,999,999') || ' is in your bank after the city fee.',
      '/home?open=market', null, false, 'market');
  exception when others then null;
  end;
  return jsonb_build_object('id', l.id, 'cash', -l.price, 'item', it.id);
end;
$$;

/** Opens the trade window: my items (+ C$) for theirs (+ C$). Sending it confirms my side. Returns the swap. */
create or replace function public.trade_offer(p_to uuid, p_mine bigint[], p_theirs bigint[], p_cash_mine bigint default 0,
  p_cash_theirs bigint default 0) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.market_settings();
  c jsonb;
  t public.market_trades;
  me public.players;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'trade', 0, 'send');
  perform public.market_check_hold(uid);
  perform public.market_settle_due(uid);
  if p_to = uid then raise exception 'own_trade' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = p_to and home_id is not null and banned_at is null) then raise exception 'unknown_player' using errcode = '22023'; end if;
  if not public.economy_visible(uid, p_to) then raise exception 'not_visible' using errcode = '22023'; end if;
  perform public.market_can_theirs(p_to, 'trade', 0, 'receive');
  perform public.market_check_hold(p_to, true);
  if exists (select 1 from public.market_trades where status = 'open' and ((a = uid and b = p_to) or (a = p_to and b = uid))) then
    raise exception 'trade_open' using errcode = '22023';
  end if;
  c := public.market_trade_contents(uid, p_to, p_mine, p_theirs, coalesce(p_cash_mine, 0), coalesce(p_cash_theirs, 0));
  perform public.economy_can(uid, 'trade', (c ->> 'valueA')::bigint + coalesce(p_cash_mine, 0), 'send');
  perform public.economy_can(uid, 'trade', (c ->> 'valueB')::bigint + coalesce(p_cash_theirs, 0), 'receive');
  insert into public.market_trades (a, b, items_a, items_b, cash_a, cash_b, value_a, value_b, snapshot, expires_at)
  values (uid, p_to, p_mine, p_theirs, coalesce(p_cash_mine, 0), coalesce(p_cash_theirs, 0), (c ->> 'valueA')::bigint, (c ->> 'valueB')::bigint,
          c -> 'items', now() + make_interval(hours => coalesce((s -> 'swap' ->> 'hours')::int, 24)))
  returning * into t;
  perform public.market_trade_lock(t.id, 'a');
  select * into me from public.players where id = uid;
  begin
    perform public.push_enqueue(p_to, 'trade_offer', 'trade_offer:' || t.id || ':' || t.version, '🔁 @' || me.display_name || ' wants to swap',
      'Open the trade window: same items, same C$, side by side. Nothing moves until you both confirm.', '/home?open=market', t.expires_at, true, 'market');
  exception when others then null;
  end;
  select * into t from public.market_trades where id = t.id;
  return public.market_trade_view(t, uid);
end;
$$;

/** Changes a swap (either side). Both confirmations reset and everything held goes back. */
create or replace function public.trade_edit(p_id bigint, p_version int, p_mine bigint[], p_theirs bigint[], p_cash_mine bigint default 0,
  p_cash_theirs bigint default 0) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.market_settings();
  t public.market_trades;
  c jsonb;
  ia bigint[];
  ib bigint[];
  ca bigint;
  cb bigint;
  other uuid;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'trade', 0, 'send');
  perform public.market_check_hold(uid);
  perform public.market_settle_due(uid);
  select * into t from public.market_trades where id = p_id for update;
  if t.id is null or uid not in (t.a, t.b) or t.status <> 'open' then raise exception 'trade_gone' using errcode = '22023'; end if;
  if t.version <> p_version then raise exception 'trade_changed' using errcode = '22023'; end if;
  if uid = t.a then ia := p_mine; ib := p_theirs; ca := coalesce(p_cash_mine, 0); cb := coalesce(p_cash_theirs, 0); other := t.b;
  else ia := p_theirs; ib := p_mine; ca := coalesce(p_cash_theirs, 0); cb := coalesce(p_cash_mine, 0); other := t.a; end if;
  perform public.market_trade_release(t.id);
  c := public.market_trade_contents(t.a, t.b, ia, ib, ca, cb, t.id);
  update public.market_trades
     set items_a = ia, items_b = ib, cash_a = ca, cash_b = cb, value_a = (c ->> 'valueA')::bigint, value_b = (c ->> 'valueB')::bigint,
         snapshot = c -> 'items', version = version + 1, a_ok = false, b_ok = false, updated_at = now(),
         expires_at = now() + make_interval(hours => coalesce((s -> 'swap' ->> 'hours')::int, 24))
   where id = t.id
  returning * into t;
  begin
    perform public.push_enqueue(other, 'trade_offer', 'trade_offer:' || t.id || ':' || t.version, '🔁 A swap changed',
      '@' || (select display_name from public.players where id = uid) || ' changed the trade window. Take another look before you confirm.',
      '/home?open=market', t.expires_at, true, 'market');
  exception when others then null;
  end;
  return public.market_trade_view(t, uid);
end;
$$;

/** Confirms the swap exactly as shown (p_version). Over bigTrade: p_sure, the second "Are you sure?". The second confirmation
 *  settles it. */
create or replace function public.trade_confirm(p_id bigint, p_version int, p_sure boolean default false) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.market_trades;
  side text;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'trade', 0, 'send');
  perform public.market_check_hold(uid);
  perform public.market_settle_due(uid);
  select * into t from public.market_trades where id = p_id for update;
  if t.id is null or uid not in (t.a, t.b) or t.status <> 'open' then raise exception 'trade_gone' using errcode = '22023'; end if;
  if t.version <> p_version then raise exception 'trade_changed' using errcode = '22023'; end if;
  side := case when uid = t.a then 'a' else 'b' end;
  if greatest(t.value_a + t.cash_a, t.value_b + t.cash_b) > coalesce((public.market_settings() ->> 'bigTrade')::bigint, 2500)
     and not coalesce(p_sure, false) then
    raise exception 'confirm_big' using errcode = '22023';
  end if;
  perform public.economy_can(uid, 'trade', case when side = 'a' then t.value_a + t.cash_a else t.value_b + t.cash_b end, 'send');
  perform public.economy_can(uid, 'trade', case when side = 'a' then t.value_b + t.cash_b else t.value_a + t.cash_a end, 'receive');
  perform public.market_check_hold(case when side = 'a' then t.b else t.a end, true);
  perform public.market_trade_lock(t.id, side);
  perform public.market_trade_settle(t.id);
  select * into t from public.market_trades where id = p_id;
  return public.market_trade_view(t, uid);
end;
$$;

/** Walks away from a swap (either side, any time before it's done): everything held goes back. */
create or replace function public.trade_cancel(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.market_trades;
begin
  if not public.rate_hit(uid, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'trade', 0, 'send');
  select * into t from public.market_trades where id = p_id for update;
  if t.id is null or uid not in (t.a, t.b) or t.status <> 'open' then raise exception 'trade_gone' using errcode = '22023'; end if;
  perform public.market_trade_release(t.id);
  update public.market_trades set status = case when uid = t.a then 'cancelled' else 'declined' end, settled_at = now() where id = t.id
  returning * into t;
  return public.market_trade_view(t, uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Underworld jobs between players (service role: app/home/underworldActions.ts runs the engine)
-- ---------------------------------------------------------------------------
/** Friends Pablo has also invited (an underworld row), who can be hired as a runner. */
create or replace function public.underworld_runners(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style,
           'canTake', public.economy_unlock_receive(p.id) is null) order by p.display_name), '[]'::jsonb)
    from public.players p join public.underworld u on u.player_id = p.id
   where p.id <> p_player and p.banned_at is null and public.economy_friends(p_player, p.id)
$$;

create or replace function public.underworld_hire_post(p_poster uuid, p_runner uuid, p_job text, p_title text, p_emoji text, p_cut bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  h jsonb := public.market_settings() -> 'hire';
  st jsonb;
  v_id bigint;
  me public.players;
begin
  if not public.rate_hit(p_poster, 'economy', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.market_settle_due(p_poster);
  perform public.economy_can(p_poster, 'trade', p_cut, 'send');
  perform public.market_check_hold(p_poster);
  if p_cut is null or not ((h -> 'cuts') @> to_jsonb(p_cut)) then raise exception 'bad_cut' using errcode = '22023'; end if;
  if p_runner = p_poster then raise exception 'own_hire' using errcode = '22023'; end if;
  if not public.economy_friends(p_poster, p_runner) then raise exception 'not_friends' using errcode = '22023'; end if;
  if not exists (select 1 from public.underworld where player_id = p_runner) then raise exception 'runner_not_in' using errcode = '22023'; end if;
  perform public.market_can_theirs(p_runner, 'trade', p_cut, 'receive');
  select state into st from public.underworld where player_id = p_poster for update;
  if st is null or st -> 'offers' ->> 'day' <> public.ny_today()::text or not ((st -> 'offers' -> 'ids') ? p_job)
     or coalesce((st -> 'offers' -> 'done') ? p_job, false) then
    raise exception 'no_offer' using errcode = '22023';
  end if;
  if (select count(*) from public.underworld_hires where poster = p_poster and ny_date = public.ny_today() and status in ('offered', 'done'))
     >= coalesce((h ->> 'perDay')::int, 1) then
    raise exception 'hire_limit' using errcode = '22023';
  end if;
  select * into me from public.players where id = p_poster for update;
  if me.bank_cash < p_cut then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.underworld_hires (poster, runner, job, title, emoji, cut, fee, ny_date, expires_at)
  values (p_poster, p_runner, p_job, left(coalesce(p_title, p_job), 120), left(p_emoji, 8), p_cut, public.economy_fee('job', p_cut),
          public.ny_today(), now() + make_interval(hours => coalesce((h ->> 'hours')::int, 24)))
  returning id into v_id;
  perform public.economy_hold(p_poster, p_cut, 'job_hold', 'hire:' || v_id);
  -- Handed over: the poster can't do this one themselves today.
  update public.underworld
     set state = jsonb_set(state, '{offers,done}', coalesce(state -> 'offers' -> 'done', '[]'::jsonb) || to_jsonb(p_job)),
         version = version + 1, updated_at = now()
   where player_id = p_poster;
  begin
    perform public.push_enqueue(p_runner, 'runner_hired', 'runner_hired:' || v_id, '🧳 @' || me.display_name || ' needs a runner',
      'A job from Pablo''s back room, C$' || to_char(p_cut, 'FM999,999') || ' for your trouble. It''s yours for a day.',
      '/home?open=backroom', now() + interval '24 hours', true, 'underworld');
  exception when others then null;
  end;
  return jsonb_build_object('id', v_id, 'cash', -p_cut);
end;
$$;

create or replace function public.underworld_hire_list(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.market_settle_due(p_player);
  return jsonb_build_object(
    'sent', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'job', h.job, 'title', h.title, 'emoji', h.emoji, 'cut', h.cut, 'fee', h.fee,
        'status', h.status, 'outcome', h.outcome, 'pay', h.pay, 'day', h.ny_date, 'createdAt', h.created_at, 'expiresAt', h.expires_at,
        'with', p.id, 'withName', coalesce(p.display_name, 'a former player'), 'withStyle', p.starting_style) order by h.created_at desc)
      from public.underworld_hires h left join public.players p on p.id = h.runner
     where h.poster = p_player and (h.status = 'offered' or h.settled_at > now() - interval '2 days')), '[]'::jsonb),
    'received', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'job', h.job, 'title', h.title, 'emoji', h.emoji, 'cut', h.cut, 'fee', h.fee,
        'status', h.status, 'outcome', h.outcome, 'pay', h.pay, 'day', h.ny_date, 'createdAt', h.created_at, 'expiresAt', h.expires_at,
        'with', p.id, 'withName', coalesce(p.display_name, 'a former player'), 'withStyle', p.starting_style) order by h.created_at desc)
      from public.underworld_hires h left join public.players p on p.id = h.poster
     where h.runner = p_player and (h.status = 'offered' or h.settled_at > now() - interval '2 days')), '[]'::jsonb));
end;
$$;

/** The hire a runner is about to run (null when it isn't theirs or isn't waiting any more). */
create or replace function public.underworld_hire_get(p_runner uuid, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  h public.underworld_hires;
begin
  perform public.market_settle_due(p_runner);
  select * into h from public.underworld_hires where id = p_id and runner = p_runner and status = 'offered';
  if h.id is null then return null; end if;
  perform public.economy_can(p_runner, 'trade', h.cut, 'receive');
  return jsonb_build_object('id', h.id, 'job', h.job, 'title', h.title, 'cut', h.cut, 'poster', h.poster,
    'posterName', (select display_name from public.players where id = h.poster));
end;
$$;

create or replace function public.underworld_hire_decline(p_runner uuid, p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.underworld_hires where id = p_id and runner = p_runner and status = 'offered') then
    raise exception 'hire_gone' using errcode = '22023';
  end if;
  perform public.underworld_hire_close(p_id, 'declined');
end;
$$;

/** The runner did it (whatever happened): the cut minus the fee to them, Pablo's take to the poster, Heat for the poster too.
 *  Once per hire. If the hire went back meanwhile, the runner keeps Pablo's take instead. */
create or replace function public.underworld_hire_settle(p_id bigint, p_runner uuid, p_outcome text, p_pay bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  h public.underworld_hires;
  v_heat int := coalesce((public.market_settings() -> 'hire' ->> 'posterHeat')::int, 5);
  v_pay bigint := least(greatest(coalesce(p_pay, 0), 0), 2500);
  v_log bigint;
  runner_name text;
  line text;
begin
  if p_outcome not in ('win', 'trace', 'fizzle', 'bust') then raise exception 'bad_outcome' using errcode = '22023'; end if;
  select * into h from public.underworld_hires where id = p_id and runner = p_runner for update;
  if h.id is null then raise exception 'hire_gone' using errcode = '22023'; end if;
  if h.status = 'done' then return jsonb_build_object('status', 'done', 'cut', h.cut - h.fee); end if;
  if h.status <> 'offered' or h.poster is null then
    if v_pay > 0 and public.ledger_once(p_runner, 'cash', v_pay, 'underworld_pay', 'hire:' || h.id) then
      update public.players set bank_cash = bank_cash + v_pay where id = p_runner;
    end if;
    return jsonb_build_object('status', h.status, 'cut', 0, 'kept', v_pay);
  end if;
  perform 1 from public.players where id in (h.poster, p_runner) order by id for update;
  perform public.economy_pay(p_runner, h.cut, h.fee, 'job_pay', 'hire:' || h.id);
  v_log := public.economy_note('job', 'hire:' || h.id, h.poster, p_runner, h.cut, h.fee, 'Pablo: ' || h.title, true,
                               jsonb_build_object('jobKind', 'underworld', 'job', h.job, 'outcome', p_outcome));
  if v_pay > 0 and public.ledger_once(h.poster, 'cash', v_pay, 'underworld_pay', 'hire:' || h.id) then
    update public.players set bank_cash = bank_cash + v_pay where id = h.poster;
  end if;
  select display_name into runner_name from public.players where id = p_runner;
  line := '🧳 @' || coalesce(runner_name, 'your runner') || ' ran ' || lower(h.title) || ': '
          || case p_outcome when 'bust' then 'busted on the spot. Your name came up too.'
                            when 'fizzle' then 'it didn''t come off.'
                            else 'done' || case when v_pay > 0 then ', +C$' || v_pay || ' for you' else '' end || '.' end;
  update public.underworld
     set state = jsonb_set(jsonb_set(jsonb_set(state,
                   '{heat}', to_jsonb(least(100, greatest(0, coalesce((state ->> 'heat')::numeric, 0) + v_heat)))),
                   '{earned}', to_jsonb(coalesce((state ->> 'earned')::numeric, 0) + v_pay)),
                   '{receipts}', coalesce((select jsonb_agg(z.r order by z.n) from (select e.r, e.n from jsonb_array_elements(jsonb_build_array(line) || coalesce(state -> 'receipts', '[]'::jsonb)) with ordinality e(r, n) order by e.n limit 8) z), '[]'::jsonb)),
         version = version + 1, updated_at = now()
   where player_id = h.poster;
  update public.underworld_hires set status = 'done', outcome = p_outcome, pay = v_pay, settled_at = now(), log_id = v_log where id = h.id;
  begin
    perform public.push_enqueue(h.poster, 'runner_done', 'runner_done:' || h.id, '🧳 Your runner is back', line, '/home?open=backroom', null, true, 'underworld');
  exception when others then null;
  end;
  return jsonb_build_object('status', 'done', 'cut', h.cut - h.fee);
end;
$$;

-- ---------------------------------------------------------------------------
-- Studio: Recent trades and reversals
-- ---------------------------------------------------------------------------
create or replace function public.admin_market_recent() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  days int := coalesce((public.market_settings() ->> 'reversalDays')::int, 7);
  wk timestamptz := public.ny_week()::timestamp at time zone 'America/New_York';
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'reversalDays', days,
    'week', jsonb_build_object(
      'sales', (select count(*) from public.market_listings where status = 'sold' and sold_at >= wk),
      'trades', (select count(*) from public.market_trades where status = 'done' and settled_at >= wk),
      'listed', (select count(*) from public.market_listings where status = 'open'),
      'value', coalesce((select sum(price) from public.market_listings where status = 'sold' and sold_at >= wk), 0)
             + coalesce((select sum(value_a + cash_a + value_b + cash_b) from public.market_trades where status = 'done' and settled_at >= wk), 0),
      'fees', coalesce((select sum(fee) from public.market_listings where status = 'sold' and sold_at >= wk), 0)
            + coalesce((select sum(fee_a + fee_b) from public.market_trades where status = 'done' and settled_at >= wk), 0)),
    'recent', coalesce((select jsonb_agg(q.x order by q.at desc) from (
        select l.sold_at as at, jsonb_build_object('kind', 'sale', 'id', l.id, 'at', l.sold_at, 'status', case when l.status = 'reversed' then 'reversed' else 'done' end,
          'label', l.emoji || ' ' || l.name, 'value', l.price, 'reference', l.reference, 'fee', l.fee,
          'from', jsonb_build_object('id', s.id, 'name', coalesce(s.display_name, 'a former player')),
          'to', jsonb_build_object('id', b.id, 'name', coalesce(b.display_name, 'a former player')),
          'reversible', l.status = 'sold' and l.sold_at > now() - make_interval(days => days),
          'reversal', (select jsonb_build_object('reason', r.reason, 'at', r.created_at) from public.market_reversals r where r.kind = 'sale' and r.ref_id = l.id)) x
          from public.market_listings l left join public.players s on s.id = l.seller left join public.players b on b.id = l.buyer
         where l.status in ('sold', 'reversed') and l.sold_at > now() - interval '30 days'
        union all
        select t.settled_at as at, jsonb_build_object('kind', 'trade', 'id', t.id, 'at', t.settled_at, 'status', t.status,
          'label', coalesce((select string_agg((v ->> 'emoji') || ' ' || (v ->> 'name'), ', ') from jsonb_array_elements(t.snapshot) v where v ->> 'side' = 'a'), '')
                   || case when t.cash_a > 0 then ' + C$' || t.cash_a else '' end || ' ⇄ '
                   || coalesce((select string_agg((v ->> 'emoji') || ' ' || (v ->> 'name'), ', ') from jsonb_array_elements(t.snapshot) v where v ->> 'side' = 'b'), '')
                   || case when t.cash_b > 0 then ' + C$' || t.cash_b else '' end,
          'value', t.value_a + t.cash_a, 'reference', t.value_b + t.cash_b, 'fee', t.fee_a + t.fee_b,
          'from', jsonb_build_object('id', pa.id, 'name', coalesce(pa.display_name, 'a former player')),
          'to', jsonb_build_object('id', pb.id, 'name', coalesce(pb.display_name, 'a former player')),
          'reversible', t.status = 'done' and t.settled_at > now() - make_interval(days => days),
          'reversal', (select jsonb_build_object('reason', r.reason, 'at', r.created_at) from public.market_reversals r where r.kind = 'trade' and r.ref_id = t.id)) x
          from public.market_trades t left join public.players pa on pa.id = t.a left join public.players pb on pb.id = t.b
         where t.status in ('done', 'reversed') and t.settled_at > now() - interval '30 days'
        order by 1 desc limit 60) q), '[]'::jsonb));
end;
$$;

/** Puts one piece back with its old owner (internal to the reversal). Returns false when it can't (gone, or they own one again). */
create or replace function public.market_item_back(p_item bigint, p_from uuid, p_to uuid, p_via text, p_hold timestamptz) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  it public.player_items;
begin
  select * into it from public.player_items where id = p_item and player_id = p_from for update;
  if it.id is null or p_to is null or exists (select 1 from public.player_items where player_id = p_to and sku = it.sku) then return false; end if;
  update public.player_items set player_id = p_to, market_lock = null, equipped = false, received_via = p_via, no_resale_until = p_hold where id = it.id;
  return true;
end;
$$;

/** Takes back C$ for a reversal (never below zero); returns what it couldn't. */
create or replace function public.market_take_back(p_player uuid, p_amount bigint, p_ref text) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  got bigint;
begin
  if p_player is null or p_amount <= 0 then return greatest(p_amount, 0); end if;
  select least(bank_cash, p_amount) into got from public.players where id = p_player for update;
  got := coalesce(got, 0);
  if got > 0 and public.ledger_once(p_player, 'cash', -got, 'market_sale', p_ref) then
    update public.players set bank_cash = bank_cash - got where id = p_player;
  end if;
  return p_amount - got;
end;
$$;

/** Gives C$ back for a reversal. */
create or replace function public.market_give_back(p_player uuid, p_amount bigint, p_ref text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_player is null or p_amount <= 0 then return; end if;
  if public.ledger_once(p_player, 'cash', p_amount, 'market_sale', p_ref) then
    update public.players set bank_cash = bank_cash + p_amount where id = p_player;
  end if;
end;
$$;

/** A Studio admin undoes a sale or a swap after a reported theft or exploit, within reversalDays: the items go back (their Shop
 *  value in C$ when an item is gone), the C$ goes back (never below zero; the shortfall is recorded), the notes are released. */
create or replace function public.admin_market_reverse(p_kind text, p_id bigint, p_reason text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  days int := coalesce((public.market_settings() ->> 'reversalDays')::int, 7);
  l public.market_listings;
  t public.market_trades;
  x jsonb;
  short bigint := 0;
  missing jsonb := '[]'::jsonb;
  owner uuid;
  taker uuid;
begin
  perform public.require_story_admin();
  if reason is null or char_length(reason) < 3 then raise exception 'reason_needed' using errcode = '22023'; end if;
  if p_kind = 'sale' then
    select * into l from public.market_listings where id = p_id for update;
    if l.id is null or l.status <> 'sold' or l.sold_at < now() - make_interval(days => days) then raise exception 'cant_reverse' using errcode = '22023'; end if;
    perform 1 from public.players where id in (l.seller, l.buyer) order by id for update;
    if not public.market_item_back(l.item_id, l.buyer, l.seller, l.prev_via, l.prev_hold) then
      missing := missing || jsonb_build_object('sku', l.sku, 'name', l.name, 'value', l.reference);
      perform public.market_give_back(l.seller, l.reference, 'reversal:sale:' || l.id || ':item');
    end if;
    perform public.market_give_back(l.buyer, l.price, 'reversal:sale:' || l.id);
    short := public.market_take_back(l.seller, l.price - l.fee, 'reversal:sale:' || l.id);
    if l.log_id is not null then perform public.economy_release(l.log_id); end if;
    update public.market_listings set status = 'reversed', closed_at = now() where id = l.id;
    owner := l.seller;
  elsif p_kind = 'trade' then
    select * into t from public.market_trades where id = p_id for update;
    if t.id is null or t.status <> 'done' or t.settled_at < now() - make_interval(days => days) then raise exception 'cant_reverse' using errcode = '22023'; end if;
    perform 1 from public.players where id in (t.a, t.b) order by id for update;
    for x in select v from jsonb_array_elements(t.snapshot) v loop
      owner := case when x ->> 'side' = 'a' then t.a else t.b end;
      taker := case when x ->> 'side' = 'a' then t.b else t.a end;
      if not public.market_item_back((x ->> 'id')::bigint, taker, owner, x ->> 'via', (x ->> 'hold')::timestamptz) then
        missing := missing || jsonb_build_object('sku', x ->> 'sku', 'name', x ->> 'name', 'value', (x ->> 'reference')::bigint);
        perform public.market_give_back(owner, (x ->> 'reference')::bigint, 'reversal:trade:' || t.id || ':item:' || (x ->> 'id'));
      end if;
    end loop;
    -- A's C$ went to B (minus the fee), B's to A.
    if t.cash_a > 0 then
      perform public.market_give_back(t.a, t.cash_a, 'reversal:trade:' || t.id || ':a');
      short := short + public.market_take_back(t.b, t.cash_a - t.fee_a, 'reversal:trade:' || t.id || ':a');
    end if;
    if t.cash_b > 0 then
      perform public.market_give_back(t.b, t.cash_b, 'reversal:trade:' || t.id || ':b');
      short := short + public.market_take_back(t.a, t.cash_b - t.fee_b, 'reversal:trade:' || t.id || ':b');
    end if;
    if t.log_a is not null then perform public.economy_release(t.log_a); end if;
    if t.log_b is not null then perform public.economy_release(t.log_b); end if;
    update public.market_trades set status = 'reversed' where id = t.id;
    owner := t.a;
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  insert into public.market_reversals (kind, ref_id, admin_id, reason, detail)
  values (p_kind, p_id, auth.uid(), reason, jsonb_build_object('short', short, 'missing', missing));
  insert into public.admin_actions (admin_id, player_id, action, reason)
  values (auth.uid(), owner, 'market_reverse', left(p_kind || ' #' || p_id || ': ' || reason, 300));
  return public.admin_market_recent() || jsonb_build_object('last', jsonb_build_object('short', short, 'missing', missing));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.market_settings()', 'public.market_ref(bigint)', 'public.market_item_info(text)', 'public.market_item_ok(bigint)',
    'public.economy_device_seen(uuid)', 'public.economy_devices_on_ping()', 'public.market_hold_until(uuid)',
    'public.market_check_hold(uuid, boolean)', 'public.market_can_theirs(uuid, text, bigint, text)', 'public.market_sku_bought(uuid, text)',
    'public.market_lock_live(text)', 'public.market_item_guard()', 'public.market_trade_release(bigint)',
    'public.market_listing_close(bigint, text)', 'public.underworld_hire_close(bigint, text)', 'public.market_settle_due(uuid)',
    'public.market_trade_contents(uuid, uuid, bigint[], bigint[], bigint, bigint, bigint)', 'public.market_trade_lock(bigint, text)',
    'public.market_trade_settle(bigint)', 'public.market_trade_view(public.market_trades, uuid)', 'public.market_on_restart()',
    'public.underworld_runners(uuid)', 'public.underworld_hire_post(uuid, uuid, text, text, text, bigint)', 'public.underworld_hire_list(uuid)',
    'public.underworld_hire_get(uuid, bigint)', 'public.underworld_hire_decline(uuid, bigint)', 'public.underworld_hire_settle(bigint, uuid, text, bigint)',
    'public.market_item_back(bigint, uuid, uuid, text, timestamptz)', 'public.market_take_back(uuid, bigint, text)',
    'public.market_give_back(uuid, bigint, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.market_state()', 'public.market_closet(uuid)', 'public.market_people()', 'public.market_list(bigint, bigint)',
    'public.market_cancel(bigint)', 'public.market_buy(bigint, boolean)',
    'public.trade_offer(uuid, bigint[], bigint[], bigint, bigint)', 'public.trade_edit(bigint, integer, bigint[], bigint[], bigint, bigint)',
    'public.trade_confirm(bigint, integer, boolean)', 'public.trade_cancel(bigint)',
    'public.admin_market_recent()', 'public.admin_market_reverse(text, bigint, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
