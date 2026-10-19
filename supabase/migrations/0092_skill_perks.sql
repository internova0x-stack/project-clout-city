-- Skill perks (owner, Oct 19): skills open doors. At levels 3, 6 and 9 each skill unlocks a paid gig, an invite or an
-- access (lib/skills.ts SKILL_PERKS; the rules are copied into game_settings 'skill_perks', checked by
-- tests/skills.test.ts). Every check uses the skill's level now, rust included.
--
--   * Skill gigs: once a week each (week = Monday, New York). Take Energy and time like a gig, one gig at a time
--     (board or skill), pay C$ on collect (ledger cash 'skill_gig', ref perk:week; level 9 adds clout).
--   * Invites: accepted once, pay clout (ledger clout 'skill_invite', ref perk); level 9 adds a badge "perk-<id>".
--   * Access: Dance 3 gets you past every club door (travel, use_guest_pass); Dance 9 opens every club's VIP floor
--     (vip_access answers 'skill').
--   * skill_perks_state(): levels, this week's skill gigs and accepted invites (for the Skills tab and the Gigs app).

insert into public.game_settings (key, value) values ('skill_perks', '[{"id":"cooking-3","skill":"cooking","level":3,"kind":"gig","pay":150,"energy":25,"waitMinutes":60},{"id":"cooking-6","skill":"cooking","level":6,"kind":"gig","pay":600,"energy":50,"waitMinutes":120},{"id":"cooking-9","skill":"cooking","level":9,"kind":"gig","pay":2000,"clout":100,"energy":75,"waitMinutes":240},{"id":"charisma-3","skill":"charisma","level":3,"kind":"invite","clout":50},{"id":"charisma-6","skill":"charisma","level":6,"kind":"invite","clout":150},{"id":"charisma-9","skill":"charisma","level":9,"kind":"invite","clout":500,"badge":"Cloutie Presenter"},{"id":"fitness-3","skill":"fitness","level":3,"kind":"gig","pay":120,"energy":25,"waitMinutes":60},{"id":"fitness-6","skill":"fitness","level":6,"kind":"gig","pay":400,"energy":50,"waitMinutes":120},{"id":"fitness-9","skill":"fitness","level":9,"kind":"gig","pay":1500,"clout":100,"energy":75,"waitMinutes":240},{"id":"smarts-3","skill":"smarts","level":3,"kind":"gig","pay":100,"energy":25,"waitMinutes":60},{"id":"smarts-6","skill":"smarts","level":6,"kind":"gig","pay":350,"energy":50,"waitMinutes":120},{"id":"smarts-9","skill":"smarts","level":9,"kind":"invite","clout":500,"badge":"Big Ideas Speaker"},{"id":"music-3","skill":"music","level":3,"kind":"gig","pay":120,"energy":25,"waitMinutes":60},{"id":"music-6","skill":"music","level":6,"kind":"gig","pay":500,"energy":50,"waitMinutes":120},{"id":"music-9","skill":"music","level":9,"kind":"gig","pay":2000,"clout":100,"energy":75,"waitMinutes":240},{"id":"hustle-3","skill":"hustle","level":3,"kind":"gig","pay":150,"energy":25,"waitMinutes":60},{"id":"hustle-6","skill":"hustle","level":6,"kind":"invite","clout":150},{"id":"hustle-9","skill":"hustle","level":9,"kind":"invite","clout":500,"badge":"Seed Round Regular"},{"id":"dance-3","skill":"dance","level":3,"kind":"access","access":"door"},{"id":"dance-6","skill":"dance","level":6,"kind":"gig","pay":400,"energy":50,"waitMinutes":120},{"id":"dance-9","skill":"dance","level":9,"kind":"access","access":"vip"},{"id":"gossip-3","skill":"gossip","level":3,"kind":"invite","clout":50},{"id":"gossip-6","skill":"gossip","level":6,"kind":"gig","pay":300,"energy":50,"waitMinutes":120},{"id":"gossip-9","skill":"gossip","level":9,"kind":"invite","clout":500,"badge":"Off the Record"},{"id":"photography-3","skill":"photography","level":3,"kind":"gig","pay":120,"energy":25,"waitMinutes":60},{"id":"photography-6","skill":"photography","level":6,"kind":"gig","pay":600,"energy":50,"waitMinutes":120},{"id":"photography-9","skill":"photography","level":9,"kind":"gig","pay":1500,"clout":100,"energy":75,"waitMinutes":240}]'::jsonb)
on conflict (key) do update set value = excluded.value;

create table public.skill_gig_runs (
  player_id uuid not null references public.players (id) on delete cascade,
  perk text not null,
  week date not null,
  accepted_at timestamptz not null,
  ready_at timestamptz not null,
  collected_at timestamptz,
  primary key (player_id, perk, week)
);
alter table public.skill_gig_runs enable row level security;
create policy "own skill gigs" on public.skill_gig_runs for select to authenticated using (player_id = auth.uid());

create function public.skill_perk(p_id text) returns jsonb
language sql stable security definer set search_path = public
as $$ select p from public.game_settings s, jsonb_array_elements(s.value) p where s.key = 'skill_perks' and p ->> 'id' = p_id $$;

/** A player's level in one skill right now (rust counted), 0 without practice. */
create function public.skill_now(p_player uuid, p_skill text) returns int
language sql stable security definer set search_path = public
as $$
  select coalesce((select public.skill_effective(s.practice, s.best, s.last_practiced)
                     from public.player_skills s where s.player_id = p_player and s.skill = p_skill), 0)
$$;

/** Whether a skill gives this access ('door' or 'vip') right now. */
create function public.perk_access(p_player uuid, p_access text) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.game_settings s, jsonb_array_elements(s.value) p
                  where s.key = 'skill_perks' and p ->> 'access' = p_access
                    and public.skill_now(p_player, p ->> 'skill') >= (p ->> 'level')::int)
$$;

create function public.skill_week() returns date
language sql stable set search_path = public
as $$ select date_trunc('week', public.ny_today())::date $$;

create function public.skill_perks_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  return jsonb_build_object(
    'levels', (select jsonb_object_agg(k, public.skill_now(uid, k))
                 from unnest(array['cooking','charisma','fitness','smarts','music','hustle','dance','gossip','photography']) k),
    'gigs', coalesce((select jsonb_agg(jsonb_build_object('perk', perk, 'accepted_at', accepted_at, 'ready_at', ready_at, 'collected_at', collected_at))
                        from public.skill_gig_runs where player_id = uid and (week = public.skill_week() or collected_at is null)), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(ref) from public.ledger
                          where player_id = uid and currency = 'clout' and kind = 'skill_invite'), '[]'::jsonb));
end;
$$;

create function public.skill_gig_take(p_perk text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_perk jsonb := public.skill_perk(p_perk);
  me public.players;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if v_perk is null or v_perk ->> 'kind' <> 'gig' then raise exception 'unknown_perk' using errcode = '22023'; end if;
  if public.skill_now(uid, v_perk ->> 'skill') < (v_perk ->> 'level')::int then raise exception 'skill_locked' using errcode = '22023'; end if;
  if exists (select 1 from public.skill_gig_runs where player_id = uid and perk = p_perk and week = public.skill_week()) then
    raise exception 'gig_done_week' using errcode = '22023';
  end if;
  if exists (select 1 from public.gig_offers where player_id = uid and accepted_at is not null and collected_at is null)
     or exists (select 1 from public.skill_gig_runs where player_id = uid and collected_at is null) then
    raise exception 'gig_active' using errcode = '22023';
  end if;
  if me.energy < (v_perk ->> 'energy')::int then raise exception 'no_energy' using errcode = '22023'; end if;
  update public.players set energy = energy - (v_perk ->> 'energy')::int where id = uid;
  insert into public.skill_gig_runs (player_id, perk, week, accepted_at, ready_at)
  values (uid, p_perk, public.skill_week(), public.game_now(), public.game_now() + make_interval(mins => (v_perk ->> 'waitMinutes')::int));
end;
$$;

create function public.skill_gig_collect(p_perk text) returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_perk jsonb := public.skill_perk(p_perk);
  r public.skill_gig_runs;
  ref text;
begin
  select * into r from public.skill_gig_runs where player_id = uid and perk = p_perk and collected_at is null for update;
  if r.player_id is null or v_perk is null then raise exception 'unknown_perk' using errcode = '22023'; end if;
  if r.ready_at > public.game_now() then raise exception 'not_ready' using errcode = '22023'; end if;
  update public.skill_gig_runs set collected_at = public.game_now() where player_id = uid and perk = p_perk and week = r.week;
  ref := p_perk || ':' || r.week;
  if public.ledger_once(uid, 'cash', (v_perk ->> 'pay')::int, 'skill_gig', ref) then
    update public.players set bank_cash = bank_cash + (v_perk ->> 'pay')::int where id = uid;
  end if;
  if coalesce((v_perk ->> 'clout')::int, 0) > 0 and public.ledger_once(uid, 'clout', (v_perk ->> 'clout')::int, 'skill_gig', ref) then
    update public.players set clout = clout + (v_perk ->> 'clout')::int where id = uid;
  end if;
  perform public.skill_practice(uid, v_perk ->> 'skill', 'perk:' || ref);
  return (v_perk ->> 'pay')::int;
end;
$$;

create function public.skill_invite_accept(p_perk text) returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_perk jsonb := public.skill_perk(p_perk);
  v_clout int := coalesce((v_perk ->> 'clout')::int, 0);
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '28000'; end if;
  if v_perk is null or v_perk ->> 'kind' <> 'invite' then raise exception 'unknown_perk' using errcode = '22023'; end if;
  if public.skill_now(uid, v_perk ->> 'skill') < (v_perk ->> 'level')::int then raise exception 'skill_locked' using errcode = '22023'; end if;
  if not public.ledger_once(uid, 'clout', v_clout, 'skill_invite', p_perk) then return 0; end if;
  update public.players set clout = clout + v_clout where id = uid;
  if v_perk ? 'badge' then
    insert into public.player_badges (player_id, badge_id, arc_id) values (uid, 'perk-' || p_perk, 'skills') on conflict do nothing;
  end if;
  return v_clout;
end;
$$;

-- 0024's accept_gig: one gig at a time counts skill gigs too.
create or replace function public.accept_gig(p_offer bigint)
returns public.gig_offers
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o public.gig_offers;
  me public.players;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  select * into o from public.gig_offers where id = p_offer and player_id = uid for update;
  if o.id is null then raise exception 'unknown_gig' using errcode = '22023'; end if;
  if o.ny_date <> public.ny_today() then raise exception 'gig_expired' using errcode = '22023'; end if;
  if o.accepted_at is not null then return o; end if;
  if exists (select 1 from public.gig_offers where player_id = uid and accepted_at is not null and collected_at is null)
     or exists (select 1 from public.skill_gig_runs where player_id = uid and collected_at is null) then
    raise exception 'gig_active' using errcode = '22023';
  end if;
  if me.clout < coalesce((public.city() -> 'economy' -> 'gigs' -> o.tier ->> 'clout')::int, 0) then
    raise exception 'needs_clout' using errcode = '22023';
  end if;
  if me.confidence < o.confidence_req then raise exception 'needs_confidence' using errcode = '22023'; end if;
  if me.energy < o.energy then raise exception 'no_energy' using errcode = '22023'; end if;
  update public.players set energy = energy - o.energy where id = uid;
  update public.gig_offers set accepted_at = public.game_now(), ready_at = public.game_now() + make_interval(mins => o.wait_minutes)
   where id = o.id returning * into o;
  return o;
end;
$$;

-- 0073's travel: Dance 3 gets you past the door too.
create or replace function public.travel(p_place text, p_mode text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t jsonb := public.city() -> 'economy' -> 'travel';
  me public.players;
  dest text := nullif(p_place, 'home');
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  v_from jsonb;
  v_to jsonb;
  v_miles numeric;
  band int;
  v_fare int := 0;
  v_energy int := 0;
  v_seconds int;
  v_arrives timestamptz;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if dest is not null and (place is null or (place ->> 'story' is not null and not public.arc_started(place ->> 'story'))) then
    raise exception 'unknown_place' using errcode = '22023';
  end if;
  -- #19 (0046): the exclusive club's bouncer checks your clout at the door; 0073: or your name on tonight's list.
  if dest is not null and me.clout < coalesce((place -> 'club' ->> 'doorClout')::int, 0) and not public.pass_tonight(uid, dest)
     and not public.perk_access(uid, 'door') then
    raise exception 'door_clout' using errcode = '22023';
  end if;
  if me.at_place is not distinct from dest then
    return jsonb_build_object('place', coalesce(dest, 'home'), 'already', true,
                              'seconds', greatest(0, ceil(extract(epoch from coalesce(me.arrives_at, now()) - clock_timestamp())))::int);
  end if;
  v_from := public.travel_point(uid, me.at_place);
  v_to := public.travel_point(uid, dest);
  v_miles := coalesce(public.miles_between(v_from, v_to), 0);
  band := case when v_miles < (t -> 'bandsMiles' ->> 0)::numeric then 0
               when v_miles < (t -> 'bandsMiles' ->> 1)::numeric then 1
               when v_miles < (t -> 'bandsMiles' ->> 2)::numeric then 2 else 3 end;
  case p_mode
    when 'walk' then
      if t -> 'walk' -> 'energy' -> band = 'null'::jsonb then raise exception 'too_far_to_walk' using errcode = '22023'; end if;
      v_energy := (t -> 'walk' -> 'energy' ->> band)::int;
    when 'subway' then v_fare := (t -> 'subway' ->> 'fare')::int;
    when 'taxi' then v_fare := (t -> 'taxi' -> 'fare' ->> band)::int;
    when 'car' then
      if me.car_sku is null then raise exception 'no_car' using errcode = '22023'; end if;
    else raise exception 'bad_mode' using errcode = '22023';
  end case;
  v_seconds := public.trip_seconds(p_mode, v_miles);
  if me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_fare then raise exception 'cant_afford' using errcode = '22023'; end if;

  v_arrives := clock_timestamp() + make_interval(secs => v_seconds);
  update public.players set at_place = dest, arrives_at = v_arrives,
    bank_cash = bank_cash - v_fare, energy = energy - v_energy where id = uid;
  if v_fare > 0 then
    perform public.ledger_once(uid, 'cash', -v_fare, 'travel',
      p_mode || ':' || coalesce(dest, 'home') || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  end if;
  return jsonb_build_object('place', coalesce(dest, 'home'), 'mode', p_mode, 'miles', round(v_miles, 2),
                            'cash', -v_fare, 'energy', -v_energy, 'seconds', v_seconds, 'arrivesAt', v_arrives);
end;
$$;

-- 0073's use_guest_pass: no pass needed for a door your dancing already opens.
create or replace function public.use_guest_pass(p_place text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  me public.players;
  v_pass bigint;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if place is null or place ->> 'story' is not null or jsonb_typeof(place -> 'club') is distinct from 'object' then
    raise exception 'not_a_club' using errcode = '22023';
  end if;
  if not public.place_open(p_place) then raise exception 'borough_locked' using errcode = '22023'; end if;
  if public.pass_tonight(uid, p_place) then return public.goals_state_for(uid); end if;
  if exists (select 1 from public.guest_passes where player_id = uid and used_on = today) then
    raise exception 'pass_used_tonight' using errcode = '22023';
  end if;
  select id into v_pass from public.guest_passes where player_id = uid and used_on is null order by id limit 1 for update;
  if v_pass is null then raise exception 'no_pass' using errcode = '22023'; end if;
  if not ((me.clout < coalesce((place -> 'club' ->> 'doorClout')::int, 0) and not public.perk_access(uid, 'door'))
          or (place -> 'club' ->> 'vip' is not null and public.vip_access(uid, p_place) is null)) then
    raise exception 'pass_not_needed' using errcode = '22023';
  end if;
  update public.guest_passes set used_place = p_place, used_on = today where id = v_pass;
  return public.goals_state_for(uid);
end;
$$;

-- 0073's vip_access, plus 'skill' for Dance 9 (after 'free', before covers and passes).
create or replace function public.vip_access(p_player uuid, p_place text) returns text
language sql stable security definer set search_path = public
as $$
  with pl as (select p -> 'club' ->> 'vip' as tier from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place),
       cfg as (select public.city() -> 'economy' -> 'clubs' -> 'vip' -> pl.tier as v from pl where pl.tier is not null)
  select case
    when (select clout from public.players where id = p_player) >= (select (v ->> 'freeClout')::int from cfg) then 'free'
    when public.perk_access(p_player, 'vip') then 'skill'
    when exists (select 1 from public.ledger l where l.player_id = p_player and l.currency = 'cash' and l.kind = 'vip_cover'
                  and l.ref = p_place || ':' || public.ny_today()) then 'paid'
    when public.pass_tonight(p_player, p_place) then 'pass'
  end
  from cfg
$$;

revoke all on function public.skill_perk(text) from public, anon, authenticated;
revoke all on function public.skill_now(uuid, text) from public, anon, authenticated;
revoke all on function public.perk_access(uuid, text) from public, anon, authenticated;
revoke all on function public.skill_week() from public, anon, authenticated;
revoke all on function public.skill_perks_state() from public, anon, authenticated;
revoke all on function public.skill_gig_take(text) from public, anon, authenticated;
revoke all on function public.skill_gig_collect(text) from public, anon, authenticated;
revoke all on function public.skill_invite_accept(text) from public, anon, authenticated;
grant execute on function public.skill_perks_state() to authenticated;
grant execute on function public.skill_gig_take(text) to authenticated;
grant execute on function public.skill_gig_collect(text) to authenticated;
grant execute on function public.skill_invite_accept(text) to authenticated;
