-- v0.14 "On Air", part 2: Clout TV (owner, Oct 16: "Make it to the big screen"), and texts from the
-- stations.
-- Clout TV is the city's TV station. Players submit a photo of themselves with their Instagram handle;
-- approved photos take turns on the Clout Tower's big screen in Astoria, a home card and the Clout TV
-- app, which keeps past features.
--   * Photos go straight from the phone to Supabase Storage (a private bucket, 5 MB, JPEG/PNG/WebP),
--     into the player's own folder. Nobody else can read one until it's on the screen; Studio admins can.
--   * Before submitting, the player confirms three things, each stored with its time: it's a photo of
--     them (or one they took), they're 18 or over, and it may be shown publicly in the game.
--   * One submission per player per New York day, and 20 a day across the city (owner, Oct 16).
--   * Nothing is approved on its own. The Studio's Big Screen queue approves photos into the rotation:
--     one player is shown every 3 hours (owner, Oct 16), oldest approval first, from 12, 3, 6 and 9
--     o'clock New York. "Show now" puts any photo on the screen at once ("we should be able to update
--     what is showing on the screen when we want"); "take down" removes it and the next one goes up.
--     A photo's turn ends with its 3-hour slot; with nobody waiting, the tower shows "Make it BIG in NY"
--     (owner, Oct 16).
--   * A player can withdraw their own submission or feature at any time.
--   * Texts from the stations (owner, Oct 16): a player whose photo goes up gets a message from
--     "Clout TV", and one whose shoutout airs (or makes the wall) gets one from "Real Clout FM", in the
--     Messages app. They're sent when it happens, the next time anyone's game checks in.

do $$
begin
  if to_regclass('public.radio_shoutouts') is null then
    raise exception 'Run migration 0057_clout_fm.sql first: 0058 builds on it.';
  end if;
end $$;

insert into public.game_settings (key, value) values
  ('tv', '{"dailyCap": 20, "slotHours": 3, "archiveDays": 60}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.tv_submissions (
  id bigserial primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  -- '<player id>/<file>' in the big-screen bucket.
  photo_path text not null unique,
  handle text not null check (handle ~ '^[A-Za-z0-9._]{1,30}$'),
  confirmed_self_at timestamptz not null,
  confirmed_adult_at timestamptz not null,
  confirmed_public_at timestamptz not null,
  ny_date date not null,
  -- approved: in the rotation, waiting for a slot. featured: has been on the screen (from featured_at).
  status text not null default 'pending' check (status in ('pending', 'approved', 'featured', 'rejected', 'withdrawn', 'taken_down')),
  approved_at timestamptz,
  featured_at timestamptz,
  reviewed_by uuid references public.players (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, ny_date),
  check (status <> 'featured' or featured_at is not null)
);
create index if not exists tv_status_idx on public.tv_submissions (status, created_at);
create index if not exists tv_featured_idx on public.tv_submissions (featured_at desc) where status = 'featured';
alter table public.tv_submissions enable row level security;

-- Texts from the stations, in the Messages app (read-only threads).
create table if not exists public.station_messages (
  id bigserial primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  station text not null check (station in ('fm', 'tv')),
  body text not null,
  -- What it's about ('fm:<shoutout>', 'tv:<submission>'), so each is sent once.
  ref text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, station, ref)
);
create index if not exists station_messages_player_idx on public.station_messages (player_id, created_at desc);
alter table public.station_messages enable row level security;
-- No policies on either table: players and the Studio go through the functions below.

/** The start of the current 3-hour slot (12, 3, 6, 9 o'clock New York). */
create or replace function public.tv_slot_start() returns timestamptz
language sql stable security definer set search_path = public
as $$
  select (date_trunc('day', ny) + make_interval(hours => (extract(hour from ny)::int / h) * h)) at time zone 'America/New_York'
    from (select public.game_now() at time zone 'America/New_York' as ny, (public.game_settings_value('tv') ->> 'slotHours')::int as h) x
$$;

/** The game's clock read now (not at the transaction's start), so a put-up later in a transaction is later. */
create or replace function public.tv_now() returns timestamptz
language sql volatile security definer set search_path = public
as $$ select public.game_now() + (clock_timestamp() - now()) $$;

/** The photo on the screen now: the latest to go up in this 3-hour slot (none: the tower's "Make it BIG in NY"). */
create or replace function public.tv_current() returns public.tv_submissions
language sql volatile security definer set search_path = public
as $$
  select * from public.tv_submissions
   where status = 'featured' and featured_at >= public.tv_slot_start() and featured_at <= public.tv_now()
   order by featured_at desc limit 1
$$;

/** Whether a stored photo is public now: it's on the screen or has been. */
create or replace function public.tv_photo_public(p_path text) returns boolean
language sql volatile security definer set search_path = public
as $$ select exists (select 1 from public.tv_submissions where photo_path = p_path and status = 'featured' and featured_at <= public.tv_now()) $$;


/** Puts a photo on the screen now and texts its player. */
create or replace function public.tv_put_up(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.tv_submissions;
begin
    update public.tv_submissions set status = 'featured', featured_at = public.tv_now() where id = p_id returning * into s;
  insert into public.station_messages (player_id, station, body, ref)
  values (s.player_id, 'tv', '📺 You made it to the Big Screen! Your photo is up on the Clout Tower in Astoria for the next 3 hours. Now the whole city knows your name.', 'tv:' || s.id)
  on conflict do nothing;
end;
$$;

/**
 * Keeps the stations up to date: when a new 3-hour slot starts, the next approved photo goes up; a
 * shoutout that has aired (or made the wall of a show that has aired) gets its text. Runs whenever a
 * game checks in (tv_state, station_inbox).
 */
create or replace function public.station_sync() returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur public.tv_submissions;
  nxt bigint;
begin
  perform pg_advisory_xact_lock(hashtext('station_sync'));
  cur := public.tv_current();
  if cur.id is null then
    select id into nxt from public.tv_submissions where status = 'approved' order by approved_at, id limit 1;
    if nxt is not null then perform public.tv_put_up(nxt); end if;
  end if;
  insert into public.station_messages (player_id, station, body, ref)
  select s.player_id, 'fm',
         case s.status
           when 'on_air' then '🎙️ You''re on air! DJ Sharm Almight just read your shoutout on The Wake-Up Call: "' || s.message || '"'
           else '📌 Your shoutout made today''s wall on Real Clout FM. See it in the Radio app.'
         end,
         'fm:' || s.id
    from public.radio_shoutouts s
   where s.status in ('on_air', 'wall') and s.ny_date >= public.ny_today() - 1
     and exists (select 1 from public.radio_shoutouts a where a.ny_date = s.ny_date and a.status = 'on_air'
                   and coalesce(a.aired_at, public.radio_air_time(a.ny_date)) <= public.game_now())
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: the private big-screen bucket
-- ---------------------------------------------------------------------------
-- Hosted Supabase may not let the SQL editor change storage (the storage tables belong to Supabase's
-- storage role). Then this part only warns, the rest of the migration still runs, and the bucket and its
-- three policies are added in the dashboard instead (docs/SETUP.md, "Clout TV photo storage").
do $storage$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('big-screen', 'big-screen', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
exception when others then
  raise warning 'Clout TV: could not create the big-screen bucket here (%). Create it in Storage (docs/SETUP.md).', sqlerrm;
end
$storage$;

do $policies$
begin
  drop policy if exists "big-screen: upload to your own folder" on storage.objects;
  create policy "big-screen: upload to your own folder" on storage.objects for insert to authenticated
    with check (bucket_id = 'big-screen' and split_part(name, '/', 1) = auth.uid()::text);
  drop policy if exists "big-screen: your own, features and admins" on storage.objects;
  create policy "big-screen: your own, features and admins" on storage.objects for select to authenticated
    using (bucket_id = 'big-screen' and (split_part(name, '/', 1) = auth.uid()::text or public.tv_photo_public(name) or public.is_story_admin()));
  drop policy if exists "big-screen: delete your own" on storage.objects;
  create policy "big-screen: delete your own" on storage.objects for delete to authenticated
    using (bucket_id = 'big-screen' and split_part(name, '/', 1) = auth.uid()::text);
exception when others then
  raise warning 'Clout TV: could not add the big-screen storage policies here (%). Add them in Storage > Policies (docs/SETUP.md).', sqlerrm;
end
$policies$;

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------
create or replace function public.tv_public(s public.tv_submissions) returns jsonb
language sql stable security definer set search_path = public
as $$ select jsonb_build_object('id', s.id, 'handle', s.handle, 'photo', s.photo_path, 'at', s.featured_at,
                                'date', (s.featured_at at time zone 'America/New_York')::date) $$;

/** The Clout TV app: who's on the screen, past features, the player's own photos, today's list. */
create or replace function public.tv_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  cur public.tv_submissions;
  cfg jsonb := public.game_settings_value('tv');
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.station_sync();
  cur := public.tv_current();
  return jsonb_build_object(
    'today', today,
    'featured', case when cur.id is null then null else public.tv_public(cur) end,
    'nextAt', public.tv_slot_start() + make_interval(hours => (cfg ->> 'slotHours')::int),
    'archive', (select coalesce(jsonb_agg(public.tv_public(a) order by a.featured_at desc), '[]')
                  from (select * from public.tv_submissions
                         where status = 'featured' and featured_at <= public.tv_now() and id is distinct from cur.id
                           and featured_at >= public.game_now() - make_interval(days => (cfg ->> 'archiveDays')::int)
                         order by featured_at desc limit 30) a),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'handle', m.handle, 'photo', m.photo_path, 'status', m.status,
                                                          'date', m.ny_date, 'featuredAt', m.featured_at, 'onNow', m.id = cur.id) order by m.created_at desc), '[]')
               from (select * from public.tv_submissions where player_id = uid and status <> 'withdrawn' order by created_at desc limit 10) m),
    'submittedToday', exists (select 1 from public.tv_submissions where player_id = uid and ny_date = today),
    'left', greatest(0, (cfg ->> 'dailyCap')::int - (select count(*) from public.tv_submissions where ny_date = today)));
end;
$$;

/** Submits an uploaded photo for the big screen, with the three confirmations. */
create or replace function public.tv_submit(p_path text, p_handle text, p_self boolean, p_adult boolean, p_public boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  h text := regexp_replace(btrim(coalesce(p_handle, '')), '^@', '');
  today date := public.ny_today();
  row_ public.tv_submissions;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not (coalesce(p_self, false) and coalesce(p_adult, false) and coalesce(p_public, false)) then
    raise exception 'confirm_all' using errcode = '22023';
  end if;
  if h !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'bad_handle' using errcode = '22023'; end if;
  -- The photo must be one this player uploaded to their own folder.
  if p_path is null or split_part(p_path, '/', 1) <> uid::text
     or not exists (select 1 from storage.objects where bucket_id = 'big-screen' and name = p_path) then
    raise exception 'no_photo' using errcode = '22023';
  end if;
  if exists (select 1 from public.tv_submissions where player_id = uid and ny_date = today) then
    raise exception 'already_submitted' using errcode = '22023';
  end if;
  -- The day's list: the first dailyCap submissions (locked so two can't take the last place).
  perform pg_advisory_xact_lock(hashtext('tv:' || today));
  if (select count(*) from public.tv_submissions where ny_date = today) >= (public.game_settings_value('tv') ->> 'dailyCap')::int then
    raise exception 'list_full' using errcode = '22023';
  end if;
  insert into public.tv_submissions (player_id, photo_path, handle, confirmed_self_at, confirmed_adult_at, confirmed_public_at, ny_date)
  values (uid, p_path, h, now(), now(), now(), today)
  returning * into row_;
  return jsonb_build_object('id', row_.id, 'status', row_.status);
end;
$$;

/** Withdraws the player's own photo, wherever it is; returns its path so the app can delete the file. */
create or replace function public.tv_withdraw(p_id bigint) returns text
language plpgsql security definer set search_path = public
as $$
declare
  s public.tv_submissions;
begin
  update public.tv_submissions set status = 'withdrawn'
   where id = p_id and player_id = auth.uid() and status in ('pending', 'approved', 'featured')
  returning * into s;
  if s.id is null then raise exception 'unknown_submission' using errcode = '22023'; end if;
  return s.photo_path;
end;
$$;

/** Texts from the stations, one thread per station, newest last. Brings the stations up to date first. */
create or replace function public.station_inbox() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.station_sync();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'station', t.station,
      'unread', (select count(*) from public.station_messages u where u.player_id = uid and u.station = t.station and u.read_at is null),
      'messages', (select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'at', m.created_at) order by m.created_at)
                     from (select * from public.station_messages where player_id = uid and station = t.station order by created_at desc limit 30) m))
    order by t.last desc), '[]')
    from (select station, max(created_at) as last from public.station_messages where player_id = uid group by station) t);
end;
$$;

create or replace function public.station_read(p_station text) returns void
language sql security definer set search_path = public
as $$ update public.station_messages set read_at = now() where player_id = auth.uid() and station = p_station and read_at is null $$;

-- ---------------------------------------------------------------------------
-- Story Studio: the Big Screen queue
-- ---------------------------------------------------------------------------
/**
 * Submissions with the player and the three confirmations: "pending" (to review), "approved" (the
 * rotation, in order), "featured" (on the screen now first, then past) or "all". Plus who's up now and when the next slot starts.
 */
create or replace function public.admin_big_screen(p_status text default 'pending') returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cur public.tv_submissions;
begin
  perform public.require_story_admin();
  perform public.station_sync();
  cur := public.tv_current();
  return jsonb_build_object(
    'current', cur.id,
    'nextAt', public.tv_slot_start() + make_interval(hours => (public.game_settings_value('tv') ->> 'slotHours')::int),
    'cap', (public.game_settings_value('tv') ->> 'dailyCap')::int,
    'today', (select count(*) from public.tv_submissions where ny_date = public.ny_today()),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'handle', s.handle, 'photo', s.photo_path, 'status', s.status, 'at', s.created_at,
        'approvedAt', s.approved_at, 'featuredAt', s.featured_at, 'onNow', s.id = cur.id,
        'player', jsonb_build_object('id', p.id, 'name', p.display_name),
        'confirmed', jsonb_build_object('self', s.confirmed_self_at, 'adult', s.confirmed_adult_at, 'public', s.confirmed_public_at))
      order by (s.id = cur.id) desc, s.approved_at nulls last, s.featured_at desc nulls last, s.created_at), '[]')
      from public.tv_submissions s join public.players p on p.id = s.player_id
      where p_status = 'all' or s.status = p_status));
end;
$$;

/**
 * approve: into the rotation. show_now: on the screen at once (replaces what's up). reject. take_down:
 * off the screen (the next approved photo goes up).
 */
create or replace function public.admin_big_screen_action(p_id bigint, p_action text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.tv_submissions;
begin
  perform public.require_story_admin();
  if p_action not in ('approve', 'show_now', 'reject', 'take_down') then raise exception 'bad_action' using errcode = '22023'; end if;
  select * into s from public.tv_submissions where id = p_id for update;
  if s.id is null then raise exception 'unknown_submission' using errcode = '22023'; end if;
  if p_action = 'approve' then
    if s.status <> 'pending' then raise exception 'not_pending' using errcode = '22023'; end if;
    update public.tv_submissions set status = 'approved', approved_at = now(), reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
  elsif p_action = 'show_now' then
    if s.status not in ('pending', 'approved', 'featured') then raise exception 'not_pending' using errcode = '22023'; end if;
    update public.tv_submissions set approved_at = coalesce(approved_at, now()), reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
    perform public.tv_put_up(s.id);
  elsif p_action = 'reject' then
    if s.status not in ('pending', 'approved') then raise exception 'not_pending' using errcode = '22023'; end if;
    update public.tv_submissions set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
  else
    if s.status <> 'featured' then raise exception 'not_featured' using errcode = '22023'; end if;
    update public.tv_submissions set status = 'taken_down', reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
    -- The next one in the rotation takes its place now.
    if (select id from public.tv_submissions where status = 'approved' limit 1) is not null then
      perform public.tv_put_up((select id from public.tv_submissions where status = 'approved' order by approved_at, id limit 1));
    end if;
  end if;
end;
$$;

revoke all on function public.tv_current() from public, anon, authenticated;
revoke all on function public.tv_now() from public, anon, authenticated;
revoke all on function public.tv_slot_start() from public, anon, authenticated;
revoke all on function public.tv_put_up(bigint) from public, anon, authenticated;
revoke all on function public.station_sync() from public, anon, authenticated;
revoke all on function public.tv_public(public.tv_submissions) from public, anon, authenticated;
-- Storage's read policy calls this as the player.
revoke all on function public.tv_photo_public(text) from public, anon;
grant execute on function public.tv_photo_public(text) to authenticated;
revoke all on function public.tv_state() from public, anon;
revoke all on function public.tv_submit(text, text, boolean, boolean, boolean) from public, anon;
revoke all on function public.tv_withdraw(bigint) from public, anon;
revoke all on function public.station_inbox() from public, anon;
revoke all on function public.station_read(text) from public, anon;
revoke all on function public.admin_big_screen(text) from public, anon;
revoke all on function public.admin_big_screen_action(bigint, text) from public, anon;
grant execute on function public.tv_state() to authenticated;
grant execute on function public.tv_submit(text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.tv_withdraw(bigint) to authenticated;
grant execute on function public.station_inbox() to authenticated;
grant execute on function public.station_read(text) to authenticated;
grant execute on function public.admin_big_screen(text) to authenticated;
grant execute on function public.admin_big_screen_action(bigint, text) to authenticated;
