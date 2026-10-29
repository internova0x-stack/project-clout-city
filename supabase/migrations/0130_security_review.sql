-- Security review before v1.0 (owner, Oct 29). Five fixes; nothing here changes what an honest player sees.
--
-- 1. Checkouts: one open checkout per player per product (any VIP or unlimited chat plan counts as one product).
--    A new checkout replaces the player's older open one, and start_purchase returns the replaced Stripe sessions so the
--    server expires them (a player can't pay twice, or hold more than one copy of a numbered drop).
-- 2. Couture editions: copies held by open checkouts count once per player.
-- 3. The saved Stripe customer is kept; a later payment never swaps it (the billing portal stays the player's own).
-- 4. Push devices: only the browsers' push services are accepted (the sender never posts anywhere else), and a device
--    moves to another account only with the same browser's keys.
-- 5. Lucky Star Lotto: a pot won by a card that isn't scratched yet still shows, so the pot never gives a win away.
-- Plus: functions only signed-in players use are no longer callable signed out.

-- ---------------------------------------------------------------------------
-- 1. One open checkout per player per product
-- ---------------------------------------------------------------------------
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
  if p_session !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'bad_session' using errcode = '22023'; end if;
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
  -- The player's older open checkouts for this product (or any chat plan) are replaced; the server expires them in Stripe.
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

-- ---------------------------------------------------------------------------
-- 2. Copies held by open checkouts: one per player
-- ---------------------------------------------------------------------------
create or replace function public.couture_edition(p_sku text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when c.edition_size is null then null else (
    with n as (
      select (select count(*) from public.entitlements e where e.sku = c.sku)::int as issued,
             (select count(distinct u.player_id) from public.purchases u
               where u.sku = c.sku and u.status = 'pending' and u.created_at > now() - interval '35 minutes'
                 and not exists (select 1 from public.entitlements e where e.sku = u.sku and e.player_id = u.player_id))::int as held,
             coalesce(c.drop_end, c.edition_size) as last
    )
    select jsonb_build_object('size', c.edition_size, 'drop', c.drop_no, 'dropEnd', n.last, 'issued', n.issued,
                              'left', greatest(n.last - n.issued - n.held, 0), 'soldOut', n.issued + n.held >= n.last)
      from n) end
    from public.shop_catalog c where c.sku = p_sku
$$;

-- ---------------------------------------------------------------------------
-- 3. The saved Stripe customer is kept (forgetCustomer clears it first when it really has to change)
-- ---------------------------------------------------------------------------
create or replace function public.payment_customer(p_player uuid, p_customer text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.stripe_customers (player_id, customer_id)
  select p_player, p_customer
   where p_customer like 'cus\_%' and exists (select 1 from public.players where id = p_player)
  on conflict (player_id) do nothing;
$$;
revoke all on function public.payment_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.payment_customer(uuid, text) to service_role;

/** A full refund of a charge that bought nothing one-off but is a player's customer's: a VIP payment (the webhook cancels it). */
create function public.refund_is_subscription(p_payment text, p_customer text) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_customer like 'cus\_%'
     and not exists (select 1 from public.purchases where stripe_payment_id = p_payment)
     and exists (select 1 from public.stripe_customers where customer_id = p_customer)
$$;
revoke all on function public.refund_is_subscription(text, text) from public, anon, authenticated;
grant execute on function public.refund_is_subscription(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Push devices: the browsers' push services only, and no taking over someone else's device
-- ---------------------------------------------------------------------------
create or replace function public.push_endpoint_ok(p_endpoint text) returns boolean
language sql immutable set search_path = public
as $$
  select length(p_endpoint) <= 1000 and p_endpoint ~ ('^https://(fcm\.googleapis\.com|android\.googleapis\.com|'
    || '([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)/')
$$;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_tz text) returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.push_endpoint_ok(p_endpoint) or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'bad_subscription' using errcode = '22023';
  end if;
  -- The same browser signing in to another account keeps its keys; anyone else's keys leave the device where it is.
  insert into public.push_subscriptions (player_id, endpoint, p256dh, auth) values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set player_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, fails = 0
   where push_subscriptions.player_id = uid
      or (push_subscriptions.p256dh = excluded.p256dh and push_subscriptions.auth = excluded.auth);
  insert into public.push_prefs (player_id, tz) values (uid, coalesce(nullif(left(p_tz, 64), ''), 'America/New_York'))
  on conflict (player_id) do update set tz = excluded.tz, updated_at = now();
end;
$$;
revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

delete from public.push_subscriptions where not public.push_endpoint_ok(endpoint);

-- ---------------------------------------------------------------------------
-- 5. Lucky Star Lotto: a won pot shows until its card is scratched
-- ---------------------------------------------------------------------------
create or replace function public.lotto_state()
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l jsonb := public.city() -> 'economy' -> 'lotto';
  today date := public.ny_today();
  me public.players;
  until timestamptz;
  g jsonb;
begin
  select * into me from public.players where id = uid;
  if me.id is null then return null; end if;
  until := me.created_at + make_interval(days => (l -> 'beginner' ->> 'days')::int);
  for g in select x from jsonb_array_elements(l -> 'games') x loop perform public.lotto_pot_for(g); end loop;
  return jsonb_build_object(
    'freeUsed', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid = 0),
    'freeToday', public.lotto_free_today(me.created_at),
    'bought', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid > 0),
    'beginnerUntil', case when public.game_now() < until then until end,
    -- The pot goes back to its seed when a card wins it (at purchase); until that card is scratched, the pot shows as
    -- if it were still there, so its size never tells the buyer what's under the foil (security review, 0130).
    'pots', (select jsonb_agg(jsonb_build_object('game', p.game, 'lucky', p.lucky, 'period', p.period,
                     'pool', floor(p.pool + coalesce((select sum(w.amount - (x.g -> 'pot' ->> 'seed')::numeric)
                                                        from public.lotto_pot_wins w join public.lotto_cards c on c.id = w.card
                                                       where w.game = p.game and w.period = p.period and c.scratched_at is null), 0))::int)
                     order by x.ord)
               from jsonb_array_elements(l -> 'games') with ordinality x(g, ord)
               join public.lotto_pots p on p.game = x.g ->> 'id' and p.period = public.lotto_period(x.g)),
    'unscratched', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'game', game) order by id)
                             from public.lotto_cards where player_id = uid and scratched_at is null), '[]'::jsonb),
    -- Only pots already scratched: a win shows up once its card is.
    'wins', coalesce((select jsonb_agg(x order by x ->> 'wonAt' desc) from (
        select jsonb_build_object(
                 'game', w.game, 'amount', w.amount, 'wonAt', w.won_at, 'mine', w.player_id = uid,
                 'winner', case when w.player_id = uid then p.display_name when coalesce(p.news_opt_out, false) then null else p.display_name end) as x
          from public.lotto_pot_wins w
          join public.lotto_cards c on c.id = w.card and c.scratched_at is not null
          left join public.players p on p.id = w.player_id
         order by w.won_at desc limit 3) s), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Signed-in only: functions a signed-out visitor could still call (each refused without a player, now not callable)
-- ---------------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname ~ '^(together|ride|job)_' or p.proname in ('post_job', 'take_job', 'manager_collect', 'decorate_save',
                                                                  'jobs_board', 'my_skills', 'session_ping'))
       and has_function_privilege('anon', p.oid, 'execute')
  loop
    if has_function_privilege('authenticated', f, 'execute') then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    else
      execute format('revoke execute on function %s from public, anon', f);
    end if;
  end loop;
end $$;

comment on function public.refund_is_subscription(text, text) is 'security review (0130)';
