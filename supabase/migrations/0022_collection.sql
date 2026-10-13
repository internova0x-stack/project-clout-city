-- v0.7 step 5, the Collection redesign (docs/testing-feedback.md #40): every owned card shows a serial
-- number, "No. 0042" meaning the 42nd copy anyone collected (owner, Oct 13), and the date it was
-- collected. Parties a player had a ticket for stay in the catalog after they end, as event cards.

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
                                                             where a.player_id = auth.uid() and a.event_id = e.id))
                from public.exclusive_events e where e.sku = p.sku)
  ) order by p.sku), '[]')
  from public.store_products p
  where p.active
    -- Parties that have ended leave the list, except for players who had a ticket: those stay as
    -- event cards in their Collection (the client hides ended parties everywhere else).
    and (not exists (select 1 from public.exclusive_events e where e.sku = p.sku and e.ends_at <= public.game_now())
         or public.has_entitlement(auth.uid(), p.sku));
$$;
