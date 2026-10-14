-- Scenario test for migration 0036 (the gossip trail and gossip daily tasks).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f' || n, false) $$;
create function pg_temp.at(n int, p text) returns void language sql security definer as $$
  update public.players set at_place = p where id = ('00000000-0000-0000-0000-0000000000f' || n)::uuid $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('trailer', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;

-- Two live stories: one starting with a regular (Sal), one overheard.
select public.gossip_import(jsonb_build_object('week', date_trunc('week', public.ny_today())::date, 'stories', jsonb_build_array(
  jsonb_build_object('id', 'trail-a', 'title', 'Trail A', 'topic', 'regulars', 'emoji', '🫖', 'teaser', 'Something is brewing in Astoria today.',
    'pieces', jsonb_build_array(
      jsonb_build_object('text', 'A one, from Sal.', 'place', 'ditmars-deli', 'source', 'regular'),
      jsonb_build_object('text', 'A two, overheard at the café.', 'place', 'grind-and-gossip', 'source', 'overheard'),
      jsonb_build_object('text', 'A three, in the park.', 'place', 'hell-gate-park', 'source', 'overheard'),
      jsonb_build_object('text', 'A four, at the firehouse.', 'place', 'engine-7', 'source', 'overheard'),
      jsonb_build_object('text', 'A five, from Mr. Penwright.', 'place', 'ditmars-library', 'source', 'regular')),
    'tea', jsonb_build_object('headline', 'Trail A, spilled', 'body', 'Lola explains everything.')),
  jsonb_build_object('id', 'trail-b', 'title', 'Trail B', 'topic', 'regulars', 'emoji', '🍕', 'teaser', 'Something else is brewing in Astoria.',
    'pieces', jsonb_build_array(
      jsonb_build_object('text', 'B one, overheard at the pizza place.', 'place', 'two-bros-pizza', 'source', 'overheard'),
      jsonb_build_object('text', 'B two.', 'place', 'neon-spoon', 'source', 'overheard'),
      jsonb_build_object('text', 'B three.', 'place', 'up-on-thirty', 'source', 'overheard'),
      jsonb_build_object('text', 'B four.', 'place', 'triborough-works', 'source', 'overheard'),
      jsonb_build_object('text', 'B five.', 'place', 'respawn-arena', 'source', 'regular')),
    'tea', jsonb_build_object('headline', 'Trail B, spilled', 'body', 'Lola explains everything again.')))));

-- The leads: each story's first piece.
select pg_temp.assert((select count(*) from public.gossip_leads('00000000-0000-0000-0000-0000000000f1')) = 2, 'one lead per story');
select pg_temp.assert((select place from public.gossip_leads('00000000-0000-0000-0000-0000000000f1') where story = 'trail-a') = 'ditmars-deli', 'trail A starts at the deli');

-- Today's list: two gossip tasks (one per lead) and three ordinary ones; the regular comes first.
delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1';
select public.ensure_daily('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1') = 5, 'still five tasks');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'gossip') = 2, 'two are gossip');
select pg_temp.assert((select place_id || ':' || action_id from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1' and slot = 1)
  = 'ditmars-deli:gossip-regular', 'first: talk to Sal at the deli');
select pg_temp.assert(exists (select 1 from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1'
  and place_id = 'two-bros-pizza' and action_id = 'gossip-overheard'), 'and listen in at the pizza place');

set role authenticated;
select pg_temp.as_(1);
-- Before: the second piece's place is a hint only.
select pg_temp.assert(public.gossip_state() -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'place' is null, 'piece two hidden at first');
-- Talk to Sal: piece one, the task is paid, and piece two's place is now named (the trail).
select pg_temp.at(1, 'ditmars-deli');
create temp table f1 as select public.gossip_find('ditmars-deli', 'regular') r;
grant all on f1 to authenticated;
select pg_temp.assert(jsonb_array_length(r -> 'found') = 1 and (r ->> 'taskCash')::int > 0, 'piece one, and the task paid') from f1;
select pg_temp.assert(public.gossip_state() -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'place' = 'grind-and-gossip', 'Sal points to the café');
select pg_temp.assert(public.gossip_state() -> 'stories' -> 0 -> 'pieces' -> 2 ->> 'place' is null, 'but not further');
select pg_temp.assert((public.gossip_find('ditmars-deli', 'regular') ->> 'taskCash')::int = 0, 'the task pays once');
reset role;
select pg_temp.assert((select place from public.gossip_leads('00000000-0000-0000-0000-0000000000f1') where story = 'trail-a') = 'grind-and-gossip', 'the lead moves on');

-- Listening in at the pizza place completes that task even with nothing new (say, shared by a crewmate first).
insert into public.gossip_found (player_id, story_id, piece, via) values ('00000000-0000-0000-0000-0000000000f1', 'trail-b', 0, 'crew');
set role authenticated;
select pg_temp.as_(1);
select pg_temp.at(1, 'two-bros-pizza');
create temp table f2 as select public.gossip_find('two-bros-pizza', 'overheard') r;
grant all on f2 to authenticated;
select pg_temp.assert(jsonb_array_length(r -> 'found') = 0 and (r ->> 'taskCash')::int > 0, 'nothing new, but the task still counts') from f2;
reset role;

-- A finished story leaves no lead; with no leads at all, five ordinary tasks.
update public.gossip_weeks set status = 'paused';
delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1';
select public.ensure_daily('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000000f1' and kind <> 'gossip') = 5, 'no gossip: five ordinary tasks');

rollback;
\echo 'GOSSIP TRAIL CHECKS PASSED'
