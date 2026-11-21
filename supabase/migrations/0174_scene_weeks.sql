-- 0174: Your Scene's weekly moves and the cast's week (owner, Nov 21: "Do the scenes update daily?"; docs/SCENE.md).
--   * The weekly routine writes content/scene-weeks/<Monday>.json (lib/sceneWeeks.ts validateSceneWeek): 6 to 10 new moves
--     tied to the week's news and cast. content_import_scene (service role, run by syncWeeklyContent) stores each new move
--     'scheduled', live 24 hours later unless vetoed or paused in Studio → Storylets → Scene moves (held 'paused' while the
--     storylets autopilot is off), like storylets (migration 0139). A move runs only in its own week (Monday to Sunday).
--   * scene_move_def(id): a move's numbers, from game_settings 'scene' or a weekly move that has gone live, so a weekly move
--     started before a veto can still be collected; scene_move_open(id): whether it can be started now.
--     scene_start, scene_collect, scene_residency_take and scene_residency_checkin read moves through it.
--   * The cast's week (hosted moves on set days, lib/scene.ts daysFor) is checked by the server action before scene_start.
--   * scene_weeks_live() (service role) feeds the server's catalog; admin_scene_moves(), admin_scene_move_set(id, action).
-- Safe to run more than once.

create table if not exists public.scene_week_moves (
  id         text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  week       date not null,
  move       jsonb not null,
  status     text not null default 'scheduled' check (status in ('scheduled', 'paused', 'vetoed', 'live')),
  arrived_at timestamptz not null default now(),
  live_at    timestamptz not null,
  went_live  boolean not null default false,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
create index if not exists scene_week_moves_week_idx on public.scene_week_moves (week desc);
alter table public.scene_week_moves enable row level security;
revoke all on public.scene_week_moves from anon, authenticated;

/** A move's numbers: the game's own (game_settings 'scene'), or a weekly move that went live. */
create or replace function public.scene_move_def(p_move text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(public.game_settings_value('scene') -> 'moves' -> p_move,
    (select w.move from public.scene_week_moves w
      where w.id = p_move and (w.went_live or public.storylet_state(w.status, w.live_at) = 'live')))
$$;

/** Whether a move can be started now: one of the game's, or a weekly move live now and in its own week. */
create or replace function public.scene_move_open(p_move text) returns boolean
language sql stable security definer set search_path = public
as $$
  select (public.game_settings_value('scene') -> 'moves') ? p_move
      or exists (select 1 from public.scene_week_moves w
                  where w.id = p_move and public.storylet_state(w.status, w.live_at) = 'live'
                    and public.ny_today() between w.week and w.week + 6)
$$;

/** Stores a week's new moves (service role). Returns how many were added. */
create or replace function public.content_import_scene(p_week date, p_moves jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  m jsonb;
  n int := 0;
  hrs numeric := coalesce((public.game_settings_value('storylets') ->> 'window_hours')::numeric, 24);
  held boolean := not (public.autopilot() ->> 'storylets')::boolean;
begin
  if p_week is null or jsonb_typeof(p_moves) <> 'array' then raise exception 'bad_week' using errcode = '22023'; end if;
  for m in select * from jsonb_array_elements(p_moves) loop
    insert into public.scene_week_moves (id, week, move, status, live_at)
    values (m ->> 'id', p_week, m, case when held then 'paused' else 'scheduled' end,
            now() + make_interval(secs => (hrs * 3600)::double precision))
    on conflict (id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

/** Every weekly move that went live (service role); `offer` while it can be started (live, in its week). */
create or replace function public.scene_weeks_live() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('move', move,
           'offer', public.storylet_state(status, live_at) = 'live' and public.ny_today() between week and week + 6)
         order by week, id), '[]'::jsonb)
  from public.scene_week_moves
  where went_live or public.storylet_state(status, live_at) = 'live'
$$;

/** The Studio's list: newest weeks first. */
create or replace function public.admin_scene_moves() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'week', week, 'move', move, 'status', public.storylet_state(status, live_at),
      'live_at', live_at, 'arrived_at', arrived_at, 'decided_at', decided_at) order by week desc, arrived_at, id)
    from public.scene_week_moves), '[]'::jsonb);
end;
$$;

/** The owner's decision on one weekly move: 'veto', 'pause', 'restore', 'now' (as for storylets). */
create or replace function public.admin_scene_move_set(p_id text, p_action text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.scene_week_moves;
begin
  perform public.require_story_admin();
  select * into r from public.scene_week_moves where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.storylet_state(r.status, r.live_at) = 'live' then r.went_live := true; end if;
  if p_action = 'veto' then r.status := 'vetoed';
  elsif p_action = 'pause' then
    if r.status = 'vetoed' then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'paused';
  elsif p_action = 'restore' then
    if r.status = 'vetoed' and r.went_live then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'scheduled';
  elsif p_action = 'now' then
    if r.status = 'vetoed' and r.went_live then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'scheduled'; r.live_at := least(r.live_at, now()); r.went_live := true;
  else raise exception 'bad_action' using errcode = '22023';
  end if;
  update public.scene_week_moves set status = r.status, live_at = r.live_at, went_live = r.went_live,
         decided_by = auth.uid(), decided_at = now() where id = p_id;
  return public.admin_scene_moves();
end;
$$;

-- The game's functions, reading moves through scene_move_def (bodies otherwise as 0171 and 0173).

/**
 * Starts a move (or records a bounce). p_entry 'invited' needs the rank or money; 'sneak' is for a player short of them,
 * with the server's roll in p_bounced, a bribe's price in p_extra, the meter nudge in p_integrity and a ban in p_ban_hours.
 * Raises: rate_limited, no_player, bad_move, not_here, closed_now, in_holding, banned_here, not_yet, no_slot, running,
 * bounced_today, no_energy, cant_afford, bad_entry.
 */
create or replace function public.scene_start(
  p_player uuid, p_move text, p_entry text, p_bounced boolean, p_extra int, p_integrity int, p_ban_hours int
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  mv jsonb := public.scene_move_def(p_move);
  me public.players;
  rk int;
  worth bigint;
  ok_needs boolean;
  v_hours int;
  v_cost int;
  v_energy int;
  v_slot int;
  v_id uuid;
  base int;
  ni int := coalesce(p_integrity, 0);
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if mv is null or not public.scene_move_open(p_move) then raise exception 'bad_move' using errcode = '22023'; end if;
  if p_entry not in ('invited', 'sneak') or coalesce(p_extra, 0) not between 0 and 5000 or ni not between -5 and 5
     or coalesce(p_ban_hours, 0) not between 0 and 24 then
    raise exception 'bad_entry' using errcode = '22023';
  end if;
  select * into me from public.players where id = p_player and home_id is not null for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not (mv -> 'places') ? coalesce(me.at_place, '') then raise exception 'not_here' using errcode = '22023'; end if;
  if not public.place_hours_open(me.at_place) then raise exception 'closed_now' using errcode = '22023'; end if;
  if public.choice_marked(p_player, 'holding') then raise exception 'in_holding' using errcode = '22023'; end if;
  if exists (select 1 from public.choice_marks where player_id = p_player and kind = 'ban' and place = me.at_place and until > now()) then
    raise exception 'banned_here' using errcode = '22023';
  end if;
  rk := public.scene_rank(p_player);
  worth := public.net_worth(p_player);
  ok_needs := case
    when mv -> 'needs' is null then true
    when (mv -> 'needs') ? 'rank' and (mv -> 'needs') ? 'netWorth' then rk >= (mv #>> '{needs,rank}')::int or worth >= (mv #>> '{needs,netWorth}')::bigint
    when (mv -> 'needs') ? 'rank' then rk >= (mv #>> '{needs,rank}')::int
    else worth >= (mv #>> '{needs,netWorth}')::bigint end;
  -- Invited needs the rank or money; sneaking is only for those short of it.
  if p_entry = 'invited' and not ok_needs then raise exception 'not_yet' using errcode = '22023'; end if;
  if p_entry = 'sneak' and ok_needs then raise exception 'bad_entry' using errcode = '22023'; end if;
  if exists (select 1 from public.scene_moves where player_id = p_player and move = p_move and collected_at is null) then
    raise exception 'running' using errcode = '22023';
  end if;
  if exists (select 1 from public.scene_bounces where player_id = p_player and move = p_move and ny_date = public.ny_today()) then
    raise exception 'bounced_today' using errcode = '22023';
  end if;
  select s into v_slot from generate_series(1, public.scene_slots(rk)) s
   where not exists (select 1 from public.scene_moves m where m.player_id = p_player and m.collected_at is null and m.slot = s)
   order by s limit 1;
  if v_slot is null then raise exception 'no_slot' using errcode = '22023'; end if;
  v_energy := (mv ->> 'energy')::int;
  if me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  base := coalesce((mv #>> '{needs,rank}')::int, 1);
  v_cost := (round((mv ->> 'cost')::int * (1 + (cfg ->> 'costPerRank')::numeric * greatest(0, rk - base)) / 5) * 5)::int;
  if p_entry = 'sneak' then v_cost := (mv ->> 'cost')::int + coalesce(p_extra, 0); end if;
  if me.bank_cash < v_cost then raise exception 'cant_afford' using errcode = '22023'; end if;

  if ni <> 0 then
    insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
    update public.reputation set integrity = least(100, greatest(0, integrity + ni)), updated_at = now() where player_id = p_player;
  end if;
  if coalesce(p_bounced, false) then
    -- Bounced: the Energy is spent (and a bribe's money, which the door kept), no move, no second try today.
    update public.players set energy = greatest(0, energy - v_energy) where id = p_player;
    if coalesce(p_extra, 0) > 0 and public.ledger_once(p_player, 'cash', -p_extra, 'scene_cost', 'bounce:' || p_move || ':' || public.ny_today()) then
      update public.players set bank_cash = bank_cash - p_extra where id = p_player;
    end if;
    insert into public.scene_bounces (player_id, move, ny_date, way)
    values (p_player, p_move, public.ny_today(), case when coalesce(p_ban_hours, 0) > 0 then 'namedrop' when coalesce(p_extra, 0) > 0 then 'bribe' else 'confidence' end)
    on conflict do nothing;
    if coalesce(p_ban_hours, 0) > 0 then
      insert into public.choice_marks (player_id, kind, place, until) values (p_player, 'ban', me.at_place, now() + make_interval(hours => p_ban_hours));
    end if;
    return jsonb_build_object('bounced', true, 'energy', v_energy, 'cash', -coalesce(p_extra, 0), 'banHours', coalesce(p_ban_hours, 0));
  end if;

  v_hours := (mv ->> 'hours')::int;
  insert into public.scene_moves (player_id, move, place, slot, entry, score, need, ready_at, stale_at)
  values (p_player, p_move, me.at_place, v_slot, p_entry, mv ->> 'score', coalesce((cfg -> 'hypes' ->> v_hours::text)::int, 0),
          now() + make_interval(hours => v_hours),
          now() + make_interval(hours => v_hours + coalesce((cfg -> 'staleAfter' ->> v_hours::text)::int, v_hours)))
  returning scene_moves.id into v_id;
  update public.players set energy = energy - v_energy where id = p_player;
  if v_cost > 0 and public.ledger_once(p_player, 'cash', -v_cost, 'scene_cost', v_id::text) then
    update public.players set bank_cash = bank_cash - v_cost where id = p_player;
  end if;
  return jsonb_build_object('bounced', false, 'id', v_id, 'slot', v_slot, 'cash', -v_cost, 'energy', v_energy);
end;
$$;

/** 0172's collect, plus trending's boost, plaques, Lola's Blotter for big moves. */
create or replace function public.scene_collect(p_player uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  r public.scene_moves;
  mv jsonb;
  is_stale boolean;
  f numeric;
  hc numeric;
  c int;
  pts int;
  n int;
  pl jsonb;
  plaque jsonb := null;
  me public.players;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_moves where id = p_id and player_id = p_player and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if now() < r.ready_at then raise exception 'not_ready' using errcode = '22023'; end if;
  mv := public.scene_move_def(r.move);
  is_stale := now() >= r.stale_at;
  f := greatest((cfg ->> 'stalePay')::numeric, 1 - (cfg ->> 'missedHype')::numeric * greatest(0, r.need - cardinality(r.hypes)));
  if is_stale then f := least(f, (cfg ->> 'stalePay')::numeric); end if;
  hc := case when r.hater is not null and r.hater_at <= now() and (r.dealt is null or r.dealt = 'rise') then coalesce(r.cut, 0) else 0 end;
  f := f * (1 - hc) * coalesce(r.boost, 1);
  c := round(coalesce((mv ->> 'clout')::int, 0) * f)::int;
  pts := round(c * (cfg ->> 'pointsPer')::numeric)::int;
  update public.scene_moves set collected_at = now(), stale = is_stale, clout = c, points = pts where id = p_id;
  if c > 0 and public.ledger_once(p_player, 'clout', c, 'scene', p_id::text) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  if mv ? 'skill' then perform public.skill_practice(p_player, mv ->> 'skill', 'scene:' || p_id); end if;
  -- Plaques: the 10th, 25th and 50th time.
  select count(*) into n from public.scene_moves where player_id = p_player and move = r.move and collected_at is not null;
  for pl in select x from jsonb_array_elements(cfg -> 'plaques') x loop
    if n = (pl ->> 'at')::int then
      if public.ledger_once(p_player, 'clout', (pl ->> 'clout')::int, 'scene_plaque', r.move || ':' || (pl ->> 'at')) then
        update public.players set clout = clout + (pl ->> 'clout')::int where id = p_player;
      end if;
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'scene-' || r.move || '-' || (pl ->> 'at'), 'scene') on conflict do nothing;
      plaque := pl;
    end if;
  end loop;
  -- Lola's Blotter for the big ones (not when it went stale).
  if mv ? 'headline' and not is_stale then
    select * into me from public.players where id = p_player;
    if me.id is not null and not coalesce(me.news_opt_out, false) then
      insert into public.choice_headlines (player_id, text, kind)
      values (p_player, left(replace(mv ->> 'headline', '{name}', '@' || me.display_name), 260), 'win');
    end if;
  end if;
  return jsonb_build_object('clout', c, 'points', pts, 'score', r.score, 'stale', is_stale, 'move', r.move, 'cut', hc,
    'boost', coalesce(r.boost, 1), 'count', n, 'plaque', plaque);
end;
$$;

/** Takes a week's residency for a move with its first plaque, at one of its places. Raises: no_plaque, has_residency, not_here, bad_move. */
create or replace function public.scene_residency_take(p_player uuid, p_move text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  mv jsonb := public.scene_move_def(p_move);
  until_ts timestamptz;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if mv is null then raise exception 'bad_move' using errcode = '22023'; end if;
  if (select count(*) from public.scene_moves where player_id = p_player and move = p_move and collected_at is not null)
     < (cfg #>> '{residency,needs}')::int then
    raise exception 'no_plaque' using errcode = '22023';
  end if;
  if exists (select 1 from public.scene_residencies where player_id = p_player and until > now()) then
    raise exception 'has_residency' using errcode = '22023';
  end if;
  if not (mv -> 'places') ? coalesce((select at_place from public.players where id = p_player), '') then
    raise exception 'not_here' using errcode = '22023';
  end if;
  until_ts := now() + make_interval(days => (cfg #>> '{residency,days}')::int);
  insert into public.scene_residencies (player_id, move, until) values (p_player, p_move, until_ts);
  return jsonb_build_object('move', p_move, 'until', until_ts);
end;
$$;

/** Checks in at the residency: once a New York day, at one of the move's places. Raises: no_residency, not_here, done. */
create or replace function public.scene_residency_checkin(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  r public.scene_residencies;
  mv jsonb;
  c int;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_residencies where player_id = p_player and until > now() order by until desc limit 1 for update;
  if r.id is null then raise exception 'no_residency' using errcode = '22023'; end if;
  mv := public.scene_move_def(r.move);
  if not (mv -> 'places') ? coalesce((select at_place from public.players where id = p_player), '') then
    raise exception 'not_here' using errcode = '22023';
  end if;
  if r.last_paid = public.ny_today() then raise exception 'done' using errcode = '22023'; end if;
  c := round((mv ->> 'clout')::int * (cfg #>> '{residency,pay}')::numeric)::int;
  update public.scene_residencies set last_paid = public.ny_today() where id = r.id;
  if public.ledger_once(p_player, 'clout', c, 'scene_residency', r.id || ':' || public.ny_today()) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  return jsonb_build_object('clout', c);
end;
$$;

revoke all on function public.scene_move_def(text) from public, anon, authenticated;
revoke all on function public.scene_move_open(text) from public, anon, authenticated;
revoke all on function public.content_import_scene(date, jsonb) from public, anon, authenticated;
revoke all on function public.scene_weeks_live() from public, anon, authenticated;
grant execute on function public.content_import_scene(date, jsonb) to service_role;
grant execute on function public.scene_weeks_live() to service_role;
revoke all on function public.admin_scene_moves() from public, anon;
grant execute on function public.admin_scene_moves() to authenticated;
revoke all on function public.admin_scene_move_set(text, text) from public, anon;
grant execute on function public.admin_scene_move_set(text, text) to authenticated;
revoke all on function public.scene_start(uuid, text, text, boolean, int, int, int) from public, anon, authenticated;
revoke all on function public.scene_collect(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_residency_take(uuid, text) from public, anon, authenticated;
revoke all on function public.scene_residency_checkin(uuid) from public, anon, authenticated;
