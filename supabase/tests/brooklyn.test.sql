-- Scenario test for migration 0066 (Brooklyn locked until 100 players are out at once on 3 days).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh (which starts with Brooklyn open).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

-- Locked again for this test.
update public.borough_gates set opened_at = null, opened_by = null;
delete from public.concurrency_days;

-- The seed knows each place's borough.
select pg_temp.assert((select count(*) from jsonb_array_elements(public.city() -> 'places') p where p ->> 'borough' = 'brooklyn') = 19, 'nineteen places in Brooklyn');
select pg_temp.assert(not public.place_open('hellgate-hall') and public.place_open('st-copays') and public.place_open('neon-spoon'), 'Brooklyn locked, Queens open');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000066b1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066b1', false);
select 1 from public.create_player('brooklyn_test', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 5000, energy = 100 where display_name = 'brooklyn_test';
set role authenticated;

-- Nobody gets in: not by travel, not by setting where they are.
select pg_temp.assert(pg_temp.raises($$select public.travel('hellgate-hall', 'taxi')$$, 'borough_locked'), 'no trip to a locked borough');
select pg_temp.assert((select at_place is null from public.players where display_name = 'brooklyn_test'), 'still at home');
select 1 from public.travel('st-copays', 'taxi');
select pg_temp.assert((select at_place = 'st-copays' from public.players where display_name = 'brooklyn_test'), 'the new hospital is open');

-- The state the app shows.
select pg_temp.assert((select (g ->> 'open')::boolean = false and (g ->> 'target')::int = 100 and (g ->> 'daysNeeded')::int = 3
                         from jsonb_array_elements(public.borough_state()) g where g ->> 'id' = 'brooklyn'), 'Brooklyn shows locked, 100 on 3 days');

-- Daily tasks never point at a locked place.
reset role;
create temp table seen as select place_id from public.daily_tasks where false;
do $$ begin
  for i in 1..40 loop
    delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000066b1';
    perform public.ensure_daily('00000000-0000-0000-0000-0000000066b1');
    insert into seen select place_id from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000066b1';
  end loop;
end $$;
select pg_temp.assert(not exists (select 1 from seen where not public.place_open(place_id)), 'no daily task in a locked borough');

-- The rule: 100 out at once on 3 different days. Two big days aren't enough; a third opens it.
insert into public.concurrency_days (ny_date, peak) values (public.ny_today() - 5, 140), (public.ny_today() - 2, 101), (public.ny_today() - 1, 99);
select public.borough_tick();
select pg_temp.assert(not public.borough_open('brooklyn'), 'two days at 100+ is not enough');
update public.concurrency_days set peak = 100 where ny_date = public.ny_today() - 1;
select public.borough_tick();
select pg_temp.assert(public.borough_open('brooklyn'), 'the third day opens Brooklyn');
select pg_temp.assert((select opened_by = 'players' from public.borough_gates where id = 'brooklyn'), 'opened by the players');

-- 0069: each borough has its own target, in order, Manhattan last; days before the one before it opened don't count.
select pg_temp.assert((select string_agg(id || ':' || target, ',' order by position) from public.borough_gates)
                      = 'brooklyn:100,bronx:250,staten_island:500,manhattan:1000', 'targets in unlock order');
insert into public.concurrency_days (ny_date, peak) values (public.ny_today() - 4, 300), (public.ny_today() - 3, 300)
  on conflict (ny_date) do update set peak = excluded.peak;
update public.concurrency_days set peak = 300 where ny_date = public.ny_today() - 2;
select public.borough_tick();
select pg_temp.assert(not public.borough_open('bronx') and public.borough_days_hit('bronx') = 0, 'big days before Brooklyn opened don''t count for the Bronx');
-- Brooklyn opened 3 days ago: those days count now; the Bronx opens, Staten Island starts counting from today.
update public.borough_gates set opened_at = now() - interval '4 days' where id = 'brooklyn';
update public.concurrency_days set peak = 1200 where ny_date >= public.ny_today() - 4;
select public.borough_tick();
select pg_temp.assert(public.borough_open('bronx') and not public.borough_open('staten_island') and not public.borough_open('manhattan'), 'one borough at a time');
select pg_temp.assert(public.borough_counts_from('manhattan') is null, 'Manhattan waits for Staten Island');
set role authenticated;
select pg_temp.assert((select string_agg(g ->> 'id' || ':' || (g ->> 'counting'), ',') from jsonb_array_elements(public.borough_state()) g)
                      = 'brooklyn:false,bronx:false,staten_island:true,manhattan:false', 'the app sees which borough is counting');
reset role;

-- Today's peak follows players out now (session pings in the last 2 minutes).
select pg_temp.assert((select peak >= 0 from public.concurrency_days where ny_date = public.ny_today()), 'today has a peak');

-- Open: in you go.
set role authenticated;
select 1 from public.travel('hellgate-hall', 'taxi');
select pg_temp.assert((select at_place = 'hellgate-hall' from public.players where display_name = 'brooklyn_test'), 'Brooklyn is open');

-- The Studio switch is admins only.
select pg_temp.assert(pg_temp.raises($$select public.admin_open_borough('brooklyn', true)$$, ''), 'players cannot flip the switch');

rollback;
