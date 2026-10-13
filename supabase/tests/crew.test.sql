-- Scenario test for migration 0013 (crew outings).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || n)::uuid $$;

insert into auth.users (id) select pg_temp.id(n) from generate_series(91, 98) n;
set role authenticated;
do $$
declare n text; i int := 91;
begin
  foreach n in array array['Ada', 'Bo', 'Cal', 'Dru', 'Eve', 'Fay', 'Gil', 'Hux'] loop
    perform pg_temp.as_(i);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
-- Ada invited Bo, Cal, Dru, Eve, Fay and Hux (six in her crew). Gil is a stranger.
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code)
select pg_temp.id(91), pg_temp.id(n), 'TEST' from unnest(array[92, 93, 94, 95, 96, 98]) n;
update public.players set bank_cash = 500, mood = 50 where id in (select pg_temp.id(n) from generate_series(91, 98) n);
create temp table c0 as select id, clout from public.players;
grant select on c0 to public;
set role authenticated;

-- ---- Who and what ----
select pg_temp.as_(91);
select pg_temp.assert(jsonb_array_length(public.crew_members()) = 6, 'six in the crew');
select pg_temp.as_(92);
select pg_temp.assert(jsonb_array_length(public.crew_members()) = 1, 'the invited side sees their inviter');
select pg_temp.as_(91);
do $$ begin
  begin perform public.crew_outing_create('place', 'lucky-seven-deli', 'eat', array[pg_temp.id(97)]); raise exception 'FAIL: invited a stranger';
  exception when sqlstate '22023' then null; end;
  begin perform public.crew_outing_create('place', 'grind-and-gossip', 'shift', array[pg_temp.id(92)]); raise exception 'FAIL: a shift';
  exception when sqlstate '22023' then null; end;
  begin perform public.crew_outing_create('place', 'skybridge-tower', 'gigs', array[pg_temp.id(92)]); raise exception 'FAIL: the gigs board';
  exception when sqlstate '22023' then null; end;
  begin perform public.crew_outing_create('place', 'lucky-seven-deli', 'eat', array[pg_temp.id(92), pg_temp.id(93), pg_temp.id(94), pg_temp.id(95), pg_temp.id(96), pg_temp.id(98)]);
    raise exception 'FAIL: six invites';
  exception when sqlstate '22023' then null; end;
end $$;

-- ---- The outing ----
select 1 from public.crew_outing_create('place', 'lucky-seven-deli', 'eat', array[pg_temp.id(92), pg_temp.id(93), pg_temp.id(94), pg_temp.id(95), pg_temp.id(96)]);
select pg_temp.assert(jsonb_array_length(public.crew_inbox() -> 'outings' -> 0 -> 'members') = 6, 'host plus five');
-- Ada goes first: nobody else yet, so no bonus.
select 1 from public.do_action('lucky-seven-deli', 'eat');
reset role;
select pg_temp.assert((select count(*) = 0 from public.ledger where kind like 'crew_%'), 'no bonus alone');
set role authenticated;
-- Bo goes without answering: going counts as yes, and both get +10.
select pg_temp.as_(92);
select 1 from public.do_action('lucky-seven-deli', 'eat');
reset role;
select pg_temp.assert((select count(*) = 2 and sum(amount) = 20 from public.ledger where kind = 'crew_friend'), 'pair bonus both ways');
set role authenticated;
-- Cal says no: hidden from Cal, and the full crew is now out of reach.
select pg_temp.as_(93);
select public.crew_respond((public.crew_inbox() -> 'outings' -> 0 ->> 'id')::bigint, false);
select pg_temp.assert(jsonb_array_length(public.crew_inbox() -> 'outings') = 0, 'declined is hidden');
-- Dru, Eve and Fay go.
do $$ declare n int; begin
  foreach n in array array[94, 95, 96] loop perform pg_temp.as_(n); perform public.do_action('lucky-seven-deli', 'eat'); end loop;
end $$;
reset role;
-- Five went: each gets +10 for each of the other four.
select pg_temp.assert((select bool_and(gain = 40) from (
  select p.id, p.clout - c.clout - coalesce((select sum(amount) from public.ledger l where l.player_id = p.id and l.kind = 'visit'), 0) as gain
    from public.players p join c0 c using (id) where p.id in (pg_temp.id(91), pg_temp.id(92), pg_temp.id(94), pg_temp.id(95), pg_temp.id(96))) g),
  'four friends each, +40');
select pg_temp.assert((select count(*) = 0 from public.ledger where kind = 'crew_full'), 'no full bonus without Cal');
set role authenticated;

-- ---- A second outing the same day: Cal changes their mind elsewhere ----
select pg_temp.as_(91);
select 1 from public.crew_outing_create('place', 'flushing-meadows', 'hangout', array[pg_temp.id(92), pg_temp.id(93), pg_temp.id(94), pg_temp.id(95), pg_temp.id(96)]);
do $$ declare n int; begin
  foreach n in array array[91, 92, 93, 94, 95, 96] loop perform pg_temp.as_(n); perform public.do_action('flushing-meadows', 'hangout'); end loop;
end $$;
reset role;
select pg_temp.assert((select count(*) = 6 and bool_and(amount = 100) from public.ledger where kind = 'crew_full'), 'full crew: +100 each');
select pg_temp.assert((select count(*) = 5 from public.ledger where kind = 'crew_friend' and player_id = pg_temp.id(93)), 'Cal: one bonus per friend');
select pg_temp.assert((select count(*) = 5 from public.ledger where kind = 'crew_friend' and player_id = pg_temp.id(91)), 'pairs pay once a day, across outings');
select pg_temp.assert((select bool_and(mood >= 60) from public.players where id in (pg_temp.id(91), pg_temp.id(93))), 'full crew mood');
set role authenticated;
select pg_temp.as_(91);
select pg_temp.assert((public.crew_inbox() -> 'outings' -> 0 ->> 'full')::boolean, 'shown as full');

-- ---- Limits and blocks ----
select 1 from public.crew_outing_create('place', 'grind-and-gossip', 'eat', array[pg_temp.id(98)]);
do $$ begin
  begin perform public.crew_outing_create('place', 'altitude-718', 'eat', array[pg_temp.id(98)]); raise exception 'FAIL: fourth outing';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.as_(98);
select pg_temp.assert(jsonb_array_length(public.crew_inbox() -> 'outings') = 1, 'Hux is invited');
select public.chat_block(pg_temp.id(91), true);
select pg_temp.assert(jsonb_array_length(public.crew_inbox() -> 'outings') = 0, 'blocking leaves the outing');
select pg_temp.assert(jsonb_array_length(public.crew_members()) = 0, 'and the crew');
do $$ begin
  begin perform 1 from public.crew_outings; if found then raise exception 'FAIL: read outings directly'; end if;
  exception when insufficient_privilege then null; end;
end $$;

rollback;
\echo CREW CHECKS PASSED
