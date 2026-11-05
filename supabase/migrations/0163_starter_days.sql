-- Starter Week by the day (owner, Nov 5: "go with your recommendations"). Four changes:
--
--   * The rent fix. The first rent bill appears a week after moving in (the 8th New York day), but Starter Week ended
--     168 hours after it started, so the rent mission (and with it the finish) was nearly impossible. The week now runs
--     by New York day: the day it started is day 1, and it is active through day 8, rent day.
--   * Missions open by the day (game_settings 'starter' missions[].day). A mission done early still counts and pays at
--     once; the day only decides what the pill suggests. starter_state() returns `day`.
--   * Three new missions teach the deeper game: clock in at your first job (day 5), make a tough choice (day 6) and have
--     people over (day 7). Marked by triggers on careers, choice_log and visits, like the others.
--   * Rewards rebalanced toward the finish: Sir Barksley's tip C$500 -> C$150, the finish C$500 -> C$1,000.

update public.game_settings
   set value = value
     || jsonb_build_object('days', 8, 'missions', '[
  {"id":"breakfast","day":1,"cash":25,"clout":0},{"id":"park","day":1,"cash":150,"clout":0},
  {"id":"gig","day":1,"cash":0,"clout":15},{"id":"collect","day":1,"cash":50,"clout":0},
  {"id":"look","day":2,"cash":0,"clout":10},{"id":"furniture","day":2,"cash":75,"clout":0},
  {"id":"gossip","day":3,"cash":0,"clout":20},{"id":"message","day":3,"cash":0,"clout":15},
  {"id":"event","day":4,"cash":0,"clout":25},{"id":"work","day":5,"cash":0,"clout":20},
  {"id":"choice","day":6,"cash":0,"clout":20},{"id":"host","day":7,"cash":0,"clout":25},
  {"id":"rent","day":8,"cash":0,"clout":20}]'::jsonb)
     || jsonb_build_object('finish', (value -> 'finish') || '{"cash":1000}'::jsonb)
 where key = 'starter';

/** The Starter Week day for a player: 1 on the New York day it started (null before it starts). */
create or replace function public.starter_day(p_player uuid) returns int
language sql stable security definer set search_path = public
as $$
  select (public.ny_today() - (sp.started_at at time zone 'America/New_York')::date) + 1
    from public.starter_progress sp where sp.player_id = p_player
$$;

/** Starter Week is running: joined after it shipped, not hidden, not finished, through its last New York day. */
create or replace function public.starter_active(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select p.created_at >= (s.v ->> 'since')::timestamptz
       and coalesce(sp.hidden_at, sp.finished_at) is null
       and (sp.started_at is null
            or public.ny_today() - (sp.started_at at time zone 'America/New_York')::date < (s.v ->> 'days')::int)
      from public.players p
      cross join (select public.game_settings_value('starter') v) s
      left join public.starter_progress sp on sp.player_id = p.id
     where p.id = p_player), false)
$$;

-- ---------------------------------------------------------------------------
-- The new missions' marks (errors swallowed, like 0122's)
-- ---------------------------------------------------------------------------
create or replace function public.starter_on_work() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.last_work_day is not null and new.last_work_day is distinct from old.last_work_day then
    perform public.starter_mark(new.player_id, 'work');
  end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_work on public.careers;
create trigger starter_work after update of last_work_day on public.careers for each row execute function public.starter_on_work();

create or replace function public.starter_on_choice() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'chosen' and old.status is distinct from 'chosen' then perform public.starter_mark(new.player_id, 'choice'); end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_choice on public.choice_log;
create trigger starter_choice after update of status on public.choice_log for each row execute function public.starter_on_choice();

create or replace function public.starter_on_host() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.starter_mark(new.host, 'host');
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_host on public.visits;
create trigger starter_host after insert on public.visits for each row execute function public.starter_on_host();

-- ---------------------------------------------------------------------------
-- starter_state(): 0123's, plus the day and the days left by New York day
-- ---------------------------------------------------------------------------
create or replace function public.starter_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('starter');
  sp public.starter_progress;
  m jsonb;
  paid jsonb := '[]'::jsonb;
  fin jsonb := cfg -> 'finish';
  all_done boolean;
  finished boolean := false;
  d int;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if not public.starter_active(uid) and not exists (select 1 from public.starter_progress where player_id = uid) then return null; end if;
  if public.starter_active(uid) then insert into public.starter_progress (player_id) values (uid) on conflict do nothing; end if;
  select * into sp from public.starter_progress where player_id = uid;
  for m in select jsonb_array_elements(cfg -> 'missions') loop
    if exists (select 1 from public.starter_marks where player_id = uid and mission = m ->> 'id')
       and not exists (select 1 from public.ledger where player_id = uid and kind = 'starter' and ref = m ->> 'id')
       and public.ledger_once(uid, case when (m ->> 'cash')::int > 0 then 'cash' else 'clout' end,
                              greatest((m ->> 'cash')::int, (m ->> 'clout')::int), 'starter', m ->> 'id') then
      update public.players set bank_cash = bank_cash + (m ->> 'cash')::int, clout = clout + (m ->> 'clout')::int where id = uid;
      paid := paid || jsonb_build_array(m);
    end if;
  end loop;
  all_done := not exists (
    select 1 from jsonb_array_elements(cfg -> 'missions') x
     where not exists (select 1 from public.starter_marks where player_id = uid and mission = x ->> 'id'));
  if all_done and sp.finished_at is null then
    update public.starter_progress set finished_at = now() where player_id = uid returning * into sp;
    if public.ledger_once(uid, 'cash', (fin ->> 'cash')::int, 'starter_finish', 'week') then
      update public.players set bank_cash = bank_cash + (fin ->> 'cash')::int where id = uid;
      insert into public.player_badges (player_id, badge_id, arc_id) values (uid, fin ->> 'badge', 'starter') on conflict do nothing;
      insert into public.player_items (player_id, sku, category, value, acquired)
      values (uid, fin ->> 'item', 'home', 0, 'earned') on conflict do nothing;
      finished := true;
    end if;
  end if;
  d := public.ny_today() - (sp.started_at at time zone 'America/New_York')::date + 1;
  return jsonb_build_object(
    'done', coalesce((select jsonb_agg(mission) from public.starter_marks where player_id = uid), '[]'::jsonb),
    'startedAt', sp.started_at,
    'day', d,
    'daysLeft', greatest(0, (cfg ->> 'days')::int - d),
    'active', public.starter_active(uid),
    'paid', paid,
    'finished', finished);
end;
$$;

do $$
declare f text;
begin
  execute 'revoke all on function public.starter_state() from public, anon';
  execute 'grant execute on function public.starter_state() to authenticated';
  foreach f in array array['public.starter_day(uuid)', 'public.starter_active(uuid)', 'public.starter_on_work()',
                           'public.starter_on_choice()', 'public.starter_on_host()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
