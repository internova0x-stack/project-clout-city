-- Push notifications: the four that waited for a time of day (owner, Oct 18).
-- The city clock runs a whole day every two real hours, so "tonight" here is the real New York evening:
--   * date_now: 7 PM New York on the day of an accepted date night, to each of the two who hasn't gone yet (it may
--     reach someone in quiet hours: a date that's happening now is the one push allowed then).
--   * crew_there: the moment someone on a crew outing gets there, to everyone in it who hasn't (row trigger).
--   * party_soon: 8 PM New York on a party night (an event with `days`, e.g. Greek Row: Tue, Thu, Fri, Sat), to the
--     students of that campus.
--   * pass_tonight: 8 PM New York, once per unused guest-list pass.
-- Triggers never break the action they watch. Safe to run more than once.

create or replace function public.push_on_crew_went() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  o public.crew_outings;
begin
  if new.went_at is null or old.went_at is not null then return null; end if;
  select * into o from public.crew_outings where id = new.outing_id;
  if o.id is null or o.ny_date <> public.ny_today() then return null; end if;
  perform public.push_enqueue(m.player_id, 'crew_there', 'crewthere:' || o.id || ':' || m.player_id,
    '👯 ' || public.push_name(new.player_id) || ' is at ' || public.push_place(o.place_id),
    'The crew is gathering. Get there before they start telling stories about you.', '/home?open=messages',
    public.push_day_end(o.ny_date), true, 'crew:' || o.id)
    from public.crew_outing_members m
   where m.outing_id = o.id and m.player_id <> new.player_id and m.went_at is null and m.status in ('host', 'in');
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_crew_went on public.crew_outing_members;
create trigger push_crew_went after update of went_at on public.crew_outing_members for each row
  when (new.went_at is not null and old.went_at is null) execute function public.push_on_crew_went();

create or replace function public.push_scan_tonight() returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  ny_hour int := extract(hour from now() at time zone 'America/New_York');
  dow int := extract(isodow from today);
begin
  -- Date nights: 7 PM onward, to whichever of the two hasn't gone.
  if ny_hour between 19 and 22 then
    perform public.push_enqueue(x.who, 'date_now', 'datenow:' || x.id || ':' || x.who, '🌹 Your date with ' || public.push_name(x.other) || ' is tonight',
      'At ' || public.push_place(x.target) || '. Fashionably late is a myth. Go.', '/home?open=messages', public.push_day_end(today), true)
      from (select d.id, d.target, d.host as who, d.guest as other from public.date_nights d
             where d.status = 'accepted' and d.ny_date = today and d.host_went_at is null
            union all
            select d.id, d.target, d.guest, d.host from public.date_nights d
             where d.status = 'accepted' and d.ny_date = today and d.guest_went_at is null) x;
  end if;

  if ny_hour between 20 and 22 then
    -- Party night at a campus (events with days), for that campus's students.
    perform public.push_enqueue(e.player_id, 'party_soon', 'party:' || (ev ->> 'id') || ':' || today,
      '🎉 ' || (ev ->> 'name') || ' is on tonight', 'Doors open when the city clock hits ' ||
        to_char(make_time((ev ->> 'startHour')::int, 0, 0), 'FMHH12 AM') || '. Wear something you can deny later.',
      '/home', public.push_day_end(today))
      from jsonb_array_elements(public.city() -> 'events') ev
      join public.campus_enrolments e on e.campus = ev ->> 'placeId'
     where ev ? 'days' and (ev -> 'days') @> to_jsonb(dow);
    -- A guest-list pass nobody has used yet: once per pass.
    perform public.push_enqueue(g.player_id, 'pass_tonight', 'pass:' || g.id, '🎟️ Your guest-list pass is burning a hole in your pocket',
      'One night past any club door or onto a VIP floor. Tonight looks like a night.', '/home', public.push_day_end(today))
      from public.guest_passes g
     where g.used_on is null;
  end if;
end;
$$;

-- The sender's scan, now with tonight (0083's body, plus one call before it returns).
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

  -- Step 3 (migration 0083): on air, on screen, and the morning roundup.
  perform public.push_scan_rewards();
  perform public.push_roundup();
  -- Migration 0084: tonight (dates, party night, guest passes).
  perform public.push_scan_tonight();

  return (select count(*) from public.push_queue) - v_before;
end;
$$;

revoke all on function public.push_on_crew_went() from public, anon, authenticated;
revoke all on function public.push_scan_tonight() from public, anon, authenticated;
revoke all on function public.push_scan() from public, anon, authenticated;
grant execute on function public.push_scan() to service_role;
