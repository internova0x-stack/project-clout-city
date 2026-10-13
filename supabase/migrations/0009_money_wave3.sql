-- v0.5 "Money and Social", part 2: the other three real-money products through the
-- same Stripe flow as the side stories (0008). Story Production and Payments Brief v2;
-- Clarifications sections 5 and 6.
--   - Location wave 3: two monuments (with postcards), a lounge, the boutique, the dealership.
--   - Monument postcards ($0.99): only after visiting the monument; no clout; the Collection.
--   - Collector fashion: real cash only, valued at 1.5x the priciest virtual item in the
--     category, wearable, never sellable, clout with diminishing returns.
--   - Exclusive events: a guest-list ticket, clout with diminishing returns, attended in person.
-- Refunds take back exactly what each grant gave (0008's clawback, extended here).

-- City content (generated from lib/city.ts by scripts/gen-city-seed.ts)
update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"1 month","carRentalDays":7,"phone":85,"graceDays":3,"moodDropPerDay":8,"evictAfterDays":7,"carInsuranceRate":0.02},"gigs":{"side":{"confidence":0,"chance":0.9,"payMin":3,"payMax":5,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"chance":0.5,"payMin":8,"payMax":10,"energy":2,"waitMinutes":120},"big":{"confidence":80,"chance":0.22,"payMin":15,"payMax":20,"energy":3,"waitMinutes":240}},"shiftEnergy":25},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","actions":[{"id":"workout","kind":"visit","price":15,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"actions":[{"id":"visit","kind":"visit","price":45,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":85,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

-- ---------------------------------------------------------------------------
-- Collector items in Possessions
-- ---------------------------------------------------------------------------
alter table public.player_items drop constraint if exists player_items_acquired_check;
alter table public.player_items add constraint player_items_acquired_check check (acquired in ('bought', 'earned', 'collector'));

/** 1.5x the priciest virtual-cash item in the category (lib/city.ts collectorValue). */
create function public.collector_value(p_category text) returns int
language sql stable security definer set search_path = public
as $$
  select round(1.5 * max((i ->> 'price')::int))::int
    from jsonb_array_elements(public.city() -> 'shop') i
   where i ->> 'category' = p_category and not coalesce((i ->> 'collector')::boolean, false)
$$;

-- Virtual cash can never buy a collector piece (Clarifications 5.9).
create or replace function public.buy_item(p_sku text, p_mode text default 'buy')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb := public.shop_item(p_sku);
  cat text := item ->> 'category';
  price int;
  e jsonb := public.city() -> 'economy';
  today date := public.ny_today();
  me public.players;
  v_clout int := 0;
  item_id bigint;
begin
  if item is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if coalesce((item ->> 'collector')::boolean, false) then raise exception 'real_money_only' using errcode = '22023'; end if;
  -- Story-only items (e.g. the "Forever Our Bird" hoodie) are sold only while a story opens them.
  if coalesce((item ->> 'storyOnly')::boolean, false) and (select state from public.story_availability(null, p_sku)) <> 'open' then
    raise exception 'unknown_item' using errcode = '22023';
  end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_mode = 'rent' and (cat <> 'cars' or coalesce((item ->> 'rentPerWeek')::int, 0) = 0) then raise exception 'not_rentable' using errcode = '22023'; end if;
  if exists (select 1 from public.player_items where player_id = uid and sku = p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if cat = 'houses' and me.house_sku is not null then raise exception 'already_own_house' using errcode = '22023'; end if;
  if cat = 'cars' and me.car_mode = 'owned' then raise exception 'already_own_car' using errcode = '22023'; end if;
  if cat = 'cars' and p_mode = 'rent' and me.car_mode = 'rented' then raise exception 'already_renting' using errcode = '22023'; end if;

  price := case when p_mode = 'rent' then (item ->> 'rentPerWeek')::int else (item ->> 'price')::int end;
  price := round(price * (select multiplier from public.story_price(jsonb_build_array(p_sku, cat), 'shop_price')));
  if me.bank_cash < price then raise exception 'cant_afford' using errcode = '22023'; end if;

  -- Clout once per item ever (buying back after a sale pays none).
  if p_mode <> 'rent' then
    v_clout := round((item ->> 'clout')::int * power((e ->> 'purchaseCloutDecay')::numeric, me.purchases_count));
    if not public.ledger_once(uid, 'clout', v_clout, 'purchase', p_sku) then v_clout := 0; end if;
  end if;

  update public.players
     set bank_cash = bank_cash - price,
         clout = clout + v_clout,
         purchases_count = purchases_count + case when p_mode = 'rent' then 0 else 1 end,
         house_sku = case when cat = 'houses' then p_sku else house_sku end,
         next_rent_due = case when cat = 'houses' then null else next_rent_due end,
         car_sku = case when cat = 'cars' then p_sku else car_sku end,
         car_mode = case when cat = 'cars' then (case when p_mode = 'rent' then 'rented' else 'owned' end) else car_mode end,
         next_car_due = case when cat <> 'cars' then next_car_due
                             when p_mode = 'rent' then today + (e -> 'bills' ->> 'carRentalDays')::int
                             else (today + (e -> 'bills' ->> 'every')::interval)::date end
   where id = uid;
  if p_mode = 'rent' then
    perform public.ledger_once(uid, 'cash', -price, 'car_rental', p_sku || ':' || today);
  else
    insert into public.player_items (player_id, sku, category, value) values (uid, p_sku, cat, (item ->> 'price')::int)
    returning id into item_id;
    perform public.ledger_once(uid, 'cash', -price, 'purchase', item_id::text);
  end if;
  return jsonb_build_object('cash', -price, 'clout', v_clout);
end;
$$;

-- Collector pieces can't be sold: that would turn real money into virtual cash (Clarifications 5.5).
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
-- Catalog: postcards, collector pieces and exclusive events
-- ---------------------------------------------------------------------------
alter table public.store_products add column place_id text;

insert into public.store_products (sku, product_type, name, price_cents, place_id) values
  ('postcard-unisphere',    'postcard', 'Postcard: The Unisphere', 99, 'unisphere'),
  ('postcard-gantry-plaza', 'postcard', 'Postcard: Gantry Plaza',  99, 'gantry-plaza'),
  ('col-faux-chinchilla',   'collector_item', 'Faux chinchilla coat',       499, null),
  ('col-holo-boots',        'collector_item', 'Holographic platform boots', 399, null)
on conflict (sku) do nothing;

/** Exclusive events: one-off parties with a guest list (a ticket is an entitlement). */
create table public.exclusive_events (
  id          text primary key,
  sku         text not null unique references public.store_products (sku),
  place_id    text not null,
  name        text not null,
  host        text not null,
  blurb       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null check (ends_at > starts_at),
  clout       int not null default 0,
  energy      int not null default 20,
  mood        int not null default 0,
  confidence  int not null default 0
);
alter table public.exclusive_events enable row level security;
create policy "anyone reads exclusive events" on public.exclusive_events for select to anon, authenticated using (true);

-- The first two parties: this coming Friday and Saturday, 10 PM to 2 AM New York time.
-- Add more with an insert into store_products and exclusive_events (docs/SETUP.md).
do $$
declare
  d date := public.ny_today();
  fri date := d + ((5 - extract(isodow from d)::int + 7) % 7);
begin
  insert into public.store_products (sku, product_type, name, price_cents, place_id) values
    ('event-jada-sol-listening', 'exclusive_event', 'Jada Sol''s listening party', 499, 'low-light-lounge'),
    ('event-dex-monroe-afterparty', 'exclusive_event', 'Dex Monroe''s sneaker-drop afterparty', 299, 'low-light-lounge')
  on conflict (sku) do nothing;
  insert into public.exclusive_events (id, sku, place_id, name, host, blurb, starts_at, ends_at, clout, energy, mood, confidence) values
    ('jada-sol-listening', 'event-jada-sol-listening', 'low-light-lounge', 'Jada Sol''s listening party', 'Jada Sol',
     'The pop star plays her new album to forty people and one very nervous publicist. Phones in a velvet bag at the door.',
     (fri + time '22:00') at time zone 'America/New_York', (fri + 1 + time '02:00') at time zone 'America/New_York', 120, 20, 12, 15),
    ('dex-monroe-afterparty', 'event-dex-monroe-afterparty', 'low-light-lounge', 'Dex Monroe''s sneaker-drop afterparty', 'Dex Monroe',
     'The sneaker king celebrates a shoe nobody can buy. You can''t buy it either, but you can stand next to it.',
     (fri + 1 + time '22:00') at time zone 'America/New_York', (fri + 2 + time '02:00') at time zone 'America/New_York', 80, 20, 10, 10)
  on conflict (id) do nothing;
end $$;

/** The catalog with this player's state per product, plus what each product needs to be shown. */
create or replace function public.store_catalog()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', p.sku, 'type', p.product_type, 'name', p.name, 'priceCents', p.price_cents, 'currency', p.currency,
    'parent', p.parent_arc_id, 'placeId', p.place_id,
    'owned', public.has_entitlement(auth.uid(), p.sku),
    'pending', exists (select 1 from public.purchases u where u.player_id = auth.uid() and u.sku = p.sku and u.status = 'pending'
                         and u.created_at > now() - interval '1 hour'),
    -- Postcards: offered once the player has visited the monument.
    'visited', case when p.product_type = 'postcard'
                    then exists (select 1 from public.place_visits v where v.player_id = auth.uid() and v.place_id = p.place_id) end,
    'value', case when p.product_type = 'collector_item'
                  then public.collector_value((select i ->> 'category' from jsonb_array_elements(public.city() -> 'shop') i where i ->> 'sku' = p.sku)) end,
    'event', (select jsonb_build_object('id', e.id, 'placeId', e.place_id, 'name', e.name, 'host', e.host, 'blurb', e.blurb,
                                        'startsAt', e.starts_at, 'endsAt', e.ends_at, 'clout', e.clout, 'energy', e.energy,
                                        'mood', e.mood, 'confidence', e.confidence,
                                        'attended', exists (select 1 from public.event_attendance a
                                                             where a.player_id = auth.uid() and a.event_id = e.id))
                from public.exclusive_events e where e.sku = p.sku)
  ) order by p.sku), '[]')
  from public.store_products p
  where p.active
    -- Parties that have ended leave the list.
    and not exists (select 1 from public.exclusive_events e where e.sku = p.sku and e.ends_at <= public.game_now());
$$;

/** As in 0008, plus each product's own rule: postcards after a visit, parties before they end. */
create or replace function public.start_purchase(p_sku text, p_session text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.store_products;
begin
  select * into prod from public.store_products where sku = p_sku and active;
  if prod.sku is null then raise exception 'unknown_product' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if public.has_entitlement(uid, p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if p_session !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'bad_session' using errcode = '22023'; end if;
  if prod.product_type = 'postcard' and not exists (select 1 from public.place_visits where player_id = uid and place_id = prod.place_id) then
    raise exception 'visit_first' using errcode = '22023';
  end if;
  if prod.product_type = 'exclusive_event' and exists (select 1 from public.exclusive_events where sku = p_sku and ends_at <= public.game_now()) then
    raise exception 'event_over' using errcode = '22023';
  end if;
  insert into public.purchases (stripe_session_id, player_id, sku) values (p_session, uid, p_sku)
  on conflict (stripe_session_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook: grant and refund every product type
-- ---------------------------------------------------------------------------
/** Purchase clout with diminishing returns, once per Checkout Session (refunds find it by ref). */
create function public.purchase_clout_once(p_player uuid, p_base int, p_session text) returns int
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
  v int;
begin
  select * into me from public.players where id = p_player for update;
  v := round(p_base * power((public.city() -> 'economy' ->> 'purchaseCloutDecay')::numeric, me.purchases_count));
  if v <= 0 or not public.ledger_once(p_player, 'clout', v, 'purchase_clout', p_session) then return 0; end if;
  update public.players set clout = clout + v, purchases_count = purchases_count + 1 where id = p_player;
  return v;
end;
$$;

create or replace function public.payment_grant(
  p_event text, p_session text, p_payment text, p_player uuid, p_sku text, p_amount int, p_currency text
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  prod public.store_products;
  item jsonb;
  ev public.exclusive_events;
  result text;
begin
  -- A replay of an event we already handled changes nothing.
  if exists (select 1 from public.stripe_events where id = p_event) then return 'duplicate'; end if;
  select * into prod from public.store_products where sku = p_sku;
  if prod.sku is null then
    result := 'unknown_product';
  elsif not exists (select 1 from public.players where id = p_player) then
    result := 'unknown_player';
  else
    insert into public.entitlements (player_id, sku, product_type, status, stripe_session_id, stripe_payment_id, parent_arc_id)
    values (p_player, p_sku, prod.product_type, 'active', p_session, p_payment, prod.parent_arc_id)
    on conflict (player_id, sku) do update
       set status = 'active', stripe_session_id = excluded.stripe_session_id, stripe_payment_id = excluded.stripe_payment_id,
           revoked_at = null;
    insert into public.purchases (stripe_session_id, player_id, sku, status, amount_cents, currency, stripe_payment_id)
    values (p_session, p_player, p_sku, 'paid', p_amount, p_currency, p_payment)
    on conflict (stripe_session_id) do update
       set status = 'paid', amount_cents = excluded.amount_cents, currency = excluded.currency,
           stripe_payment_id = excluded.stripe_payment_id, updated_at = now();

    if prod.product_type = 'collector_item' then
      -- Into Possessions and the wardrobe at its set value, with clout (diminishing returns).
      item := public.shop_item(p_sku);
      insert into public.player_items (player_id, sku, category, value, acquired)
      values (p_player, p_sku, item ->> 'category', public.collector_value(item ->> 'category'), 'collector')
      on conflict (player_id, sku) do nothing;
      perform public.purchase_clout_once(p_player, (item ->> 'clout')::int, p_session);
    elsif prod.product_type = 'exclusive_event' then
      -- On the guest list, with clout (diminishing returns).
      select * into ev from public.exclusive_events where sku = p_sku;
      perform public.purchase_clout_once(p_player, coalesce(ev.clout, 0), p_session);
    elsif prod.product_type = 'postcard' then
      -- No clout (the visit paid it). The whole set earns a badge.
      if not exists (select 1 from public.store_products s where s.product_type = 'postcard' and s.active
                        and not public.has_entitlement(p_player, s.sku)) then
        insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'postcard-collector', 'collection')
        on conflict do nothing;
      end if;
    end if;
    result := 'granted';
  end if;
  insert into public.stripe_events (id, type, result) values (p_event, 'checkout.session.completed', result);
  return result;
end;
$$;

create or replace function public.payment_refund(p_event text, p_payment text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  e public.entitlements;
  n int := 0;
  awarded bigint;
  have bigint;
  back bigint;
begin
  if exists (select 1 from public.stripe_events where id = p_event) then return 'duplicate'; end if;
  for e in select * from public.entitlements where stripe_payment_id = p_payment and status = 'active' for update loop
    update public.entitlements set status = 'revoked', revoked_at = now() where player_id = e.player_id and sku = e.sku;
    -- What the product put in the game comes out again.
    if e.product_type = 'collector_item' then
      delete from public.player_items where player_id = e.player_id and sku = e.sku and acquired = 'collector';
    elsif e.product_type = 'postcard' then
      delete from public.player_badges where player_id = e.player_id and badge_id = 'postcard-collector';
    end if;
    -- The clout this purchase paid, taken back once, never below zero.
    select coalesce(sum(amount), 0) into awarded from public.ledger
     where player_id = e.player_id and currency = 'clout' and kind = 'purchase_clout' and ref = e.stripe_session_id;
    if awarded > 0 then
      select clout into have from public.players where id = e.player_id for update;
      back := least(awarded, greatest(have, 0));
      if public.ledger_once(e.player_id, 'clout', -back, 'refund_clout', e.stripe_session_id) then
        update public.players set clout = clout - back where id = e.player_id;
      end if;
    end if;
    n := n + 1;
  end loop;
  update public.purchases set status = 'refunded', updated_at = now() where stripe_payment_id = p_payment;
  insert into public.stripe_events (id, type, result) values (p_event, 'charge.refunded', case when n > 0 then 'revoked' else 'nothing_to_revoke' end);
  return case when n > 0 then 'revoked' else 'nothing_to_revoke' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Going to the party
-- ---------------------------------------------------------------------------
/** On the guest list and the doors are open: spend Energy, gain Mood and Confidence. Clout came with the ticket. */
create function public.attend_exclusive_event(p_event text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.exclusive_events;
  me public.players;
  now_ timestamptz := public.game_now();
begin
  select * into ev from public.exclusive_events where id = p_event;
  if ev.id is null then raise exception 'unknown_event' using errcode = '22023'; end if;
  if not public.has_entitlement(uid, ev.sku) then raise exception 'not_on_list' using errcode = '22023'; end if;
  if now_ < ev.starts_at or now_ >= ev.ends_at then raise exception 'doors_closed' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.energy < ev.energy then raise exception 'no_energy' using errcode = '22023'; end if;
  -- Once per party, even though it runs past midnight.
  if exists (select 1 from public.event_attendance where player_id = uid and event_id = ev.id) then
    raise exception 'already_attended' using errcode = '22023';
  end if;
  insert into public.event_attendance (player_id, event_id, ny_date) values (uid, ev.id, public.ny_today());
  update public.players
     set energy = greatest(0, energy - ev.energy), mood = least(100, mood + ev.mood), confidence = least(100, confidence + ev.confidence)
   where id = uid;
  return jsonb_build_object('energy', -ev.energy, 'mood', ev.mood, 'confidence', ev.confidence);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.attend_exclusive_event(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.collector_value(text)', 'public.purchase_clout_once(uuid, int, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- create or replace keeps earlier grants; restate the webhook-only ones to be sure.
  foreach f in array array[
    'public.payment_grant(text, text, text, uuid, text, int, text)', 'public.payment_refund(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end;
$$;
