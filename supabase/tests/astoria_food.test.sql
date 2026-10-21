-- Scenario test for migration 0093 (culture pack C2: Astoria food and opening hours).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
-- Moves the game clock so the city clock reads p_hour:30 (one city day is two real hours).
create function pg_temp.city_at(p_hour int) returns void language plpgsql security definer as $h$
declare into_cycle numeric := mod(extract(epoch from now())::numeric, 7200);
begin
  insert into public.game_settings (key, value) values ('dev', '{}') on conflict (key) do nothing;
  update public.game_settings
     set value = value || jsonb_build_object('clockOffsetSeconds', mod((p_hour * 60 + 30) * 5 - into_cycle + 7200, 7200))
   where key = 'dev';
end $h$;
create function pg_temp.fails(p_place text, p_action text, p_code text) returns boolean language plpgsql security definer as $h$
begin perform pg_temp.act(p_place, p_action); return false;
exception when others then return sqlerrm like '%' || p_code || '%'; end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000931');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000931', false);
select 1 from public.create_player('foodie', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 20, bank_cash = 1000, mood = 50, confidence = 50 where id = '00000000-0000-0000-0000-000000000931';

-- The five new places are in the seed, with hours; Sal's has none.
select pg_temp.assert((select count(*) = 5 from jsonb_array_elements(public.city() -> 'places') p
                        where p ->> 'id' in ('still-a-dollar-slice', 'white-sauce-cart', 'boiled-and-beloved', 'feta-compli', 'schlep-and-schmear')
                          and jsonb_typeof(p -> 'hours') = 'object'), 'five food places with hours');
select pg_temp.assert(public.place_hours_open('ditmars-deli'), 'Sal''s is always open');

-- 3:30 AM on the city clock: only the halal cart (6 PM to 5 AM) and Sal's are serving.
select pg_temp.city_at(3);
select pg_temp.assert(public.city_minutes() / 60 = 3, 'the clock reads 3 AM');
set role authenticated;
select pg_temp.assert((pg_temp.act('white-sauce-cart', 'eat') ->> 'energy')::int = 20, 'chicken over rice after midnight: +20 Energy');
select pg_temp.assert((pg_temp.act('ditmars-deli', 'bec') ->> 'energy')::int = 12, 'a BEC at Sal''s at 3 AM: +12 Energy');
select pg_temp.assert((pg_temp.act('ditmars-deli', 'pet-cat') ->> 'mood')::int = 4, 'petting Also Sal: +4 Mood');
select pg_temp.assert(pg_temp.fails('still-a-dollar-slice', 'slice', 'closed_now'), 'the slice shop is shut at 3 AM');
select pg_temp.assert(pg_temp.fails('schlep-and-schmear', 'eat', 'closed_now'), 'the deli is shut at 3 AM');
reset role;
select pg_temp.assert((select count(*) = 0 from public.place_visits where player_id = '00000000-0000-0000-0000-000000000931'
                        and place_id in ('still-a-dollar-slice', 'schlep-and-schmear')), 'nothing recorded at a shut place');

-- 12:30 PM: lunch everywhere but the halal cart.
select pg_temp.city_at(12);
set role authenticated;
select pg_temp.assert((pg_temp.act('still-a-dollar-slice', 'combo') ->> 'energy')::int = 20, 'two slices and a soda: +20 Energy (budget)');
select pg_temp.assert((pg_temp.act('boiled-and-beloved', 'eat') ->> 'energy')::int = 12, 'two dirty water dogs: +12 Energy (budget)');
select pg_temp.assert((pg_temp.act('feta-compli', 'eat') ->> 'energy')::int = 30, 'the taverna: +30 Energy (medium)');
select pg_temp.assert((pg_temp.act('schlep-and-schmear', 'eat') ->> 'energy')::int = 28, 'pastrami on rye: +28 Energy (medium)');
select pg_temp.assert(pg_temp.fails('white-sauce-cart', 'eat', 'closed_now'), 'the cart opens at 6 PM');
reset role;
select pg_temp.assert((select -sum(amount) = 8 + 14 + 13 + 9 + 40 + 38 from public.ledger
                        where player_id = '00000000-0000-0000-0000-000000000931' and currency = 'cash' and kind = 'eat'), 'paid each menu price once');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.place_hours_open(text)', 'execute'), 'the hours helper is server-only');

rollback;
\echo ASTORIA FOOD CHECKS PASSED
