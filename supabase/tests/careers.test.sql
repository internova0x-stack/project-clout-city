-- Scenario test for migration 0135 (Careers, part 1): players can't touch careers; one job at a time; saves are
-- versioned and pay each payout once, inside the caps; a workday spends Energy, can't follow a shift and blocks shifts
-- after it; quitting and the sack make a track wait; Start over ends a job. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000135' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.c(n int) returns uuid language sql as $$ select ('10000000-0000-0000-0000-0000000135' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm = msg; end $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Worker', 'Shifter'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;

-- ---- Players can't read careers or call the server's functions ----
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform 1 from public.careers; raise exception 'FAIL: careers readable';
  exception when insufficient_privilege then null; end;
  begin perform public.career_context(auth.uid()); raise exception 'FAIL: career_context callable';
  exception when insufficient_privilege then null; end;
  begin perform public.career_save(auth.uid(), gen_random_uuid(), 1, '{}', 1, 'employed', null, 0, 0, '[]'); raise exception 'FAIL: career_save callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- Context: the skills, no job yet ----
select pg_temp.assert(public.career_context(pg_temp.u(1)) -> 'skills' ? 'smarts', 'context has the skills');
select pg_temp.assert(public.career_context(pg_temp.u(1)) -> 'job' = 'null'::jsonb, 'no job yet');

-- ---- Hiring: one job at a time ----
select public.career_hire(pg_temp.u(1), pg_temp.c(1), 'hospitality', 1, '{"v":1}');
select pg_temp.assert(pg_temp.raises(format($$select public.career_hire(%L, %L, 'tech', 1, '{}')$$, pg_temp.u(1), pg_temp.c(2)), 'employed'), 'one job at a time');
select pg_temp.assert((public.career_context(pg_temp.u(1)) -> 'job' ->> 'status') = 'employed', 'context shows the job');

-- ---- A workday: Energy, versioned, once a day, no shift after it ----
update public.players set energy = 50, mood = 50 where id = pg_temp.u(1);
select pg_temp.assert(public.career_save(pg_temp.u(1), pg_temp.c(1), 1, '{"v":1,"day":1}', 1, 'employed', public.ny_today(), -25, 0, '[]') = 2, 'saved as version 2');
select pg_temp.assert((select energy from public.players where id = pg_temp.u(1)) = 25, 'the workday spent Energy');
select pg_temp.assert(pg_temp.raises(format($$select public.career_save(%L, %L, 1, '{}', 1, 'employed', null, 0, 0, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'conflict'), 'a stale version is refused');
select pg_temp.assert(pg_temp.raises(format($$select public.career_save(%L, %L, 2, '{}', 1, 'employed', public.ny_today(), -10, 0, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'worked_today'), 'one workday a day');
select pg_temp.assert(pg_temp.raises(format($$select public.career_save(%L, %L, 2, '{}', 1, 'employed', null, -30, 0, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'no_energy'), 'not without the Energy');
select pg_temp.assert(pg_temp.raises(format($$select public.career_save(%L, %L, 2, '{}', 1, 'employed', null, -90, 0, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'bad_effects'), 'effects are capped');
select pg_temp.assert(pg_temp.raises(format($$select public.ledger_once(%L, 'cash', 120, 'shift', 'grind-and-gossip:' || public.ny_today() || ':1')$$, pg_temp.u(1)), 'shift_limit'), 'no shift after a workday');
-- The key skills were practised.
select pg_temp.assert(exists (select 1 from public.skill_log where player_id = pg_temp.u(1) and key like 'career:%'), 'key skills practised');

-- ---- Payouts: once, inside the caps, only this job's ----
select public.career_save(pg_temp.u(1), pg_temp.c(1), 2, '{}', 2, 'employed', null, 0, 0,
  format('[{"currency":"cash","amount":600,"kind":"career_pay","ref":"%s:pay:1"},{"currency":"cash","amount":9999,"kind":"career_pay","ref":"%s:pay:2"},{"currency":"clout","amount":100,"kind":"career_promo","ref":"%s:L2"},{"currency":"clout","amount":5,"kind":"career_screen","ref":"someone:1"},{"currency":"cash","amount":50,"kind":"shift","ref":"%s:x"}]',
         pg_temp.c(1), pg_temp.c(1), pg_temp.c(1), pg_temp.c(1))::jsonb);
select pg_temp.assert((select count(*) from public.ledger where player_id = pg_temp.u(1) and kind like 'career_%') = 2, 'only the valid payouts');
select pg_temp.assert((select level from public.careers where id = pg_temp.c(1)) = 2, 'the level is kept');
select public.career_save(pg_temp.u(1), pg_temp.c(1), 3, '{}', 2, 'employed', null, 0, 0,
  format('[{"currency":"cash","amount":600,"kind":"career_pay","ref":"%s:pay:1"}]', pg_temp.c(1))::jsonb);
select pg_temp.assert((select count(*) from public.ledger where player_id = pg_temp.u(1) and kind = 'career_pay') = 1, 'paid once');

-- ---- Quitting: the track waits 2 days; best level is remembered ----
select public.career_save(pg_temp.u(1), pg_temp.c(1), 4, '{}', 2, 'quit', null, 0, 0, '[]');
select pg_temp.assert(pg_temp.raises(format($$select public.career_hire(%L, %L, 'hospitality', 1, '{}')$$, pg_temp.u(1), pg_temp.c(3)), 'too_soon'), 'a wait after quitting');
select pg_temp.assert((public.career_context(pg_temp.u(1)) #>> '{past,hospitality,best}')::int = 2, 'best level remembered');
select public.career_hire(pg_temp.u(1), pg_temp.c(4), 'tech', 1, '{}');
select pg_temp.assert(pg_temp.raises(format($$select public.career_save(%L, %L, 5, '{}', 2, 'employed', null, 0, 0, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'conflict'), 'an ended job takes no saves');

-- ---- A shift first: no workday after it ----
select public.career_hire(pg_temp.u(2), pg_temp.c(5), 'hospitality', 1, '{}');
select public.ledger_once(pg_temp.u(2), 'cash', 120, 'shift', 'grind-and-gossip:' || public.ny_today() || ':1');
select pg_temp.assert(pg_temp.raises(format($$select public.career_save(%L, %L, 1, '{}', 1, 'employed', public.ny_today(), -25, 0, '[]')$$, pg_temp.u(2), pg_temp.c(5)), 'shifted_today'), 'no workday after a shift');

-- ---- Start over ends the job ----
insert into public.player_restarts (player_id, clout_before, cash_before) values (pg_temp.u(2), 0, 0);
select pg_temp.assert((select status from public.careers where id = pg_temp.c(5)) = 'abandoned', 'Start over abandons the job');
select pg_temp.assert(public.career_context(pg_temp.u(2)) -> 'job' = 'null'::jsonb, 'a fresh start shows no job');

\echo 'careers: all assertions passed'
rollback;
