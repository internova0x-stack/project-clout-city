-- 0150: the underworld, part 2 (owner, Oct 31: "go with 1, 2, and 3"; spec section 31).
--   * Pablo's crew (Tito, Gigi, Auntie Bee) and the Thursday table live in the player's underworld state (lib/underworld.ts);
--     underworld_save now also pays the table: ledger 'underworld_table' (C$1 to 1,000, once a New York week by its ref).
--   * Weekly jobs for Pablo: the routine writes content/underworld-weeks/<Monday>.json; content_import_underworld (service
--     role, run by syncWeeklyContent) stores each new job 'scheduled', live 24 hours later unless the owner vetoes or pauses
--     it in Studio → Storylets → Pablo's jobs (held 'paused' while the 'storylets' autopilot is off; a stored job is never
--     touched). underworld_jobs_live() (service role) feeds the server's pool; admin_underworld_jobs(),
--     admin_underworld_job_set(id, action) for the Studio (veto, pause, restore, now).
--   * The Charity Gala, Halo only: at Ditmars Heights Rooftop, once a New York week, a player whose meter is revealed and at
--     70 or more donates C$100, 250, 500 or 1,000 (gala_donate; ledger 'gala_donation' cash and 'gala' clout: a quarter of
--     the gift, at most 250; +10 Mood; the meter +2). gala_state() says whether the player is on the list.
--     game_settings 'gala', mirrored by lib/gala.ts (tests/gala.test.ts). Rate bucket 'gala'.
-- Safe to run more than once.

create or replace function public.underworld_save(
  p_player uuid, p_version int, p_state jsonb, p_energy int, p_mood int, p_integrity int, p_payouts jsonb, p_holding int, p_headline text
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v int;
  me public.players;
  p jsonb;
  kind text;
  amt bigint;
  now_int int;
  d int;
begin
  if not public.rate_hit(p_player, 'underworld', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if coalesce(p_energy, 0) not between -30 and 0 or coalesce(p_mood, 0) not between -10 and 10
     or coalesce(p_integrity, 0) not between -10 and 10 or coalesce(p_holding, 0) not between 0 and 3 then
    raise exception 'bad_effects' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'bad_state' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if coalesce(p_energy, 0) < 0 then
    if public.choice_marked(p_player, 'holding') then raise exception 'in_holding' using errcode = '22023'; end if;
    if me.energy < -p_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  end if;

  if p_version = 0 then
    insert into public.underworld (player_id, state) values (p_player, p_state) on conflict (player_id) do nothing returning version into v;
  else
    update public.underworld set state = p_state, version = version + 1, updated_at = now()
     where player_id = p_player and version = p_version returning version into v;
  end if;
  if v is null then raise exception 'conflict' using errcode = '40001'; end if;

  if coalesce(p_energy, 0) <> 0 or coalesce(p_mood, 0) <> 0 then
    update public.players
       set energy = least(100, greatest(0, energy + coalesce(p_energy, 0))),
           mood = least(100, greatest(0, mood + coalesce(p_mood, 0)))
     where id = p_player;
  end if;
  if coalesce(p_integrity, 0) <> 0 then
    insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
    select integrity into now_int from public.reputation where player_id = p_player for update;
    d := least(100, greatest(0, now_int + p_integrity)) - now_int;
    if d <> 0 then update public.reputation set integrity = integrity + d, updated_at = now() where player_id = p_player; end if;
  end if;

  for p in select x from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) x loop
    kind := p ->> 'kind';
    amt := (p ->> 'amount')::bigint;
    continue when coalesce(p ->> 'currency', '') <> 'cash' or coalesce(p ->> 'ref', '') !~ '^[a-z0-9:-]{1,120}$';
    continue when not ((kind = 'underworld_pay' and amt between 1 and 2500)
                    or (kind = 'underworld_fine' and amt between -1500 and -1)
                    or (kind = 'underworld_lawyer' and amt between -1000 and -1)
                    or (kind = 'underworld_table' and amt between 1 and 1000));
    -- A fine or the retainer never takes the bank below zero.
    if amt < 0 then
      amt := greatest(amt, -greatest((select bank_cash from public.players where id = p_player), 0));
      continue when amt = 0;
    end if;
    if public.ledger_once(p_player, 'cash', amt, kind, p ->> 'ref') then
      update public.players set bank_cash = bank_cash + amt where id = p_player;
    end if;
  end loop;

  -- Caught: holding at the 114½ (the precinct first, so the at_place guard lets it through), then the Blotter.
  if coalesce(p_holding, 0) > 0 and not public.choice_marked(p_player, 'holding') then
    update public.players set at_place = 'precinct-114-half', arrives_at = now() where id = p_player;
    insert into public.choice_marks (player_id, kind, place, until)
    values (p_player, 'holding', 'precinct-114-half', now() + make_interval(hours => p_holding));
  end if;
  if p_headline is not null and length(p_headline) <= 260 then perform public.choice_headline(p_player, p_headline); end if;
  return v;
end;
$$;


-- ---------------------------------------------------------------------------
-- Weekly jobs for Pablo
-- ---------------------------------------------------------------------------
create table if not exists public.underworld_jobs (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  week       date not null,
  job        jsonb not null,
  status     text not null default 'scheduled' check (status in ('scheduled', 'paused', 'vetoed', 'live')),
  arrived_at timestamptz not null default now(),
  live_at    timestamptz not null,
  went_live  boolean not null default false,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
create index if not exists underworld_jobs_week_idx on public.underworld_jobs (week desc);
alter table public.underworld_jobs enable row level security;
revoke all on public.underworld_jobs from anon, authenticated;

/** Stores a week's new jobs (service role). Returns how many were added. */
create or replace function public.content_import_underworld(p_week date, p_jobs jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  j jsonb;
  n int := 0;
  hrs numeric := coalesce((public.game_settings_value('storylets') ->> 'window_hours')::numeric, 24);
  held boolean := not (public.autopilot() ->> 'storylets')::boolean;
begin
  if p_week is null or jsonb_typeof(p_jobs) <> 'array' then raise exception 'bad_week' using errcode = '22023'; end if;
  for j in select * from jsonb_array_elements(p_jobs) loop
    insert into public.underworld_jobs (id, week, job, status, live_at)
    values (j ->> 'id', p_week, j, case when held then 'paused' else 'scheduled' end,
            now() + make_interval(secs => (hrs * 3600)::double precision))
    on conflict (id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

/** Every job that has gone live (service role), `offer` while it's live now. */
create or replace function public.underworld_jobs_live() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('job', job, 'offer', public.storylet_state(status, live_at) = 'live')
                            order by week, id), '[]'::jsonb)
  from public.underworld_jobs
  where went_live or public.storylet_state(status, live_at) = 'live'
$$;

create or replace function public.admin_underworld_jobs() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'week', week, 'job', job, 'status', public.storylet_state(status, live_at),
      'live_at', live_at, 'arrived_at', arrived_at, 'decided_at', decided_at) order by week desc, arrived_at, id)
    from public.underworld_jobs), '[]'::jsonb);
end;
$$;

/** The owner's decision on one job: 'veto', 'pause', 'restore', 'now' (as for storylets, migration 0139). */
create or replace function public.admin_underworld_job_set(p_id text, p_action text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.underworld_jobs;
begin
  perform public.require_story_admin();
  select * into r from public.underworld_jobs where id = p_id for update;
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
  update public.underworld_jobs set status = r.status, live_at = r.live_at, went_live = r.went_live,
         decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  return public.admin_underworld_jobs();
end;
$$;

-- ---------------------------------------------------------------------------
-- The Charity Gala (Halo only)
-- ---------------------------------------------------------------------------
insert into public.game_settings (key, value) values ('gala', '{"place":"ditmars-heights-rooftop","minMeter":70,"amounts":[100,250,500,1000],"cloutShare":0.25,"cloutMax":250,"mood":10,"integrity":2}'::jsonb)
on conflict (key) do nothing;

/** Whether the signed-in player is on the list this week, and what's on offer. */
create or replace function public.gala_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g jsonb := public.game_settings_value('gala');
  rep public.reputation;
  wk date := date_trunc('week', public.ny_today())::date;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into rep from public.reputation where player_id = uid;
  return jsonb_build_object(
    'invited', rep.revealed_at is not null and rep.integrity >= (g ->> 'minMeter')::int,
    'revealed', rep.revealed_at is not null,
    'donated', (select -l.amount from public.ledger l where l.player_id = uid and l.currency = 'cash' and l.kind = 'gala_donation'
                 and l.ref = 'gala:' || wk::text),
    'week', wk,
    'amounts', g -> 'amounts');
end;
$$;

/** A Halo's gift at the gala: once a New York week, at the rooftop. Returns the clout it earned. */
create or replace function public.gala_donate(p_amount int) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g jsonb := public.game_settings_value('gala');
  me public.players;
  rep public.reputation;
  wk date := date_trunc('week', public.ny_today())::date;
  ref text;
  v_clout int;
  d int;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'gala', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_amount is null or not (g -> 'amounts') @> to_jsonb(p_amount) then raise exception 'bad_amount' using errcode = '22023'; end if;
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into rep from public.reputation where player_id = uid for update;
  if rep.revealed_at is null or rep.integrity < (g ->> 'minMeter')::int then raise exception 'not_invited' using errcode = '22023'; end if;
  if me.at_place is distinct from (g ->> 'place') then raise exception 'not_here' using errcode = '22023'; end if;
  if me.bank_cash < p_amount then raise exception 'cant_afford' using errcode = '22023'; end if;
  ref := 'gala:' || wk::text;
  if not public.ledger_once(uid, 'cash', -p_amount, 'gala_donation', ref) then raise exception 'done_this_week' using errcode = '22023'; end if;
  v_clout := least((g ->> 'cloutMax')::int, floor(p_amount * (g ->> 'cloutShare')::numeric)::int);
  update public.players set bank_cash = bank_cash - p_amount, mood = least(100, mood + (g ->> 'mood')::int) where id = uid;
  if public.ledger_once(uid, 'clout', v_clout, 'gala', ref) then
    update public.players set clout = clout + v_clout where id = uid;
  end if;
  d := least(100, rep.integrity + (g ->> 'integrity')::int) - rep.integrity;
  if d <> 0 then update public.reputation set integrity = integrity + d, updated_at = now() where player_id = uid; end if;
  return jsonb_build_object('clout', v_clout, 'mood', (g ->> 'mood')::int);
end;
$$;

revoke all on function public.underworld_save(uuid, int, jsonb, int, int, int, jsonb, int, text) from public, anon, authenticated;
revoke all on function public.content_import_underworld(date, jsonb) from public, anon, authenticated;
revoke all on function public.underworld_jobs_live() from public, anon, authenticated;
grant execute on function public.content_import_underworld(date, jsonb) to service_role;
grant execute on function public.underworld_jobs_live() to service_role;
revoke all on function public.admin_underworld_jobs() from public, anon;
grant execute on function public.admin_underworld_jobs() to authenticated;
revoke all on function public.admin_underworld_job_set(text, text) from public, anon;
grant execute on function public.admin_underworld_job_set(text, text) to authenticated;
revoke all on function public.gala_state() from public, anon;
grant execute on function public.gala_state() to authenticated;
revoke all on function public.gala_donate(int) from public, anon;
grant execute on function public.gala_donate(int) to authenticated;
