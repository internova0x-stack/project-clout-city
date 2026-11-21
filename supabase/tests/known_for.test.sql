-- Scenario test for migration 0176: everything a player does feeds Known for (once per thing) beside Scene moves, and earns
-- Clout Pass XP from careers, campaigns, businesses, dates and hunts.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000010' || lpad(n::text, 2, '0'))::uuid $$;

insert into auth.users (id) select pg_temp.u(1);
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Known', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;

-- ---- Known for ----
select public.ledger_once(pg_temp.u(1), 'clout', 50, 'career_promo', 'tech:2');
select public.ledger_once(pg_temp.u(1), 'cash', 700, 'career_pay', 'tech:w1:pay');
select public.ledger_once(pg_temp.u(1), 'clout', 35, 'date_night', 'd1');
select public.ledger_once(pg_temp.u(1), 'cash', 20, 'date_night', 'd1');
select public.ledger_once(pg_temp.u(1), 'clout', 20, 'party', 'p1');
select public.ledger_once(pg_temp.u(1), 'clout', 15, 'hunt', 'h1');
select public.ledger_once(pg_temp.u(1), 'cash', 500, 'shift', 's1');
select pg_temp.assert((select points from public.fame_points where player_id = pg_temp.u(1) and kind = 'date_night') = 10, 'a date counts once (its cash and clout rows)');
select pg_temp.assert(not exists (select 1 from public.fame_points where player_id = pg_temp.u(1) and kind = 'shift'), 'unmapped kinds count nothing');
insert into public.scene_moves (player_id, move, place, slot, score, need, ready_at, stale_at, collected_at, clout, points)
values (pg_temp.u(1), 'night-out', 'velvet-static', 1, 'nightlife', 0, now(), now(), now(), 130, 26);
select pg_temp.assert(public.scene_context(pg_temp.u(1)) -> 'scores' = '{"status": 31, "social": 10, "nightlife": 36, "street": 10}'::jsonb, 'scores add Scene and everything else');

-- ---- The Clout Pass ----
select pg_temp.assert((select (value -> 'xp' ->> 'career_promo')::int from public.game_settings where key = 'season_pass') = 40, 'XP for a promotion');
select pg_temp.assert((select (value -> 'xp' ->> 'daily_task')::int from public.game_settings where key = 'season_pass') = 5, 'the old sources kept');
rollback;
