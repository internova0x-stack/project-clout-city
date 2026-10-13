-- Crew outings (product owner, Oct 13, 2026): from any place card, one tap invites the
-- crew (the friends you invited or who invited you; called "clique" in older code and
-- tables) to the same activity tonight. Everyone who goes gets a small bonus for each
-- friend who also goes, and a big bonus when the host and 5 friends all go. Like date
-- nights, it's asynchronous: each person goes whenever they're on before New York midnight.
-- Only virtual-cash or free activities: visits, meals, hangouts, lectures, and club or
-- campus events. Never exclusive (real-money) events, the gigs board, shifts or story actions.

-- ---------------------------------------------------------------------------
-- Settings (mirrored by lib/crew.ts)
-- ---------------------------------------------------------------------------
insert into public.game_settings (key, value) values
('crew', '{"maxInvites": 5, "outingsPerDay": 3, "perFriendClout": 10, "fullClout": 100, "fullMood": 10, "fullSize": 6}'::jsonb)
on conflict (key) do nothing;

alter table public.analytics_events drop constraint analytics_events_name_check;
alter table public.analytics_events add constraint analytics_events_name_check
  check (name in ('session', 'invite_shared', 'beat_shared', 'postcard_shared', 'crush_invite_shared', 'crew_outing_sent'));

-- ---------------------------------------------------------------------------
-- Tables (RLS on, no policies: reads and writes only through the functions below)
-- ---------------------------------------------------------------------------
create table public.crew_outings (
  id         bigint generated always as identity primary key,
  host       uuid not null references public.players (id) on delete cascade,
  kind       text not null check (kind in ('place', 'event')),
  place_id   text not null,
  -- The place's action id, or the event id.
  activity   text not null,
  ny_date    date not null,
  full_at    timestamptz,
  created_at timestamptz not null default now()
);
create unique index crew_outings_one_per_activity on public.crew_outings (host, ny_date, kind, activity, place_id);
create index crew_outings_day_idx on public.crew_outings (ny_date, place_id, activity);

create table public.crew_outing_members (
  outing_id bigint not null references public.crew_outings (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status    text not null default 'invited' check (status in ('host', 'invited', 'in', 'declined')),
  went_at   timestamptz,
  primary key (outing_id, player_id)
);
create index crew_outing_members_player_idx on public.crew_outing_members (player_id);

alter table public.crew_outings enable row level security;
alter table public.crew_outing_members enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** The crew: everyone you invited and whoever invited you, minus blocks either way and banned players. */
create function public.crew_of(p_player uuid)
returns table (id uuid)
language sql stable security definer set search_path = public
as $$
  select p.id from public.players p
   where p.banned_at is null and p.home_id is not null and p.id <> p_player
     and (p.id in (select invitee_id from public.invites where inviter_id = p_player)
          or p.id in (select inviter_id from public.invites where invitee_id = p_player))
     and not public.is_blocked_pair(p_player, p.id)
$$;

/** What an outing can be: a free or virtual-cash visit, meal, hangout or lecture, or a club or campus event. */
create function public.crew_activity(p_kind text, p_place text, p_activity text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case p_kind
    when 'place' then (
      select jsonb_build_object('price', coalesce((a ->> 'price')::int, 0))
        from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
       where p ->> 'id' = p_place and a ->> 'id' = p_activity
         and a ->> 'kind' in ('visit', 'eat', 'hangout')
         and not coalesce((a ->> 'storyUnlock')::boolean, false)
         and (p ->> 'story' is null or public.arc_started(p ->> 'story'))
       limit 1)
    when 'event' then (
      select jsonb_build_object('price', (e ->> 'entry')::int)
        from jsonb_array_elements(public.city() -> 'events') e
       where e ->> 'id' = p_activity and e ->> 'placeId' = p_place)
  end
$$;

/**
 * A member did the outing's activity. Everyone who has gone gets +perFriend for each
 * other friend who also went (each pair once per New York day, across outings), and when
 * the host and all friends have gone (fullSize), each gets the full-crew bonus once a day.
 */
create function public.crew_went(p_player uuid, p_place text, p_activity text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('crew');
  per int := (cfg ->> 'perFriendClout')::int;
  today date := public.ny_today();
  o public.crew_outings;
  other uuid;
  m record;
begin
  for o in select x.* from public.crew_outings x
             join public.crew_outing_members mm on mm.outing_id = x.id and mm.player_id = p_player
            where x.ny_date = today and x.place_id = p_place and x.activity = p_activity
              and mm.status <> 'declined' and mm.went_at is null
            for update of x loop
    -- Going counts as saying yes.
    update public.crew_outing_members
       set went_at = clock_timestamp(), status = case when status = 'invited' then 'in' else status end
     where outing_id = o.id and player_id = p_player;
    -- The small bonus, both ways, for every friend who already went.
    for other in select player_id from public.crew_outing_members
                  where outing_id = o.id and went_at is not null and player_id <> p_player loop
      if public.ledger_once(p_player, 'clout', per, 'crew_friend', today || ':' || other) then
        update public.players set clout = clout + per where id = p_player;
      end if;
      if public.ledger_once(other, 'clout', per, 'crew_friend', today || ':' || p_player) then
        update public.players set clout = clout + per where id = other;
      end if;
    end loop;
    -- The big bonus when the whole crew went.
    if o.full_at is null and (select count(*) from public.crew_outing_members where outing_id = o.id and went_at is not null)
                             >= (cfg ->> 'fullSize')::int then
      update public.crew_outings set full_at = clock_timestamp() where id = o.id;
      for m in select player_id from public.crew_outing_members where outing_id = o.id and went_at is not null loop
        if public.ledger_once(m.player_id, 'clout', (cfg ->> 'fullClout')::int, 'crew_full', today::text) then
          update public.players
             set clout = clout + (cfg ->> 'fullClout')::int, mood = least(100, mood + (cfg ->> 'fullMood')::int)
           where id = m.player_id;
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

-- do_action and attend_event both report what was done through complete_task; it now
-- also tells crew outings (same body as 0004, plus the last line).
create or replace function public.complete_task(p_player uuid, p_place text, p_action text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  t record;
  bonus int := (public.city() -> 'economy' -> 'dailyTasks' ->> 'bonus')::int;
  paid int := 0;
begin
  perform public.crew_went(p_player, p_place, p_action);
  select * into t from public.daily_tasks
   where player_id = p_player and ny_date = today and place_id = p_place and action_id = p_action and done_at is null
   order by slot limit 1 for update;
  if t.id is null then return 0; end if;
  update public.daily_tasks set done_at = now() where id = t.id;
  if public.ledger_once(p_player, 'cash', t.reward, 'daily_task', t.id::text) then
    update public.players set bank_cash = bank_cash + t.reward where id = p_player;
    paid := t.reward;
  end if;
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today and done_at is null)
     and public.ledger_once(p_player, 'cash', bonus, 'daily_bonus', today::text) then
    update public.players set bank_cash = bank_cash + bonus where id = p_player;
    paid := paid + bonus;
  end if;
  return paid;
end;
$$;

/** Blocking takes the blocked player out of the blocker's outings, both ways. */
create function public.block_crew_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.crew_outing_members m set status = 'declined'
    from public.crew_outings o
   where o.id = m.outing_id and o.ny_date >= public.ny_today() and m.went_at is null
     and ((o.host = new.blocker and m.player_id = new.blocked) or (o.host = new.blocked and m.player_id = new.blocker));
  return new;
end;
$$;
create trigger blocks_crew after insert on public.blocks
  for each row execute function public.block_crew_trigger();

-- ---------------------------------------------------------------------------
-- Player functions
-- ---------------------------------------------------------------------------
create function public.crew_members()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style) order by p.display_name), '[]')
    from public.players p where p.id in (select id from public.crew_of(auth.uid()));
$$;

create function public.crew_outing_create(p_kind text, p_place text, p_activity text, p_members uuid[])
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('crew');
  today date := public.ny_today();
  members uuid[] := array(select distinct unnest(coalesce(p_members, '{}')));
  new_id bigint;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if public.crew_activity(p_kind, p_place, p_activity) is null then raise exception 'not_a_crew_activity' using errcode = '22023'; end if;
  if cardinality(members) = 0 then raise exception 'no_crew' using errcode = '22023'; end if;
  if cardinality(members) > (cfg ->> 'maxInvites')::int then raise exception 'too_many' using errcode = '22023'; end if;
  if exists (select 1 from unnest(members) m where m not in (select id from public.crew_of(uid))) then
    raise exception 'not_in_crew' using errcode = '22023';
  end if;
  perform 1 from public.players where id = uid for update;
  if (select count(*) from public.crew_outings where host = uid and ny_date = today) >= (cfg ->> 'outingsPerDay')::int then
    raise exception 'outing_limit' using errcode = '22023';
  end if;
  begin
    insert into public.crew_outings (host, kind, place_id, activity, ny_date) values (uid, p_kind, p_place, p_activity, today)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'outing_exists' using errcode = '22023';
  end;
  insert into public.crew_outing_members (outing_id, player_id, status) values (new_id, uid, 'host');
  insert into public.crew_outing_members (outing_id, player_id) select new_id, m from unnest(members) m;
  -- Already did it today? That counts for the host.
  if (p_kind = 'place' and exists (select 1 from public.place_visits v where v.player_id = uid and v.place_id = p_place and v.ny_date = today))
     or (p_kind = 'event' and exists (select 1 from public.event_attendance v where v.player_id = uid and v.event_id = p_activity and v.ny_date = today)) then
    update public.crew_outing_members set went_at = clock_timestamp() where outing_id = new_id and player_id = uid;
  end if;
  insert into public.analytics_events (player_id, name, ny_date) values (uid, 'crew_outing_sent', today) on conflict do nothing;
  return new_id;
end;
$$;

/** "I'm in" or "Not tonight", on the night itself. */
create function public.crew_respond(p_outing bigint, p_yes boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  o public.crew_outings;
  m public.crew_outing_members;
begin
  select * into o from public.crew_outings where id = p_outing;
  select * into m from public.crew_outing_members where outing_id = p_outing and player_id = auth.uid() for update;
  if o.id is null or m.player_id is null or m.status = 'host' then raise exception 'unknown_outing' using errcode = '22023'; end if;
  if o.ny_date <> public.ny_today() then raise exception 'outing_expired' using errcode = '22023'; end if;
  if m.went_at is not null then return; end if;
  update public.crew_outing_members set status = case when p_yes then 'in' else 'declined' end
   where outing_id = p_outing and player_id = auth.uid();
  -- Went before answering yes: count it now.
  if p_yes and ((o.kind = 'place' and exists (select 1 from public.place_visits v where v.player_id = auth.uid() and v.place_id = o.place_id and v.ny_date = o.ny_date))
             or (o.kind = 'event' and exists (select 1 from public.event_attendance v where v.player_id = auth.uid() and v.event_id = o.activity and v.ny_date = o.ny_date))) then
    perform public.crew_went(auth.uid(), o.place_id, o.activity);
  end if;
end;
$$;

/** Tonight's outings I'm part of (declines hidden from the decliner), with who has gone. */
create function public.crew_inbox()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'outings', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'kind', o.kind, 'placeId', o.place_id, 'activity', o.activity,
        'price', (public.crew_activity(o.kind, o.place_id, o.activity) ->> 'price')::int,
        'mine', o.host = auth.uid(), 'full', o.full_at is not null,
        'myStatus', me.status, 'iWent', me.went_at is not null,
        'host', (select jsonb_build_object('id', h.id, 'name', h.display_name, 'style', h.starting_style) from public.players h where h.id = o.host),
        'members', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style,
                                                                  'status', mm.status, 'went', mm.went_at is not null)
                                              order by (mm.status = 'host') desc, mm.went_at nulls last, p.display_name), '[]')
                      from public.crew_outing_members mm join public.players p on p.id = mm.player_id
                     where mm.outing_id = o.id and p.banned_at is null)
      ) order by o.id desc), '[]')
      from public.crew_outings o
      join public.crew_outing_members me on me.outing_id = o.id and me.player_id = auth.uid()
     where o.ny_date = public.ny_today() and me.status <> 'declined'),
    'clout', (select coalesce(sum(amount), 0) from public.ledger
               where player_id = auth.uid() and kind in ('crew_friend', 'crew_full') and ref like public.ny_today() || '%'),
    'settings', public.game_settings_value('crew'));
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.crew_members()', 'public.crew_outing_create(text, text, text, uuid[])', 'public.crew_respond(bigint, boolean)', 'public.crew_inbox()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.crew_of(uuid)', 'public.crew_activity(text, text, text)', 'public.crew_went(uuid, text, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
