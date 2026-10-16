-- Scenario test for migration 0058 (Clout TV: photo submissions, the Big Screen queue, storage access).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000b' || n)::uuid $$;

insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 3) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('tvplayer1', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('tvplayer2', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('tvplayer3', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
select pg_temp.assert(exists (select 1 from storage.buckets where id = 'big-screen' and not public), 'private bucket');

-- Uploads: only into your own folder.
set role authenticated; select pg_temp.as_(2);
insert into storage.objects (bucket_id, name) values ('big-screen', '00000000-0000-0000-0000-0000000000b2/me.jpg');
select pg_temp.assert(pg_temp.raises($$insert into storage.objects (bucket_id, name) values ('big-screen', '00000000-0000-0000-0000-0000000000b3/x.jpg')$$, 'row-level security'), 'not into someone else''s folder');
select pg_temp.as_(3);
insert into storage.objects (bucket_id, name) values ('big-screen', '00000000-0000-0000-0000-0000000000b3/me.jpg');
-- Nobody else can see a photo before it's featured.
select pg_temp.assert(not exists (select 1 from storage.objects where name like '00000000-0000-0000-0000-0000000000b2/%'), 'others'' photos are private');
select pg_temp.assert(exists (select 1 from storage.objects where name like '00000000-0000-0000-0000-0000000000b3/%'), 'your own photo is yours');

-- Submitting: all three confirmations, a real handle, your own uploaded photo, one a day.
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.tv_submit('00000000-0000-0000-0000-0000000000b2/me.jpg', 'mia', true, true, false)$$, 'confirm_all'), 'all three confirmations');
select pg_temp.assert(pg_temp.raises($$select public.tv_submit('00000000-0000-0000-0000-0000000000b2/me.jpg', 'mia k', true, true, true)$$, 'bad_handle'), 'handle checked');
select pg_temp.assert(pg_temp.raises($$select public.tv_submit('00000000-0000-0000-0000-0000000000b3/me.jpg', 'mia', true, true, true)$$, 'no_photo'), 'not someone else''s photo');
select pg_temp.assert(pg_temp.raises($$select public.tv_submit('00000000-0000-0000-0000-0000000000b2/nope.jpg', 'mia', true, true, true)$$, 'no_photo'), 'the photo must be uploaded');
select pg_temp.assert(public.tv_submit('00000000-0000-0000-0000-0000000000b2/me.jpg', '@mia.k', true, true, true) ->> 'status' = 'pending', 'submitted, waiting');
select pg_temp.assert(pg_temp.raises($$select public.tv_submit('00000000-0000-0000-0000-0000000000b2/me.jpg', 'mia', true, true, true)$$, 'already_submitted'), 'one a day');
select pg_temp.assert((public.tv_state() ->> 'submittedToday')::boolean and public.tv_state() -> 'featured' = 'null'::jsonb, 'nothing featured yet');
select pg_temp.as_(3); select 1 from public.tv_submit('00000000-0000-0000-0000-0000000000b3/me.jpg', 'zed', true, true, true);

-- Players can't run the queue; nothing goes up on its own.
select pg_temp.assert(pg_temp.raises($$select public.admin_big_screen()$$, 'not_admin'), 'queue is admin only');
select pg_temp.assert(public.tv_state() -> 'featured' = 'null'::jsonb, 'nothing on screen before an approval');

-- The admin sees every photo and approves both into the rotation: the first goes up at once (empty screen).
select pg_temp.as_(1);
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'big-screen') = 2, 'admins see the queue''s photos');
select pg_temp.assert(jsonb_array_length(public.admin_big_screen() -> 'items') = 2, 'two waiting');
select pg_temp.assert(public.admin_big_screen() -> 'items' -> 0 -> 'confirmed' ->> 'adult' is not null, 'confirmations shown with times');
select set_config('tv.mia', (select x ->> 'id' from jsonb_array_elements(public.admin_big_screen() -> 'items') x where x ->> 'handle' = 'mia.k'), false);
select set_config('tv.zed', (select x ->> 'id' from jsonb_array_elements(public.admin_big_screen() -> 'items') x where x ->> 'handle' = 'zed'), false);
select public.admin_big_screen_action(current_setting('tv.mia')::bigint, 'approve');
select public.admin_big_screen_action(current_setting('tv.zed')::bigint, 'approve');
select pg_temp.assert((public.admin_big_screen('all') ->> 'current')::bigint = current_setting('tv.mia')::bigint, 'first approval goes up on an empty screen');

-- One every 3 hours: zed waits until the next slot.
select pg_temp.as_(3);
select pg_temp.assert(public.tv_state() -> 'featured' ->> 'handle' = 'mia.k', 'mia on screen');
select pg_temp.assert(exists (select 1 from storage.objects where name = '00000000-0000-0000-0000-0000000000b2/me.jpg'), 'the feature''s photo is public in the game');
select pg_temp.assert(not exists (select 1 from storage.objects where name like '00000000-0000-0000-0000-0000000000b3/%') = false, 'still see your own');
reset role;
-- Mia's text from Clout TV.
select pg_temp.assert(exists (select 1 from public.station_messages where player_id = pg_temp.id(2) and station = 'tv' and body ilike '%big screen%'), 'mia texted by Clout TV');
-- Move mia's slot back 3 hours: the next check puts zed up.
update public.tv_submissions set featured_at = featured_at - interval '3 hours' where handle = 'mia.k';
set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(public.tv_state() -> 'featured' ->> 'handle' = 'zed', 'next slot: zed');
select pg_temp.assert(jsonb_array_length(public.tv_state() -> 'archive') = 1, 'mia in the archive');
-- Mia reads the text in Messages.
select pg_temp.assert(public.station_inbox() -> 0 ->> 'station' = 'tv' and (public.station_inbox() -> 0 ->> 'unread')::int = 1, 'one unread from Clout TV');
select public.station_read('tv');
select pg_temp.assert((public.station_inbox() -> 0 ->> 'unread')::int = 0, 'read');

-- Show now: the admin swaps the screen back to mia at once; take down puts nothing new up (rotation empty), the last stays.
select pg_temp.as_(1);
select public.admin_big_screen_action(current_setting('tv.mia')::bigint, 'show_now');
select pg_temp.as_(3);
select pg_temp.assert(public.tv_state() -> 'featured' ->> 'handle' = 'mia.k', 'show now');
select pg_temp.as_(1);
select public.admin_big_screen_action(current_setting('tv.mia')::bigint, 'take_down');
select pg_temp.as_(3);
select pg_temp.assert(public.tv_state() -> 'featured' ->> 'handle' = 'zed', 'taken down: the one before it in this slot shows');
select pg_temp.assert(not exists (select 1 from storage.objects where name = '00000000-0000-0000-0000-0000000000b2/me.jpg'), 'taken down: private again');

-- When the slot ends with nobody waiting, the screen goes back to "Make it BIG in NY".
reset role;
update public.tv_submissions set featured_at = featured_at - interval '3 hours' where status = 'featured';
set role authenticated; select pg_temp.as_(3);
select pg_temp.assert(public.tv_state() -> 'featured' = 'null'::jsonb, 'empty rotation: the ident');
select pg_temp.assert(jsonb_array_length(public.tv_state() -> 'archive') >= 1, 'past features still in the archive');

-- A player withdraws their own (not someone else's).
select pg_temp.assert(pg_temp.raises($$select public.tv_withdraw(999999)$$, 'unknown_submission'), 'not someone else''s');
select pg_temp.assert(public.tv_withdraw((select (x ->> 'id')::bigint from jsonb_array_elements(public.tv_state() -> 'mine') x)) = '00000000-0000-0000-0000-0000000000b3/me.jpg', 'withdrawn, path back to delete');
select pg_temp.assert(jsonb_array_length(public.tv_state() -> 'mine') = 0, 'gone from mine');

-- The day's list: 20 a day across the city.
reset role;
update public.game_settings set value = value || '{"dailyCap": 2}'::jsonb where key = 'tv';
set role authenticated; select pg_temp.as_(1);
insert into storage.objects (bucket_id, name) values ('big-screen', '00000000-0000-0000-0000-0000000000b1/me.jpg');
select pg_temp.assert(pg_temp.raises($$select public.tv_submit('00000000-0000-0000-0000-0000000000b1/me.jpg', 'boss', true, true, true)$$, 'list_full'), 'list full');
select pg_temp.assert((public.tv_state() ->> 'left')::int = 0, 'none left');
reset role;
select pg_temp.assert((select (value ->> 'slotHours')::int from public.game_settings where key = 'tv') = 3, 'a new photo every 3 hours');

-- Real Clout FM: an aired shoutout texts its player.
insert into public.radio_shoutouts (player_id, handle, message, ny_date, status, owner_confirmed, aired_at)
values (pg_temp.id(3), 'zed', 'Morning Queens', public.ny_today(), 'on_air', true, now() - interval '1 minute');
set role authenticated; select pg_temp.as_(3);
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.station_inbox()) t where t ->> 'station' = 'fm'
                               and t -> 'messages' -> 0 ->> 'body' like '%Wake-Up Call%Morning Queens%'), 'texted by Real Clout FM');

-- Internal helpers aren't callable from the browser.
select pg_temp.assert(pg_temp.raises($$select public.tv_public(null::public.tv_submissions)$$, 'permission denied'), 'tv_public is internal');
select pg_temp.assert(pg_temp.raises($$select public.station_sync()$$, 'permission denied'), 'station_sync is internal');
reset role;

rollback;
