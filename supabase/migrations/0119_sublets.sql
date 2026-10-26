-- Sublets, phase 1 (owner, Oct 26: "Go with your recommendations"; spec section 25): a player renting a 1BR or bigger
-- lets their spare room to another player for a few weeks.
--
--   * Listing (sublet_list): the Jackson Heights 1BR, Sunnyside Gardens or the LIC high-rise, rented (not an owned house).
--     Weekly rent between a quarter and half of the home's rent; stays of 1 to 8 weeks. The host's crew sees a new listing
--     for 24 hours, then everyone. One open listing per host.
--   * Applying (sublet_apply): a length and a short note. Nothing is charged until the host accepts (sublet_answer);
--     then the first week's rent goes to the host and a one-week deposit is held by the game (ledger 'sublet_rent',
--     'sublet_income', 'sublet_deposit'). Accepting closes the listing and every other application.
--   * Living there: the subtenant skips the home's clout requirement and sees the host's home with a second bed (drawn by
--     the client). Their own lease is held: no rent bills there while subletting (bills_sublet_hold), furniture kept.
--     Rent is charged every 7 days from the start, ahead (sublet_settle, run by sublet_state and by the push sender
--     through sublet_settle_all); if the subtenant can't pay, the sublet ends and the deposit comes back.
--     Roommate hang (sublet_hang): when both tap it on the same New York day, both get clout once.
--   * Ending: the subtenant leaves any time (sublet_leave); the host gives 7 days' notice (sublet_notice, can be taken
--     back); the end date; a block by either side; the host moving, buying a house or being evicted; Start over. The
--     deposit always comes back in full. Both rate each other afterwards (sublet_rate). Either asks to renew.
--   * Cards: "🏠 Subletting from @host" / "🔑 Hosting @sub" unless that player hides theirs (sublet_show).
-- Both accounts 7+ days old; one sublet per player at a time (as host or subtenant); C$ only.

insert into public.game_settings (key, value) values ('sublets', '{"homes":["jackson_heights_1br","sunnyside_gardens","lic_highrise"],"minShare":0.25,"maxShare":0.5,"minWeeks":1,"maxWeeks":8,"crewHours":24,"noticeDays":7,"minAccountDays":7,"hangClout":10,"maxApps":3,"noteMax":140}'::jsonb)
on conflict (key) do update set value = excluded.value;

create table if not exists public.sublet_listings (
  id         bigint generated always as identity primary key,
  host       uuid not null references public.players (id) on delete cascade,
  home_id    text not null,
  rent       int not null check (rent > 0),
  min_weeks  int not null check (min_weeks between 1 and 52),
  max_weeks  int not null check (max_weeks between 1 and 52),
  note       text,
  crew_until timestamptz not null,
  status     text not null default 'open' check (status in ('open', 'taken', 'closed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
create unique index if not exists sublet_listings_one_open on public.sublet_listings (host) where status = 'open';

create table if not exists public.sublet_apps (
  id          bigint generated always as identity primary key,
  listing_id  bigint not null references public.sublet_listings (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  weeks       int not null check (weeks between 1 and 52),
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'closed')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
create unique index if not exists sublet_apps_one_pending on public.sublet_apps (listing_id, player_id) where status = 'pending';
create index if not exists sublet_apps_player_idx on public.sublet_apps (player_id, status);

create table if not exists public.sublets (
  id          bigint generated always as identity primary key,
  listing_id  bigint references public.sublet_listings (id) on delete set null,
  host        uuid not null references public.players (id) on delete cascade,
  sub         uuid not null references public.players (id) on delete cascade,
  home_id     text not null,
  rent        int not null,
  deposit     int not null,
  weeks       int not null,
  weeks_paid  int not null default 1,
  start_day   date not null,
  end_day     date not null,
  notice_end  date,
  renew_weeks int,
  renew_by    uuid,
  host_hidden boolean not null default false,
  sub_hidden  boolean not null default false,
  ended_at    timestamptz,
  end_reason  text check (end_reason in ('done', 'left', 'notice', 'unpaid', 'blocked', 'host_moved', 'restart')),
  host_seen   boolean not null default false,
  sub_seen    boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists sublets_live_host on public.sublets (host) where ended_at is null;
create unique index if not exists sublets_live_sub on public.sublets (sub) where ended_at is null;

create table if not exists public.sublet_ratings (
  sublet_id  bigint not null references public.sublets (id) on delete cascade,
  rater      uuid not null references public.players (id) on delete cascade,
  rated      uuid not null references public.players (id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (sublet_id, rater)
);
create index if not exists sublet_ratings_rated_idx on public.sublet_ratings (rated);

create table if not exists public.sublet_hangs (
  sublet_id bigint not null references public.sublets (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  ny_date   date not null,
  primary key (sublet_id, player_id, ny_date)
);

alter table public.sublet_listings enable row level security;
alter table public.sublet_apps enable row level security;
alter table public.sublets enable row level security;
alter table public.sublet_ratings enable row level security;
alter table public.sublet_hangs enable row level security;
revoke all on public.sublet_listings, public.sublet_apps, public.sublets, public.sublet_ratings, public.sublet_hangs
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** The live sublet a player is in, as host or subtenant (null id when none). */
create or replace function public.sublet_live(p_player uuid) returns public.sublets
language sql stable security definer set search_path = public
as $$ select * from public.sublets where (host = p_player or sub = p_player) and ended_at is null limit 1 $$;

/** A player's sublet rating: average stars and how many stays (as host or subtenant). */
create or replace function public.sublet_rating(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('avg', round(avg(r.stars)::numeric, 1), 'count', count(*)) from public.sublet_ratings r where r.rated = p_player
$$;

/** The weekly rent range for a room in a home: a quarter to half of its rent. */
create or replace function public.sublet_bounds(p_home text) returns int[]
language sql stable security definer set search_path = public
as $$
  select array[ceil(public.rent_for(p_home) * (s ->> 'minShare')::numeric)::int, floor(public.rent_for(p_home) * (s ->> 'maxShare')::numeric)::int]
    from (select public.game_settings_value('sublets') s) x
$$;

/** Ends a sublet and gives the deposit back (once: ledger 'sublet_deposit' ref back:<id>). */
create or replace function public.sublet_close(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare s public.sublets;
begin
  update public.sublets set ended_at = now(), end_reason = p_reason, renew_weeks = null, renew_by = null
   where id = p_id and ended_at is null returning * into s;
  if s.id is null then return; end if;
  if public.ledger_once(s.sub, 'cash', s.deposit, 'sublet_deposit', 'back:' || s.id) then
    update public.players set bank_cash = bank_cash + s.deposit where id = s.sub;
  end if;
  begin
    perform public.push_enqueue(case when p_reason = 'left' then s.host else s.sub end, 'sublet_ended', 'sublet_ended:' || s.id,
      '🔑 The sublet is over',
      case p_reason when 'left' then public.push_name(s.sub) || ' moved out of your spare room.'
                    when 'unpaid' then 'Rent didn''t clear, so the sublet ended. Your deposit is back in the bank.'
                    else 'Your sublet at ' || public.push_name(s.host) || '''s place ended. Your deposit is back in the bank.' end,
      '/home?open=apartments', null, false);
  exception when others then null;
  end;
end;
$$;

/**
 * Charges the weeks that have come due (every 7 days from the start, ahead) and ends a sublet that has reached its end
 * date or its notice date. A subtenant who can't pay a week ends it ('unpaid'); the deposit comes back either way.
 */
create or replace function public.sublet_settle(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.sublets;
  today date := public.ny_today();
  stop date;
  due date;
begin
  select * into s from public.sublets where id = p_id and ended_at is null for update;
  if s.id is null then return; end if;
  stop := least(s.end_day, coalesce(s.notice_end, s.end_day));
  loop
    due := s.start_day + 7 * s.weeks_paid;
    exit when s.weeks_paid >= s.weeks or due > today or due >= stop;
    perform 1 from public.players where id = s.sub for update;
    if (select bank_cash from public.players where id = s.sub) < s.rent then
      perform public.sublet_close(s.id, 'unpaid');
      return;
    end if;
    if public.ledger_once(s.sub, 'cash', -s.rent, 'sublet_rent', s.id || ':' || s.weeks_paid) then
      update public.players set bank_cash = bank_cash - s.rent where id = s.sub;
    end if;
    if public.ledger_once(s.host, 'cash', s.rent, 'sublet_income', s.id || ':' || s.weeks_paid) then
      update public.players set bank_cash = bank_cash + s.rent where id = s.host;
    end if;
    s.weeks_paid := s.weeks_paid + 1;
    update public.sublets set weeks_paid = s.weeks_paid where id = s.id;
  end loop;
  if today >= stop then
    perform public.sublet_close(s.id, case when s.notice_end is not null and s.notice_end < s.end_day then 'notice' else 'done' end);
  end if;
end;
$$;

/** The push sender settles every live sublet after its scans (rent comes due even while nobody opens the game). */
create or replace function public.sublet_settle_all() returns int
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in select id from public.sublets where ended_at is null loop
    perform public.sublet_settle(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

/** Why a player can't host right now (null: they can). */
create or replace function public.sublet_host_block(p_player uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('sublets');
  me public.players;
begin
  select * into me from public.players where id = p_player;
  if me.id is null or me.home_id is null then return 'no_player'; end if;
  if me.house_sku is not null then return 'own_house'; end if;
  if not (cfg -> 'homes') ? me.home_id then return 'home_too_small'; end if;
  if me.created_at > now() - make_interval(days => (cfg ->> 'minAccountDays')::int) then return 'too_new'; end if;
  if (public.sublet_live(p_player)).id is not null then return 'one_sublet'; end if;
  return null;
end;
$$;

/** Whether a player sees a listing: open, not their own, nobody blocked, and crew only for its first hours. */
create or replace function public.sublet_visible(p_player uuid, l public.sublet_listings) returns boolean
language sql stable security definer set search_path = public
as $$
  select l.status = 'open' and l.host <> p_player and not public.is_blocked_pair(p_player, l.host)
     and (l.crew_until <= now() or p_player in (select id from public.crew_of(l.host)))
     and exists (select 1 from public.players h where h.id = l.host and h.banned_at is null and h.home_id = l.home_id and h.house_sku is null)
$$;

create or replace function public.sublet_person(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style, 'rating', public.sublet_rating(p.id),
                            'days', (public.ny_today() - (p.created_at at time zone 'America/New_York')::date))
    from public.players p where p.id = p_player
$$;

-- ---------------------------------------------------------------------------
-- What the screens show
-- ---------------------------------------------------------------------------
/** Everything Apartments → Sublets and the home screen need, in one call (it settles my live sublet first). */
create or replace function public.sublet_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('sublets');
  today date := public.ny_today();
  me public.players;
  s public.sublets;
  l public.sublet_listings;
  ended public.sublets;
  live jsonb;
  mine jsonb;
  done jsonb;
  role text;
  other uuid;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  s := public.sublet_live(uid);
  if s.id is not null then perform public.sublet_settle(s.id); s := public.sublet_live(uid); end if;

  if s.id is not null then
    role := case when s.host = uid then 'host' else 'sub' end;
    other := case when role = 'host' then s.sub else s.host end;
    live := jsonb_build_object(
      'id', s.id, 'role', role, 'with', public.sublet_person(other), 'homeId', s.home_id, 'rent', s.rent, 'deposit', s.deposit,
      'weeks', s.weeks, 'week', least(s.weeks, (today - s.start_day) / 7 + 1), 'start', s.start_day, 'end', s.end_day,
      'nextRent', case when s.weeks_paid < s.weeks and s.start_day + 7 * s.weeks_paid < least(s.end_day, coalesce(s.notice_end, s.end_day))
                       then s.start_day + 7 * s.weeks_paid end,
      'noticeEnd', s.notice_end,
      'renew', case when s.renew_weeks is not null then jsonb_build_object('weeks', s.renew_weeks, 'mine', s.renew_by = uid) end,
      'shown', not (case when role = 'host' then s.host_hidden else s.sub_hidden end),
      'hangToday', exists (select 1 from public.sublet_hangs h where h.sublet_id = s.id and h.player_id = uid and h.ny_date = today),
      'hangOther', exists (select 1 from public.sublet_hangs h where h.sublet_id = s.id and h.player_id = other and h.ny_date = today));
  end if;

  select * into l from public.sublet_listings where host = uid and status = 'open';
  if l.id is not null then
    mine := jsonb_build_object('id', l.id, 'homeId', l.home_id, 'rent', l.rent, 'minWeeks', l.min_weeks, 'maxWeeks', l.max_weeks,
      'note', l.note, 'crewUntil', l.crew_until,
      'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'weeks', a.weeks, 'note', a.note, 'at', a.created_at,
                                                            'from', public.sublet_person(a.player_id)) order by a.created_at)
                          from public.sublet_apps a where a.listing_id = l.id and a.status = 'pending'
                           and not public.is_blocked_pair(uid, a.player_id)), '[]'::jsonb));
  end if;

  -- The last sublet that ended and this side hasn't seen yet: the "it's over" card and rating.
  select * into ended from public.sublets
   where ended_at is not null and ((host = uid and not host_seen) or (sub = uid and not sub_seen))
   order by ended_at desc limit 1;
  if ended.id is not null then
    done := jsonb_build_object('id', ended.id, 'role', case when ended.host = uid then 'host' else 'sub' end, 'reason', ended.end_reason,
      'with', public.sublet_person(case when ended.host = uid then ended.sub else ended.host end),
      'deposit', ended.deposit,
      'rated', exists (select 1 from public.sublet_ratings r where r.sublet_id = ended.id and r.rater = uid));
  end if;

  return jsonb_build_object(
    'hostBlock', public.sublet_host_block(uid),
    'bounds', case when (cfg -> 'homes') ? me.home_id then to_jsonb(public.sublet_bounds(me.home_id)) end,
    'live', live, 'mine', mine, 'ended', done,
    'listings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'homeId', x.home_id, 'rent', x.rent, 'minWeeks', x.min_weeks, 'maxWeeks', x.max_weeks, 'note', x.note,
        'crewOnly', x.crew_until > now(), 'crewUntil', x.crew_until, 'host', public.sublet_person(x.host),
        'applied', exists (select 1 from public.sublet_apps a where a.listing_id = x.id and a.player_id = uid and a.status = 'pending'))
        order by (x.crew_until > now()) desc, x.created_at desc)
        from (select * from public.sublet_listings where status = 'open' order by created_at desc limit 200) x
       where public.sublet_visible(uid, x)), '[]'::jsonb),
    'rules', jsonb_build_object('minWeeks', (cfg ->> 'minWeeks')::int, 'maxWeeks', (cfg ->> 'maxWeeks')::int,
      'noticeDays', (cfg ->> 'noticeDays')::int, 'hangClout', (cfg ->> 'hangClout')::int, 'crewHours', (cfg ->> 'crewHours')::int,
      'noteMax', (cfg ->> 'noteMax')::int, 'minAccountDays', (cfg ->> 'minAccountDays')::int));
end;
$$;

/** The subtenant's view of where they live: the host's home, layout and furniture (like job_home). */
create or replace function public.sublet_home() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  s public.sublets := public.sublet_live(auth.uid());
  p public.players;
begin
  if s.id is null or s.sub <> auth.uid() then return null; end if;
  select * into p from public.players where id = s.host;
  return jsonb_build_object('id', s.id, 'host', p.id, 'hostName', p.display_name, 'homeId', s.home_id, 'layout', p.home_layout,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'sku', i.sku) order by i.id)
                         from public.player_items i where i.player_id = p.id and i.category = 'home'), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Hosting
-- ---------------------------------------------------------------------------
create or replace function public.sublet_list(p_rent int, p_min_weeks int, p_max_weeks int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('sublets');
  why text;
  me public.players;
  b int[];
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform 1 from public.players where id = uid for update;
  why := public.sublet_host_block(uid);
  if why is not null then raise exception '%', why using errcode = case when why = 'no_player' then '28000' else '22023' end; end if;
  select * into me from public.players where id = uid;
  b := public.sublet_bounds(me.home_id);
  if p_rent is null or p_rent < b[1] or p_rent > b[2] then raise exception 'rent_out_of_range' using errcode = '22023'; end if;
  if p_min_weeks is null or p_max_weeks is null or p_min_weeks < (cfg ->> 'minWeeks')::int or p_max_weeks > (cfg ->> 'maxWeeks')::int
     or p_min_weeks > p_max_weeks then raise exception 'bad_weeks' using errcode = '22023'; end if;
  if length(v_note) > (cfg ->> 'noteMax')::int then raise exception 'note_too_long' using errcode = '22023'; end if;
  if exists (select 1 from public.sublet_apps where player_id = uid and status = 'pending') then
    raise exception 'applied_elsewhere' using errcode = '22023';
  end if;
  update public.sublet_listings set rent = p_rent, min_weeks = p_min_weeks, max_weeks = p_max_weeks, note = v_note
   where host = uid and status = 'open';
  if not found then
    insert into public.sublet_listings (host, home_id, rent, min_weeks, max_weeks, note, crew_until)
    values (uid, me.home_id, p_rent, p_min_weeks, p_max_weeks, v_note, now() + make_interval(hours => (cfg ->> 'crewHours')::int));
  end if;
  -- Applications asking for a length the listing no longer offers are closed.
  update public.sublet_apps a set status = 'closed', answered_at = now()
    from public.sublet_listings l
   where l.host = uid and l.status = 'open' and a.listing_id = l.id and a.status = 'pending' and (a.weeks < p_min_weeks or a.weeks > p_max_weeks);
  return public.sublet_state();
end;
$$;

create or replace function public.sublet_unlist() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  update public.sublet_apps a set status = 'closed', answered_at = now()
    from public.sublet_listings l where l.host = uid and l.status = 'open' and a.listing_id = l.id and a.status = 'pending';
  update public.sublet_listings set status = 'closed', closed_at = now() where host = uid and status = 'open';
  return public.sublet_state();
end;
$$;

/** The host says yes or no. Yes charges the first week and the deposit, starts the sublet and closes everything else. */
create or replace function public.sublet_answer(p_app bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.sublet_apps;
  l public.sublet_listings;
  v_sub public.players;
  v_host public.players;
  today date := public.ny_today();
  sid bigint;
begin
  select * into a from public.sublet_apps where id = p_app for update;
  select * into l from public.sublet_listings where id = a.listing_id for update;
  if a.id is null or l.host is distinct from uid then raise exception 'unknown_app' using errcode = '22023'; end if;
  if a.status <> 'pending' or l.status <> 'open' then raise exception 'app_answered' using errcode = '22023'; end if;
  if not p_yes then
    update public.sublet_apps set status = 'declined', answered_at = now() where id = a.id;
    return public.sublet_state();
  end if;
  -- Lock both players in a fixed order.
  perform 1 from public.players where id in (uid, a.player_id) order by id for update;
  select * into v_host from public.players where id = uid;
  select * into v_sub from public.players where id = a.player_id;
  if public.is_blocked_pair(uid, a.player_id) or v_sub.banned_at is not null or v_sub.home_id is null then
    update public.sublet_apps set status = 'closed', answered_at = now() where id = a.id;
    raise exception 'not_available' using errcode = '22023';
  end if;
  if v_host.home_id <> l.home_id or v_host.house_sku is not null then raise exception 'home_changed' using errcode = '22023'; end if;
  if (public.sublet_live(uid)).id is not null then raise exception 'one_sublet' using errcode = '22023'; end if;
  if (public.sublet_live(a.player_id)).id is not null then
    update public.sublet_apps set status = 'closed', answered_at = now() where id = a.id;
    raise exception 'they_have_sublet' using errcode = '22023';
  end if;
  if v_sub.bank_cash < l.rent * 2 then raise exception 'they_cant_afford' using errcode = '22023'; end if;

  insert into public.sublets (listing_id, host, sub, home_id, rent, deposit, weeks, start_day, end_day)
  values (l.id, uid, a.player_id, l.home_id, l.rent, l.rent, a.weeks, today, today + 7 * a.weeks) returning id into sid;
  perform public.ledger_once(a.player_id, 'cash', -l.rent, 'sublet_rent', sid || ':0');
  perform public.ledger_once(a.player_id, 'cash', -l.rent, 'sublet_deposit', 'hold:' || sid);
  perform public.ledger_once(uid, 'cash', l.rent, 'sublet_income', sid || ':0');
  update public.players set bank_cash = bank_cash - l.rent * 2 where id = a.player_id;
  update public.players set bank_cash = bank_cash + l.rent where id = uid;

  update public.sublet_apps set status = 'accepted', answered_at = now() where id = a.id;
  update public.sublet_apps set status = 'closed', answered_at = now()
   where status = 'pending' and (listing_id = l.id or player_id = a.player_id);
  update public.sublet_listings set status = 'taken', closed_at = now() where id = l.id;
  -- The new subtenant's own listing, if any, comes down too (one sublet each).
  update public.sublet_apps x set status = 'closed', answered_at = now()
    from public.sublet_listings y where y.host = a.player_id and y.status = 'open' and x.listing_id = y.id and x.status = 'pending';
  update public.sublet_listings set status = 'closed', closed_at = now() where host = a.player_id and status = 'open';
  return public.sublet_state();
end;
$$;

/** The host gives 7 days' notice (or takes it back). */
create or replace function public.sublet_notice(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s public.sublets := public.sublet_live(auth.uid());
begin
  if s.id is null or s.host <> auth.uid() then raise exception 'not_hosting' using errcode = '22023'; end if;
  if p_on then
    update public.sublets set notice_end = least(end_day, public.ny_today() + (public.game_settings_value('sublets') ->> 'noticeDays')::int),
           renew_weeks = null, renew_by = null
     where id = s.id and notice_end is null;
    begin
      perform public.push_enqueue(s.sub, 'sublet_notice', 'sublet_notice:' || s.id || ':' || public.ny_today(), '🔑 ' || public.push_name(s.host) || ' gave notice',
        'You have a week to move out. Your deposit comes back in full.', '/home?open=apartments', null, false);
    exception when others then null;
    end;
  else
    update public.sublets set notice_end = null where id = s.id;
  end if;
  return public.sublet_state();
end;
$$;

-- ---------------------------------------------------------------------------
-- Subletting
-- ---------------------------------------------------------------------------
create or replace function public.sublet_apply(p_listing bigint, p_weeks int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('sublets');
  l public.sublet_listings;
  me public.players;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into l from public.sublet_listings where id = p_listing;
  if l.id is null or not public.sublet_visible(uid, l) then raise exception 'listing_gone' using errcode = '22023'; end if;
  if me.created_at > now() - make_interval(days => (cfg ->> 'minAccountDays')::int) then raise exception 'too_new' using errcode = '22023'; end if;
  if (public.sublet_live(uid)).id is not null then raise exception 'one_sublet' using errcode = '22023'; end if;
  if exists (select 1 from public.sublet_listings where host = uid and status = 'open') then raise exception 'you_are_listing' using errcode = '22023'; end if;
  if p_weeks is null or p_weeks < l.min_weeks or p_weeks > l.max_weeks then raise exception 'bad_weeks' using errcode = '22023'; end if;
  if length(v_note) > (cfg ->> 'noteMax')::int then raise exception 'note_too_long' using errcode = '22023'; end if;
  if exists (select 1 from public.bills where player_id = uid and kind = 'rent' and status = 'due') then raise exception 'rent_due' using errcode = '22023'; end if;
  if me.bank_cash < l.rent * 2 then raise exception 'cant_afford' using errcode = '22023'; end if;
  if (select count(*) from public.sublet_apps where player_id = uid and status = 'pending') >= (cfg ->> 'maxApps')::int then
    raise exception 'too_many_apps' using errcode = '22023';
  end if;
  begin
    insert into public.sublet_apps (listing_id, player_id, weeks, note) values (l.id, uid, p_weeks, v_note);
  exception when unique_violation then
    raise exception 'already_applied' using errcode = '22023';
  end;
  return public.sublet_state();
end;
$$;

create or replace function public.sublet_withdraw(p_listing bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.sublet_apps set status = 'withdrawn', answered_at = now()
   where listing_id = p_listing and player_id = auth.uid() and status = 'pending';
  return public.sublet_state();
end;
$$;

/** The subtenant moves out early: the deposit comes back. */
create or replace function public.sublet_leave() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare s public.sublets := public.sublet_live(auth.uid());
begin
  if s.id is null or s.sub <> auth.uid() then raise exception 'not_subletting' using errcode = '22023'; end if;
  perform public.sublet_settle(s.id);
  perform public.sublet_close(s.id, 'left');
  -- Leaving is my own doing: no "it's over" card for me.
  update public.sublets set sub_seen = true where id = s.id;
  return public.sublet_state();
end;
$$;

/** Either side asks for more weeks; the other side's yes extends it (within the listing's longest stay overall). */
create or replace function public.sublet_renew(p_weeks int) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s public.sublets := public.sublet_live(auth.uid());
  cfg jsonb := public.game_settings_value('sublets');
begin
  if s.id is null then raise exception 'not_subletting' using errcode = '22023'; end if;
  if s.notice_end is not null then raise exception 'notice_given' using errcode = '22023'; end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > (cfg ->> 'maxWeeks')::int then raise exception 'bad_weeks' using errcode = '22023'; end if;
  update public.sublets set renew_weeks = p_weeks, renew_by = auth.uid() where id = s.id;
  begin
    perform public.push_enqueue(case when s.host = auth.uid() then s.sub else s.host end, 'sublet_renew', 'sublet_renew:' || s.id || ':' || s.weeks,
      '🔑 ' || public.push_name(auth.uid()) || ' wants to renew', p_weeks || ' more week' || case when p_weeks = 1 then '' else 's' end || '. Your call.',
      '/home?open=apartments', null, false);
  exception when others then null;
  end;
  return public.sublet_state();
end;
$$;

create or replace function public.sublet_renew_answer(p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare s public.sublets := public.sublet_live(auth.uid());
begin
  if s.id is null or s.renew_weeks is null or s.renew_by = auth.uid() then raise exception 'no_renewal' using errcode = '22023'; end if;
  if p_yes then
    update public.sublets set weeks = weeks + renew_weeks, end_day = end_day + 7 * renew_weeks, renew_weeks = null, renew_by = null where id = s.id;
  else
    update public.sublets set renew_weeks = null, renew_by = null where id = s.id;
  end if;
  return public.sublet_state();
end;
$$;

/** Roommate hang: both tap it on the same New York day and both get a little clout, once a day. */
create or replace function public.sublet_hang() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.sublets := public.sublet_live(uid);
  other uuid;
  today date := public.ny_today();
  c int := (public.game_settings_value('sublets') ->> 'hangClout')::int;
begin
  if s.id is null then raise exception 'not_subletting' using errcode = '22023'; end if;
  other := case when s.host = uid then s.sub else s.host end;
  insert into public.sublet_hangs (sublet_id, player_id, ny_date) values (s.id, uid, today) on conflict do nothing;
  if exists (select 1 from public.sublet_hangs where sublet_id = s.id and player_id = other and ny_date = today) then
    if public.ledger_once(uid, 'clout', c, 'sublet_hang', s.id || ':' || today) then
      update public.players set clout = clout + c where id = uid;
    end if;
    if public.ledger_once(other, 'clout', c, 'sublet_hang', s.id || ':' || today) then
      update public.players set clout = clout + c where id = other;
    end if;
  else
    begin
      perform public.push_enqueue(other, 'sublet_hang', 'sublet_hang:' || s.id || ':' || today, '🤝 ' || public.push_name(uid) || ' is home',
        'Roommate hang? Tap it too and you both get clout.', '/home?open=apartments', null, true);
    exception when others then null;
    end;
  end if;
  return public.sublet_state();
end;
$$;

create or replace function public.sublet_show(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare s public.sublets := public.sublet_live(auth.uid());
begin
  if s.id is null then raise exception 'not_subletting' using errcode = '22023'; end if;
  if s.host = auth.uid() then update public.sublets set host_hidden = not p_on where id = s.id;
  else update public.sublets set sub_hidden = not p_on where id = s.id; end if;
  return public.sublet_state();
end;
$$;

/** Rating the other side of a sublet that ended (once each), which also closes the "it's over" card. */
create or replace function public.sublet_rate(p_sublet bigint, p_stars int) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.sublets;
begin
  select * into s from public.sublets where id = p_sublet and uid in (host, sub);
  if s.id is null or s.ended_at is null then raise exception 'not_ended' using errcode = '22023'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'bad_stars' using errcode = '22023'; end if;
  insert into public.sublet_ratings (sublet_id, rater, rated, stars)
  values (s.id, uid, case when s.host = uid then s.sub else s.host end, p_stars) on conflict do nothing;
  update public.sublets set host_seen = host_seen or s.host = uid, sub_seen = sub_seen or s.sub = uid where id = s.id;
  return public.sublet_state();
end;
$$;

create or replace function public.sublet_seen(p_sublet bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.sublets set host_seen = host_seen or host = auth.uid(), sub_seen = sub_seen or sub = auth.uid()
   where id = p_sublet and auth.uid() in (host, sub) and ended_at is not null;
  return public.sublet_state();
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: the held lease, moves, blocks
-- ---------------------------------------------------------------------------
-- The subtenant's own lease is held: no rent bill comes due there while they sublet.
create or replace function public.bills_sublet_hold() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'rent' and exists (select 1 from public.sublets where sub = new.player_id and ended_at is null and start_day <= new.due_date) then
    return null;
  end if;
  return new;
end;
$$;
drop trigger if exists bills_sublet_hold on public.bills;
create trigger bills_sublet_hold before insert on public.bills for each row execute function public.bills_sublet_hold();

-- The host moving (or buying a house, or being evicted) ends the sublet and takes the listing down; Start over ends
-- either side's.
create or replace function public.players_sublet_moves() returns trigger
language plpgsql security definer set search_path = public
as $$
declare s public.sublets;
begin
  if new.home_id is not distinct from old.home_id and new.house_sku is not distinct from old.house_sku then return null; end if;
  s := public.sublet_live(new.id);
  if s.id is not null and (new.home_id is null or s.host = new.id) then
    perform public.sublet_close(s.id, case when new.home_id is null then 'restart' else 'host_moved' end);
  end if;
  update public.sublet_apps a set status = 'closed', answered_at = now()
    from public.sublet_listings l where l.host = new.id and l.status = 'open' and a.listing_id = l.id and a.status = 'pending';
  update public.sublet_listings set status = 'closed', closed_at = now() where host = new.id and status = 'open';
  if new.home_id is null then
    update public.sublet_apps set status = 'withdrawn', answered_at = now() where player_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
drop trigger if exists players_sublet_moves on public.players;
create trigger players_sublet_moves after update of home_id, house_sku on public.players
  for each row execute function public.players_sublet_moves();

-- Blocking ends a sublet between the two (deposit back) and closes applications between them.
create or replace function public.block_sublet_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
declare s public.sublets := public.sublet_live(new.blocker);
begin
  if s.id is not null and new.blocked in (s.host, s.sub) then perform public.sublet_close(s.id, 'blocked'); end if;
  update public.sublet_apps a set status = 'closed', answered_at = now()
    from public.sublet_listings l
   where a.listing_id = l.id and a.status = 'pending'
     and ((l.host = new.blocker and a.player_id = new.blocked) or (l.host = new.blocked and a.player_id = new.blocker));
  return new;
end;
$$;
drop trigger if exists blocks_sublet on public.blocks;
create trigger blocks_sublet after insert on public.blocks for each row execute function public.block_sublet_trigger();

-- ---------------------------------------------------------------------------
-- The player card: "🏠 Subletting from @host" / "🔑 Hosting @sub" unless that player hides it.
-- ---------------------------------------------------------------------------
create or replace function public.sublet_public(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('role', case when s.host = p_player then 'host' else 'sub' end, 'id', o.id, 'name', o.display_name)
    from public.sublets s
    join public.players o on o.id = case when s.host = p_player then s.sub else s.host end
   where (s.host = p_player or s.sub = p_player) and s.ended_at is null and o.banned_at is null
     and not (case when s.host = p_player then s.host_hidden else s.sub_hidden end)
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
    'partner', public.couple_public(p.id),
    'sublet', public.sublet_public(p.id))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Pushes: a new application (to the host) and an accepted one (to the subtenant).
-- ---------------------------------------------------------------------------
create or replace function public.push_on_sublet_app() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(l.host, 'sublet_app', 'sublet_app:' || new.id, '🔑 ' || public.push_name(new.player_id) || ' wants your spare room',
    new.weeks || ' week' || case when new.weeks = 1 then '' else 's' end || '. Have a look before someone weirder applies.', '/home?open=apartments', null, false)
    from public.sublet_listings l where l.id = new.listing_id;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_sublet_app on public.sublet_apps;
create trigger push_sublet_app after insert on public.sublet_apps for each row execute function public.push_on_sublet_app();

create or replace function public.push_on_sublet_start() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.push_enqueue(new.sub, 'sublet_accepted', 'sublet_accepted:' || new.id, '🏠 ' || public.push_name(new.host) || ' said yes',
    'The spare room is yours. Bring a towel and low expectations.', '/home?open=apartments', null, true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_sublet_start on public.sublets;
create trigger push_sublet_start after insert on public.sublets for each row execute function public.push_on_sublet_start();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.sublet_state()', 'public.sublet_home()', 'public.sublet_list(int, int, int, text)', 'public.sublet_unlist()',
    'public.sublet_answer(bigint, boolean)', 'public.sublet_notice(boolean)', 'public.sublet_apply(bigint, int, text)',
    'public.sublet_withdraw(bigint)', 'public.sublet_leave()', 'public.sublet_renew(int)', 'public.sublet_renew_answer(boolean)',
    'public.sublet_hang()', 'public.sublet_show(boolean)', 'public.sublet_rate(bigint, int)', 'public.sublet_seen(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.sublet_live(uuid)', 'public.sublet_rating(uuid)', 'public.sublet_bounds(text)', 'public.sublet_close(bigint, text)',
    'public.sublet_settle(bigint)', 'public.sublet_settle_all()', 'public.sublet_host_block(uuid)',
    'public.sublet_visible(uuid, public.sublet_listings)', 'public.sublet_person(uuid)', 'public.sublet_public(uuid)',
    'public.bills_sublet_hold()', 'public.players_sublet_moves()', 'public.block_sublet_trigger()',
    'public.push_on_sublet_app()', 'public.push_on_sublet_start()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
grant execute on function public.sublet_settle_all() to service_role;
