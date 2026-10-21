-- Clout Couture on the map (owner, Oct 21: "go"; content/shop/clout-couture.json):
--   * The Astoria Yacht: every owner's yacht moors at the Astoria waterfront (Hell Gate) with their name on the hull;
--     tapping it opens their profile. The Clout One Jet flies over the city while its owner is in the game, trailing a
--     banner with their name. Decoration only: no travel effect.
--   * Names on the map go through the chat word filter, and the Studio can hide one (the edition number shows instead).
--   * The Plaza Statue: the owner books a week; their avatar, in gold, stands in the Unisphere plaza for that week with a
--     plaque, in the look they wore when they booked, then moves to their home (lib/city.ts CATALOG_FURNITURE). One
--     statue a week. The Studio can take a statue down (and refund it in Stripe, which takes the piece back).
--   * couture_map() is what the map draws; plaza_weeks() and plaza_book() are the booking.

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in ('ban', 'unban', 'creator_rate', 'creator_length', 'creator_status', 'creator_attribution', 'couture_name', 'plaza_remove'));

create table if not exists public.plaza_bookings (
  id                bigint generated always as identity primary key,
  week_start        date not null check (extract(isodow from week_start) = 1),
  player_id         uuid not null references public.players (id) on delete cascade,
  -- The purchase it belongs to (one booking per statue bought).
  stripe_session_id text not null,
  -- The avatar as it was when booked, and the Shop pieces it wore.
  look              jsonb not null default '{}',
  outfit            text[] not null default '{}',
  status            text not null default 'booked' check (status in ('booked', 'removed')),
  removed_reason    text,
  created_at        timestamptz not null default now()
);
create unique index if not exists plaza_bookings_week_idx on public.plaza_bookings (week_start) where status = 'booked';
create unique index if not exists plaza_bookings_session_idx on public.plaza_bookings (stripe_session_id) where status = 'booked';
alter table public.plaza_bookings enable row level security;
revoke all on public.plaza_bookings from anon, authenticated;

/** This New York week's Monday. */
create or replace function public.plaza_week_now() returns date
language sql stable as $$ select (public.ny_today() - (extract(isodow from public.ny_today())::int - 1)) $$;

/** A name as the map shows it: filtered, or the edition number when the Studio hid it. */
create or replace function public.couture_map_name(p_player uuid, p_sku text) returns text
language sql stable security definer set search_path = public
as $$
  select case when coalesce((i.options ->> 'nameHidden')::boolean, false)
              then 'No. ' || lpad(coalesce(e.edition_no, 0)::text, 4, '0')
              else public.chat_filter(p.display_name) end
    from public.players p
    left join public.player_items i on i.player_id = p.id and i.sku = p_sku
    left join public.entitlements e on e.player_id = p.id and e.sku = p_sku
   where p.id = p_player
$$;

/** What the map draws: moored yachts, jets in the air (owners in the game now) and this week's plaza statue. */
create or replace function public.couture_map() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'yachts', coalesce((select jsonb_agg(jsonb_build_object('player', e.player_id, 'name', public.couture_map_name(e.player_id, e.sku), 'edition', e.edition_no)
                                         order by e.edition_no nulls last, e.created_at)
                          from public.entitlements e join public.players p on p.id = e.player_id
                         where e.sku = 'astoria-yacht' and e.status = 'active' and p.banned_at is null), '[]'),
    'jets', coalesce((select jsonb_agg(jsonb_build_object('player', e.player_id, 'name', public.couture_map_name(e.player_id, e.sku), 'edition', e.edition_no)
                                       order by e.edition_no nulls last)
                        from public.entitlements e join public.players p on p.id = e.player_id
                       where e.sku = 'clout-one-jet' and e.status = 'active' and p.banned_at is null
                         and exists (select 1 from public.player_sessions s where s.player_id = e.player_id and s.last_seen > now() - interval '10 minutes')), '[]'),
    'statue', (select jsonb_build_object('player', b.player_id, 'name', public.chat_filter(p.display_name), 'week', b.week_start,
                                         'look', b.look, 'style', p.starting_style, 'outfit', to_jsonb(b.outfit))
                 from public.plaza_bookings b join public.players p on p.id = b.player_id
                where b.status = 'booked' and b.week_start = public.plaza_week_now() and p.banned_at is null),
    'myPlazaWeek', (select b.week_start from public.plaza_bookings b where b.player_id = auth.uid() and b.status = 'booked'
                     order by b.week_start desc limit 1))
$$;

/** The next 12 weeks for the plaza, and whether this player has a statue to book. */
create or replace function public.plaza_weeks() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'canBook', exists (select 1 from public.entitlements e where e.player_id = auth.uid() and e.sku = 'plaza-statue' and e.status = 'active'
                         and not exists (select 1 from public.plaza_bookings b where b.stripe_session_id = e.stripe_session_id and b.status = 'booked')),
    'mine', (select b.week_start from public.plaza_bookings b where b.player_id = auth.uid() and b.status = 'booked' order by b.week_start desc limit 1),
    'weeks', (select jsonb_agg(jsonb_build_object('week', w, 'taken', exists (select 1 from public.plaza_bookings b where b.week_start = w and b.status = 'booked'))
                               order by w)
                from generate_series(0, 11) as n, lateral (select public.plaza_week_now() + n * 7 as w) x))
$$;

/** Books a week for the player's statue, keeping the look they wear now. */
create or replace function public.plaza_book(p_week date) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.entitlements;
  me public.players;
begin
  select * into e from public.entitlements where player_id = uid and sku = 'plaza-statue' and status = 'active';
  if e.player_id is null then raise exception 'no_statue' using errcode = '22023'; end if;
  if exists (select 1 from public.plaza_bookings where stripe_session_id = e.stripe_session_id and status = 'booked') then
    raise exception 'already_booked' using errcode = '22023';
  end if;
  if p_week is null or extract(isodow from p_week) <> 1 or p_week < public.plaza_week_now() or p_week > public.plaza_week_now() + 77 then
    raise exception 'bad_week' using errcode = '22023';
  end if;
  if exists (select 1 from public.plaza_bookings where week_start = p_week and status = 'booked') then
    raise exception 'week_taken' using errcode = '22023';
  end if;
  select * into me from public.players where id = uid;
  insert into public.plaza_bookings (week_start, player_id, stripe_session_id, look, outfit)
  values (p_week, uid, e.stripe_session_id, me.look,
          coalesce(array(select i.sku from public.player_items i where i.player_id = uid and i.equipped and i.category = 'fashion' order by i.id), '{}'));
  return public.plaza_weeks();
end;
$$;

-- A refund takes the statue off the plaza (and out of the booking).
create or replace function public.plaza_on_revoke() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.sku = 'plaza-statue' and new.status = 'revoked' then
    update public.plaza_bookings set status = 'removed', removed_reason = 'refunded'
     where stripe_session_id = new.stripe_session_id and status = 'booked';
  end if;
  return new;
end;
$$;
drop trigger if exists entitlements_plaza_revoke on public.entitlements;
create trigger entitlements_plaza_revoke after update of status on public.entitlements
  for each row execute function public.plaza_on_revoke();

-- ---------------------------------------------------------------------------
-- The Studio
-- ---------------------------------------------------------------------------
/** A map piece's owners: their name as the map shows it, whether it is hidden, and the statue's week. */
create or replace function public.admin_couture_owners(p_sku text) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
            'player', e.player_id, 'displayName', p.display_name, 'shown', public.couture_map_name(e.player_id, e.sku),
            'edition', e.edition_no, 'hidden', coalesce((i.options ->> 'nameHidden')::boolean, false),
            'week', (select b.week_start from public.plaza_bookings b where b.stripe_session_id = e.stripe_session_id and b.status = 'booked'))
            order by e.edition_no nulls last)
     from public.entitlements e
     join public.players p on p.id = e.player_id
     left join public.player_items i on i.player_id = e.player_id and i.sku = e.sku
    where e.sku = p_sku and e.status = 'active'), '[]');
end;
$$;

/** Hides (or shows again) an owner's name on the yacht's hull or the jet's banner; the edition number shows instead. */
create or replace function public.admin_couture_name(p_player uuid, p_sku text, p_hidden boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  update public.player_items set options = options || jsonb_build_object('nameHidden', p_hidden)
   where player_id = p_player and sku = p_sku;
  if not found then raise exception 'unknown_item' using errcode = '22023'; end if;
  insert into public.admin_actions (admin_id, player_id, action, reason)
  values (auth.uid(), p_player, 'couture_name', left(coalesce(p_reason, case when p_hidden then 'name hidden on ' else 'name shown on ' end || p_sku), 300));
end;
$$;

/** Takes a statue off the plaza (its week frees up). A refund, if any, is made in Stripe. */
create or replace function public.admin_plaza_remove(p_week date, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.plaza_bookings;
begin
  perform public.require_story_admin();
  if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_needed' using errcode = '22023'; end if;
  update public.plaza_bookings set status = 'removed', removed_reason = left(p_reason, 300)
   where week_start = p_week and status = 'booked' returning * into b;
  if b.id is null then raise exception 'unknown_booking' using errcode = '22023'; end if;
  insert into public.admin_actions (admin_id, player_id, action, reason) values (auth.uid(), b.player_id, 'plaza_remove', left(p_reason, 300));
end;
$$;

-- The three map pieces work now (the Waterfront Mansion comes later).
update public.shop_catalog set wearable = true where not wearable and sku = any(array['astoria-yacht', 'clout-one-jet', 'plaza-statue']);

revoke all on function public.plaza_week_now() from public, anon;
grant execute on function public.plaza_week_now() to authenticated;
revoke all on function public.couture_map_name(uuid, text) from public, anon, authenticated;
revoke all on function public.plaza_on_revoke() from public, anon, authenticated;
revoke all on function public.couture_map() from public, anon;
grant execute on function public.couture_map() to authenticated;
revoke all on function public.plaza_weeks() from public, anon;
grant execute on function public.plaza_weeks() to authenticated;
revoke all on function public.plaza_book(date) from public, anon;
grant execute on function public.plaza_book(date) to authenticated;
revoke all on function public.admin_couture_owners(text) from public, anon;
grant execute on function public.admin_couture_owners(text) to authenticated;
revoke all on function public.admin_couture_name(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_couture_name(uuid, text, boolean, text) to authenticated;
revoke all on function public.admin_plaza_remove(date, text) from public, anon;
grant execute on function public.admin_plaza_remove(date, text) to authenticated;
