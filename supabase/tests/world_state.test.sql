-- Scenario test for migration 0007 (World State, "Who Killed Sarah Bird?"): story
-- management, then all 10 days on the staging clock. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
-- v0.8 (migration 0025): actions and events need the player at the place; these helpers put the
-- player there first, as if they had travelled.
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
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

create function pg_temp.mult(p_name text) returns numeric language sql security definer as $$
  select public.clout_multiplier(mood, confidence) from public.players where display_name = p_name $$;

-- Jump the game clock to a New York time on a story day of the pilot.
create function pg_temp.go(p_day int, p_time text default '12:00') returns void language plpgsql security definer as $$
declare s date := (select start_at from public.story_arcs where id = 'sarah-bird');
begin
  update public.game_settings
     set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb(floor(extract(epoch from (public.story_time(s, p_day, p_time) - now())))::bigint))
   where key = 'dev';
end $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000030'), ('00000000-0000-0000-0000-000000000031'), ('00000000-0000-0000-0000-000000000032');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000032');
update public.game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000030', false);
select 1 from public.create_player('Ivy', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);
select 1 from public.create_player('Jun', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 5000, energy = 100, mood = 50, confidence = 50 where display_name in ('Ivy', 'Jun');

-- ---- Before the pilot starts: loaded, approved, invisible ----
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000030', false);
select pg_temp.assert(jsonb_array_length(public.story_feed() -> 'arcs') = 0, 'no story before the start date');
do $$ begin
  begin perform pg_temp.act('skyline-pier', 'lobby'); raise exception 'FAIL: story place before start';
  exception when sqlstate '22023' then null; end;
  begin perform public.admin_story_list(); raise exception 'FAIL: non-admin listed stories';
  exception when sqlstate '42501' then null; end;
end $$;

-- ---- Story management: approval gate, weekday, past dates, pause ----
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', false);
select pg_temp.assert(jsonb_array_length(public.admin_story_list()) = 4, 'admin sees four arcs');
select public.admin_story_review('sarah-bird', 'declined', 'Needs a lighter Day 6');
do $$ begin
  begin perform public.admin_story_schedule('sarah-bird', public.ny_today() + 7); raise exception 'FAIL: scheduled a declined arc';
  exception when sqlstate '22023' then null; end;
end $$;
select public.admin_story_review('sarah-bird', 'approved', null);
do $$
declare next_sunday date := public.ny_today() + ((7 - extract(dow from public.ny_today())::int) % 7) + 7;
begin
  begin perform public.admin_story_schedule('sarah-bird', next_sunday + 1); raise exception 'FAIL: scheduled on a Monday';
  exception when sqlstate '22023' then null; end;
  begin perform public.admin_story_schedule('sarah-bird', next_sunday - 14); raise exception 'FAIL: scheduled in the past';
  exception when sqlstate '22023' then null; end;
  perform public.admin_story_schedule('sarah-bird', next_sunday);
  perform public.admin_story_schedule('sarah-bird', null);
end $$;

-- ---- Day 1 (staging start) ----
select 1 from public.dev_story_start('sarah-bird', public.ny_today());
select pg_temp.go(1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000030', false);
select public.story_feed() as f1 \gset
select pg_temp.assert(jsonb_array_length((:'f1'::jsonb) -> 'arcs') = 4, 'pilot and three side arcs live');
select pg_temp.assert(position('answer_key' in :'f1') = 0 and position('pastor-vale' in :'f1') = 0, 'no answers in the feed');
select pg_temp.assert(((:'f1'::jsonb) -> 'arcs' -> 0 -> 'beats' -> 0 ->> 'headline') = 'Queens'' Glass Bird Goes Quiet', 'beat 1 released');
select pg_temp.assert(((:'f1'::jsonb) #>> '{arcs,1,beats,0,locked}')::boolean and (:'f1'::jsonb) #> '{arcs,1,beats,0,body}' is null, 'side arcs locked without the sku');
select pg_temp.assert(((:'f1'::jsonb) #>> '{chatter,0,phase}') = 'early', 'chatter early');
do $$ begin
  begin perform pg_temp.act('skyline-pier', 'memorial'); raise exception 'FAIL: memorial before Day 10';
  exception when sqlstate '22023' then null; end;
end $$;
select (pg_temp.act('skyline-pier', 'lobby') -> 'storyTasks' -> 0 ->> 'clout')::int as flowers \gset
select pg_temp.assert(:flowers = 20, 'leave flowers pays 20');

-- ---- Day 2: the vigil ----
select pg_temp.go(2);
select (public.attend_story_event('sb-vigil') -> 'storyTasks' -> 0 ->> 'id') as candle \gset
select pg_temp.assert(:'candle' = 'story:sarah-bird:light-candle', 'candle task');
do $$ begin
  begin perform public.attend_story_event('sb-vigil'); raise exception 'FAIL: vigil twice';
  exception when sqlstate '22023' then null; end;
end $$;

-- ---- Day 3: diner crowds (+50% price, clout from base), P1 opens, share task ----
select pg_temp.go(3);
select bank_cash as before_diner from public.players where display_name = 'Ivy' \gset
select pg_temp.mult('Ivy') as mult_before \gset
select pg_temp.act('rockaway-diner', 'eat') as diner \gset
select pg_temp.assert((select bank_cash from public.players where display_name = 'Ivy') = :before_diner - 48, 'diner costs 32 x 1.5 = 48');
select pg_temp.assert(((:'diner'::jsonb) ->> 'clout')::int = round((5 + 32 * 0.25) * :mult_before), 'clout from the base price');
select 1 from public.vote_prediction('P1', 'confront');
select pg_temp.assert(((public.story_feed() #> '{arcs,0,predictions,0,results,total}'))::int = 1, 'live results after voting');
select 1 from public.complete_story_task('story:sarah-bird:share-rumor');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);
select pg_temp.assert(public.story_feed() #> '{arcs,0,predictions,0,results}' is null, 'no results before you vote');

-- ---- Day 4: change a vote until the end of the day; then voting closes ----
select pg_temp.go(4, '23:58');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000030', false);
select 1 from public.vote_prediction('P1', 'apologize');
select pg_temp.assert(((public.story_feed() #>> '{chatter,0,phase}')) = 'mid', 'chatter mid on Day 4');
select pg_temp.go(5, '00:01');
do $$ begin
  begin perform public.vote_prediction('P1', 'confront'); raise exception 'FAIL: voted after close';
  exception when sqlstate '22023' then null; end;
end $$;

-- ---- Day 5: P1 revealed and paid once ----
select public.story_feed() as f5 \gset
select pg_temp.assert(((:'f5'::jsonb) #>> '{arcs,0,predictions,0,correct}') = 'apologize', 'P1 revealed');
select 1 from public.story_feed();
select pg_temp.assert((select count(*) from public.ledger l join public.players p on p.id = l.player_id
                        where p.display_name = 'Ivy' and l.kind = 'prediction') = 1, 'P1 paid once');

-- ---- Day 6: hoodie drop, P2 opens ----
select pg_temp.go(6);
select pg_temp.assert(position('"correct"' in (public.story_feed() #>> '{arcs,0,predictions,1}')) = 0, 'P2 correct answer hidden while open');
select 1 from public.buy_item('forever-our-bird-hoodie');
select 1 from public.vote_prediction('P2', 'pastor-vale');

-- ---- Day 7: P3 opens and closes the same day ----
select pg_temp.go(7);
select 1 from public.vote_prediction('P3', 'radiant-harbor');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);
select 1 from public.vote_prediction('P2', 'jett');

-- ---- Day 8: voting closed, late chatter, no answer yet ----
select pg_temp.go(8);
do $$ begin
  begin perform public.vote_prediction('P2', 'loretta'); raise exception 'FAIL: voted on Day 8';
  exception when sqlstate '22023' then null; end;
end $$;
select public.story_feed() as f8 \gset
select pg_temp.assert(((:'f8'::jsonb) #>> '{chatter,0,phase}') = 'late', 'chatter late');
select pg_temp.assert(((:'f8'::jsonb) #>> '{arcs,0,predictions,1,state}') = 'closed', 'P2 closed');
select pg_temp.assert((:'f8'::jsonb) #> '{arcs,0,predictions,1,correct}' is null, 'P2 not revealed on Day 8');

-- ---- Day 9: the reveal, rewards and badges; the church closes ----
select pg_temp.go(9);
select public.story_feed() as f9 \gset
select pg_temp.assert(((:'f9'::jsonb) #>> '{arcs,0,predictions,1,roast}') like 'You picked Jett.%', 'Jun gets roasted');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000030', false);
select public.story_feed() as f9b \gset
select pg_temp.assert(((:'f9b'::jsonb) #>> '{arcs,0,predictions,1,correct}') = 'pastor-vale', 'P2 revealed');
select pg_temp.assert((select count(*) from public.player_badges b join public.players p on p.id = b.player_id where p.display_name = 'Ivy') = 2,
  'Called It and Lola''s Favorite');
do $$ begin
  begin perform pg_temp.act('radiant-harbor', 'visit'); raise exception 'FAIL: church open on Day 9';
  exception when sqlstate '22023' then null; end;
end $$;
select 1 from pg_temp.act('skyline-pier', 'lobby'); -- restriction lifted

-- ---- Day 10: memorial wall; hoodie gone from the Shop but kept by buyers ----
select pg_temp.go(10);
select (pg_temp.act('skyline-pier', 'memorial') ->> 'clout')::int as memorial \gset
select pg_temp.assert(:memorial = 10, 'memorial pays 10');
select pg_temp.assert((select count(*) from public.player_items i join public.players p on p.id = i.player_id
                        where p.display_name = 'Ivy' and i.sku = 'forever-our-bird-hoodie') = 1, 'hoodie kept');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);
do $$ begin
  begin perform public.buy_item('forever-our-bird-hoodie'); raise exception 'FAIL: hoodie on Day 10';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.assert(((public.story_feed() #>> '{chatter,0,phase}')) = 'post', 'chatter post');

-- ---- Day 11: archive and shadow guesses ----
select pg_temp.go(11);
select pg_temp.assert((public.shadow_guess('P3', 'radiant-harbor') ->> 'right')::boolean, 'shadow guess right');
select pg_temp.assert(exists (select 1 from public.player_badges b join public.players p on p.id = b.player_id
                               where p.display_name = 'Jun' and b.badge_id = 'armchair-detective'), 'shadow badge');
do $$ begin
  begin perform public.shadow_guess('P2', 'theo'); raise exception 'FAIL: shadow guess after a real vote';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.assert((public.story_feed() #>> '{arcs,0,finished}')::boolean, 'arc archived');

-- ---- Pause and retire switches (admin) ----
select pg_temp.go(4);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', false);
select public.admin_beat_status('sarah-bird', 'sb-3', 'paused');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);
select pg_temp.assert(not ((public.story_feed() -> 'arcs' -> 0 -> 'beats') @> '[{"id": "sb-3"}]'), 'paused beat hidden');
select pg_temp.assert(not ((public.story_feed() -> 'effects') @> '[{"beat": "sb-3"}]'), 'paused beat effects off');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', false);
select public.admin_story_status('sarah-bird', 'paused');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);
select pg_temp.assert(jsonb_array_length(public.story_feed() -> 'arcs') = 0, 'paused arc (and its side arcs) hidden');

-- ---- Clout always matches the ledger ----
reset role;
select pg_temp.assert(bool_and(p.clout = coalesce((select sum(amount) from public.ledger l where l.player_id = p.id and l.currency = 'clout'), 0)),
  'clout matches the ledger') from public.players p where p.display_name in ('Ivy', 'Jun');
update public.game_settings set value = '{"tools": false, "clockOffsetSeconds": 0}' where key = 'dev';
select 'WORLD STATE CHECKS PASSED' as result;
