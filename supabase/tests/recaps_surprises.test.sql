-- Scenario test for migration 0177: halfway goal rewards, last week's recap and surprises.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000011' || lpad(n::text, 2, '0'))::uuid $$;

insert into auth.users (id) select pg_temp.u(1);
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Halfway', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;

-- ---- Halfway there ----
update public.players set clout = 200, bank_cash = 8000 where id = pg_temp.u(1);
set role authenticated;
select pg_temp.assert(public.goals_halfway() @> '[{"id": "save_15k", "clout": 18}]'::jsonb, 'half of C$15k saved pays a quarter of 75 early');
select pg_temp.assert(not (public.goals_halfway() @> '[{"id": "save_15k"}]'::jsonb), 'once');
reset role;
select pg_temp.assert(not exists (select 1 from public.ledger where player_id = pg_temp.u(1) and kind = 'goal_half' and ref = 'save_100k'), 'locked goals wait');
select pg_temp.assert(not exists (select 1 from public.ledger where player_id = pg_temp.u(1) and kind = 'goal_half' and ref = 'first_purchase'), 'yes/no goals have no halfway');

-- ---- Last week's recap ----
select public.ledger_once(pg_temp.u(1), 'clout', 120, 'career_promo', 'r1');
select public.ledger_once(pg_temp.u(1), 'clout', 30, 'event', 'r2');
select public.ledger_once(pg_temp.u(1), 'cash', 400, 'shift', 'r3');
select public.ledger_once(pg_temp.u(1), 'cash', 100, 'daily_bonus', 'r4');
update public.ledger set created_at = (public.ny_today() - extract(isodow from public.ny_today())::int - 3)::timestamp at time zone 'America/New_York'
 where player_id = pg_temp.u(1) and ref like 'r_';
update public.fame_points set created_at = (public.ny_today() - extract(isodow from public.ny_today())::int - 3)::timestamp at time zone 'America/New_York'
 where player_id = pg_temp.u(1) and ref like 'r_';
set role authenticated;
select pg_temp.assert((public.week_recap() ->> 'clout')::int >= 150, 'clout from last week');
select pg_temp.assert((public.week_recap() ->> 'cash')::int >= 500, 'cash from last week');
select pg_temp.assert((public.week_recap() ->> 'fullDays')::int = 1, 'full days');
select pg_temp.assert(public.week_recap() -> 'best' ->> 'kind' = 'career_promo', 'the best moment');
select pg_temp.assert((public.week_recap() -> 'scores' ->> 'status')::int > 0, 'Known for points last week');
reset role;

-- ---- Surprises ----
select pg_temp.assert(public.surprise_give(pg_temp.u(1), 'freebie', 100, 0, 0, 0, '{}'), 'a surprise');
select pg_temp.assert(not public.surprise_give(pg_temp.u(1), 'selfie', 0, 30, 0, 0, '{}'), 'one a day');
select pg_temp.assert((select amount from public.ledger where player_id = pg_temp.u(1) and kind = 'surprise') = 100, 'paid once');
delete from public.surprises where player_id = pg_temp.u(1);
select public.surprise_give(pg_temp.u(1), 'invite', 0, 0, 0, 0, '{"move": "night-out"}');
insert into public.scene_moves (id, player_id, move, place, slot, score, need, ready_at, stale_at, clout)
values ('00000000-0000-0000-0000-00000000aa01', pg_temp.u(1), 'night-out', 'velvet-static', 1, 'nightlife', 0, now(), now(), 100);
select public.ledger_once(pg_temp.u(1), 'cash', -80, 'scene_cost', '00000000-0000-0000-0000-00000000aa01');
select pg_temp.assert(public.surprise_invite_redeem(pg_temp.u(1), '00000000-0000-0000-0000-00000000aa01') = 80, 'the invite refunds the move');
select pg_temp.assert(public.surprise_invite_redeem(pg_temp.u(1), '00000000-0000-0000-0000-00000000aa01') = 0, 'once');
do $$ begin perform public.surprise_give(pg_temp.u(1), 'selfie', 5000, 0, 0, 0, '{}'); raise exception 'FAIL: too big'; exception when sqlstate '22023' then null; end $$;
set role authenticated;
do $$ begin perform public.surprise_give(pg_temp.u(1), 'freebie', 10, 0, 0, 0, '{}'); raise exception 'FAIL: players cannot give themselves surprises'; exception when insufficient_privilege then null; end $$;
reset role;
rollback;
