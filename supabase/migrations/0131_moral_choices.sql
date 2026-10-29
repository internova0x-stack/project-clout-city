-- Moral Choices (owner, Oct 29: the game's central theme; spec section 29, lib/choices.ts).
--
-- Situation cards turn up where the player is: a one-line situation, 2 to 4 choices, each previewing what you get,
-- what it costs and the risk. The rules and the card files (content/choices/*.json, with every outcome's odds) live
-- in TypeScript on the server (app/home/choiceActions.ts, a crypto random source); this file keeps the record and
-- pays, once, like Campaign Mode (0127):
--   * reputation: the player's Integrity, 0 to 100, from 70. Private: no function shows it to anyone else. Losses
--     apply in full, gains at half (owner: a reputation takes far longer to rebuild than to lose).
--   * choice_log: every card shown (open, chosen, skipped or expired), with the receipt and what it paid.
--   * choice_later: a consequence that lands on a later New York day and names the earlier choice.
--   * At most 2 cards a New York day and one waiting at a time (choice_open); effects capped (CHOICES.caps) and paid
--     once through the ledger ('choice' and 'choice_later'); cash never below zero; rate bucket 'choice' (30 a minute).
--   * Start over is a new life: the meter and the record start again.
--   * Service role only. Players see only what app/home/choiceActions.ts sends: the card's preview, never an outcome.

create table if not exists public.reputation (
  player_id   uuid primary key references public.players (id) on delete cascade,
  integrity   smallint not null default 70 check (integrity between 0 and 100),
  revealed_at timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.reputation enable row level security;
revoke all on public.reputation from anon, authenticated;

create table if not exists public.choice_log (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  card       text not null,
  base       text not null,
  area       text not null,
  place      text,
  day        date not null,
  shown_at   timestamptz not null default now(),
  status     text not null default 'open' check (status in ('open', 'chosen', 'skipped', 'expired')),
  option     text,
  outcome    smallint,
  receipt    text,
  effects    jsonb,
  chosen_at  timestamptz
);
create index if not exists choice_log_player_idx on public.choice_log (player_id, shown_at desc);
create unique index if not exists choice_log_one_open on public.choice_log (player_id) where status = 'open';
alter table public.choice_log enable row level security;
revoke all on public.choice_log from anon, authenticated;

create table if not exists public.choice_later (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  log_id     bigint not null unique references public.choice_log (id) on delete cascade,
  due        date not null,
  emoji      text not null,
  text       text not null,
  effects    jsonb not null,
  landed_at  timestamptz,
  applied    jsonb,
  seen_at    timestamptz
);
create index if not exists choice_later_due_idx on public.choice_later (player_id, due) where landed_at is null;
alter table public.choice_later enable row level security;
revoke all on public.choice_later from anon, authenticated;

/** The effects the database accepts: whole numbers within CHOICES.caps (lib/choices.ts), nothing else. */
create or replace function public.choice_effects_ok(p jsonb) returns boolean
language sql immutable set search_path = public
as $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
     and not exists (
       select 1 from jsonb_each(coalesce(p, '{}'::jsonb)) e
        where e.key not in ('cash', 'clout', 'mood', 'energy', 'integrity')
           or jsonb_typeof(e.value) <> 'number'
           or (e.value::text)::numeric <> trunc((e.value::text)::numeric)
           or abs((e.value::text)::numeric) > case e.key when 'cash' then 1500 when 'clout' then 150 when 'mood' then 30
                                                         when 'energy' then 40 else 20 end)
$$;

/**
 * Applies one set of effects, paid once under (kind, ref): cash and clout through the ledger (never below zero),
 * mood and energy within 0 to 100, Integrity with losses in full and gains at half. Returns what was applied.
 */
create or replace function public.choice_apply(p_player uuid, p_effects jsonb, p_kind text, p_ref text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
  v_cash bigint := coalesce((p_effects ->> 'cash')::bigint, 0);
  v_clout bigint := coalesce((p_effects ->> 'clout')::bigint, 0);
  v_mood int := coalesce((p_effects ->> 'mood')::int, 0);
  v_energy int := coalesce((p_effects ->> 'energy')::int, 0);
  v_int int := coalesce((p_effects ->> 'integrity')::int, 0);
  now_int int;
  out jsonb := '{}'::jsonb;
begin
  if not public.choice_effects_ok(p_effects) then raise exception 'bad_effects' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player for update;
  if v_cash < 0 then v_cash := greatest(v_cash, -greatest(me.bank_cash, 0)); end if;
  if v_clout < 0 then v_clout := greatest(v_clout, -greatest(me.clout, 0)); end if;
  if v_cash <> 0 and public.ledger_once(p_player, 'cash', v_cash, p_kind, p_ref) then
    update public.players set bank_cash = bank_cash + v_cash where id = p_player;
    out := out || jsonb_build_object('cash', v_cash);
  end if;
  if v_clout <> 0 and public.ledger_once(p_player, 'clout', v_clout, p_kind, p_ref) then
    update public.players set clout = clout + v_clout where id = p_player;
    out := out || jsonb_build_object('clout', v_clout);
  end if;
  if v_mood <> 0 or v_energy <> 0 then
    update public.players set mood = least(100, greatest(0, mood + v_mood)), energy = least(100, greatest(0, energy + v_energy))
     where id = p_player;
    if v_mood <> 0 then out := out || jsonb_build_object('mood', v_mood); end if;
    if v_energy <> 0 then out := out || jsonb_build_object('energy', v_energy); end if;
  end if;
  insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
  select integrity into now_int from public.reputation where player_id = p_player for update;
  if v_int <> 0 then
    v_int := case when v_int < 0 then v_int else v_int / 2 end;
    v_int := least(100, greatest(0, now_int + v_int)) - now_int;
    update public.reputation set integrity = integrity + v_int, updated_at = now() where player_id = p_player;
    if v_int <> 0 then out := out || jsonb_build_object('integrity', v_int); end if;
  end if;
  return out;
end;
$$;

/** What the server's rules need to pick a card, and whether one is waiting. Stale open cards expire here. */
create or replace function public.choice_context(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
  today date := public.ny_today();
  r public.reputation;
  o public.choice_log;
begin
  select * into me from public.players where id = p_player;
  if me.id is null then return null; end if;
  update public.choice_log set status = 'expired' where player_id = p_player and status = 'open' and day < today;
  select * into r from public.reputation where player_id = p_player;
  select * into o from public.choice_log where player_id = p_player and status = 'open';
  return jsonb_build_object(
    'today', today,
    'atPlace', me.at_place,
    'integrity', coalesce(r.integrity, 70),
    'revealed', r.revealed_at is not null,
    'rank', greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)),
    'bank', me.bank_cash,
    'student', exists (select 1 from public.campus_enrolments where player_id = p_player),
    'business', exists (select 1 from public.player_businesses where player_id = p_player),
    'shownToday', (select count(*) from public.choice_log where player_id = p_player and day = today),
    'lastShownAt', (select max(shown_at) from public.choice_log where player_id = p_player),
    'open', case when o.id is null then null else jsonb_build_object('log', o.id, 'card', o.card, 'place', o.place) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', card, 'base', base, 'day', day))
                           from public.choice_log where player_id = p_player and day > today - 31), '[]'::jsonb));
end;
$$;

/** A card is shown: at most 2 a New York day and one waiting at a time. Returns its log id. */
create or replace function public.choice_open(p_player uuid, p_card text, p_base text, p_area text, p_place text) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  v bigint;
begin
  if not public.rate_hit(p_player, 'choice', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform 1 from public.players where id = p_player for update;
  if not found then raise exception 'no_player' using errcode = '28000'; end if;
  update public.choice_log set status = 'expired' where player_id = p_player and status = 'open' and day < today;
  if exists (select 1 from public.choice_log where player_id = p_player and status = 'open') then raise exception 'already_open' using errcode = '22023'; end if;
  if (select count(*) from public.choice_log where player_id = p_player and day = today) >= 2 then raise exception 'enough_today' using errcode = '22023'; end if;
  if p_card !~ '^[a-z0-9-]{1,80}$' or p_base !~ '^[a-z0-9-]{1,80}$' then raise exception 'bad_card' using errcode = '22023'; end if;
  insert into public.choice_log (player_id, card, base, area, place, day) values (p_player, p_card, p_base, left(p_area, 20), p_place, today)
  returning id into v;
  return v;
end;
$$;

/**
 * The player's answer to an open card: what the rules rolled, paid once, and (if it comes back) the later
 * consequence. Returns {integrity, first, applied}.
 */
create or replace function public.choice_settle(p_player uuid, p_log bigint, p_option text, p_outcome int, p_receipt text,
                                                p_effects jsonb, p_later jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l public.choice_log;
  today date := public.ny_today();
  applied jsonb;
  first boolean;
  due date;
begin
  if not public.rate_hit(p_player, 'choice', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into l from public.choice_log where id = p_log and player_id = p_player for update;
  if l.id is null or l.status <> 'open' or l.day <> today then raise exception 'not_open' using errcode = '22023'; end if;
  if p_later is not null then
    due := (p_later ->> 'due')::date;
    if due is null or due <= today or due > today + 14 or not public.choice_effects_ok(p_later -> 'effects') then
      raise exception 'bad_later' using errcode = '22023';
    end if;
  end if;
  applied := public.choice_apply(p_player, p_effects, 'choice', p_log::text);
  update public.reputation set revealed_at = coalesce(revealed_at, now()) where player_id = p_player
  returning revealed_at = now() into first;
  update public.choice_log
     set status = 'chosen', option = left(p_option, 40), outcome = p_outcome, receipt = left(p_receipt, 300), effects = applied, chosen_at = now()
   where id = p_log;
  if p_later is not null then
    insert into public.choice_later (player_id, log_id, due, emoji, text, effects)
    values (p_player, p_log, due, left(coalesce(p_later ->> 'emoji', '↩️'), 8), left(p_later ->> 'text', 300), p_later -> 'effects');
  end if;
  return jsonb_build_object('integrity', (select integrity from public.reputation where player_id = p_player),
                            'first', coalesce(first, false), 'applied', applied);
end;
$$;

/** Not now: the open card goes away for today (it still counts as shown). */
create or replace function public.choice_skip(p_player uuid, p_log bigint) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.choice_log set status = 'skipped' where id = p_log and player_id = p_player and status = 'open';
  if not found then raise exception 'not_open' using errcode = '22023'; end if;
end;
$$;

/** Consequences due by today land (paid once each); returns the ones the player hasn't seen yet. */
create or replace function public.choice_land(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d public.choice_later;
begin
  for d in select * from public.choice_later where player_id = p_player and landed_at is null and due <= public.ny_today() order by due, id for update loop
    update public.choice_later set landed_at = now(), applied = public.choice_apply(p_player, d.effects, 'choice_later', d.id::text) where id = d.id;
  end loop;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'log', x.log_id, 'card', l.card, 'option', l.option, 'emoji', x.emoji,
                                                       'text', x.text, 'effects', x.applied, 'day', (x.landed_at at time zone 'America/New_York')::date)
                                    order by x.landed_at)
                     from public.choice_later x join public.choice_log l on l.id = x.log_id
                    where x.player_id = p_player and x.landed_at is not null and x.seen_at is null), '[]'::jsonb);
end;
$$;

create or replace function public.choice_seen(p_player uuid, p_ids bigint[]) returns void
language sql security definer set search_path = public
as $$ update public.choice_later set seen_at = now() where player_id = p_player and id = any(p_ids) and landed_at is not null and seen_at is null $$;

/** The profile's record: the last 40 choices and consequences, newest first, plus the meter once it's revealed. */
create or replace function public.choice_history(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'integrity', (select case when revealed_at is not null then integrity end from public.reputation where player_id = p_player),
    'log', coalesce((select jsonb_agg(e order by e ->> 'at' desc) from (
      (select jsonb_build_object('id', l.id, 'kind', 'choice', 'card', l.card, 'option', l.option, 'receipt', l.receipt,
                                 'effects', l.effects, 'day', l.day, 'at', l.chosen_at) e
         from public.choice_log l where l.player_id = p_player and l.status = 'chosen' order by l.chosen_at desc limit 40)
      union all
      (select jsonb_build_object('id', -x.id, 'kind', 'later', 'card', l.card, 'option', l.option, 'receipt', x.text, 'emoji', x.emoji,
                                 'effects', x.applied, 'day', (x.landed_at at time zone 'America/New_York')::date, 'at', x.landed_at)
         from public.choice_later x join public.choice_log l on l.id = x.log_id
        where x.player_id = p_player and x.landed_at is not null order by x.landed_at desc limit 40)) s), '[]'::jsonb))
$$;

-- Start over is a new life: the meter and the record start again.
create or replace function public.choice_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.choice_log where player_id = new.player_id;
  delete from public.reputation where player_id = new.player_id;
  return new;
end;
$$;
drop trigger if exists player_restarts_choices on public.player_restarts;
create trigger player_restarts_choices after insert on public.player_restarts for each row execute function public.choice_restart();

do $$
declare f text;
begin
  foreach f in array array['choice_effects_ok(jsonb)', 'choice_apply(uuid, jsonb, text, text)', 'choice_context(uuid)',
                           'choice_open(uuid, text, text, text, text)', 'choice_settle(uuid, bigint, text, integer, text, jsonb, jsonb)',
                           'choice_skip(uuid, bigint)', 'choice_land(uuid)', 'choice_seen(uuid, bigint[])', 'choice_history(uuid)',
                           'choice_restart()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
