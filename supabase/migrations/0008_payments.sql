-- v0.5 payments (Story Production and Payments Brief v2, part 2), started with the
-- side stories. Real money only ever buys access: the Stripe webhook is the one
-- thing that grants it, every grant and refund is idempotent per Stripe event, and
-- has_entitlement(player, sku) stays the single gate (0007).
--
-- Products and their prices live here as config (store_products), and in Stripe
-- when a Stripe Price id is set; the code never hardcodes a price.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.store_products (
  sku             text primary key,
  product_type    text not null check (product_type in ('side_arc', 'exclusive_event', 'collector_item', 'postcard')),
  name            text not null,
  -- Shown to players, and charged when no Stripe Price is set. Never changed on an arc players follow.
  price_cents     int not null check (price_cents > 0),
  currency        text not null default 'usd',
  -- Optional: a Price created in the Stripe dashboard (price_...). When set, Checkout charges it instead.
  stripe_price_id text,
  parent_arc_id   text,
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table public.store_products enable row level security;
create policy "anyone reads the catalog" on public.store_products for select to anon, authenticated using (active);

insert into public.store_products (sku, product_type, name, price_cents, parent_arc_id) values
  ('side_sarah_bird_momager_files', 'side_arc', 'The Momager Files', 299, 'sarah-bird'),
  ('side_sarah_bird_night_book',    'side_arc', 'Ray''s Night Book', 299, 'sarah-bird'),
  ('side_sarah_bird_plus_one',      'side_arc', 'Jett: The Plus-One', 299, 'sarah-bird')
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------------
-- Purchases, entitlements and the Stripe event log
-- ---------------------------------------------------------------------------
-- One row per Checkout Session, so the game can show "unlocking…" until the webhook lands.
create table public.purchases (
  stripe_session_id text primary key,
  player_id         uuid not null references public.players (id) on delete cascade,
  sku               text not null references public.store_products (sku),
  status            text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'refunded')),
  amount_cents      int,
  currency          text,
  stripe_payment_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index purchases_player_idx on public.purchases (player_id, created_at desc);
create index purchases_payment_idx on public.purchases (stripe_payment_id);
alter table public.purchases enable row level security;
create policy "own purchases" on public.purchases for select to authenticated using (player_id = auth.uid());

alter table public.entitlements
  add column parent_arc_id text,
  add column revoked_at timestamptz;
create index entitlements_payment_idx on public.entitlements (stripe_payment_id);

-- Every Stripe event handled, once. A replayed webhook finds its id here and changes nothing.
create table public.stripe_events (
  id          text primary key,
  type        text not null,
  result      text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- Player side: what's for sale, and a pending purchase
-- ---------------------------------------------------------------------------
/** The catalog with this player's state per product: owned, pending (paid, webhook not in yet) or for sale. */
create function public.store_catalog()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', p.sku, 'type', p.product_type, 'name', p.name, 'priceCents', p.price_cents, 'currency', p.currency,
    'parent', p.parent_arc_id,
    'owned', public.has_entitlement(auth.uid(), p.sku),
    'pending', exists (select 1 from public.purchases u where u.player_id = auth.uid() and u.sku = p.sku and u.status = 'pending'
                         and u.created_at > now() - interval '1 hour')
  ) order by p.sku), '[]')
  from public.store_products p where p.active;
$$;

/**
 * Called by the server right after it creates a Checkout Session for this player.
 * Records it as pending; grants nothing (only the webhook does).
 */
create function public.start_purchase(p_sku text, p_session text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.store_products;
begin
  select * into prod from public.store_products where sku = p_sku and active;
  if prod.sku is null then raise exception 'unknown_product' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if public.has_entitlement(uid, p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if p_session !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'bad_session' using errcode = '22023'; end if;
  insert into public.purchases (stripe_session_id, player_id, sku) values (p_session, uid, p_sku)
  on conflict (stripe_session_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook side (service role only)
-- ---------------------------------------------------------------------------
/**
 * checkout.session.completed: writes the entitlement. Idempotent per event id and per
 * (player, sku). Side arcs and postcards never pay clout (Brief part 2).
 */
create function public.payment_grant(
  p_event text, p_session text, p_payment text, p_player uuid, p_sku text, p_amount int, p_currency text
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  prod public.store_products;
  result text;
begin
  -- A replay of an event we already handled changes nothing.
  if exists (select 1 from public.stripe_events where id = p_event) then return 'duplicate'; end if;
  select * into prod from public.store_products where sku = p_sku;
  if prod.sku is null then
    result := 'unknown_product';
  elsif not exists (select 1 from public.players where id = p_player) then
    result := 'unknown_player';
  elsif prod.product_type <> 'side_arc' then
    result := 'product_not_live'; -- events, collector items and postcards arrive later in v0.5
  else
    insert into public.entitlements (player_id, sku, product_type, status, stripe_session_id, stripe_payment_id, parent_arc_id)
    values (p_player, p_sku, prod.product_type, 'active', p_session, p_payment, prod.parent_arc_id)
    on conflict (player_id, sku) do update
       set status = 'active', stripe_session_id = excluded.stripe_session_id, stripe_payment_id = excluded.stripe_payment_id,
           revoked_at = null;
    insert into public.purchases (stripe_session_id, player_id, sku, status, amount_cents, currency, stripe_payment_id)
    values (p_session, p_player, p_sku, 'paid', p_amount, p_currency, p_payment)
    on conflict (stripe_session_id) do update
       set status = 'paid', amount_cents = excluded.amount_cents, currency = excluded.currency,
           stripe_payment_id = excluded.stripe_payment_id, updated_at = now();
    result := 'granted';
  end if;
  insert into public.stripe_events (id, type, result) values (p_event, 'checkout.session.completed', result);
  return result;
end;
$$;

/** checkout.session.expired: the pending state ends. */
create function public.payment_expired(p_event text, p_session text)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.stripe_events where id = p_event) then return 'duplicate'; end if;
  update public.purchases set status = 'expired', updated_at = now() where stripe_session_id = p_session and status = 'pending';
  insert into public.stripe_events (id, type, result) values (p_event, 'checkout.session.expired', 'expired');
  return 'expired';
end;
$$;

/**
 * charge.refunded: revokes what that payment bought and takes back exactly the clout
 * it awarded (stopping at zero). Side arcs lock again; their beats go back to teasers.
 */
create function public.payment_refund(p_event text, p_payment text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  e public.entitlements;
  n int := 0;
  awarded bigint;
  have bigint;
  back bigint;
begin
  if exists (select 1 from public.stripe_events where id = p_event) then return 'duplicate'; end if;
  for e in select * from public.entitlements where stripe_payment_id = p_payment and status = 'active' for update loop
    update public.entitlements set status = 'revoked', revoked_at = now() where player_id = e.player_id and sku = e.sku;
    -- Clout this purchase paid (none for side arcs today), taken back once, never below zero.
    select coalesce(sum(amount), 0) into awarded from public.ledger
     where player_id = e.player_id and currency = 'clout' and kind = 'purchase_clout' and ref = e.stripe_session_id;
    if awarded > 0 then
      select clout into have from public.players where id = e.player_id for update;
      back := least(awarded, greatest(have, 0));
      if public.ledger_once(e.player_id, 'clout', -back, 'refund_clout', e.stripe_session_id) then
        update public.players set clout = clout - back where id = e.player_id;
      end if;
    end if;
    n := n + 1;
  end loop;
  update public.purchases set status = 'refunded', updated_at = now() where stripe_payment_id = p_payment;
  insert into public.stripe_events (id, type, result) values (p_event, 'charge.refunded', case when n > 0 then 'revoked' else 'nothing_to_revoke' end);
  return case when n > 0 then 'revoked' else 'nothing_to_revoke' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.store_catalog()', 'public.start_purchase(text, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.payment_grant(text, text, text, uuid, text, int, text)', 'public.payment_expired(text, text)', 'public.payment_refund(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end;
$$;
