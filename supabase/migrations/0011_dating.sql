-- v0.5 "Money and Social", part 4 (Clarifications section 14, Design Guide C40 and C41):
-- crushes (mutual only), crush invites and date nights. A light romance layer between
-- players who already know each other: a clique member, or someone with a two-way chat.
-- Nothing one-sided is ever revealed, and blocking cancels everything.

-- ---------------------------------------------------------------------------
-- Settings: the crush limit and the date-night bonus live in data (mirrored by lib/dating.ts).
-- ---------------------------------------------------------------------------
insert into public.game_settings (key, value) values
('dating', '{"maxCrushes": 3, "datesPerDay": 3, "dateMood": 10, "dateClout": 25}'::jsonb)
on conflict (key) do nothing;

alter table public.analytics_events drop constraint analytics_events_name_check;
alter table public.analytics_events add constraint analytics_events_name_check
  check (name in ('session', 'invite_shared', 'beat_shared', 'postcard_shared', 'crush_invite_shared'));

-- ---------------------------------------------------------------------------
-- Tables (RLS on, no policies: reads and writes only through the functions below)
-- ---------------------------------------------------------------------------
create table public.crushes (
  player_id  uuid not null references public.players (id) on delete cascade,
  target_id  uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, target_id),
  check (player_id <> target_id)
);
create index crushes_target_idx on public.crushes (target_id);

-- A mutual crush, once per pair (a < b), with when each side saw the "It's mutual" card.
create table public.crush_matches (
  a          uuid not null references public.players (id) on delete cascade,
  b          uuid not null references public.players (id) on delete cascade,
  matched_at timestamptz not null default now(),
  a_seen_at  timestamptz,
  b_seen_at  timestamptz,
  primary key (a, b),
  check (a < b)
);

create table public.date_nights (
  id            bigint generated always as identity primary key,
  host          uuid not null references public.players (id) on delete cascade,
  guest         uuid not null references public.players (id) on delete cascade,
  -- A dining place (a place with a meal) or a club event; never an exclusive event.
  kind          text not null check (kind in ('place', 'event')),
  target        text not null,
  -- The New York day it's for; it expires at midnight.
  ny_date       date not null,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  host_went_at  timestamptz,
  guest_went_at timestamptz,
  paid_at       timestamptz,
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (host <> guest)
);
-- One live date per pair per night, whichever of them asked.
create unique index date_nights_pair_day on public.date_nights (least(host, guest), greatest(host, guest), ny_date)
  where status in ('pending', 'accepted');
create index date_nights_guest_idx on public.date_nights (guest, ny_date);
create index date_nights_host_idx on public.date_nights (host, ny_date);

alter table public.crushes enable row level security;
alter table public.crush_matches enable row level security;
alter table public.date_nights enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.is_blocked_pair(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.blocks where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a)) $$;

/** Connected: a clique member (an invite either way) or at least one two-way chat. */
create function public.is_connected(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_a <> p_b and (
    exists (select 1 from public.invites where (inviter_id = p_a and invitee_id = p_b) or (inviter_id = p_b and invitee_id = p_a))
    or exists (select 1 from public.conversations c
                where c.a = least(p_a, p_b) and c.b = greatest(p_a, p_b)
                  and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender = p_a)
                  and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender = p_b)))
$$;

create function public.is_matched(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.crushes where player_id = p_a and target_id = p_b)
     and exists (select 1 from public.crushes where player_id = p_b and target_id = p_a)
$$;

/** A date target: a place with a meal, or a club event. Null when it isn't one. */
create function public.date_target(p_kind text, p_target text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case p_kind
    when 'place' then (
      select jsonb_build_object('placeId', p ->> 'id', 'price', (a ->> 'price')::int)
        from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
       where p ->> 'id' = p_target and a ->> 'kind' = 'eat'
         and (p ->> 'story' is null or public.arc_started(p ->> 'story'))
       limit 1)
    when 'event' then (
      select jsonb_build_object('placeId', e ->> 'placeId', 'price', (e ->> 'entry')::int)
        from jsonb_array_elements(public.city() -> 'events') e where e ->> 'id' = p_target)
  end
$$;

/**
 * Pays the date-night bonus once both have gone to an accepted date: Mood and a
 * little clout, each player at most once per New York day (ledger kind 'date_night').
 */
create function public.date_settle(p_date bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  d public.date_nights;
  cfg jsonb := public.game_settings_value('dating');
  who uuid;
begin
  select * into d from public.date_nights where id = p_date for update;
  if d.id is null or d.status <> 'accepted' or d.host_went_at is null or d.guest_went_at is null or d.paid_at is not null then return; end if;
  foreach who in array array[d.host, d.guest] loop
    if public.ledger_once(who, 'clout', (cfg ->> 'dateClout')::int, 'date_night', d.ny_date::text) then
      update public.players
         set clout = clout + (cfg ->> 'dateClout')::int, mood = least(100, mood + (cfg ->> 'dateMood')::int)
       where id = who;
    end if;
  end loop;
  update public.date_nights set paid_at = clock_timestamp() where id = d.id;
end;
$$;

/** Marks who has gone on a live date tonight; called from the visit and attendance triggers. */
create function public.date_went(p_player uuid, p_kind text, p_target text, p_day date) returns void
language plpgsql security definer set search_path = public
as $$
declare d public.date_nights;
begin
  for d in select * from public.date_nights
            where ny_date = p_day and kind = p_kind and target = p_target and status in ('pending', 'accepted')
              and p_player in (host, guest) for update loop
    update public.date_nights
       set host_went_at = case when host = p_player then coalesce(host_went_at, clock_timestamp()) else host_went_at end,
           guest_went_at = case when guest = p_player then coalesce(guest_went_at, clock_timestamp()) else guest_went_at end
     where id = d.id;
    perform public.date_settle(d.id);
  end loop;
end;
$$;

create function public.date_visit_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.date_went(new.player_id, 'place', new.place_id, new.ny_date);
  return new;
end;
$$;
create trigger place_visits_date after insert or update on public.place_visits
  for each row execute function public.date_visit_trigger();

create function public.date_event_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.date_went(new.player_id, 'event', new.event_id, new.ny_date);
  return new;
end;
$$;
create trigger event_attendance_date after insert on public.event_attendance
  for each row execute function public.date_event_trigger();

/** Blocking cancels everything between the two: crushes both ways, the match, and live dates. */
create function public.block_dating_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.crushes where (player_id = new.blocker and target_id = new.blocked) or (player_id = new.blocked and target_id = new.blocker);
  delete from public.crush_matches where a = least(new.blocker, new.blocked) and b = greatest(new.blocker, new.blocked);
  update public.date_nights set status = 'cancelled', responded_at = now()
   where status in ('pending', 'accepted')
     and ((host = new.blocker and guest = new.blocked) or (host = new.blocked and guest = new.blocker));
  return new;
end;
$$;
create trigger blocks_dating after insert on public.blocks
  for each row execute function public.block_dating_trigger();

-- ---------------------------------------------------------------------------
-- Crushes (C40)
-- ---------------------------------------------------------------------------
/** What the crush button shows on this player: whether it can appear, and my side only. */
create function public.crush_status(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'eligible', public.is_connected(auth.uid(), p_player) and not public.is_blocked_pair(auth.uid(), p_player)
                and exists (select 1 from public.players where id = p_player and banned_at is null),
    'crushed', exists (select 1 from public.crushes where player_id = auth.uid() and target_id = p_player),
    'matched', public.is_matched(auth.uid(), p_player),
    'count', (select count(*) from public.crushes where player_id = auth.uid()),
    'max', (public.game_settings_value('dating') ->> 'maxCrushes')::int);
$$;

create function public.crush_toggle(p_player uuid, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if p_on then
    if not exists (select 1 from public.players where id = p_player and banned_at is null) then raise exception 'unknown_player' using errcode = '22023'; end if;
    if public.is_blocked_pair(uid, p_player) then raise exception 'blocked' using errcode = '42501'; end if;
    if not public.is_connected(uid, p_player) then raise exception 'not_connected' using errcode = '22023'; end if;
    -- Serialize one player's crushes so the limit holds.
    perform 1 from public.players where id = uid for update;
    if not exists (select 1 from public.crushes where player_id = uid and target_id = p_player) then
      select count(*) into n from public.crushes where player_id = uid;
      if n >= (public.game_settings_value('dating') ->> 'maxCrushes')::int then raise exception 'crush_limit' using errcode = '22023'; end if;
      insert into public.crushes (player_id, target_id) values (uid, p_player);
    end if;
    if public.is_matched(uid, p_player) then
      insert into public.crush_matches (a, b) values (least(uid, p_player), greatest(uid, p_player)) on conflict do nothing;
    end if;
  else
    delete from public.crushes where player_id = uid and target_id = p_player;
    -- A crush taken back ends the match; crushing again would reveal it afresh.
    delete from public.crush_matches where a = least(uid, p_player) and b = greatest(uid, p_player);
  end if;
  return public.crush_status(p_player);
end;
$$;

/** The "It's mutual" card has been seen (or dismissed). */
create function public.match_seen(p_player uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.crush_matches
     set a_seen_at = case when a = auth.uid() then coalesce(a_seen_at, now()) else a_seen_at end,
         b_seen_at = case when b = auth.uid() then coalesce(b_seen_at, now()) else b_seen_at end
   where a = least(auth.uid(), p_player) and b = greatest(auth.uid(), p_player);
$$;

-- ---------------------------------------------------------------------------
-- Date nights (C41)
-- ---------------------------------------------------------------------------
/** Who I can ask: matches first, then clique and two-way chats. Nobody blocked either way. */
create function public.date_candidates()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style,
                                               'matched', public.is_matched(auth.uid(), p.id),
                                               'crush', exists (select 1 from public.crushes c where c.player_id = auth.uid() and c.target_id = p.id))
                            order by public.is_matched(auth.uid(), p.id) desc, p.display_name), '[]')
    from public.players p
   where p.id <> auth.uid() and p.banned_at is null and p.home_id is not null
     and public.is_connected(auth.uid(), p.id) and not public.is_blocked_pair(auth.uid(), p.id);
$$;

create function public.date_invite(p_with uuid, p_kind text, p_target text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  new_id bigint;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if not exists (select 1 from public.players where id = p_with and banned_at is null and home_id is not null) then raise exception 'unknown_player' using errcode = '22023'; end if;
  if public.is_blocked_pair(uid, p_with) then raise exception 'blocked' using errcode = '42501'; end if;
  if not public.is_connected(uid, p_with) then raise exception 'not_connected' using errcode = '22023'; end if;
  if public.date_target(p_kind, p_target) is null then raise exception 'not_a_date_spot' using errcode = '22023'; end if;
  perform 1 from public.players where id = uid for update;
  if (select count(*) from public.date_nights where host = uid and ny_date = today)
     >= (public.game_settings_value('dating') ->> 'datesPerDay')::int then
    raise exception 'date_limit' using errcode = '22023';
  end if;
  begin
    insert into public.date_nights (host, guest, kind, target, ny_date) values (uid, p_with, p_kind, p_target, today)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'date_exists' using errcode = '22023';
  end;
  -- Already there tonight? That counts.
  if exists (select 1 from public.place_visits v where p_kind = 'place' and v.player_id = uid and v.place_id = p_target and v.ny_date = today)
     or exists (select 1 from public.event_attendance v where p_kind = 'event' and v.player_id = uid and v.event_id = p_target and v.ny_date = today) then
    update public.date_nights set host_went_at = clock_timestamp() where id = new_id;
  end if;
  return new_id;
end;
$$;

/** "I'm in" or "Not tonight". Only the guest answers, and only on the night itself. */
create function public.date_respond(p_date bigint, p_yes boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  d public.date_nights;
  today date := public.ny_today();
begin
  select * into d from public.date_nights where id = p_date and guest = auth.uid() for update;
  if d.id is null then raise exception 'unknown_date' using errcode = '22023'; end if;
  if d.status <> 'pending' then raise exception 'date_answered' using errcode = '22023'; end if;
  if d.ny_date <> today then raise exception 'date_expired' using errcode = '22023'; end if;
  update public.date_nights
     set status = case when p_yes then 'accepted' else 'declined' end, responded_at = now(),
         guest_went_at = case when p_yes and (
             exists (select 1 from public.place_visits v where d.kind = 'place' and v.player_id = d.guest and v.place_id = d.target and v.ny_date = today)
             or exists (select 1 from public.event_attendance v where d.kind = 'event' and v.player_id = d.guest and v.event_id = d.target and v.ny_date = today))
           then coalesce(guest_went_at, clock_timestamp()) else guest_went_at end
   where id = d.id;
  perform public.date_settle(d.id);
end;
$$;

/** The host calls it off (before or after the answer). */
create function public.date_cancel(p_date bigint)
returns void
language sql security definer set search_path = public
as $$
  update public.date_nights set status = 'cancelled', responded_at = now()
   where id = p_date and host = auth.uid() and status in ('pending', 'accepted') and paid_at is null;
$$;

/**
 * Everything the dating layer shows, in one call: unseen "It's mutual" cards, tonight's
 * dates (sent and received; declined ones only to their host), my matches (for the chat
 * "Matched" tag) and my crush count. Nothing about who crushed on me.
 */
create function public.dating_inbox()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'matches', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.display_name, 'style', o.starting_style,
                                                             'seen', case when m.a = auth.uid() then m.a_seen_at else m.b_seen_at end is not null)
                                          order by m.matched_at desc), '[]')
                  from public.crush_matches m
                  join public.players o on o.id = case when m.a = auth.uid() then m.b else m.a end
                 where auth.uid() in (m.a, m.b) and o.banned_at is null),
    'dates', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', d.id, 'mine', d.host = auth.uid(), 'kind', d.kind, 'target', d.target, 'status', d.status,
                  'with', jsonb_build_object('id', o.id, 'name', o.display_name, 'style', o.starting_style),
                  'price', (public.date_target(d.kind, d.target) ->> 'price')::int,
                  'placeId', public.date_target(d.kind, d.target) ->> 'placeId',
                  'iWent', case when d.host = auth.uid() then d.host_went_at else d.guest_went_at end is not null,
                  'theyWent', case when d.host = auth.uid() then d.guest_went_at else d.host_went_at end is not null,
                  'paid', d.paid_at is not null,
                  'matched', public.is_matched(auth.uid(), o.id)) order by d.created_at desc), '[]')
                from public.date_nights d
                join public.players o on o.id = case when d.host = auth.uid() then d.guest else d.host end
               where auth.uid() in (d.host, d.guest) and d.ny_date = public.ny_today()
                 and d.status <> 'cancelled' and (d.status <> 'declined' or d.host = auth.uid())
                 and o.banned_at is null),
    'crushes', (select count(*) from public.crushes where player_id = auth.uid()),
    'max', (public.game_settings_value('dating') ->> 'maxCrushes')::int,
    'bonus', jsonb_build_object('mood', (public.game_settings_value('dating') ->> 'dateMood')::int,
                                'clout', (public.game_settings_value('dating') ->> 'dateClout')::int));
$$;

-- The player card says whether the crush button can show (C40).
create or replace function public.player_card(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'style', p.starting_style, 'clout', p.clout, 'homeId', p.home_id,
    'badges', (select count(*) from public.player_badges b where b.player_id = p.id),
    'joined', p.created_at,
    'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = p.id),
    'isMe', p.id = auth.uid(),
    'crush', case when p.id <> auth.uid() then public.crush_status(p.id) end)
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.crush_status(uuid)', 'public.crush_toggle(uuid, boolean)', 'public.match_seen(uuid)', 'public.date_candidates()',
    'public.date_invite(uuid, text, text)', 'public.date_respond(bigint, boolean)', 'public.date_cancel(bigint)', 'public.dating_inbox()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.is_blocked_pair(uuid, uuid)', 'public.is_connected(uuid, uuid)', 'public.is_matched(uuid, uuid)',
    'public.date_target(text, text)', 'public.date_settle(bigint)', 'public.date_went(uuid, text, text, date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
