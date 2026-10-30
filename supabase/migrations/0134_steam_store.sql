-- Steam checkout (owner, Oct 30; step 3 of Steam, docs/STEAM.md). Inside the Steam app, one-time real-money items are
-- paid through Steam (app/home/steamStoreActions.ts): the purchase row is the same as Stripe's (start_purchase with the
-- session 'steam:<order>'), and payment_grant unlocks it once Steam confirms the payment. VIP stays on the web.
--   * game_settings 'steam_store': rates from US dollars for Steam wallets in other currencies (lib/steam.ts steamPrice:
--     the dollar price times the rate, rounded up to .99). A wallet currency without a rate isn't offered checkout yet.
--     Edit the rates here (or in a later migration) when exchange rates move.

insert into public.game_settings (key, value) values ('steam_store', '{"rates": {"EUR": 0.95, "GBP": 0.8, "CAD": 1.4, "AUD": 1.55}}'::jsonb)
on conflict (key) do nothing;

-- start_purchase (latest: 0130) also takes a Steam order as its session: 'steam:<order id>'. A player calling it with a
-- made-up order only opens a pending row; nothing is granted until Steam confirms the payment to the server.
drop function if exists public.start_purchase(text, text);
create function public.start_purchase(p_sku text, p_session text)
returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.store_products;
  cat public.shop_catalog;
  replaced text[];
begin
  select * into prod from public.store_products where sku = p_sku and active;
  if prod.sku is null then raise exception 'unknown_product' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if public.has_entitlement(uid, p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  -- One pass is enough: no monthly plan on top of forever, or the other way round.
  if prod.product_type = 'chat_pass' and public.chat_unlimited(uid) then raise exception 'already_owned' using errcode = '22023'; end if;
  if p_session !~ '^(cs_[A-Za-z0-9_]+|steam:[0-9]{1,19})$' then raise exception 'bad_session' using errcode = '22023'; end if;
  if prod.product_type = 'postcard' and not exists (select 1 from public.place_visits where player_id = uid and place_id = prod.place_id) then
    raise exception 'visit_first' using errcode = '22023';
  end if;
  if prod.product_type = 'exclusive_event' and exists (select 1 from public.exclusive_events where sku = p_sku and ends_at <= public.game_now()) then
    raise exception 'event_over' using errcode = '22023';
  end if;
  -- The player's row lock makes two checkouts at once wait for each other.
  perform 1 from public.players where id = uid for update;
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
         and not exists (select 1 from public.purchases u where u.player_id = uid and u.sku = p_sku and u.status = 'pending'
                          and u.created_at > now() - interval '35 minutes')
         and (public.couture_edition(p_sku) ->> 'soldOut')::boolean then
        raise exception 'sold_out' using errcode = '22023';
      end if;
    end if;
  end if;
  -- The player's older open checkouts for this product (or any chat plan) are replaced; the server expires them in Stripe (Steam orders are never finalized).
  with old as (
    update public.purchases u set status = 'expired', updated_at = now()
     where u.player_id = uid and u.status = 'pending' and u.stripe_session_id <> p_session
       and (u.sku = p_sku or (prod.product_type = 'chat_pass'
                              and exists (select 1 from public.store_products o where o.sku = u.sku and o.product_type = 'chat_pass')))
    returning u.stripe_session_id)
  select coalesce(array_agg(stripe_session_id), '{}') into replaced from old;
  insert into public.purchases (stripe_session_id, player_id, sku) values (p_session, uid, p_sku)
  on conflict (stripe_session_id) do nothing;
  return replaced;
end;
$$;
revoke all on function public.start_purchase(text, text) from public, anon;
grant execute on function public.start_purchase(text, text) to authenticated;
