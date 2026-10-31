-- 0135: Careers, part 1 (owner, Oct 31: "go"; spec section 30). Steady jobs with a ladder: Hospitality at The Gossip
-- Group (Grind & Gossip), Tech at Pivotly (Triborough Works) and Media at Clout TV (the Clout TV Tower), five levels each.
--
--   * The rules run on the server in TypeScript (lib/careers.ts, called by app/home/careerActions.ts with the service
--     role and a crypto random source), like Campaign Mode: this table keeps each job's whole state, and players have no
--     access to it (RLS on, no policies, no grants).
--   * career_context(player): what the rules need (clout, crew, Energy, where the player is, shifts today, the nine
--     skills as they are now, past jobs per track since the last Start over) and the player's latest job.
--   * career_hire: one job at a time; after the sack a track waits 7 days, after quitting 2.
--   * career_save: stores a new state against its version (a conflict means another save came first), applies the
--     workday's Energy and Mood, practices the track's two key skills once a workday, and pays, once per (kind, ref):
--     ledger 'career_pay' (cash, the weekly payday), 'career_promo' and 'career_screen' (clout). Each call counts against
--     the player's 'career' rate bucket (60 a minute).
--   * A workday is the day's work: it can't start after a shift, and no shift pays after it (career_shift_guard on the
--     ledger, which do_action's 'shift_limit' message already explains).
--   * Start over ends a job (abandoned), like a running campaign.

create table if not exists public.careers (
  id            uuid primary key,
  player_id     uuid not null references public.players (id) on delete cascade,
  track         text not null check (track in ('hospitality', 'tech', 'media')),
  status        text not null default 'employed' check (status in ('employed', 'quit', 'fired', 'abandoned')),
  level         smallint not null default 1 check (level between 1 and 5),
  best_level    smallint not null default 1,
  last_work_day date,
  state         jsonb not null,
  version       int not null default 1,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  updated_at    timestamptz not null default now()
);
create unique index if not exists careers_one_job on public.careers (player_id) where status = 'employed';
create index if not exists careers_player_idx on public.careers (player_id, started_at desc);
alter table public.careers enable row level security;
revoke all on public.careers from anon, authenticated;

-- The track's two key skills (lib/careers.ts TRACKS[].keySkills).
create or replace function public.career_skills(p_track text) returns text[]
language sql immutable set search_path = public
as $$
  select case p_track when 'hospitality' then array['charisma', 'cooking'] when 'tech' then array['smarts', 'hustle']
                      when 'media' then array['gossip', 'photography'] else array[]::text[] end
$$;

create or replace function public.career_context(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.players;
  latest public.careers;
  since timestamptz := coalesce((select max(restarted_at) from public.player_restarts where player_id = p_player), '-infinity'::timestamptz);
  today date := public.ny_today();
begin
  select * into me from public.players where id = p_player;
  if me.id is null then return null; end if;
  select * into latest from public.careers
   where player_id = p_player and status <> 'abandoned' and started_at > since order by started_at desc limit 1;
  return jsonb_build_object(
    'clout', me.clout,
    'bank', me.bank_cash,
    'energy', me.energy,
    'atPlace', me.at_place,
    'crew', (select count(*) from public.invites where inviter_id = p_player),
    'shiftsToday', (select count(*) from public.ledger l where l.player_id = p_player and l.currency = 'cash' and l.kind = 'shift'
                     and l.ref like '%:' || today::text || ':%'),
    'skills', (select jsonb_object_agg(s, public.skill_now(p_player, s))
                 from unnest(array['cooking', 'charisma', 'fitness', 'smarts', 'music', 'hustle', 'dance', 'gossip', 'photography']) s),
    'past', coalesce((
      select jsonb_object_agg(t.track, jsonb_build_object(
        'best', t.best, 'fired', t.fired,
        'lastStatus', (select c.status from public.careers c where c.player_id = p_player and c.track = t.track and c.status in ('quit', 'fired')
                        and c.started_at > since order by c.ended_at desc nulls last limit 1),
        'lastEnded', (select (c.ended_at at time zone 'America/New_York')::date from public.careers c where c.player_id = p_player and c.track = t.track
                        and c.status in ('quit', 'fired') and c.started_at > since order by c.ended_at desc nulls last limit 1)))
        from (select track, max(best_level) best, count(*) filter (where status = 'fired') fired
                from public.careers where player_id = p_player and status in ('quit', 'fired') and started_at > since group by track) t), '{}'::jsonb),
    'job', case when latest.id is null then null else jsonb_build_object(
      'id', latest.id, 'status', latest.status, 'version', latest.version, 'state', latest.state) end);
end;
$$;

create or replace function public.career_hire(p_player uuid, p_id uuid, p_track text, p_level int, p_state jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare
  prev public.careers;
begin
  if not public.rate_hit(p_player, 'career', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = p_player) then raise exception 'no_player' using errcode = '28000'; end if;
  if p_level not between 1 and 5 then raise exception 'bad_level' using errcode = '22023'; end if;
  if exists (select 1 from public.careers where player_id = p_player and status = 'employed') then
    raise exception 'employed' using errcode = '22023';
  end if;
  select * into prev from public.careers where player_id = p_player and track = p_track and status in ('quit', 'fired')
   and started_at > coalesce((select max(restarted_at) from public.player_restarts where player_id = p_player), '-infinity'::timestamptz)
   order by ended_at desc nulls last limit 1;
  if prev.id is not null and prev.ended_at > now() - (case prev.status when 'fired' then interval '7 days' else interval '2 days' end) then
    raise exception 'too_soon' using errcode = '22023';
  end if;
  insert into public.careers (id, player_id, track, level, best_level, state) values (p_id, p_player, p_track, p_level, p_level, p_state);
end;
$$;

create or replace function public.career_save(
  p_player uuid, p_id uuid, p_version int, p_state jsonb, p_level int, p_status text, p_workday date, p_energy int, p_mood int, p_payouts jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v int;
  job public.careers;
  me public.players;
  today date := public.ny_today();
  p jsonb;
  kind text;
  cur text;
  amt bigint;
  k text;
begin
  if not public.rate_hit(p_player, 'career', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_status not in ('employed', 'quit', 'fired') then raise exception 'bad_status' using errcode = '22023'; end if;
  if p_level not between 1 and 5 then raise exception 'bad_level' using errcode = '22023'; end if;
  if coalesce(p_energy, 0) not between -40 and 15 or coalesce(p_mood, 0) not between -20 and 10 then
    raise exception 'bad_effects' using errcode = '22023';
  end if;
  select * into job from public.careers where id = p_id and player_id = p_player for update;
  select * into me from public.players where id = p_player for update;
  if p_workday is not null then
    if p_workday <> today then raise exception 'bad_day' using errcode = '22023'; end if;
    if job.last_work_day = today then raise exception 'worked_today' using errcode = '22023'; end if;
    if exists (select 1 from public.ledger l where l.player_id = p_player and l.currency = 'cash' and l.kind = 'shift'
                and l.ref like '%:' || today::text || ':%') then
      raise exception 'shifted_today' using errcode = '22023';
    end if;
  end if;
  if coalesce(p_energy, 0) < 0 and me.energy < -p_energy then raise exception 'no_energy' using errcode = '22023'; end if;

  update public.careers
     set state = p_state, level = p_level, best_level = greatest(best_level, p_level), status = p_status,
         last_work_day = coalesce(p_workday, last_work_day), version = version + 1, updated_at = now(),
         ended_at = case when p_status <> 'employed' then now() else ended_at end
   where id = p_id and player_id = p_player and version = p_version and status = 'employed'
   returning version into v;
  if v is null then raise exception 'conflict' using errcode = '40001'; end if;

  if coalesce(p_energy, 0) <> 0 or coalesce(p_mood, 0) <> 0 then
    update public.players
       set energy = least(100, greatest(0, energy + coalesce(p_energy, 0))),
           mood = least(100, greatest(0, mood + coalesce(p_mood, 0)))
     where id = p_player;
  end if;
  if p_workday is not null then
    foreach k in array public.career_skills(job.track) loop
      perform public.skill_practice(p_player, k, 'career:' || p_id::text || ':' || p_workday::text);
    end loop;
  end if;

  for p in select x from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) x loop
    kind := p ->> 'kind';
    cur := p ->> 'currency';
    amt := (p ->> 'amount')::bigint;
    -- Only this job's own kinds, refs and sizes.
    continue when not (p ->> 'ref' like p_id::text || ':%');
    continue when not ((kind = 'career_pay' and cur = 'cash' and amt between 1 and 5000)
                    or (kind = 'career_promo' and cur = 'clout' and amt between 1 and 250)
                    or (kind = 'career_screen' and cur = 'clout' and amt between 1 and 50));
    if public.ledger_once(p_player, cur, amt, kind, p ->> 'ref') then
      if cur = 'cash' then update public.players set bank_cash = bank_cash + amt where id = p_player;
      else update public.players set clout = greatest(0, clout + amt) where id = p_player;
      end if;
    end if;
  end loop;
  return v;
end;
$$;

-- No shift pays on a day the player worked their job.
create or replace function public.career_shift_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'shift' and new.currency = 'cash' and new.amount > 0
     and exists (select 1 from public.careers where player_id = new.player_id and status = 'employed' and last_work_day = public.ny_today()) then
    raise exception 'shift_limit' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists career_shift_guard on public.ledger;
create trigger career_shift_guard before insert on public.ledger
  for each row when (new.kind = 'shift') execute function public.career_shift_guard();

-- Start over ends a job.
create or replace function public.career_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.careers set status = 'abandoned', ended_at = now(), updated_at = now()
   where player_id = new.player_id and status = 'employed';
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists career_on_restart on public.player_restarts;
create trigger career_on_restart after insert on public.player_restarts
  for each row execute function public.career_on_restart();

revoke all on function public.career_skills(text) from public, anon, authenticated;
revoke all on function public.career_context(uuid) from public, anon, authenticated;
revoke all on function public.career_hire(uuid, uuid, text, int, jsonb) from public, anon, authenticated;
revoke all on function public.career_save(uuid, uuid, int, jsonb, int, text, date, int, int, jsonb) from public, anon, authenticated;
revoke all on function public.career_shift_guard() from public, anon, authenticated;
revoke all on function public.career_on_restart() from public, anon, authenticated;
