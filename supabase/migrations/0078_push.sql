-- 0078: push notifications, step 1 (owner, Oct 18: push only, 4 a day plus chat, quiet hours 10 PM to 9 AM, win-back in).
-- The database only stores: each player's devices (push_subscriptions), their category switches and time zone
-- (push_prefs) and a queue (push_queue). Game events add queue rows with push_enqueue(); the game server's sender
-- (app/api/push/run, lib/push.ts) applies the rules (priority, merging, caps, quiet hours, expiry, the morning digest)
-- and sends with web-push. Players never read the queue.

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fails      int not null default 0
);
create index if not exists push_subscriptions_player_idx on public.push_subscriptions (player_id);

create table if not exists public.push_prefs (
  player_id  uuid primary key references public.players (id) on delete cascade,
  -- Categories switched off (lib/push.ts PUSH_CATEGORIES).
  off        text[] not null default '{}',
  -- The player's IANA time zone, for quiet hours and the morning digest.
  tz         text not null default 'America/New_York',
  -- When the prompt last asked, so "Not now" waits a few days.
  asked_at   timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_queue (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  kind        text not null,
  -- One push per thing: a repeat of the same key is ignored (like the ledger's refs).
  dedupe_key  text not null,
  -- Pushes with the same group merge into one ("3 new messages from Tasha").
  group_key   text,
  title       text not null,
  body        text not null,
  url         text not null default '/home',
  -- When it stops mattering sooner than the kind's usual expiry (a date's start, a bill's due day).
  deadline_at timestamptz,
  -- From a crush, a match or the crew: scores higher.
  close       boolean not null default false,
  created_at  timestamptz not null default now(),
  status      text not null default 'queued' check (status in ('queued', 'sent', 'merged', 'dropped')),
  reason      text,
  sent_at     timestamptz,
  unique (player_id, dedupe_key)
);
create index if not exists push_queue_due_idx on public.push_queue (status, player_id) where status = 'queued';
create index if not exists push_queue_sent_idx on public.push_queue (player_id, sent_at) where status = 'sent';

alter table public.push_subscriptions enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_queue enable row level security;
revoke all on public.push_subscriptions, public.push_prefs, public.push_queue from anon, authenticated;

/** Adds a push to a player's queue (internal: game functions call it). A repeated key is ignored. */
create or replace function public.push_enqueue(p_player uuid, p_kind text, p_key text, p_title text, p_body text,
  p_url text default '/home', p_deadline timestamptz default null, p_close boolean default false, p_group text default null)
returns void
language sql security definer set search_path = public
as $$
  insert into public.push_queue (player_id, kind, dedupe_key, group_key, title, body, url, deadline_at, close)
  select p_player, p_kind, p_key, p_group, left(p_title, 80), left(p_body, 180), coalesce(p_url, '/home'), p_deadline, p_close
   where exists (select 1 from public.push_subscriptions s where s.player_id = p_player)
  on conflict (player_id, dedupe_key) do nothing
$$;

/** Saves this device's push subscription (and the player's time zone). */
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_tz text) returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '28000'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'bad_subscription' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (player_id, endpoint, p256dh, auth) values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set player_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, fails = 0;
  insert into public.push_prefs (player_id, tz) values (uid, coalesce(nullif(left(p_tz, 64), ''), 'America/New_York'))
  on conflict (player_id) do update set tz = excluded.tz, updated_at = now();
end;
$$;

/** Removes this device (turned off in Settings, or the browser dropped it). */
create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public
as $$ delete from public.push_subscriptions where endpoint = p_endpoint and player_id = auth.uid() $$;

/** The player's switches: categories off, and whether any device is subscribed. */
create or replace function public.push_prefs_get() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'off', coalesce((select to_jsonb(off) from public.push_prefs where player_id = auth.uid()), '[]'::jsonb),
    'devices', (select count(*) from public.push_subscriptions where player_id = auth.uid()),
    'askedAt', (select asked_at from public.push_prefs where player_id = auth.uid()))
$$;

/** Switches categories off (the full list of off categories) or records that the prompt asked. */
create or replace function public.push_prefs_set(p_off text[], p_asked boolean default false) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '28000'; end if;
  if p_off is not null and exists (select 1 from unnest(p_off) c where c not in ('messages', 'social', 'money', 'reminders', 'rewards', 'news')) then
    raise exception 'bad_category' using errcode = '22023';
  end if;
  insert into public.push_prefs (player_id, off, asked_at) values (uid, coalesce(p_off, '{}'), case when p_asked then now() end)
  on conflict (player_id) do update
    set off = coalesce(p_off, push_prefs.off), asked_at = case when p_asked then now() else push_prefs.asked_at end, updated_at = now();
  return public.push_prefs_get();
end;
$$;

/** "Send a test" in Settings: one test push, at most one a minute. */
create or replace function public.push_test() returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.push_enqueue(uid, 'test', 'test:' || to_char(now(), 'YYYY-MM-DD HH24:MI'),
    'Clout City', 'Notifications are on. Lola will be in touch. Constantly.', '/home');
end;
$$;

revoke all on function public.push_enqueue(uuid, text, text, text, text, text, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
revoke all on function public.push_unsubscribe(text) from public, anon;
revoke all on function public.push_prefs_get() from public, anon;
revoke all on function public.push_prefs_set(text[], boolean) from public, anon;
revoke all on function public.push_test() from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
grant execute on function public.push_prefs_get() to authenticated;
grant execute on function public.push_prefs_set(text[], boolean) to authenticated;
grant execute on function public.push_test() to authenticated;

/** The sender: a device that failed; after five failures in a row it's removed. */
create or replace function public.push_device_failed(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare v_fails int;
begin
  update public.push_subscriptions set fails = fails + 1 where id = p_id returning fails into v_fails;
  if v_fails >= 5 then delete from public.push_subscriptions where id = p_id; end if;
end;
$$;
revoke all on function public.push_device_failed(bigint) from public, anon, authenticated;
grant execute on function public.push_device_failed(bigint) to service_role;
