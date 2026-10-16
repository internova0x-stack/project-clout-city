-- Repair for v0.14 Real Clout FM (owner, Oct 16 testing): on the live database migration 0057 only partly
-- ran (the radio_shoutouts table exists, radio_state() didn't), so the Radio app couldn't load. This file
-- is 0057 made safe to run again: every function is "create or replace", the table, index and settings
-- are "if not exists" / "on conflict do nothing". Nothing here changes the rules in 0057.
-- Safe to run more than once, and harmless where 0057 ran in full.

insert into public.game_settings (key, value) values
  ('radio', '{"dailyCap": 50, "wallMax": 5, "airHour": 9, "messageMax": 140, "handleMax": 30}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.radio_shoutouts (
  id bigserial primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  handle text not null check (handle ~ '^[A-Za-z0-9._]{1,30}$'),
  message text not null check (char_length(message) between 1 and 140),
  ny_date date not null,
  -- 'pending' past its day reads as 'not_picked' (radio_status).
  status text not null default 'pending' check (status in ('pending', 'on_air', 'wall', 'rejected')),
  owner_confirmed boolean not null check (owner_confirmed),
  aired_at timestamptz,
  reviewed_by uuid references public.players (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, ny_date)
);
create index if not exists radio_shoutouts_day_idx on public.radio_shoutouts (ny_date, status);
alter table public.radio_shoutouts enable row level security;
-- No policies: players and the Studio go through the functions below.

/** When a New York day's show airs (9 a.m. New York, as a timestamp). */
create or replace function public.radio_air_time(p_date date) returns timestamptz
language sql stable security definer set search_path = public
as $$ select (p_date + make_interval(hours => (public.game_settings_value('radio') ->> 'airHour')::int)) at time zone 'America/New_York' $$;

/** A shoutout's status as players and the Studio see it: a request left waiting past its day wasn't picked. */
create or replace function public.radio_status(s public.radio_shoutouts) returns text
language sql stable security definer set search_path = public
as $$ select case when s.status = 'pending' and s.ny_date < public.ny_today() then 'not_picked' else s.status end $$;

/** A shoutout as players see it (no player id: the @handle is what's public). */
create or replace function public.radio_public(s public.radio_shoutouts) returns jsonb
language sql stable security definer set search_path = public
as $$ select jsonb_build_object('id', s.id, 'handle', s.handle, 'message', s.message, 'date', s.ny_date, 'airedAt', s.aired_at) $$;

/**
 * The Radio app: the show on air now (today's once it has aired, else the last one), its wall, the
 * player's latest request, and today's list (how many are left, whether it's full).
 */
create or replace function public.radio_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('radio');
  today date := public.ny_today();
  air public.radio_shoutouts;
  mine public.radio_shoutouts;
  taken int;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into air from public.radio_shoutouts
   where status = 'on_air' and ny_date <= today and coalesce(aired_at, public.radio_air_time(ny_date)) <= public.game_now()
   order by ny_date desc limit 1;
  select * into mine from public.radio_shoutouts where player_id = uid order by ny_date desc limit 1;
  select count(*) into taken from public.radio_shoutouts where ny_date = today;
  return jsonb_build_object(
    'today', today,
    'airsAt', public.radio_air_time(today),
    'onAir', case when air.id is null then null else public.radio_public(air) end,
    'wall', (select coalesce(jsonb_agg(public.radio_public(w) order by w.reviewed_at), '[]')
               from public.radio_shoutouts w where air.id is not null and w.ny_date = air.ny_date and w.status = 'wall'),
    'mine', case when mine.id is null then null
                 else public.radio_public(mine) || jsonb_build_object('status', public.radio_status(mine)) end,
    'requestedToday', mine.id is not null and mine.ny_date = today,
    'left', greatest(0, (cfg ->> 'dailyCap')::int - taken),
    'messageMax', (cfg ->> 'messageMax')::int,
    -- The chat word list, so the request form can mask words as they're typed (the server masks again).
    'words', coalesce(public.game_settings_value('chat') -> 'words', '[]'));
end;
$$;

/** Requests a shoutout for today. The handle must be the player's own (they confirm it). */
create or replace function public.radio_request(p_handle text, p_message text, p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('radio');
  today date := public.ny_today();
  me public.players;
  h text := regexp_replace(btrim(coalesce(p_handle, '')), '^@', '');
  msg text := regexp_replace(btrim(coalesce(p_message, '')), '\s+', ' ', 'g');
  row_ public.radio_shoutouts;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null or coalesce(me.chat_muted_until > now(), false) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'confirm_handle' using errcode = '22023'; end if;
  if h !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'bad_handle' using errcode = '22023'; end if;
  if msg = '' or char_length(msg) > (cfg ->> 'messageMax')::int then raise exception 'bad_message' using errcode = '22023'; end if;
  -- Shoutouts naming or tagging someone else are refused (owner): no @ in the message.
  if msg like '%@%' then raise exception 'no_tags' using errcode = '22023'; end if;
  if exists (select 1 from public.radio_shoutouts where player_id = uid and ny_date = today) then raise exception 'already_requested' using errcode = '22023'; end if;
  -- The day's list: the first dailyCap requests (locked so two can't take the last place).
  perform pg_advisory_xact_lock(hashtext('radio:' || today));
  if (select count(*) from public.radio_shoutouts where ny_date = today) >= (cfg ->> 'dailyCap')::int then
    raise exception 'list_full' using errcode = '22023';
  end if;
  insert into public.radio_shoutouts (player_id, handle, message, ny_date, owner_confirmed)
  values (uid, h, public.chat_filter(msg), today, true)
  returning * into row_;
  return public.radio_public(row_) || jsonb_build_object('status', 'pending');
end;
$$;

/** Reports a shoutout on air or on the wall: it goes to the Studio's Reports queue with the message quoted. */
create or replace function public.radio_report(p_shoutout bigint, p_reason text, p_note text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.radio_shoutouts;
begin
  select * into s from public.radio_shoutouts where id = p_shoutout and status in ('on_air', 'wall');
  if uid is null or s.id is null or s.player_id = uid then raise exception 'unknown_shoutout' using errcode = '22023'; end if;
  insert into public.reports (reporter, reported, reason, note)
  values (uid, s.player_id, p_reason,
          left('[Real Clout FM shoutout, ' || s.ny_date || '] @' || s.handle || ': "' || s.message || '"'
               || coalesce(' · ' || nullif(btrim(p_note), ''), ''), 500));
end;
$$;

-- ---------------------------------------------------------------------------
-- Story Studio: the Shoutouts queue
-- ---------------------------------------------------------------------------
/** A day's requests in the order they came in, with the player behind each @handle. */
create or replace function public.admin_shoutouts(p_date date default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d date := coalesce(p_date, public.ny_today());
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'date', d,
    'airsAt', public.radio_air_time(d),
    'cap', (public.game_settings_value('radio') ->> 'dailyCap')::int,
    'wallMax', (public.game_settings_value('radio') ->> 'wallMax')::int,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'handle', s.handle, 'message', s.message, 'status', public.radio_status(s), 'at', s.created_at,
        'airedAt', s.aired_at, 'player', jsonb_build_object('id', p.id, 'name', p.display_name))
      order by s.created_at), '[]')
      from public.radio_shoutouts s join public.players p on p.id = s.player_id
      where s.ny_date = d));
end;
$$;

/**
 * air: today's on-air shoutout (it replaces the one picked before, which goes back to waiting); it airs
 * at 9 a.m. New York, or at once if that has passed. wall: one of the day's few more. reject. pending:
 * undo a pick.
 */
create or replace function public.admin_shoutout_action(p_id bigint, p_action text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s public.radio_shoutouts;
begin
  perform public.require_story_admin();
  if p_action not in ('air', 'wall', 'reject', 'pending') then raise exception 'bad_action' using errcode = '22023'; end if;
  select * into s from public.radio_shoutouts where id = p_id for update;
  if s.id is null then raise exception 'unknown_shoutout' using errcode = '22023'; end if;
  if p_action in ('air', 'wall', 'pending') and s.ny_date < public.ny_today() then raise exception 'day_over' using errcode = '22023'; end if;
  if p_action = 'air' then
    update public.radio_shoutouts set status = 'pending', aired_at = null where ny_date = s.ny_date and status = 'on_air' and id <> s.id;
    update public.radio_shoutouts
       set status = 'on_air', aired_at = greatest(public.game_now(), public.radio_air_time(s.ny_date)), reviewed_by = auth.uid(), reviewed_at = now()
     where id = s.id;
  elsif p_action = 'wall' then
    if s.status <> 'wall' and (select count(*) from public.radio_shoutouts where ny_date = s.ny_date and status = 'wall')
                              >= (public.game_settings_value('radio') ->> 'wallMax')::int then
      raise exception 'wall_full' using errcode = '22023';
    end if;
    update public.radio_shoutouts set status = 'wall', aired_at = null, reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
  else
    update public.radio_shoutouts
       set status = case p_action when 'reject' then 'rejected' else 'pending' end, aired_at = null, reviewed_by = auth.uid(), reviewed_at = now()
     where id = s.id;
  end if;
  return public.admin_shoutouts(s.ny_date);
end;
$$;

revoke all on function public.radio_air_time(date) from public, anon, authenticated;
revoke all on function public.radio_status(public.radio_shoutouts) from public, anon, authenticated;
revoke all on function public.radio_public(public.radio_shoutouts) from public, anon, authenticated;
revoke all on function public.radio_state() from public, anon;
revoke all on function public.radio_request(text, text, boolean) from public, anon;
revoke all on function public.radio_report(bigint, text, text) from public, anon;
revoke all on function public.admin_shoutouts(date) from public, anon;
revoke all on function public.admin_shoutout_action(bigint, text) from public, anon;
grant execute on function public.radio_state() to authenticated;
grant execute on function public.radio_request(text, text, boolean) to authenticated;
grant execute on function public.radio_report(bigint, text, text) to authenticated;
grant execute on function public.admin_shoutouts(date) to authenticated;
grant execute on function public.admin_shoutout_action(bigint, text) to authenticated;
