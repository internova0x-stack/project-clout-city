-- Scenario test for migration 0061 (The Hub): its floors are open to everyone, restroom gossip works there,
-- and its actions are in the city seed. Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'), false) $$;

insert into auth.users (id) select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 2) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('hubber', 'bodega_drip', '{}', null, true);
select pg_temp.as_(2); select 1 from public.create_player('clubber', 'bodega_drip', '{}', null, true);
reset role;
update public.players set at_place = 'neon-spoon', arrives_at = null, home_id = 'astoria_studio' where display_name = 'hubber';
update public.players set at_place = 'velvet-static', arrives_at = null, home_id = 'astoria_studio' where display_name = 'clubber';

select pg_temp.assert(public.place_is_hub('neon-spoon'), 'neon-spoon is the Hub');
select pg_temp.assert(not public.place_is_hub('velvet-static'), 'a club is not the Hub');
select pg_temp.assert((select count(*) from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
                        where p ->> 'id' = 'neon-spoon' and a ->> 'id' in ('eat', 'play', 'hang')) = 3, 'the Hub has eat, play and hang');

-- Floors 2 and 3 count where you are at the Hub, without any VIP access.
set role authenticated;
select pg_temp.as_(1); select 1 from public.place_presence('neon-spoon', 3);
reset role;
select pg_temp.assert((select at_floor = 3 from public.players where display_name = 'hubber'), 'the lounge floor counts');
set role authenticated;
select pg_temp.as_(1); select 1 from public.place_presence('neon-spoon', 2);
reset role;
select pg_temp.assert((select at_floor = 2 from public.players where display_name = 'hubber'), 'the game room counts');
-- A club's upstairs is still VIP only.
set role authenticated;
select pg_temp.as_(2); select 1 from public.place_presence('velvet-static', 2);
reset role;
select pg_temp.assert((select at_floor = 1 from public.players where display_name = 'clubber'), 'no club VIP floor without access');
-- The Hub's restroom takes restroom gossip (it has a restroom floor, like a club).
set role authenticated;
select pg_temp.as_(1); select 1 from public.gossip_find('neon-spoon', 'restroom');

rollback;
\echo THE HUB CHECKS PASSED
