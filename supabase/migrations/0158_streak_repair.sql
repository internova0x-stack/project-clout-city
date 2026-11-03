-- 0158: Streak repair and streak notifications (owner, Nov 3: "add notifications as streaks are about to expire. Add a
-- mechanism for redeeming broken streaks, the day after a streak is broken"; "go with your recommendation").
--   * A streak of 3+ days that broke (the weekly freeze couldn't cover the gap) can be repaired for a short window: from
--     the day after the miss to three days after the last full day (game_settings 'streak_repair'.windowDays). Once every
--     30 days; the rewards already paid on the run are never paid again (they're keyed by run and day).
--   * Four ways (`streak_repair(method)`):
--       'earn'  free: finish all five tasks today and the streak carries on from where it stopped (streak_tick reads it)
--       'cash'  C$20 a streak day, at most C$1,500 (ledger cash 'streak_repair', ref the run's start + today)
--       'pass'  one guest-list pass (used_place 'streak-repair')
--       'vip'   free for a VIP, once a month (the same 30-day limit)
--     A paid repair puts the streak back at once (last_day = yesterday): today's five then add a day as usual.
--   * Real money never repairs a streak on its own (owner: VIP only, no single purchase).
--   * Pushes (push_scan_streak, run by the sender): 'streak_last' at 9 PM New York for a 7+ day streak with tasks left and
--     no freeze to cover a miss; 'streak_freeze' in the morning when the weekly freeze saved yesterday's streak;
--     'streak_repair' in the morning while a repair is open.
-- Safe to run more than once.

insert into public.game_settings (key, value) values
  ('streak_repair', '{"minStreak":3,"windowDays":3,"everyDays":30,"cashPerDay":20,"cashMax":1500,"lastCallMin":7}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.streak_repairs (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  -- The run repaired (player_streaks.started_on) and its length when it broke.
  run         date not null,
  streak      int not null,
  method      text not null check (method in ('earn', 'cash', 'pass', 'vip')),
  -- The New York day the repair was asked for; an 'earn' repair lands when that day's five are done.
  ny_date     date not null,
  repaired_on date,
  cash        int not null default 0,
  created_at  timestamptz not null default now(),
  unique (player_id, run, ny_date)
);
create index if not exists streak_repairs_player_idx on public.streak_repairs (player_id, created_at desc);
alter table public.streak_repairs enable row level security;
revoke all on public.streak_repairs from anon, authenticated;

create or replace function public.streak_repair_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select coalesce((select value from public.game_settings where key = 'streak_repair'), '{}'::jsonb) $$;

/**
 * Whether the player's streak can be repaired today, and how: null when there's nothing to repair. A streak is broken
 * when it isn't alive (goals_state_for's rule: through yesterday, or the day before when this week's freeze can cover it).
 */
create or replace function public.streak_repair_offer(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  st jsonb := public.goals_settings() -> 'streak';
  rs jsonb := public.streak_repair_settings();
  s public.player_streaks;
  v_alive boolean;
  pend public.streak_repairs;
begin
  select * into s from public.player_streaks where player_id = p_player;
  if s.player_id is null or s.last_day is null or s.current < coalesce((rs ->> 'minStreak')::int, 3) then return null; end if;
  v_alive := s.last_day >= today - 1
             or (s.last_day = today - 2 and coalesce((st ->> 'freezesPerWeek')::int, 0) > 0
                 and s.freeze_week is distinct from date_trunc('week', today - 1)::date);
  -- An earn-back asked for today is still open until today's five are done.
  select * into pend from public.streak_repairs
   where player_id = p_player and run = s.started_on and ny_date = today and method = 'earn' and repaired_on is null;
  if v_alive and pend.id is null then return null; end if;
  if today - s.last_day > coalesce((rs ->> 'windowDays')::int, 3) then return null; end if;
  if pend.id is null and exists (select 1 from public.streak_repairs r where r.player_id = p_player
       and r.repaired_on is not null and r.repaired_on > today - coalesce((rs ->> 'everyDays')::int, 30)) then return null; end if;
  return jsonb_build_object(
    'streak', s.current,
    'lastDay', s.last_day,
    'earnPending', pend.id is not null,
    'cash', least(s.current * coalesce((rs ->> 'cashPerDay')::int, 20), coalesce((rs ->> 'cashMax')::int, 1500)),
    'passes', (select count(*) from public.guest_passes where player_id = p_player and used_on is null),
    'vip', public.vip_member(p_player),
    'bank', (select bank_cash from public.players where id = p_player));
end;
$$;

/** The player's repair offer (the Tasks sheet and the welcome back). */
create or replace function public.streak_repair_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return jsonb_build_object('offer', public.streak_repair_offer(uid));
end;
$$;

/** Repairs the broken streak one of four ways ('earn', 'cash', 'pass', 'vip'). Returns the new offer state. */
create or replace function public.streak_repair(p_method text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  o jsonb;
  s public.player_streaks;
  v_cost int := 0;
  v_pass bigint;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_method not in ('earn', 'cash', 'pass', 'vip') then raise exception 'bad_method' using errcode = '22023'; end if;
  if not public.rate_hit(uid, 'streak_repair', 10, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into s from public.player_streaks where player_id = uid for update;
  o := public.streak_repair_offer(uid);
  if o is null then raise exception 'no_repair' using errcode = '22023'; end if;
  if (o ->> 'earnPending')::boolean then
    if p_method = 'earn' then return jsonb_build_object('offer', o); end if;
    delete from public.streak_repairs where player_id = uid and run = s.started_on and ny_date = today and method = 'earn' and repaired_on is null;
  end if;
  if p_method = 'earn' then
    insert into public.streak_repairs (player_id, run, streak, method, ny_date) values (uid, s.started_on, s.current, 'earn', today)
    on conflict (player_id, run, ny_date) do nothing;
    return jsonb_build_object('offer', public.streak_repair_offer(uid));
  end if;
  if p_method = 'vip' and not public.vip_member(uid) then raise exception 'not_vip' using errcode = '22023'; end if;
  if p_method = 'pass' then
    select id into v_pass from public.guest_passes where player_id = uid and used_on is null order by earned_on limit 1 for update;
    if v_pass is null then raise exception 'no_pass' using errcode = '22023'; end if;
    update public.guest_passes set used_place = 'streak-repair', used_on = today where id = v_pass;
  end if;
  if p_method = 'cash' then
    v_cost := (o ->> 'cash')::int;
    if (select bank_cash from public.players where id = uid) < v_cost then raise exception 'not_enough_cash' using errcode = '22023'; end if;
    if public.ledger_once(uid, 'cash', -v_cost, 'streak_repair', s.started_on::text || ':' || today::text) then
      update public.players set bank_cash = bank_cash - v_cost where id = uid;
    end if;
  end if;
  insert into public.streak_repairs (player_id, run, streak, method, ny_date, repaired_on, cash)
  values (uid, s.started_on, s.current, p_method, today, today, v_cost)
  on conflict (player_id, run, ny_date) do update set method = excluded.method, repaired_on = excluded.repaired_on, cash = excluded.cash;
  -- Back on: as if yesterday was a full day (no day is added for the missed ones).
  update public.player_streaks set last_day = greatest(last_day, today - 1) where player_id = uid;
  return jsonb_build_object('offer', null, 'repaired', true, 'streak', s.current);
end;
$$;

/**
 * 0073's streak_tick, plus the earn-back: a full day on the day an 'earn' repair was asked for carries the broken run on
 * (the streak's count + 1, the same run) and marks the repair done.
 */
create or replace function public.streak_tick(p_player uuid, p_day date) returns int
language plpgsql security definer set search_path = public
as $$
declare
  s public.player_streaks;
  st jsonb := public.goals_settings() -> 'streak';
  v_gap int;
  v_n int;
  v_run date;
  v_freeze date;
  v_earn bigint;
begin
  select * into s from public.player_streaks where player_id = p_player for update;
  if s.player_id is not null and s.last_day is not null and p_day <= s.last_day then return s.current; end if;
  v_gap := case when s.last_day is null then null else p_day - s.last_day end;
  v_freeze := s.freeze_week;
  select id into v_earn from public.streak_repairs
   where player_id = p_player and run = s.started_on and ny_date = p_day and method = 'earn' and repaired_on is null;
  if v_gap = 1 then
    v_n := s.current + 1; v_run := s.started_on;
  elsif v_gap = 2 and coalesce((st ->> 'freezesPerWeek')::int, 0) > 0
        and s.freeze_week is distinct from date_trunc('week', p_day - 1)::date then
    v_n := s.current + 1; v_run := s.started_on; v_freeze := date_trunc('week', p_day - 1)::date;
  elsif v_earn is not null then
    v_n := s.current + 1; v_run := s.started_on;
    update public.streak_repairs set repaired_on = p_day where id = v_earn;
  else
    v_n := 1; v_run := p_day;
  end if;
  insert into public.player_streaks (player_id, current, best, started_on, last_day, freeze_week)
  values (p_player, v_n, v_n, v_run, p_day, v_freeze)
  on conflict (player_id) do update
    set current = excluded.current, best = greatest(public.player_streaks.best, excluded.current),
        started_on = excluded.started_on, last_day = excluded.last_day, freeze_week = excluded.freeze_week;
  perform public.streak_reward(p_player, v_run, v_n, p_day);
  return v_n;
end;
$$;

/** Streak pushes (run by the push sender after push_scan): the last call, the freeze that saved it, a repair open. */
create or replace function public.push_scan_streak() returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  ny_hour int := extract(hour from now() at time zone 'America/New_York');
  st jsonb := public.goals_settings() -> 'streak';
  rs jsonb := public.streak_repair_settings();
begin
  -- Last call: a long streak, tasks left, and no freeze to cover a miss tonight.
  if ny_hour = 21 then
    perform public.push_enqueue(s.player_id, 'streak_last', 'streaklast:' || s.player_id || ':' || today,
      '⏳ Last call on your ' || s.current || '-day streak',
      (select count(*) from public.daily_tasks t where t.player_id = s.player_id and t.ny_date = today and t.done_at is null)
        || ' left before midnight. Lola already wrote the obituary. Don''t make her use it.',
      '/home?open=tasks', public.push_day_end(today))
      from public.player_streaks s
     where s.current >= coalesce((rs ->> 'lastCallMin')::int, 7) and s.last_day = today - 1
       and (coalesce((st ->> 'freezesPerWeek')::int, 0) = 0 or s.freeze_week = date_trunc('week', today)::date)
       and exists (select 1 from public.daily_tasks t where t.player_id = s.player_id and t.ny_date = today and t.done_at is null);
  end if;
  if ny_hour between 9 and 12 then
    -- The weekly freeze saved it: yesterday was full, the day before was missed.
    perform public.push_enqueue(s.player_id, 'streak_freeze', 'streakfreeze:' || s.player_id || ':' || today,
      '🧊 Your freeze saved your ' || s.current || '-day streak',
      'You missed a day and the streak lived. That was this week''s only freeze, so no more skipping until Monday.',
      '/home?open=tasks', public.push_day_end(today))
      from public.player_streaks s
     where s.last_day = today - 1 and s.current >= 3 and s.freeze_week = date_trunc('week', today - 2)::date
       and not exists (select 1 from public.ledger l where l.player_id = s.player_id and l.kind = 'daily_bonus' and l.ref = (today - 2)::text);
    -- A repair is open.
    perform public.push_enqueue(s.player_id, 'streak_repair', 'streakrep:' || s.player_id || ':' || today,
      '💔 Your ' || s.current || '-day streak broke',
      'You can still repair it today. Finish your five tasks, or pay the city its fee.',
      '/home?open=tasks', public.push_day_end(today))
      from public.player_streaks s
     where s.current >= coalesce((rs ->> 'minStreak')::int, 3) and public.streak_repair_offer(s.player_id) is not null;
  end if;
end;
$$;

revoke all on function public.streak_repair_settings() from public, anon, authenticated;
revoke all on function public.streak_repair_offer(uuid) from public, anon, authenticated;
revoke all on function public.push_scan_streak() from public, anon, authenticated;
revoke all on function public.streak_repair_state() from public, anon;
revoke all on function public.streak_repair(text) from public, anon;
grant execute on function public.streak_repair_state() to authenticated;
grant execute on function public.streak_repair(text) to authenticated;
