-- Scenario test for migration 0057 (Real Clout FM: shoutout requests, the daily list, the Studio queue).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000a' || n)::uuid $$;

insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 4) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('fmplayer1', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('fmplayer2', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('fmplayer3', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(4); select 1 from public.create_player('fmplayer4', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
-- A short list for the test: 3 a day.
update public.game_settings set value = value || '{"dailyCap": 3}'::jsonb where key = 'radio';

set role authenticated; select pg_temp.as_(2);
select pg_temp.assert((public.radio_state() ->> 'left')::int = 3, '3 places on today''s list');
select pg_temp.assert(public.radio_state() -> 'onAir' = 'null'::jsonb, 'nothing on air yet');

-- The handle must be confirmed, valid, and the message short, untagged.
select pg_temp.assert(pg_temp.raises($$select public.radio_request('mia.k', 'hi Queens', false)$$, 'confirm_handle'), 'handle confirmed');
select pg_temp.assert(pg_temp.raises($$select public.radio_request('mia k!', 'hi Queens', true)$$, 'bad_handle'), 'handle checked');
select pg_temp.assert(pg_temp.raises($$select public.radio_request('mia.k', repeat('a', 141), true)$$, 'bad_message'), '140 characters at most');
select pg_temp.assert(pg_temp.raises($$select public.radio_request('mia.k', 'shout out to @zed', true)$$, 'no_tags'), 'no tagging anyone');

-- A good request: the @ is dropped, the word filter runs, one a day.
select pg_temp.assert(public.radio_request('@mia.k', 'Good morning   Queens, damn', true) ->> 'handle' = 'mia.k', 'handle stored without @');
select pg_temp.assert(pg_temp.raises($$select public.radio_request('mia.k', 'again', true)$$, 'already_requested'), 'one a day');
select pg_temp.assert((public.radio_state() -> 'mine' ->> 'status') = 'pending' and (public.radio_state() ->> 'requestedToday')::boolean, 'mine is waiting');

reset role;
select pg_temp.assert((select message from public.radio_shoutouts where player_id = pg_temp.id(2)) = public.chat_filter('Good morning Queens, damn'), 'spaces folded, word filter applied');
set role authenticated; select pg_temp.as_(2);
-- Players can't run the queue.
select pg_temp.assert(pg_temp.raises($$select public.admin_shoutouts()$$, 'not_admin'), 'queue is admin only');

-- The list fills at 3.
select pg_temp.as_(3); select 1 from public.radio_request('zed', 'Astoria stand up', true);
select pg_temp.as_(4); select 1 from public.radio_request('kai_', 'Hello from the N train', true);
select pg_temp.as_(1);
select pg_temp.assert((public.radio_state() ->> 'left')::int = 0, 'list full');
select pg_temp.assert(pg_temp.raises($$select public.radio_request('boss', 'me too', true)$$, 'list_full'), 'full list says so');

-- The owner picks one to air and one for the wall, and rejects one.
reset role;
select set_config('fm.' || replace(handle, '.', '_'), id::text, false) from public.radio_shoutouts;
set role authenticated; select pg_temp.as_(1);
select pg_temp.assert(jsonb_array_length(public.admin_shoutouts() -> 'items') = 3, 'three in the queue');
select 1 from public.admin_shoutout_action(current_setting('fm.mia_k')::bigint, 'air');
select 1 from public.admin_shoutout_action(current_setting('fm.zed')::bigint, 'wall');
select 1 from public.admin_shoutout_action(current_setting('fm.kai_')::bigint, 'reject');
-- Picking another to air sends the first back to waiting.
select 1 from public.admin_shoutout_action(current_setting('fm.zed')::bigint, 'air');
select pg_temp.assert((select i ->> 'status' from jsonb_array_elements(public.admin_shoutouts() -> 'items') i where i ->> 'handle' = 'mia.k') = 'pending', 'replaced pick waits again');
select 1 from public.admin_shoutout_action(current_setting('fm.mia_k')::bigint, 'wall');
reset role;
-- It aired (9 a.m. may still be ahead where this test runs).
update public.radio_shoutouts set aired_at = now() - interval '1 minute' where handle = 'zed';

set role authenticated; select pg_temp.as_(3);
select pg_temp.assert(public.radio_state() -> 'onAir' ->> 'handle' = 'zed', 'zed on air');
select pg_temp.assert(jsonb_array_length(public.radio_state() -> 'wall') = 1, 'one on the wall');
select pg_temp.assert(public.radio_state() -> 'onAir' -> 'player' is null, 'no player id in public');

-- Reports: not your own, and it lands in Reports quoted.
select pg_temp.assert(pg_temp.raises($$select public.radio_report(current_setting('fm.zed')::bigint, 'spam', null)$$, 'unknown_shoutout'), 'not your own');
select pg_temp.as_(4);
select public.radio_report(current_setting('fm.zed')::bigint, 'inappropriate', 'rude');
reset role;
select pg_temp.assert(exists (select 1 from public.reports where reported = pg_temp.id(3) and note like '[Real Clout FM shoutout%@zed%'), 'report quoted');

-- A request still waiting when its day ends wasn't picked.
update public.radio_shoutouts set ny_date = ny_date - 1, status = 'pending' where handle = 'mia.k';
set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(public.radio_state() -> 'mine' ->> 'status' = 'not_picked', 'not picked after its day');
select pg_temp.assert(not (public.radio_state() ->> 'requestedToday')::boolean, 'can ask again today');

-- Internal helpers aren't callable from the browser.
select pg_temp.assert(pg_temp.raises($$select public.radio_air_time(current_date)$$, 'permission denied'), 'air time is internal');
reset role;

rollback;
