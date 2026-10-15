-- Scenario test for migration 0010 (chat, block, report, the review queue, analytics).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000061'), ('00000000-0000-0000-0000-000000000062'), ('00000000-0000-0000-0000-000000000063');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000063');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000061');
select 1 from public.create_player('Sola', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_('00000000-0000-0000-0000-000000000062');
select 1 from public.create_player('Bram', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_('00000000-0000-0000-0000-000000000063');
select 1 from public.create_player('Cyra', 'night_owl_goth', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');

-- ---- Profiles from the leaderboard ----
select pg_temp.as_('00000000-0000-0000-0000-000000000061');
select pg_temp.assert((select count(*) >= 3 and bool_and(id is not null) from public.leaderboard_people('queens', 50)), 'leaderboard with ids');
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000062') ->> 'name' = 'Bram', 'player card');

-- ---- Sending: filter, daily limit ----
select pg_temp.assert((public.chat_status() ->> 'left')::int = 20, '20 a day (0047; it was 10)');
select pg_temp.assert(public.chat_send('00000000-0000-0000-0000-000000000062', 'hey what the fuck is up') ->> 'body' = 'hey what the •••• is up', 'word filter');
select pg_temp.assert(public.chat_send('00000000-0000-0000-0000-000000000062', 'Scunthorpe is fine') ->> 'body' = 'Scunthorpe is fine', 'whole words only');
do $$ begin
  for i in 3..20 loop perform public.chat_send('00000000-0000-0000-0000-000000000062', 'msg ' || i); end loop;
  begin perform public.chat_send('00000000-0000-0000-0000-000000000062', 'twenty-one'); raise exception 'FAIL: 21st message';
  exception when sqlstate '22023' then null; end;
  begin perform public.chat_send('00000000-0000-0000-0000-000000000061', 'me'); raise exception 'FAIL: message myself';
  exception when sqlstate '22023' then null; end;
  -- Direct table access is closed.
  begin perform 1 from public.messages; if found then raise exception 'FAIL: read messages directly'; end if;
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert((public.chat_status() ->> 'left')::int = 0, 'none left');

-- ---- Receiving: unread, then read ----
select pg_temp.as_('00000000-0000-0000-0000-000000000062');
select pg_temp.assert((public.chat_list() -> 0 ->> 'unread')::int = 20, 'twenty unread');
select pg_temp.assert(jsonb_array_length(public.chat_thread('00000000-0000-0000-0000-000000000061') -> 'messages') = 20, 'thread');
select pg_temp.assert((public.chat_list() -> 0 ->> 'unread')::int = 0, 'read after opening');
select 1 from public.chat_send('00000000-0000-0000-0000-000000000061', 'stop messaging me');

-- ---- Report, then block ----
select public.chat_report('00000000-0000-0000-0000-000000000061',
  (select (m ->> 'id')::bigint from jsonb_array_elements(public.chat_thread('00000000-0000-0000-0000-000000000061') -> 'messages') m where not (m ->> 'mine')::boolean limit 1),
  'harassment', 'keeps swearing');
select public.chat_block('00000000-0000-0000-0000-000000000061', true);
select pg_temp.assert((public.chat_thread('00000000-0000-0000-0000-000000000061') ->> 'blocked')::boolean, 'blocked thread');
select pg_temp.assert(jsonb_array_length(public.chat_thread('00000000-0000-0000-0000-000000000061') -> 'messages') = 0, 'blocked thread hides at once');
select pg_temp.assert((public.chat_list() -> 0 ->> 'blocked')::boolean, 'list shows Blocked');
-- Ana can't message Bo any more (tomorrow, with messages left).
reset role;
update public.messages set ny_date = ny_date - 1 where sender = '00000000-0000-0000-0000-000000000061';
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000061');
do $$ begin
  begin perform public.chat_send('00000000-0000-0000-0000-000000000062', 'hello?'); raise exception 'FAIL: messaged a blocker';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_reports('open'); raise exception 'FAIL: player read the queue';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- The review queue ----
select pg_temp.as_('00000000-0000-0000-0000-000000000063');
select pg_temp.assert(jsonb_array_length(public.admin_reports('open')) = 1, 'one open report');
select pg_temp.assert(public.admin_reports('open') -> 0 -> 'reported' ->> 'name' = 'Sola', 'reported player');
select pg_temp.assert((select bool_or((m ->> 'reported')::boolean) from jsonb_array_elements(public.admin_reports('open') -> 0 -> 'messages') m), 'reported message flagged');
select public.admin_report_action((public.admin_reports('open') -> 0 ->> 'id')::bigint, 'mute');
select pg_temp.assert(jsonb_array_length(public.admin_reports('open')) = 0, 'queue cleared');
select pg_temp.as_('00000000-0000-0000-0000-000000000061');
select pg_temp.assert(public.chat_status() ->> 'mutedUntil' is not null, 'muted');
do $$ begin
  begin perform public.chat_send('00000000-0000-0000-0000-000000000063', 'hi'); raise exception 'FAIL: muted player sent';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- Analytics ----
select public.track('session');
select public.track('session');
select public.track('invite_shared');
select pg_temp.as_('00000000-0000-0000-0000-000000000063');
select pg_temp.assert((public.admin_metrics() ->> 'activeToday')::int = 1, 'one session per player per day');
select pg_temp.assert((public.admin_metrics() ->> 'invited')::int = 1, 'invite tracked');
select pg_temp.assert((public.admin_metrics() ->> 'players')::int >= 3, 'players counted');
select pg_temp.assert((public.admin_metrics() ->> 'messagesToday')::int = 1, 'messages today');

select 'SOCIAL CHECKS PASSED' as result;
rollback;
