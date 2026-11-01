-- Scenario test for migration 0009 (postcards, collector fashion, exclusive events).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
-- v0.8 (migration 0025): actions and events need the player at the place; these helpers put the
-- player there first, as if they had travelled.
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
create function pg_temp.attend(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select x ->> 'placeId' from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_event)
   where id = auth.uid();
  return public.attend_event(p_event);
end $h$;
create function pg_temp.attend_x(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select place_id from public.exclusive_events where id = p_event) where id = auth.uid();
  return public.attend_exclusive_event(p_event);
end $h$;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.product(p_sku text) returns jsonb language sql as $$
  select p from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = p_sku $$;
-- Move the game clock to a moment (staging time travel).
create function pg_temp.at(p_ts timestamptz) returns void language plpgsql security definer as $$
begin
  update public.game_settings set value = jsonb_build_object('tools', true, 'clockOffsetSeconds', floor(extract(epoch from (p_ts - now())))::bigint) where key = 'dev';
end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000050');
update public.game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000050', false);
select 1 from public.create_player('Max', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 5000, energy = 100, mood = 50, confidence = 50, clout = 500 where display_name = 'Max';
set role authenticated;

-- ---- The catalog ----
select pg_temp.assert((select count(*) from jsonb_array_elements(public.store_catalog()) x where x ->> 'type' not in ('chat_pass', 'season_pass', 'bundle')) = 12, 'side stories (six since 0116), postcards, collector pieces and two parties (plus the chat passes, 0047, and the Clout Pass and starter pack, 0156)');
select pg_temp.assert((pg_temp.product('col-faux-chinchilla') ->> 'value')::int = 1388, 'collector value is 1.5x the priciest fashion item');
select pg_temp.assert((pg_temp.product('postcard-unisphere') ->> 'visited')::boolean is false, 'not visited yet');
select pg_temp.assert(pg_temp.product('event-jada-sol-listening') #>> '{event,host}' = 'Jada Sol', 'party details');

-- ---- Real money only, and never sold ----
do $$ begin
  begin perform public.buy_item('col-faux-chinchilla'); raise exception 'FAIL: bought with virtual cash';
  exception when sqlstate '22023' then null; end;
  begin perform public.start_purchase('postcard-unisphere', 'cs_pc_early'); raise exception 'FAIL: postcard before visiting';
  exception when sqlstate '22023' then null; end;
end $$;

-- ---- Postcards: visit first, no clout, the set earns a badge ----
select 1 from pg_temp.act('unisphere', 'visit');
select 1 from pg_temp.act('gantry-plaza', 'visit');
select pg_temp.assert((pg_temp.product('postcard-unisphere') ->> 'visited')::boolean, 'visited now');
select public.start_purchase('postcard-unisphere', 'cs_pc_1');
reset role;
create temp table c0 as select clout from public.players where display_name = 'Max';
grant select on c0 to public;
select pg_temp.assert(public.payment_grant('evt_pc_1', 'cs_pc_1', 'pi_pc_1', '00000000-0000-0000-0000-000000000050', 'postcard-unisphere', 99, 'usd') = 'granted', 'postcard granted');
select pg_temp.assert((select clout from public.players where display_name = 'Max') = (select clout from c0), 'postcards pay no clout');
select pg_temp.assert(not exists (select 1 from public.player_badges where badge_id = 'postcard-collector'), 'no badge with half the set');
select public.payment_grant('evt_pc_2', 'cs_pc_2', 'pi_pc_2', '00000000-0000-0000-0000-000000000050', 'postcard-gantry-plaza', 99, 'usd');
select pg_temp.assert(exists (select 1 from public.player_badges where badge_id = 'postcard-collector'), 'the full set earns the badge');
select pg_temp.assert(public.payment_refund('evt_pc_r', 'pi_pc_2') = 'revoked', 'postcard refund');
select pg_temp.assert(not exists (select 1 from public.player_badges where badge_id = 'postcard-collector'), 'refund removes the set badge');
select pg_temp.assert(not public.has_entitlement('00000000-0000-0000-0000-000000000050', 'postcard-gantry-plaza'), 'refunded postcard leaves the Collection');

-- ---- Collector fashion: Possessions at its value, clout with diminishing returns, refund takes both back ----
create temp table c1 as select clout, purchases_count from public.players where display_name = 'Max';
grant select on c1 to public;
select pg_temp.assert(public.payment_grant('evt_col_1', 'cs_col_1', 'pi_col_1', '00000000-0000-0000-0000-000000000050', 'col-faux-chinchilla', 499, 'usd') = 'granted', 'collector granted');
select pg_temp.assert(public.payment_grant('evt_col_1b', 'cs_col_1', 'pi_col_1', '00000000-0000-0000-0000-000000000050', 'col-faux-chinchilla', 499, 'usd') = 'granted', 'second delivery');
select pg_temp.assert((select count(*) = 1 and min(value) = 1388 and min(acquired) = 'collector' from public.player_items where sku = 'col-faux-chinchilla'), 'one piece in Possessions at 1388');
select pg_temp.assert((select clout - (select clout from c1) = round(80 * power(0.85, (select purchases_count from c1)))
                         from public.players where display_name = 'Max'), 'clout with diminishing returns, once');
select pg_temp.assert((select purchases_count = (select purchases_count from c1) + 1 from public.players where display_name = 'Max'), 'counts as one purchase');
set role authenticated;
do $$ begin
  begin perform public.sell_item((select id from public.player_items where sku = 'col-faux-chinchilla')); raise exception 'FAIL: collector sold';
  exception when sqlstate '22023' then null; end;
end $$;
select 1 from public.equip_item((select id from public.player_items where sku = 'col-faux-chinchilla'), true);
reset role;
select pg_temp.assert(public.payment_refund('evt_col_r', 'pi_col_1') = 'revoked', 'collector refund');
select pg_temp.assert(not exists (select 1 from public.player_items where sku = 'col-faux-chinchilla'), 'out of Possessions and the wardrobe');
select pg_temp.assert((select clout = (select clout from c1) from public.players where display_name = 'Max'), 'exactly the clout it paid comes back');

-- ---- Exclusive events: ticket, then the party ----
create temp table c2 as select clout, mood, confidence from public.players where display_name = 'Max';
grant select on c2 to public;
select pg_temp.assert(public.payment_grant('evt_ev_1', 'cs_ev_1', 'pi_ev_1', '00000000-0000-0000-0000-000000000050', 'event-jada-sol-listening', 499, 'usd') = 'granted', 'ticket granted');
select pg_temp.assert((select clout > (select clout from c2) from public.players where display_name = 'Max'), 'the ticket pays clout');
set role authenticated;
do $$ begin
  begin perform pg_temp.attend_x('jada-sol-listening'); raise exception 'FAIL: in before the doors open';
  exception when sqlstate '22023' then null; end;
  begin perform pg_temp.attend_x('dex-monroe-afterparty'); raise exception 'FAIL: in without a ticket';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.at((select starts_at + interval '1 hour' from public.exclusive_events where id = 'jada-sol-listening'));
-- Measure from the moment before going in: moving the clock applies the daily Confidence drift.
select 1 from public.sync_player();
reset role;
create temp table c3 as select mood, confidence from public.players where display_name = 'Max';
grant select on c3 to public;
set role authenticated;
select 1 from pg_temp.attend_x('jada-sol-listening');
select pg_temp.assert((select mood = least(100, (select mood from c3) + 8) and confidence = least(100, (select confidence from c3) + 8) from public.players where display_name = 'Max'), 'the party lifts Mood and Confidence (+8 each, v0.9)');
do $$ begin
  begin perform pg_temp.attend_x('jada-sol-listening'); raise exception 'FAIL: twice';
  exception when sqlstate '22023' then null; end;
end $$;
-- After the party ends it can't be bought; ticket holders keep it as an event card (0022).
select pg_temp.at((select ends_at + interval '1 minute' from public.exclusive_events where id = 'jada-sol-listening'));
select pg_temp.assert((pg_temp.product('event-jada-sol-listening') #>> '{event,attended}')::boolean, 'ended party stays for its ticket holder');
select pg_temp.assert(pg_temp.product('event-dex-monroe-afterparty') is not null, 'parties still on are listed');
do $$ begin
  begin perform public.start_purchase('event-jada-sol-listening', 'cs_ev_late'); raise exception 'FAIL: bought after it ended';
  exception when sqlstate '22023' then null; end;
end $$;
reset role;
select pg_temp.assert(public.payment_refund('evt_ev_r', 'pi_ev_1') = 'revoked', 'ticket refund');
select pg_temp.assert((select clout = (select clout from c2) from public.players where display_name = 'Max'), 'ticket clout taken back');
set role authenticated;
select pg_temp.assert(pg_temp.product('event-jada-sol-listening') is null, 'a refunded ended party leaves the list');
reset role;

select 'MONEY CHECKS PASSED' as result;
rollback;
