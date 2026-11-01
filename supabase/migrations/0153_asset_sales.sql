-- 0153: the Player Economy, Phase 3: business and property sales (owner, Oct 31: "build the 3 phases"; docs/PLAYER-ECONOMY.md
-- sections 2, 6 and 7). A player sells a business or their house to a friend, through escrow and a cooling-off day.
-- Builds only on the core of migration 0151 (never on 0152, the marketplace).
--
--   * Settings: game_settings 'asset_sales' (mirrored by lib/assetSales.ts, tests/assetSales.test.ts): 2 sales a player per
--     30 days (as seller or buyer, counted from the buyer's yes), 14 days of ownership before resale, a 24-hour cooling-off,
--     offers lapse after 3 days, the Studio can reverse a sale for 7 days, buyers under 14 days old are flagged, and the
--     appraisal weights. Everything refuses with 'phase_off' while player_economy.phases.assets is off (it starts off);
--     cancelling a sale and its refund always work.
--   * What can be sold: a business (player_businesses) that hasn't gone public (a public company's shares aren't anyone's to
--     hand over a counter), and the player's C$ house (player_items, category 'houses': the Shop's houses; rentals can't be
--     sold, they're the landlord's). Never anything bought with real money (Clout Couture, 'collector'), never while the seller
--     lives with a partner (0149 cohabits) or is in a sublet (0119), never within 14 days of getting it.
--   * Appraisal (asset_appraisal, lib/assetSales.ts appraiseBusiness/appraiseHouse): a business is 60% its book value (price,
--     +50% per upgrade, without the owner's hype: fame stays with the owner), 20% what was put in (the game's price and
--     upgrades, or what the owner paid a player plus upgrades since) and 20% a week of its pay. A house is 70% its Shop price
--     and 30% what the owner paid, times its neighborhood. The price must sit in economy_band (50% to 150%); either edge is
--     flagged (economy_band_check, 'band_edge').
--   * The deal: asset_sale_offer (seller → a friend: economy_visible) → asset_sale_answer (the buyer: yes puts the price in
--     escrow, economy_hold 'asset_hold', and counts it in both weeks, economy_note('asset'); no just declines) → 24 real
--     hours of cooling-off where either side can cancel (asset_sale_cancel: 'asset_refund' and economy_release) → the
--     handover (asset_sale_settle, on read by asset_sales_state and by asset_sales_settle_all, run by the push sender): the
--     business with its level, upgrades and traces moves to the buyer (the seller's till is emptied to the seller first; a
--     business manager hired on the Jobs board works for the owner, so stays with the seller), or the house (no rent for the
--     buyer; the seller's rent starts again, like selling it to the Shop). The seller gets the price minus the 10% city fee
--     (economy_pay, ledger 'asset_sale' + 'economy_fee'). A sale that can't complete (the asset changed hands, went public, the
--     buyer can't take it) fails and refunds. Start over cancels every live sale (refunded).
--   * Rank fairness: the sale isn't counted as player cash in net worth (the asset was already counted); only what the seller
--     got over the appraisal is (economy_limits.uncounted), so an overpaying friend can't wire rank.
--   * Traces: a nullable player_businesses.traces (the hook for the underworld's fronts, which don't exist yet: nothing writes
--     it today). It moves with the business, and an offer copies it so the buyer is warned of "undisclosed issues" (never
--     the details) before saying yes.
--   * Abuse: band-edge sales ('band_edge') and accounts under newBuyerDays buying ('asset_new_buyer') go to the Studio's queue.
--     Studio → Economy → Asset sales: admin_asset_sales, admin_asset_reverse (within 7 days: the asset and the C$ go back,
--     economy_release, logged in admin_actions 'asset_reverse').
--   * History: economy_history shows the sale (kind 'asset') to both sides.
--   * Ledger refs: buy_business and upgrade_business add a suffix when their ref was used before (a business sold and
--     bought again from the game), so every C$ change keeps a ledger row.
-- Safe to run more than once.

do $$
begin
  if to_regprocedure('public.economy_note(text, text, uuid, uuid, bigint, bigint, text, boolean, jsonb)') is null then
    raise exception 'Run migration 0151_player_economy.sql first: 0153 builds on its core.';
  end if;
end $$;

insert into public.game_settings (key, value) values ('asset_sales', '{"perMonth":2,"minOwnDays":14,"coolingHours":24,"offerDays":3,"reverseDays":7,"newBuyerDays":14,"business":{"book":0.6,"paid":0.2,"revenue":0.2,"revenueDays":7},"house":{"list":0.7,"paid":0.3,"neighborhoods":{"Astoria":1,"Long Island City":1.1},"where":{"house-astoria-townhouse":"Astoria","house-hunters-point-duplex":"Long Island City","house-lic-penthouse":"Long Island City"}}}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Columns and tables
-- ---------------------------------------------------------------------------
-- What the owner paid another player for it, at which level (null: bought from the game), and its traces (the underworld hook).
alter table public.player_businesses add column if not exists acquired_price bigint;
alter table public.player_businesses add column if not exists acquired_level smallint;
alter table public.player_businesses add column if not exists traces jsonb;

create table if not exists public.asset_sales (
  id             bigint generated always as identity primary key,
  seller         uuid references public.players (id) on delete set null,
  buyer          uuid references public.players (id) on delete set null,
  kind           text not null check (kind in ('business', 'house')),
  -- The business id or the house's sku; item_id is the house's player_items row.
  asset          text not null,
  item_id        bigint,
  label          text not null,
  emoji          text,
  level          smallint not null default 0,
  appraisal      bigint not null check (appraisal > 0),
  price          bigint not null check (price > 0),
  fee            bigint not null default 0,
  -- Null: nothing known. Otherwise the buyer is warned of "undisclosed issues" (never shown the contents).
  traces         jsonb,
  status         text not null default 'offered'
                   check (status in ('offered', 'declined', 'expired', 'cooling', 'cancelled', 'failed', 'done', 'reversed')),
  reason         text,
  log_id         bigint,
  premium        bigint not null default 0,
  offered_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  accepted_at    timestamptz,
  cooling_until  timestamptz,
  settled_at     timestamptz,
  closed_by      uuid,
  reversed_at    timestamptz,
  reversed_by    uuid,
  reverse_reason text check (char_length(reverse_reason) <= 300),
  check (seller is distinct from buyer)
);
create unique index if not exists asset_sales_live on public.asset_sales (kind, asset, seller) where status in ('offered', 'cooling');
create index if not exists asset_sales_seller_idx on public.asset_sales (seller, offered_at desc);
create index if not exists asset_sales_buyer_idx on public.asset_sales (buyer, offered_at desc);
create index if not exists asset_sales_due_idx on public.asset_sales (status, cooling_until) where status in ('offered', 'cooling');
alter table public.asset_sales enable row level security;
revoke all on public.asset_sales from anon, authenticated;

-- admin_actions gains 'asset_reverse', keeping whatever later migrations added (the list is read, not retyped).
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
   where conname = 'admin_actions_action_check' and conrelid = 'public.admin_actions'::regclass;
  if def is not null and def not like '%asset_reverse%' and def like '%ARRAY[%' then
    alter table public.admin_actions drop constraint admin_actions_action_check;
    execute 'alter table public.admin_actions add constraint admin_actions_action_check '
            || replace(def, 'ARRAY[', 'ARRAY[''asset_reverse''::text, ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Internals
-- ---------------------------------------------------------------------------
create or replace function public.asset_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select coalesce(public.game_settings_value('asset_sales'), '{}'::jsonb) $$;

/** The underworld hook: what a buyer would inherit (null: nothing known). Only businesses carry traces. */
create or replace function public.asset_traces(p_kind text, p_id text, p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when p_kind = 'business'
              then (select b.traces from public.player_businesses b where b.player_id = p_player and b.business_id = p_id)
         end
$$;

/** The reference value of an asset its owner holds (null when they don't hold it). lib/assetSales.ts mirrors it. */
create or replace function public.asset_appraisal(p_kind text, p_id text, p_player uuid) returns bigint
language plpgsql stable security definer set search_path = public
as $$
declare
  s jsonb := public.asset_settings();
  e jsonb := public.city() -> 'economy' -> 'businesses';
  def jsonb;
  b public.player_businesses;
  it public.player_items;
  price numeric;
  up numeric;
  book numeric;
  paid numeric;
  rev numeric;
  list numeric;
  hood numeric;
begin
  if p_kind = 'business' then
    select * into b from public.player_businesses where player_id = p_player and business_id = p_id;
    def := public.business_def(p_id);
    if b.player_id is null or def is null then return null; end if;
    price := (def ->> 'price')::numeric;
    up := round(price * (e -> 'upgrade' ->> 'cost')::numeric);
    book := round(price * (1 + (e -> 'upgrade' ->> 'value')::numeric * b.level));
    paid := coalesce(b.acquired_price + greatest(0, b.level - coalesce(b.acquired_level, 0)) * up, price + b.level * up);
    rev := public.business_pay(p_id, b.level) * coalesce((s -> 'business' ->> 'revenueDays')::numeric, 7);
    return round(coalesce((s -> 'business' ->> 'book')::numeric, 0.6) * book
               + coalesce((s -> 'business' ->> 'paid')::numeric, 0.2) * paid
               + coalesce((s -> 'business' ->> 'revenue')::numeric, 0.2) * rev)::bigint;
  elsif p_kind = 'house' then
    select * into it from public.player_items where player_id = p_player and sku = p_id and category = 'houses';
    if it.id is null then return null; end if;
    list := coalesce((public.shop_item(p_id) ->> 'price')::numeric, it.value);
    paid := coalesce((select a.price from public.asset_sales a
                       where a.status = 'done' and a.buyer = p_player and a.kind = 'house' and a.item_id = it.id
                       order by a.settled_at desc limit 1), it.value);
    hood := coalesce((s -> 'house' -> 'neighborhoods' ->> (s -> 'house' -> 'where' ->> p_id))::numeric, 1);
    return round((coalesce((s -> 'house' ->> 'list')::numeric, 0.7) * list
                + coalesce((s -> 'house' ->> 'paid')::numeric, 0.3) * paid) * hood)::bigint;
  end if;
  return null;
end;
$$;

/** Sales that count toward the monthly limit: the player on either side, the buyer said yes in the last 30 days. */
create or replace function public.asset_sales_used(p_player uuid) returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.asset_sales
   where p_player in (seller, buyer) and accepted_at > now() - interval '30 days' and status <> 'failed'
$$;

/** When the owner got it (businesses on the game clock, like bought_at; houses on the real one). */
create or replace function public.asset_since(p_kind text, p_id text, p_player uuid) returns timestamptz
language sql stable security definer set search_path = public
as $$
  select case p_kind
    when 'business' then (select b.bought_at - (public.game_now() - now()) from public.player_businesses b
                           where b.player_id = p_player and b.business_id = p_id)
    when 'house' then (select i.created_at from public.player_items i where i.player_id = p_player and i.sku = p_id and i.category = 'houses')
  end
$$;

/**
 * Why the owner can't sell this asset now (null: they can). p_sale: the sale being checked (its own row doesn't count).
 * 'not_owned', 'went_public', 'real_money', 'too_soon', 'living_together', 'sublet_live', 'sale_live', 'sales_limit'.
 */
create or replace function public.asset_block(p_kind text, p_id text, p_player uuid, p_sale bigint default null) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  s jsonb := public.asset_settings();
  b public.player_businesses;
  it public.player_items;
  me public.players;
begin
  select * into me from public.players where id = p_player;
  if me.id is null then return 'not_owned'; end if;
  if p_kind = 'business' then
    select * into b from public.player_businesses where player_id = p_player and business_id = p_id;
    if b.player_id is null then return 'not_owned'; end if;
    if b.went_public then return 'went_public'; end if;
  elsif p_kind = 'house' then
    select * into it from public.player_items where player_id = p_player and sku = p_id and category = 'houses';
    if it.id is null or me.house_sku is distinct from p_id then return 'not_owned'; end if;
    if it.acquired <> 'bought' or coalesce((public.shop_item(p_id) ->> 'collector')::boolean, false) then return 'real_money'; end if;
    if (public.cohabit_live(p_player)).id is not null then return 'living_together'; end if;
    if (public.sublet_live(p_player)).id is not null then return 'sublet_live'; end if;
  else
    return 'not_owned';
  end if;
  if public.asset_since(p_kind, p_id, p_player) > now() - make_interval(days => coalesce((s ->> 'minOwnDays')::int, 14)) then
    return 'too_soon';
  end if;
  if exists (select 1 from public.asset_sales where kind = p_kind and asset = p_id and seller = p_player
                and status in ('offered', 'cooling') and id is distinct from p_sale) then
    return 'sale_live';
  end if;
  if public.asset_sales_used(p_player)
     + (select count(*) from public.asset_sales where seller = p_player and status = 'offered' and id is distinct from p_sale)
     >= coalesce((s ->> 'perMonth')::int, 2) then
    return 'sales_limit';
  end if;
  return null;
end;
$$;

/** Why this player can't take this asset (null: they can): 'they_own_it', 'business_locked' (the ladder), 'they_cant_move'. */
create or replace function public.asset_buyer_block(p_kind text, p_id text, p_buyer uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.players;
  pos int;
begin
  select * into me from public.players where id = p_buyer;
  if me.id is null or me.home_id is null or me.banned_at is not null then return 'unknown_player'; end if;
  if p_kind = 'business' then
    if exists (select 1 from public.player_businesses where player_id = p_buyer and business_id = p_id) then return 'they_own_it'; end if;
    -- Empires go in order (buy_business): every business before this one first.
    select n into pos from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') with ordinality l(x, n) where l.x ->> 'id' = p_id;
    if exists (select 1 from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') with ordinality l(x, n)
                where l.n < pos and not exists (select 1 from public.player_businesses b where b.player_id = p_buyer and b.business_id = l.x ->> 'id')) then
      return 'business_locked';
    end if;
  else
    if me.house_sku is not null or exists (select 1 from public.player_items where player_id = p_buyer and sku = p_id) then return 'they_own_it'; end if;
    if (public.cohabit_live(p_buyer)).id is not null or (public.sublet_live(p_buyer)).id is not null then return 'they_cant_move'; end if;
  end if;
  return null;
end;
$$;

/** One of the owner's assets as the sale sheet shows it: the appraisal, the band, the fee and why it can't be sold yet. */
create or replace function public.asset_view(p_kind text, p_id text, p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  s jsonb := public.asset_settings();
  v bigint := public.asset_appraisal(p_kind, p_id, p_player);
  def jsonb;
  item jsonb;
  lvl int := 0;
  since timestamptz := public.asset_since(p_kind, p_id, p_player);
begin
  if v is null then return null; end if;
  if p_kind = 'business' then
    def := public.business_def(p_id);
    select level into lvl from public.player_businesses where player_id = p_player and business_id = p_id;
  else
    item := public.shop_item(p_id);
  end if;
  return jsonb_build_object(
    'kind', p_kind, 'id', p_id,
    'label', coalesce(def ->> 'name', item ->> 'name', p_id), 'emoji', coalesce(def ->> 'emoji', item ->> 'emoji', case when p_kind = 'house' then '🏡' else '🏪' end),
    'level', lvl, 'appraisal', v, 'band', public.economy_band(v), 'feeRate', coalesce((public.economy_settings() -> 'fees' ->> 'asset')::numeric, 0.1),
    'block', public.asset_block(p_kind, p_id, p_player),
    'sellableFrom', since + make_interval(days => coalesce((s ->> 'minOwnDays')::int, 14)));
end;
$$;

/** A sale as either side sees it. Traces are never shown: only that there are some. */
create or replace function public.asset_sale_json(a public.asset_sales, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id, 'role', case when a.seller = p_viewer then 'seller' else 'buyer' end,
    'kind', a.kind, 'asset', a.asset, 'label', a.label, 'emoji', a.emoji, 'level', a.level,
    'appraisal', a.appraisal, 'price', a.price,
    'fee', case when a.fee > 0 then a.fee else public.economy_fee('asset', a.price) end,
    'status', a.status, 'reason', a.reason, 'issues', a.traces is not null,
    'offeredAt', a.offered_at, 'expiresAt', a.expires_at, 'acceptedAt', a.accepted_at, 'coolingUntil', a.cooling_until,
    'settledAt', a.settled_at, 'closedByMe', a.closed_by = p_viewer,
    'with', (select jsonb_build_object('id', o.id, 'name', o.display_name, 'style', o.starting_style)
               from public.players o where o.id = case when a.seller = p_viewer then a.buyer else a.seller end))
$$;

/** Ends a live sale without a handover: the escrow back to the buyer (if it was taken) and the weeks' counts released. */
create or replace function public.asset_sale_close(p_id bigint, p_status text, p_by uuid, p_reason text default null) returns public.asset_sales
language plpgsql security definer set search_path = public
as $$
declare
  a public.asset_sales;
  was text;
begin
  select * into a from public.asset_sales where id = p_id for update;
  if a.id is null or a.status not in ('offered', 'cooling') then return a; end if;
  was := a.status;
  if was = 'cooling' and a.buyer is not null then
    update public.players set bank_cash = bank_cash + a.price where id = a.buyer;
    perform public.ledger_once(a.buyer, 'cash', a.price, 'asset_refund', 'asset:' || a.id);
  end if;
  if a.log_id is not null then perform public.economy_release(a.log_id); end if;
  update public.asset_sales set status = p_status, reason = coalesce(p_reason, reason), closed_by = p_by,
         settled_at = case when p_status in ('cancelled', 'failed') then now() else settled_at end
   where id = p_id returning * into a;
  -- The other side hears about it (a lapse or a failure: both).
  begin
    if p_status in ('cancelled', 'failed', 'declined') then
      if a.seller is not null and a.seller is distinct from p_by then
        perform public.push_enqueue(a.seller, 'asset_cancelled', 'asset_cancelled:' || a.id || ':seller', '🏷️ The ' || lower(a.label) || ' deal is off',
          case when p_status = 'declined' then 'They passed. The ' || lower(a.label) || ' is still yours.'
               when p_status = 'failed' then 'The deal fell through at the last minute. Nothing changed hands.'
               else 'They backed out during the cooling-off. Nothing changed hands.' end, '/home?open=assets', null, false, 'asset');
      end if;
      if a.buyer is not null and a.buyer is distinct from p_by and was = 'cooling' then
        perform public.push_enqueue(a.buyer, 'asset_cancelled', 'asset_cancelled:' || a.id || ':buyer', '🏷️ The ' || lower(a.label) || ' deal is off',
          'Your C$' || to_char(a.price, 'FM999,999,999') || ' is back in the bank. The keys stay where they were.', '/home?open=assets', null, false, 'asset');
      end if;
    end if;
  exception when others then null;
  end;
  return a;
end;
$$;

/** The handover once the cooling-off is over (internal). Fails and refunds when the asset or the buyer changed. */
create or replace function public.asset_sale_settle(p_id bigint) returns text
language plpgsql security definer set search_path = public
as $$
declare
  a public.asset_sales;
  why text;
  net bigint;
  prem bigint;
  lg public.economy_log;
  v_every interval := (public.city() -> 'economy' -> 'bills' ->> 'every')::interval;
  s jsonb := public.asset_settings();
begin
  select * into a from public.asset_sales where id = p_id for update;
  if a.id is null or a.status <> 'cooling' or a.cooling_until > now() then return a.status; end if;
  -- Switched off in the Studio: keys wait (either side can still cancel).
  if not public.economy_phase_on('asset') then return 'waiting'; end if;
  if a.seller is null or a.buyer is null then
    perform public.asset_sale_close(a.id, 'failed', null, 'account_gone');
    return 'failed';
  end if;
  perform 1 from public.players where id in (a.seller, a.buyer) order by id for update;
  if exists (select 1 from public.players where id in (a.seller, a.buyer) and banned_at is not null) then why := 'banned'; end if;
  if why is null then
    why := public.asset_block(a.kind, a.asset, a.seller, a.id);
    -- The monthly count and the ownership period were checked when the buyer said yes.
    if why in ('sales_limit', 'too_soon') then why := null; end if;
  end if;
  if why is null and a.kind = 'house' and not exists (select 1 from public.player_items where id = a.item_id and player_id = a.seller) then why := 'not_owned'; end if;
  if why is null then why := public.asset_buyer_block(a.kind, a.asset, a.buyer); end if;
  if why is not null then
    perform public.asset_sale_close(a.id, 'failed', null, why);
    return 'failed';
  end if;
  if a.kind = 'business' then
    -- What's in the till was earned by the seller.
    perform public.business_collect_one(a.seller, a.asset);
    update public.player_businesses
       set player_id = a.buyer, bought_at = public.game_now(), collected_at = public.game_now(),
           acquired_price = a.price, acquired_level = level
     where player_id = a.seller and business_id = a.asset;
  else
    update public.player_items
       set player_id = a.buyer, received_via = 'asset', equipped = false, created_at = now(),
           no_resale_until = now() + make_interval(days => coalesce((s ->> 'minOwnDays')::int, 14))
     where id = a.item_id;
    update public.players set house_sku = null, next_rent_due = (public.ny_today() + v_every)::date where id = a.seller;
    update public.players set house_sku = a.asset, next_rent_due = null where id = a.buyer;
  end if;
  net := public.economy_pay(a.seller, a.price, a.fee, 'asset_sale', 'asset:' || a.id);
  -- Net worth: only what the seller got over the appraisal is player cash (it already counted the asset).
  prem := greatest(0, net - a.appraisal);
  if prem > 0 then
    select * into lg from public.economy_log where id = a.log_id;
    insert into public.economy_limits as l (player_id, week, uncounted)
    values (a.seller, coalesce(lg.week, public.ny_week()), prem)
    on conflict (player_id, week) do update set uncounted = l.uncounted + excluded.uncounted;
  end if;
  update public.asset_sales set status = 'done', settled_at = now(), premium = prem where id = a.id;
  begin
    perform public.push_enqueue(a.seller, 'asset_done', 'asset_done:' || a.id || ':seller', '🔑 Sold: ' || a.label,
      'Keys handed over. C$' || to_char(net, 'FM999,999,999') || ' landed in your bank after the city''s cut.', '/home?open=assets', null, false, 'asset');
    perform public.push_enqueue(a.buyer, 'asset_done', 'asset_done:' || a.id || ':buyer', '🔑 It''s yours: ' || a.label,
      'The cooling-off is over and the keys are in your hand. Try not to lose them.', '/home?open=assets', null, false, 'asset');
  exception when others then null;
  end;
  return 'done';
end;
$$;

/** Lapses old offers and hands over what's cooled off, for one player's sales (internal; run on read). */
create or replace function public.asset_sales_settle_due(p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  for r in select id, status from public.asset_sales
            where p_player in (seller, buyer)
              and ((status = 'offered' and expires_at < now()) or (status = 'cooling' and cooling_until <= now()))
  loop
    if r.status = 'offered' then perform public.asset_sale_close(r.id, 'expired', null, 'expired');
    else perform public.asset_sale_settle(r.id); end if;
  end loop;
end;
$$;

/** Every due sale in the city (the push sender runs it, like sublet_settle_all). Returns how many changed. */
create or replace function public.asset_sales_settle_all() returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in select id, status from public.asset_sales
            where (status = 'offered' and expires_at < now()) or (status = 'cooling' and cooling_until <= now())
            order by id limit 500
  loop
    begin
      if r.status = 'offered' then perform public.asset_sale_close(r.id, 'expired', null, 'expired');
      else perform public.asset_sale_settle(r.id); end if;
      n := n + 1;
    exception when others then null;
    end;
  end loop;
  return n;
end;
$$;

-- Start over (migration 0114): every live sale involving the player ends (the buyer's escrow back, like any cancel).
create or replace function public.asset_sales_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  for r in select id from public.asset_sales where new.player_id in (seller, buyer) and status in ('offered', 'cooling') loop
    perform public.asset_sale_close(r.id, 'cancelled', new.player_id, 'restart');
  end loop;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists player_restarts_asset_sales on public.player_restarts;
create trigger player_restarts_asset_sales after insert on public.player_restarts for each row execute function public.asset_sales_on_restart();

-- ---------------------------------------------------------------------------
-- The player's side
-- ---------------------------------------------------------------------------
/** The appraisal of one of your assets (the sale sheet). */
create or replace function public.asset_appraise(p_kind text, p_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v jsonb;
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.economy_phase_on('asset') then raise exception 'phase_off' using errcode = '22023'; end if;
  if p_kind not in ('business', 'house') then raise exception 'bad_kind' using errcode = '22023'; end if;
  v := public.asset_view(p_kind, p_id, uid);
  if v is null then raise exception 'not_owned' using errcode = '22023'; end if;
  return v;
end;
$$;

/** Who you can sell to: your Crew, your partner and people you've chatted with (both ways), and whether they can buy yet. */
create or replace function public.asset_buyers() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  partner uuid := public.couple_partner(uid);
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.economy_phase_on('asset') then raise exception 'phase_off' using errcode = '22023'; end if;
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

/** Offers an asset to one player at a price in the band. Nothing moves until they say yes. */
create or replace function public.asset_sale_offer(p_kind text, p_id text, p_buyer uuid, p_price bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.asset_settings();
  why text;
  v bigint;
  def jsonb;
  item jsonb;
  lvl int := 0;
  hid bigint;
  a public.asset_sales;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'assets', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_kind not in ('business', 'house') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if p_buyer is null or p_buyer = uid then raise exception 'own_sale' using errcode = '22023'; end if;
  if coalesce(p_price, 0) <= 0 then raise exception 'out_of_band' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'asset', p_price, 'receive');
  perform public.tick(uid);
  perform 1 from public.players where id in (uid, p_buyer) order by id for update;
  perform public.asset_sales_settle_due(uid);
  why := public.asset_block(p_kind, p_id, uid);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = p_buyer and home_id is not null and banned_at is null) then
    raise exception 'unknown_player' using errcode = '22023';
  end if;
  if not public.economy_visible(uid, p_buyer) then raise exception 'not_friends' using errcode = '22023'; end if;
  if public.economy_unlock(p_buyer) is not null then raise exception 'they_cant_buy' using errcode = '22023'; end if;
  why := public.asset_buyer_block(p_kind, p_id, p_buyer);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  v := public.asset_appraisal(p_kind, p_id, uid);
  if p_kind = 'business' then
    def := public.business_def(p_id);
    select level into lvl from public.player_businesses where player_id = uid and business_id = p_id;
  else
    item := public.shop_item(p_id);
    select id into hid from public.player_items where player_id = uid and sku = p_id;
  end if;
  insert into public.asset_sales (seller, buyer, kind, asset, item_id, label, emoji, level, appraisal, price, fee, traces, expires_at)
  values (uid, p_buyer, p_kind, p_id, hid, coalesce(def ->> 'name', item ->> 'name', p_id),
          coalesce(def ->> 'emoji', item ->> 'emoji', case when p_kind = 'house' then '🏡' else '🏪' end), lvl, v, p_price,
          public.economy_fee('asset', p_price), public.asset_traces(p_kind, p_id, uid),
          now() + make_interval(days => coalesce((s ->> 'offerDays')::int, 3)))
  returning * into a;
  -- Out of the band: refused (the insert goes with it); at either edge: flagged for the Studio.
  perform public.economy_band_check(array[uid, p_buyer], v, p_price, 'asset:' || a.id);
  begin
    perform public.push_enqueue(p_buyer, 'asset_offer', 'asset_offer:' || a.id, '🏷️ ' || public.push_name(uid) || ' wants to sell you something',
      'The ' || lower(a.label) || ', for C$' || to_char(p_price, 'FM999,999,999') || '. Take a look before it walks.', '/home?open=assets', null, true, 'asset');
  exception when others then null;
  end;
  return public.asset_sale_json(a, uid);
end;
$$;

/** The buyer's answer. Yes: the price goes to escrow and the 24-hour cooling-off starts. No: the offer is gone. */
create or replace function public.asset_sale_answer(p_id bigint, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.asset_settings();
  f jsonb := public.economy_settings() -> 'flags';
  a public.asset_sales;
  why text;
  v_log bigint;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'assets', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.asset_sales_settle_due(uid);
  select * into a from public.asset_sales where id = p_id and buyer = uid;
  if a.id is null or a.status <> 'offered' then raise exception 'sale_gone' using errcode = '22023'; end if;
  if not coalesce(p_accept, false) then
    a := public.asset_sale_close(a.id, 'declined', uid, 'declined');
    return public.asset_sale_json(a, uid);
  end if;
  perform public.economy_can(uid, 'asset', a.price, 'send');
  begin
    perform public.economy_can(a.seller, 'asset', a.price, 'receive');
  exception when others then
    if sqlerrm = 'weekly_limit' then raise exception 'their_weekly_limit' using errcode = '22023'; end if;
    if sqlerrm in ('too_new', 'economy_locked', 'economy_frozen', 'no_player') then raise exception 'seller_cant_sell' using errcode = '22023'; end if;
    raise;
  end;
  perform public.tick(uid);
  perform 1 from public.players where id in (uid, a.seller) order by id for update;
  select * into a from public.asset_sales where id = p_id for update;
  if a.status <> 'offered' then raise exception 'sale_gone' using errcode = '22023'; end if;
  why := public.asset_block(a.kind, a.asset, a.seller, a.id);
  if why is not null then
    -- The asset changed since the offer: the offer goes, the buyer hears why.
    if why in ('not_owned', 'went_public', 'living_together', 'sublet_live', 'real_money') then
      perform public.asset_sale_close(a.id, 'failed', null, why);
    end if;
    raise exception '%', case when why = 'sales_limit' then 'seller_limit' else 'sale_gone' end using errcode = '22023';
  end if;
  if public.asset_appraisal(a.kind, a.asset, a.seller) is distinct from a.appraisal then
    -- Upgraded (or otherwise changed) since the offer: the price was set for something else.
    perform public.asset_sale_close(a.id, 'failed', null, 'changed');
    raise exception 'sale_changed' using errcode = '22023';
  end if;
  if public.asset_sales_used(uid) >= coalesce((s ->> 'perMonth')::int, 2) then raise exception 'buy_limit' using errcode = '22023'; end if;
  why := public.asset_buyer_block(a.kind, a.asset, uid);
  if why is not null then raise exception '%', case when why = 'they_own_it' then 'you_own_it' when why = 'they_cant_move' then 'you_cant_move' else why end using errcode = '22023'; end if;
  perform public.economy_hold(uid, a.price, 'asset_hold', 'asset:' || a.id);
  v_log := public.economy_note('asset', 'asset:' || a.id, uid, a.seller, a.price, a.fee, a.label, false,
                               jsonb_build_object('assetKind', a.kind, 'asset', a.asset, 'appraisal', a.appraisal));
  -- New accounts buying a business or a house: worth a look.
  if (select created_at from public.players where id = uid) > now() - make_interval(days => coalesce((s ->> 'newBuyerDays')::int, coalesce((f ->> 'newAccountDays')::int, 14))) then
    perform public.economy_flag('asset_new_buyer', array[uid, a.seller], 'asset:' || a.id,
      jsonb_build_object('price', a.price, 'appraisal', a.appraisal));
  end if;
  update public.asset_sales set status = 'cooling', accepted_at = now(), log_id = v_log,
         cooling_until = now() + make_interval(hours => coalesce((s ->> 'coolingHours')::int, 24))
   where id = a.id returning * into a;
  begin
    perform public.push_enqueue(a.seller, 'asset_accepted', 'asset_accepted:' || a.id, '🏷️ ' || public.push_name(uid) || ' said yes',
      'The ' || lower(a.label) || ' deal is in cooling-off. Keys change hands in ' || coalesce((s ->> 'coolingHours')::int, 24) || ' hours unless someone blinks.',
      '/home?open=assets', null, true, 'asset');
  exception when others then null;
  end;
  return public.asset_sale_json(a, uid);
end;
$$;

/** Calls it off: the seller withdraws an offer, or either side backs out during the cooling-off (the escrow comes back). */
create or replace function public.asset_sale_cancel(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.asset_sales;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'assets', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform public.asset_sales_settle_due(uid);
  select * into a from public.asset_sales where id = p_id and uid in (seller, buyer);
  if a.id is null or a.status not in ('offered', 'cooling') then raise exception 'sale_gone' using errcode = '22023'; end if;
  if a.status = 'offered' and a.buyer = uid then
    a := public.asset_sale_close(a.id, 'declined', uid, 'declined');
  else
    a := public.asset_sale_close(a.id, 'cancelled', uid, 'cancelled');
  end if;
  return public.asset_sale_json(a, uid);
end;
$$;

/** Your sellable assets, your live deals and the last few days' results. Settles what's due first. */
create or replace function public.asset_sales_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.asset_settings();
  me public.players;
  on_ boolean := public.economy_phase_on('asset');
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.asset_sales_settle_due(uid);
  -- Switched off: closed, unless a deal is still live (it can be cancelled, or waits for the switch).
  if not on_ and not exists (select 1 from public.asset_sales where uid in (seller, buyer) and status in ('offered', 'cooling')) then
    raise exception 'phase_off' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'on', on_,
    'now', now(),
    'assets', case when not on_ then '[]'::jsonb else coalesce((select jsonb_agg(v order by v ->> 'kind', v ->> 'label') from (
        select public.asset_view('business', b.business_id, uid) v from public.player_businesses b where b.player_id = uid
        union all
        select public.asset_view('house', i.sku, uid) from public.player_items i where i.player_id = uid and i.category = 'houses' and i.sku = me.house_sku
      ) x where v is not null), '[]'::jsonb) end,
    'sales', coalesce((select jsonb_agg(public.asset_sale_json(a, uid) order by a.offered_at desc)
      from public.asset_sales a
     where uid in (a.seller, a.buyer)
       and (a.status in ('offered', 'cooling') or coalesce(a.settled_at, a.offered_at) > now() - interval '3 days')), '[]'::jsonb),
    'used', public.asset_sales_used(uid),
    'perMonth', coalesce((s ->> 'perMonth')::int, 2),
    'room', jsonb_build_object('send', public.economy_room(uid, 'send'), 'receive', public.economy_room(uid, 'receive')),
    'unlock', public.economy_unlock(uid));
end;
$$;

-- ---------------------------------------------------------------------------
-- Studio: Economy → Asset sales
-- ---------------------------------------------------------------------------
create or replace function public.admin_asset_sales() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  rd int := coalesce((public.asset_settings() ->> 'reverseDays')::int, 7);
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'reverseDays', rd,
    'sales', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'asset', a.asset, 'label', a.label, 'emoji', a.emoji, 'level', a.level,
        'appraisal', a.appraisal, 'price', a.price, 'fee', a.fee, 'status', a.status, 'reason', a.reason,
        'traces', a.traces is not null, 'offeredAt', a.offered_at, 'acceptedAt', a.accepted_at, 'coolingUntil', a.cooling_until,
        'settledAt', a.settled_at, 'reversedAt', a.reversed_at, 'reverseReason', a.reverse_reason,
        'canReverse', a.status = 'done' and a.settled_at > now() - make_interval(days => rd),
        'seller', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'joined', p.created_at) from public.players p where p.id = a.seller),
        'buyer', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'joined', p.created_at) from public.players p where p.id = a.buyer),
        'flags', coalesce((select jsonb_agg(f.rule) from public.economy_flags f where f.ref = 'asset:' || a.id), '[]'::jsonb))
        order by a.offered_at desc)
      from (select * from public.asset_sales where offered_at > now() - interval '60 days' order by offered_at desc limit 100) a), '[]'::jsonb));
end;
$$;

/** Undoes a finished sale within reverseDays: the asset back to the seller, the price back to the buyer, logged. */
create or replace function public.admin_asset_reverse(p_id bigint, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  a public.asset_sales;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  net bigint;
  take bigint;
  lg public.economy_log;
  v_every interval := (public.city() -> 'economy' -> 'bills' ->> 'every')::interval;
begin
  perform public.require_story_admin();
  select * into a from public.asset_sales where id = p_id for update;
  if a.id is null then raise exception 'unknown_sale' using errcode = '22023'; end if;
  if a.status <> 'done' or a.settled_at <= now() - make_interval(days => coalesce((public.asset_settings() ->> 'reverseDays')::int, 7)) then
    raise exception 'cant_reverse' using errcode = '22023';
  end if;
  if a.seller is null or a.buyer is null then raise exception 'cant_reverse' using errcode = '22023'; end if;
  perform 1 from public.players where id in (a.seller, a.buyer) order by id for update;
  -- The asset goes back as it is now (with any upgrades since), if the seller has room for it.
  if a.kind = 'business' then
    if not exists (select 1 from public.player_businesses where player_id = a.buyer and business_id = a.asset)
       or exists (select 1 from public.player_businesses where player_id = a.seller and business_id = a.asset) then
      raise exception 'cant_reverse' using errcode = '22023';
    end if;
    perform public.business_collect_one(a.buyer, a.asset);
    update public.player_businesses
       set player_id = a.seller, collected_at = public.game_now(), acquired_price = null, acquired_level = null
     where player_id = a.buyer and business_id = a.asset;
  else
    if not exists (select 1 from public.player_items where id = a.item_id and player_id = a.buyer)
       or (select house_sku from public.players where id = a.seller) is not null
       or exists (select 1 from public.player_items where player_id = a.seller and sku = a.asset) then
      raise exception 'cant_reverse' using errcode = '22023';
    end if;
    update public.player_items set player_id = a.seller, received_via = null, no_resale_until = null, equipped = false where id = a.item_id;
    update public.players set house_sku = null, next_rent_due = (public.ny_today() + v_every)::date where id = a.buyer;
    update public.players set house_sku = a.asset, next_rent_due = null where id = a.seller;
  end if;
  -- The buyer gets the whole price back; the seller gives back what they got (as much as is in the bank).
  net := a.price - a.fee;
  update public.players set bank_cash = bank_cash + a.price where id = a.buyer;
  perform public.ledger_once(a.buyer, 'cash', a.price, 'asset_reverse', 'asset:' || a.id);
  select least(net, bank_cash) into take from public.players where id = a.seller;
  if take > 0 then
    update public.players set bank_cash = bank_cash - take where id = a.seller;
    perform public.ledger_once(a.seller, 'cash', -take, 'asset_reverse', 'asset:' || a.id);
  end if;
  if a.log_id is not null then perform public.economy_release(a.log_id); end if;
  if a.premium > 0 then
    select * into lg from public.economy_log where id = a.log_id;
    update public.economy_limits set uncounted = greatest(0, uncounted - a.premium) where player_id = a.seller and week = lg.week;
  end if;
  update public.asset_sales set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reverse_reason = v_reason where id = a.id;
  insert into public.admin_actions (admin_id, player_id, action, reason) values
    (auth.uid(), a.seller, 'asset_reverse', left('Sale ' || a.id || ' (' || a.label || ')' || coalesce(': ' || v_reason, ''), 300)),
    (auth.uid(), a.buyer, 'asset_reverse', left('Sale ' || a.id || ' (' || a.label || ')' || coalesce(': ' || v_reason, ''), 300));
  return public.admin_asset_sales();
end;
$$;

-- ---------------------------------------------------------------------------
-- Ledger refs for businesses bought or upgraded a second time (after a sale): a suffix keeps every row
-- ---------------------------------------------------------------------------
create or replace function public.buy_business(p_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  def jsonb := public.business_def(p_id);
  pos int;
  me public.players;
  price bigint;
begin
  if def is null then raise exception 'unknown_business' using errcode = '22023'; end if;
  select n into pos from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') with ordinality l(x, n) where l.x ->> 'id' = p_id;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if exists (select 1 from public.player_businesses where player_id = uid and business_id = p_id) then
    raise exception 'already_owned' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') with ordinality l(x, n)
              where l.n < pos and not exists (select 1 from public.player_businesses b where b.player_id = uid and b.business_id = l.x ->> 'id')) then
    raise exception 'business_locked' using errcode = '22023';
  end if;
  price := (def ->> 'price')::bigint;
  if me.bank_cash < price then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.player_businesses (player_id, business_id, bought_at, collected_at) values (uid, p_id, public.game_now(), public.game_now());
  update public.players set bank_cash = bank_cash - price where id = uid;
  if not public.ledger_once(uid, 'cash', -price, 'business_buy', p_id) then
    perform public.ledger_once(uid, 'cash', -price, 'business_buy', p_id || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  end if;
  return jsonb_build_object('cash', -price);
end;
$$;

create or replace function public.upgrade_business(p_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  def jsonb := public.business_def(p_id);
  me public.players;
  biz public.player_businesses;
  cost bigint;
  till bigint;
begin
  if def is null then raise exception 'unknown_business' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into biz from public.player_businesses where player_id = uid and business_id = p_id for update;
  if biz.player_id is null then raise exception 'not_owned' using errcode = '22023'; end if;
  if biz.level >= 3 then raise exception 'max_level' using errcode = '22023'; end if;
  cost := round((def ->> 'price')::numeric * (public.city() -> 'economy' -> 'businesses' -> 'upgrade' ->> 'cost')::numeric)::bigint;
  till := public.business_collect_one(uid, p_id);
  if me.bank_cash + till < cost then raise exception 'cant_afford' using errcode = '22023'; end if;
  update public.player_businesses set level = level + 1 where player_id = uid and business_id = p_id;
  update public.players set bank_cash = bank_cash - cost where id = uid;
  if not public.ledger_once(uid, 'cash', -cost, 'business_upgrade', p_id || ':' || (biz.level + 1)) then
    perform public.ledger_once(uid, 'cash', -cost, 'business_upgrade', p_id || ':' || (biz.level + 1) || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  end if;
  return jsonb_build_object('cash', till - cost, 'level', biz.level + 1, 'till', till);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.asset_settings()', 'public.asset_traces(text, text, uuid)', 'public.asset_appraisal(text, text, uuid)',
    'public.asset_sales_used(uuid)', 'public.asset_since(text, text, uuid)', 'public.asset_block(text, text, uuid, bigint)',
    'public.asset_buyer_block(text, text, uuid)', 'public.asset_view(text, text, uuid)', 'public.asset_sale_json(public.asset_sales, uuid)',
    'public.asset_sale_close(bigint, text, uuid, text)', 'public.asset_sale_settle(bigint)', 'public.asset_sales_settle_due(uuid)',
    'public.asset_sales_settle_all()', 'public.asset_sales_on_restart()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.asset_appraise(text, text)', 'public.asset_buyers()', 'public.asset_sale_offer(text, text, uuid, bigint)',
    'public.asset_sale_answer(bigint, boolean)', 'public.asset_sale_cancel(bigint)', 'public.asset_sales_state()',
    'public.admin_asset_sales()', 'public.admin_asset_reverse(bigint, text)',
    'public.buy_business(text)', 'public.upgrade_business(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.asset_sales_settle_all() to service_role;
