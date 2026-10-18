-- Push notifications (migration 0078): devices, switches, the queue (one push per key, only for subscribed players),
-- the test push, failing devices, and who may call what.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000078a1'), ('00000000-0000-0000-0000-0000000078a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000078a1', false);
select 1 from public.create_player('Pinga', 'bodega_drip', '{}', null, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000078a2', false);
select 1 from public.create_player('Quiet', 'bodega_drip', '{}', null, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000078a1', false);

-- Subscribing: an https endpoint only; the time zone is kept; re-subscribing the same endpoint updates it.
select pg_temp.assert(pg_temp.raises($$select public.push_subscribe('http://nope', 'k', 'a', 'UTC')$$, 'bad_subscription'), 'https only');
select public.push_subscribe('https://push.example/abc', 'key1', 'auth1', 'America/Los_Angeles');
select public.push_subscribe('https://push.example/abc', 'key2', 'auth2', 'America/Los_Angeles');
select pg_temp.assert((public.push_prefs_get() ->> 'devices')::int = 1, 'one device');
-- Switches: known categories only; the prompt's "asked" is remembered.
select pg_temp.assert(pg_temp.raises($$select public.push_prefs_set(array['spam'])$$, 'bad_category'), 'known categories');
select pg_temp.assert(public.push_prefs_set(array['news', 'rewards']) -> 'off' = '["news", "rewards"]'::jsonb, 'categories off');
select pg_temp.assert(public.push_prefs_set(null, true) ->> 'askedAt' is not null and public.push_prefs_get() -> 'off' = '["news", "rewards"]'::jsonb, 'asked, switches kept');
select public.push_test();
reset role;
select pg_temp.assert((select tz from public.push_prefs where player_id = '00000000-0000-0000-0000-0000000078a1') = 'America/Los_Angeles', 'time zone kept');
select pg_temp.assert((select p256dh from public.push_subscriptions where endpoint = 'https://push.example/abc') = 'key2', 'keys updated');
select pg_temp.assert((select count(*) from public.push_queue where player_id = '00000000-0000-0000-0000-0000000078a1' and kind = 'test') = 1, 'test queued');

-- The queue: one push per key; nothing for a player with no device.
select public.push_enqueue('00000000-0000-0000-0000-0000000078a1', 'gig_ready', 'gig:1', '💼 Gig done', 'C$480 is waiting');
select public.push_enqueue('00000000-0000-0000-0000-0000000078a1', 'gig_ready', 'gig:1', '💼 Gig done', 'again');
select public.push_enqueue('00000000-0000-0000-0000-0000000078a2', 'gig_ready', 'gig:1', '💼 Gig done', 'no device');
select pg_temp.assert((select count(*) from public.push_queue where kind = 'gig_ready') = 1, 'deduped, and only for subscribed players');

-- A failing device goes after five failures in a row.
select public.push_device_failed(id) from public.push_subscriptions, generate_series(1, 4) where endpoint = 'https://push.example/abc';
select pg_temp.assert(exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/abc'), 'four: kept');
select public.push_device_failed(id) from public.push_subscriptions where endpoint = 'https://push.example/abc';
select pg_temp.assert(not exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/abc'), 'five: removed');

-- Who may call what.
select pg_temp.assert(not has_function_privilege('authenticated', 'public.push_enqueue(uuid, text, text, text, text, text, timestamptz, boolean, text)', 'execute'), 'players can''t queue pushes');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.push_device_failed(bigint)', 'execute'), 'nor mark devices');
select pg_temp.assert(not has_function_privilege('anon', 'public.push_subscribe(text, text, text, text)', 'execute'), 'anon can''t subscribe');
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select * from public.push_queue$$, 'permission denied'), 'the queue is private');
select pg_temp.assert(pg_temp.raises($$select * from public.push_subscriptions$$, 'permission denied'), 'devices are private');
reset role;

rollback;
\echo PUSH CHECKS PASSED
