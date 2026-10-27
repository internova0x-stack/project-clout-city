-- Scenario test for migration 0124 (Delete my account): a player with a crew, chats, purchases and a Stripe customer
-- is deleted with everything that's theirs; a Studio admin who reviewed shoutouts can be deleted too; the deletion is
-- counted without saying who; creators' commissions stay. Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000124' || lpad(n::text, 2, '0'))::uuid $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 3) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Leaver', 'Friend', 'Admin'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.u(i)::text, false);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
reset role;

-- The leaver has a crew, a chat, a purchase, a Stripe customer, a shoutout the admin reviewed, and a creator commission.
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.u(1), pg_temp.u(2), 'TEST');
insert into public.conversations (a, b) values (least(pg_temp.u(1), pg_temp.u(2)), greatest(pg_temp.u(1), pg_temp.u(2)));
insert into public.messages (conversation_id, sender, body, ny_date)
  select id, pg_temp.u(1), 'see you', public.ny_today() from public.conversations where a = least(pg_temp.u(1), pg_temp.u(2));
insert into public.purchases (stripe_session_id, player_id, sku, status, amount_cents, currency)
  select 'cs_test_1', pg_temp.u(1), sku, 'paid', 499, 'usd' from public.store_products limit 1;
insert into public.stripe_customers (player_id, customer_id) values (pg_temp.u(1), 'cus_leaver');
insert into public.radio_shoutouts (player_id, handle, message, ny_date, owner_confirmed, reviewed_by)
  values (pg_temp.u(1), 'leaver', 'hi queens', public.ny_today(), true, pg_temp.u(3));
insert into public.creators (id, name, code, email, rate, months) values ('00000000-0000-0000-0000-00000012cc01', 'Tasha', 'TASHADEL', 'tasha@example.com', 20, 12)
  on conflict do nothing;
insert into public.creator_commissions (creator_id, player_id, kind, source, stripe_event, gross_cents, fee_cents, tax_cents, net_cents, rate, commission_cents, payable_on)
  values ('00000000-0000-0000-0000-00000012cc01', pg_temp.u(1), 'sale', 'checkout', 'evt_1', 499, 45, 0, 454, 20, 91, current_date + 45);

-- Players can't call it.
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.u(1)::text, false);
do $$ begin perform public.account_delete_prepare(pg_temp.u(1)); raise exception 'FAIL: callable by players';
exception when insufficient_privilege then null; end $$;
reset role;

-- The server's steps: prepare (gives back the Stripe customer), then delete the login.
select pg_temp.assert(public.account_delete_prepare(pg_temp.u(1)) ->> 'customer' = 'cus_leaver', 'the customer to cancel');
delete from auth.users where id = pg_temp.u(1);
select pg_temp.assert(not exists (select 1 from public.players where id = pg_temp.u(1)), 'player gone');
select pg_temp.assert(not exists (select 1 from public.messages where sender = pg_temp.u(1)), 'messages gone');
select pg_temp.assert(not exists (select 1 from public.purchases where player_id = pg_temp.u(1)), 'purchases gone (Stripe keeps its records)');
select pg_temp.assert(not exists (select 1 from public.invites where inviter_id = pg_temp.u(1)), 'crew link gone');
select pg_temp.assert(not exists (select 1 from public.ledger where player_id = pg_temp.u(1)), 'ledger gone');
select pg_temp.assert(exists (select 1 from public.players where id = pg_temp.u(2)), 'the friend stays');
select pg_temp.assert((select player_id from public.creator_commissions where stripe_event = 'evt_1') is null
  and exists (select 1 from public.creator_commissions where stripe_event = 'evt_1'), 'the commission stays, without the player');
select pg_temp.assert((select count(*) from public.account_deletions where had_purchases) = 1, 'counted, with purchases');

-- The admin who reviewed shoutouts can be deleted too.
insert into public.radio_shoutouts (player_id, handle, message, ny_date, owner_confirmed, reviewed_by)
  values (pg_temp.u(2), 'friend', 'hello', public.ny_today(), true, pg_temp.u(3));
select 1 from public.account_delete_prepare(pg_temp.u(3));
delete from auth.users where id = pg_temp.u(3);
select pg_temp.assert(not exists (select 1 from public.players where id = pg_temp.u(3)), 'admin gone');
select pg_temp.assert((select reviewed_by from public.radio_shoutouts where handle = 'friend') is null, 'the review mark cleared');

rollback;
