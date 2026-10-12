-- Clout City v0.3 tuning (Oct 12, 2026, product owner): rent, the phone bill and car
-- insurance bill monthly instead of weekly (same day each month); car rentals stay
-- weekly. Gig pay rises so 1 to 2 gigs cover a month's rent on the cheapest home.
-- Only settings and three functions change; bills already issued are kept as they are.

-- The 'city' seed is generated from lib/city.ts by scripts/gen-city-seed.ts;
-- tests/city.test.ts checks the latest one still matches.
update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"1 month","carRentalDays":7,"phone":85,"graceDays":3,"moodDropPerDay":8,"evictAfterDays":7,"carInsuranceRate":0.02},"gigs":{"side":{"confidence":0,"chance":0.9,"payMin":3,"payMax":5,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"chance":0.5,"payMin":8,"payMax":10,"energy":2,"waitMinutes":120},"big":{"confidence":80,"chance":0.22,"payMin":15,"payMax":20,"energy":3,"waitMinutes":240}},"shiftEnergy":25},"places":[{"id":"velvet-static","actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4}]},{"id":"grind-and-gossip","actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0}]},{"id":"lucky-seven-deli","actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0}]},{"id":"altitude-718","actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0}]},{"id":"flushing-meadows","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0}]},{"id":"pedal-pushers","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0}]},{"id":"skybridge-tower","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top"},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top"},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top"},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom"},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom"},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes"},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory"},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

-- Applies everything that happened since the player's last action: the daily
-- Energy top-up and Confidence drift, bills coming due, missed-rent penalties,
-- and today's tasks and gig offers. Bills and rent are protected from stories.
create or replace function public.tick(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c jsonb := public.city() -> 'economy';
  b jsonb := c -> 'bills';
  v_every interval := (b ->> 'every')::interval;
  rental_days int := (b ->> 'carRentalDays')::int;
  today date := public.ny_today();
  me public.players;
  days int;
  overdue record;
  penalty_from date;
  car jsonb;
begin
  select * into me from public.players where id = p_player for update;
  if me.id is null or me.home_id is null then return; end if;

  if me.last_tick_date is null then
    -- First tick after moving in: start the monthly bills from the move-in day.
    update public.players
       set last_tick_date = today,
           next_rent_due = coalesce(next_rent_due, ((coalesce(moved_in_at, now()) at time zone 'America/New_York')::date + v_every)::date),
           next_phone_due = coalesce(next_phone_due, ((coalesce(moved_in_at, now()) at time zone 'America/New_York')::date + v_every)::date)
     where id = p_player
     returning * into me;
  end if;

  days := today - me.last_tick_date;
  if days > 0 then
    update public.players
       set energy = least(100, energy + (c -> 'energy' ->> 'dailyTopUp')::int * days),
           confidence = greatest(0, confidence - (c ->> 'confidenceDriftPerDay')::int * days),
           last_tick_date = today
     where id = p_player
     returning * into me;
  end if;

  -- Bills coming due: rent, phone and insurance monthly; car rentals weekly.
  while me.house_sku is null and me.next_rent_due is not null and me.next_rent_due <= today loop
    insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'rent', public.rent_for(me.home_id), me.next_rent_due);
    me.next_rent_due := (me.next_rent_due + v_every)::date;
  end loop;
  while me.next_phone_due is not null and me.next_phone_due <= today loop
    insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'phone', (b ->> 'phone')::int, me.next_phone_due);
    me.next_phone_due := (me.next_phone_due + v_every)::date;
  end loop;
  if me.car_sku is not null then
    car := public.shop_item(me.car_sku);
    while me.next_car_due is not null and me.next_car_due <= today loop
      if me.car_mode = 'rented' then
        insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'car_rental', (car ->> 'rentPerWeek')::int, me.next_car_due);
      else
        insert into public.bills (player_id, kind, amount, due_date)
        values (p_player, 'car_insurance', ceil((car ->> 'price')::int * (b ->> 'carInsuranceRate')::numeric), me.next_car_due);
      end if;
      me.next_car_due := case when me.car_mode = 'rented' then me.next_car_due + rental_days else (me.next_car_due + v_every)::date end;
    end loop;
  end if;
  update public.players set next_rent_due = me.next_rent_due, next_phone_due = me.next_phone_due, next_car_due = me.next_car_due where id = p_player;

  -- Missed rent: a grace period, then Mood drops each day, then a move to the cheapest home.
  select * into overdue from public.bills
   where player_id = p_player and kind = 'rent' and status = 'due' order by due_date limit 1;
  if overdue.id is not null then
    if today - overdue.due_date >= (b ->> 'evictAfterDays')::int then
      update public.bills set status = 'forgiven' where player_id = p_player and kind = 'rent' and status = 'due';
      update public.players
         set home_id = public.cheapest_home(), next_rent_due = today, mood_penalty_through = today
       where id = p_player;
      insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'rent', public.rent_for(public.cheapest_home()), today);
      update public.players set next_rent_due = (today + v_every)::date where id = p_player;
    elsif today - overdue.due_date > (b ->> 'graceDays')::int then
      penalty_from := greatest(coalesce(me.mood_penalty_through, overdue.due_date + (b ->> 'graceDays')::int),
                               overdue.due_date + (b ->> 'graceDays')::int);
      if today > penalty_from then
        update public.players
           set mood = greatest(0, mood - (b ->> 'moodDropPerDay')::int * (today - penalty_from)),
               mood_penalty_through = today
         where id = p_player;
      end if;
    end if;
  end if;

  perform public.ensure_daily(p_player);
end;
$$;

-- Shop (virtual cash). Clout per purchase has diminishing returns, and buying an item
-- back after selling it pays no clout. Houses end rent; cars start insurance or rental.
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
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_mode = 'rent' and (cat <> 'cars' or coalesce((item ->> 'rentPerWeek')::int, 0) = 0) then raise exception 'not_rentable' using errcode = '22023'; end if;
  if exists (select 1 from public.player_items where player_id = uid and sku = p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if cat = 'houses' and me.house_sku is not null then raise exception 'already_own_house' using errcode = '22023'; end if;
  if cat = 'cars' and me.car_mode = 'owned' then raise exception 'already_own_car' using errcode = '22023'; end if;
  if cat = 'cars' and p_mode = 'rent' and me.car_mode = 'rented' then raise exception 'already_renting' using errcode = '22023'; end if;

  price := case when p_mode = 'rent' then (item ->> 'rentPerWeek')::int else (item ->> 'price')::int end;
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

-- Selling (Clarifications section 5): 60% of value; clout already earned stays.
-- Selling a house restarts rent a month later; selling a car ends its insurance.
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
