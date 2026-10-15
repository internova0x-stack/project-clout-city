-- Unlimited chat pricing (owner, Oct 15: "$4.99/mo, $39.99/year, $119.99 forever"; mockup /preview/chatpass).
--   * A yearly plan: chat-unlimited-yearly, $39.99 a year, a Stripe subscription like the monthly one
--     (store_products.recurring 'year'). Its entitlement follows the subscription (payment_subscription),
--     so the daily limit comes back when it ends.
--   * Forever goes from $39.99 to $119.99. Players who already bought it keep it; only new purchases
--     pay the new price. If a Stripe Price was set for it (stripe_price_id), it's cleared so Checkout
--     charges the new amount; make a new Price in Stripe if you want one (docs/SETUP.md step 12).
--   * chat_unlimited() counts all three.

do $$
begin
  if to_regclass('public.together_invites') is null then
    raise exception 'Run migration 0050_better_together.sql first: 0051 builds on it.';
  end if;
end $$;

alter table public.store_products drop constraint if exists store_products_recurring_check;
alter table public.store_products add constraint store_products_recurring_check check (recurring in ('month', 'year'));

insert into public.store_products (sku, product_type, name, price_cents, recurring) values
  ('chat-unlimited-yearly', 'chat_pass', 'Unlimited chat (yearly)', 3999, 'year')
on conflict (sku) do update set price_cents = excluded.price_cents, recurring = excluded.recurring, active = true;

update public.store_products
   set price_cents = 11999,
       stripe_price_id = case when price_cents <> 11999 then null else stripe_price_id end
 where sku = 'chat-unlimited-forever';

/** Unlimited chat: any pass, while it's active. The only check the chat functions use. */
create or replace function public.chat_unlimited(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_entitlement(p_player, 'chat-unlimited-monthly')
      or public.has_entitlement(p_player, 'chat-unlimited-yearly')
      or public.has_entitlement(p_player, 'chat-unlimited-forever')
$$;
