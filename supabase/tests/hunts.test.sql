-- Scenario test for migration 0018 (treasure hunts).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
-- v0.8 (migration 0025): actions and events need the player at the place; these helpers put the
-- player there first, as if they had travelled.
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
-- 0049: a hunt line needs you at the place now.
create function pg_temp.talk(p_place text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place, arrives_at = null where id = auth.uid(); return public.hunt_talk(p_place); end $h$;
create function pg_temp.attend(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select x ->> 'placeId' from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_event)
   where id = auth.uid();
  return public.attend_event(p_event);
end $h$;
create function pg_temp.attend_x(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select place_id from public.exclusive_events where id = p_event) where id = auth.uid();
  return public.attend_exclusive_event(p_event);
end $h$;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000081'), ('00000000-0000-0000-0000-000000000082');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000081');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select 1 from public.create_player('hunter', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, bank_cash = 1000, clout = 0 where id = '00000000-0000-0000-0000-000000000082';

-- A small hunt for this week (the real files are checked by lib/hunts.ts before upload).
create temp table h as select jsonb_build_object(
  'id', 'test-hunt', 'week', date_trunc('week', public.ny_today())::date, 'theme', 'Test Hunt', 'intro', 'Find the test treasure, please.',
  'places', '["ditmars-deli", "ditmars-library", "engine-7", "hell-gate-park"]'::jsonb,
  'chatter', '["Looking for {treasure}?"]'::jsonb,
  'tracks', jsonb_build_object('arcade_nerd', jsonb_build_object('treasure', 'Cabinet Zero', 'emoji', '🕹️', 'lore', 'A chip from a game that never shipped.',
    'steps', jsonb_build_array(
      jsonb_build_object('say', 'Go to the library.'),
      jsonb_build_object('say', 'A question first.', 'question', jsonb_build_object('q', 'Which?', 'choices', '["A", "B"]'::jsonb, 'answer', 1), 'then', 'Go to the firehouse.'),
      jsonb_build_object('say', 'Gus has it, at the park.'),
      jsonb_build_object('say', 'Password?', 'question', jsonb_build_object('q', 'Password?', 'choices', '["Cabinet Zero", "Game Over"]'::jsonb, 'answer', 0), 'then', 'Yours.')
    )))) as data;
grant select on h to authenticated;

-- Players can't upload, approve or read the tables.
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.admin_hunt_upsert((select data from h))$$, 'not_admin'), 'a player uploaded a hunt');
select pg_temp.assert(pg_temp.raises($$select count(*) from public.hunts$$, 'permission denied'), 'a player read the hunts (answers)');
select pg_temp.assert(pg_temp.raises($$select count(*) from public.hunt_progress$$, 'permission denied'), 'a player read hunt progress');

-- Uploaded hunts wait for approval.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select public.admin_hunt_upsert((select data from h));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select pg_temp.assert(public.hunt_state() -> 'hunt' = 'null'::jsonb, 'nothing shows before approval');
select pg_temp.assert(pg_temp.raises($$select public.hunt_join()$$, 'no_hunt'), 'can''t join an unapproved hunt');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select public.admin_hunt_status('test-hunt', 'approved');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select pg_temp.assert(public.hunt_state() -> 'hunt' ->> 'joined' = 'false' and public.hunt_state() -> 'hunt' ->> 'firstPlace' = 'ditmars-deli', 'approved: shows, not joined, step 1 named');
select pg_temp.assert(pg_temp.raises($$select public.hunt_talk('ditmars-deli')$$, 'not_here'), 'regulars say nothing hunt-related before joining');

-- Join: the track is the player's starting style.
select pg_temp.assert(public.hunt_join() -> 'hunt' -> 'track' ->> 'treasure' = 'Cabinet Zero', 'joined the arcade_nerd track');
select pg_temp.assert(public.hunt_state() -> 'hunt' -> 'chatter' ->> 0 = 'Looking for Cabinet Zero?', 'chatter names the treasure');
select pg_temp.assert(pg_temp.raises($$select public.hunt_talk('engine-7')$$, 'not_here'), 'wrong place');
select pg_temp.assert(pg_temp.raises($$select pg_temp.talk('ditmars-deli')$$, 'visit_first'), 'must visit first');

-- Step 1: visit the deli (normal cost), talk.
select 1 from pg_temp.act('ditmars-deli', 'eat');
select pg_temp.assert(pg_temp.talk('ditmars-deli') -> 'line' ->> 'say' = 'Go to the library.', 'step 1 clue');
select pg_temp.assert((public.hunt_state() -> 'hunt' ->> 'step')::int = 1, 'a step without a question is done once heard');

-- Step 2: a question. Wrong waits 10 minutes; answers never reach the player.
select 1 from pg_temp.act('ditmars-library', 'study');
select pg_temp.assert(pg_temp.talk('ditmars-library') -> 'line' -> 'question' ->> 'q' = 'Which?', 'step 2 asks');
select pg_temp.assert(public.hunt_state()::text not like '%"answer"%', 'no answer key in the state');
select pg_temp.assert(pg_temp.talk('ditmars-library') -> 'line' -> 'question' is not null, 'talking again repeats the question');
select pg_temp.assert(public.hunt_answer(0) ->> 'correct' = 'false', 'wrong answer');
select pg_temp.assert(public.hunt_state() -> 'hunt' -> 'question' ->> 'retryAt' is not null, 'retry time shown');
select pg_temp.assert(pg_temp.raises($$select public.hunt_answer(1)$$, 'wait'), 'must wait 10 minutes');
reset role;
update public.hunt_progress set wrong_at = now() - interval '11 minutes' where player_id = '00000000-0000-0000-0000-000000000082';
set role authenticated;
select pg_temp.assert(public.hunt_answer(1) ->> 'then' = 'Go to the firehouse.', 'right answer gives the next clue');

-- Step 3, then the finale; three earlier hunt cards make this the fourth (badge).
select 1 from pg_temp.act('engine-7', 'pet-dog');
select 1 from pg_temp.talk('engine-7');
select 1 from pg_temp.act('hell-gate-park', 'hangout');
select 1 from pg_temp.talk('hell-gate-park');
reset role;
insert into public.hunt_cards (player_id, hunt_id, week, theme, treasure, emoji, lore)
select '00000000-0000-0000-0000-000000000082', 'old-' || i, current_date - 7 * i, 'Old', 'Old thing', '📦', 'An older treasure.' from generate_series(1, 3) i;
set role authenticated;
create temp table fin as select public.hunt_answer(0) r;
select pg_temp.assert((select r -> 'reward' = jsonb_build_object('cash', 1080, 'clout', 250, 'badge', true) from fin), 'finale pays cash, clout and the badge');
select pg_temp.assert(public.hunt_state() -> 'hunt' ->> 'completedAt' is not null and (public.hunt_state() ->> 'completed')::int = 4, 'completed; four cards');
select pg_temp.assert(public.hunt_state() -> 'cards' -> 0 ->> 'treasure' = 'Cabinet Zero', 'the new card leads the Collection');
select pg_temp.assert(jsonb_array_length(public.hunt_state() -> 'hunt' -> 'heard') = 4, 'all four lines kept');
select pg_temp.assert(pg_temp.raises($$select public.hunt_answer(0)$$, 'not_here'), 'no second payout');
reset role;
select pg_temp.assert((select sum(amount) filter (where currency = 'cash') = 1080 and sum(amount) filter (where currency = 'clout') = 250
                         from public.ledger where player_id = '00000000-0000-0000-0000-000000000082' and kind = 'hunt'), 'paid once (daily tasks may pay too, so check the hunt rows)');
select pg_temp.assert((select count(*) = 2 from public.ledger where player_id = '00000000-0000-0000-0000-000000000082' and kind = 'hunt'), 'one cash and one clout ledger row');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = '00000000-0000-0000-0000-000000000082' and badge_id = 'treasure-hunter'), 'badge');

-- Studio: stats; unchanged re-upload stays approved, edits are refused once joined; pause hides.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', false);
select pg_temp.assert(public.admin_hunt_list() -> 0 ->> 'joined' = '1' and public.admin_hunt_list() -> 0 ->> 'completed' = '1', 'joins and finishes counted');
select public.admin_hunt_upsert((select data from h));
select pg_temp.assert(public.admin_hunt_list() -> 0 ->> 'status' = 'approved', 'unchanged stays approved');
-- Since migration 0019 a hunt players have joined can't be edited (their steps would break).
select pg_temp.assert(pg_temp.raises($$select public.admin_hunt_upsert((select jsonb_set(data, '{theme}', '"Edited"') from h))$$, 'hunt_in_play'), 'no edits once joined');
select public.admin_hunt_status('test-hunt', 'paused');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select pg_temp.assert(public.hunt_state() -> 'hunt' = 'null'::jsonb and (public.hunt_state() ->> 'completed')::int = 4, 'paused hides the hunt; cards stay');

rollback;
\echo HUNT CHECKS PASSED
