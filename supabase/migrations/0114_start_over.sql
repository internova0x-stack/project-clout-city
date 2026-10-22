-- Start over (owner, Oct 22): the welcome screen lets a returning player continue, or start all over again.
--
-- What starting over keeps (owner's pick, Oct 22): the account and username, everything bought with real money
-- (entitlements and purchases untouched; collector pieces, Clout Couture and its car stay owned, unequipped), the
-- crew, chats, dates and other players' plans, badges, story votes, Mayor letters, reports and any ban.
-- What it resets: cash, clout and rank, the home and its layout, everything bought with C$ (clothes, furniture,
-- houses, cars, rentals), bills, skills, daily tasks, goals and streaks, businesses, campus, hunts, gossip finds,
-- lotto cards, gigs and the creator: the player goes through it again (new look, traits, birth lottery, home) and
-- the first party once more. Lola's tour isn't shown again.
-- Once every 30 days (owner, Oct 22: GAME_CONFIG.restartDays mirrors it), so the birth lottery can't be re-rolled.
-- The old ledger is kept in ledger_archive (with the restart's id), so rewards can pay again in the new run while
-- the history stays for the Studio.

create table if not exists public.player_restarts (
  id             bigint generated always as identity primary key,
  player_id      uuid not null references public.players (id) on delete cascade,
  restarted_at   timestamptz not null default now(),
  clout_before   bigint not null,
  cash_before    bigint not null,
  home_before    text,
  look_chosen_at timestamptz
);
create index if not exists player_restarts_player_idx on public.player_restarts (player_id, restarted_at desc);
alter table public.player_restarts enable row level security;
revoke all on public.player_restarts from anon, authenticated;

create table if not exists public.ledger_archive (
  id          bigint not null,
  player_id   uuid not null,
  currency    text not null,
  amount      bigint not null,
  kind        text not null,
  ref         text,
  created_at  timestamptz not null,
  restart_id  bigint not null references public.player_restarts (id) on delete cascade
);
create index if not exists ledger_archive_player_idx on public.ledger_archive (player_id, created_at desc);
alter table public.ledger_archive enable row level security;
revoke all on public.ledger_archive from anon, authenticated;

/** The welcome screen: whether this player can start over now, and when they can if not. */
create or replace function public.restart_status()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  last_at timestamptz;
  next_at timestamptz;
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then return null; end if;
  select max(restarted_at) into last_at from public.player_restarts where player_id = uid;
  next_at := last_at + interval '30 days';
  return jsonb_build_object('can', next_at is null or next_at <= now(), 'nextAt', next_at, 'lastAt', last_at);
end;
$$;

/** Starts the signed-in player over (see the top of this file). Returns the player row, ready for the creator. */
create or replace function public.restart_player()
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  rid bigint;
  stats jsonb := public.economy() -> 'startingStats';
  keep_car boolean;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'banned' using errcode = '42501'; end if;
  if me.home_id is null then raise exception 'nothing_to_restart' using errcode = '22023'; end if;
  if exists (select 1 from public.player_restarts where player_id = uid and restarted_at > now() - interval '30 days') then
    raise exception 'restart_too_soon' using errcode = '22023';
  end if;

  insert into public.player_restarts (player_id, clout_before, cash_before, home_before)
  values (uid, me.clout, me.bank_cash, coalesce(me.house_sku, me.home_id))
  returning id into rid;

  -- A Clout Couture car is real money: it stays in the garage.
  keep_car := me.car_sku is not null and exists (
    select 1 from public.player_items where player_id = uid and sku = me.car_sku and acquired = 'collector');

  update public.players
     set traits = null, birth_cash = null, birth_rolled_at = null, home_id = null, moved_in_at = null,
         bank_cash = 0, clout = 0,
         energy = coalesce((stats ->> 'energy')::int, 100), mood = coalesce((stats ->> 'mood')::int, 60),
         confidence = coalesce((stats ->> 'confidence')::int, 40),
         tutorial_state = 'done', first_party_at = null, last_tick_date = null,
         next_rent_due = null, next_phone_due = null, mood_penalty_through = null,
         next_car_due = case when keep_car then public.ny_today() + 7 else null end,
         car_sku = case when keep_car then car_sku end, car_mode = case when keep_car then 'owned' end,
         house_sku = null, home_layout = null, at_place = null, at_floor = 1, arrives_at = null,
         fridge_meals = 0, moved_up = false, best_rank = 1,
         transit_pass_until = null, showtime_until = null, gifts = 0,
         onboarding_step = 'look_done'
   where id = uid;

  -- Everything bought with C$ (or earned) goes; real-money pieces stay, taken off.
  delete from public.player_items where player_id = uid and acquired <> 'collector';
  update public.player_items set equipped = false where player_id = uid and equipped;

  delete from public.bills where player_id = uid;
  delete from public.daily_tasks where player_id = uid;
  delete from public.action_uses where player_id = uid;
  delete from public.place_visits where player_id = uid;
  delete from public.player_rest where player_id = uid;
  delete from public.event_attendance where player_id = uid;
  delete from public.gig_offers where player_id = uid;
  delete from public.skill_gig_runs where player_id = uid;
  delete from public.skill_log where player_id = uid;
  delete from public.player_skills where player_id = uid;
  delete from public.player_streak_rewards where player_id = uid;
  delete from public.player_streaks where player_id = uid;
  delete from public.guest_passes where player_id = uid;
  delete from public.style_boosts where player_id = uid;
  delete from public.player_businesses where player_id = uid;
  delete from public.campus_attendance where player_id = uid;
  delete from public.campus_exams where player_id = uid;
  delete from public.campus_schedule where player_id = uid;
  delete from public.campus_enrolments where player_id = uid;
  delete from public.hunt_cards where player_id = uid;
  delete from public.hunt_progress where player_id = uid;
  delete from public.gossip_cards where player_id = uid;
  delete from public.gossip_found where player_id = uid;
  delete from public.gossip_shares where player_id = uid;
  delete from public.lotto_cards where player_id = uid;
  delete from public.story_task_done where player_id = uid;
  delete from public.push_queue where player_id = uid and sent_at is null;

  -- Last, so nothing above writes into the new run's ledger: the old one moves to the archive.
  insert into public.ledger_archive (id, player_id, currency, amount, kind, ref, created_at, restart_id)
  select id, player_id, currency, amount, kind, ref, created_at, rid from public.ledger where player_id = uid;
  delete from public.ledger where player_id = uid;

  select * into me from public.players where id = uid;
  return me;
end;
$$;

/** The creator's first step after starting over: a new style and look (the username stays). */
create or replace function public.restart_look(p_style text, p_look jsonb)
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  rid bigint;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.home_id is not null then raise exception 'creation_finished' using errcode = '22023'; end if;
  select id into rid from public.player_restarts where player_id = uid and look_chosen_at is null
   order by restarted_at desc limit 1;
  if rid is null then raise exception 'no_restart' using errcode = '22023'; end if;

  update public.players set starting_style = p_style, look = coalesce(p_look, '{}'::jsonb), onboarding_step = 'look_done'
   where id = uid returning * into me;
  update public.player_restarts set look_chosen_at = now() where id = rid;
  return me;
end;
$$;

/** True while a player who started over hasn't picked their new look yet (the creator opens on the look step). */
create or replace function public.restart_pending()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.player_restarts r join public.players p on p.id = r.player_id
                  where r.player_id = auth.uid() and r.look_chosen_at is null and p.home_id is null);
$$;

revoke all on function public.restart_status() from public, anon;
revoke all on function public.restart_player() from public, anon;
revoke all on function public.restart_look(text, jsonb) from public, anon;
revoke all on function public.restart_pending() from public, anon;
grant execute on function public.restart_status() to authenticated;
grant execute on function public.restart_player() to authenticated;
grant execute on function public.restart_look(text, jsonb) to authenticated;
grant execute on function public.restart_pending() to authenticated;
