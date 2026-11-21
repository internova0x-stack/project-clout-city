-- 0177: Credit for small progress and surprises (owner, Nov 21: "build 5 and 6", after the reward review; lib/rewards.ts,
-- docs/FAME.md).
--   * goals_halfway(): a goal with a real amount to reach (a part needing more than 1) that's half done pays a quarter of
--     its reward early, once (ledger 'goal_half' clout, ref = the goal). The full reward still comes when it's done.
--   * week_recap(): last New York week (Monday to Sunday) for the Monday results card: clout gained, C$ earned, Known for
--     points by score (Scene moves and fame_points), full days (the all-five bonus), Scene moves, plaques and the best moment
--     (the biggest clout row). Null when nothing happened.
--   * Surprises: at most one a New York day (surprises, keyed by day). The server action rolls whether one comes and which
--     (lib/rewards.ts) and calls surprise_give (service role), which pays it once (ledger 'surprise': C$ or clout; Energy and
--     Mood on the player). A celebrity's invite pays nothing at once: starting that Scene move today refunds its price
--     (surprise_invite_redeem, ledger 'surprise_invite').
-- Safe to run more than once.

create or replace function public.goals_halfway() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  g jsonb;
  def jsonb;
  share numeric;
  rw int;
  paid jsonb := '[]'::jsonb;
begin
  if me is null or not exists (select 1 from public.players where id = me and home_id is not null) then return paid; end if;
  for g in select x from jsonb_array_elements(coalesce(public.goal_list(me), '[]'::jsonb)) x
            where not coalesce((x ->> 'done')::boolean, false) and coalesce((x ->> 'unlock')::int, 0) <= (select clout from public.players where id = me) loop
    if jsonb_typeof(g -> 'parts') <> 'array' or jsonb_array_length(g -> 'parts') = 0 then continue; end if;
    if not exists (select 1 from jsonb_array_elements(g -> 'parts') p where (p ->> 'need')::numeric > 1) then continue; end if;
    select avg(least(1, case when (p ->> 'need')::numeric > 0 then greatest(0, (p ->> 'have')::numeric) / (p ->> 'need')::numeric else 1 end))
      into share from jsonb_array_elements(g -> 'parts') p;
    if coalesce(share, 0) < 0.5 then continue; end if;
    select x into def from jsonb_array_elements(public.game_settings_value('goals') -> 'ladder') x where x ->> 'id' = g ->> 'id';
    if def is null then continue; end if;
    rw := greatest(1, floor(coalesce((def ->> 'reward')::int, 0) * 0.25))::int;
    if public.ledger_once(me, 'clout', rw, 'goal_half', g ->> 'id') then
      update public.players set clout = clout + rw where id = me;
      paid := paid || jsonb_build_array(jsonb_build_object('id', g ->> 'id', 'clout', rw));
    end if;
  end loop;
  return paid;
end;
$$;

/** Last New York week for the Monday results card. */
create or replace function public.week_recap() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  mon date := public.ny_today() - (extract(isodow from public.ny_today())::int - 1) - 7;
  t0 timestamptz;
  t1 timestamptz;
  v_clout bigint;
  v_cash bigint;
  best record;
begin
  if me is null then return null; end if;
  t0 := (mon::timestamp at time zone 'America/New_York');
  t1 := ((mon + 7)::timestamp at time zone 'America/New_York');
  select coalesce(sum(amount) filter (where currency = 'clout' and amount > 0), 0), coalesce(sum(amount) filter (where currency = 'cash' and amount > 0), 0)
    into v_clout, v_cash from public.ledger where player_id = me and created_at >= t0 and created_at < t1;
  if v_clout = 0 and v_cash = 0 then return null; end if;
  select kind, amount into best from public.ledger
   where player_id = me and currency = 'clout' and amount > 0 and created_at >= t0 and created_at < t1 and kind not like 'fame_%'
   order by amount desc limit 1;
  return jsonb_build_object(
    'week', mon,
    'clout', v_clout,
    'cash', v_cash,
    'fullDays', (select count(*) from public.ledger where player_id = me and kind = 'daily_bonus' and currency = 'cash' and created_at >= t0 and created_at < t1),
    'moves', (select count(*) from public.scene_moves where player_id = me and collected_at >= t0 and collected_at < t1),
    'plaques', (select count(*) from public.ledger where player_id = me and kind = 'scene_plaque' and created_at >= t0 and created_at < t1),
    'scores', coalesce((select jsonb_object_agg(y.score, y.pts) from (
                 select x.score, sum(x.pts)::int as pts from (
                   select m.score, m.points as pts from public.scene_moves m where m.player_id = me and m.collected_at >= t0 and m.collected_at < t1
                   union all
                   select f.score, f.points from public.fame_points f where f.player_id = me and f.created_at >= t0 and f.created_at < t1) x
                 group by x.score) y), '{}'::jsonb),
    'best', case when best.kind is null then null else jsonb_build_object('kind', best.kind, 'clout', best.amount) end);
end;
$$;

create table if not exists public.surprises (
  player_id  uuid not null references public.players (id) on delete cascade,
  ny_date    date not null,
  kind       text not null check (kind in ('none', 'freebie', 'selfie', 'drink', 'invite')),
  payload    jsonb not null default '{}'::jsonb,
  redeemed   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (player_id, ny_date)
);
alter table public.surprises enable row level security;
revoke all on public.surprises from anon, authenticated;

/** Today's surprise, if the day has been rolled (service role). */
create or replace function public.surprise_today(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('kind', kind, 'payload', payload, 'redeemed', redeemed)
    from public.surprises where player_id = p_player and ny_date = public.ny_today()
$$;

/** Records today's roll and pays it once. 'none' records a day without one. Raises: rolled, bad_surprise. */
create or replace function public.surprise_give(p_player uuid, p_kind text, p_cash int, p_clout int, p_energy int, p_mood int, p_payload jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if p_kind not in ('none', 'freebie', 'selfie', 'drink', 'invite') or coalesce(p_cash, 0) not between 0 and 1000
     or coalesce(p_clout, 0) not between 0 and 200 or coalesce(p_energy, 0) not between 0 and 20 or coalesce(p_mood, 0) not between 0 and 10 then
    raise exception 'bad_surprise' using errcode = '22023';
  end if;
  insert into public.surprises (player_id, ny_date, kind, payload) values (p_player, public.ny_today(), p_kind, coalesce(p_payload, '{}'::jsonb))
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  if coalesce(p_cash, 0) > 0 and public.ledger_once(p_player, 'cash', p_cash, 'surprise', public.ny_today()::text) then
    update public.players set bank_cash = bank_cash + p_cash where id = p_player;
  end if;
  if coalesce(p_clout, 0) > 0 and public.ledger_once(p_player, 'clout', p_clout, 'surprise', public.ny_today()::text) then
    update public.players set clout = clout + p_clout where id = p_player;
  end if;
  if coalesce(p_energy, 0) > 0 or coalesce(p_mood, 0) > 0 then
    update public.players set energy = least(100, energy + coalesce(p_energy, 0)), mood = least(100, mood + coalesce(p_mood, 0)) where id = p_player;
  end if;
  return true;
end;
$$;

/** A celebrity's invite: starting that Scene move today refunds its price, once. Returns the refund. */
create or replace function public.surprise_invite_redeem(p_player uuid, p_scene_id uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  s public.surprises;
  r public.scene_moves;
  cost bigint;
  paid_at timestamptz;
begin
  select * into s from public.surprises where player_id = p_player and ny_date = public.ny_today() and kind = 'invite' and not redeemed for update;
  if s.player_id is null then return 0; end if;
  select * into r from public.scene_moves where id = p_scene_id and player_id = p_player;
  if r.id is null or r.move is distinct from s.payload ->> 'move' then return 0; end if;
  select -l.amount, l.created_at into cost, paid_at from public.ledger l
   where l.player_id = p_player and l.kind = 'scene_cost' and l.currency = 'cash' and l.ref = p_scene_id::text;
  -- Rank 4's perk (migration 0175) may have made this same start free already: then the invite is spent, nothing more back.
  if exists (select 1 from public.ledger where player_id = p_player and kind = 'fame_invite' and ref = public.ny_today()::text and created_at = paid_at) then
    cost := 0;
  end if;
  update public.surprises set redeemed = true where player_id = p_player and ny_date = s.ny_date;
  if coalesce(cost, 0) > 0 and public.ledger_once(p_player, 'cash', cost, 'surprise_invite', p_scene_id::text) then
    update public.players set bank_cash = bank_cash + cost where id = p_player;
  end if;
  return coalesce(cost, 0)::int;
end;
$$;

revoke all on function public.goals_halfway() from public, anon;
grant execute on function public.goals_halfway() to authenticated;
revoke all on function public.week_recap() from public, anon;
grant execute on function public.week_recap() to authenticated;
revoke all on function public.surprise_today(uuid) from public, anon, authenticated;
revoke all on function public.surprise_give(uuid, text, int, int, int, int, jsonb) from public, anon, authenticated;
revoke all on function public.surprise_invite_redeem(uuid, uuid) from public, anon, authenticated;
