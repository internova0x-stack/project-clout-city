-- Scenario test for migration 0015 (the Astoria neighborhood).
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

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000071');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000071', false);
select 1 from public.create_player('astorian', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, bank_cash = 1000, mood = 50, confidence = 50 where id = '00000000-0000-0000-0000-000000000071';

-- Seventeen new Astoria places in the seed; the four already there are untouched.
select pg_temp.assert((select count(*) = 17 from jsonb_array_elements(public.city() -> 'places') p
                         where p ->> 'id' in ('ditmars-deli', 'two-bros-pizza', 'neon-spoon', 'up-on-thirty', 'steinway-fresh', 'hellgate-hall',
                           'triborough-works', 'ditmars-library', 'precinct-114-half', 'engine-7', 'astoria-cc', 'harmony-chapel',
                           'hell-gate-park', 'rep-count', 'astoria-blvd-station', 'reel-queens', 'respawn-arena')), 'seventeen new places');
select pg_temp.assert((select count(*) = 4 from jsonb_array_elements(public.city() -> 'places') p
                         where p ->> 'id' in ('grind-and-gossip', 'pedal-pushers', 'low-light-lounge', 'thread-count')), 'existing places kept');

set role authenticated;
-- Paid, free and eat actions all work at the new places.
select 1 from pg_temp.act('two-bros-pizza', 'eat');
select 1 from pg_temp.act('engine-7', 'pet-dog');
select 1 from pg_temp.act('hell-gate-park', 'hangout');
select pg_temp.assert((pg_temp.act('respawn-arena', 'match') ->> 'clout')::int = 12, 'a ranked match pays its fixed 12 clout');
select pg_temp.assert((pg_temp.act('astoria-cc', 'night-class') ->> 'confidence')::int = 6, 'night class: +6 Confidence');
reset role;
select pg_temp.assert((select sum(amount) = -78 and count(*) = 3 from public.ledger
                         where player_id = '00000000-0000-0000-0000-000000000071' and currency = 'cash' and kind in ('eat', 'visit')),
  'paid C$9 + C$24 + C$45 (v0.11 prices); the firehouse dog and the park are free');

-- The cinema is a date spot (its movie is a meal); a library is not.
select pg_temp.assert(public.date_target('place', 'reel-queens') ->> 'price' = '35', 'cinema date at C$35 (v0.11)');
select pg_temp.assert(public.date_target('place', 'ditmars-library') is null, 'no dates at the library');
-- Hellgate Hall has its own club night.
select pg_temp.assert(public.date_target('event', 'bass-bath') ->> 'placeId' = 'hellgate-hall', 'Bass Bath is at Hellgate Hall');

rollback;
\echo ASTORIA CHECKS PASSED
