-- Scenario test for migration 0125 (chargebacks): an open dispute is recorded and takes nothing; a lost one revokes
-- like a full refund, once; a won one changes nothing; a lost dispute on a VIP charge asks the webhook to cancel.
-- Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000001251');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001251', false);
select 1 from public.create_player('Disputer', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
select 1 from public.start_purchase('side_sarah_bird_momager_files', 'cs_d1');
select 1 from public.start_purchase('side_sarah_bird_night_book', 'cs_d2');
do $$ begin
  begin perform public.payment_dispute('evt_x', 'dp_x', 'pi_d1', 299, 'usd', 'fraudulent', 'lost'); raise exception 'FAIL: player disputed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.payment_disputes; raise exception 'FAIL: player read disputes';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 1 from public.payment_grant('evt_g1', 'cs_d1', 'pi_d1', '00000000-0000-0000-0000-000000001251', 'side_sarah_bird_momager_files', 299, 'usd');
select 1 from public.payment_grant('evt_g2', 'cs_d2', 'pi_d2', '00000000-0000-0000-0000-000000001251', 'side_sarah_bird_night_book', 299, 'usd');

-- ---- Opened: recorded, nothing taken ----
select pg_temp.assert(public.payment_dispute('evt_o1', 'dp_1', 'pi_d1', 299, 'usd', 'fraudulent', 'open') ->> 'result' = 'open', 'open recorded');
select pg_temp.assert((select status = 'open' and player_id = '00000000-0000-0000-0000-000000001251' from public.payment_disputes where id = 'dp_1'), 'the dispute names the player');
select pg_temp.assert((select status = 'active' from public.entitlements where sku = 'side_sarah_bird_momager_files'), 'still owned while open');
select pg_temp.assert(public.payment_dispute('evt_o1', 'dp_1', 'pi_d1', 299, 'usd', 'fraudulent', 'open') ->> 'result' = 'duplicate', 'a replayed event is a no-op');

-- ---- Lost: revoked like a full refund, once ----
select pg_temp.assert(public.payment_dispute('evt_c1', 'dp_1', 'pi_d1', 299, 'usd', 'fraudulent', 'lost') ->> 'revoked' = 'revoked', 'lost revokes');
select pg_temp.assert((select status = 'revoked' from public.entitlements where sku = 'side_sarah_bird_momager_files'), 'entitlement revoked');
select pg_temp.assert((select status = 'refunded' from public.purchases where stripe_session_id = 'cs_d1'), 'purchase counts as refunded');
select pg_temp.assert((select status = 'lost' and closed_at is not null from public.payment_disputes where id = 'dp_1'), 'dispute closed as lost');
select pg_temp.assert(public.payment_dispute('evt_c1', 'dp_1', 'pi_d1', 299, 'usd', 'fraudulent', 'lost') ->> 'result' = 'duplicate', 'a retry revokes nothing more');
select pg_temp.assert(not (public.payment_dispute('evt_c1b', 'dp_1', 'pi_d1', 299, 'usd', 'fraudulent', 'lost') -> 'subscription_charge')::boolean, 'a second lost event on a purchase never cancels VIP');
select pg_temp.assert((select status = 'active' from public.entitlements where sku = 'side_sarah_bird_night_book'), 'the other purchase is untouched');

-- ---- Won: nothing changes ----
select 1 from public.payment_dispute('evt_o2', 'dp_2', 'pi_d2', 299, 'usd', 'product_not_received', 'open');
select pg_temp.assert(public.payment_dispute('evt_c2', 'dp_2', 'pi_d2', 299, 'usd', 'product_not_received', 'won') ->> 'result' = 'won', 'won recorded');
select pg_temp.assert((select status = 'active' from public.entitlements where sku = 'side_sarah_bird_night_book'), 'still owned after a win');
select pg_temp.assert((select status = 'paid' from public.purchases where stripe_session_id = 'cs_d2'), 'purchase still paid');
select pg_temp.assert(public.payment_dispute('evt_c3', 'dp_3', 'pi_d3', 299, 'usd', 'general', 'warning_closed') ->> 'result' = 'closed', 'other closings are just closed');

-- ---- Lost on a VIP charge: the player is found by customer, and the webhook is told to cancel ----
insert into public.stripe_customers (player_id, customer_id) values ('00000000-0000-0000-0000-000000001251', 'cus_d');
select pg_temp.assert((public.payment_dispute('evt_c4', 'dp_4', 'pi_renewal', 499, 'usd', 'fraudulent', 'lost', 'cus_d') -> 'subscription_charge')::boolean, 'VIP charge: cancel the subscription');
select pg_temp.assert((select player_id = '00000000-0000-0000-0000-000000001251' from public.payment_disputes where id = 'dp_4'), 'found by customer');
select pg_temp.assert(not (public.payment_dispute('evt_c5', 'dp_5', 'pi_unknown', 499, 'usd', 'fraudulent', 'lost', 'cus_nobody') -> 'subscription_charge')::boolean, 'nobody known: nothing to cancel');
rollback;
