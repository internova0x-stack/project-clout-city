-- Scenario test for migration 0012 (the two parody universities).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
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

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000081');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select 1 from public.create_player('Uma', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, confidence = 50 where id = '00000000-0000-0000-0000-000000000081';
set role authenticated;

-- A lecture is free: Energy for Confidence and a fixed 15 clout, the clout once a day.
select pg_temp.assert((pg_temp.act('st-johnsons', 'lecture') ->> 'clout')::int = 15, 'lecture pays 15 clout');
select pg_temp.assert((pg_temp.act('st-johnsons', 'lecture') ->> 'clout')::int = 0, 'second lecture today pays no clout');
select pg_temp.assert((pg_temp.act('queensborough-u', 'lecture') ->> 'confidence')::int = 6, 'the other campus counts separately');
reset role;
select pg_temp.assert((select confidence = 62 and energy = 55 from public.players where id = '00000000-0000-0000-0000-000000000081'),
  'confidence +6 twice (once per campus), energy -15 per lecture');
select pg_temp.assert((select count(*) = 2 from public.ledger where player_id = '00000000-0000-0000-0000-000000000081' and kind = 'visit'
                         and ref like any (array['st-johnsons:%', 'queensborough-u:%'])), 'one clout row per campus');
-- Both campus events exist in the city seed, plus Greek Row party night at each campus (migration 0075).
select pg_temp.assert((select count(*) = 4 from jsonb_array_elements(public.city() -> 'events') e
                         where e ->> 'placeId' in ('st-johnsons', 'queensborough-u')), 'four campus events');

rollback;
\echo UNIVERSITY CHECKS PASSED
