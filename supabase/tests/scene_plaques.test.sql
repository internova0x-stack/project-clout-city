-- Scenario test for migration 0173 (Your Scene, step 3): trending's boost, the 10th collect's plaque (clout, badge), Lola's
-- Blotter for a big move (never for News opt-outs), the week's residency and its daily check-in, the ready/stale pushes and
-- the Clout Pass XP.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000007' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid, c text) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p and currency = c $$;
create function pg_temp.fails(q text, code text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like code || '%'; end $$;
create function pg_temp.mv(p uuid, m text) returns uuid language sql as $$ select id from public.scene_moves where player_id = p and move = m and collected_at is null $$;

insert into auth.users (id) select pg_temp.u(1);
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Regular', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;
update public.players set at_place = 'velvet-static', bank_cash = 50000, energy = 100, clout = 0, best_rank = 5 where id = pg_temp.u(1);

-- ---- Trending pays 1.5× ----
select public.scene_start(pg_temp.u(1), 'open-mic', 'invited', false, 0, 0, 0);
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_set_boost(%L, %L, 2) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic')), 'bad_boost'), 'at most 1.5');
select public.scene_set_boost(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic'), 1.5);
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'open-mic');
select pg_temp.assert((public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic')) ->> 'clout')::int = 75, '50 × 1.5');

-- ---- The 10th collect: a plaque ----
insert into public.scene_moves (player_id, move, place, slot, score, need, started_at, ready_at, stale_at, collected_at, clout, points)
select pg_temp.u(1), 'open-mic', 'velvet-static', 9, 'stage', 0, now() - interval '3 days', now() - interval '3 days', now() - interval '2 days', now() - interval '3 days', 50, 10
  from generate_series(1, 8);
select public.scene_start(pg_temp.u(1), 'open-mic', 'invited', false, 0, 0, 0);
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'open-mic');
select pg_temp.assert((public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic')) -> 'plaque' ->> 'at')::int = 10, 'the Regular plaque');
select pg_temp.assert(pg_temp.paid('scene_plaque', pg_temp.u(1), 'clout') = 50, 'plaque bonus');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.u(1) and badge_id = 'scene-open-mic-10'), 'plaque badge');
select pg_temp.assert((public.scene_context(pg_temp.u(1)) -> 'counts' ->> 'open-mic')::int = 10, 'counted');

-- ---- A residency: taken at the move's place, one check-in a day ----
update public.players set at_place = 'gantry-plaza' where id = pg_temp.u(1);
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_residency_take(%L, 'photo-walk') $$, pg_temp.u(1)), 'no_plaque'), 'needs the plaque');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_residency_take(%L, 'open-mic') $$, pg_temp.u(1)), 'not_here'), 'at its place');
update public.players set at_place = 'low-light-lounge' where id = pg_temp.u(1);
select public.scene_residency_take(pg_temp.u(1), 'open-mic');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_residency_take(%L, 'open-mic') $$, pg_temp.u(1)), 'has_residency'), 'one at a time');
select pg_temp.assert((public.scene_residency_checkin(pg_temp.u(1)) ->> 'clout')::int = 25, 'half the move''s clout');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_residency_checkin(%L) $$, pg_temp.u(1)), 'done'), 'once a day');
select pg_temp.assert(public.scene_context(pg_temp.u(1)) -> 'residency' ->> 'move' = 'open-mic', 'in the context');

-- ---- Lola's Blotter for a big move, not for News opt-outs ----
update public.players set at_place = 'clout-tower' where id = pg_temp.u(1);
select public.scene_start(pg_temp.u(1), 'talk-show', 'invited', false, 0, 0, 0);
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'talk-show');
select public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'talk-show'));
select pg_temp.assert(exists (select 1 from public.choice_headlines where player_id = pg_temp.u(1) and kind = 'win' and text like '@Regular went on the talk show%'), 'the Blotter');
update public.players set news_opt_out = true where id = pg_temp.u(1);
select public.scene_start(pg_temp.u(1), 'chardonnay-reunion', 'invited', false, 0, 0, 0);
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'chardonnay-reunion');
select public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'chardonnay-reunion'));
select pg_temp.assert((select count(*) from public.choice_headlines where player_id = pg_temp.u(1) and text not like '%Spotlight%') = 1, 'never for News opt-outs');

-- ---- Pushes: ready, and about to go stale ----
update public.players set at_place = 'velvet-static' where id = pg_temp.u(1);
select public.scene_start(pg_temp.u(1), 'night-out', 'invited', false, 0, 0, 0);
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'night-out');
insert into public.push_subscriptions (player_id, endpoint, p256dh, auth) values (pg_temp.u(1), 'https://fcm.googleapis.com/fcm/send/test-scene', 'k', 'a') on conflict do nothing;
select public.push_scan_scene();
select pg_temp.assert(exists (select 1 from public.push_queue where player_id = pg_temp.u(1) and kind = 'scene_ready'), 'ready push');

-- ---- The Clout Pass ----
select pg_temp.assert((select (value -> 'xp' ->> 'scene')::int from public.game_settings where key = 'season_pass') = 10, '10 XP a move');
rollback;
