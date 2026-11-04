-- 0162: the Homecoming race (owner, Nov 4; docs/SCHOOL-RACE.md). An enrolled student declares for Homecoming King or Queen
-- (the crown follows the character creator's body) and has one semester, four real weeks from the next Monday, to dethrone
-- the reigning royal.
--
--   * The rules run on the server in TypeScript (lib/schoolRace.ts, called by app/home/schoolActions.ts with the service role
--     and a crypto random source), like Campaign Mode and Careers: this table keeps each race's whole state, and players have
--     no access to it (RLS on, no policies, no grants).
--   * school_context(player): what declaring and the planner need (the campus, account age, a running campaign, a career job,
--     a crush or partner, the bank, the body) and the player's latest race.
--   * school_begin: one race at a time, enrolled at that campus, an account 7+ days old (the couples' and Starter Week's
--     length), never while a city campaign runs ('campaign_running'). campaign_begin (0127's, plus that) refuses while a
--     race runs ('school_running'): both are full-time.
--   * school_save: stores a new state against its version (a conflict means another save came first) and pays, once per
--     (kind, ref): ledger 'school_cash' (C$1 to 200), 'school_spend' (−C$1 to −1,500, never below a zero bank: clamped like
--     campaign_repay), 'school_week' (clout, up to 15) and 'school_crown' (clout, up to 400, once a race, only at the end);
--     'school_mood' (±10 Mood) and 'school_meter' (±8 on the private Halo <-> Hustler meter, ±15 a race in all, like
--     campaign_rep) are kept once in school_effects. A crowned ending gives the badge 'homecoming-king' or
--     'homecoming-queen'. Each call counts against the player's 'school' rate bucket (60 a minute).
--   * Player memory: school_begin notes 'school.declared', a finished race 'school.crowned' or 'school.lost' (lib/memory.ts).
--   * Start over abandons a running race.
-- Safe to run more than once.

create table if not exists public.school_races (
  id          uuid primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  campus      text not null check (campus in ('st-johnsons', 'queensborough-u')),
  crown       text not null check (crown in ('king', 'queen')),
  status      text not null default 'running' check (status in ('running', 'over', 'abandoned')),
  ending      text check (ending in ('crown', 'dirty', 'runnerup', 'ineligible')),
  state       jsonb not null,
  version     int not null default 1,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  updated_at  timestamptz not null default now()
);
create unique index if not exists school_races_one_running on public.school_races (player_id) where status = 'running';
create index if not exists school_races_player_idx on public.school_races (player_id, started_at desc);
alter table public.school_races enable row level security;
revoke all on public.school_races from public, anon, authenticated;

-- Mood and meter changes aren't ledger currencies: each (race, kind, ref) applies once here.
create table if not exists public.school_effects (
  race_id  uuid not null references public.school_races (id) on delete cascade,
  kind     text not null check (kind in ('school_mood', 'school_meter')),
  ref      text not null,
  amount   smallint not null,
  applied  smallint not null,
  at       timestamptz not null default now(),
  primary key (race_id, kind, ref)
);
alter table public.school_effects enable row level security;
revoke all on public.school_effects from public, anon, authenticated;

create or replace function public.school_context(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.players;
  latest public.school_races;
begin
  select * into me from public.players where id = p_player;
  if me.id is null then return null; end if;
  select * into latest from public.school_races
   where player_id = p_player and status <> 'abandoned' order by started_at desc limit 1;
  return jsonb_build_object(
    'campus', (select campus from public.campus_enrolments where player_id = p_player),
    'body', me.look ->> 'body',
    'bank', me.bank_cash,
    'energy', me.energy,
    'oldEnough', me.created_at <= now() - interval '7 days',
    'campaign', exists (select 1 from public.campaigns where player_id = p_player and status = 'running'),
    'job', exists (select 1 from public.careers where player_id = p_player and status = 'employed'),
    'dating', exists (select 1 from public.couple_members where player_id = p_player)
              or exists (select 1 from public.crush_matches where a = p_player or b = p_player),
    'latest', case when latest.id is null then null else jsonb_build_object(
      'id', latest.id, 'status', latest.status, 'crown', latest.crown, 'version', latest.version, 'state', latest.state) end);
end;
$$;

create or replace function public.school_begin(p_player uuid, p_id uuid, p_campus text, p_crown text, p_state jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
begin
  if not public.rate_hit(p_player, 'school', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_crown not in ('king', 'queen') then raise exception 'bad_crown' using errcode = '22023'; end if;
  if not exists (select 1 from public.campus_enrolments where player_id = p_player and campus = p_campus) then
    raise exception 'not_enrolled' using errcode = '22023';
  end if;
  if me.created_at > now() - interval '7 days' then raise exception 'too_new' using errcode = '22023'; end if;
  if exists (select 1 from public.campaigns where player_id = p_player and status = 'running') then
    raise exception 'campaign_running' using errcode = '22023';
  end if;
  if exists (select 1 from public.school_races where player_id = p_player and status = 'running') then
    raise exception 'running' using errcode = '22023';
  end if;
  insert into public.school_races (id, player_id, campus, crown, state) values (p_id, p_player, p_campus, p_crown, p_state);
  perform public.fact_note(p_player, 'school.declared', p_crown);
end;
$$;

create or replace function public.school_save(p_player uuid, p_id uuid, p_version int, p_state jsonb, p_status text, p_payouts jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v int;
  race public.school_races;
  p jsonb;
  v_kind text;
  v_cur text;
  amt bigint;
  v_ref text;
  bank bigint;
  so_far int;
  d int;
  now_int int;
  v_ending text;
begin
  if not public.rate_hit(p_player, 'school', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_status not in ('running', 'over') then raise exception 'bad_status' using errcode = '22023'; end if;
  v_ending := case when p_status = 'over' then p_state #>> '{result,ending}' end;
  if v_ending is not null and v_ending not in ('crown', 'dirty', 'runnerup', 'ineligible') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  update public.school_races
     set state = p_state, status = p_status, ending = coalesce(v_ending, ending), version = version + 1, updated_at = now(),
         ended_at = case when p_status = 'over' then now() else ended_at end
   where id = p_id and player_id = p_player and version = p_version and status = 'running'
   returning * into race;
  if race.id is null then raise exception 'conflict' using errcode = '40001'; end if;
  v := race.version;

  for p in select x from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) x loop
    v_kind := p ->> 'kind';
    v_cur := p ->> 'currency';
    v_ref := p ->> 'ref';
    amt := (p ->> 'amount')::bigint;
    -- Only this race's own kinds, refs and sizes.
    continue when v_ref is null or amt is null or not (v_ref like p_id::text || ':%');
    continue when not ((v_kind = 'school_cash' and v_cur = 'cash' and amt between 1 and 200)
                    or (v_kind = 'school_spend' and v_cur = 'cash' and amt between -1500 and -1)
                    or (v_kind = 'school_week' and v_cur = 'clout' and amt between 1 and 15)
                    or (v_kind = 'school_crown' and v_cur = 'clout' and amt between 1 and 400 and p_status = 'over')
                    or (v_kind = 'school_mood' and v_cur = 'mood' and amt between -10 and 10 and amt <> 0)
                    or (v_kind = 'school_meter' and v_cur = 'meter' and amt between -8 and 8 and amt <> 0));

    if v_kind = 'school_mood' then
      insert into public.school_effects (race_id, kind, ref, amount, applied) values (p_id, v_kind, v_ref, amt, amt)
      on conflict do nothing;
      if found then
        update public.players set mood = least(100, greatest(0, mood + amt::int)) where id = p_player;
      end if;
      continue;
    end if;

    if v_kind = 'school_meter' then
      continue when exists (select 1 from public.school_effects e where e.race_id = p_id and e.kind = v_kind and e.ref = v_ref);
      select coalesce(sum(e.applied), 0) into so_far from public.school_effects e where e.race_id = p_id and e.kind = 'school_meter';
      d := greatest(-15 - so_far, least(15 - so_far, amt::int));
      insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
      select integrity into now_int from public.reputation where player_id = p_player for update;
      d := least(100, greatest(0, now_int + d)) - now_int;
      insert into public.school_effects (race_id, kind, ref, amount, applied) values (p_id, v_kind, v_ref, amt, d);
      if d <> 0 then update public.reputation set integrity = integrity + d, updated_at = now() where player_id = p_player; end if;
      continue;
    end if;

    if v_kind = 'school_crown' then
      continue when exists (select 1 from public.ledger l where l.player_id = p_player and l.kind = 'school_crown' and l.ref like p_id::text || ':%');
    end if;
    if v_kind = 'school_spend' then
      select bank_cash into bank from public.players where id = p_player;
      amt := greatest(amt, -bank);
      continue when amt = 0;
    end if;
    if public.ledger_once(p_player, v_cur, amt, v_kind, v_ref) then
      if v_cur = 'cash' then update public.players set bank_cash = bank_cash + amt where id = p_player;
      else update public.players set clout = greatest(0, clout + amt) where id = p_player;
      end if;
    end if;
  end loop;

  if p_status = 'over' then
    if v_ending in ('crown', 'dirty') then
      insert into public.player_badges (player_id, badge_id, arc_id)
      values (p_player, case race.crown when 'queen' then 'homecoming-queen' else 'homecoming-king' end, 'school')
      on conflict do nothing;
      perform public.fact_note(p_player, 'school.crowned', race.crown, jsonb_build_object('dirty', v_ending = 'dirty'));
    else
      perform public.fact_note(p_player, 'school.lost', race.crown, jsonb_build_object('ending', v_ending));
    end if;
  end if;
  return v;
end;
$$;

-- Start over abandons a running race.
create or replace function public.school_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.school_races set status = 'abandoned', ended_at = now(), updated_at = now()
   where player_id = new.player_id and status = 'running';
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists school_on_restart on public.player_restarts;
create trigger school_on_restart after insert on public.player_restarts
  for each row execute function public.school_on_restart();

-- 0127's campaign_begin, plus: no campaign while a Homecoming race runs (both are full-time).
create or replace function public.campaign_begin(p_player uuid, p_id uuid, p_candidate text, p_state jsonb, p_seed int) returns void
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
  last_start timestamptz;
begin
  if not public.rate_hit(p_player, 'campaign', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)) < 2 then raise exception 'locked' using errcode = '22023'; end if;
  if exists (select 1 from public.campaigns where player_id = p_player and status = 'running') then
    raise exception 'running' using errcode = '22023';
  end if;
  if exists (select 1 from public.school_races where player_id = p_player and status = 'running') then
    raise exception 'school_running' using errcode = '22023';
  end if;
  select max(started_at) into last_start from public.campaigns_since(p_player) x where x.status <> 'abandoned';
  if last_start > now() - interval '7 days' then raise exception 'too_soon' using errcode = '22023'; end if;
  if p_seed < 0 or p_seed > 1000 then raise exception 'bad_seed' using errcode = '22023'; end if;
  if p_seed > me.bank_cash then raise exception 'no_bank' using errcode = '22023'; end if;
  insert into public.campaigns (id, player_id, candidate, state) values (p_id, p_player, p_candidate, p_state);
  if p_seed > 0 and public.ledger_once(p_player, 'cash', -p_seed, 'campaign_seed', p_id::text) then
    update public.players set bank_cash = bank_cash - p_seed where id = p_player;
  end if;
end;
$$;

revoke all on function public.school_context(uuid) from public, anon, authenticated;
revoke all on function public.school_begin(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.school_save(uuid, uuid, int, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.school_on_restart() from public, anon, authenticated;
revoke all on function public.campaign_begin(uuid, uuid, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.school_context(uuid) to service_role;
grant execute on function public.school_begin(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.school_save(uuid, uuid, int, jsonb, text, jsonb) to service_role;
