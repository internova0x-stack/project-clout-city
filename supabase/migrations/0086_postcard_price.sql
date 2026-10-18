-- Postcards go from $0.99 to $1.99 (owner, Oct 18). At $0.99, Stripe's fixed fee plus a creator's affiliate share left
-- about a third of the price; at $1.99 it's about half. Postcards already bought keep their price in `purchases`.
-- Safe to run more than once.
update public.store_products set price_cents = 199, updated_at = now() where product_type = 'postcard';
