-- Relationships, phase 1 (owner, Oct 26: the recommendations from the "Official" sketch): a match can become a couple.
--
--   * Going official: after 3 completed date nights together (`couplesDates`), either of a matched pair asks
--     (couple_ask) and the other says yes (couple_answer). Both accounts at least 7 days old, one partner each, never
--     with someone blocked, and not again with the same person for 14 days after a breakup. Dating ends every other
--     crush of both players (quietly, nobody is told) and no new crush can be made while dating.
--   * Couple streak: each New York day the pair does something together (a completed date night, a together bonus,
--     or 5 messages each way) counts; one missed day in any 7 is forgiven. Days 3, 7, 14 and 30 pay clout once
--     (ledger 'couple_streak'); 7, 14 and 30 give a badge.
--   * Partners' date nights pay more (dateMood 15, dateClout 35 instead of dating's 10 and 25).
--   * Gifts: a gift box from the deli (players.gifts, migration 0096) goes to the partner: +Mood for them, a little clout
--     for the sender, once a day (ledger 'couple_gift').
--   * Anniversaries: every week and every month together pays a little clout once (ledger 'couple_anniv').
--   * Breaking up: either partner, any time, no penalty; the other sees a gentle card once. Blocking ends it at once.
--   * Showing it: "💞 Dating @name" on each player's card unless that player hides it (couple_show).
-- Living together, Lola's column mentions and couple Shop items come later.

insert into public.game_settings (key, value) values ('couples', '{"datesToOfficial":3,"minAccountDays":7,"cooloffDays":14,"askDays":7,"dateMood":15,"dateClout":35,"streakMessages":5,"streakRewards":[{"day":3,"clout":30},{"day":7,"clout":75,"badge":"couple-7"},{"day":14,"clout":150,"badge":"couple-14"},{"day":30,"clout":300,"badge":"couple-30"}],"giftMood":10,"giftClout":10,"weekClout":15,"monthClout":50}'::jsonb)
on conflict (key) do update set value = excluded.value;

create table if not exists public.relationships (
  id           bigint generated always as identity primary key,
  a            uuid not null references public.players (id) on delete cascade,
  b            uuid not null references public.players (id) on delete cascade,
  started_at   timestamptz not null default now(),
  start_day    date not null,
  ended_at     timestamptz,
  ended_by     uuid,
  -- 'breakup' (one of them ended it) or 'blocked'
  end_reason   text check (end_reason in ('breakup', 'blocked')),
  a_hidden     boolean not null default false,
  b_hidden     boolean not null default false,
  -- When each side saw the "it's over" card.
  a_end_seen   timestamptz,
  b_end_seen   timestamptz,
  check (a < b)
);
create index if not exists relationships_a_idx on public.relationships (a, ended_at);
create index if not exists relationships_b_idx on public.relationships (b, ended_at);
-- One partner at a time: a player appears in at most one live relationship.
create table if not exists public.couple_members (
  player_id uuid primary key references public.players (id) on delete cascade,
  rel_id    bigint not null references public.relationships (id) on delete cascade
);
create table if not exists public.couple_asks (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.players (id) on delete cascade,
  to_id      uuid not null references public.players (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (from_id <> to_id)
);
create unique index if not exists couple_asks_pending_pair on public.couple_asks (least(from_id, to_id), greatest(from_id, to_id))
  where status = 'pending';
-- Days the couple did something together (filled as they're found, so the streak doesn't recount old days).
create table if not exists public.couple_days (
  rel_id  bigint not null references public.relationships (id) on delete cascade,
  ny_date date not null,
  primary key (rel_id, ny_date)
);
create table if not exists public.couple_gifts (
  id         bigint generated always as identity primary key,
  rel_id     bigint not null references public.relationships (id) on delete cascade,
  from_id    uuid not null references public.players (id) on delete cascade,
  to_id      uuid not null references public.players (id) on delete cascade,
  ny_date    date not null,
  seen_at    timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists couple_gifts_daily on public.couple_gifts (from_id, ny_date);

alter table public.relationships enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_asks enable row level security;
alter table public.couple_days enable row level security;
alter table public.couple_gifts enable row level security;
revoke all on public.relationships, public.couple_members, public.couple_asks, public.couple_days, public.couple_gifts
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** The live relationship a player is in (null when single). */
create or replace function public.couple_rel(p_player uuid) returns public.relationships
language sql stable security definer set search_path = public
as $$ select r.* from public.couple_members m join public.relationships r on r.id = m.rel_id where m.player_id = p_player $$;

create or replace function public.couple_partner(p_player uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select case when r.a = p_player then r.b else r.a end from public.couple_members m join public.relationships r on r.id = m.rel_id
       where m.player_id = p_player $$;

/** Completed date nights (both went, bonus paid) between two players, ever. */
create or replace function public.couple_dates_done(p_a uuid, p_b uuid) returns int
language sql stable security definer set search_path = public
as $$ select count(*)::int from public.date_nights
       where paid_at is not null and ((host = p_a and guest = p_b) or (host = p_b and guest = p_a)) $$;

/** Did the couple do something together on this New York day? */
create or replace function public.couple_day_done(p_rel bigint, p_day date) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  r public.relationships;
  need int := coalesce((public.game_settings_value('couples') ->> 'streakMessages')::int, 5);
  conv bigint;
begin
  if exists (select 1 from public.couple_days where rel_id = p_rel and ny_date = p_day) then return true; end if;
  select * into r from public.relationships where id = p_rel;
  if r.id is null then return false; end if;
  select id into conv from public.conversations where a = r.a and b = r.b;
  if exists (select 1 from public.date_nights where ny_date = p_day and paid_at is not null
              and ((host = r.a and guest = r.b) or (host = r.b and guest = r.a)))
     or exists (select 1 from public.together_invites t join public.together_bonuses x on x.invite_id = t.id
                 where t.ny_date = p_day and ((t.from_id = r.a and t.to_id = r.b) or (t.from_id = r.b and t.to_id = r.a)))
     or (conv is not null
         and (select count(*) from public.messages where conversation_id = conv and ny_date = p_day and sender = r.a) >= need
         and (select count(*) from public.messages where conversation_id = conv and ny_date = p_day and sender = r.b) >= need)
  then
    -- Only days that are over, or today, are stored; today stays true once true.
    insert into public.couple_days (rel_id, ny_date) values (p_rel, p_day) on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;

/**
 * The couple streak: days in a row doing something together, counted back from today (or yesterday when today
 * isn't done yet). One missed day in any 7 is forgiven; never before the relationship began.
 */
create or replace function public.couple_streak(p_rel bigint) returns int
language plpgsql security definer set search_path = public
as $$
declare
  r public.relationships;
  d date := public.ny_today();
  n int := 0;
  last_miss date;
begin
  select * into r from public.relationships where id = p_rel;
  if r.id is null then return 0; end if;
  if not public.couple_day_done(p_rel, d) then d := d - 1; end if;
  while d >= r.start_day loop
    if public.couple_day_done(p_rel, d) then
      n := n + 1;
    elsif last_miss is null or last_miss - d >= 7 then
      -- Forgiven, but a forgiven day doesn't add to the streak; two misses inside a week end it.
      if n = 0 then exit; end if;
      last_miss := d;
    else
      exit;
    end if;
    d := d - 1;
  end loop;
  return n;
end;
$$;

/** Ends a live relationship (breakup or block). */
create or replace function public.couple_close(p_rel bigint, p_by uuid, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.relationships set ended_at = now(), ended_by = p_by, end_reason = p_reason,
         a_end_seen = case when a = p_by then now() else a_end_seen end,
         b_end_seen = case when b = p_by then now() else b_end_seen end
   where id = p_rel and ended_at is null;
  delete from public.couple_members where rel_id = p_rel;
end;
$$;

-- ---------------------------------------------------------------------------
-- Going official
-- ---------------------------------------------------------------------------
/** Why this player can't ask the other yet (null when they can). */
create or replace function public.couple_block_reason(p_me uuid, p_other uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('couples');
begin
  if public.is_blocked_pair(p_me, p_other) then return 'blocked'; end if;
  if not public.is_matched(p_me, p_other) then return 'not_matched'; end if;
  if public.couple_partner(p_me) is not null then return 'already_dating'; end if;
  if public.couple_partner(p_other) is not null then return 'they_are_dating'; end if;
  if public.couple_dates_done(p_me, p_other) < (cfg ->> 'datesToOfficial')::int then return 'more_dates'; end if;
  if exists (select 1 from public.players where id in (p_me, p_other)
              and created_at > now() - make_interval(days => (cfg ->> 'minAccountDays')::int)) then return 'too_new'; end if;
  if exists (select 1 from public.relationships where a = least(p_me, p_other) and b = greatest(p_me, p_other)
              and ended_at > now() - make_interval(days => (cfg ->> 'cooloffDays')::int)) then return 'cooling_off'; end if;
  return null;
end;
$$;

create or replace function public.couple_ask(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  why text;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  perform 1 from public.players where id = uid for update;
  why := public.couple_block_reason(uid, p_player);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  -- An old ask past its days lapses.
  update public.couple_asks set status = 'expired'
   where status = 'pending' and least(from_id, to_id) = least(uid, p_player) and greatest(from_id, to_id) = greatest(uid, p_player)
     and created_at < now() - make_interval(days => (public.game_settings_value('couples') ->> 'askDays')::int);
  begin
    insert into public.couple_asks (from_id, to_id) values (uid, p_player);
  exception when unique_violation then
    raise exception 'ask_exists' using errcode = '22023';
  end;
  return public.couple_state();
end;
$$;

create or replace function public.couple_answer(p_ask bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  k public.couple_asks;
  why text;
  rid bigint;
begin
  select * into k from public.couple_asks where id = p_ask and to_id = uid for update;
  if k.id is null then raise exception 'unknown_ask' using errcode = '22023'; end if;
  if k.status <> 'pending' then raise exception 'ask_answered' using errcode = '22023'; end if;
  if k.created_at < now() - make_interval(days => (public.game_settings_value('couples') ->> 'askDays')::int) then
    update public.couple_asks set status = 'expired' where id = k.id;
    raise exception 'ask_expired' using errcode = '22023';
  end if;
  if not p_yes then
    update public.couple_asks set status = 'declined', answered_at = now() where id = k.id;
    return public.couple_state();
  end if;
  -- Lock both players in a fixed order so two answers can't race.
  perform 1 from public.players where id in (k.from_id, k.to_id) order by id for update;
  why := public.couple_block_reason(uid, k.from_id);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  insert into public.relationships (a, b, start_day) values (least(uid, k.from_id), greatest(uid, k.from_id), public.ny_today())
  returning id into rid;
  insert into public.couple_members (player_id, rel_id) values (uid, rid), (k.from_id, rid);
  update public.couple_asks set status = 'accepted', answered_at = now() where id = k.id;
  -- Any other asks either of them had out or in are void now.
  update public.couple_asks set status = 'cancelled', answered_at = now()
   where status = 'pending' and id <> k.id and (from_id in (uid, k.from_id) or to_id in (uid, k.from_id));
  -- Dating ends every other crush of both, quietly.
  delete from public.crushes where (player_id = uid and target_id <> k.from_id) or (player_id = k.from_id and target_id <> uid);
  delete from public.crush_matches m
   where (m.a in (uid, k.from_id) or m.b in (uid, k.from_id))
     and not (m.a = least(uid, k.from_id) and m.b = greatest(uid, k.from_id));
  return public.couple_state();
end;
$$;

create or replace function public.couple_end() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.relationships;
begin
  r := public.couple_rel(auth.uid());
  if r.id is null then raise exception 'not_dating' using errcode = '22023'; end if;
  perform public.couple_close(r.id, auth.uid(), 'breakup');
  return public.couple_state();
end;
$$;

/** Show or hide "💞 Dating" on my own player card. */
create or replace function public.couple_show(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.relationships;
begin
  r := public.couple_rel(auth.uid());
  if r.id is null then raise exception 'not_dating' using errcode = '22023'; end if;
  update public.relationships
     set a_hidden = case when a = auth.uid() then not p_on else a_hidden end,
         b_hidden = case when b = auth.uid() then not p_on else b_hidden end
   where id = r.id;
  return public.couple_state();
end;
$$;

/** A gift box from my pocket to my partner: their Mood, a little of my clout; once a New York day. */
create or replace function public.couple_gift() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.relationships;
  other uuid;
  cfg jsonb := public.game_settings_value('couples');
  today date := public.ny_today();
  gid bigint;
begin
  r := public.couple_rel(uid);
  if r.id is null then raise exception 'not_dating' using errcode = '22023'; end if;
  other := case when r.a = uid then r.b else r.a end;
  perform 1 from public.players where id = uid for update;
  if coalesce((select gifts from public.players where id = uid), 0) < 1 then raise exception 'no_gift_box' using errcode = '22023'; end if;
  begin
    insert into public.couple_gifts (rel_id, from_id, to_id, ny_date) values (r.id, uid, other, today) returning id into gid;
  exception when unique_violation then
    raise exception 'gift_today' using errcode = '22023';
  end;
  update public.players set gifts = gifts - 1 where id = uid;
  update public.players set mood = least(100, mood + (cfg ->> 'giftMood')::int) where id = other;
  if public.ledger_once(uid, 'clout', (cfg ->> 'giftClout')::int, 'couple_gift', today::text) then
    update public.players set clout = clout + (cfg ->> 'giftClout')::int where id = uid;
  end if;
  return public.couple_state();
end;
$$;

/**
 * Everything the couple screens show, in one call, and it pays what's due (like goals_state): streak milestones
 * (ledger 'couple_streak', ref rel:day), this week's and this month's anniversary (ledger 'couple_anniv').
 */
create or replace function public.couple_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('couples');
  r public.relationships;
  other uuid;
  today date := public.ny_today();
  streak int := 0;
  m jsonb;
  weeks int;
  months int;
  paid jsonb := '[]'::jsonb;
  ended public.relationships;
begin
  if uid is null then return null; end if;
  r := public.couple_rel(uid);
  if r.id is not null then
    other := case when r.a = uid then r.b else r.a end;
    streak := public.couple_streak(r.id);
    for m in select x from jsonb_array_elements(cfg -> 'streakRewards') x loop
      if streak >= (m ->> 'day')::int then
        if public.ledger_once(uid, 'clout', (m ->> 'clout')::int, 'couple_streak', r.id || ':' || (m ->> 'day')) then
          update public.players set clout = clout + (m ->> 'clout')::int where id = uid;
          paid := paid || jsonb_build_object('kind', 'streak', 'day', (m ->> 'day')::int, 'clout', (m ->> 'clout')::int);
          if m ? 'badge' then
            insert into public.player_badges (player_id, badge_id, arc_id) values (uid, m ->> 'badge', 'couple') on conflict do nothing;
          end if;
        end if;
      end if;
    end loop;
    weeks := (today - r.start_day) / 7;
    months := (extract(year from age(today, r.start_day)) * 12 + extract(month from age(today, r.start_day)))::int;
    if weeks >= 1 and public.ledger_once(uid, 'clout', (cfg ->> 'weekClout')::int, 'couple_anniv', r.id || ':w' || weeks) then
      update public.players set clout = clout + (cfg ->> 'weekClout')::int where id = uid;
      paid := paid || jsonb_build_object('kind', 'week', 'n', weeks, 'clout', (cfg ->> 'weekClout')::int);
    end if;
    if months >= 1 and public.ledger_once(uid, 'clout', (cfg ->> 'monthClout')::int, 'couple_anniv', r.id || ':m' || months) then
      update public.players set clout = clout + (cfg ->> 'monthClout')::int where id = uid;
      paid := paid || jsonb_build_object('kind', 'month', 'n', months, 'clout', (cfg ->> 'monthClout')::int);
    end if;
  else
    -- The gentle card after a breakup the other one made (or a block), once.
    select * into ended from public.relationships
     where uid in (a, b) and ended_at is not null and ended_by is distinct from uid
       and (case when a = uid then a_end_seen else b_end_seen end) is null
     order by ended_at desc limit 1;
  end if;

  return jsonb_build_object(
    'partner', case when r.id is null then null else (
      select jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style, 'look', p.look) from public.players p where p.id = other) end,
    'relId', r.id,
    'since', r.start_day,
    'days', case when r.id is null then null else today - r.start_day end,
    'streak', streak,
    'todayDone', case when r.id is null then false else public.couple_day_done(r.id, today) end,
    'nextReward', (select x from jsonb_array_elements(cfg -> 'streakRewards') x where (x ->> 'day')::int > streak
                    order by (x ->> 'day')::int limit 1),
    'shown', case when r.id is null then null else not (case when r.a = uid then r.a_hidden else r.b_hidden end) end,
    'gifts', jsonb_build_object(
      'boxes', (select gifts from public.players where id = uid),
      'sentToday', exists (select 1 from public.couple_gifts where from_id = uid and ny_date = today),
      'received', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'from', p.display_name, 'day', g.ny_date) order by g.id desc), '[]')
                     from public.couple_gifts g join public.players p on p.id = g.from_id
                    where g.to_id = uid and g.seen_at is null)),
    'paid', paid,
    'ended', case when ended.id is null then null else jsonb_build_object(
      'id', ended.id, 'reason', ended.end_reason,
      'name', (select display_name from public.players where id = case when ended.a = uid then ended.b else ended.a end)) end,
    -- Matches and how close each is to "Make it official?" (single players only).
    'matches', case when r.id is not null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.display_name, 'style', o.starting_style,
                                                   'dates', public.couple_dates_done(uid, o.id),
                                                   'blockedBy', public.couple_block_reason(uid, o.id)) order by o.display_name), '[]')
        from public.crush_matches cm join public.players o on o.id = case when cm.a = uid then cm.b else cm.a end
       where uid in (cm.a, cm.b) and o.banned_at is null) end,
    'asks', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'mine', k.from_id = uid,
                                                          'with', jsonb_build_object('id', o.id, 'name', o.display_name, 'style', o.starting_style))
                                       order by k.created_at desc), '[]')
               from public.couple_asks k join public.players o on o.id = case when k.from_id = uid then k.to_id else k.from_id end
              where uid in (k.from_id, k.to_id) and k.status = 'pending'
                and k.created_at > now() - make_interval(days => (cfg ->> 'askDays')::int)),
    'rules', jsonb_build_object('datesToOfficial', (cfg ->> 'datesToOfficial')::int, 'streakMessages', (cfg ->> 'streakMessages')::int,
                                'giftMood', (cfg ->> 'giftMood')::int, 'giftClout', (cfg ->> 'giftClout')::int));
end;
$$;

/** Cards seen: received gifts and the breakup card. */
create or replace function public.couple_seen() returns void
language sql security definer set search_path = public
as $$
  update public.couple_gifts set seen_at = now() where to_id = auth.uid() and seen_at is null;
  update public.relationships
     set a_end_seen = case when a = auth.uid() then coalesce(a_end_seen, now()) else a_end_seen end,
         b_end_seen = case when b = auth.uid() then coalesce(b_end_seen, now()) else b_end_seen end
   where auth.uid() in (a, b) and ended_at is not null;
$$;

-- ---------------------------------------------------------------------------
-- Changes to dating (migration 0011)
-- ---------------------------------------------------------------------------
-- No new crushes while dating (taking one back is always allowed).
create or replace function public.crush_toggle(p_player uuid, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if p_on then
    if not exists (select 1 from public.players where id = p_player and banned_at is null) then raise exception 'unknown_player' using errcode = '22023'; end if;
    if public.is_blocked_pair(uid, p_player) then raise exception 'blocked' using errcode = '42501'; end if;
    if not public.is_connected(uid, p_player) then raise exception 'not_connected' using errcode = '22023'; end if;
    if public.couple_partner(uid) is not null and public.couple_partner(uid) <> p_player then
      raise exception 'in_relationship' using errcode = '22023';
    end if;
    perform 1 from public.players where id = uid for update;
    if not exists (select 1 from public.crushes where player_id = uid and target_id = p_player) then
      select count(*) into n from public.crushes where player_id = uid;
      if n >= (public.game_settings_value('dating') ->> 'maxCrushes')::int then raise exception 'crush_limit' using errcode = '22023'; end if;
      insert into public.crushes (player_id, target_id) values (uid, p_player);
    end if;
    if public.is_matched(uid, p_player) then
      insert into public.crush_matches (a, b) values (least(uid, p_player), greatest(uid, p_player)) on conflict do nothing;
    end if;
  else
    delete from public.crushes where player_id = uid and target_id = p_player;
    delete from public.crush_matches where a = least(uid, p_player) and b = greatest(uid, p_player);
  end if;
  return public.crush_status(p_player);
end;
$$;

-- Partners' date nights pay the couples bonus instead of the dating one (same ledger kind, once a day).
create or replace function public.date_settle(p_date bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  d public.date_nights;
  cfg jsonb := public.game_settings_value('dating');
  cp jsonb := public.game_settings_value('couples');
  couple boolean;
  v_clout int;
  v_mood int;
  who uuid;
begin
  select * into d from public.date_nights where id = p_date for update;
  if d.id is null or d.status <> 'accepted' or d.host_went_at is null or d.guest_went_at is null or d.paid_at is not null then return; end if;
  couple := cp is not null and public.couple_partner(d.host) = d.guest;
  v_clout := case when couple then (cp ->> 'dateClout')::int else (cfg ->> 'dateClout')::int end;
  v_mood := case when couple then (cp ->> 'dateMood')::int else (cfg ->> 'dateMood')::int end;
  foreach who in array array[d.host, d.guest] loop
    if public.ledger_once(who, 'clout', v_clout, 'date_night', d.ny_date::text) then
      update public.players set clout = clout + v_clout, mood = least(100, mood + v_mood) where id = who;
    end if;
  end loop;
  update public.date_nights set paid_at = clock_timestamp() where id = d.id;
end;
$$;

-- Blocking a partner ends the relationship at once.
create or replace function public.block_couple_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
declare r public.relationships;
begin
  r := public.couple_rel(new.blocker);
  if r.id is not null and new.blocked in (r.a, r.b) then perform public.couple_close(r.id, new.blocker, 'blocked'); end if;
  update public.couple_asks set status = 'cancelled', answered_at = now()
   where status = 'pending' and ((from_id = new.blocker and to_id = new.blocked) or (from_id = new.blocked and to_id = new.blocker));
  return new;
end;
$$;
drop trigger if exists blocks_couple on public.blocks;
create trigger blocks_couple after insert on public.blocks for each row execute function public.block_couple_trigger();

-- The player card shows "💞 Dating @name" unless that player hides it.
create or replace function public.couple_public(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', o.id, 'name', o.display_name, 'since', r.start_day)
    from public.couple_members m join public.relationships r on r.id = m.rel_id
    join public.players o on o.id = case when r.a = p_player then r.b else r.a end
   where m.player_id = p_player and not (case when r.a = p_player then r.a_hidden else r.b_hidden end) and o.banned_at is null
$$;

create or replace function public.player_card(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'style', p.starting_style, 'clout', p.clout, 'homeId', p.home_id,
    'badges', (select count(*) from public.player_badges b where b.player_id = p.id),
    'joined', p.created_at,
    'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = p.id),
    'isMe', p.id = auth.uid(),
    'crush', case when p.id <> auth.uid() then public.crush_status(p.id) end,
    'rank', 1 + (select count(*) from public.players o
                  where o.banned_at is null
                    and (o.clout > p.clout or (o.clout = p.clout and o.created_at < p.created_at))),
    'recent', public.player_recent(p.id, 5),
    'netWorth', public.net_worth(p.id),
    'bestRank', p.best_rank,
    'jobs', public.job_rating(p.id),
    'vipSince', public.vip_since(p.id),
    'herePlace', (select p.at_place from public.players me where me.id = auth.uid() and me.at_place is not null and me.at_place = p.at_place
                    and p.seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)),
    'canMessage', p.id <> auth.uid() and public.may_reach(auth.uid(), p.id),
    'crew', p.id in (select id from public.crew_of(auth.uid())),
    'partner', public.couple_public(p.id))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Pushes (migration 0078's queue): an ask is P0 social, a gift too.
-- ---------------------------------------------------------------------------
create or replace function public.push_on_couple_ask() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(new.to_id, 'couple_ask', 'couple_ask:' || new.id, '💞 ' || public.push_name(new.from_id) || ' wants to make it official',
    'Three dates in and they''re asking. Answer before you overthink it.', '/home?open=us', null, true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_couple_ask on public.couple_asks;
create trigger push_couple_ask after insert on public.couple_asks for each row execute function public.push_on_couple_ask();

create or replace function public.push_on_couple_gift() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(new.to_id, 'couple_gift', 'couple_gift:' || new.id, '🎁 ' || public.push_name(new.from_id) || ' sent you a gift',
    'A gift box, just because. Go say thank you.', '/home?open=us', null, true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_couple_gift on public.couple_gifts;
create trigger push_couple_gift after insert on public.couple_gifts for each row execute function public.push_on_couple_gift();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.couple_ask(uuid)', 'public.couple_answer(bigint, boolean)', 'public.couple_end()', 'public.couple_show(boolean)',
    'public.couple_gift()', 'public.couple_state()', 'public.couple_seen()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.couple_rel(uuid)', 'public.couple_partner(uuid)', 'public.couple_dates_done(uuid, uuid)', 'public.couple_day_done(bigint, date)',
    'public.couple_streak(bigint)', 'public.couple_close(bigint, uuid, text)', 'public.couple_block_reason(uuid, uuid)',
    'public.couple_public(uuid)', 'public.block_couple_trigger()', 'public.push_on_couple_ask()', 'public.push_on_couple_gift()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
