-- Membership & purchases (owner, Oct 18): Phone → Settings and the profile open a screen with the player's VIP plan,
-- chat forever and every real-money purchase, plus a way into Stripe's billing portal (switch monthly/yearly,
-- update the card, cancel at the end of the paid period, receipts).
--
--   * stripe_customers: the player's Stripe customer, saved by the webhook (and found once for older buyers).
--     Server only: no browser access.
--   * membership_state(): what the screen shows (no Stripe ids). The plan's renewal date, cancel and payment
--     status are read live from Stripe by the server (app/home/membershipActions.ts).
--   * membership_billing(player): the customer, the VIP subscription and a few checkout sessions, for the server.
--   * payment_customer(player, customer): saves the customer (webhook and server only).

create table public.stripe_customers (
  player_id   uuid primary key references public.players (id) on delete cascade,
  customer_id text not null,
  updated_at  timestamptz not null default now()
);
create index stripe_customers_customer_idx on public.stripe_customers (customer_id);
alter table public.stripe_customers enable row level security;

create function public.payment_customer(p_player uuid, p_customer text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.stripe_customers (player_id, customer_id)
  select p_player, p_customer
   where p_customer like 'cus\_%' and exists (select 1 from public.players where id = p_player)
  on conflict (player_id) do update set customer_id = excluded.customer_id, updated_at = now()
   where stripe_customers.customer_id is distinct from excluded.customer_id;
$$;
revoke all on function public.payment_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.payment_customer(uuid, text) to service_role;

create function public.membership_billing(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'customer', (select customer_id from public.stripe_customers where player_id = p_player),
    'subscription', (select stripe_payment_id from public.entitlements
                      where player_id = p_player and sku in ('chat-unlimited-monthly', 'chat-unlimited-yearly')
                        and status = 'active' and stripe_payment_id like 'sub\_%'
                      order by created_at desc limit 1),
    'sessions', coalesce((select jsonb_agg(s) from (
                  select stripe_session_id as s from public.purchases
                   where player_id = p_player and status in ('paid', 'refunded')
                   order by created_at desc limit 3) x), '[]'::jsonb));
$$;
revoke all on function public.membership_billing(uuid) from public, anon, authenticated;
grant execute on function public.membership_billing(uuid) to service_role;

/** The screen's data: whether you're a VIP (and which plan you bought), chat forever, and your purchases. */
create function public.membership_state()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'vip', (select jsonb_build_object('sku', e.sku, 'priceCents', s.price_cents, 'currency', s.currency)
              from public.entitlements e join public.store_products s on s.sku = e.sku
             where e.player_id = auth.uid() and e.sku in ('chat-unlimited-monthly', 'chat-unlimited-yearly') and e.status = 'active'
             order by e.created_at desc limit 1),
    'chatForever', public.has_entitlement(auth.uid(), 'chat-unlimited-forever'),
    'hasCustomer', exists (select 1 from public.stripe_customers where player_id = auth.uid()),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object(
        'id', left(md5(p.stripe_session_id), 12),
        'sku', p.sku,
        'name', s.name,
        'type', s.product_type,
        'amountCents', coalesce(p.amount_cents, s.price_cents),
        'currency', coalesce(p.currency, s.currency),
        'at', p.created_at,
        'status', p.status) order by p.created_at desc)
      from public.purchases p join public.store_products s on s.sku = p.sku
     where p.player_id = auth.uid() and p.status in ('paid', 'refunded')), '[]'::jsonb));
$$;
revoke all on function public.membership_state() from public, anon;
grant execute on function public.membership_state() to authenticated;
