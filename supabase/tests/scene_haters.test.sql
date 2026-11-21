-- Scenario test for migration 0172 (Your Scene, step 2): a hater lands on a move and takes its cut at collect unless dealt
-- with; dealing (a publicist's price, a regular's weekly vouch, spilling tea, rising above it); the crew hyping a friend's
-- move from anywhere, once each, for 5 clout.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000006' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid, c text) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p and currency = c $$;
create function pg_temp.fails(q text, code text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like code || '%'; end $$;
create function pg_temp.mv(p uuid, m text) returns uuid language sql as $$ select id from public.scene_moves where player_id = p and move = m and collected_at is null $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 3) n;
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Famous', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
select pg_temp.as_(pg_temp.u(2)::text);
select public.create_player('Crewmate', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
select pg_temp.as_(pg_temp.u(3)::text);
select public.create_player('Stranger', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.u(1), pg_temp.u(2), 'TEST');
update public.players set at_place = 'velvet-static', bank_cash = 5000, energy = 100, clout = 0 where id in (pg_temp.u(1), pg_temp.u(2), pg_temp.u(3));

-- ---- A hater lands and takes its cut ----
select public.scene_start(pg_temp.u(1), 'night-out', 'invited', false, 0, 0, 0);
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_set_hater(%L, %L, 'reservation', now() - interval '1 day', 0.25) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'night-out')), 'bad_hater'), 'it lands while the move builds');
select public.scene_set_hater(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'night-out'), 'reservation', now() + interval '2 hours', 0.25);
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_set_hater(%L, %L, 'mid-sneeze', now() + interval '2 hours', 0.25) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'night-out')), 'bad_hater'), 'one hater a move');
select pg_temp.assert((public.scene_context(pg_temp.u(1)) -> 'moves' -> 0 ->> 'hater') is null, 'not shown before it lands');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_deal(%L, %L, 'rise', null, 0, 3) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'night-out')), 'no_hater'), 'nothing to deal with yet');
update public.scene_moves set hater_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'night-out');
select pg_temp.assert(public.scene_context(pg_temp.u(1)) -> 'moves' -> 0 ->> 'hater' = 'reservation', 'shown once landed');

-- ---- The crew hypes it from anywhere ----
update public.players set at_place = 'gantry-plaza' where id = pg_temp.u(2);
select pg_temp.assert(jsonb_array_length(public.scene_context(pg_temp.u(2)) -> 'crew') = 1, 'the crew sees the move');
select pg_temp.assert(jsonb_array_length(public.scene_context(pg_temp.u(3)) -> 'crew') = 0, 'strangers don''t');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_crew_hype(%L, %L) $$, pg_temp.u(3), pg_temp.mv(pg_temp.u(1), 'night-out')), 'not_crew'), 'only the crew');
select pg_temp.assert((public.scene_crew_hype(pg_temp.u(2), pg_temp.mv(pg_temp.u(1), 'night-out')) ->> 'clout')::int = 5, 'pays the helper 5 clout');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_crew_hype(%L, %L) $$, pg_temp.u(2), pg_temp.mv(pg_temp.u(1), 'night-out')), 'hyped'), 'once each');
select pg_temp.assert(pg_temp.paid('scene_crew', pg_temp.u(2), 'clout') = 5, 'ledger scene_crew');
select pg_temp.assert(cardinality((select hypes from public.scene_moves where id = pg_temp.mv(pg_temp.u(1), 'night-out'))) = 1, 'counts as a hype');
select pg_temp.assert(jsonb_array_length(public.scene_context(pg_temp.u(2)) -> 'crew') = 0, 'gone from the crew list once hyped');

-- ---- Left standing, the cut comes off: 130 × (1 − 0.25 for one missed hype) × (1 − 0.25) = 73 ----
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'night-out');
select pg_temp.assert((public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'night-out')) ->> 'clout')::int = 73, 'the hater''s cut');

-- ---- Dealing with one: a publicist, then a regular's vouch, then the weekly limit ----
select public.scene_start(pg_temp.u(1), 'open-mic', 'invited', false, 0, 0, 0);
select public.scene_set_hater(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic'), 'mid-sneeze', now() + interval '1 hour', 0.25);
update public.scene_moves set hater_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'open-mic');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_deal(%L, %L, 'publicist', null, 50, 0) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic')), 'bad_deal'), 'a publicist costs money');
select public.scene_deal(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic'), 'publicist', null, -175, 0);
select pg_temp.assert(pg_temp.paid('scene_cost', pg_temp.u(1), 'cash') = -120 - 175, 'the publicist was paid');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_deal(%L, %L, 'rise', null, 0, 3) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic')), 'dealt'), 'once');
update public.scene_moves set ready_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'open-mic');
select pg_temp.assert((public.scene_collect(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'open-mic')) ->> 'clout')::int = 50, 'dealt with: full pay');

update public.players set at_place = 'gantry-plaza' where id = pg_temp.u(1);
select public.scene_start(pg_temp.u(1), 'photo-walk', 'invited', false, 0, 0, 0);
select public.scene_set_hater(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'photo-walk'), 'burner', now() + interval '1 hour', 0.25);
update public.scene_moves set hater_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'photo-walk');
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_deal(%L, %L, 'vouch', 'sal', 0, 1) $$, pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'photo-walk')), 'no_vouch'), 'a regular has to know you');
insert into public.npc_bonds (player_id, npc, favors) values (pg_temp.u(1), 'sal', 3);
select pg_temp.assert(public.scene_context(pg_temp.u(1)) -> 'vouchers' = '["sal"]', 'Sal would vouch');
select public.scene_deal(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'photo-walk'), 'vouch', 'sal', 0, 1);
select pg_temp.assert(not (public.scene_context(pg_temp.u(1)) ->> 'vouchFree')::boolean, 'one vouch a week');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 51, 'a vouch nudges Halo-ward');

-- ---- Spilling tea pays and nudges Hustler-ward ----
select public.scene_start(pg_temp.u(1), 'tiff-collab', 'invited', false, 0, 0, 0);
select public.scene_set_hater(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'tiff-collab'), 'tiff-first', now() + interval '1 hour', 0.25);
update public.scene_moves set hater_at = now() - interval '1 minute' where id = pg_temp.mv(pg_temp.u(1), 'tiff-collab');
select public.scene_deal(pg_temp.u(1), pg_temp.mv(pg_temp.u(1), 'tiff-collab'), 'spill', null, 80, -4);
select pg_temp.assert(pg_temp.paid('scene_tea', pg_temp.u(1), 'cash') = 80, 'the gossip site paid');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 47, 'spilling tea nudges Hustler-ward');

-- ---- Players can't call any of it ----
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select pg_temp.assert(pg_temp.fails(format($$ select public.scene_crew_hype(auth.uid(), %L) $$, gen_random_uuid()), 'permission denied'), 'service role only');
reset role;
rollback;
