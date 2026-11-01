-- 0154: "Go to class" for every enrolled student, every day (owner, Nov 1: "fix it"). Since migration 0076 a student's daily
-- list adds "Go to class" only if no other task already sends them to their campus; when one of the random, skill or goal
-- tasks happened to land there, the class task was skipped that day (and supabase/tests/campus_classes.test.sql failed about
-- one run in five).
--   * ensure_daily now finishes a fresh list by making sure an enrolled student whose campus is open has "Go to class": the
--     task already at their campus becomes it (never a gossip task), or else the last plain task does. Still five tasks.
--   * The list of the day before this change, and any list already made today, is left alone.
-- Safe to run more than once.

do $$
begin
  if to_regprocedure('public.ensure_daily_v0100(uuid)') is null then
    alter function public.ensure_daily(uuid) rename to ensure_daily_v0100;
  end if;
end $$;

create or replace function public.ensure_daily(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  had boolean := exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today);
  v_campus text;
  v_id bigint;
begin
  perform public.ensure_daily_v0100(p_player);
  if had then return; end if;
  select en.campus into v_campus from public.campus_enrolments en where en.player_id = p_player;
  if v_campus is null or not public.place_open(v_campus)
     or exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today and kind = 'class') then
    return;
  end if;
  -- The task already at the campus (not gossip, which keeps its trail), else the last plain task (not a goal's).
  select id into v_id from public.daily_tasks
   where player_id = p_player and ny_date = today and done_at is null and place_id = v_campus and kind <> 'gossip'
   order by (goal is not null), slot desc limit 1;
  if v_id is null then
    select id into v_id from public.daily_tasks
     where player_id = p_player and ny_date = today and done_at is null
       and kind not in ('gossip', 'class') and kind not like 'style:%' and goal is null
     order by slot desc limit 1;
  end if;
  if v_id is null then return; end if;
  update public.daily_tasks set kind = 'class', place_id = v_campus, action_id = 'class', skill = null, goal = null
   where id = v_id;
end;
$$;

revoke all on function public.ensure_daily(uuid) from public, anon, authenticated;
revoke all on function public.ensure_daily_v0100(uuid) from public, anon, authenticated;
