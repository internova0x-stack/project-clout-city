-- Push notifications step 3 (owner, Oct 18; spec section 20): P2 rewards, the P3 morning roundup and win-back.
--   * P2, you won something: a goal, a streak reward, a skill level, a new rank, the weekly jackpot or a pot, a
--     scholarship (row triggers); on air on Real Clout FM and on the Big Screen (push_scan_rewards, at the moment
--     they air). Most rewards are earned in the game, where the sender drops pushes for players who are playing;
--     the ones that land while you're away (the jackpot, the radio, the screen) are the ones that go out.
--   * P3, come back and play: new daily tasks, a new hunt, fresh gossip, today's story beat, a borough opening and
--     win-back after 3, 7 and 14 days away (push_roundup). Only for players who haven't opened the game today, and
--     the sender folds them into one morning roundup (lib/push.ts).
-- Triggers never break the action they watch. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- P2: rewards from the ledger and a new best rank
-- ---------------------------------------------------------------------------
create or replace function public.push_on_reward() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  skill text := initcap(replace(split_part(new.ref, ':', 1), '_', ' '));
begin
  case new.kind
    when 'goal' then
      perform public.push_enqueue(new.player_id, 'goal_done', 'goal:' || new.ref, '🏆 Goal done',
        'Lola says she always believed in you. Lola is lying. Collect your next one.', '/home?open=tasks');
    when 'streak' then
      perform public.push_enqueue(new.player_id, 'streak_reward', 'streakr:' || new.ref, '🔥 Streak reward unlocked',
        'Consistency: the least glamorous superpower. Your reward is waiting.', '/home?open=tasks');
    when 'skill' then
      perform public.push_enqueue(new.player_id, 'skill_up', 'skill:' || new.ref, '📈 ' || skill || ' level ' || split_part(new.ref, ':', 2),
        'Practice paid off. Literally: there''s clout in it.', '/home');
    when 'lotto_jackpot' then
      perform public.push_enqueue(new.player_id, 'lotto_win', 'jackpot:' || new.ref, '🌟 You won the weekly jackpot',
        'C$' || to_char(new.amount, 'FM999,999,999') || ' just landed. Act normal.', '/home');
    when 'lotto_pot' then
      perform public.push_enqueue(new.player_id, 'lotto_win', 'pot:' || new.ref, '⭐ You hit a Lucky Star pot',
        'C$' || to_char(new.amount, 'FM999,999,999') || '. The ticket guy is pretending he isn''t jealous.', '/home');
    when 'scholarship' then
      perform public.push_enqueue(new.player_id, 'grades', 'scholarship:' || new.ref, '🎓 Your grades paid off',
        'Scholarship money is in. Your GPA would like a thank-you note.', '/home');
    else null;
  end case;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_reward on public.ledger;
create trigger push_reward after insert on public.ledger for each row
  when (new.kind in ('goal', 'streak', 'skill', 'lotto_jackpot', 'lotto_pot', 'scholarship') and new.amount > 0)
  execute function public.push_on_reward();

create or replace function public.push_on_rank() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  -- lib/ranks.ts RANKS, by level.
  titles text[] := array['🍜 Ramen Noodle Era', '🎓 Student Loan Survivor', '💼 Side Hustler', '💬 Group Chat Famous', '📋 On the List',
                         '📸 Local Celebrity', '🍼 Nepo Baby Energy', '💸 New Money Rich', '🛥️ Self-Made Billionaire*', '✨ God Status'];
begin
  if new.best_rank <= old.best_rank or new.best_rank > 10 then return null; end if;
  perform public.push_enqueue(new.id, 'rank_up', 'rank:' || new.best_rank, 'New rank: ' || titles[new.best_rank],
    'The city noticed. Come see what it unlocked.', '/home');
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_rank on public.players;
create trigger push_rank after update of best_rank on public.players for each row
  when (new.best_rank > old.best_rank) execute function public.push_on_rank();

-- ---------------------------------------------------------------------------
-- P2 at the moment it happens: on air, on screen
-- ---------------------------------------------------------------------------
create or replace function public.push_scan_rewards() returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(r.player_id, 'radio_on_air', 'radio:' || r.id, '📻 You''re on Real Clout FM',
    'DJ Sharm Almight is reading your shoutout right now. Tune in, superstar.', '/home')
    from public.radio_shoutouts r
   where r.status = 'on_air' and r.aired_at <= now() and r.aired_at > now() - interval '20 minutes';
  perform public.push_enqueue(t.player_id, 'tv_on_screen', 'tv:' || t.id, '📺 You''re on the Big Screen',
    'Clout Tower, right now. Go look up (or open Clout TV, we won''t judge).', '/home')
    from public.tv_submissions t
   where t.status = 'featured' and t.featured_at <= now() and t.featured_at > now() - interval '60 minutes';
end;
$$;

-- ---------------------------------------------------------------------------
-- P3: the morning roundup and win-back (players away today only; one roundup push per day)
-- ---------------------------------------------------------------------------
create or replace function public.push_roundup() returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  ny_hour int := extract(hour from now() at time zone 'America/New_York');
  monday boolean := extract(isodow from today) = 1;
begin
  if ny_hour < 8 or ny_hour >= 20 then return; end if;
  create temp table if not exists push_away (player_id uuid primary key) on commit drop;
  truncate push_away;
  insert into push_away
    select distinct s.player_id from public.push_subscriptions s
     where not exists (select 1 from public.player_sessions x where x.player_id = s.player_id and x.ny_date = today);

  -- New daily tasks.
  perform public.push_enqueue(a.player_id, 'daily_tasks', 'tasks:' || today, '☀️ Five new tasks',
    'One streak, zero excuses. Lola is timing you.', '/home?open=tasks', public.push_day_end(today))
    from push_away a;
  -- Monday: a new hunt and fresh gossip.
  if monday then
    perform public.push_enqueue(a.player_id, 'hunt_new', 'hunt:' || h.id, '🗺️ ' || coalesce(h.data ->> 'theme', 'A new treasure hunt'),
      'This week''s treasure hunt just started. Someone''s going to win it. Could be you.', '/home', null)
      from push_away a cross join public.hunts h
     where h.week = today and h.status = 'approved';
    perform public.push_enqueue(a.player_id, 'gossip_new', 'gossip:' || g.week, '☕ Fresh tea in Astoria',
      'New gossip just dropped. Lola''s already typing.', '/home', null)
      from push_away a cross join public.gossip_weeks g
     where g.week = today and g.status = 'approved';
  end if;
  -- Today's beat of the running main story.
  perform public.push_enqueue(a.player_id, 'story_beat', 'beat:' || (b ->> 'id'), '📰 ' || coalesce(b -> 'news' -> 0 ->> 'headline', 'Big news in Queens'),
    'Today''s chapter is out. Vote before the city decides without you.', '/home', public.push_day_end(today))
    from push_away a
    cross join public.story_arcs s
    cross join lateral jsonb_array_elements(s.data -> 'beats') b
   where s.type = 'main' and public.arc_day(s) is not null and (b ->> 'day')::int = public.arc_day(s)
     and coalesce(b ->> 'status', 'active') = 'active';
  -- A borough opened in the last day.
  perform public.push_enqueue(a.player_id, 'borough_open', 'borough:' || g.id, '🌉 ' || initcap(replace(g.id, '-', ' ')) || ' is open',
    'A whole new borough. New places, new people, new ways to go broke.', '/home', null)
    from push_away a cross join public.borough_gates g
   where g.opened_at > now() - interval '1 day';
  -- Win-back: 3, 7 and 14 days since they last played (once each per absence).
  perform public.push_enqueue(l.player_id, 'winback', 'winback:' || l.last_day || ':' || (today - l.last_day),
    case today - l.last_day when 3 then '🍜 Your ramen misses you' when 7 then '👀 Queens keeps asking about you' else '💌 Lola saved you a seat' end,
    case today - l.last_day
      when 3 then 'Three days. Your crew has started telling stories about you. Not good ones.'
      when 7 then 'A week away and the city kept going. Rude, honestly. Come show them.'
      else 'Two weeks! Rent''s been piling up and so has the gossip. Come back, we''ll pretend nothing happened.' end,
    '/home', public.push_day_end(today))
    from (select x.player_id, max(x.ny_date) as last_day from public.player_sessions x
           where x.player_id in (select player_id from push_away) group by x.player_id) l
   where today - l.last_day in (3, 7, 14);
end;
$$;

-- The sender's scan, now with step 3 (0082's body, plus the two calls before it returns).
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

  return (select count(*) from public.push_queue) - v_before;
end;
$$;

revoke all on function public.push_on_reward() from public, anon, authenticated;
revoke all on function public.push_on_rank() from public, anon, authenticated;
revoke all on function public.push_scan_rewards() from public, anon, authenticated;
revoke all on function public.push_roundup() from public, anon, authenticated;
revoke all on function public.push_scan() from public, anon, authenticated;
grant execute on function public.push_scan() to service_role;
