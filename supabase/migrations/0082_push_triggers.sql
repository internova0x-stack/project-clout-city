-- Push notifications step 2 (owner, Oct 18; spec section 20): the P0 and P1 triggers.
--   * P0, someone is waiting: row triggers queue a push the moment it happens (a message, a match, a date invite,
--     a crew outing invite, a ride, a together invite, a friend joining with your invite).
--   * P1, something expires or costs you: push_scan() looks for them each time the sender runs (/api/push/run):
--     bills due and late, a gig ready, a full till, a streak about to end, exams open and their last day, a party
--     ticket about to start.
-- push_enqueue only queues for players with a device and once per key, and lib/push.ts decides what actually goes
-- out (caps, quiet hours, merging). A trigger never breaks the game action it watches: errors are swallowed.
-- Safe to run more than once.

/** A player's name for push copy. */
create or replace function public.push_name(p uuid) returns text
language sql stable security definer set search_path = public
as $$ select coalesce((select display_name from public.players where id = p), 'Someone') $$;

/** A place's or event's name from the city catalog. */
create or replace function public.push_place(p_id text) returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select x ->> 'name' from jsonb_array_elements(public.city() -> 'places') x where x ->> 'id' = p_id),
    (select x ->> 'name' from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_id),
    'somewhere good')
$$;

/** Midnight at the end of a New York day: when today's invites stop mattering. */
create or replace function public.push_day_end(p_day date) returns timestamptz
language sql immutable as $$ select ((p_day + 1)::timestamp at time zone 'America/New_York') $$;

/** A crush match or crew: their pushes score a little higher (lib/push.ts closeBonus). */
create or replace function public.push_close(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.crush_matches where a = least(p_a, p_b) and b = greatest(p_a, p_b))
      or p_b in (select id from public.crew_of(p_a))
$$;

-- ---------------------------------------------------------------------------
-- P0: someone is waiting on you
-- ---------------------------------------------------------------------------
create or replace function public.push_on_message() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  to_id uuid;
begin
  if new.kind <> 'text' or new.hidden then return null; end if;
  select case when c.a = new.sender then c.b else c.a end into to_id from public.conversations c where c.id = new.conversation_id;
  if to_id is null then return null; end if;
  perform public.push_enqueue(to_id, 'message', 'msg:' || new.id, '💬 ' || public.push_name(new.sender), left(new.body, 120),
    '/home?open=messages', null, public.push_close(to_id, new.sender), 'chat:' || new.sender);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_message on public.messages;
create trigger push_message after insert on public.messages for each row execute function public.push_on_message();

create or replace function public.push_on_match() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(new.a, 'crush_match', 'match:' || new.a || ':' || new.b, '💘 It''s a match',
    public.push_name(new.b) || ' has a crush on you too. Ask them out before someone else does.', '/home?open=messages', null, true);
  perform public.push_enqueue(new.b, 'crush_match', 'match:' || new.a || ':' || new.b, '💘 It''s a match',
    public.push_name(new.a) || ' has a crush on you too. Ask them out before someone else does.', '/home?open=messages', null, true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_match on public.crush_matches;
create trigger push_match after insert on public.crush_matches for each row execute function public.push_on_match();

create or replace function public.push_on_date() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status <> 'pending' then return null; end if;
  perform public.push_enqueue(new.guest, 'date_invite', 'date:' || new.id, '🌹 ' || public.push_name(new.host) || ' asked you out',
    'Date night at ' || public.push_place(new.target) || (case when new.ny_date = public.ny_today() then ', tonight.' else '.' end)
      || ' Say yes before it gets awkward.',
    '/home?open=messages', public.push_day_end(new.ny_date), true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_date on public.date_nights;
create trigger push_date after insert on public.date_nights for each row execute function public.push_on_date();

create or replace function public.push_on_crew() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  o public.crew_outings;
begin
  if new.status <> 'invited' then return null; end if;
  select * into o from public.crew_outings where id = new.outing_id;
  if o.id is null then return null; end if;
  perform public.push_enqueue(new.player_id, 'crew_invite', 'crew:' || o.id, '👯 ' || public.push_name(o.host) || ' is rounding up the crew',
    public.push_place(o.place_id) || (case when o.ny_date = public.ny_today() then ' today' else '' end) || '. You in, or are you "busy"?',
    '/home?open=messages', public.push_day_end(o.ny_date), true, 'crew:' || o.id);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_crew on public.crew_outing_members;
create trigger push_crew after insert on public.crew_outing_members for each row execute function public.push_on_crew();

create or replace function public.push_on_ride() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status <> 'pending' then return null; end if;
  perform public.push_enqueue(new.to_id, 'ride_request', 'ride:' || new.id, '🚕 ' || public.push_name(new.from_id) || ' saved you a seat',
    'Riding to ' || public.push_place(new.place_id) || '. The meter''s running.', '/home', new.created_at + interval '30 minutes',
    public.push_close(new.to_id, new.from_id));
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_ride on public.ride_offers;
create trigger push_ride after insert on public.ride_offers for each row execute function public.push_on_ride();

create or replace function public.push_on_together() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status <> 'pending' then return null; end if;
  perform public.push_enqueue(new.to_id, 'together_invite', 'together:' || new.id, '🤝 ' || public.push_name(new.from_id) || ' wants to team up',
    'At ' || public.push_place(new.place_id) || ', together bonus included. Today only.', '/home', public.push_day_end(new.ny_date),
    public.push_close(new.to_id, new.from_id));
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_together on public.together_invites;
create trigger push_together after insert on public.together_invites for each row execute function public.push_on_together();

create or replace function public.push_on_invite() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(new.inviter_id, 'friend_joined', 'joined:' || new.invitee_id, '🎉 ' || public.push_name(new.invitee_id) || ' just landed',
    'They used your invite. Show them around before they find a better friend.', '/home', null, true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_invite on public.invites;
create trigger push_invite after insert on public.invites for each row execute function public.push_on_invite();

-- ---------------------------------------------------------------------------
-- P1: something expires or costs you (run by the sender; each key once)
-- ---------------------------------------------------------------------------
create or replace function public.push_scan() returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  ny_hour int := extract(hour from now() at time zone 'America/New_York');
  v_week date := today - (extract(isodow from today)::int - 1);
  v_before bigint;
  till_days numeric := coalesce((public.city() -> 'economy' -> 'businesses' ->> 'tillDays')::numeric, 2);
begin
  select count(*) into v_before from public.push_queue;

  -- Bills due today or tomorrow, and late ones (one reminder a day).
  perform public.push_enqueue(b.player_id, 'bill_due', 'bill:' || b.id || ':due',
    '🧾 ' || (case b.kind when 'rent' then 'Rent' when 'phone' then 'Phone bill' when 'car_rental' then 'Car rental' else 'Car insurance' end)
      || ' is due ' || (case when b.due_date = today then 'today' else 'tomorrow' end),
    'C$' || to_char(b.amount, 'FM999,999,999') || '. Pay it before your landlord gets creative.', '/home?open=bills',
    public.push_day_end(b.due_date))
    from public.bills b
   where b.status = 'due' and b.due_date between today and today + 1;
  perform public.push_enqueue(b.player_id, case when b.kind = 'rent' and today - b.due_date >= 3 then 'eviction_warning' else 'bill_overdue' end,
    'bill:' || b.id || ':late:' || today,
    case when b.kind = 'rent' and today - b.due_date >= 3 then '🚪 Your landlord is measuring the door' else '🧾 A bill is late' end,
    'C$' || to_char(b.amount, 'FM999,999,999') || ', ' || (today - b.due_date) || ' day' || (case when today - b.due_date = 1 then '' else 's' end)
      || ' late. Mood''s dropping; pay it in Bills.', '/home?open=bills', public.push_day_end(today))
    from public.bills b
   where b.status = 'due' and b.due_date < today and b.due_date >= today - 10;

  -- A gig is done and its pay is waiting.
  perform public.push_enqueue(g.player_id, 'gig_ready', 'gig:' || g.id, '💼 Gig done',
    g.title || ': C$' || to_char(g.pay, 'FM999,999,999') || ' is waiting. Collect it before it gets lonely.', '/home?open=gigs', null)
    from public.gig_offers g
   where g.accepted_at is not null and g.collected_at is null and g.ready_at <= now() and g.ready_at > now() - interval '12 hours';

  -- A till that has stopped filling.
  perform public.push_enqueue(x.player_id, 'till_full', 'till:' || x.player_id || ':' || x.since, '🏪 Your till is full',
    'Your business stopped earning until you collect. Money doesn''t count itself (yet).', '/home?open=businesses', null)
    from (select player_id, min(collected_at)::date as since from public.player_businesses
           where collected_at <= now() - make_interval(hours => (till_days * 24)::int) group by player_id) x;

  -- A streak with today's five not done yet, in the evening (New York).
  if ny_hour between 18 and 21 then
    perform public.push_enqueue(s.player_id, 'streak_risk', 'streak:' || s.player_id || ':' || today,
      '🔥 Your ' || s.current || '-day streak is on the line', 'Finish today''s five tasks before midnight. Lola is watching.',
      '/home?open=tasks', public.push_day_end(today))
      from public.player_streaks s
     where s.current >= 2 and s.last_day = today - 1;
  end if;

  -- Exams: Friday they open; Sunday is the last day for anyone with an exam left.
  if extract(isodow from today) = 5 then
    perform public.push_enqueue(e.player_id, 'exams_open', 'exams:' || e.player_id || ':' || v_week, '📝 Exams are open',
      'Through Sunday. Your GPA has been asking about you.', '/home', public.push_day_end(today + 2))
      from public.campus_enrolments e
     where exists (select 1 from public.campus_schedule s where s.player_id = e.player_id and s.week = v_week);
  elsif extract(isodow from today) = 7 then
    perform public.push_enqueue(e.player_id, 'exams_last_day', 'examslast:' || e.player_id || ':' || v_week, '📝 Last day for exams',
      'Tonight at midnight they close. Cramming is a valid lifestyle.', '/home', public.push_day_end(today))
      from public.campus_enrolments e
     where exists (select 1 from public.campus_schedule s where s.player_id = e.player_id and s.week = v_week
                    and not exists (select 1 from public.campus_exams x where x.player_id = s.player_id and x.week = s.week and x.course_id = s.course_id));
  end if;

  -- A party ticket starting within the hour.
  perform public.push_enqueue(t.player_id, 'event_ticket', 'ticket:' || ev.id, '🎟️ ' || ev.name || ' starts soon',
    'Doors open at ' || to_char(ev.starts_at at time zone 'America/New_York', 'FMHH12:MI AM') || '. Your name''s on the list.',
    '/home?open=events', ev.starts_at + interval '30 minutes')
    from public.exclusive_events ev
    join public.entitlements t on t.sku = ev.sku and t.status = 'active'
   where ev.starts_at between now() and now() + interval '60 minutes';

  return (select count(*) from public.push_queue) - v_before;
end;
$$;

revoke all on function public.push_name(uuid) from public, anon, authenticated;
revoke all on function public.push_place(text) from public, anon, authenticated;
revoke all on function public.push_close(uuid, uuid) from public, anon, authenticated;
revoke all on function public.push_on_message() from public, anon, authenticated;
revoke all on function public.push_on_match() from public, anon, authenticated;
revoke all on function public.push_on_date() from public, anon, authenticated;
revoke all on function public.push_on_crew() from public, anon, authenticated;
revoke all on function public.push_on_ride() from public, anon, authenticated;
revoke all on function public.push_on_together() from public, anon, authenticated;
revoke all on function public.push_on_invite() from public, anon, authenticated;
revoke all on function public.push_scan() from public, anon, authenticated;
grant execute on function public.push_scan() to service_role;
