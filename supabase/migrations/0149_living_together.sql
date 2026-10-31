-- Living together (owner, Oct 31: "Living together: couples who are dating move into one home and split the rent. Lola
-- mentions them, and the Shop gets couple items."). The last part of relationships (migration 0118).
--
--   * Moving in: an official couple, official for 7+ days (couples 'moveInDays'), can move in. One partner invites the
--     other to their own home (cohabit_ask); the other says yes (cohabit_answer). The asker is the host. The home must
--     fit two: not a dorm, not the room share with a roommate (an owned house always fits). No live sublet or open
--     listing on either side, no rent due on either side, and the one moving in can't own a house. Asks lapse after
--     7 days ('moveInAskDays').
--   * The mover's own rental ends cleanly: no penalty, no broker fee; their home becomes the host's home, their next
--     rent date lines up with the host's and their own furniture goes to storage (home_layout null: "an item not in the
--     layout is in storage", migration 0044). The Home tab shows them the host's home (cohabit_home, like sublet_home).
--   * Rent: split 50/50 through the bills (bills_cohabit_split): each rent bill issued while together is the player's
--     part: the mover pays floor(rent × rentShare), the host the rest. In an owned house the mover pays nothing.
--   * Perk: "Home together": when both tap it on the same New York day, both get Mood +homeMood and clout +homeClout
--     once (ledger 'cohabit_home', ref <id>:<day>).
--   * Moving out: either partner, any time (cohabit_leave), no penalty. The host keeps the home at full rent; the
--     mover goes back to the cheapest home (the room share, as an eviction would) with an empty layout. A breakup or a
--     block (relationships ending), either of them moving, being evicted or starting over ends it the same way.
--   * Lola's Blotter (choice_headlines, kind 'win', migration 0140): one line when they move in, only when neither
--     partner opted out of News mentions; it's taken down when living together ends.
--   * Couple Shop items (content/shop/couple.json): catalog pieces with extra.couplesOnly; buying one needs a partner
--     ('couples_only', a player_items guard beside the Shop Manager's).
--   * While together: the mover can't host visits (the host hosts: 'partner_hosts'), and neither can list or apply for
--     a sublet ('living_together').
--   * Card: couple_public gains `together` (and `togetherSince`): "🏠 Living with @name" beside "💞 Dating @name".
-- Rate bucket 'cohabit' (30 a minute) on every new call players make.

insert into public.game_settings (key, value) values ('couples', '{"datesToOfficial":3,"minAccountDays":7,"cooloffDays":14,"askDays":7,"dateMood":15,"dateClout":35,"streakMessages":5,"streakRewards":[{"day":3,"clout":30},{"day":7,"clout":75,"badge":"couple-7"},{"day":14,"clout":150,"badge":"couple-14"},{"day":30,"clout":300,"badge":"couple-30"}],"giftMood":10,"giftClout":10,"weekClout":15,"monthClout":50,"moveInDays":7,"moveInAskDays":7,"rentShare":0.5,"homeMood":8,"homeClout":5}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.cohabits (
  id          bigint generated always as identity primary key,
  rel_id      bigint not null references public.relationships (id) on delete cascade,
  host        uuid not null references public.players (id) on delete cascade,
  mover       uuid not null references public.players (id) on delete cascade,
  home_id     text not null,
  -- The home the mover left (for the record; they never go back to it automatically).
  mover_from  text,
  start_day   date not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  ended_by    uuid,
  end_reason  text check (end_reason in ('moved_out', 'breakup', 'blocked', 'moved', 'restart')),
  host_seen   boolean not null default false,
  mover_seen  boolean not null default false,
  headline_id bigint,
  check (host <> mover)
);
create unique index if not exists cohabits_live_host on public.cohabits (host) where ended_at is null;
create unique index if not exists cohabits_live_mover on public.cohabits (mover) where ended_at is null;
create index if not exists cohabits_rel_idx on public.cohabits (rel_id);

create table if not exists public.cohabit_asks (
  id          bigint generated always as identity primary key,
  from_id     uuid not null references public.players (id) on delete cascade,
  to_id       uuid not null references public.players (id) on delete cascade,
  home_id     text not null,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  check (from_id <> to_id)
);
create unique index if not exists cohabit_asks_pending_pair on public.cohabit_asks (least(from_id, to_id), greatest(from_id, to_id))
  where status = 'pending';

create table if not exists public.cohabit_home_days (
  cohabit_id bigint not null references public.cohabits (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  ny_date    date not null,
  primary key (cohabit_id, player_id, ny_date)
);

alter table public.cohabits enable row level security;
alter table public.cohabit_asks enable row level security;
alter table public.cohabit_home_days enable row level security;
revoke all on public.cohabits, public.cohabit_asks, public.cohabit_home_days from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** The home a player shares with their partner, as host or mover (null id when none). */
create or replace function public.cohabit_live(p_player uuid) returns public.cohabits
language sql stable security definer set search_path = public
as $$ select * from public.cohabits where (host = p_player or mover = p_player) and ended_at is null limit 1 $$;

/** A player's part of a rent amount: all of it alone; together, the mover floor(rent × share), the host the rest. */
create or replace function public.cohabit_rent_part(p_player uuid, p_amount int) returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  c public.cohabits := public.cohabit_live(p_player);
  share numeric := coalesce((public.game_settings_value('couples') ->> 'rentShare')::numeric, 0.5);
  mine int;
begin
  if p_amount is null or c.id is null then return p_amount; end if;
  mine := floor(p_amount * share)::int;
  if p_player = c.mover then
    -- An owned house has no rent to split.
    if exists (select 1 from public.players where id = c.host and house_sku is not null) then return 0; end if;
    return mine;
  end if;
  return p_amount - mine;
end;
$$;

/** Why this player can't invite their partner to move in with them right now (null: they can). */
create or replace function public.cohabit_block_reason(p_host uuid, p_mover uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('couples');
  r public.relationships := public.couple_rel(p_host);
  h public.players;
  m public.players;
  home jsonb;
begin
  if r.id is null or p_mover is null or public.couple_partner(p_host) is distinct from p_mover then return 'not_dating'; end if;
  if (public.cohabit_live(p_host)).id is not null or (public.cohabit_live(p_mover)).id is not null then return 'already_together'; end if;
  if public.ny_today() - r.start_day < coalesce((cfg ->> 'moveInDays')::int, 7) then return 'too_soon'; end if;
  select * into h from public.players where id = p_host;
  select * into m from public.players where id = p_mover;
  if h.home_id is null or m.home_id is null then return 'no_player'; end if;
  if m.house_sku is not null then return 'they_own_house'; end if;
  select x into home from jsonb_array_elements(public.economy() -> 'homes') x where x ->> 'id' = h.home_id;
  if h.house_sku is null and (home is null or home ? 'roommate' or home ? 'campus') then return 'home_too_small'; end if;
  if (public.sublet_live(p_host)).id is not null or (public.sublet_live(p_mover)).id is not null then return 'sublet_live'; end if;
  if exists (select 1 from public.sublet_listings where host in (p_host, p_mover) and status = 'open') then return 'sublet_listed'; end if;
  if exists (select 1 from public.bills where player_id in (p_host, p_mover) and kind = 'rent' and status = 'due') then return 'rent_due'; end if;
  return null;
end;
$$;

/**
 * Ends living together. The mover, if they're still in the shared home, goes back to the cheapest home with an empty
 * layout (no fee, no penalty); the host keeps the home. Lola's move-in line comes down. Pushes the other one.
 */
create or replace function public.cohabit_close(p_id bigint, p_by uuid, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare c public.cohabits;
begin
  update public.cohabits set ended_at = now(), ended_by = p_by, end_reason = p_reason,
         host_seen = host_seen or host = p_by, mover_seen = mover_seen or mover = p_by
   where id = p_id and ended_at is null returning * into c;
  if c.id is null then return; end if;
  if c.headline_id is not null then delete from public.choice_headlines where id = c.headline_id; end if;
  update public.players set home_id = public.cheapest_home(), home_layout = null
   where id = c.mover and home_id = c.home_id and house_sku is null;
  perform public.fact_note(c.host, 'couple.moved_out', c.mover::text, jsonb_build_object('reason', p_reason, 'byMe', p_by = c.host, 'role', 'host'));
  perform public.fact_note(c.mover, 'couple.moved_out', c.host::text, jsonb_build_object('reason', p_reason, 'byMe', p_by = c.mover, 'role', 'mover'));
  -- A breakup has its own gentle note (migration 0118); the rest get a push.
  if p_reason not in ('breakup', 'blocked') then
    begin
      perform public.push_enqueue(case when p_by = c.host then c.mover else c.host end, 'cohabit_ended', 'cohabit_ended:' || c.id,
        '🏠 Living together is over',
        case when p_by = c.mover then public.push_name(c.mover) || ' moved out. The place is all yours, and so is the rent.'
             else 'You''re back in a room share. No fees, no hard feelings, one roommate.' end,
        '/home?open=us', null, false);
    exception when others then null;
    end;
  end if;
end;
$$;

/** What "Us" shows about living together (part of couple_state). */
create or replace function public.cohabit_view(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('couples');
  c public.cohabits := public.cohabit_live(p_player);
  partner uuid := public.couple_partner(p_player);
  other uuid;
  today date := public.ny_today();
  me public.players;
  ended public.cohabits;
  live jsonb;
begin
  select * into me from public.players where id = p_player;
  if c.id is not null then
    other := case when c.host = p_player then c.mover else c.host end;
    live := jsonb_build_object(
      'id', c.id, 'role', case when c.host = p_player then 'host' else 'mover' end, 'since', c.start_day, 'days', today - c.start_day,
      'homeId', c.home_id, 'houseSku', (select house_sku from public.players where id = c.host),
      'myRent', public.cohabit_rent_part(p_player, public.rent_for(me.home_id)), 'fullRent', public.rent_for(c.home_id),
      'homeToday', exists (select 1 from public.cohabit_home_days d where d.cohabit_id = c.id and d.player_id = p_player and d.ny_date = today),
      'homeOther', exists (select 1 from public.cohabit_home_days d where d.cohabit_id = c.id and d.player_id = other and d.ny_date = today));
  end if;
  -- The note when the other one ended it by moving out (a breakup has its own), once.
  select * into ended from public.cohabits
   where ended_at is not null and end_reason in ('moved_out', 'moved', 'restart') and ended_by is distinct from p_player
     and ((host = p_player and not host_seen) or (mover = p_player and not mover_seen))
   order by ended_at desc limit 1;
  return jsonb_build_object(
    'live', live,
    'blockedBy', case when partner is null then null else public.cohabit_block_reason(p_player, partner) end,
    'asks', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'mine', k.from_id = p_player, 'homeId', k.home_id) order by k.created_at desc), '[]')
               from public.cohabit_asks k
              where p_player in (k.from_id, k.to_id) and k.status = 'pending'
                and k.created_at > now() - make_interval(days => coalesce((cfg ->> 'moveInAskDays')::int, 7))),
    'ended', case when ended.id is null then null else jsonb_build_object(
      'id', ended.id, 'role', case when ended.host = p_player then 'host' else 'mover' end, 'reason', ended.end_reason,
      'name', (select display_name from public.players where id = case when ended.host = p_player then ended.mover else ended.host end)) end,
    'rules', jsonb_build_object('moveInDays', coalesce((cfg ->> 'moveInDays')::int, 7), 'homeMood', (cfg ->> 'homeMood')::int,
                                'homeClout', (cfg ->> 'homeClout')::int, 'rentShare', (cfg ->> 'rentShare')::numeric));
end;
$$;

-- ---------------------------------------------------------------------------
-- Moving in
-- ---------------------------------------------------------------------------
/** Invite my partner to move into my home. */
create or replace function public.cohabit_ask() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  partner uuid;
  why text;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if not public.rate_hit(uid, 'cohabit', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  partner := public.couple_partner(uid);
  if partner is null then raise exception 'not_dating' using errcode = '22023'; end if;
  perform 1 from public.players where id in (uid, partner) order by id for update;
  perform public.tick(uid);
  perform public.tick(partner);
  why := public.cohabit_block_reason(uid, partner);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  update public.cohabit_asks set status = 'expired'
   where status = 'pending' and least(from_id, to_id) = least(uid, partner) and greatest(from_id, to_id) = greatest(uid, partner)
     and created_at < now() - make_interval(days => coalesce((public.game_settings_value('couples') ->> 'moveInAskDays')::int, 7));
  begin
    insert into public.cohabit_asks (from_id, to_id, home_id) select uid, partner, home_id from public.players where id = uid;
  exception when unique_violation then
    raise exception 'ask_exists' using errcode = '22023';
  end;
  begin
    perform public.push_enqueue(partner, 'cohabit_ask', 'cohabit_ask:' || uid || ':' || public.ny_today(),
      '🏠 ' || public.push_name(uid) || ' wants you to move in',
      'Half the rent, all of the opinions about the thermostat. Answer in Us.', '/home?open=us', null, true);
  exception when others then null;
  end;
  return public.couple_state();
end;
$$;

/** Take back my invitation. */
create or replace function public.cohabit_cancel() returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.rate_hit(auth.uid(), 'cohabit', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  update public.cohabit_asks set status = 'cancelled', answered_at = now() where from_id = auth.uid() and status = 'pending';
  return public.couple_state();
end;
$$;

/** The invited partner answers. Yes moves them in: their rental ends, their bills split from now on. */
create or replace function public.cohabit_answer(p_ask bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  k public.cohabit_asks;
  why text;
  h public.players;
  m public.players;
  rel public.relationships;
  cid bigint;
  hid bigint;
begin
  if not public.rate_hit(uid, 'cohabit', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into k from public.cohabit_asks where id = p_ask and to_id = uid for update;
  if k.id is null then raise exception 'unknown_ask' using errcode = '22023'; end if;
  if k.status <> 'pending' then raise exception 'ask_answered' using errcode = '22023'; end if;
  if k.created_at < now() - make_interval(days => coalesce((public.game_settings_value('couples') ->> 'moveInAskDays')::int, 7)) then
    update public.cohabit_asks set status = 'expired' where id = k.id;
    raise exception 'ask_expired' using errcode = '22023';
  end if;
  if not p_yes then
    update public.cohabit_asks set status = 'declined', answered_at = now() where id = k.id;
    return public.couple_state();
  end if;
  -- Lock both players in a fixed order so two answers (or a move) can't race.
  perform 1 from public.players where id in (k.from_id, uid) order by id for update;
  perform public.tick(k.from_id);
  perform public.tick(uid);
  why := public.cohabit_block_reason(k.from_id, uid);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  select * into h from public.players where id = k.from_id;
  select * into m from public.players where id = uid;
  if h.home_id is distinct from k.home_id then
    update public.cohabit_asks set status = 'cancelled', answered_at = now() where id = k.id;
    raise exception 'home_changed' using errcode = '22023';
  end if;
  rel := public.couple_rel(uid);

  -- The mover's rental ends: the host's home is theirs now, rent day lines up with the host's, furniture to storage.
  -- (Before the row below exists, so the move trigger has nothing to end.)
  update public.players
     set home_id = h.home_id, home_layout = null, next_rent_due = coalesce(h.next_rent_due, m.next_rent_due)
   where id = uid;
  update public.sublet_apps set status = 'withdrawn', answered_at = now() where player_id in (uid, k.from_id) and status = 'pending';
  insert into public.cohabits (rel_id, host, mover, home_id, mover_from, start_day)
  values (rel.id, k.from_id, uid, h.home_id, m.home_id, public.ny_today()) returning id into cid;
  update public.cohabit_asks set status = 'accepted', answered_at = now() where id = k.id;

  -- Lola's Blotter, when neither of them opted out of News mentions.
  if not coalesce(h.news_opt_out, false) and not coalesce(m.news_opt_out, false) then
    insert into public.choice_headlines (player_id, text, kind)
    values (h.id, '🏠 @' || h.display_name || ' and @' || m.display_name
                  || ' moved in together. They split the rent 50/50 and the closet 80/20. Lola gives it until the first flat-pack bookshelf.', 'win')
    returning id into hid;
    update public.cohabits set headline_id = hid where id = cid;
  end if;
  perform public.fact_note(h.id, 'couple.moved_in', m.id::text, jsonb_build_object('role', 'host', 'home', h.home_id));
  perform public.fact_note(m.id, 'couple.moved_in', h.id::text, jsonb_build_object('role', 'mover', 'home', h.home_id));
  begin
    perform public.push_enqueue(h.id, 'cohabit_moved_in', 'cohabit_moved_in:' || cid, '🏠 ' || public.push_name(uid) || ' said yes',
      'They''re moving in. Clear a drawer. Clear two, actually.', '/home?open=us', null, true);
  exception when others then null;
  end;
  return public.couple_state();
end;
$$;

-- ---------------------------------------------------------------------------
-- Living there, moving out
-- ---------------------------------------------------------------------------
/** Either partner ends it: the mover goes back to a room share, the host keeps the home at full rent. */
create or replace function public.cohabit_leave() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.cohabits := public.cohabit_live(uid);
begin
  if not public.rate_hit(uid, 'cohabit', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if c.id is null then raise exception 'not_living_together' using errcode = '22023'; end if;
  perform 1 from public.players where id in (c.host, c.mover) order by id for update;
  perform public.cohabit_close(c.id, uid, 'moved_out');
  return public.couple_state();
end;
$$;

/** "Home together": both tap it on the same New York day; both get a little Mood and clout, once a day. */
create or replace function public.cohabit_hang() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.cohabits := public.cohabit_live(uid);
  cfg jsonb := public.game_settings_value('couples');
  other uuid;
  today date := public.ny_today();
  who uuid;
begin
  if not public.rate_hit(uid, 'cohabit', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if c.id is null then raise exception 'not_living_together' using errcode = '22023'; end if;
  other := case when c.host = uid then c.mover else c.host end;
  insert into public.cohabit_home_days (cohabit_id, player_id, ny_date) values (c.id, uid, today) on conflict do nothing;
  if exists (select 1 from public.cohabit_home_days where cohabit_id = c.id and player_id = other and ny_date = today) then
    foreach who in array array[uid, other] loop
      if public.ledger_once(who, 'clout', (cfg ->> 'homeClout')::int, 'cohabit_home', c.id || ':' || today) then
        update public.players set clout = clout + (cfg ->> 'homeClout')::int, mood = least(100, mood + (cfg ->> 'homeMood')::int) where id = who;
      end if;
    end loop;
  else
    begin
      perform public.push_enqueue(other, 'cohabit_home', 'cohabit_home:' || c.id || ':' || today, '🏠 ' || public.push_name(uid) || ' is home',
        'Tap "Home together" too and you both feel better. Science, probably.', '/home?open=us', null, true);
    exception when others then null;
    end;
  end if;
  return public.couple_state();
end;
$$;

/** The mover's view of where they live: the host's home, layout and furniture (like sublet_home). Null for the host. */
create or replace function public.cohabit_home() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  c public.cohabits := public.cohabit_live(auth.uid());
  p public.players;
begin
  if c.id is null or c.mover <> auth.uid() then return null; end if;
  select * into p from public.players where id = c.host;
  return jsonb_build_object('id', c.id, 'host', p.id, 'hostName', p.display_name, 'homeId', p.home_id, 'houseSku', p.house_sku,
    'layout', p.home_layout,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'sku', i.sku) order by i.id)
                         from public.player_items i where i.player_id = p.id and i.category = 'home'), '[]'::jsonb));
end;
$$;

/** My next rent bill's amount while living together (null when not): the Bills screen's "next rent". */
create or replace function public.cohabit_rent() returns int
language sql stable security definer set search_path = public
as $$
  select case when (public.cohabit_live(p.id)).id is null then null else public.cohabit_rent_part(p.id, public.rent_for(p.home_id)) end
    from public.players p where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Triggers: the split rent, moves, breakups, blocks, sublets, visits, the couples' Shop
-- ---------------------------------------------------------------------------
-- Each rent bill issued while together is the player's part (an owned house: none for the mover).
create or replace function public.bills_cohabit_split() returns trigger
language plpgsql security definer set search_path = public
as $$
declare c public.cohabits;
begin
  if new.kind <> 'rent' then return new; end if;
  c := public.cohabit_live(new.player_id);
  if c.id is null or c.start_day > new.due_date then return new; end if;
  new.amount := public.cohabit_rent_part(new.player_id, new.amount::int);
  if new.amount <= 0 then return null; end if;
  return new;
end;
$$;
drop trigger if exists bills_cohabit_split on public.bills;
create trigger bills_cohabit_split before insert on public.bills for each row execute function public.bills_cohabit_split();

-- Either of them moving (move_home, an eviction, buying their way elsewhere) or starting over ends it.
create or replace function public.players_cohabit_moves() returns trigger
language plpgsql security definer set search_path = public
as $$
declare c public.cohabits;
begin
  if new.home_id is not distinct from old.home_id then return null; end if;
  c := public.cohabit_live(new.id);
  if c.id is not null then
    perform public.cohabit_close(c.id, new.id, case when new.home_id is null then 'restart' else 'moved' end);
  end if;
  if new.home_id is null then
    update public.cohabit_asks set status = 'cancelled', answered_at = now() where status = 'pending' and new.id in (from_id, to_id);
  end if;
  return null;
end;
$$;
drop trigger if exists players_cohabit_moves on public.players;
create trigger players_cohabit_moves after update of home_id on public.players
  for each row execute function public.players_cohabit_moves();

-- The relationship ending (breakup or block, migration 0118's couple_close) ends living together too.
create or replace function public.relationships_cohabit_end() returns trigger
language plpgsql security definer set search_path = public
as $$
declare c public.cohabits;
begin
  if new.ended_at is null or old.ended_at is not null then return null; end if;
  select * into c from public.cohabits where rel_id = new.id and ended_at is null;
  if c.id is not null then
    perform public.cohabit_close(c.id, new.ended_by, case when new.end_reason = 'blocked' then 'blocked' else 'breakup' end);
  end if;
  update public.cohabit_asks set status = 'cancelled', answered_at = now()
   where status = 'pending' and least(from_id, to_id) = new.a and greatest(from_id, to_id) = new.b;
  return null;
end;
$$;
drop trigger if exists relationships_cohabit_end on public.relationships;
create trigger relationships_cohabit_end after update of ended_at on public.relationships
  for each row execute function public.relationships_cohabit_end();

-- No sublets while living together: hosting (sublet_host_block, 0119's with one more reason) or applying.
create or replace function public.sublet_host_block(p_player uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('sublets');
  me public.players;
begin
  select * into me from public.players where id = p_player;
  if me.id is null or me.home_id is null then return 'no_player'; end if;
  if (public.cohabit_live(p_player)).id is not null then return 'living_together'; end if;
  if me.house_sku is not null then return 'own_house'; end if;
  if not (cfg -> 'homes') ? me.home_id then return 'home_too_small'; end if;
  if me.created_at > now() - make_interval(days => (cfg ->> 'minAccountDays')::int) then return 'too_new'; end if;
  if (public.sublet_live(p_player)).id is not null then return 'one_sublet'; end if;
  return null;
end;
$$;

create or replace function public.sublet_apps_cohabit_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (public.cohabit_live(new.player_id)).id is not null then raise exception 'living_together' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists sublet_apps_cohabit_guard on public.sublet_apps;
create trigger sublet_apps_cohabit_guard before insert on public.sublet_apps for each row execute function public.sublet_apps_cohabit_guard();

-- The mover's own layout is in storage, so the host does the hosting.
create or replace function public.visits_cohabit_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.cohabits where mover = new.host and ended_at is null) then
    raise exception 'partner_hosts' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists visits_cohabit_guard on public.visits;
create trigger visits_cohabit_guard before insert on public.visits for each row execute function public.visits_cohabit_guard();

-- Couple Shop items (catalog extra.couplesOnly): bought only by someone who's dating.
create or replace function public.shop_couples_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.acquired <> 'bought' then return new; end if;
  if exists (select 1 from public.shop_catalog c where c.sku = new.sku and coalesce(c.extra ->> 'couplesOnly', 'false') = 'true')
     and public.couple_partner(new.player_id) is null then
    raise exception 'couples_only' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists player_items_couples_guard on public.player_items;
create trigger player_items_couples_guard before insert on public.player_items
  for each row execute function public.shop_couples_guard();

-- ---------------------------------------------------------------------------
-- 0118's screens, with living together
-- ---------------------------------------------------------------------------
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
    'home', public.cohabit_view(uid),
    'rules', jsonb_build_object('datesToOfficial', (cfg ->> 'datesToOfficial')::int, 'streakMessages', (cfg ->> 'streakMessages')::int,
                                'giftMood', (cfg ->> 'giftMood')::int, 'giftClout', (cfg ->> 'giftClout')::int));
end;
$$;

/** Cards seen: received gifts, the breakup card and the moved-out note. */
create or replace function public.couple_seen() returns void
language sql security definer set search_path = public
as $$
  update public.couple_gifts set seen_at = now() where to_id = auth.uid() and seen_at is null;
  update public.relationships
     set a_end_seen = case when a = auth.uid() then coalesce(a_end_seen, now()) else a_end_seen end,
         b_end_seen = case when b = auth.uid() then coalesce(b_end_seen, now()) else b_end_seen end
   where auth.uid() in (a, b) and ended_at is not null;
  update public.cohabits set host_seen = host_seen or host = auth.uid(), mover_seen = mover_seen or mover = auth.uid()
   where auth.uid() in (host, mover) and ended_at is not null;
$$;

-- The player card: "💞 Dating @name", and "🏠 Living with @name" while they share a home (unless the card hides it).
create or replace function public.couple_public(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', o.id, 'name', o.display_name, 'since', r.start_day,
                            'together', c.id is not null, 'togetherSince', c.start_day)
    from public.couple_members m join public.relationships r on r.id = m.rel_id
    join public.players o on o.id = case when r.a = p_player then r.b else r.a end
    left join public.cohabits c on c.rel_id = r.id and c.ended_at is null
   where m.player_id = p_player and not (case when r.a = p_player then r.a_hidden else r.b_hidden end) and o.banned_at is null
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.cohabit_ask()', 'public.cohabit_cancel()', 'public.cohabit_answer(bigint, boolean)', 'public.cohabit_leave()',
    'public.cohabit_hang()', 'public.cohabit_home()', 'public.cohabit_rent()', 'public.couple_state()', 'public.couple_seen()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.cohabit_live(uuid)', 'public.cohabit_rent_part(uuid, int)', 'public.cohabit_block_reason(uuid, uuid)',
    'public.cohabit_close(bigint, uuid, text)', 'public.cohabit_view(uuid)', 'public.bills_cohabit_split()',
    'public.players_cohabit_moves()', 'public.relationships_cohabit_end()', 'public.sublet_host_block(uuid)',
    'public.sublet_apps_cohabit_guard()', 'public.visits_cohabit_guard()', 'public.shop_couples_guard()', 'public.couple_public(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
