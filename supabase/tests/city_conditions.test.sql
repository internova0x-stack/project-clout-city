-- Scenario test for migration 0140 (the city reacts): players can't read or write conditions but can see what's on;
-- a weekly condition waits for its window, then its prices, doors and notes join world_effects() (never story machinery);
-- a veto ends it; a city storylet fires once when the tallies cross its line (with a cooldown) and posts a city headline;
-- a player's first big win posts a 🏆 line in the Blotter, never for News opt-outs. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000140' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.on_now(p_id text) returns boolean language sql as $$
  select coalesce((select (c ->> 'now')::boolean from jsonb_array_elements(public.city_conditions_now()) c where c ->> 'id' = p_id), false)
$$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 3) n;
insert into public.story_admins (user_id) values (pg_temp.u(3));
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Winner', 'Shy'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
reset role;
update public.players set news_opt_out = true where id = pg_temp.u(2);

-- ---- Private: players see what's on, never the table or the server's functions ----
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform 1 from public.city_conditions; raise exception 'FAIL: city_conditions readable';
  exception when insufficient_privilege then null; end;
  begin perform public.city_react('[]'); raise exception 'FAIL: city_react callable';
  exception when insufficient_privilege then null; end;
  begin perform public.content_import_conditions('2031-01-06', '[]'); raise exception 'FAIL: content_import_conditions callable';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert(public.city_conditions_now() = '[]'::jsonb, 'nothing on yet');
select pg_temp.assert(pg_temp.raises($$select public.admin_conditions()$$, 'not_admin'), 'the Studio list is admins only');
reset role;

-- ---- A weekly condition: waits for its window, then changes prices, doors and notes ----
select pg_temp.assert(public.content_import_conditions('2031-01-06', jsonb_build_array(jsonb_build_object(
  'id', 'heat-test', 'kind', 'heatwave', 'emoji', '🥵', 'title', 'Hot', 'blurb', 'Very hot.',
  'startsAt', now() - interval '1 hour', 'endsAt', now() + interval '10 hours',
  'effects', jsonb_build_array(
    jsonb_build_object('type', 'price_multiplier', 'tags', jsonb_build_array('rooftop'), 'applies_to', 'visit_price', 'multiplier', 1.3, 'reason', 'Heatwave'),
    jsonb_build_object('type', 'availability', 'tags', jsonb_build_array('lounge'), 'state', 'closed', 'reason', 'Brownout'),
    jsonb_build_object('type', 'place_state', 'place', 'hell-gate-park', 'spawn_event', 'nope'),
    jsonb_build_object('type', 'flag', 'set', 'never'))))) = 1, 'one new condition');
select pg_temp.assert((select multiplier from public.story_price('["rooftop"]', 'visit_price')) = 1, 'not during its window');
select pg_temp.assert(not pg_temp.on_now('heat-test'), 'not shown during its window');
update public.city_conditions set live_at = now() - interval '1 minute' where id = 'heat-test';
select pg_temp.assert((select multiplier from public.story_price('["rooftop"]', 'visit_price')) = 1.3, 'rooftops cost more in the heatwave');
select pg_temp.assert((select state from public.story_availability('["lounge"]', null)) = 'closed', 'lounges closed');
select pg_temp.assert(not public.story_flag('never'), 'conditions never set story flags');
select pg_temp.assert(not exists (select 1 from public.world_effects() where effect ? 'spawn_event' and arc_id like 'condition:%'), 'never spawn story events');
select pg_temp.assert(pg_temp.on_now('heat-test'), 'players see it on');
select pg_temp.assert(public.content_import_conditions('2031-01-06', jsonb_build_array(jsonb_build_object(
  'id', 'heat-test', 'kind', 'heatwave', 'emoji', '🥵', 'title', 'Changed', 'blurb', 'x', 'startsAt', now(), 'endsAt', now() + interval '2 hours'))) = 0,
  'a stored condition is never touched');

-- The Studio ends it early.
set role authenticated;
select pg_temp.as_(pg_temp.u(3)::text);
select pg_temp.assert(jsonb_array_length(public.admin_condition_set('heat-test', 'veto')) >= 1, 'vetoed');
reset role;
select pg_temp.assert((select multiplier from public.story_price('["rooftop"]', 'visit_price')) = 1, 'a veto ends its effects');
select pg_temp.assert(not pg_temp.on_now('heat-test'), 'and it leaves News');

-- ---- A city storylet: the tallies cross the line, once per cooldown ----
insert into public.world_tally (key, subject, day, count) values ('career.took_credit', 'tech:rival', public.ny_today(), 5), ('career.took_credit', 'tech:friend', public.ny_today() - 2, 4),
  ('career.took_credit', 'media:rival', public.ny_today(), 50);
create temp table rules as select jsonb_build_array(jsonb_build_object(
  'id', 'hr-test', 'key', 'career.took_credit', 'subjectStarts', 'tech:', 'days', 7, 'min', 10, 'cooldownDays', 14,
  'headline', '📋 HR is reading the Slack.',
  'condition', jsonb_build_object('kind', 'hr_crackdown', 'subject', 'tech', 'emoji', '📋', 'title', 'HR crackdown', 'blurb', 'Careful.', 'hours', 168,
    'effects', jsonb_build_array(jsonb_build_object('type', 'place_state', 'place', 'triborough-works', 'note', 'HR is watching.'))))) as r;
select pg_temp.assert(cardinality(public.city_react((select r from rules))) = 0, '9 at Tech is under the line (Media''s 50 don''t count)');
update public.world_tally set count = 6 where key = 'career.took_credit' and subject = 'tech:rival';
select pg_temp.assert(cardinality(public.city_react((select r from rules))) = 1, 'fires at 10');
select pg_temp.assert((select bool_and(c ->> 'kind' = 'hr_crackdown' and (c ->> 'now')::boolean and c ->> 'source' = 'reaction')
                         from jsonb_array_elements(public.city_conditions_now()) c where c ->> 'id' like 'hr-test-%'), 'on at once, from the city');
select pg_temp.assert(cardinality(public.city_react((select r from rules))) = 0, 'once per cooldown');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.choice_blotter()) b where b ->> 'kind' = 'city' and b ->> 'text' like '%Slack%'), 'Lola posts the city headline');

-- ---- Players in each other's News ----
select public.fact_note(pg_temp.u(1), 'campaign.won', 'starr');
select public.fact_note(pg_temp.u(1), 'campaign.won', 'starr');
select public.fact_note(pg_temp.u(2), 'campaign.won', 'goldcrest');
select pg_temp.assert((select count(*) = 1 from jsonb_array_elements(public.choice_blotter()) b where b ->> 'kind' = 'win'), 'one 🏆 line: the first win, and never for a News opt-out');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.choice_blotter()) b where b ->> 'text' like '%@Winner%City Hall%'), 'it names the winner');

rollback;
