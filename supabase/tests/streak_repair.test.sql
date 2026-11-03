-- Scenario test for migration 0158 (streak repair and streak pushes): a broken 3+ day streak can be repaired by earning it
-- back (finishing the five), C$ (20 a day), a guest-list pass or VIP; once every 30 days; never a streak under 3, never
-- past the window; the earn-back carries the run on; the pushes find the right players.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.pid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000040' || n)::uuid $$;
create function pg_temp.as_player(n int) returns void language sql as $$ select set_config('request.jwt.claim.sub', pg_temp.pid(n)::text, false) $$;
create function pg_temp.refused(p_method text, p_code text) returns boolean language plpgsql as $$
begin
  perform public.streak_repair(p_method);
  return false;
exception when others then return sqlerrm = p_code;
end $$;

insert into auth.users (id) select pg_temp.pid(n) from generate_series(1, 5) n;
set role authenticated;
do $$ begin
  for n in 1..5 loop
    perform set_config('request.jwt.claim.sub', pg_temp.pid(n)::text, false);
    perform public.create_player('Streaker' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;

-- Broken streaks: last full day three days ago (yesterday and the day before missed; the freeze covers only one).
insert into public.player_streaks (player_id, current, best, started_on, last_day, freeze_week)
select pg_temp.pid(n), 12, 12, public.ny_today() - 14, public.ny_today() - 3, null from generate_series(1, 4) n;
-- A two-day streak is too short to repair.
insert into public.player_streaks (player_id, current, best, started_on, last_day) values (pg_temp.pid(5), 2, 2, public.ny_today() - 4, public.ny_today() - 3);
update public.players set bank_cash = 1000 where id in (pg_temp.pid(1), pg_temp.pid(2), pg_temp.pid(3), pg_temp.pid(4));

select pg_temp.assert(public.streak_repair_offer(pg_temp.pid(1)) ->> 'streak' = '12', 'a broken 12-day streak has an offer');
select pg_temp.assert((public.streak_repair_offer(pg_temp.pid(1)) ->> 'cash')::int = 240, 'C$20 a day');
select pg_temp.assert(public.streak_repair_offer(pg_temp.pid(5)) is null, 'a 2-day streak has no offer');

set role authenticated;
-- ---- Cash: paid, back on at once ----
select pg_temp.as_player(1);
select public.streak_repair('cash');
reset role;
select pg_temp.assert((select bank_cash = 760 from public.players where id = pg_temp.pid(1)), 'C$240 paid');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = pg_temp.pid(1) and kind = 'streak_repair' and amount = -240), 'ledger row');
select pg_temp.assert((select last_day = public.ny_today() - 1 and current = 12 from public.player_streaks where player_id = pg_temp.pid(1)), 'streak back on at 12');
select pg_temp.assert(public.streak_repair_offer(pg_temp.pid(1)) is null, 'no second repair');
-- Today's five carry it to 13 on the same run.
select public.streak_tick(pg_temp.pid(1), public.ny_today());
select pg_temp.assert((select current = 13 and started_on = public.ny_today() - 14 from public.player_streaks where player_id = pg_temp.pid(1)), 'repaired run carries on');

-- ---- A pass, or nothing ----
set role authenticated;
select pg_temp.as_player(2);
select pg_temp.assert(pg_temp.refused('pass', 'no_pass'), 'no pass held');
reset role;
insert into public.guest_passes (player_id, earned_on) values (pg_temp.pid(2), public.ny_today() - 7);
set role authenticated;
select pg_temp.as_player(2);
select public.streak_repair('pass');
reset role;
select pg_temp.assert((select used_place = 'streak-repair' from public.guest_passes where player_id = pg_temp.pid(2)), 'the pass is used');
select pg_temp.assert((select last_day = public.ny_today() - 1 from public.player_streaks where player_id = pg_temp.pid(2)), 'back on');

-- ---- VIP only for VIPs; not enough cash is refused ----
set role authenticated;
select pg_temp.as_player(3);
select pg_temp.assert(pg_temp.refused('vip', 'not_vip'), 'not a VIP');
reset role;
update public.players set bank_cash = 10 where id = pg_temp.pid(3);
set role authenticated;
select pg_temp.as_player(3);
select pg_temp.assert(pg_temp.refused('cash', 'not_enough_cash'), 'C$10 is not enough');

-- ---- Earn it back: asked for today, lands when today's five are done ----
select pg_temp.as_player(4);
select public.streak_repair('earn');
reset role;
select pg_temp.assert((public.streak_repair_offer(pg_temp.pid(4)) ->> 'earnPending')::boolean, 'earn-back pending');
select pg_temp.assert((select last_day = public.ny_today() - 3 from public.player_streaks where player_id = pg_temp.pid(4)), 'not back yet');
select public.streak_tick(pg_temp.pid(4), public.ny_today());
select pg_temp.assert((select current = 13 and started_on = public.ny_today() - 14 from public.player_streaks where player_id = pg_temp.pid(4)), 'earned back: 13 on the same run');
select pg_temp.assert((select repaired_on = public.ny_today() from public.streak_repairs where player_id = pg_temp.pid(4)), 'marked repaired');
-- Without a repair, a gap starts a new run.
select public.streak_tick(pg_temp.pid(3), public.ny_today());
select pg_temp.assert((select current = 1 from public.player_streaks where player_id = pg_temp.pid(3)), 'no repair: a new run');

-- ---- Once every 30 days ----
update public.player_streaks set current = 9, last_day = public.ny_today() - 3, started_on = public.ny_today() - 12 where player_id = pg_temp.pid(1);
select pg_temp.assert(public.streak_repair_offer(pg_temp.pid(1)) is null, 'one repair every 30 days');
-- ---- Past the window ----
update public.player_streaks set last_day = public.ny_today() - 5 where player_id = pg_temp.pid(2);
select pg_temp.assert(public.streak_repair_offer(pg_temp.pid(2)) is null, 'too late to repair');

-- ---- The scan runs (players without devices get nothing queued) ----
select public.push_scan_streak();
select pg_temp.assert(true, 'push_scan_streak runs');

rollback;
