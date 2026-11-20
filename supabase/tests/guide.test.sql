-- Scenario test for migration 0170 (the Guide): "seen" steps marked by the game, steps checked from what the game writes,
-- each paid once, nothing paid before it's done, and the chapter's badge and C$500 once its last step is paid.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000004' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid, c text) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p and currency = c $$;
create function pg_temp.fails(q text, code text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like code || '%'; end $$;

insert into auth.users (id) select pg_temp.u(11);
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select public.create_player('Guided', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');

-- ---- Nothing done yet ----
select pg_temp.assert(jsonb_array_length(public.guide_state() -> 'ready') = 0, 'nothing ready');
select pg_temp.assert((public.guide_state() ->> 'day')::int = 1, 'day 1');
select pg_temp.assert(pg_temp.fails($$ select public.guide_claim('1.1') $$, 'not_yet'), 'not before it''s done');
select pg_temp.assert(pg_temp.fails($$ select public.guide_seen('1.6') $$, 'bad_step'), 'only "seen" steps are marked by the game');
select pg_temp.assert(pg_temp.fails($$ select public.guide_claim('9.9') $$, 'bad_step'), 'unknown step');

-- ---- A seen step pays once ----
select public.guide_seen('1.1');
select pg_temp.assert(public.guide_state() -> 'ready' ? '1.1', 'ready once seen');
select pg_temp.assert((public.guide_claim('1.1') ->> 'clout')::int = 15, 'pays 15 clout');
select pg_temp.assert((public.guide_claim('1.1') ->> 'clout')::int = 0, 'once');
select pg_temp.assert(public.guide_state() -> 'paid' ? '1.1', 'paid');
select pg_temp.assert(not (public.guide_state() -> 'ready' ? '1.1'), 'no longer ready');

-- ---- Steps checked from what the game writes ----
reset role;
insert into public.gossip_found (player_id, story_id, piece, via) values (pg_temp.u(11), 'test', 0, 'overheard');
select public.ledger_once(pg_temp.u(11), 'cash', 100, 'daily_bonus', 'x');
insert into public.player_streaks (player_id, current, best) values (pg_temp.u(11), 3, 3) on conflict (player_id) do update set current = 3;
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(public.guide_state() -> 'ready' @> '["1.6", "1.7", "1.11"]', 'tasks, gossip and streak ready');
select pg_temp.assert((public.guide_claim('1.6') ->> 'cash')::int = 150, 'all five pays C$150');

-- ---- The chapter: every step paid, then its C$500 and badge ----
reset role;
select public.ledger_once(pg_temp.u(11), 'clout', 5, 'visit', 'x'), public.ledger_once(pg_temp.u(11), 'clout', 5, 'event', 'x'),
       public.ledger_once(pg_temp.u(11), 'clout', 5, 'goal', 'x');
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select public.guide_seen(s) from unnest(array['1.2', '1.3', '1.4', '1.9', '1.10', '1.13']) s;
select public.guide_claim(s) from unnest(array['1.2', '1.3', '1.4', '1.5', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12']) s;
select pg_temp.assert(pg_temp.paid('guide_chapter', pg_temp.u(11), 'cash') = 0, 'no chapter reward with a step left');
select pg_temp.assert((public.guide_claim('1.13') ->> 'chapter')::int = 1, 'the last step finishes the chapter');
select pg_temp.assert(pg_temp.paid('guide_chapter', pg_temp.u(11), 'cash') = 500, 'chapter pays C$500');
select pg_temp.assert(public.guide_state() -> 'chapters' = '[1]', 'chapter 1 paid');
reset role;
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.u(11) and badge_id = 'guide-1'), 'the Off the Bus badge');
select pg_temp.assert(pg_temp.paid('guide', pg_temp.u(11), 'cash') = 50 + 150 + 50 + 150, 'step cash: 1.2, 1.6, 1.9, 1.13');
select pg_temp.assert(pg_temp.paid('guide', pg_temp.u(11), 'clout') = 15 + 15 + 15 + 20 + 20 + 30 + 15 + 30 + 30, 'step clout');

-- ---- Chapter 2: sleep, a meal, groceries, cooking practice, sitting, a paid bill ----
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(not (public.guide_state() -> 'ready' ? '2.1'), 'no sleep yet');
reset role;
insert into public.player_rest (player_id, ny_date, kind, uses) values (pg_temp.u(11), public.ny_today(), 'sleep', 1), (pg_temp.u(11), public.ny_today(), 'sit', 1);
select public.ledger_once(pg_temp.u(11), 'cash', -8, 'eat', 'x'), public.ledger_once(pg_temp.u(11), 'cash', -40, 'groceries', 'x');
insert into public.skill_log (player_id, skill, key) values (pg_temp.u(11), 'cooking', 'test');
insert into public.bills (player_id, kind, amount, due_date, status, paid_at) values (pg_temp.u(11), 'phone', 10, public.ny_today(), 'paid', now());
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(public.guide_state() -> 'ready' @> '["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]', 'every Chapter 2 step ready');
select public.guide_claim(s) from unnest(array['2.1', '2.2', '2.3', '2.4', '2.5', '2.6']) s;
select pg_temp.assert(public.guide_state() -> 'chapters' @> '[1, 2]', 'chapter 2 paid');
reset role;
select pg_temp.assert(pg_temp.paid('guide_chapter', pg_temp.u(11), 'cash') = 500 + 300, 'chapter 2 pays C$300');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.u(11) and badge_id = 'guide-2'), 'Adulting (Allegedly)');

-- ---- Chapter 3: gigs, shifts, a career, a business and the Jobs board ----
insert into auth.users (id) select pg_temp.u(12);
set role authenticated;
select pg_temp.as_(pg_temp.u(12)::text);
select public.create_player('Client', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
select pg_temp.as_(pg_temp.u(11)::text);
select public.guide_seen(s) from unnest(array['3.1', '3.4']) s;
reset role;
select public.ledger_once(pg_temp.u(11), 'cash', 50, 'gig', 'x'), public.ledger_once(pg_temp.u(11), 'cash', 50, 'shift', 'x'),
       public.ledger_once(pg_temp.u(11), 'cash', 500, 'career_pay', 'x');
insert into public.aspirations (player_id, aspiration) values (pg_temp.u(11), 'hustler');
insert into public.careers (id, player_id, track, last_work_day, state) values (gen_random_uuid(), pg_temp.u(11), 'hospitality', public.ny_today(), '{}');
insert into public.player_facts (player_id, key, subject) values (pg_temp.u(11), 'career.helped', 'hospitality:friend');
insert into public.player_businesses (player_id, business_id, bought_at, collected_at) values (pg_temp.u(11), 'test', now(), now());
insert into public.jobs (poster, kind, worker, status) values (pg_temp.u(12), 'decorator', pg_temp.u(11), 'active');
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(public.guide_state() -> 'ready' @> '["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11"]', 'every Chapter 3 step ready');
select public.guide_claim(s) from unnest(array['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11']) s;
select pg_temp.assert(public.guide_state() -> 'chapters' @> '[1, 2, 3]', 'chapter 3 paid');
select pg_temp.as_(pg_temp.u(12)::text);
select pg_temp.assert(public.guide_state() -> 'ready' ? '3.11', 'posting a job counts too');

-- ---- Chapter 4: a club, VIP, a place's activity, a hunt clue, a post, a calendar event, the Pass, a shoutout ----
select pg_temp.as_(pg_temp.u(11)::text);
select public.guide_seen('4.1');
reset role;
select public.ledger_once(pg_temp.u(11), 'clout', 5, k, 'x') from unnest(array['vip', 'place_life', 'story_read', 'calendar', 'season_free']) k;
insert into public.hunts (id, week, data) values ('guide-test', '2031-01-04', '{}');
insert into public.hunt_progress (player_id, hunt_id, style, step) values (pg_temp.u(11), 'guide-test', 'bodega_drip', 1);
insert into public.radio_shoutouts (player_id, handle, message, ny_date, owner_confirmed) values (pg_temp.u(11), 'guided', 'Hello Queens', public.ny_today(), true);
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(public.guide_state() -> 'ready' @> '["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8"]', 'every Chapter 4 step ready');
select public.guide_claim(s) from unnest(array['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8']) s;
select pg_temp.assert(public.guide_state() -> 'chapters' @> '[4]', 'chapter 4 paid');

-- ---- Chapter 5: a layout with a bought piece, a build plan with a garden, a move up, hosting ----
select pg_temp.assert(not (public.guide_state() -> 'ready' ? '5.1'), 'no layout yet');
select public.guide_seen(s) from unnest(array['5.3', '5.6', '5.8']) s;
reset role;
update public.players set home_layout = '[{"id":"item:1","x":0,"z":0,"rot":0}]', moved_up = true,
  home_plan = '{"v":1,"home":"astoria_studio","floors":{"out":{"rooms":[],"pieces":[{"id":"p1","k":"tree","x":0,"z":0,"rot":0}]}}}'
  where id = pg_temp.u(11);
insert into public.visits (host, kind, home_id, starts_at, ends_at, capacity, ny_date) values (pg_temp.u(11), 'hang', 'astoria_studio', now(), now() + interval '1 hour', 4, public.ny_today());
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(public.guide_state() -> 'ready' @> '["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9"]', 'every Chapter 5 step ready');
select public.guide_claim(s) from unnest(array['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9']) s;
select pg_temp.assert(public.guide_state() -> 'chapters' @> '[5]', 'chapter 5 paid');
rollback;
