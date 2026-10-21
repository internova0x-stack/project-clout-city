-- Clout Couture (step 5 of the avatar and Shop upgrade, docs/shop-manager.md section 3; owner, Oct 21).
--   * Every real-money catalog piece has a store_products row (a collector item) once it is scheduled, live or retired,
--     so the existing Stripe checkout and webhook sell it, grant it and refund it.
--   * Numbered editions per drop: each copy's number is stored on its entitlement when the webhook grants it (the next
--     number for the piece; refunded copies keep theirs, so a number is never issued twice) and shown as its serial. A drop ends at drop_end (the first drop: edition_size); the
--     next drop continues the numbering (admin_couture_new_drop, only once the drop has sold out).
--   * Limits are real: start_purchase refuses a piece that isn't on sale ('not_for_sale') or whose drop is spoken for
--     ('sold_out': numbers issued plus checkouts open in the last 35 minutes; Stripe closes a checkout after 30).
--   * Owning any Couture piece earns the 'clout-couture' badge; a refund of the last one takes it back.
--   * Each new drop gets a Lola Lowdown News item.
--   * The first pieces work in the game: the suit and heels are worn like the catalog's clothes, the shades, watch and
--     crown like its accessories (filed as fashion though the Shop shows them in Luxury), the sofa and statue are home furniture (lib/city.ts CATALOG_FURNITURE), and the Velocity Veloce
--     is the player's car: like any owned car (one at a time; it ends a rental) and insured like the priciest C$ car, so
--     real money never buys an economic advantage. A refund takes it out of the garage.

alter table public.shop_catalog add column if not exists drop_no int not null default 1 check (drop_no >= 1);
alter table public.shop_catalog add column if not exists drop_end int check (drop_end > 0);

-- ---------------------------------------------------------------------------
-- Checkout products for real-money catalog pieces
-- ---------------------------------------------------------------------------
create or replace function public.shop_store_sync() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.real_cash and new.price_usd_cents is not null and new.status in ('scheduled', 'live', 'retired') then
    -- The price is set here once; later changes go through admin_shop_edit (a new Stripe Price for the next checkout).
    insert into public.store_products (sku, product_type, name, price_cents)
    values (new.sku, 'collector_item', new.name, new.price_usd_cents)
    on conflict (sku) do update set name = excluded.name, active = true, updated_at = now()
     where public.store_products.product_type = 'collector_item';
  end if;
  return new;
end;
$$;
drop trigger if exists shop_catalog_store_sync on public.shop_catalog;
create trigger shop_catalog_store_sync after insert or update of status, name, real_cash, price_usd_cents on public.shop_catalog
  for each row execute function public.shop_store_sync();
update public.shop_catalog set status = status where real_cash and price_usd_cents is not null and status in ('scheduled', 'live', 'retired');

-- ---------------------------------------------------------------------------
-- Editions
-- ---------------------------------------------------------------------------
alter table public.entitlements add column if not exists edition_no int check (edition_no > 0);
create unique index if not exists entitlements_edition_idx on public.entitlements (sku, edition_no) where edition_no is not null;

/** A numbered piece's next copy takes the next number (a regrant after a refund keeps the row, and its number). */
create or replace function public.couture_number() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.product_type = 'collector_item'
     and exists (select 1 from public.shop_catalog c where c.sku = new.sku and c.edition_size is not null for update) then
    new.edition_no := coalesce((select max(edition_no) from public.entitlements where sku = new.sku), 0) + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists entitlements_couture_number on public.entitlements;
create trigger entitlements_couture_number before insert on public.entitlements
  for each row execute function public.couture_number();

/** A numbered piece's edition: its size per drop, the drop, the last number in it, numbers issued and what's left. */
create or replace function public.couture_edition(p_sku text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when c.edition_size is null then null else (
    with n as (
      select (select count(*) from public.entitlements e where e.sku = c.sku)::int as issued,
             (select count(*) from public.purchases u
               where u.sku = c.sku and u.status = 'pending' and u.created_at > now() - interval '35 minutes'
                 and not exists (select 1 from public.entitlements e where e.sku = u.sku and e.player_id = u.player_id))::int as held,
             coalesce(c.drop_end, c.edition_size) as last
    )
    select jsonb_build_object('size', c.edition_size, 'drop', c.drop_no, 'dropEnd', n.last, 'issued', n.issued,
                              'left', greatest(n.last - n.issued - n.held, 0), 'soldOut', n.issued + n.held >= n.last)
      from n) end
    from public.shop_catalog c where c.sku = p_sku
$$;

create or replace function public.start_purchase(p_sku text, p_session text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.store_products;
  cat public.shop_catalog;
begin
  select * into prod from public.store_products where sku = p_sku and active;
  if prod.sku is null then raise exception 'unknown_product' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if public.has_entitlement(uid, p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  -- One pass is enough: no monthly plan on top of forever, or the other way round.
  if prod.product_type = 'chat_pass' and public.chat_unlimited(uid) then raise exception 'already_owned' using errcode = '22023'; end if;
  if p_session !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'bad_session' using errcode = '22023'; end if;
  if prod.product_type = 'postcard' and not exists (select 1 from public.place_visits where player_id = uid and place_id = prod.place_id) then
    raise exception 'visit_first' using errcode = '22023';
  end if;
  if prod.product_type = 'exclusive_event' and exists (select 1 from public.exclusive_events where sku = p_sku and ends_at <= public.game_now()) then
    raise exception 'event_over' using errcode = '22023';
  end if;
  -- Catalog pieces (0102): on sale, and a numbered drop with a number left. The row lock makes two last-copy checkouts
  -- wait for each other. A player who was refunded keeps their number, so their checkout takes none.
  if prod.product_type = 'collector_item' then
    select * into cat from public.shop_catalog where sku = p_sku for update;
    if cat.sku is not null then
      if not public.shop_on_sale(p_sku) or not cat.wearable then raise exception 'not_for_sale' using errcode = '22023'; end if;
      if cat.tab = 'cars' and exists (select 1 from public.players where id = uid and car_mode = 'owned') then
        raise exception 'already_own_car' using errcode = '22023';
      end if;
      if cat.edition_size is not null
         and not exists (select 1 from public.entitlements where player_id = uid and sku = p_sku)
         and (public.couture_edition(p_sku) ->> 'soldOut')::boolean then
        raise exception 'sold_out' using errcode = '22023';
      end if;
    end if;
  end if;
  insert into public.purchases (stripe_session_id, player_id, sku) values (p_session, uid, p_sku)
  on conflict (stripe_session_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- The Clout Couture badge
-- ---------------------------------------------------------------------------
create or replace function public.couture_badge() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.shop_catalog c where c.sku = new.sku and c.collection = 'Clout Couture') then return new; end if;
  if new.status = 'active' then
    insert into public.player_badges (player_id, badge_id, arc_id) values (new.player_id, 'clout-couture', 'collection')
    on conflict do nothing;
  elsif not exists (select 1 from public.entitlements e join public.shop_catalog c on c.sku = e.sku
                     where e.player_id = new.player_id and e.status = 'active' and c.collection = 'Clout Couture') then
    delete from public.player_badges where player_id = new.player_id and badge_id = 'clout-couture';
  end if;
  return new;
end;
$$;
drop trigger if exists entitlements_couture_badge on public.entitlements;
create trigger entitlements_couture_badge after insert or update of status on public.entitlements
  for each row execute function public.couture_badge();

-- ---------------------------------------------------------------------------
-- What players see: the edition on every product
-- ---------------------------------------------------------------------------
create or replace function public.store_catalog()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', p.sku, 'type', p.product_type, 'name', p.name, 'priceCents', p.price_cents, 'currency', p.currency,
    'parent', p.parent_arc_id, 'placeId', p.place_id,
    'owned', public.has_entitlement(auth.uid(), p.sku),
    -- v0.7 Collection: the copy's number (1 = the first player to collect it, refunds keep their
    -- number so nobody's changes) and when it was collected. Clout Couture's edition number (0102).
    'serial', (select coalesce(me.edition_no, 1 + (select count(*) from public.entitlements o
                                                    where o.sku = p.sku and (o.created_at, o.player_id) < (me.created_at, me.player_id)))
                 from public.entitlements me where me.player_id = auth.uid() and me.sku = p.sku and me.status = 'active'),
    'ownedAt', (select me.created_at from public.entitlements me where me.player_id = auth.uid() and me.sku = p.sku and me.status = 'active'),
    'pending', exists (select 1 from public.purchases u where u.player_id = auth.uid() and u.sku = p.sku and u.status = 'pending'
                         and u.created_at > now() - interval '1 hour'),
    -- Postcards: offered once the player has visited the monument.
    'visited', case when p.product_type = 'postcard'
                    then exists (select 1 from public.place_visits v where v.player_id = auth.uid() and v.place_id = p.place_id) end,
    'value', case when p.product_type = 'collector_item'
                  then public.collector_value((select coalesce(i ->> 'tab', i ->> 'category') from jsonb_array_elements(public.city() -> 'shop') i where i ->> 'sku' = p.sku)) end,
    'edition', case when p.product_type = 'collector_item' then public.couture_edition(p.sku) end,
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

-- ---------------------------------------------------------------------------
-- The Studio: a new drop, with its News item
-- ---------------------------------------------------------------------------
/**
 * Opens the next drop of a sold-out numbered piece: it continues the numbering (drop 1 is 0001 to 0100, drop 2 0101 to
 * 0200), optionally at a new size, and Lola announces it the same day. Prices only go up between drops (admin_shop_edit).
 */
create or replace function public.admin_couture_new_drop(p_sku text, p_size int default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cur public.shop_catalog;
  v_issued int;
  v_size int;
  v_end int;
begin
  perform public.require_story_admin();
  select * into cur from public.shop_catalog where sku = p_sku for update;
  if cur.sku is null or cur.edition_size is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if not (public.couture_edition(p_sku) ->> 'soldOut')::boolean then raise exception 'not_sold_out' using errcode = '22023'; end if;
  if p_size is not null and p_size < 1 then raise exception 'bad_size' using errcode = '22023'; end if;
  select count(*) into v_issued from public.entitlements where sku = p_sku;
  v_size := coalesce(p_size, cur.edition_size);
  v_end := greatest(coalesce(cur.drop_end, cur.edition_size), v_issued) + v_size;
  update public.shop_catalog set drop_no = cur.drop_no + 1, drop_end = v_end, edition_size = v_size, updated_at = now() where sku = p_sku;
  perform public.shop_log(p_sku, 'new_drop', jsonb_build_object('drop', cur.drop_no, 'dropEnd', coalesce(cur.drop_end, cur.edition_size)),
                          jsonb_build_object('drop', cur.drop_no + 1, 'dropEnd', v_end), null);
  insert into public.news_items (id, kind, headline, body, cast_ids, publish_on, status)
  values (left('couture-' || p_sku, 50) || '-drop-' || (cur.drop_no + 1), 'city',
          left('Clout Couture is back: ' || cur.name || ', drop ' || (cur.drop_no + 1), 110),
          left('Babe. The ' || cur.name || ' sold out, and the house said fine, ' || v_size || ' more. Numbers '
               || lpad((v_end - v_size + 1)::text, 4, '0') || ' to ' || lpad(v_end::text, 4, '0')
               || ', real cash, in the Shop now. When they''re gone, they''re gone. Lola Lowdown', 600),
          '{lola}', public.ny_today(), 'approved')
  on conflict (id) do nothing;
  return public.couture_edition(p_sku);
end;
$$;

-- ---------------------------------------------------------------------------
-- The pieces in the game
-- ---------------------------------------------------------------------------
-- A real-money car's C$ price (never charged: buy_item refuses collector pieces) is the priciest C$ car's, so its
-- insurance (tick: price × carInsuranceRate) is never cheaper than the best car money can buy in game.
create or replace function public.couture_car_price() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.real_cash and new.tab = 'cars' then
    new.price := coalesce((select max(c.price) from public.shop_catalog c where c.tab = 'cars' and not c.real_cash and c.status <> 'deleted'), new.price);
  end if;
  return new;
end;
$$;
drop trigger if exists shop_catalog_couture_car on public.shop_catalog;
create trigger shop_catalog_couture_car before insert or update on public.shop_catalog
  for each row execute function public.couture_car_price();

-- Accessories sold in Luxury (the catalog's jewelry and watches, Clout Couture's shades, watch and crown) are worn too:
-- filed as fashion (0101 did it only for the Accessories tab, so Luxury's earrings, chains and watch couldn't be put on).
-- Each entry also says its Shop tab: a collector piece's value is 1.5 × the priciest C$ item in its tab (the rule).
create or replace function public.shop_city_entries() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('sku', c.sku, 'rentPerWeek', 0, 'slot', c.slot, 'storyOnly', false, 'cloutReq', 0)
           || c.city
           || jsonb_build_object('category', case when c.tab in ('accessories', 'luxury') and c.slot in ('head', 'face', 'ears', 'neck', 'hand', 'wrist')
                                                  then 'fashion' else c.tab end,
                                 'price', c.price, 'clout', c.clout, 'collector', c.real_cash, 'status', c.status,
                                 'wearable', c.wearable, 'tab', c.tab)
           order by c.position, c.sku), '[]'::jsonb)
    from public.shop_catalog c
   where c.status in ('scheduled', 'live', 'retired')
$$;

create or replace function public.collector_value(p_category text) returns int
language sql stable security definer set search_path = public
as $$
  select round(1.5 * max((i ->> 'price')::int))::int
    from jsonb_array_elements(public.city() -> 'shop') i
   where coalesce(i ->> 'tab', i ->> 'category') = p_category and not coalesce((i ->> 'collector')::boolean, false)
     and i ->> 'slot' is distinct from 'outfit'
$$;

/** A collector piece's Net Worth value comes from its Shop tab, whatever it is filed under (payment_grant passes the filing). */
create or replace function public.collector_tab_value() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tab text;
begin
  if new.acquired = 'collector' then
    select tab into v_tab from public.shop_catalog where sku = new.sku;
    if v_tab is not null then new.value := coalesce(public.collector_value(v_tab), new.value); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists player_items_collector_value on public.player_items;
create trigger player_items_collector_value before insert on public.player_items
  for each row execute function public.collector_tab_value();

-- Luxury's jewelry and watches already bought: filed as fashion, so they can be worn.
update public.player_items i set category = 'fashion'
  from public.shop_catalog c
 where c.sku = i.sku and c.tab = 'luxury' and c.slot in ('head', 'face', 'ears', 'neck', 'hand', 'wrist') and i.category = 'luxury';

-- The Veloce in the garage when the webhook grants it, out again on a refund.
create or replace function public.couture_car() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.acquired = 'collector' and new.category = 'cars' then
      update public.players
         set car_sku = new.sku, car_mode = 'owned',
             next_car_due = (public.ny_today() + (public.city() -> 'economy' -> 'bills' ->> 'every')::interval)::date
       where id = new.player_id and car_mode is distinct from 'owned';
    end if;
    return new;
  end if;
  if old.acquired = 'collector' and old.category = 'cars' then
    update public.players set car_sku = null, car_mode = null, next_car_due = null where id = old.player_id and car_sku = old.sku;
  end if;
  return old;
end;
$$;
drop trigger if exists player_items_couture_car on public.player_items;
create trigger player_items_couture_car after insert or delete on public.player_items
  for each row execute function public.couture_car();

-- What exists now: the first eight pieces (the 24k Glow Ritual waits for its shimmer; the yacht, jet, plaza statue and
-- mansion come later).
update public.shop_catalog set wearable = true
 where not wearable and sku = any(array['cloud-nine-sofa', 'self-portrait-statue', 'velocity-veloce', 'sartorio-bespoke-suit',
                                        'gilded-sole-heels', 'midas-shades', 'ledger-tourbillon', 'clout-crown']);
update public.shop_catalog set updated_at = updated_at where real_cash and tab = 'cars';

-- The Studio's row: the edition too, so a sold-out piece offers its next drop.
create or replace function public.shop_admin_row(c public.shop_catalog) returns jsonb
language sql stable security definer set search_path = public
as $$
  select public.shop_row(c) || jsonb_build_object(
    'imageStatus', c.image_status, 'imageError', c.image_error, 'sourceImage', c.source_image, 'transparent', c.transparent,
    'note', c.note, 'origin', c.origin, 'file', c.file, 'extra', c.extra,
    'sold', exists (select 1 from public.player_items i where i.sku = c.sku)
         or exists (select 1 from public.purchases p where p.sku = c.sku and p.status in ('paid', 'refunded')),
    'edition', public.couture_edition(c.sku),
    'updatedAt', c.updated_at)
$$;

revoke all on function public.shop_store_sync() from public, anon, authenticated;
revoke all on function public.collector_tab_value() from public, anon, authenticated;
revoke all on function public.couture_car_price() from public, anon, authenticated;
revoke all on function public.couture_car() from public, anon, authenticated;
revoke all on function public.couture_number() from public, anon, authenticated;
revoke all on function public.couture_badge() from public, anon, authenticated;
revoke all on function public.couture_edition(text) from public, anon, authenticated;
revoke all on function public.admin_couture_new_drop(text, int) from public, anon;
grant execute on function public.admin_couture_new_drop(text, int) to authenticated;
