-- Scenario test for migration 0157 (Living places): pays once per activity a day, moments five a day and once a week,
-- stamps once ever; the place, Energy and the caps; a cost never takes the bank below zero; the context the server reads.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.pid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000030' || n)::uuid $$;
create function pg_temp.refused(p_kind text, p_place text, p_ref text, p_cash int, p_clout int, p_mood int, p_energy int, p_code text, n int default 1) returns boolean language plpgsql as $$
begin
  perform public.place_life_save(pg_temp.pid(n), p_kind, p_place, p_ref, p_cash, p_clout, p_mood, p_energy);
  return false;
exception when others then return sqlerrm = p_code;
end $$;

insert into auth.users (id) select pg_temp.pid(n) from generate_series(1, 2) n;
set role authenticated;
do $$ begin
  for n in 1..2 loop
    perform set_config('request.jwt.claim.sub', pg_temp.pid(n)::text, false);
    perform public.create_player('Liver' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;
update public.players set at_place = 'feta-compli', energy = 50, bank_cash = 1000, clout = 0, mood = 50 where id = pg_temp.pid(1);
-- The place's hours don't matter for the record of past visits (C2's trigger checks the clock now).
set session_replication_role = replica;
insert into public.place_visits (player_id, place_id, ny_date) values
  (pg_temp.pid(1), 'feta-compli', public.ny_today()), (pg_temp.pid(1), 'feta-compli', public.ny_today() - 1), (pg_temp.pid(1), 'feta-compli', public.ny_today() - 2)
on conflict do nothing;
set session_replication_role = default;
-- Feta Compli open all day for the test (C2's hours run on the city clock).
create or replace function public.place_hours_open(p_place text) returns boolean language sql as $$ select true $$;

-- ---- An activity: at its place, with the Energy, once a day ----
select pg_temp.assert(pg_temp.refused('activity', 'neon-spoon', 'a:hub-arcade', 0, 10, 0, 5, 'not_here'), 'not at the Hub');
update public.players set energy = 10 where id = pg_temp.pid(1);
select pg_temp.assert(pg_temp.refused('activity', 'feta-compli', 'a:feta-lunch-rush', 100, 0, 0, 15, 'no_energy'), 'not enough Energy');
update public.players set energy = 50 where id = pg_temp.pid(1);
select pg_temp.assert(pg_temp.refused('activity', 'feta-compli', 'a:feta-opa', 0, 99, 0, 5, 'bad_effects'), 'clout over the cap');
select pg_temp.assert(pg_temp.refused('activity', 'feta-compli', 'A;drop', 0, 9, 0, 5, 'bad_effects'), 'a ref is checked');
select public.place_life_save(pg_temp.pid(1), 'activity', 'feta-compli', 'a:feta-opa', 0, 20, 6, 5);
select pg_temp.assert((select clout = 20 and mood = 56 and energy = 45 from public.players where id = pg_temp.pid(1)), 'clout, Mood and Energy');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = pg_temp.pid(1) and kind = 'place_life' and currency = 'clout' and amount = 20), 'ledger clout');
select pg_temp.assert(pg_temp.refused('activity', 'feta-compli', 'a:feta-opa', 0, 20, 6, 5, 'done'), 'once a day');
select public.place_life_save(pg_temp.pid(1), 'activity', 'feta-compli', 'a:feta-lunch-rush', 140, 8, 0, 15);
select pg_temp.assert((select bank_cash = 1140 from public.players where id = pg_temp.pid(1)), 'the lunch rush paid C$140');

-- ---- A cost never takes the bank below zero ----
update public.players set bank_cash = 20 where id = pg_temp.pid(1);
select public.place_life_save(pg_temp.pid(1), 'activity', 'feta-compli', 'a:feta-offmenu', -40, 0, 10, 0);
select pg_temp.assert((select bank_cash = 0 from public.players where id = pg_temp.pid(1)), 'C$40 cost with C$20 in the bank: zero, not -20');

-- ---- Moments: five a day, each once a week ----
select public.place_life_save(pg_temp.pid(1), 'moment', null, 'm:tourist-directions', 0, 4, 6, 0);
select pg_temp.assert(pg_temp.refused('moment', null, 'm:tourist-directions', 0, 4, 6, 0, 'done'), 'the same moment again this week');
select public.place_life_save(pg_temp.pid(1), 'moment', null, 'm:m' || n, 0, 1, 0, 0) from generate_series(2, 5) n;
select pg_temp.assert(pg_temp.refused('moment', null, 'm:m6', 0, 1, 0, 0, 'moments_out'), 'a sixth moment today');

-- ---- Stamps: once ever ----
select public.place_life_save(pg_temp.pid(1), 'stamp', 'feta-compli', 's:feta-compli:3', 60, 0, 0, 0);
select pg_temp.assert(pg_temp.refused('stamp', 'feta-compli', 's:feta-compli:3', 60, 0, 0, 0, 'done'), 'a stamp pays once');

-- ---- The context the server reads ----
select pg_temp.assert((public.place_life_context(pg_temp.pid(1)) ->> 'at') = 'feta-compli', 'where the player is');
select pg_temp.assert((public.place_life_context(pg_temp.pid(1)) -> 'refs') ? 'a:feta-opa', 'the activity done today');
select pg_temp.assert((public.place_life_context(pg_temp.pid(1)) -> 'refs') ? 's:feta-compli:3', 'the stamp');
select pg_temp.assert((public.place_life_context(pg_temp.pid(1)) ->> 'momentsToday')::int = 5, 'five moments today');
select pg_temp.assert((public.place_life_context(pg_temp.pid(1)) #>> '{regularDays,feta-compli}')::int = 3, 'three days at Feta Compli');
select pg_temp.assert((public.place_life_context(pg_temp.pid(2)) ->> 'momentsToday')::int = 0, 'another player starts fresh');

-- ---- Players can't call either function ----
select pg_temp.assert(not has_function_privilege('authenticated', 'public.place_life_save(uuid, text, text, text, int, int, int, int)', 'execute'), 'save is server only');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.place_life_context(uuid)', 'execute'), 'context is server only');

rollback;
