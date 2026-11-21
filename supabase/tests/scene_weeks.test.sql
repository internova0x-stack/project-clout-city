-- Scenario test for migration 0174 (Your Scene's weekly moves): a week's moves arrive scheduled and can't be started
-- before their window; once live (and in their week) they start like the game's own; a veto stops new starts but a running
-- one can still be collected; a stored move keeps the Studio's decision on a second import.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000008' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid, c text) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p and currency = c $$;
create function pg_temp.fails(q text, code text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like code || '%'; end $$;
create function pg_temp.mv(p uuid, m text) returns uuid language sql as $$ select id from public.scene_moves where player_id = p and move = m and collected_at is null $$;

insert into auth.users (id) select pg_temp.u(1);
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Weekly', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;
update public.players set at_place = 'gantry-plaza', bank_cash = 5000, energy = 100 where id = pg_temp.u(1);

-- This week's Monday, so the moves are in their week whatever day the test runs.
create temp table wk as select public.ny_today() - ((extract(isodow from public.ny_today())::int) - 1) as monday;

-- ---- Import: scheduled, not startable before the window ----
select pg_temp.assert(public.content_import_scene((select monday from wk), '[
  {"id":"wtest-popup","title":"A test pop-up","emoji":"🌙","area":"everyday","places":["gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":90,"score":"stage","skill":"music","why":"Test","line":"Test"},
  {"id":"wtest-two","title":"Another","emoji":"✨","area":"everyday","places":["gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":40,"score":"street","why":"Test","line":"Test"}
]'::jsonb) = 2, 'two stored');
select pg_temp.assert(public.content_import_scene((select monday from wk), '[{"id":"wtest-popup","title":"Changed","emoji":"🌙","area":"everyday","places":["gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":999,"score":"stage","why":"x","line":"x"}]'::jsonb) = 0, 'a stored move is never touched');
select pg_temp.assert(not public.scene_move_open('wtest-popup'), 'scheduled: not yet');
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'wtest-popup', 'invited', false, 0, 0, 0) $$, 'bad_move'), 'not before the window');
select pg_temp.assert(jsonb_array_length(public.scene_weeks_live()) = 0, 'nothing live yet');

-- ---- Live: starts and collects like the game's own ----
update public.scene_week_moves set live_at = now() - interval '1 minute';
select pg_temp.assert(public.scene_move_open('wtest-popup'), 'live in its week');
select pg_temp.assert((public.scene_weeks_live() -> 0 ->> 'offer')::boolean, 'offered');
select public.scene_start(pg_temp.u(1), 'wtest-popup', 'invited', false, 0, 0, 0);
-- ---- A veto after it started: no new starts, the running one still collects ----
update public.scene_week_moves set status = 'vetoed', went_live = true where id = 'wtest-popup';
select pg_temp.assert(not public.scene_move_open('wtest-popup'), 'vetoed: closed');
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'wtest-popup');
select pg_temp.assert((public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'wtest-popup')) ->> 'clout')::int = 90, 'still collected');
select pg_temp.assert(not ((select x from jsonb_array_elements(public.scene_weeks_live()) x where x -> 'move' ->> 'id' = 'wtest-popup') ->> 'offer')::boolean, 'listed, not offered');

-- ---- Out of its week: closed ----
update public.scene_week_moves set week = (select monday from wk) - 7 where id = 'wtest-two';
select pg_temp.assert(not public.scene_move_open('wtest-two'), 'last week''s move is over');

-- ---- The Studio ----
select pg_temp.assert(pg_temp.fails($$ select public.admin_scene_moves() $$, ''), 'admins only (no session here)');
rollback;
