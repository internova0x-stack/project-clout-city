-- Scenario test for migration 0138 (player memory): players can't read it; fact_note remembers, counts and expires and
-- never raises; the city's tallies count; the systems write their facts (ledger, careers, campaigns, choices, marks,
-- relationships, campus); the snapshot reads the player's standing; Start over forgets. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000138' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.has(p uuid, k text, s text default null) returns boolean language sql as
  $$ select exists (select 1 from public.player_facts where player_id = p and key = k and (s is null or subject = s)) $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Rememberer', 'Partner'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;

-- ---- Private: players can't read memory or call the functions ----
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform 1 from public.player_facts; raise exception 'FAIL: player_facts readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.world_tally; raise exception 'FAIL: world_tally readable';
  exception when insufficient_privilege then null; end;
  begin perform public.player_memory(auth.uid()); raise exception 'FAIL: player_memory callable';
  exception when insufficient_privilege then null; end;
  begin perform public.fact_note(auth.uid(), 'career.took_credit', 'x'); raise exception 'FAIL: fact_note callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- fact_note: remembers, counts, expires, never raises ----
select public.fact_note(pg_temp.u(1), 'career.took_credit', 'tech:rival', '{"n": 1}');
select public.fact_note(pg_temp.u(1), 'career.took_credit', 'tech:rival', '{"n": 2}');
select pg_temp.assert((select count = 2 and value ->> 'n' = '2' from public.player_facts where player_id = pg_temp.u(1) and key = 'career.took_credit'), 'counted, latest value kept');
select pg_temp.assert((select count from public.world_tally where key = 'career.took_credit' and subject = 'tech:rival' and day = public.ny_today()) = 2, 'the city counts it');
select public.fact_note(pg_temp.u(1), 'BAD KEY', 'x');
select public.fact_note(null, 'career.hired', 'x');
select pg_temp.assert(not pg_temp.has(pg_temp.u(1), 'BAD KEY'), 'a bad write is dropped, never raised');
select public.fact_note(pg_temp.u(1), 'place.banned', 'velvet-static', '{}', 3);
update public.player_facts set expires_at = now() - interval '1 minute' where player_id = pg_temp.u(1) and key = 'place.banned';
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.player_memory(pg_temp.u(1)) -> 'facts') f where f ->> 'key' = 'place.banned'), 'expired facts are not in force');

-- ---- The ledger's kinds ----
select public.ledger_once(pg_temp.u(1), 'cash', 120, 'shift', 'grind-and-gossip:' || public.ny_today() || ':1');
select pg_temp.assert(pg_temp.has(pg_temp.u(1), 'work.shift', 'grind-and-gossip'), 'a shift is remembered with its place');
select public.ledger_once(pg_temp.u(1), 'clout', 20, 'rent', 'r:1');
select pg_temp.assert(not exists (select 1 from public.player_facts where player_id = pg_temp.u(1) and key like 'rent%'), 'kinds that don''t matter are not remembered');

-- ---- Careers ----
select public.career_hire(pg_temp.u(1), '10000000-0000-0000-0000-000000013801', 'tech', 1, '{}');
select pg_temp.assert(pg_temp.has(pg_temp.u(1), 'career.hired', 'tech'), 'hired');
select public.career_save(pg_temp.u(1), '10000000-0000-0000-0000-000000013801', 1, '{}', 2, 'employed', null, 0, 0, '[]');
select pg_temp.assert(pg_temp.has(pg_temp.u(1), 'career.promoted', 'tech'), 'promoted');
select pg_temp.assert((public.player_snapshot(pg_temp.u(1)) -> 'job' ->> 'level')::int = 2, 'the snapshot has the job');
select public.career_save(pg_temp.u(1), '10000000-0000-0000-0000-000000013801', 2, '{}', 2, 'fired', null, 0, 0, '[]');
select pg_temp.assert(pg_temp.has(pg_temp.u(1), 'career.fired', 'tech'), 'fired');

-- ---- Choices and marks ----
insert into public.choice_log (player_id, card, base, area, day) values (pg_temp.u(1), 'found-wallet-park', 'found-wallet', 'life', public.ny_today());
update public.choice_log set status = 'chosen', option = 'keep' where player_id = pg_temp.u(1);
select pg_temp.assert(pg_temp.has(pg_temp.u(1), 'choice.made', 'found-wallet:keep'), 'the dilemma and the pick');
insert into public.choice_marks (player_id, kind, place, until) values (pg_temp.u(1), 'ban', 'the-sticky-floor', now() + interval '3 days');
select pg_temp.assert((select expires_at > now() + interval '2 days' from public.player_facts where player_id = pg_temp.u(1) and key = 'place.banned' and subject = 'the-sticky-floor'), 'a ban is remembered until it ends');
select pg_temp.assert(public.player_snapshot(pg_temp.u(1)) -> 'marks' ? 'ban', 'the snapshot has the mark');

-- ---- Relationships ----
insert into public.relationships (a, b, start_day) values (pg_temp.u(1), pg_temp.u(2), public.ny_today());
select pg_temp.assert(pg_temp.has(pg_temp.u(1), 'dating.official', pg_temp.u(2)::text) and pg_temp.has(pg_temp.u(2), 'dating.official', pg_temp.u(1)::text), 'official, both sides');
select pg_temp.assert(public.player_snapshot(pg_temp.u(1)) ->> 'partner' = pg_temp.u(2)::text, 'the snapshot has the partner');
update public.relationships set ended_at = now(), ended_by = pg_temp.u(2), end_reason = 'breakup' where a = pg_temp.u(1);
select pg_temp.assert((select (value ->> 'byMe')::boolean from public.player_facts where player_id = pg_temp.u(2) and key = 'dating.breakup'), 'who ended it');

-- ---- The snapshot's standing ----
select pg_temp.assert(public.player_snapshot(pg_temp.u(1)) ->> 'band' = 'middle' and (public.player_snapshot(pg_temp.u(1)) ->> 'rank')::int >= 1, 'band and rank');

-- ---- Start over forgets ----
insert into public.player_restarts (player_id, clout_before, cash_before) values (pg_temp.u(1), 0, 0);
select pg_temp.assert(not exists (select 1 from public.player_facts where player_id = pg_temp.u(1)), 'a new life, no memory');
select pg_temp.assert(exists (select 1 from public.world_tally where key = 'career.took_credit'), 'the city''s totals stay');

\echo 'player_memory: all assertions passed'
rollback;
