-- 0159: NPC favors and friendships (owner, Nov 3: "Talking to NPCs should bring up the opportunity to take actions to help
-- the NPC"; "go with your recommendation"; lib/npcBonds.ts mirrors game_settings 'npc_bonds').
--   * A favor is a Moral Choices card (content/choices/favors.json, where.after ["talk"]) the server opens when the player talks
--     to its regular at the regular's place (`favor_open`, service role): 2 a New York day, once every 3 days per regular, none
--     while the friendship is burned. Favors sit in choice_log with area 'favor' and don't count toward Moral Choices' own 2 a
--     day or 90-minute gap (choice_context and choice_open, redefined below).
--   * npc_bonds: favors done per regular. Every card with a `who` moves it after choice_settle (`npc_bond_note`, service role):
--     'help' +1; 'exploit' −2, and at Family it burns the friendship for 30 days (favors back to 0).
--   * Levels: Friendly 2, Friend 5, Family 10. Friend: "on the house" once a New York week at their place (`npc_perk`: Energy +10,
--     Mood +8). Family: a big favor once every 30 days (`npc_big_favor`): C$300 (ledger cash 'npc_favor'), or for Sgt. Bev, out of
--     holding now. `npc_bonds_state()` is the player's list.
-- Safe to run more than once.

insert into public.game_settings (key, value) values
  ('npc_bonds', '{"levels":{"friendly":2,"friend":5,"family":10},"favorsPerDay":2,"askEveryDays":3,"exploitCost":2,"burnDays":30,"perk":{"energy":10,"mood":8},"bigEveryDays":30,"big":{"cash":300,"holding":["sgt-bev"]}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.npc_bonds (
  player_id    uuid not null references public.players (id) on delete cascade,
  npc          text not null check (npc ~ '^[a-z0-9-]{1,40}$'),
  favors       int not null default 0,
  burned_until date,
  last_ask     date,
  perk_week    date,
  big_on       date,
  updated_at   timestamptz not null default now(),
  primary key (player_id, npc)
);
alter table public.npc_bonds enable row level security;
revoke all on public.npc_bonds from anon, authenticated;

create or replace function public.npc_bonds_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select coalesce((select value from public.game_settings where key = 'npc_bonds'), '{}'::jsonb) $$;

/** Friend, Friendly… from favors done. */
create or replace function public.npc_level(p_favors int) returns text
language sql stable security definer set search_path = public
as $$
  select case when p_favors >= (s -> 'levels' ->> 'family')::int then 'family'
              when p_favors >= (s -> 'levels' ->> 'friend')::int then 'friend'
              when p_favors >= (s -> 'levels' ->> 'friendly')::int then 'friendly' else 'stranger' end
    from (select public.npc_bonds_settings() s) x
$$;

-- 0131's choice_context, with favors left out of the day's count and the gap (they have their own limits).
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
    'integrity', coalesce(r.integrity, 50),
    'revealed', r.revealed_at is not null,
    'rank', greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)),
    'bank', me.bank_cash,
    'student', exists (select 1 from public.campus_enrolments where player_id = p_player),
    'business', exists (select 1 from public.player_businesses where player_id = p_player),
    'home', me.home_id,
    'shownToday', (select count(*) from public.choice_log where player_id = p_player and day = today and area <> 'favor'),
    'lastShownAt', (select max(shown_at) from public.choice_log where player_id = p_player and area <> 'favor'),
    'favorsToday', (select count(*) from public.choice_log where player_id = p_player and day = today and area = 'favor'),
    'open', case when o.id is null then null else jsonb_build_object('log', o.id, 'card', o.card, 'place', o.place) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', card, 'base', base, 'day', day))
                           from public.choice_log where player_id = p_player and day > today - 31), '[]'::jsonb));
end;
$$;

-- 0131's choice_open, with favors left out of the 2 a day.
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
  if (select count(*) from public.choice_log where player_id = p_player and day = today and area <> 'favor') >= 2 then raise exception 'enough_today' using errcode = '22023'; end if;
  if p_card !~ '^[a-z0-9-]{1,80}$' or p_base !~ '^[a-z0-9-]{1,80}$' then raise exception 'bad_card' using errcode = '22023'; end if;
  insert into public.choice_log (player_id, card, base, area, place, day) values (p_player, p_card, p_base, left(p_area, 20), p_place, today)
  returning id into v;
  return v;
end;
$$;

/** Why this regular won't ask today (null when they can): 'not_here', 'enough_favors', 'asked_lately', 'burned'. */
create or replace function public.favor_block(p_player uuid, p_npc text, p_place text) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  s jsonb := public.npc_bonds_settings();
  b public.npc_bonds;
begin
  if (select at_place from public.players where id = p_player) is distinct from p_place then return 'not_here'; end if;
  select * into b from public.npc_bonds where player_id = p_player and npc = p_npc;
  if b.burned_until is not null and b.burned_until > today then return 'burned'; end if;
  if b.last_ask is not null and b.last_ask > today - coalesce((s ->> 'askEveryDays')::int, 3) then return 'asked_lately'; end if;
  if (select count(*) from public.choice_log where player_id = p_player and day = today and area = 'favor') >= coalesce((s ->> 'favorsPerDay')::int, 2) then return 'enough_favors'; end if;
  return null;
end;
$$;

/** Opens a favor card (area 'favor'); an open Moral Choices card waiting is set aside. Returns its log id. */
create or replace function public.favor_open(p_player uuid, p_card text, p_base text, p_npc text, p_place text) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  v bigint;
  why text;
begin
  if not public.rate_hit(p_player, 'choice', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform 1 from public.players where id = p_player for update;
  if not found then raise exception 'no_player' using errcode = '28000'; end if;
  if p_card !~ '^[a-z0-9-]{1,80}$' or p_base !~ '^[a-z0-9-]{1,80}$' or p_npc !~ '^[a-z0-9-]{1,40}$' then raise exception 'bad_card' using errcode = '22023'; end if;
  why := public.favor_block(p_player, p_npc, p_place);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  update public.choice_log set status = 'expired' where player_id = p_player and status = 'open';
  insert into public.choice_log (player_id, card, base, area, place, day) values (p_player, p_card, p_base, 'favor', p_place, today)
  returning id into v;
  insert into public.npc_bonds (player_id, npc, last_ask) values (p_player, p_npc, today)
  on conflict (player_id, npc) do update set last_ask = today, updated_at = now();
  return v;
end;
$$;

/** A choice with a regular in it moved the friendship: 'help', 'exploit' or 'pass'. Returns the favors now. */
create or replace function public.npc_bond_note(p_player uuid, p_npc text, p_kind text) returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  s jsonb := public.npc_bonds_settings();
  b public.npc_bonds;
begin
  if p_npc !~ '^[a-z0-9-]{1,40}$' or p_kind not in ('help', 'exploit', 'pass') then return null; end if;
  insert into public.npc_bonds (player_id, npc) values (p_player, p_npc) on conflict do nothing;
  select * into b from public.npc_bonds where player_id = p_player and npc = p_npc for update;
  if p_kind = 'help' and (b.burned_until is null or b.burned_until <= today) then
    update public.npc_bonds set favors = favors + 1, updated_at = now() where player_id = p_player and npc = p_npc;
  elsif p_kind = 'exploit' then
    if public.npc_level(b.favors) = 'family' then
      update public.npc_bonds set favors = 0, burned_until = today + coalesce((s ->> 'burnDays')::int, 30), updated_at = now()
       where player_id = p_player and npc = p_npc;
    else
      update public.npc_bonds set favors = greatest(0, favors - coalesce((s ->> 'exploitCost')::int, 2)), updated_at = now()
       where player_id = p_player and npc = p_npc;
    end if;
  end if;
  return (select favors from public.npc_bonds where player_id = p_player and npc = p_npc);
end;
$$;

/** The player's friendships: every regular they've dealt with. */
create or replace function public.npc_bonds_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  s jsonb := public.npc_bonds_settings();
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'npc', b.npc, 'favors', b.favors, 'level', public.npc_level(b.favors),
      'burnedUntil', case when b.burned_until > today then b.burned_until end,
      'perkReady', public.npc_level(b.favors) in ('friend', 'family') and b.perk_week is distinct from date_trunc('week', today)::date
                   and not (b.burned_until > today),
      'bigReady', public.npc_level(b.favors) = 'family' and (b.big_on is null or b.big_on <= today - coalesce((s ->> 'bigEveryDays')::int, 30))
                  and not (b.burned_until > today)) order by b.npc)
    from public.npc_bonds b where b.player_id = uid), '[]'::jsonb);
end;
$$;

/** Friend or Family: "on the house" once a New York week, at the regular's place. */
create or replace function public.npc_perk(p_npc text, p_place text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  s jsonb := public.npc_bonds_settings();
  b public.npc_bonds;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'npc', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if (select at_place from public.players where id = uid) is distinct from p_place then raise exception 'not_here' using errcode = '22023'; end if;
  select * into b from public.npc_bonds where player_id = uid and npc = p_npc for update;
  if b.npc is null or public.npc_level(b.favors) not in ('friend', 'family') or b.burned_until > today then raise exception 'not_friends' using errcode = '22023'; end if;
  if b.perk_week = date_trunc('week', today)::date then raise exception 'done' using errcode = '22023'; end if;
  update public.npc_bonds set perk_week = date_trunc('week', today)::date, updated_at = now() where player_id = uid and npc = p_npc;
  update public.players set energy = least(100, energy + (s -> 'perk' ->> 'energy')::int), mood = least(100, mood + (s -> 'perk' ->> 'mood')::int)
   where id = uid;
  return jsonb_build_object('energy', (s -> 'perk' ->> 'energy')::int, 'mood', (s -> 'perk' ->> 'mood')::int);
end;
$$;

/** Family: the big favor back, once every 30 days: C$300, or (Sgt. Bev) out of holding now. */
create or replace function public.npc_big_favor(p_npc text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  s jsonb := public.npc_bonds_settings();
  b public.npc_bonds;
  v_cash int := coalesce((s -> 'big' ->> 'cash')::int, 300);
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'npc', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into b from public.npc_bonds where player_id = uid and npc = p_npc for update;
  if b.npc is null or public.npc_level(b.favors) <> 'family' or b.burned_until > today then raise exception 'not_family' using errcode = '22023'; end if;
  if b.big_on is not null and b.big_on > today - coalesce((s ->> 'bigEveryDays')::int, 30) then raise exception 'done' using errcode = '22023'; end if;
  if (s -> 'big' -> 'holding') ? p_npc then
    if not exists (select 1 from public.choice_marks where player_id = uid and kind = 'holding' and until > now()) then
      raise exception 'not_needed' using errcode = '22023';
    end if;
    update public.choice_marks set until = now() where player_id = uid and kind = 'holding' and until > now();
    update public.npc_bonds set big_on = today, updated_at = now() where player_id = uid and npc = p_npc;
    return jsonb_build_object('kind', 'holding');
  end if;
  if public.ledger_once(uid, 'cash', v_cash, 'npc_favor', p_npc || ':' || today::text) then
    update public.players set bank_cash = bank_cash + v_cash where id = uid;
  end if;
  update public.npc_bonds set big_on = today, updated_at = now() where player_id = uid and npc = p_npc;
  return jsonb_build_object('kind', 'cash', 'cash', v_cash);
end;
$$;

revoke all on function public.npc_bonds_settings() from public, anon, authenticated;
revoke all on function public.npc_level(int) from public, anon, authenticated;
revoke all on function public.favor_block(uuid, text, text) from public, anon, authenticated;
revoke all on function public.favor_open(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.npc_bond_note(uuid, text, text) from public, anon, authenticated;
revoke all on function public.npc_bonds_state() from public, anon;
revoke all on function public.npc_perk(text, text) from public, anon;
revoke all on function public.npc_big_favor(text) from public, anon;
grant execute on function public.npc_bonds_state() to authenticated;
grant execute on function public.npc_perk(text, text) to authenticated;
grant execute on function public.npc_big_favor(text) to authenticated;
