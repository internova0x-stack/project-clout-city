-- Contact the Mayor (owner, Oct 22: "a contact the mayor app that serves as a feedback feature"; lib/mayor.ts):
--   * Players write to the Mayor's office from the Phone: what it's about (a bug, an idea, a complaint, a love letter,
--     something else) and a letter of 10 to 1000 characters, up to 5 a New York day. The server notes where they were
--     (players.at_place) and their device (from the request's user agent, sent by the server action).
--   * The team reads every letter in Studio → Mayor's Inbox (admin_mayor_letters), marks it read or done, and can write
--     back (admin_mayor_letter); the player sees the reply in the app, with a dot on the app until they open it.
--   * Letters are feedback for the team, not chat: they are never shown to other players and skip the word filter.

create table if not exists public.mayor_letters (
  id            bigint generated always as identity primary key,
  player_id     uuid not null references public.players (id) on delete cascade,
  kind          text not null check (kind in ('bug', 'idea', 'complaint', 'praise', 'other')),
  message       text not null check (char_length(message) between 10 and 1000),
  ny_date       date not null,
  place         text,
  device        text,
  status        text not null default 'new' check (status in ('new', 'read', 'done')),
  reply         text check (reply is null or char_length(reply) between 1 and 1000),
  replied_at    timestamptz,
  replied_by    uuid,
  reply_seen_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists mayor_letters_player_idx on public.mayor_letters (player_id, created_at desc);
create index if not exists mayor_letters_status_idx on public.mayor_letters (status, created_at desc);
alter table public.mayor_letters enable row level security;
revoke all on public.mayor_letters from anon, authenticated;

/** The player's letters (newest first, the last 30), letters left today and replies not yet seen. */
create or replace function public.mayor_letters_state() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'letters', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'message', l.message, 'at', l.created_at,
                                                             'status', l.status, 'reply', l.reply, 'repliedAt', l.replied_at)
                                          order by l.created_at desc)
                           from (select * from public.mayor_letters where player_id = auth.uid() order by created_at desc limit 30) l), '[]'),
    'left', greatest(0, 5 - (select count(*) from public.mayor_letters where player_id = auth.uid() and ny_date = public.ny_today())),
    'unseen', (select count(*) from public.mayor_letters where player_id = auth.uid() and reply is not null and reply_seen_at is null))
$$;

/** Sends a letter to the Mayor's office. */
create or replace function public.mayor_write(p_kind text, p_message text, p_device text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  msg text := btrim(coalesce(p_message, ''));
begin
  select * into me from public.players where id = uid;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('bug', 'idea', 'complaint', 'praise', 'other') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if char_length(msg) < 10 or char_length(msg) > 1000 then raise exception 'bad_message' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('mayor:' || uid::text));
  if (select count(*) from public.mayor_letters where player_id = uid and ny_date = public.ny_today()) >= 5 then
    raise exception 'daily_max' using errcode = '22023';
  end if;
  insert into public.mayor_letters (player_id, kind, message, ny_date, place, device)
  values (uid, p_kind, msg, public.ny_today(), me.at_place, left(nullif(btrim(coalesce(p_device, '')), ''), 60));
  return public.mayor_letters_state();
end;
$$;

/** Opening the app: the replies count as seen. */
create or replace function public.mayor_seen() returns void
language sql security definer set search_path = public
as $$
  update public.mayor_letters set reply_seen_at = now()
   where player_id = auth.uid() and reply is not null and reply_seen_at is null
$$;

-- ---------------------------------------------------------------------------
-- The Studio: Mayor's Inbox
-- ---------------------------------------------------------------------------
/** The inbox: 'new' (unopened), 'open' (new or read) or 'all'; the newest 200, and the count in each status. */
create or replace function public.admin_mayor_letters(p_filter text default 'open') returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'counts', (select jsonb_build_object('new', count(*) filter (where status = 'new'), 'read', count(*) filter (where status = 'read'),
                                         'done', count(*) filter (where status = 'done')) from public.mayor_letters),
    'letters', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', l.id, 'kind', l.kind, 'message', l.message, 'at', l.created_at, 'status', l.status,
                  'reply', l.reply, 'repliedAt', l.replied_at,
                  'player', jsonb_build_object('id', l.player_id, 'name', p.display_name),
                  'context', jsonb_build_object('place', l.place, 'device', l.device)) order by l.created_at desc)
       from (select * from public.mayor_letters
              where case coalesce(p_filter, 'open') when 'new' then status = 'new' when 'all' then true else status <> 'done' end
              order by created_at desc limit 200) l
       join public.players p on p.id = l.player_id), '[]'));
end;
$$;

/** Marks a letter new, read or done, and (optionally) writes back; a new reply replaces the old one and shows as unseen again. */
create or replace function public.admin_mayor_letter(p_id bigint, p_status text, p_reply text default null, p_filter text default 'open') returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  perform public.require_story_admin();
  if p_status not in ('new', 'read', 'done') then raise exception 'bad_status' using errcode = '22023'; end if;
  if r is not null and char_length(r) > 1000 then raise exception 'bad_reply' using errcode = '22023'; end if;
  update public.mayor_letters
     set status = p_status,
         reply = coalesce(r, reply),
         replied_at = case when r is not null then now() else replied_at end,
         replied_by = case when r is not null then auth.uid() else replied_by end,
         reply_seen_at = case when r is not null then null else reply_seen_at end
   where id = p_id;
  if not found then raise exception 'unknown_letter' using errcode = '22023'; end if;
  return public.admin_mayor_letters(p_filter);
end;
$$;

revoke all on function public.mayor_letters_state() from public, anon;
grant execute on function public.mayor_letters_state() to authenticated;
revoke all on function public.mayor_write(text, text, text) from public, anon;
grant execute on function public.mayor_write(text, text, text) to authenticated;
revoke all on function public.mayor_seen() from public, anon;
grant execute on function public.mayor_seen() to authenticated;
revoke all on function public.admin_mayor_letters(text) from public, anon;
grant execute on function public.admin_mayor_letters(text) to authenticated;
revoke all on function public.admin_mayor_letter(bigint, text, text, text) from public, anon;
grant execute on function public.admin_mayor_letter(bigint, text, text, text) to authenticated;
