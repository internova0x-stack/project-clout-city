-- Moral Choices with real stakes (owner, Oct 30: "Losing an umbrella has no real stakes. But taking part in stealing,
-- covering up criminality, have real stakes"; picked bigger money, lasting effects, chains and public headlines; police
-- played for laughs). Builds on 0131:
--   * Bigger effects: cash up to ±3,000 and clout up to ±300 (lib/choices.ts CHOICES.caps).
--   * Lasting effects (choice_marks): `ban` from a place for 1 to 7 days (can't travel there or do anything there),
--     `gigLock` for 1 to 3 days (the gig board refuses), `holding` for 1 to 3 hours at the 114½ Precinct (the player is
--     put there and can't travel or act elsewhere until it's over, or bail is paid: choice_bail, C$150 an hour left,
--     ledger 'bail'). Guarded by triggers on players.at_place, place_visits and gig_offers.
--   * Chains: a later may carry `card`, a chain-only follow-up opened on its day past the daily limit (choice_chain_open).
--   * Headlines: a later may carry `headline` ({name} for the player); when it lands it goes to Lola's Blotter
--     (choice_headlines), never for a player who opted out of News mentions. choice_blotter() is what players read.

-- ---------------------------------------------------------------------------
-- Effects: bigger numbers and the lasting kinds
-- ---------------------------------------------------------------------------
create or replace function public.choice_effects_ok(p jsonb) returns boolean
language sql immutable set search_path = public
as $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
     and not exists (
       select 1 from jsonb_each(coalesce(p, '{}'::jsonb)) e
        where case
          when e.key = 'ban' then not (
            jsonb_typeof(e.value) = 'object' and jsonb_typeof(e.value -> 'place') = 'string'
            and (e.value ->> 'place') ~ '^[a-z0-9-]{1,80}$' and jsonb_typeof(e.value -> 'days') = 'number'
            and (e.value ->> 'days')::numeric between 1 and 7 and (e.value ->> 'days')::numeric = trunc((e.value ->> 'days')::numeric))
          when e.key in ('gigLock', 'holding') then not (
            jsonb_typeof(e.value) = 'number' and (e.value::text)::numeric between 1 and 3 and (e.value::text)::numeric = trunc((e.value::text)::numeric))
          when e.key in ('cash', 'clout', 'mood', 'energy', 'integrity') then not (
            jsonb_typeof(e.value) = 'number' and (e.value::text)::numeric = trunc((e.value::text)::numeric)
            and abs((e.value::text)::numeric) <= case e.key when 'cash' then 3000 when 'clout' then 300 when 'mood' then 30
                                                             when 'energy' then 40 else 20 end)
          else true
        end)
$$;

create table if not exists public.choice_marks (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  kind       text not null check (kind in ('ban', 'gig_lock', 'holding')),
  place      text,
  until      timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists choice_marks_player_idx on public.choice_marks (player_id, kind, until);
alter table public.choice_marks enable row level security;
revoke all on public.choice_marks from anon, authenticated;

/** A lasting effect in force now: 'ban' (at p_place), 'gig_lock' or 'holding'. */
create or replace function public.choice_marked(p_player uuid, p_kind text, p_place text default null) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.choice_marks
                  where player_id = p_player and kind = p_kind and until > now() and (p_place is null or place = p_place))
$$;

/** 0131's choice_apply, plus the lasting effects (the server turns a ban's "here" into the card's place first). */
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
    v_int := least(100, greatest(0, now_int + v_int)) - now_int;
    update public.reputation set integrity = integrity + v_int, updated_at = now() where player_id = p_player;
    if v_int <> 0 then out := out || jsonb_build_object('integrity', v_int); end if;
  end if;
  -- Lasting effects. The holding cell puts the player at the precinct first, so the at_place guard lets it through.
  if p_effects ? 'ban' and (p_effects -> 'ban' ->> 'place') <> 'here' then
    insert into public.choice_marks (player_id, kind, place, until)
    values (p_player, 'ban', p_effects -> 'ban' ->> 'place', now() + make_interval(days => (p_effects -> 'ban' ->> 'days')::int));
    out := out || jsonb_build_object('ban', p_effects -> 'ban');
  end if;
  if p_effects ? 'gigLock' then
    insert into public.choice_marks (player_id, kind, until) values (p_player, 'gig_lock', now() + make_interval(days => (p_effects ->> 'gigLock')::int));
    out := out || jsonb_build_object('gigLock', (p_effects ->> 'gigLock')::int);
  end if;
  if p_effects ? 'holding' then
    update public.players set at_place = 'precinct-114-half', arrives_at = now() where id = p_player;
    insert into public.choice_marks (player_id, kind, place, until)
    values (p_player, 'holding', 'precinct-114-half', now() + make_interval(hours => (p_effects ->> 'holding')::int));
    out := out || jsonb_build_object('holding', (p_effects ->> 'holding')::int);
  end if;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- The guards: banned places, the holding cell, the locked gig board
-- ---------------------------------------------------------------------------
create or replace function public.choice_guard_move() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.at_place is null or new.at_place is not distinct from old.at_place then return new; end if;
  if new.at_place <> 'precinct-114-half' and public.choice_marked(new.id, 'holding') then
    raise exception 'in_holding' using errcode = '22023';
  end if;
  if public.choice_marked(new.id, 'ban', new.at_place) then raise exception 'banned_here' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists players_choice_guard on public.players;
create trigger players_choice_guard before update of at_place on public.players
  for each row execute function public.choice_guard_move();

create or replace function public.choice_guard_visit() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.place_id <> 'precinct-114-half' and public.choice_marked(new.player_id, 'holding') then
    raise exception 'in_holding' using errcode = '22023';
  end if;
  if public.choice_marked(new.player_id, 'ban', new.place_id) then raise exception 'banned_here' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists place_visits_choice_guard on public.place_visits;
create trigger place_visits_choice_guard before insert or update on public.place_visits
  for each row execute function public.choice_guard_visit();

create or replace function public.choice_guard_gig() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null
     and (public.choice_marked(new.player_id, 'gig_lock') or public.choice_marked(new.player_id, 'holding')) then
    raise exception 'gigs_locked' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists gig_offers_choice_guard on public.gig_offers;
create trigger gig_offers_choice_guard before update of accepted_at on public.gig_offers
  for each row execute function public.choice_guard_gig();

/** Bail out of holding: C$150 for every hour left (rounded up), paid once. Returns what it cost. */
create or replace function public.choice_bail(p_player uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  m public.choice_marks;
  cost int;
begin
  select * into m from public.choice_marks where player_id = p_player and kind = 'holding' and until > now() order by until desc limit 1 for update;
  if m.id is null then raise exception 'not_held' using errcode = '22023'; end if;
  cost := 150 * ceil(extract(epoch from (m.until - now())) / 3600)::int;
  if (select bank_cash from public.players where id = p_player) < cost then raise exception 'cant_afford' using errcode = '22023'; end if;
  if public.ledger_once(p_player, 'cash', -cost, 'bail', m.id::text) then
    update public.players set bank_cash = bank_cash - cost where id = p_player;
  end if;
  update public.choice_marks set until = now() where id = m.id;
  return cost;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chains and headlines
-- ---------------------------------------------------------------------------
alter table public.choice_later add column if not exists card text;
alter table public.choice_later add column if not exists headline text;

create table if not exists public.choice_headlines (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists choice_headlines_at_idx on public.choice_headlines (created_at desc);
alter table public.choice_headlines enable row level security;
revoke all on public.choice_headlines from anon, authenticated;

/** 0131's settle, keeping a later's chain card and headline. */
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
    if due is null or due <= today or due > today + 14 or not public.choice_effects_ok(p_later -> 'effects')
       or coalesce(p_later ->> 'card', 'x') !~ '^[a-z0-9-]{1,80}$' then
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
    insert into public.choice_later (player_id, log_id, due, emoji, text, effects, card, headline)
    values (p_player, p_log, due, left(coalesce(p_later ->> 'emoji', '↩️'), 8), left(p_later ->> 'text', 300),
            coalesce(p_later -> 'effects', '{}'::jsonb), p_later ->> 'card', left(p_later ->> 'headline', 220));
  end if;
  return jsonb_build_object('integrity', (select integrity from public.reputation where player_id = p_player),
                            'first', coalesce(first, false), 'applied', applied);
end;
$$;

/** A headline for the Blotter, unless the player keeps out of News mentions. */
create or replace function public.choice_headline(p_player uuid, p_text text) returns void
language plpgsql security definer set search_path = public
as $$
declare me public.players;
begin
  if p_text is null then return; end if;
  select * into me from public.players where id = p_player;
  if me.id is null or coalesce(me.news_opt_out, false) then return; end if;
  insert into public.choice_headlines (player_id, text) values (p_player, left(replace(p_text, '{name}', '@' || me.display_name), 260));
end;
$$;

/** Consequences due by today land (paid once each, their headline posted); chain cards wait for choice_chain_open. */
create or replace function public.choice_land(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d public.choice_later;
begin
  for d in select * from public.choice_later where player_id = p_player and landed_at is null and card is null and due <= public.ny_today()
           order by due, id for update loop
    update public.choice_later set landed_at = now(), applied = public.choice_apply(p_player, d.effects, 'choice_later', d.id::text) where id = d.id;
    perform public.choice_headline(p_player, d.headline);
  end loop;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'log', x.log_id, 'card', l.card, 'option', l.option, 'emoji', x.emoji,
                                                       'text', x.text, 'effects', x.applied, 'day', (x.landed_at at time zone 'America/New_York')::date)
                                    order by x.landed_at)
                     from public.choice_later x join public.choice_log l on l.id = x.log_id
                    where x.player_id = p_player and x.landed_at is not null and x.seen_at is null and x.card is null), '[]'::jsonb);
end;
$$;

/**
 * A chain's follow-up card opens on its day, past the daily limit (still one waiting at a time). Its later's own effects
 * apply as it opens and its headline posts. Returns the new log id, or null when nothing is due.
 */
create or replace function public.choice_chain_open(p_player uuid, p_base text, p_area text, p_place text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d public.choice_later;
  v bigint;
begin
  if exists (select 1 from public.choice_log where player_id = p_player and status = 'open' and day = public.ny_today()) then return null; end if;
  select * into d from public.choice_later where player_id = p_player and landed_at is null and card is not null and due <= public.ny_today()
   order by due, id limit 1 for update;
  if d.id is null then return null; end if;
  update public.choice_log set status = 'expired' where player_id = p_player and status = 'open';
  update public.choice_later set landed_at = now(), seen_at = now(), applied = public.choice_apply(p_player, d.effects, 'choice_later', d.id::text)
   where id = d.id;
  perform public.choice_headline(p_player, d.headline);
  insert into public.choice_log (player_id, card, base, area, place, day)
  values (p_player, d.card, coalesce(p_base, d.card), left(coalesce(p_area, 'life'), 20), p_place, public.ny_today())
  returning id into v;
  return jsonb_build_object('log', v, 'card', d.card, 'text', d.text, 'emoji', d.emoji);
end;
$$;

/** What the server needs on top of 0131's context: the chain card due, if any, and the lasting effects in force. */
create or replace function public.choice_status(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'chainDue', (select card from public.choice_later where player_id = p_player and landed_at is null and card is not null
                   and due <= public.ny_today() order by due, id limit 1),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'place', place, 'until', until) order by until)
                         from public.choice_marks where player_id = p_player and until > now()), '[]'::jsonb))
$$;

/** Lola's Blotter: the last week's headlines (players who opted out of News mentions since are left out). */
create or replace function public.choice_blotter() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'text', h.text, 'at', h.created_at) order by h.created_at desc), '[]'::jsonb)
    from (select h.* from public.choice_headlines h join public.players p on p.id = h.player_id
           where h.created_at > now() - interval '7 days' and not coalesce(p.news_opt_out, false)
           order by h.created_at desc limit 12) h
$$;

-- Start over is a new life: lasting effects end too.
create or replace function public.choice_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.choice_log where player_id = new.player_id;
  delete from public.choice_marks where player_id = new.player_id;
  delete from public.reputation where player_id = new.player_id;
  return new;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['choice_marked(uuid, text, text)', 'choice_apply(uuid, jsonb, text, text)', 'choice_guard_move()',
                           'choice_guard_visit()', 'choice_guard_gig()', 'choice_bail(uuid)', 'choice_settle(uuid, bigint, text, integer, text, jsonb, jsonb)',
                           'choice_headline(uuid, text)', 'choice_land(uuid)', 'choice_chain_open(uuid, text, text, text)', 'choice_status(uuid)',
                           'choice_restart()', 'choice_effects_ok(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke all on function public.choice_blotter() from public, anon;
grant execute on function public.choice_blotter() to authenticated;
