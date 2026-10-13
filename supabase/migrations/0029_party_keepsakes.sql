-- v0.9 step 1 (docs/testing-feedback.md #19; owner Oct 13): exclusive event keepsakes.
-- * A plus-one: a ticket holder brings one person from their crew, free. The guest goes on the list
--   (no ticket clout), gets the same Mood and Confidence, an event card and the badge. One per ticket.
-- * A profile badge per party attended (player_badges, id 'party:<event>').
-- * A personal News mention, "Spotted at X: you, Marco and 14 others", naming only crew and
--   plus-ones, and nobody who switched on "Keep me out of the gossip".
-- * Attending gives what a club event gives: +8 Mood and +8 Confidence. The ticket's clout stays.

-- Attending's stats in line with club events.
update public.exclusive_events set mood = 8, confidence = 8;

-- "Keep me out of the gossip": no name in anyone's News mentions, and no mentions of your own.
alter table public.players add column news_opt_out boolean not null default false;

create function public.set_news_opt_out(p_out boolean) returns void
language sql security definer set search_path = public
as $$ update public.players set news_opt_out = coalesce(p_out, false) where id = auth.uid(); $$;

-- One plus-one per ticket, and a player is someone's plus-one at most once per party.
create table public.party_plus_ones (
  event_id     text not null references public.exclusive_events (id) on delete cascade,
  host         uuid not null references public.players (id) on delete cascade,
  guest        uuid not null references public.players (id) on delete cascade,
  status       text not null default 'invited' check (status in ('invited', 'in', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (event_id, host),
  unique (event_id, guest),
  check (host <> guest)
);
alter table public.party_plus_ones enable row level security;
create policy "own plus-ones" on public.party_plus_ones for select to authenticated using (auth.uid() in (host, guest));

/** On the list for a party: a ticket, or an accepted plus-one whose host still holds theirs. */
create function public.on_party_list(p_player uuid, p_event text) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.exclusive_events e where e.id = p_event and public.has_entitlement(p_player, e.sku))
      or exists (select 1 from public.party_plus_ones x join public.exclusive_events e on e.id = x.event_id
                  where x.event_id = p_event and x.guest = p_player and x.status = 'in' and public.has_entitlement(x.host, e.sku));
$$;

/** Invite one crew member as your plus-one. A declined invite can go to someone else. */
create function public.party_invite(p_event text, p_guest uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.exclusive_events;
begin
  select * into ev from public.exclusive_events where id = p_event;
  if ev.id is null then raise exception 'unknown_event' using errcode = '22023'; end if;
  if not public.has_entitlement(uid, ev.sku) then raise exception 'not_on_list' using errcode = '22023'; end if;
  if public.game_now() >= ev.ends_at then raise exception 'party_over' using errcode = '22023'; end if;
  if p_guest is null or p_guest not in (select id from public.crew_of(uid)) then raise exception 'not_in_crew' using errcode = '22023'; end if;
  if public.on_party_list(p_guest, p_event)
     or exists (select 1 from public.party_plus_ones where event_id = p_event and guest = p_guest and status <> 'declined') then
    raise exception 'already_on_list' using errcode = '22023';
  end if;
  if exists (select 1 from public.party_plus_ones where event_id = p_event and host = uid and status <> 'declined') then
    raise exception 'plus_one_taken' using errcode = '22023';
  end if;
  delete from public.party_plus_ones where event_id = p_event and (host = uid or guest = p_guest) and status = 'declined';
  insert into public.party_plus_ones (event_id, host, guest) values (p_event, uid, p_guest);
  return jsonb_build_object('event', p_event, 'guest', p_guest, 'status', 'invited');
end;
$$;

/** The guest says yes or no. */
create function public.party_respond(p_event text, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if exists (select 1 from public.exclusive_events where id = p_event and public.game_now() >= ends_at) then
    raise exception 'party_over' using errcode = '22023';
  end if;
  update public.party_plus_ones set status = case when p_yes then 'in' else 'declined' end, responded_at = now()
   where event_id = p_event and guest = uid and status = 'invited';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'no_invite' using errcode = '22023'; end if;
  return jsonb_build_object('event', p_event, 'status', case when p_yes then 'in' else 'declined' end);
end;
$$;

/** Plus-ones for parties that haven't ended (the one I sent per ticket, and the ones sent to me), and
    my gossip setting (read here so the game still loads before this migration runs). */
create function public.party_inbox() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'newsOptOut', coalesce((select news_opt_out from public.players where id = auth.uid()), false),
    'plusOnes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'eventId', x.event_id, 'eventName', e.name, 'placeId', e.place_id, 'startsAt', e.starts_at, 'endsAt', e.ends_at,
               'mine', x.host = auth.uid(), 'status', x.status,
               'host', jsonb_build_object('id', h.id, 'name', h.display_name, 'style', h.starting_style),
               'guest', jsonb_build_object('id', g.id, 'name', g.display_name, 'style', g.starting_style))
             order by e.starts_at)
        from public.party_plus_ones x
        join public.exclusive_events e on e.id = x.event_id
        join public.players h on h.id = x.host
        join public.players g on g.id = x.guest
       where auth.uid() in (x.host, x.guest) and e.ends_at > public.game_now()
         -- A guest whose host was refunded is off the list; the host's own rows stay visible.
         and (x.host = auth.uid() or public.has_entitlement(x.host, e.sku))), '[]'));
$$;

/** "Spotted at": parties I went to in the last two weeks, who else was there (names only for crew
    and plus-ones who haven't opted out) and how many in all. Nothing for players who opted out. */
create function public.party_mentions() returns jsonb
language sql stable security definer set search_path = public
as $$
  with me as (select id, news_opt_out from public.players where id = auth.uid()),
  went as (
    select distinct e.id, e.name, e.place_id, e.ends_at
      from public.event_attendance a join public.exclusive_events e on e.id = a.event_id
     where a.player_id = auth.uid() and e.ends_at > public.game_now() - interval '14 days'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'eventId', w.id, 'eventName', w.name, 'placeId', w.place_id, 'endsAt', w.ends_at,
           'total', (select count(distinct a.player_id) from public.event_attendance a where a.event_id = w.id),
           'names', coalesce((
             select jsonb_agg(n.display_name order by n.pref, n.display_name) from (
               select distinct p.display_name,
                      case when exists (select 1 from public.party_plus_ones x where x.event_id = w.id and x.status = 'in'
                                          and ((x.host = auth.uid() and x.guest = p.id) or (x.guest = auth.uid() and x.host = p.id)))
                           then 0 else 1 end as pref
                 from public.event_attendance a join public.players p on p.id = a.player_id
                where a.event_id = w.id and p.id <> auth.uid() and not p.news_opt_out and p.banned_at is null
                  and (p.id in (select id from public.crew_of(auth.uid()))
                       or exists (select 1 from public.party_plus_ones x where x.event_id = w.id and x.status = 'in'
                                    and auth.uid() in (x.host, x.guest) and p.id in (x.host, x.guest)))
                order by 2, 1 limit 2) n), '[]'))
         order by w.ends_at desc), '[]')
    from went w, me
   where not me.news_opt_out;
$$;

-- Going to the party: a ticket or an accepted plus-one; the badge comes with it.
create or replace function public.attend_exclusive_event(p_event text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.exclusive_events;
  me public.players;
  now_ timestamptz := public.game_now();
begin
  select * into ev from public.exclusive_events where id = p_event;
  if ev.id is null then raise exception 'unknown_event' using errcode = '22023'; end if;
  if not public.on_party_list(uid, ev.id) then raise exception 'not_on_list' using errcode = '22023'; end if;
  if now_ < ev.starts_at or now_ >= ev.ends_at then raise exception 'doors_closed' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.energy < ev.energy then raise exception 'no_energy' using errcode = '22023'; end if;
  -- Once per party, even though it runs past midnight.
  if exists (select 1 from public.event_attendance where player_id = uid and event_id = ev.id) then
    raise exception 'already_attended' using errcode = '22023';
  end if;
  insert into public.event_attendance (player_id, event_id, ny_date) values (uid, ev.id, public.ny_today());
  update public.players
     set energy = greatest(0, energy - ev.energy), mood = least(100, mood + ev.mood), confidence = least(100, confidence + ev.confidence)
   where id = uid;
  insert into public.player_badges (player_id, badge_id, arc_id) values (uid, 'party:' || ev.id, 'party') on conflict do nothing;
  return jsonb_build_object('energy', -ev.energy, 'mood', ev.mood, 'confidence', ev.confidence, 'badge', 'party:' || ev.id);
end;
$$;

-- The catalog marks parties a player is a plus-one for, and keeps them as event cards after they end.
create or replace function public.store_catalog()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', p.sku, 'type', p.product_type, 'name', p.name, 'priceCents', p.price_cents, 'currency', p.currency,
    'parent', p.parent_arc_id, 'placeId', p.place_id,
    'owned', public.has_entitlement(auth.uid(), p.sku),
    -- v0.7 Collection: the copy's number (1 = the first player to collect it, refunds keep their
    -- number so nobody's changes) and when it was collected.
    'serial', (select 1 + (select count(*) from public.entitlements o
                            where o.sku = p.sku and (o.created_at, o.player_id) < (me.created_at, me.player_id))
                 from public.entitlements me where me.player_id = auth.uid() and me.sku = p.sku and me.status = 'active'),
    'ownedAt', (select me.created_at from public.entitlements me where me.player_id = auth.uid() and me.sku = p.sku and me.status = 'active'),
    'pending', exists (select 1 from public.purchases u where u.player_id = auth.uid() and u.sku = p.sku and u.status = 'pending'
                         and u.created_at > now() - interval '1 hour'),
    -- Postcards: offered once the player has visited the monument.
    'visited', case when p.product_type = 'postcard'
                    then exists (select 1 from public.place_visits v where v.player_id = auth.uid() and v.place_id = p.place_id) end,
    'value', case when p.product_type = 'collector_item'
                  then public.collector_value((select i ->> 'category' from jsonb_array_elements(public.city() -> 'shop') i where i ->> 'sku' = p.sku)) end,
    'event', (select jsonb_build_object('id', e.id, 'placeId', e.place_id, 'name', e.name, 'host', e.host, 'blurb', e.blurb,
                                        'startsAt', e.starts_at, 'endsAt', e.ends_at, 'clout', e.clout, 'energy', e.energy,
                                        'mood', e.mood, 'confidence', e.confidence,
                                        'attended', exists (select 1 from public.event_attendance a
                                                             where a.player_id = auth.uid() and a.event_id = e.id),
                                        -- v0.9: on the list as someone's plus-one (their name), not a ticket of your own.
                                        'plusOneOf', (select h.display_name from public.party_plus_ones x join public.players h on h.id = x.host
                                                       where x.event_id = e.id and x.guest = auth.uid() and x.status = 'in'
                                                         and public.has_entitlement(x.host, e.sku)))
                from public.exclusive_events e where e.sku = p.sku)
  ) order by p.sku), '[]')
  from public.store_products p
  where p.active
    -- Parties that have ended leave the list, except for players who were on it (a ticket or a
    -- plus-one): those stay as event cards in their Collection.
    and (not exists (select 1 from public.exclusive_events e where e.sku = p.sku and e.ends_at <= public.game_now())
         or public.has_entitlement(auth.uid(), p.sku)
         or exists (select 1 from public.exclusive_events e where e.sku = p.sku and public.on_party_list(auth.uid(), e.id)));
$$;

revoke all on function public.on_party_list(uuid, text) from public, anon, authenticated;
revoke all on function public.set_news_opt_out(boolean) from public, anon;
grant execute on function public.set_news_opt_out(boolean) to authenticated;
revoke all on function public.party_invite(text, uuid) from public, anon;
grant execute on function public.party_invite(text, uuid) to authenticated;
revoke all on function public.party_respond(text, boolean) from public, anon;
grant execute on function public.party_respond(text, boolean) to authenticated;
revoke all on function public.party_inbox() from public, anon;
grant execute on function public.party_inbox() to authenticated;
revoke all on function public.party_mentions() from public, anon;
grant execute on function public.party_mentions() to authenticated;
