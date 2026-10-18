-- Scenario test for migration 0079 (Membership & purchases): the screen's data, the server's billing lookup,
-- saving the Stripe customer, and who may call what.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000079a1'), ('00000000-0000-0000-0000-0000000079a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000079a2', false);
select 1 from public.create_player('Other', 'bodega_drip', '{}', null, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000079a1', false);
select 1 from public.create_player('Member', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');

-- Nothing bought: no plan, no purchases, no customer.
select pg_temp.assert(public.membership_state() -> 'vip' = 'null'::jsonb, 'not a VIP');
select pg_temp.assert(public.membership_state() -> 'purchases' = '[]'::jsonb, 'no purchases');
select pg_temp.assert(not (public.membership_state() ->> 'hasCustomer')::boolean, 'no customer');

-- The browser can't save a customer or read the billing ids.
select pg_temp.assert(pg_temp.raises($$select public.payment_customer(auth.uid(), 'cus_mine')$$, 'permission denied'), 'no customer writes');
select pg_temp.assert(pg_temp.raises($$select public.membership_billing(auth.uid())$$, 'permission denied'), 'no billing reads');
select pg_temp.assert(pg_temp.raises($$select * from public.stripe_customers$$, 'permission denied')
  or not exists (select 1 from public.stripe_customers), 'customers hidden');

-- A yearly VIP and a story, paid; a pending checkout isn't listed.
select 1 from public.start_purchase('chat-unlimited-yearly', 'cs_m_year');
select 1 from public.start_purchase('side_sarah_bird_momager_files', 'cs_m_story');
reset role;
select public.payment_grant('evt_m1', 'cs_m_year', 'sub_m_year', '00000000-0000-0000-0000-0000000079a1', 'chat-unlimited-yearly', 3999, 'usd');
select public.payment_customer('00000000-0000-0000-0000-0000000079a1', 'cus_m1');
select public.payment_customer('00000000-0000-0000-0000-0000000079a1', 'not-a-customer');
select pg_temp.assert((public.membership_billing('00000000-0000-0000-0000-0000000079a1') ->> 'customer') = 'cus_m1', 'customer saved, junk ignored');
select pg_temp.assert((public.membership_billing('00000000-0000-0000-0000-0000000079a1') ->> 'subscription') = 'sub_m_year', 'the VIP subscription');
select pg_temp.assert(public.membership_billing('00000000-0000-0000-0000-0000000079a1') -> 'sessions' = '["cs_m_year"]'::jsonb, 'paid sessions only');
select pg_temp.assert(public.membership_billing('00000000-0000-0000-0000-0000000079a2') ->> 'customer' is null, 'someone else has none');

set role authenticated;
select pg_temp.assert(public.membership_state() -> 'vip' ->> 'sku' = 'chat-unlimited-yearly', 'VIP yearly');
select pg_temp.assert((public.membership_state() -> 'vip' ->> 'priceCents')::int = 3999, 'its catalog price');
select pg_temp.assert(jsonb_array_length(public.membership_state() -> 'purchases') = 1, 'the pending story is not listed');
select pg_temp.assert(public.membership_state() -> 'purchases' -> 0 ->> 'id' not like 'cs_%', 'no session ids');
select pg_temp.assert((public.membership_state() ->> 'hasCustomer')::boolean, 'has a customer');

-- Someone else sees only their own.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000079a2', false);
select pg_temp.assert(public.membership_state() -> 'purchases' = '[]'::jsonb and public.membership_state() -> 'vip' = 'null'::jsonb, 'own purchases only');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000079a1', false);

-- Cancelled at the end of the period: Stripe ends the subscription, the plan leaves, the purchase stays.
reset role;
select public.payment_subscription('evt_m2', 'sub_m_year', 'canceled');
set role authenticated;
select pg_temp.assert(public.membership_state() -> 'vip' = 'null'::jsonb, 'VIP over');
select pg_temp.assert(public.membership_state() -> 'purchases' -> 0 ->> 'name' is not null, 'the receipt stays');

rollback;
\echo 'membership: ok'
