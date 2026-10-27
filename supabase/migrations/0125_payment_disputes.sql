-- Chargebacks (owner, Oct 27; Terms section 5). Stripe's charge.dispute.* events reach the webhook:
--   * created: the dispute is recorded (the Studio can see it); nothing is taken away while it's open.
--   * closed as lost: handled like a full refund (payment_refund: the item, ticket or postcard comes out, the clout it
--     paid is taken back, the purchase counts as refunded). A lost dispute on a VIP charge (no one-time purchase
--     matches the payment; the player is found by the charge's Stripe customer) tells the webhook to cancel the
--     customer's subscriptions in Stripe, whose deletion ends VIP (payment_subscription).
--   * closed as won (or a warning closed): marked, nothing changes.
-- Idempotent per Stripe event, like every payment function.

create table if not exists public.payment_disputes (
  id           text primary key,                     -- Stripe's dispute id
  player_id    uuid references public.players (id) on delete set null,
  payment      text,                                 -- the payment intent
  amount_cents int,
  currency     text,
  reason       text,
  status       text not null default 'open' check (status in ('open', 'won', 'lost', 'closed')),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
alter table public.payment_disputes enable row level security;
revoke all on public.payment_disputes from anon, authenticated;

/**
 * p_status: 'open' (charge.dispute.created) or Stripe's closing status ('won', 'lost', 'warning_closed', ...).
 * Returns {result, revoked, player, subscription_charge}: subscription_charge is true when a lost dispute matched no
 * one-time purchase but the customer is a player's, so the webhook cancels that customer's VIP subscription.
 */
create or replace function public.payment_dispute(p_event text, p_dispute text, p_payment text, p_amount int, p_currency text,
                                                  p_reason text, p_status text, p_customer text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  who uuid;
  st text := case when p_status = 'open' then 'open' when p_status = 'won' then 'won' when p_status = 'lost' then 'lost' else 'closed' end;
  revoked text := null;
  bought boolean;
begin
  if exists (select 1 from public.stripe_events where id = p_event) then
    return jsonb_build_object('result', 'duplicate');
  end if;
  select player_id into who from public.purchases where stripe_payment_id = p_payment limit 1;
  bought := who is not null;
  if who is null and p_customer is not null then
    select player_id into who from public.stripe_customers where customer_id = p_customer;
  end if;
  insert into public.payment_disputes (id, player_id, payment, amount_cents, currency, reason, status, closed_at)
  values (p_dispute, who, p_payment, p_amount, p_currency, p_reason, st, case when st = 'open' then null else now() end)
  on conflict (id) do update set status = excluded.status, closed_at = excluded.closed_at,
    player_id = coalesce(public.payment_disputes.player_id, excluded.player_id);
  if st = 'lost' then
    -- The same as a full refund, under its own event id so it runs once.
    revoked := public.payment_refund(p_event || ':lost', p_payment);
  end if;
  insert into public.stripe_events (id, type, result) values (p_event, 'charge.dispute', st || coalesce(':' || revoked, ''));
  return jsonb_build_object('result', st, 'revoked', revoked, 'player', who,
    'subscription_charge', st = 'lost' and not bought and who is not null);
end;
$$;
revoke all on function public.payment_dispute(text, text, text, int, text, text, text, text) from public, anon, authenticated;
grant execute on function public.payment_dispute(text, text, text, int, text, text, text, text) to service_role;
