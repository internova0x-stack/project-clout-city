-- Clout City v0.2 "First Party": the rest of character creation, money, clout,
-- stats, the first-task party, invite rewards (retroactive), the leaderboard and
-- the music preference. Adds to v0.1's tables; nothing is rebuilt.

-- ---------------------------------------------------------------------------
-- Settings: tunable numbers and content, readable by everyone, edited in SQL.
-- Defaults mirror lib/economy.ts (checked by tests/economy.test.ts).
-- ---------------------------------------------------------------------------
create table public.game_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_settings enable row level security;
create policy "settings are public" on public.game_settings for select to anon, authenticated using (true);

insert into public.game_settings (key, value) values
('economy', '{
  "birthLottery": {"min": 6000, "max": 10000, "step": 100},
  "phoneBill": 85,
  "firstParty": {"entry": 150, "cashReward": 300, "cloutReward": 100, "confidence": 15, "energy": 20},
  "invites": {"cloutPerInvite": 50, "cliqueSize": 5, "cliqueBonus": 500},
  "startingStats": {"energy": 100, "mood": 60, "confidence": 40},
  "playersOnlineThreshold": 1,
  "homes": [
    {"id": "astoria_studio", "rent": 2100},
    {"id": "jackson_heights_1br", "rent": 3200},
    {"id": "lic_highrise", "rent": 5900}
  ]
}'::jsonb),
('trait_ids', '["main_character","photogenic","big_brain","unbothered","party_starter","hustler","ride_or_die","mysterious","loud","wellness_era"]'::jsonb);

create function public.economy() returns jsonb
language sql stable security definer set search_path = public
as $$ select value from public.game_settings where key = 'economy' $$;

-- ---------------------------------------------------------------------------
-- Player columns
-- ---------------------------------------------------------------------------
alter table public.players
  add column traits          text[],
  add column birth_cash      integer,
  add column birth_rolled_at timestamptz,
  add column home_id         text,
  add column moved_in_at     timestamptz,
  add column bank_cash       bigint   not null default 0,
  add column clout           bigint   not null default 0,
  add column energy          smallint not null default 100,
  add column mood            smallint not null default 60,
  add column confidence      smallint not null default 40,
  add column tutorial_state  text     not null default 'pending',
  add column first_party_at  timestamptz,
  add column music_muted     boolean  not null default false;

alter table public.players
  add constraint players_onboarding_step check (onboarding_step in
    ('look_done', 'traits_done', 'lottery_done', 'home_done', 'party_done', 'handoff_done')),
  add constraint players_tutorial_state check (tutorial_state in ('pending', 'done', 'skipped')),
  add constraint players_stats_range check (energy between 0 and 100 and mood between 0 and 100 and confidence between 0 and 100),
  add constraint players_traits_count check (traits is null or cardinality(traits) = 2),
  add constraint players_bank_non_negative check (bank_cash >= 0),
  add constraint players_clout_non_negative check (clout >= 0);

create index players_clout_idx on public.players (clout desc, created_at);

-- ---------------------------------------------------------------------------
-- Ledger: every cash and clout change, so refunds (v0.5) can take back exactly
-- what was given. (player, currency, kind, ref) is unique: rewards pay once.
-- ---------------------------------------------------------------------------
create table public.ledger (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  currency   text not null check (currency in ('cash', 'clout')),
  amount     bigint not null,
  kind       text not null,
  ref        text not null default '',
  created_at timestamptz not null default now(),
  unique (player_id, currency, kind, ref)
);

create index ledger_player_idx on public.ledger (player_id, created_at desc);
alter table public.ledger enable row level security;
create policy "players read own ledger" on public.ledger for select to authenticated using (player_id = auth.uid());

-- Records a ledger row once; returns true only the first time.
create function public.ledger_once(p_player uuid, p_currency text, p_amount bigint, p_kind text, p_ref text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare inserted int;
begin
  insert into public.ledger (player_id, currency, amount, kind, ref)
  values (p_player, p_currency, p_amount, p_kind, coalesce(p_ref, ''))
  on conflict (player_id, currency, kind, ref) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;
revoke all on function public.ledger_once(uuid, text, bigint, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Character creation: Traits, Birth lottery, Home
-- ---------------------------------------------------------------------------
create function public.set_traits(p_traits text[])
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  allowed jsonb := (select value from public.game_settings where key = 'trait_ids');
  me public.players;
  t text;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.home_id is not null then raise exception 'creation_finished' using errcode = '22023'; end if;
  if cardinality(p_traits) <> 2 or p_traits[1] = p_traits[2] then raise exception 'pick_two' using errcode = '22023'; end if;
  foreach t in array p_traits loop
    if not allowed ? t then raise exception 'unknown_trait' using errcode = '22023'; end if;
  end loop;

  update public.players
     set traits = p_traits,
         onboarding_step = case when onboarding_step = 'look_done' then 'traits_done' else onboarding_step end
   where id = uid
   returning * into me;
  return me;
end;
$$;

create function public.roll_birth_lottery()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.economy() -> 'birthLottery';
  lo int := (cfg ->> 'min')::int;
  hi int := (cfg ->> 'max')::int;
  step int := (cfg ->> 'step')::int;
  me public.players;
  amount int;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.birth_cash is not null then return me.birth_cash; end if; -- rolled once per account
  if me.traits is null then raise exception 'traits_first' using errcode = '22023'; end if;

  amount := lo + step * floor(random() * ((hi - lo) / step + 1))::int;
  update public.players
     set birth_cash = amount,
         birth_rolled_at = now(),
         bank_cash = bank_cash + amount,
         onboarding_step = case when onboarding_step = 'traits_done' then 'lottery_done' else onboarding_step end
   where id = uid;
  perform public.ledger_once(uid, 'cash', amount, 'birth_lottery', 'birth');
  return amount;
end;
$$;

create function public.move_in(p_home text)
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e jsonb := public.economy();
  home jsonb;
  rent int;
  me public.players;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.home_id is not null then return me; end if;
  if me.birth_cash is null then raise exception 'lottery_first' using errcode = '22023'; end if;

  select h into home from jsonb_array_elements(e -> 'homes') h where h ->> 'id' = p_home;
  if home is null then raise exception 'unknown_home' using errcode = '22023'; end if;
  rent := (home ->> 'rent')::int;
  -- The first rent must still leave the phone bill and the party's entry price.
  if me.bank_cash - rent < (e ->> 'phoneBill')::int + (e -> 'firstParty' ->> 'entry')::int then
    raise exception 'cant_afford' using errcode = '22023';
  end if;

  update public.players
     set bank_cash = bank_cash - rent,
         home_id = p_home,
         moved_in_at = now(),
         energy = (e -> 'startingStats' ->> 'energy')::int,
         mood = (e -> 'startingStats' ->> 'mood')::int,
         confidence = (e -> 'startingStats' ->> 'confidence')::int,
         onboarding_step = 'home_done'
   where id = uid
   returning * into me;
  perform public.ledger_once(uid, 'cash', -rent, 'rent', 'first_rent');
  return me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tutorial, first-task party, hand-off, music
-- ---------------------------------------------------------------------------
create function public.set_tutorial_state(p_state text)
returns void
language sql security definer set search_path = public
as $$
  update public.players set tutorial_state = p_state
   where id = auth.uid() and p_state in ('done', 'skipped');
$$;

-- The first task. Protected: story effects never change or cancel it.
create function public.attend_first_party(p_with_clique boolean)
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p jsonb := public.economy() -> 'firstParty';
  v_entry int := (p ->> 'entry')::int;
  v_cash int := (p ->> 'cashReward')::int;
  v_clout int := (p ->> 'cloutReward')::int;
  me public.players;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.first_party_at is not null then return me; end if;
  if me.home_id is null then raise exception 'move_in_first' using errcode = '22023'; end if;
  if me.bank_cash < v_entry then raise exception 'cant_afford' using errcode = '22023'; end if;

  update public.players
     set bank_cash = bank_cash - v_entry + v_cash,
         clout = clout + v_clout,
         confidence = least(100, confidence + (p ->> 'confidence')::int),
         energy = greatest(0, energy - (p ->> 'energy')::int),
         first_party_at = now(),
         onboarding_step = case when onboarding_step = 'home_done' then 'party_done' else onboarding_step end
   where id = uid
   returning * into me;
  perform public.ledger_once(uid, 'cash', -v_entry, 'party_entry', 'first_party');
  perform public.ledger_once(uid, 'cash', v_cash, 'party_reward', 'first_party');
  perform public.ledger_once(uid, 'clout', v_clout, 'party', 'first_party');
  return me;
end;
$$;

create function public.finish_handoff()
returns void
language sql security definer set search_path = public
as $$
  update public.players set onboarding_step = 'handoff_done'
   where id = auth.uid() and onboarding_step = 'party_done';
$$;

create function public.set_music_muted(p_muted boolean)
returns void
language sql security definer set search_path = public
as $$ update public.players set music_muted = coalesce(p_muted, false) where id = auth.uid(); $$;

-- ---------------------------------------------------------------------------
-- Invite rewards: clout per friend who signs up, and a bonus at a full clique.
-- Paid by a trigger, and once now for everyone invited during v0.1.
-- ---------------------------------------------------------------------------
create function public.pay_invite_rewards(p_inviter uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.economy() -> 'invites';
  per int := (cfg ->> 'cloutPerInvite')::int;
  size int := (cfg ->> 'cliqueSize')::int;
  bonus int := (cfg ->> 'cliqueBonus')::int;
  inv record;
  total int;
begin
  perform 1 from public.players where id = p_inviter for update;
  for inv in select id, invitee_id from public.invites where inviter_id = p_inviter and reward_paid_at is null loop
    if public.ledger_once(p_inviter, 'clout', per, 'invite', inv.invitee_id::text) then
      update public.players set clout = clout + per where id = p_inviter;
    end if;
    update public.invites set reward_paid_at = now() where id = inv.id;
  end loop;

  select count(*) into total from public.invites where inviter_id = p_inviter;
  if total >= size and public.ledger_once(p_inviter, 'clout', bonus, 'clique_bonus', 'clique') then
    update public.players set clout = clout + bonus where id = p_inviter;
  end if;
end;
$$;
revoke all on function public.pay_invite_rewards(uuid) from public, anon, authenticated;

create function public.invites_pay_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$ begin perform public.pay_invite_rewards(new.inviter_id); return new; end; $$;

create trigger invites_pay_rewards after insert on public.invites
  for each row execute function public.invites_pay_trigger();

-- Retroactive payout for invites made during v0.1.
select public.pay_invite_rewards(inviter_id)
  from (select distinct inviter_id from public.invites where reward_paid_at is null) pending;

-- ---------------------------------------------------------------------------
-- Leaderboard (C27): Queens (everyone) or Clique (you and the friends you invited).
-- ---------------------------------------------------------------------------
create function public.leaderboard(p_scope text default 'queens', p_limit int default 50)
returns table (rank bigint, display_name text, starting_style text, clout bigint, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with pool as (
    select p.id, p.display_name, p.starting_style, p.clout, p.created_at
      from public.players p
     where p_scope <> 'clique'
        or p.id = auth.uid()
        or p.id in (select invitee_id from public.invites where inviter_id = auth.uid())
  ), ranked as (
    select rank() over (order by clout desc, created_at asc) as rank, id, display_name, starting_style, clout from pool
  )
  select rank, display_name, starting_style, clout, id = auth.uid()
    from ranked
   order by rank
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create function public.my_rank(p_scope text default 'queens')
returns table (rank bigint, total bigint)
language sql stable security definer set search_path = public
as $$
  with pool as (
    select p.id, p.clout, p.created_at
      from public.players p
     where p_scope <> 'clique'
        or p.id = auth.uid()
        or p.id in (select invitee_id from public.invites where inviter_id = auth.uid())
  ), ranked as (
    select rank() over (order by clout desc, created_at asc) as rank, id from pool
  )
  select (select rank from ranked where id = auth.uid()), (select count(*) from pool);
$$;

-- ---------------------------------------------------------------------------
-- Grants: signed-in players call these; nobody writes tables directly.
-- ---------------------------------------------------------------------------
revoke all on function public.economy() from public;
grant execute on function public.economy() to anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_traits(text[])', 'public.roll_birth_lottery()', 'public.move_in(text)',
    'public.set_tutorial_state(text)', 'public.attend_first_party(boolean)', 'public.finish_handoff()',
    'public.set_music_muted(boolean)', 'public.leaderboard(text, int)', 'public.my_rank(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
