-- Scenario test for migration 0104 (Clout Couture on the map: yachts, jets, the plaza statue's booking, names).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_player(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000020' || n, false) $$;
create function pg_temp.code(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users (id) select ('00000000-0000-0000-0000-00000000020' || n)::uuid from generate_series(1, 4) n;
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000204');
set role authenticated;
do $$ begin
  for n in 1..4 loop
    perform pg_temp.as_player(n);
    perform public.create_player('Mapper' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;
insert into public.shop_catalog (sku, status, tab, slot, name, price, clout, stars, real_cash, price_usd_cents, edition_size, collection, origin, wearable)
values ('astoria-yacht', 'live', 'luxury', 'waterfront', 'The Astoria Yacht', 0, 300, 4, true, 6999, 50, 'Clout Couture', 'import', true),
       ('clout-one-jet', 'live', 'luxury', 'sky', 'Clout One Jet', 0, 300, 4, true, 8999, 25, 'Clout Couture', 'import', true),
       ('plaza-statue', 'live', 'luxury', 'plaza', 'Plaza Statue', 0, 300, 4, true, 12000, 52, 'Clout Couture', 'import', true);
update public.game_settings set value = jsonb_set(value, '{words}', coalesce(value -> 'words', '[]') || '["mapper2"]') where key = 'chat';

-- Mapper1 buys a yacht and a jet, Mapper2 a yacht, Mapper3 the statue.
set role authenticated;
select pg_temp.as_player(1);
select public.start_purchase('astoria-yacht', 'cs_y_1');
select public.start_purchase('clout-one-jet', 'cs_j_1');
select pg_temp.as_player(2);
select public.start_purchase('astoria-yacht', 'cs_y_2');
select pg_temp.as_player(3);
select public.start_purchase('plaza-statue', 'cs_p_3');
reset role;
select public.payment_grant('evt_y_1', 'cs_y_1', 'pi_y_1', '00000000-0000-0000-0000-000000000201', 'astoria-yacht', 6999, 'usd');
select public.payment_grant('evt_j_1', 'cs_j_1', 'pi_j_1', '00000000-0000-0000-0000-000000000201', 'clout-one-jet', 8999, 'usd');
select public.payment_grant('evt_y_2', 'cs_y_2', 'pi_y_2', '00000000-0000-0000-0000-000000000202', 'astoria-yacht', 6999, 'usd');
select public.payment_grant('evt_p_3', 'cs_p_3', 'pi_p_3', '00000000-0000-0000-0000-000000000203', 'plaza-statue', 12000, 'usd');
update public.players set look = '{"skin": "#8D5524", "style": "bodega_drip"}' where id = '00000000-0000-0000-0000-000000000203';

-- ---- The map: two yachts (names filtered), no jet until its owner is in the game ----
set role authenticated;
select pg_temp.as_player(4);
create temp table m as select public.couture_map() as v;
select pg_temp.assert(jsonb_array_length((select v -> 'yachts' from m)) = 2, 'two yachts moored');
select pg_temp.assert((select v #>> '{yachts,0,name}' from m) = 'Mapper1' and (select v #>> '{yachts,1,name}' from m) = '•••••••', 'names on the hull, filtered');
select pg_temp.assert(jsonb_array_length((select v -> 'jets' from m)) = 0, 'no jet while its owner is away');
select pg_temp.assert((select v -> 'statue' from m) = 'null', 'no statue booked');
select pg_temp.as_player(1);
select public.session_ping();
select pg_temp.as_player(4);
select pg_temp.assert((public.couture_map() #>> '{jets,0,name}') = 'Mapper1', 'the jet flies while its owner plays');

-- ---- The plaza: book a week, one statue a week, the look kept ----
select pg_temp.as_player(4);
select pg_temp.assert(not (public.plaza_weeks() ->> 'canBook')::boolean, 'no statue, no booking');
select pg_temp.assert(pg_temp.code($$select public.plaza_book(public.plaza_week_now())$$) = 'no_statue', 'refused without one');
select pg_temp.as_player(3);
select pg_temp.assert((public.plaza_weeks() ->> 'canBook')::boolean and jsonb_array_length(public.plaza_weeks() -> 'weeks') = 12, 'twelve weeks to pick from');
select pg_temp.assert(pg_temp.code($$select public.plaza_book(public.plaza_week_now() + 1)$$) = 'bad_week', 'weeks start on Monday');
select pg_temp.assert(pg_temp.code($$select public.plaza_book(public.plaza_week_now() - 7)$$) = 'bad_week', 'not in the past');
select 1 from public.plaza_book(public.plaza_week_now());
select pg_temp.assert(pg_temp.code($$select public.plaza_book(public.plaza_week_now() + 7)$$) = 'already_booked', 'one week per statue');
select pg_temp.assert((public.plaza_weeks() ->> 'mine')::date = public.plaza_week_now(), 'my week');
select pg_temp.as_player(4);
select pg_temp.assert((public.couture_map() #>> '{statue,name}') = 'Mapper3' and (public.couture_map() #>> '{statue,look,skin}') = '#8D5524', 'the statue stands this week, as they looked');
select pg_temp.assert((public.plaza_weeks() #>> '{weeks,0,taken}')::boolean, 'this week is taken');
do $$ begin
  begin perform 1 from public.plaza_bookings; raise exception 'FAIL: players read the bookings';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- The Studio: hide a name, take a statue down ----
select pg_temp.as_player(1);
select pg_temp.assert(pg_temp.code($$select public.admin_couture_name('00000000-0000-0000-0000-000000000202', 'astoria-yacht', true)$$) = 'not_admin', 'players can''t');
select pg_temp.as_player(4);
select public.admin_couture_name('00000000-0000-0000-0000-000000000202', 'astoria-yacht', true, 'name on the hull');
select pg_temp.assert((public.couture_map() #>> '{yachts,1,name}') = 'No. 0002', 'hidden: the edition number instead');
select pg_temp.assert((select bool_or((o ->> 'hidden')::boolean) from jsonb_array_elements(public.admin_couture_owners('astoria-yacht')) o), 'the Studio sees it hidden');
select pg_temp.assert(pg_temp.code($$select public.admin_plaza_remove(public.plaza_week_now(), '')$$) = 'reason_needed', 'a reason first');
select public.admin_plaza_remove(public.plaza_week_now(), 'Reported statue');
select pg_temp.assert((public.couture_map() -> 'statue') = 'null', 'off the plaza');
select pg_temp.as_player(3);
select pg_temp.assert((public.plaza_weeks() ->> 'canBook')::boolean, 'the owner can book again');
select 1 from public.plaza_book(public.plaza_week_now() + 14);

-- ---- A refund takes the statue's booking back ----
reset role;
select public.payment_refund('evt_p_3r', 'pi_p_3');
select pg_temp.assert(not exists (select 1 from public.plaza_bookings where status = 'booked'), 'refund frees the week');
select pg_temp.assert((select count(*) from public.admin_actions where action in ('couture_name', 'plaza_remove')) = 2, 'both Studio actions logged');

rollback;
\echo couture_map: ok
