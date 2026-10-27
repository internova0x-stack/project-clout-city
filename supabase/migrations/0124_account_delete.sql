-- Delete my account (owner, Oct 27; GDPR right to erasure). The server action (app/home/accountActions.ts) calls
-- account_delete_prepare with the service role, cancels any VIP subscription in Stripe, removes the player's Clout TV
-- photos and then deletes the login (auth.users), which removes the player and everything that belongs to them
-- (every player table references players on delete cascade). Creator commissions stay, without the player
-- (on delete set null), so creators are still paid; Stripe keeps its own payment records.

-- Only how many and when, never who.
create table if not exists public.account_deletions (
  id            bigint generated always as identity primary key,
  deleted_at    timestamptz not null default now(),
  had_purchases boolean not null default false
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

/**
 * Gets a player ready to be deleted: a Studio admin's review marks on shoutouts and Clout TV photos are cleared (those
 * columns don't cascade), the deletion is counted, and the Stripe customer comes back so the caller can cancel billing.
 */
create or replace function public.account_delete_prepare(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cust text;
begin
  if not exists (select 1 from public.players where id = p_player) then
    return jsonb_build_object('customer', null);
  end if;
  update public.radio_shoutouts set reviewed_by = null where reviewed_by = p_player;
  update public.tv_submissions set reviewed_by = null where reviewed_by = p_player;
  select customer_id into cust from public.stripe_customers where player_id = p_player;
  insert into public.account_deletions (had_purchases)
  values (exists (select 1 from public.purchases where player_id = p_player));
  return jsonb_build_object('customer', cust);
end;
$$;
revoke all on function public.account_delete_prepare(uuid) from public, anon, authenticated;
