-- v0.5 "Money and Social", part 3 (Clarifications section 10, Design Guide C35):
-- player-to-player chat with a daily limit, a word filter, block and report, the
-- admin review queue in the Story Studio, and our own analytics for the success
-- metrics (Clarifications section 8). Every write goes through these functions.

-- ---------------------------------------------------------------------------
-- Settings: the daily limit and the word filter live in data, so admins can tune them.
-- ---------------------------------------------------------------------------
insert into public.game_settings (key, value) values
('chat', '{"dailyLimit": 10, "maxLength": 500, "muteDays": 7,
           "words": ["fuck", "fucking", "shit", "bitch", "cunt", "dick", "pussy", "whore", "slut", "bastard", "asshole", "motherfucker", "nazi", "kys"]}'::jsonb)
on conflict (key) do nothing;

alter table public.players
  add column chat_muted_until timestamptz,
  add column chat_warned_at   timestamptz,
  add column banned_at        timestamptz;

-- ---------------------------------------------------------------------------
-- Conversations, messages, blocks and reports
-- ---------------------------------------------------------------------------
-- One conversation per pair of players (a < b, so the pair is unique either way round).
create table public.conversations (
  id              bigint generated always as identity primary key,
  a               uuid not null references public.players (id) on delete cascade,
  b               uuid not null references public.players (id) on delete cascade,
  a_read_at       timestamptz not null default now(),
  b_read_at       timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  check (a < b),
  unique (a, b)
);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  sender          uuid not null references public.players (id) on delete cascade,
  body            text not null,
  -- The New York day it was sent on, for the daily limit.
  ny_date         date not null,
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, id);
create index messages_sender_day_idx on public.messages (sender, ny_date);

create table public.blocks (
  blocker    uuid not null references public.players (id) on delete cascade,
  blocked    uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.reports (
  id              bigint generated always as identity primary key,
  reporter        uuid not null references public.players (id) on delete cascade,
  reported        uuid not null references public.players (id) on delete cascade,
  conversation_id bigint references public.conversations (id) on delete set null,
  message_id      bigint references public.messages (id) on delete set null,
  reason          text not null check (reason in ('harassment', 'spam', 'inappropriate', 'other')),
  note            text check (char_length(note) <= 500),
  status          text not null default 'open' check (status in ('open', 'dismissed', 'warned', 'muted', 'banned')),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

-- RLS on, no policies: reads and writes only through the functions below.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------
-- Analytics (our own events; the success metrics are counted in admin_metrics)
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  name       text not null check (name in ('session', 'invite_shared', 'beat_shared', 'postcard_shared')),
  ny_date    date not null,
  created_at timestamptz not null default now(),
  -- One of each per player per day is all the metrics need.
  unique (player_id, name, ny_date)
);
alter table public.analytics_events enable row level security;

create function public.track(p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.players where id = auth.uid()) then return; end if;
  insert into public.analytics_events (player_id, name, ny_date) values (auth.uid(), p_name, public.ny_today())
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles and the word filter
-- ---------------------------------------------------------------------------
/** The leaderboard with player ids, so a row can open that player's card (C27, C28). */
create function public.leaderboard_people(p_scope text default 'queens', p_limit int default 50)
returns table (id uuid, rank bigint, display_name text, starting_style text, clout bigint, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with pool as (
    select p.id, p.display_name, p.starting_style, p.clout, p.created_at
      from public.players p
     where p.banned_at is null
       and (p_scope <> 'clique'
            or p.id = auth.uid()
            or p.id in (select invitee_id from public.invites where inviter_id = auth.uid())
            or p.id in (select inviter_id from public.invites where invitee_id = auth.uid()))
  ), ranked as (
    select rank() over (order by clout desc, created_at asc) as rank, id, display_name, starting_style, clout from pool
  )
  select id, rank, display_name, starting_style, clout, id = auth.uid()
    from ranked
   order by rank
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

/** Another player's public card: name, style, clout and badges. Nothing private. */
create function public.player_card(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'style', p.starting_style, 'clout', p.clout, 'homeId', p.home_id,
    'badges', (select count(*) from public.player_badges b where b.player_id = p.id),
    'joined', p.created_at,
    'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = p.id),
    'isMe', p.id = auth.uid())
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

/** Masks filtered words with bullets (whole words, any case). */
create function public.chat_filter(p_body text) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  w text;
  out_ text := p_body;
begin
  for w in select jsonb_array_elements_text(public.game_settings_value('chat') -> 'words') loop
    out_ := regexp_replace(out_, '\m' || w || '\M', repeat('•', char_length(w)), 'gi');
  end loop;
  return out_;
end;
$$;

create function public.game_settings_value(p_key text) returns jsonb
language sql stable security definer set search_path = public
as $$ select value from public.game_settings where key = p_key $$;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
/** How many messages are left today, and whether this player may chat at all. */
create function public.chat_status()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'limit', (public.game_settings_value('chat') ->> 'dailyLimit')::int,
    'left', greatest(0, (public.game_settings_value('chat') ->> 'dailyLimit')::int
                        - (select count(*) from public.messages m where m.sender = auth.uid() and m.ny_date = public.ny_today())),
    'mutedUntil', (select chat_muted_until from public.players where id = auth.uid() and chat_muted_until > now()),
    'warned', (select chat_warned_at is not null from public.players where id = auth.uid()),
    'banned', (select banned_at is not null from public.players where id = auth.uid()));
$$;

create function public.chat_send(p_to uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  them public.players;
  cfg jsonb := public.game_settings_value('chat');
  body text := btrim(coalesce(p_body, ''));
  conv public.conversations;
  sent int;
  msg public.messages;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'banned' using errcode = '42501'; end if;
  if me.chat_muted_until > now() then raise exception 'muted' using errcode = '42501'; end if;
  select * into them from public.players where id = p_to;
  if them.id is null or them.home_id is null or them.banned_at is not null or them.id = uid then raise exception 'unknown_player' using errcode = '22023'; end if;
  if exists (select 1 from public.blocks where (blocker = uid and blocked = p_to) or (blocker = p_to and blocked = uid)) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if char_length(body) = 0 then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(body) > (cfg ->> 'maxLength')::int then raise exception 'too_long' using errcode = '22023'; end if;
  select count(*) into sent from public.messages where sender = uid and ny_date = public.ny_today();
  if sent >= (cfg ->> 'dailyLimit')::int then raise exception 'daily_limit' using errcode = '22023'; end if;

  insert into public.conversations (a, b, a_read_at, b_read_at)
  values (least(uid, p_to), greatest(uid, p_to), '-infinity', '-infinity')
  on conflict (a, b) do update set last_message_at = excluded.last_message_at
  returning * into conv;
  -- Real time, not transaction time, so read markers and unread counts order correctly.
  insert into public.messages (conversation_id, sender, body, ny_date, created_at)
  values (conv.id, uid, public.chat_filter(body), public.ny_today(), clock_timestamp())
  returning * into msg;
  update public.conversations
     set last_message_at = msg.created_at,
         a_read_at = case when a = uid then msg.created_at else a_read_at end,
         b_read_at = case when b = uid then msg.created_at else b_read_at end
   where id = conv.id;
  return jsonb_build_object('id', msg.id, 'body', msg.body, 'at', msg.created_at,
                            'left', (cfg ->> 'dailyLimit')::int - sent - 1);
end;
$$;

/** C35 conversation list: the other player, last message, unread count, blocked flag. */
create function public.chat_list()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(item order by (item ->> 'at') desc), '[]') from (
    select jsonb_build_object(
      'with', o.id, 'name', o.display_name, 'style', o.starting_style,
      'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = o.id),
      'last', (select case when exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = o.id) then null else m.body end
                 from public.messages m where m.conversation_id = c.id and not m.hidden order by m.id desc limit 1),
      'lastMine', (select m.sender = auth.uid() from public.messages m where m.conversation_id = c.id and not m.hidden order by m.id desc limit 1),
      'at', c.last_message_at,
      'unread', case when exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = o.id) then 0 else
                (select count(*) from public.messages m
                  where m.conversation_id = c.id and m.sender <> auth.uid() and not m.hidden
                    and m.created_at > case when c.a = auth.uid() then c.a_read_at else c.b_read_at end) end
    ) as item
    from public.conversations c
    join public.players o on o.id = case when c.a = auth.uid() then c.b else c.a end
    where auth.uid() in (c.a, c.b) and o.banned_at is null
  ) t;
$$;

/** One thread, oldest first (the last 100), and marks it read. Blocked threads come back empty. */
create function public.chat_thread(p_with uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.conversations;
  is_blocked boolean := exists (select 1 from public.blocks where blocker = uid and blocked = p_with);
begin
  select * into conv from public.conversations where a = least(uid, p_with) and b = greatest(uid, p_with);
  if conv.id is not null then
    update public.conversations
       set a_read_at = case when a = uid then clock_timestamp() else a_read_at end,
           b_read_at = case when b = uid then clock_timestamp() else b_read_at end
     where id = conv.id;
  end if;
  return jsonb_build_object(
    'with', p_with,
    'blocked', is_blocked,
    'blockedMe', exists (select 1 from public.blocks where blocker = p_with and blocked = uid),
    'messages', case when is_blocked or conv.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'mine', sender = uid, 'body', body, 'at', created_at) order by id), '[]')
        from (select * from public.messages where conversation_id = conv.id and not hidden order by id desc limit 100) m) end);
end;
$$;

create function public.chat_block(p_player uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or p_player = auth.uid() then raise exception 'unknown_player' using errcode = '22023'; end if;
  if p_on then
    insert into public.blocks (blocker, blocked) values (auth.uid(), p_player) on conflict do nothing;
  else
    delete from public.blocks where blocker = auth.uid() and blocked = p_player;
  end if;
end;
$$;

/** Sends the conversation (and the message, if one was picked) to the admin review queue. */
create function public.chat_report(p_player uuid, p_message bigint, p_reason text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.conversations;
begin
  if uid is null or p_player = uid or not exists (select 1 from public.players where id = p_player) then
    raise exception 'unknown_player' using errcode = '22023';
  end if;
  select * into conv from public.conversations where a = least(uid, p_player) and b = greatest(uid, p_player);
  if p_message is not null and not exists (select 1 from public.messages where id = p_message and conversation_id = conv.id) then
    raise exception 'unknown_message' using errcode = '22023';
  end if;
  insert into public.reports (reporter, reported, conversation_id, message_id, reason, note)
  values (uid, p_player, conv.id, p_message, p_reason, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin review queue (Story Studio, "Reports"): story admins review chat too.
-- ---------------------------------------------------------------------------
/** Reports, open first then newest, with both players and the reported conversation. */
create function public.admin_reports(p_status text default 'open')
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'note', r.note, 'status', r.status, 'at', r.created_at, 'reviewedAt', r.reviewed_at,
      'messageId', r.message_id,
      'reporter', jsonb_build_object('id', rp.id, 'name', rp.display_name),
      'reported', jsonb_build_object('id', rd.id, 'name', rd.display_name, 'warned', rd.chat_warned_at is not null,
                                     'mutedUntil', rd.chat_muted_until, 'banned', rd.banned_at is not null,
                                     'reports', (select count(*) from public.reports x where x.reported = rd.id)),
      'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'from', s.display_name, 'body', m.body, 'at', m.created_at,
                                                                'reported', m.id = r.message_id) order by m.id), '[]')
                     from (select * from public.messages where conversation_id = r.conversation_id order by id desc limit 50) m
                     join public.players s on s.id = m.sender)
    ) order by (r.status = 'open') desc, r.created_at desc), '[]')
    from public.reports r
    join public.players rp on rp.id = r.reporter
    join public.players rd on rd.id = r.reported
    where p_status = 'all' or r.status = p_status);
end;
$$;

/** dismiss, warn, mute (from chat for the configured days) or ban. */
create function public.admin_report_action(p_report bigint, p_action text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.reports;
begin
  perform public.require_story_admin();
  if p_action not in ('dismiss', 'warn', 'mute', 'ban') then raise exception 'bad_action' using errcode = '22023'; end if;
  select * into r from public.reports where id = p_report for update;
  if r.id is null then raise exception 'unknown_report' using errcode = '22023'; end if;
  if p_action = 'warn' then
    update public.players set chat_warned_at = now() where id = r.reported;
  elsif p_action = 'mute' then
    update public.players set chat_muted_until = now() + make_interval(days => (public.game_settings_value('chat') ->> 'muteDays')::int) where id = r.reported;
  elsif p_action = 'ban' then
    update public.players set banned_at = now() where id = r.reported;
  end if;
  update public.reports
     set status = case p_action when 'dismiss' then 'dismissed' when 'warn' then 'warned' when 'mute' then 'muted' else 'banned' end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report;
end;
$$;

/** The success metrics (Clarifications 8): first task, invites, day-1 return, stories, purchases. */
create function public.admin_metrics()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.players where home_id is not null),
    'newThisWeek', (select count(*) from public.players where home_id is not null and created_at > now() - interval '7 days'),
    'firstTask', (select count(*) from public.players where first_party_at is not null),
    'invited', (select count(distinct player_id) from public.analytics_events where name = 'invite_shared'),
    'invitesJoined', (select count(*) from public.invites),
    -- Day-1 return: of players who signed up at least a day ago, how many came back the next New York day.
    'day1Cohort', (select count(*) from public.players p
                    where p.home_id is not null and (p.created_at at time zone 'America/New_York')::date < today),
    'day1Returned', (select count(*) from public.players p
                      where p.home_id is not null and (p.created_at at time zone 'America/New_York')::date < today
                        and exists (select 1 from public.analytics_events e where e.player_id = p.id and e.name = 'session'
                                     and e.ny_date = (p.created_at at time zone 'America/New_York')::date + 1)),
    'activeToday', (select count(*) from public.analytics_events where name = 'session' and ny_date = today),
    'beatOpens', (select count(*) from public.story_beats_seen),
    'readers', (select count(distinct player_id) from public.story_beats_seen),
    'votes', (select count(*) from public.story_votes),
    'voters', (select count(distinct player_id) from public.story_votes),
    'purchases', (select coalesce(jsonb_object_agg(t, jsonb_build_object('count', n, 'cents', cents)), '{}') from (
                    select s.product_type as t, count(*) as n, coalesce(sum(u.amount_cents), 0) as cents
                      from public.purchases u join public.store_products s on s.sku = u.sku
                     where u.status = 'paid' group by s.product_type) x),
    'refunds', (select count(*) from public.purchases where status = 'refunded'),
    'messagesToday', (select count(*) from public.messages where ny_date = today),
    'openReports', (select count(*) from public.reports where status = 'open'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.track(text)', 'public.leaderboard_people(text, int)', 'public.player_card(uuid)', 'public.chat_status()',
    'public.chat_send(uuid, text)', 'public.chat_list()', 'public.chat_thread(uuid)', 'public.chat_block(uuid, boolean)',
    'public.chat_report(uuid, bigint, text, text)', 'public.admin_reports(text)', 'public.admin_report_action(bigint, text)',
    'public.admin_metrics()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.chat_filter(text)', 'public.game_settings_value(text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
