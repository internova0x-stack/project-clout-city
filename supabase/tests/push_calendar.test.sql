-- Scenario test for migration 0097 (pushes for the calendar's name-day invites, culture pack C5).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.q(p text, k text) returns bigint language sql as $$
  select count(*) from public.push_queue where player_id = p::uuid and kind = k $$;
create function pg_temp.ny(p_at text) returns void language plpgsql security definer as $h$
begin
  insert into public.game_settings (key, value) values ('dev', '{}') on conflict (key) do nothing;
  update public.game_settings set value = value || jsonb_build_object('clockOffsetSeconds',
    extract(epoch from ((p_at::timestamp at time zone 'America/New_York') - now()))) where key = 'dev';
end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000971'), ('00000000-0000-0000-0000-000000000972'), ('00000000-0000-0000-0000-000000000973');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000971', false);
select 1 from public.create_player('CalPushAna', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/97a', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000972', false);
select 1 from public.create_player('CalPushWent', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/97b', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000973', false);
select 1 from public.create_player('CalPushNoPhone', 'bodega_drip', '{}', null, true);
reset role;
delete from public.push_queue;
-- "Went" already went to Dimitra's name day.
insert into public.ledger (player_id, currency, amount, kind, ref) values ('00000000-0000-0000-0000-000000000972', 'clout', 40, 'calendar', 'name-day-dimitra-2026');

-- Three weeks out: nothing. Two weeks out: the invite, once, opening Events.
select pg_temp.ny('2026-10-05 12:00');
select public.push_scan_calendar();
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000971', 'calendar_invite') = 0, 'too early');
select pg_temp.ny('2026-10-13 12:00');
select public.push_scan_calendar();
select public.push_scan_calendar();
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000971', 'calendar_invite') = 1, 'the invite, once');
select pg_temp.assert((select title = '💌 Dimitra Papadakis invited you' and body like 'Dimitra''s name day, Mon Oct 26 from 6 PM at Feta Compli Taverna.%'
                         and url = '/home?open=events' from public.push_queue where player_id = '00000000-0000-0000-0000-000000000971' and kind = 'calendar_invite'), 'invite copy');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000972', 'calendar_invite') = 0, 'not for someone who went');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000973', 'calendar_invite') = 0, 'only players with a device');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000971', 'calendar_tonight') = 0, 'no reminder before the day');

-- The day: nothing at noon; from 3 PM the reminder, naming the gift box.
select pg_temp.ny('2026-10-26 12:00');
select public.push_scan_calendar();
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000971', 'calendar_tonight') = 0, 'not at noon');
select pg_temp.ny('2026-10-26 15:30');
select public.push_scan_tonight();
select pg_temp.assert((select body from public.push_queue where player_id = '00000000-0000-0000-0000-000000000971' and kind = 'calendar_tonight')
                        = 'From 6 PM at Feta Compli Taverna. Grab a gift box at Sal''s on the way. Empty-handed costs you.', 'reminder without a gift');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-000000000972', 'calendar_tonight') = 0, 'no reminder for someone who went');

-- After it ends: nothing new (Andreas's invite waits for its own two weeks).
delete from public.push_queue;
select pg_temp.ny('2026-10-26 23:30');
select public.push_scan_calendar();
select pg_temp.assert((select count(*) from public.push_queue) = 0, 'over');

-- Hardening: the browser can't run it.
select pg_temp.assert(not has_function_privilege('authenticated', 'public.push_scan_calendar()', 'execute'), 'not for the browser');

rollback;
\echo 'push_calendar: ok'
