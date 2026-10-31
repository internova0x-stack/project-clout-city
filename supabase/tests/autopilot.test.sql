-- Scenario test for migration 0107 (autopilot: the switches, stories starting one after another, Tea held while paused).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.arc(p_id text, p_days int) returns void language sql as $$
  select public.admin_story_upsert(jsonb_build_object('id', p_id, 'title', p_id, 'type', 'main', 'tier', 'free', 'status', 'active',
    'beats', (select jsonb_agg(jsonb_build_object('id', p_id || '-' || d, 'day', d, 'news', jsonb_build_array(jsonb_build_object('headline', 'Day ' || d)), 'effects', '[]'::jsonb))
                from generate_series(1, p_days) d)))
$$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000009101'), ('00000000-0000-0000-0000-000000009102');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000009101');
-- Only this test's stories.
update public.story_arcs set status = 'retired';

-- Every kind is on by default.
select pg_temp.assert(public.autopilot() = '{"news": true, "hunts": true, "gossip": true, "stories": true}'::jsonb, 'all on');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009102', false);
select pg_temp.assert(pg_temp.raises($$select public.admin_autopilot_set('news', false)$$, 'not_admin'), 'admins only');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009101', false);
select pg_temp.assert(pg_temp.raises($$select public.admin_autopilot_set('weather', false)$$, 'bad_kind'), 'kinds checked');
-- Three stories in the Studio's order: b first, then a, then c. c is declined.
select pg_temp.arc('auto-a', 3); select pg_temp.arc('auto-b', 2); select pg_temp.arc('auto-c', 2);
select public.admin_story_reorder(array['auto-b', 'auto-a', 'auto-c']);
select public.admin_story_review('auto-c', 'declined', 'not this one');
reset role;

-- Paused: nothing starts.
update public.game_settings set value = value || '{"stories": false}' where key = 'autopilot';
select pg_temp.assert(public.story_autopilot('2031-01-04') is null, 'paused: nothing starts');
update public.game_settings set value = value || '{"stories": true}' where key = 'autopilot';

-- Migration 0137: only on a Saturday (or the Sunday after), Day 1 that Saturday; Friday is the veto window.
select pg_temp.assert(public.story_autopilot('2031-01-03') is null, 'not on a Friday');
select pg_temp.assert(public.story_autopilot('2031-01-07') is null, 'not mid-week');

-- On: the first in the list starts on the Saturday, approved; while it runs nothing else starts.
select pg_temp.assert(public.story_autopilot('2031-01-05') = 'auto-b', 'first in order starts (the Sunday after counts)');
select pg_temp.assert((select review_status = 'approved' and start_at = '2031-01-04' from public.story_arcs where id = 'auto-b'), 'approved, Day 1 the Saturday');
select pg_temp.assert(public.story_autopilot('2031-01-05') is null, 'one story at a time');

-- When it has ended, the next one starts the next Saturday; a declined story never does.
select pg_temp.assert(public.story_autopilot('2031-01-11') = 'auto-a', 'next after the end, on a Saturday');
select pg_temp.assert((select start_at = '2031-01-11' from public.story_arcs where id = 'auto-a'), 'Day 1 that Saturday');
select pg_temp.assert(public.story_autopilot('2031-01-25') is null, 'declined never starts, and nothing is left');

-- A story paused mid-run keeps the slot.
select pg_temp.arc('auto-d', 2);
update public.story_arcs set start_at = '2031-01-31', review_status = 'approved', status = 'paused' where id = 'auto-a';
select pg_temp.assert(public.story_autopilot('2031-02-01') is null, 'paused mid-run keeps the slot');

-- Hunts may start on a Saturday (and on a Monday, for the weeks before the switch), never another day.
select pg_temp.assert(pg_temp.raises($$insert into public.hunts (id, week, data) values ('tue-hunt', '2031-01-07', '{}')$$,
  'new row for relation "hunts" violates check constraint "hunts_week_start"'), 'a Tuesday hunt is refused');
insert into public.hunts (id, week, data) values ('sat-hunt', '2031-01-04', '{}');

-- Tea: a new week arrives live; while paused, it waits for review.
select pg_temp.assert(public.gossip_import('{"week": "2031-01-06", "stories": []}'::jsonb) = 'new', 'imported');
select pg_temp.assert((select status from public.gossip_weeks where week = '2031-01-06') = 'approved', 'live while on');
update public.game_settings set value = value || '{"gossip": false}' where key = 'autopilot';
select pg_temp.assert(public.gossip_import('{"week": "2031-01-13", "stories": []}'::jsonb) = 'new', 'imported while paused');
select pg_temp.assert((select status from public.gossip_weeks where week = '2031-01-13') = 'review', 'waits for review while paused');

-- The Studio flips a switch.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009101', false);
select pg_temp.assert((public.admin_autopilot_set('hunts', false) ->> 'hunts')::boolean = false, 'switched off');
reset role;

\echo autopilot: ok
rollback;
