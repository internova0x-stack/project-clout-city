-- Daily tasks 2.0 (migration 0073): the goal ladder and its rewards, goal-linked tasks in the daily mix, streaks
-- (freeze, reset, day-3 clout, day-7 collectible, day-14 pass) and guest-list passes at the door and the VIP floor.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(p uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', p::text, false) $$;
-- A full task day, written straight into the ledger as complete_task would (ref: the New York date).
create function pg_temp.full_day(p uuid, d date) returns void language sql security definer as $$
  select public.ledger_once(p, 'cash', 100, 'daily_bonus', d::text) $$;
create function pg_temp.streak(p uuid) returns public.player_streaks language sql security definer as $$
  select * from public.player_streaks where player_id = p $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000073a1'), ('00000000-0000-0000-0000-0000000073a2');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select 1 from public.create_player('Goaldie', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select 1 from public.sync_player();
select pg_temp.as_('00000000-0000-0000-0000-0000000073a2');
select 1 from public.create_player('Streaky', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select 1 from public.sync_player();
reset role;

-- Browser access: the two RPCs for players only; the helpers for nobody.
select pg_temp.assert(not has_function_privilege('anon', 'public.goals_state()', 'execute'), 'anon: no goals_state');
select pg_temp.assert(not has_function_privilege('anon', 'public.use_guest_pass(text)', 'execute'), 'anon: no use_guest_pass');
select pg_temp.assert(has_function_privilege('authenticated', 'public.goals_state()', 'execute'), 'players: goals_state');
select pg_temp.assert(has_function_privilege('authenticated', 'public.use_guest_pass(text)', 'execute'), 'players: use_guest_pass');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.goal_settle(uuid)', 'execute'), 'goal_settle is internal');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.streak_tick(uuid, date)', 'execute'), 'streak_tick is internal');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.pass_tonight(uuid, text)', 'execute'), 'pass_tonight is internal');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.goal_current(uuid)', 'execute'), 'goal_current is internal');

-- The daily mix: five tasks, at most one gossip, two for the goal (first purchase: a shift and a shop), one skill.
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1') = 5, 'five tasks');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1' and kind = 'gossip') <= 1, 'one gossip at most');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1' and goal = 'first_purchase') = 2, 'two goal tasks');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1' and skill is not null) = 1, 'one skill task');
select pg_temp.assert((select count(distinct place_id) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1') = 5, 'no place twice');
select pg_temp.assert(exists (select 1 from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1' and goal is not null and kind = 'shift'), 'a shift for the cash');
select pg_temp.assert(exists (select 1 from public.daily_tasks d, jsonb_array_elements(public.city() -> 'places') p
                               where d.player_id = '00000000-0000-0000-0000-0000000073a1' and d.goal is not null and p ->> 'id' = d.place_id
                                 and p -> 'tags' ?| array['boutique', 'shopping']), 'and somewhere to spend it');
select pg_temp.assert((select bool_and(reward between 25 and 50) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a1' and goal is not null), 'ordinary cash rewards');

-- The goal: first purchase, a count; buying anything finishes it and pays 25 clout, once (0074's ladder).
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert(public.goals_state() -> 'goal' ->> 'id' = 'first_purchase', 'the game suggests the first purchase');
select pg_temp.assert(public.goals_state() -> 'goal' -> 'parts' = '[{"have": 0, "need": 1, "unit": "count"}]'::jsonb, 'progress as a count');
select pg_temp.assert(pg_temp.raises($$select public.buy_item('home-trophy-shelf')$$, 'reward_only'), 'streak rewards are not for sale');
select 1 from public.buy_item('home-plant');
select pg_temp.assert(public.goals_state() -> 'goal' ->> 'id' = 'first_shift', 'next: the first shift');
select pg_temp.assert(public.goals_state() -> 'done' = '["first_purchase"]'::jsonb, 'first purchase done');
create temp table c0 as select clout from public.players where id = auth.uid();
grant all on c0 to authenticated;
reset role;
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-0000000073a1' and kind = 'goal') = 1, 'goal reward paid once');
select pg_temp.assert((select amount from public.ledger where player_id = '00000000-0000-0000-0000-0000000073a1' and kind = 'goal' and ref = 'first_purchase') = 25, '25 clout');
select public.goal_settle('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert((select clout from public.players where id = '00000000-0000-0000-0000-0000000073a1') = (select clout from c0), 'settling again pays nothing');

-- 0074: the ladder is gated by clout. With the first chapter done and no clout, the game suggests reaching 100 clout
-- (the next chapter); at 500 clout, with the second chapter done too, pro gigs (clout and Confidence) come first,
-- before the better apartment, and its two tasks give Confidence or clout.
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, accepted_at, ready_at, collected_at)
values ('00000000-0000-0000-0000-0000000073a2', public.ny_today(), 'side', 'Test gig', 100, 10, 60, 0, now(), now(), now());
insert into public.ledger (player_id, currency, amount, kind, ref) values
  ('00000000-0000-0000-0000-0000000073a2', 'cash', -45, 'purchase', 'test'),
  ('00000000-0000-0000-0000-0000000073a2', 'cash', 120, 'shift', 'test'),
  ('00000000-0000-0000-0000-0000000073a2', 'cash', 100, 'daily_bonus', '2000-01-01');
update public.players set clout = 0, confidence = 0, bank_cash = 0 where id = '00000000-0000-0000-0000-0000000073a2';
select pg_temp.assert(public.goal_current('00000000-0000-0000-0000-0000000073a2') = '{"id": "next_chapter", "parts": [{"have": 0, "need": 100, "unit": "clout"}], "target": null}'::jsonb,
                      'chapter one done: reach 100 clout next');
select pg_temp.assert(not ((select g from jsonb_array_elements(public.goal_list('00000000-0000-0000-0000-0000000073a2')) g where g ->> 'id' = 'own_home') ->> 'done')::boolean, 'no home yet');
select pg_temp.assert((select (g ->> 'unlock')::int from jsonb_array_elements(public.goal_list('00000000-0000-0000-0000-0000000073a2')) g where g ->> 'id' = 'own_home') = 15000, 'a home is a long-run goal');
insert into public.ledger (player_id, currency, amount, kind, ref) values
  ('00000000-0000-0000-0000-0000000073a2', 'clout', 0, 'goal', 'first_crew'),
  ('00000000-0000-0000-0000-0000000073a2', 'clout', 0, 'goal', 'skill_3');
update public.players set clout = 500, bank_cash = 16000 where id = '00000000-0000-0000-0000-0000000073a2';
select pg_temp.assert(public.goal_current('00000000-0000-0000-0000-0000000073a2') ->> 'id' = 'pro_gigs', 'pro gigs before the apartment');
select pg_temp.assert((select jsonb_agg(pt ->> 'unit') from jsonb_array_elements(public.goal_current('00000000-0000-0000-0000-0000000073a2') -> 'parts') pt)
                      = '["clout", "confidence"]'::jsonb, 'clout and Confidence parts');
select pg_temp.assert((select (pt ->> 'need')::int from jsonb_array_elements(public.goal_current('00000000-0000-0000-0000-0000000073a2') -> 'parts') pt where pt ->> 'unit' = 'clout')
                      = (public.city() -> 'economy' -> 'gigs' -> 'pro' ->> 'clout')::int, 'the pro gate from settings');
delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a2';
select public.ensure_daily('00000000-0000-0000-0000-0000000073a2');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a2' and goal = 'pro_gigs') = 2, 'two pro-gig tasks');
select pg_temp.assert((select bool_and(coalesce((a ->> 'confidence')::int, 0) > 0 or coalesce((a ->> 'clout')::int, 0) > 0)
                         from public.daily_tasks d, jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
                        where d.player_id = '00000000-0000-0000-0000-0000000073a2' and d.goal is not null and p ->> 'id' = d.place_id and a ->> 'id' = d.action_id),
                      'goal tasks give Confidence or clout');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000073a2') = 5, 'still five');
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-0000000073a2' and kind = 'goal' and amount > 0) = 5, 'five goals paid (four in chapter one, savings)');
select pg_temp.assert((select amount from public.ledger where player_id = '00000000-0000-0000-0000-0000000073a2' and kind = 'goal' and ref = 'save_15k') = 75, 'saving C$15,000 pays 75');
-- The hot dog cart: a business goal, its price as the cash part.
select pg_temp.assert((select g -> 'parts' -> 0 ->> 'need' from jsonb_array_elements(public.goal_list('00000000-0000-0000-0000-0000000073a2')) g where g ->> 'id' = 'first_business')::int = 5000, 'the cart costs C$5,000');

-- Streaks, from a Monday five weeks ago (d0). Mon, Tue, Wed: day 3 pays 50 clout.
create temp table d as select public.ny_week() - 35 as d0;
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + i) from d, generate_series(0, 2) i;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 3, 'three days in a row');
select pg_temp.assert((select amount from public.ledger, d where player_id = '00000000-0000-0000-0000-0000000073a1' and kind = 'streak' and ref = d0::text || ':3') = 50, 'day 3: 50 clout');
-- The same day again changes nothing.
select public.streak_tick('00000000-0000-0000-0000-0000000073a1', d0 + 2) from d;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 3, 'a day counts once');
-- Thursday missed: forgiven (this week's freeze). Friday makes 4.
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + 4) from d;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 4, 'one missed day is frozen');
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).freeze_week = (select d0 from d), 'the freeze is this week''s');
-- Saturday to next Monday: day 7, the first collectible, earned (never bought, never sold).
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + i) from d, generate_series(5, 7) i;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 7, 'day 7');
select pg_temp.assert((select acquired from public.player_items where player_id = '00000000-0000-0000-0000-0000000073a1' and sku = 'home-neon-five-sign') = 'earned', 'day 7: the neon sign, earned');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert(pg_temp.raises($$select public.buy_item('home-neon-five-sign')$$, 'reward_only'), 'still not for sale');
create temp table sign_id as select id from public.player_items where sku = 'home-neon-five-sign';
grant all on sign_id to authenticated;
select pg_temp.assert(pg_temp.raises($$select public.sell_item((select id from sign_id))$$, 'reward_unsellable'), 'and never sold back');
reset role;
-- Seven more days: day 14, a guest-list pass.
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + i) from d, generate_series(8, 14) i;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 14, 'day 14');
select pg_temp.assert((select count(*) from public.guest_passes where player_id = '00000000-0000-0000-0000-0000000073a1' and used_on is null) = 1, 'day 14: a pass');
select pg_temp.assert((select count(*) from public.player_items where player_id = '00000000-0000-0000-0000-0000000073a1' and acquired = 'earned') = 1, 'no second collectible yet');
-- A new week's freeze (Tuesday missed), then a second missed day that week: the streak starts again.
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + 16) from d;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 15, 'a new week, a new freeze');
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + 18) from d;
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).current = 1, 'a second missed day resets it');
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).best = 15, 'the best is kept');
select pg_temp.assert((pg_temp.streak('00000000-0000-0000-0000-0000000073a1')).started_on = (select d0 + 18 from d), 'a new run');
-- The new run pays its own day 3 (refs are per run).
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a1', d0 + i) from d, generate_series(19, 20) i;
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-0000000073a1' and kind = 'streak') = 2, 'day 3 again, in the new run');

-- What the Tasks sheet shows: an old streak reads as 0; yesterday and today make 2, with day 3 next.
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert((public.goals_state() -> 'streak' ->> 'current')::int = 0, 'an old streak is over');
select pg_temp.assert((public.goals_state() -> 'streak' ->> 'best')::int = 15, 'best streak shown');
select pg_temp.assert((public.goals_state() -> 'passes' ->> 'held')::int = 1, 'one pass held');
reset role;
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a2', public.ny_today() - 1);
select pg_temp.full_day('00000000-0000-0000-0000-0000000073a2', public.ny_today());
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a2');
select pg_temp.assert((public.goals_state() -> 'streak' ->> 'current')::int = 2 and (public.goals_state() -> 'streak' ->> 'today')::boolean, 'two days, today done');
select pg_temp.assert(public.goals_state() -> 'streak' -> 'next' = '{"day": 3, "reward": "clout"}'::jsonb, 'day 3 is next');
-- 0074, the Streaks section: the full days (New York dates) and the run's start; no rewards yet in this run.
select pg_temp.assert(public.goals_state() -> 'streak' -> 'days' = jsonb_build_array((public.ny_today() - 1)::text, public.ny_today()::text), 'the full days');
select pg_temp.assert(public.goals_state() -> 'streak' ->> 'startedOn' = (public.ny_today() - 1)::text, 'the run started yesterday');
select pg_temp.assert(public.goals_state() -> 'streak' -> 'rewards' = '[]'::jsonb, 'no rewards yet');
-- No pass: no list.
select pg_temp.assert(pg_temp.raises($$select public.use_guest_pass('ultraviolet-society')$$, 'no_pass'), 'no pass, no list');

-- Guest-list passes at the door: Ultraviolet Society wants 2,000 clout.
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert(pg_temp.raises($$select public.travel('ultraviolet-society', 'subway')$$, 'door_clout'), 'the bouncer says no');
select pg_temp.assert(pg_temp.raises($$select public.use_guest_pass('ditmars-deli')$$, 'not_a_club'), 'only clubs');
select pg_temp.assert(pg_temp.raises($$select public.use_guest_pass('the-sticky-floor')$$, 'pass_not_needed'), 'not where you can already get in');
reset role;
update public.borough_gates set opened_at = null where id = 'brooklyn';
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert(pg_temp.raises($$select public.use_guest_pass('ultraviolet-society')$$, 'borough_locked'), 'never a locked borough');
reset role;
update public.borough_gates set opened_at = now() where id = 'brooklyn';
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a1');
select pg_temp.assert(public.use_guest_pass('ultraviolet-society') -> 'passes' = '{"held": 0, "tonight": {"place": "ultraviolet-society"}}'::jsonb, 'on the list tonight');
select pg_temp.assert(public.travel('ultraviolet-society', 'subway') ->> 'place' = 'ultraviolet-society', 'and through the door');
select pg_temp.assert(pg_temp.raises($$select public.use_guest_pass('hellgate-hall')$$, 'pass_used_tonight'), 'one list a night');
reset role;
select pg_temp.assert(public.pass_tonight('00000000-0000-0000-0000-0000000073a1', 'ultraviolet-society'), 'pass active tonight');
select pg_temp.assert(not public.pass_tonight('00000000-0000-0000-0000-0000000073a1', 'hellgate-hall'), 'only for that place');

-- And at the VIP floor: Hellgate Hall's VIP is free from 5,000 clout; a pass gets Streaky up there tonight.
insert into public.guest_passes (player_id, earned_on) values ('00000000-0000-0000-0000-0000000073a2', public.ny_today());
select pg_temp.assert(public.vip_access('00000000-0000-0000-0000-0000000073a2', 'hellgate-hall') is null, 'no VIP before');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-0000000073a2');
select 1 from public.use_guest_pass('hellgate-hall');
reset role;
select pg_temp.assert(public.vip_access('00000000-0000-0000-0000-0000000073a2', 'hellgate-hall') = 'pass', 'VIP by pass');
select pg_temp.assert(public.vip_access('00000000-0000-0000-0000-0000000073a2', 'velvet-static') is null, 'not at other clubs');
-- Passes never pay cash.
select pg_temp.assert(not exists (select 1 from public.ledger where kind in ('streak', 'goal') and currency = 'cash'), 'no cash from goals or streaks');

rollback;
\echo 'DAILY GOALS CHECKS PASSED'
