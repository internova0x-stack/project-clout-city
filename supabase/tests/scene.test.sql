-- Scenario test for migration 0171 (Your Scene): start a move at its place (cost and Energy), slots by rank, no second
-- copy of a running move, getting bounced when sneaking in (Energy spent, a ban, no retry), hypes an hour apart, collecting
-- (missed hypes and staleness cut the pay), the six scores, and paying once.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000005' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid, c text) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p and currency = c $$;
create function pg_temp.fails(q text, code text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like code || '%'; end $$;

insert into auth.users (id) select pg_temp.u(1);
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Scenester', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;
update public.players set at_place = 'velvet-static', bank_cash = 5000, energy = 100, clout = 0 where id = pg_temp.u(1);

-- ---- Context ----
select pg_temp.assert((public.scene_context(pg_temp.u(1)) ->> 'rank')::int = 1, 'rank 1');
select pg_temp.assert(public.scene_slots(1) = 2 and public.scene_slots(3) = 3 and public.scene_slots(7) = 5, 'slots by rank');

-- ---- Starting ----
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'brunch-be-seen', 'invited', false, 0, 0, 0) $$, 'not_here'), 'only at its place');
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'no-such-move', 'invited', false, 0, 0, 0) $$, 'bad_move'), 'unknown move');
select pg_temp.assert((public.scene_start(pg_temp.u(1), 'night-out', 'invited', false, 0, 0, 0) ->> 'slot')::int = 1, 'night out in slot 1');
select pg_temp.assert((select energy from public.players where id = pg_temp.u(1)) = 80, 'Energy spent');
select pg_temp.assert(pg_temp.paid('scene_cost', pg_temp.u(1), 'cash') = -120, 'C$120 paid');
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'night-out', 'invited', false, 0, 0, 0) $$, 'running'), 'not twice at once');
select pg_temp.assert((public.scene_start(pg_temp.u(1), 'open-mic', 'invited', false, 0, 0, 0) ->> 'slot')::int = 2, 'open mic in slot 2');
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'dj-polaroid', 'invited', false, 0, 0, 0) $$, 'no_slot'), 'two slots at Rank 1');

-- ---- Hyping ----
update public.players set at_place = 'velvet-static' where id = pg_temp.u(1);
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_hype(%L, %L) $$, pg_temp.u(1), (select id from public.scene_moves where move = 'night-out' and player_id = pg_temp.u(1))), 'too_soon'), 'not straight away');
update public.scene_moves set started_at = now() - interval '2 hours' where move = 'night-out' and player_id = pg_temp.u(1);
select pg_temp.assert((public.scene_hype(pg_temp.u(1), (select id from public.scene_moves where move = 'night-out' and player_id = pg_temp.u(1))) ->> 'hypes')::int = 1, 'hyped once');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_hype(%L, %L) $$, pg_temp.u(1), (select id from public.scene_moves where move = 'night-out' and player_id = pg_temp.u(1))), 'too_soon'), 'an hour apart');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_hype(%L, %L) $$, pg_temp.u(1), (select id from public.scene_moves where move = 'open-mic' and player_id = pg_temp.u(1))), 'no_hype'), 'a 2-hour move needs no hype');

-- ---- Collecting ----
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_collect(%L, %L) $$, pg_temp.u(1), (select id from public.scene_moves where move = 'night-out' and player_id = pg_temp.u(1))), 'not_ready'), 'not before it''s ready');
update public.scene_moves set ready_at = now() - interval '1 minute' where move = 'night-out' and player_id = pg_temp.u(1);
-- One of two hypes missed: 130 × 0.75 = 98 clout, 20 Nightlife points.
select pg_temp.assert((public.scene_collect(pg_temp.u(1), (select id from public.scene_moves where move = 'night-out' and player_id = pg_temp.u(1))) ->> 'clout')::int = 98, 'a missed hype takes a quarter off');
select pg_temp.assert(pg_temp.paid('scene', pg_temp.u(1), 'clout') = 98, 'clout paid');
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 98, 'on the player');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_collect(%L, %L) $$, pg_temp.u(1), (select id from public.scene_moves where move = 'night-out' and player_id = pg_temp.u(1))), 'no_move'), 'once');
select pg_temp.assert(exists (select 1 from public.player_skills where player_id = pg_temp.u(1) and skill = 'dance'), 'practises Dance');
-- Stale: a quarter of 50 = 13.
update public.scene_moves set ready_at = now() - interval '5 hours', stale_at = now() - interval '1 hour' where move = 'open-mic' and player_id = pg_temp.u(1);
select pg_temp.assert((public.scene_collect(pg_temp.u(1), (select id from public.scene_moves where move = 'open-mic' and player_id = pg_temp.u(1))) ->> 'clout')::int = 13, 'stale pays a quarter');
select pg_temp.assert(public.scene_context(pg_temp.u(1)) -> 'scores' = '{"nightlife": 20, "stage": 3}'::jsonb, 'the scores');
select pg_temp.assert(public.scene_context(pg_temp.u(1)) -> 'rested' @> '["night-out", "open-mic"]', 'collected moves rest');
select pg_temp.assert(jsonb_array_length(public.scene_context(pg_temp.u(1)) -> 'moves') = 0, 'both slots free again');

-- ---- Fake it till you make it ----
update public.players set at_place = 'clout-tower' where id = pg_temp.u(1);
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'talk-show', 'invited', false, 0, 0, 0) $$, 'not_yet'), 'the talk show needs Rank 5');
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'tv-cameo', 'sneak', false, 0, 0, 0) $$, 'bad_entry'), 'no sneaking into a move you already have the rank for');
select pg_temp.assert((public.scene_start(pg_temp.u(1), 'talk-show', 'sneak', true, 0, -3, 24) ->> 'bounced')::boolean, 'bounced at the door');
select pg_temp.assert((select energy from public.players where id = pg_temp.u(1)) = 45, 'the bounce cost the Energy');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 47, 'name-dropping nudges toward Hustler');
select pg_temp.assert(exists (select 1 from public.choice_marks where player_id = pg_temp.u(1) and kind = 'ban' and place = 'clout-tower'), 'a day''s ban');
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'talk-show', 'sneak', false, 0, 0, 0) $$, 'banned_here'), 'banned');
delete from public.choice_marks where player_id = pg_temp.u(1);
select pg_temp.assert(pg_temp.fails($$ select public.scene_start(pg_temp.u(1), 'talk-show', 'sneak', false, 0, 0, 0) $$, 'bounced_today'), 'no second try today');

-- ---- Invited players pay more as they rise (+10% a rank above the move's own) ----
update public.players set best_rank = 4, at_place = 'altitude-718', energy = 100 where id = pg_temp.u(1);
select pg_temp.assert((public.scene_start(pg_temp.u(1), 'rooftop-dinner', 'invited', false, 0, 0, 0) ->> 'cash')::int = -240, 'C$200 × 1.2 at Rank 4');

-- ---- Players can't call any of it ----
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select pg_temp.assert(pg_temp.fails($$ select public.scene_context(auth.uid()) $$, 'permission denied'), 'service role only');
reset role;
rollback;
