-- Having people over (owner, Oct 26: the "crew home visits" brought forward; "Invite people over should be part of the
-- actions in the mood HUD"; spec section 27). A player invites people to their home for a hangout (now, an hour) or a
-- house party (from now up to 12 hours ahead, two hours, snacks bought up front).
--
--   * Who: crew, a partner, and anyone the host has a chat with, if they take messages from the host (may_reach).
--   * How many: by home (room share and dorms 2, studio 3, Jackson Heights 4, Sunnyside 5, LIC 6, an owned house 8).
--   * Limits: one visit at a time, 3 hangouts and 1 party a New York day; not while subletting someone else's room.
--   * Guests answer (visit_answer), then go (visit_arrive) inside the window; they see the host's home and everyone
--     there, and chat (visit_say). visit_room() is the room's poll: it keeps presence fresh and pays what's due.
--   * Rewards: a guest present for 2 minutes gets clout and Mood once (ledger 'visit_guest'); the host gets clout for
--     each such guest, multiplied by the home's Crib Rating at the start (× (1 + rating / 100), ledger 'visit_host'),
--     and a little Mood (up to 30 a visit). A partner's visit counts toward the couple streak.
--   * Safety: guests can't touch anything; the host sends anyone home (visit_send_home) or ends it (visit_end);
--     blocking removes a guest at once.

insert into public.game_settings (key, value) values ('visits', '{"capacity":{"astoria_share":2,"sj_dorm":2,"qu_dorm":2,"astoria_studio":3,"jackson_heights_1br":4,"sunnyside_gardens":5,"lic_highrise":6},"houseCapacity":8,"kinds":{"hang":{"minutes":60,"perDay":3,"guestClout":10,"guestMood":8,"hostClout":8,"hostMood":4},"party":{"minutes":120,"perDay":1,"guestClout":25,"guestMood":15,"hostClout":20,"hostMood":6,"snacksBase":40,"snacksPerGuest":20,"leadHours":12}},"stayMinutes":2,"presenceMinutes":3,"hostMoodMax":30,"chatMax":200}'::jsonb)
on conflict (key) do update set value = excluded.value;

create table if not exists public.visits (
  id           bigint generated always as identity primary key,
  host         uuid not null references public.players (id) on delete cascade,
  kind         text not null check (kind in ('hang', 'party')),
  home_id      text not null,
  house_sku    text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  capacity     int not null,
  crib         int not null default 0,
  snacks       int not null default 0,
  ny_date      date not null,
  ended        boolean not null default false,
  host_seen_at timestamptz,
  host_mood    int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists visits_host_idx on public.visits (host, ends_at);

create table if not exists public.visit_guests (
  visit_id    bigint not null references public.visits (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  status      text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'left', 'sent_home')),
  invited_at  timestamptz not null default now(),
  answered_at timestamptz,
  arrived_at  timestamptz,
  seen_at     timestamptz,
  paid_at     timestamptz,
  primary key (visit_id, player_id)
);
create index if not exists visit_guests_player_idx on public.visit_guests (player_id, status);

create table if not exists public.visit_messages (
  id         bigint generated always as identity primary key,
  visit_id   bigint not null references public.visits (id) on delete cascade,
  sender     uuid not null references public.players (id) on delete cascade,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists visit_messages_visit_idx on public.visit_messages (visit_id, id);

alter table public.visits enable row level security;
alter table public.visit_guests enable row level security;
alter table public.visit_messages enable row level security;
revoke all on public.visits, public.visit_guests, public.visit_messages from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** How many guests a player's home holds. */
create or replace function public.visit_capacity(p_player uuid) returns int
language sql stable security definer set search_path = public
as $$
  select case when p.house_sku is not null then (s.v ->> 'houseCapacity')::int else coalesce((s.v -> 'capacity' ->> p.home_id)::int, 2) end
    from public.players p, (select public.game_settings_value('visits') v) s where p.id = p_player
$$;

/** The host's visit going on or coming up (not ended, not over). */
create or replace function public.visit_current(p_host uuid) returns public.visits
language sql stable security definer set search_path = public
as $$ select * from public.visits where host = p_host and not ended and ends_at > now() order by starts_at limit 1 $$;

/** Who a host may invite: crew, a partner, anyone they have a chat with; never blocked, and only if they take messages. */
create or replace function public.visit_invitable(p_host uuid) returns table (id uuid)
language sql stable security definer set search_path = public
as $$
  select distinct x.id from (
    select c.id from public.crew_of(p_host) c
    union select public.couple_partner(p_host)
    union select case when v.a = p_host then v.b else v.a end from public.conversations v where p_host in (v.a, v.b)
  ) x
  join public.players p on p.id = x.id and p.banned_at is null and p.home_id is not null
  where x.id is not null and x.id <> p_host and public.may_reach(p_host, x.id)
$$;

/** A guest is in the room: arrived, still there, and seen in the last few minutes. */
create or replace function public.visit_present(g public.visit_guests) returns boolean
language sql stable security definer set search_path = public
as $$
  select g.status = 'accepted' and g.arrived_at is not null
     and g.seen_at > now() - make_interval(mins => (public.game_settings_value('visits') ->> 'presenceMinutes')::int)
$$;

create or replace function public.visit_person(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$ select jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style, 'look', p.look) from public.players p where p.id = p_player $$;

/**
 * Pays every guest who has been in the room for the stay time, once: the guest's clout and Mood, the host's clout ×
 * (1 + Crib Rating / 100) and a little Mood (capped per visit), and a partner's couple day.
 */
create or replace function public.visit_settle(p_visit bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v public.visits;
  cfg jsonb := public.game_settings_value('visits');
  k jsonb;
  g public.visit_guests;
  host_c int;
  add_mood int;
  rel public.relationships;
begin
  select * into v from public.visits where id = p_visit for update;
  if v.id is null or now() < v.starts_at then return; end if;
  k := cfg -> 'kinds' -> v.kind;
  host_c := round((k ->> 'hostClout')::int * (1 + v.crib / 100.0))::int;
  for g in select * from public.visit_guests where visit_id = v.id and paid_at is null and status in ('accepted', 'left')
             and arrived_at is not null and arrived_at < v.ends_at for update loop
    -- Stayed: seen in the room at least the stay time after arriving.
    if g.seen_at < g.arrived_at + make_interval(mins => (cfg ->> 'stayMinutes')::int) then continue; end if;
    update public.visit_guests set paid_at = now() where visit_id = v.id and player_id = g.player_id;
    if public.ledger_once(g.player_id, 'clout', (k ->> 'guestClout')::int, 'visit_guest', v.id::text) then
      update public.players set clout = clout + (k ->> 'guestClout')::int, mood = least(100, mood + (k ->> 'guestMood')::int)
       where id = g.player_id;
    end if;
    if public.ledger_once(v.host, 'clout', host_c, 'visit_host', v.id || ':' || g.player_id) then
      add_mood := greatest(0, least((k ->> 'hostMood')::int, (cfg ->> 'hostMoodMax')::int - v.host_mood));
      update public.players set clout = clout + host_c, mood = least(100, mood + add_mood) where id = v.host;
      if add_mood > 0 then
        update public.visits set host_mood = host_mood + add_mood where id = v.id;
        v.host_mood := v.host_mood + add_mood;
      end if;
    end if;
    rel := public.couple_rel(v.host);
    if rel.id is not null and g.player_id in (rel.a, rel.b) then
      insert into public.couple_days (rel_id, ny_date) values (rel.id, public.ny_today()) on conflict do nothing;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- What the screens show
-- ---------------------------------------------------------------------------
/** Hosting (my visit and its guests), the invites I've had, who I can invite, and the limits. */
create or replace function public.visit_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('visits');
  me public.players;
  v public.visits;
  today date := public.ny_today();
  cap int;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  v := public.visit_current(uid);
  if v.id is not null then perform public.visit_settle(v.id); end if;
  cap := public.visit_capacity(uid);
  return jsonb_build_object(
    'hosting', case when v.id is not null then jsonb_build_object(
      'id', v.id, 'kind', v.kind, 'starts', v.starts_at, 'ends', v.ends_at, 'capacity', v.capacity, 'crib', v.crib,
      'guests', coalesce((select jsonb_agg(public.visit_person(g.player_id) || jsonb_build_object('status', g.status,
                            'here', public.visit_present(g), 'paid', g.paid_at is not null) order by g.invited_at)
                          from public.visit_guests g where g.visit_id = v.id), '[]'::jsonb)) end,
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'starts', x.starts_at, 'ends', x.ends_at,
                            'host', public.visit_person(x.host), 'status', g.status, 'capacity', x.capacity,
                            'going', (select count(*) from public.visit_guests o where o.visit_id = x.id and o.status = 'accepted'))
                          order by x.starts_at)
                        from public.visit_guests g join public.visits x on x.id = g.visit_id
                        where g.player_id = uid and g.status in ('invited', 'accepted') and not x.ended and x.ends_at > now()
                          and not public.is_blocked_pair(uid, x.host)), '[]'::jsonb),
    'invitable', coalesce((select jsonb_agg(public.visit_person(i.id) || jsonb_build_object(
                             'crew', i.id in (select c.id from public.crew_of(uid) c),
                             'partner', i.id = public.couple_partner(uid)))
                           from (select id from public.visit_invitable(uid) limit 60) i), '[]'::jsonb),
    'capacity', cap,
    'snacks', (cfg -> 'kinds' -> 'party' ->> 'snacksBase')::int + (cfg -> 'kinds' -> 'party' ->> 'snacksPerGuest')::int * cap,
    'left', jsonb_build_object(
      'hang', greatest(0, (cfg -> 'kinds' -> 'hang' ->> 'perDay')::int - (select count(*) from public.visits where host = uid and ny_date = today and kind = 'hang')),
      'party', greatest(0, (cfg -> 'kinds' -> 'party' ->> 'perDay')::int - (select count(*) from public.visits where host = uid and ny_date = today and kind = 'party'))),
    'blocked', case when (public.sublet_live(uid)).sub = uid then 'subletting' end,
    'crib', coalesce((public.home_score(uid) ->> 'score')::int, 0));
end;
$$;

/** The host's home, for everyone in the visit (like sublet_home). */
create or replace function public.visit_home(p_visit bigint) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v public.visits;
  p public.players;
begin
  select * into v from public.visits where id = p_visit;
  if v.id is null or not (v.host = auth.uid() or exists (select 1 from public.visit_guests where visit_id = v.id and player_id = auth.uid() and status = 'accepted')) then
    raise exception 'not_invited' using errcode = '22023';
  end if;
  select * into p from public.players where id = v.host;
  return jsonb_build_object('id', v.id, 'host', p.id, 'hostName', p.display_name, 'homeId', p.home_id, 'houseSku', p.house_sku,
    'layout', p.home_layout,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'sku', i.sku) order by i.id)
                         from public.player_items i where i.player_id = p.id and i.category = 'home'), '[]'::jsonb));
end;
$$;

/** The room's poll: keeps me present, pays what's due, and returns who's here and the chat after a message id. */
create or replace function public.visit_room(p_visit bigint, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.visits;
  g public.visit_guests;
  host_here boolean;
begin
  select * into v from public.visits where id = p_visit;
  if v.id is null then raise exception 'not_invited' using errcode = '22023'; end if;
  if v.host = uid then
    update public.visits set host_seen_at = now() where id = v.id;
  else
    select * into g from public.visit_guests where visit_id = v.id and player_id = uid;
    if g.player_id is null or g.status not in ('accepted', 'sent_home', 'left') then raise exception 'not_invited' using errcode = '22023'; end if;
    if g.status = 'accepted' and g.arrived_at is not null and now() < v.ends_at and not v.ended then
      update public.visit_guests set seen_at = now() where visit_id = v.id and player_id = uid;
    end if;
  end if;
  perform public.visit_settle(v.id);
  select * into v from public.visits where id = p_visit;
  select * into g from public.visit_guests where visit_id = v.id and player_id = uid;
  host_here := v.host_seen_at > now() - make_interval(mins => (public.game_settings_value('visits') ->> 'presenceMinutes')::int);
  return jsonb_build_object(
    'id', v.id, 'kind', v.kind, 'starts', v.starts_at, 'ends', v.ends_at, 'over', v.ended or now() >= v.ends_at,
    'host', public.visit_person(v.host), 'mine', v.host = uid, 'crib', v.crib,
    'me', case when v.host <> uid then jsonb_build_object('status', g.status, 'paid', g.paid_at is not null) end,
    'people', coalesce((select jsonb_agg(x.p) from (
        select public.visit_person(v.host) || jsonb_build_object('host', true) p where host_here and v.host <> uid
        union all
        select public.visit_person(o.player_id) || jsonb_build_object('host', false) from public.visit_guests o
         where o.visit_id = v.id and o.player_id <> uid and public.visit_present(o)
           and not public.is_blocked_pair(uid, o.player_id)) x), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'name', p.display_name, 'body', m.body,
                            'at', m.created_at, 'mine', m.sender = uid) order by m.id)
                          from public.visit_messages m join public.players p on p.id = m.sender
                         where m.visit_id = v.id and m.id > p_after and not m.hidden and not public.is_blocked_pair(uid, m.sender)), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Hosting
-- ---------------------------------------------------------------------------
create or replace function public.visit_host(p_kind text, p_guests uuid[], p_starts_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('visits');
  k jsonb := cfg -> 'kinds' -> p_kind;
  me public.players;
  starts timestamptz := coalesce(p_starts_at, now());
  cap int;
  snacks int := 0;
  vid bigint;
  g uuid;
begin
  if k is null then raise exception 'bad_kind' using errcode = '22023'; end if;
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if (public.sublet_live(uid)).sub = uid then raise exception 'subletting' using errcode = '22023'; end if;
  if (public.visit_current(uid)).id is not null then raise exception 'already_hosting' using errcode = '22023'; end if;
  if (select count(*) from public.visits where host = uid and ny_date = public.ny_today() and kind = p_kind) >= (k ->> 'perDay')::int then
    raise exception 'daily_limit' using errcode = '22023';
  end if;
  if p_kind = 'hang' then starts := now(); end if;
  if starts < now() - interval '1 minute' or starts > now() + make_interval(hours => coalesce((k ->> 'leadHours')::int, 0)) then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  if starts < now() then starts := now(); end if;
  p_guests := array(select distinct x from unnest(coalesce(p_guests, '{}')) x where x is not null and x <> uid);
  cap := public.visit_capacity(uid);
  if cardinality(p_guests) = 0 then raise exception 'no_guests' using errcode = '22023'; end if;
  if cardinality(p_guests) > cap then raise exception 'too_many' using errcode = '22023'; end if;
  foreach g in array p_guests loop
    if not exists (select 1 from public.visit_invitable(uid) i where i.id = g) then raise exception 'cant_invite' using errcode = '22023'; end if;
  end loop;
  if p_kind = 'party' then
    snacks := (k ->> 'snacksBase')::int + (k ->> 'snacksPerGuest')::int * cap;
    if me.bank_cash < snacks then raise exception 'cant_afford' using errcode = '22023'; end if;
  end if;
  insert into public.visits (host, kind, home_id, house_sku, starts_at, ends_at, capacity, crib, snacks, ny_date)
  values (uid, p_kind, me.home_id, me.house_sku, starts, starts + make_interval(mins => (k ->> 'minutes')::int), cap,
          coalesce((public.home_score(uid) ->> 'score')::int, 0), snacks, public.ny_today())
  returning id into vid;
  if snacks > 0 then
    update public.players set bank_cash = bank_cash - snacks where id = uid;
    perform public.ledger_once(uid, 'cash', -snacks, 'visit_snacks', vid::text);
  end if;
  insert into public.visit_guests (visit_id, player_id) select vid, x from unnest(p_guests) x;
  return public.visit_state();
end;
$$;

/** The host ends it now (an upcoming party is called off: the snacks are kept, like real life). */
create or replace function public.visit_end() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v public.visits := public.visit_current(auth.uid());
begin
  if v.id is null then raise exception 'not_hosting' using errcode = '22023'; end if;
  perform public.visit_settle(v.id);
  update public.visits set ended = true, ends_at = least(ends_at, now()) where id = v.id;
  return public.visit_state();
end;
$$;

create or replace function public.visit_send_home(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v public.visits := public.visit_current(auth.uid());
begin
  if v.id is null then raise exception 'not_hosting' using errcode = '22023'; end if;
  update public.visit_guests set status = 'sent_home', answered_at = coalesce(answered_at, now())
   where visit_id = v.id and player_id = p_player and status in ('invited', 'accepted');
  return public.visit_state();
end;
$$;

-- ---------------------------------------------------------------------------
-- Guests
-- ---------------------------------------------------------------------------
create or replace function public.visit_answer(p_visit bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if v.id is null or v.ended or now() >= v.ends_at then raise exception 'visit_over' using errcode = '22023'; end if;
  update public.visit_guests set status = case when p_yes then 'accepted' else 'declined' end, answered_at = now()
   where visit_id = v.id and player_id = auth.uid() and status in ('invited', 'accepted');
  if not found then raise exception 'not_invited' using errcode = '22023'; end if;
  return public.visit_state();
end;
$$;

/** Going in: inside the window, while there's room. Saying yes is implied. */
create or replace function public.visit_arrive(p_visit bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.visits;
  g public.visit_guests;
begin
  select * into v from public.visits where id = p_visit for update;
  if v.id is null or v.ended or now() >= v.ends_at then raise exception 'visit_over' using errcode = '22023'; end if;
  if now() < v.starts_at then raise exception 'not_started' using errcode = '22023'; end if;
  select * into g from public.visit_guests where visit_id = v.id and player_id = uid for update;
  if g.player_id is null or g.status in ('declined', 'sent_home') or public.is_blocked_pair(uid, v.host) then
    raise exception 'not_invited' using errcode = '22023';
  end if;
  if (select count(*) from public.visit_guests o where o.visit_id = v.id and o.player_id <> uid and public.visit_present(o)) >= v.capacity then
    raise exception 'full' using errcode = '22023';
  end if;
  update public.visit_guests set status = 'accepted', answered_at = coalesce(answered_at, now()),
         arrived_at = coalesce(arrived_at, now()), seen_at = now()
   where visit_id = v.id and player_id = uid;
  return public.visit_room(v.id, 0);
end;
$$;

create or replace function public.visit_leave(p_visit bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.visit_settle(p_visit);
  update public.visit_guests set status = 'left' where visit_id = p_visit and player_id = auth.uid() and status = 'accepted';
  return public.visit_state();
end;
$$;

create or replace function public.visit_say(p_visit bigint, p_body text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.visits;
  body text := btrim(coalesce(p_body, ''));
  mid bigint;
begin
  select * into v from public.visits where id = p_visit;
  if v.id is null or v.ended or now() >= v.ends_at then raise exception 'visit_over' using errcode = '22023'; end if;
  if not (v.host = uid or exists (select 1 from public.visit_guests g where g.visit_id = v.id and g.player_id = uid and public.visit_present(g))) then
    raise exception 'not_here' using errcode = '22023';
  end if;
  if body = '' then raise exception 'empty' using errcode = '22023'; end if;
  if length(body) > (public.game_settings_value('visits') ->> 'chatMax')::int then raise exception 'too_long' using errcode = '22023'; end if;
  if exists (select 1 from public.players where id = uid and (banned_at is not null or chat_muted_until > now())) then
    raise exception 'muted' using errcode = '22023';
  end if;
  if exists (select 1 from public.visit_messages where sender = uid and created_at > clock_timestamp() - interval '2 seconds') then
    raise exception 'too_fast' using errcode = '22023';
  end if;
  insert into public.visit_messages (visit_id, sender, body) values (v.id, uid, body) returning id into mid;
  return jsonb_build_object('id', mid, 'from', uid, 'name', (select display_name from public.players where id = uid), 'body', body,
                            'at', clock_timestamp(), 'mine', true);
end;
$$;

/** The host hides a message in their home's chat. */
create or replace function public.visit_hide(p_message bigint) returns void
language sql security definer set search_path = public
as $$
  update public.visit_messages m set hidden = true from public.visits v where m.id = p_message and v.id = m.visit_id and v.host = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Triggers: blocks and pushes
-- ---------------------------------------------------------------------------
create or replace function public.block_visit_trigger() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.visit_guests g set status = 'sent_home'
    from public.visits v
   where g.visit_id = v.id and not v.ended and v.ends_at > now() and g.status in ('invited', 'accepted')
     and ((v.host = new.blocker and g.player_id = new.blocked) or (v.host = new.blocked and g.player_id = new.blocker));
  return new;
end;
$$;
drop trigger if exists blocks_visit on public.blocks;
create trigger blocks_visit after insert on public.blocks for each row execute function public.block_visit_trigger();

create or replace function public.push_on_visit_invite() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v public.visits;
begin
  select * into v from public.visits where id = new.visit_id;
  perform public.push_enqueue(new.player_id, 'visit_invite', 'visit_invite:' || new.visit_id,
    case v.kind when 'party' then '🎉 ' || public.push_name(v.host) || ' is having a house party'
                else '🏠 ' || public.push_name(v.host) || ' says come over' end,
    case v.kind when 'party' then 'Snacks are bought. Bring yourself and a good attitude.'
                else 'An hour, their place, no dress code. Mostly.' end,
    '/home?open=plans', v.ends_at, true);
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists push_visit_invite on public.visit_guests;
create trigger push_visit_invite after insert on public.visit_guests for each row execute function public.push_on_visit_invite();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.visit_state()', 'public.visit_home(bigint)', 'public.visit_room(bigint, bigint)', 'public.visit_host(text, uuid[], timestamptz)',
    'public.visit_end()', 'public.visit_send_home(uuid)', 'public.visit_answer(bigint, boolean)', 'public.visit_arrive(bigint)',
    'public.visit_leave(bigint)', 'public.visit_say(bigint, text)', 'public.visit_hide(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.visit_capacity(uuid)', 'public.visit_current(uuid)', 'public.visit_invitable(uuid)', 'public.visit_present(public.visit_guests)',
    'public.visit_person(uuid)', 'public.visit_settle(bigint)', 'public.block_visit_trigger()', 'public.push_on_visit_invite()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
