-- Scenario test for migration 0130 (security review: one open checkout per product, held copies per player, the saved
-- Stripe customer kept, push devices at the browsers' push services, signed-out calls refused).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_player(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000013' || n, false) $$;
create function pg_temp.raises(p_sql text, p_code text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then return sqlerrm = p_code;
end $$;
create function pg_temp.status(p_session text) returns text language sql as $$
  select status from public.purchases where stripe_session_id = p_session $$;

insert into auth.users (id) select ('00000000-0000-0000-0000-00000000013' || n)::uuid from generate_series(1, 3) n;
set role authenticated;
do $$ begin
  for n in 1..3 loop
    perform pg_temp.as_player(n);
    perform public.create_player('Guard' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;

insert into public.shop_catalog (sku, status, tab, slot, name, description, price, clout, stars, real_cash, price_usd_cents, edition_size,
                                 collection, origin, extra, go_live_at)
values ('guard-sofa', 'live', 'home', 'living', 'Guard Sofa', 'A sofa for the test.', 0, 30, 4, true, 1499, 2,
        'Clout Couture', 'import', '{}', now());

-- ---- A second checkout replaces the first: one copy held, the old session handed back to be expired ----
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(public.start_purchase('guard-sofa', 'cs_g_1') = '{}'::text[], 'first checkout replaces nothing');
select pg_temp.assert(public.start_purchase('guard-sofa', 'cs_g_2') = array['cs_g_1'], 'the second replaces the first');
select pg_temp.assert(pg_temp.status('cs_g_1') = 'expired' and pg_temp.status('cs_g_2') = 'pending', 'only the newest is open');
select pg_temp.assert(public.start_purchase('guard-sofa', 'cs_g_3') = array['cs_g_2'], 'retrying never hits sold out on your own hold');
reset role;
select pg_temp.assert((public.couture_edition('guard-sofa') ->> 'left')::int = 1, 'one player holds one copy');
-- Fake sessions from one account can't hold the whole drop.
insert into public.purchases (stripe_session_id, player_id, sku) values ('cs_g_fake', '00000000-0000-0000-0000-000000000131', 'guard-sofa');
select pg_temp.assert((public.couture_edition('guard-sofa') ->> 'left')::int = 1, 'held copies count once per player');
set role authenticated;
select pg_temp.as_player(2);
select public.start_purchase('guard-sofa', 'cs_g_p2');
select pg_temp.as_player(3);
select pg_temp.assert(pg_temp.raises($$select public.start_purchase('guard-sofa', 'cs_g_p3')$$, 'sold_out'), 'two players hold both copies');

-- ---- Chat plans count as one product ----
select pg_temp.as_player(2);
select pg_temp.assert(public.start_purchase('chat-unlimited-monthly', 'cs_c_m') = '{}'::text[], 'monthly checkout');
select pg_temp.assert(public.start_purchase('chat-unlimited-forever', 'cs_c_f') = array['cs_c_m'], 'forever replaces the monthly checkout');
select pg_temp.assert(pg_temp.status('cs_g_p2') = 'pending', 'other products keep their checkout');
reset role;

-- ---- The saved Stripe customer is kept ----
select public.payment_customer('00000000-0000-0000-0000-000000000131', 'cus_first');
select public.payment_customer('00000000-0000-0000-0000-000000000131', 'cus_second');
select pg_temp.assert((select customer_id from public.stripe_customers where player_id = '00000000-0000-0000-0000-000000000131') = 'cus_first',
                      'a later payment never swaps the customer');
select pg_temp.assert(public.refund_is_subscription('pi_vip', 'cus_first'), 'a refund that bought nothing one-off is the VIP plan');
update public.purchases set stripe_payment_id = 'pi_sofa' where stripe_session_id = 'cs_g_3';
select pg_temp.assert(not public.refund_is_subscription('pi_sofa', 'cus_first'), 'a one-off purchase is not');
select pg_temp.assert(not public.refund_is_subscription('pi_vip', 'cus_stranger'), 'nor a customer who is no player');

-- ---- Push devices: push services only; someone else's device stays theirs ----
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(pg_temp.raises($$select public.push_subscribe('https://169.254.169.254/x', 'k', 'a', 'UTC')$$, 'bad_subscription'), 'no internal address');
select pg_temp.assert(pg_temp.raises($$select public.push_subscribe('https://fcm.googleapis.com.evil.example/x', 'k', 'a', 'UTC')$$, 'bad_subscription'), 'no look-alike host');
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/dev1', 'key1', 'auth1', 'UTC');
select pg_temp.as_player(2);
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/dev1', 'stolen', 'stolen', 'UTC');
reset role;
select pg_temp.assert((select player_id = '00000000-0000-0000-0000-000000000131' and p256dh = 'key1' from public.push_subscriptions
                        where endpoint = 'https://fcm.googleapis.com/fcm/send/dev1'), 'another account cannot take the device');
set role authenticated;
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/dev1', 'key1', 'auth1', 'UTC');
reset role;
select pg_temp.assert((select player_id = '00000000-0000-0000-0000-000000000132' from public.push_subscriptions
                        where endpoint = 'https://fcm.googleapis.com/fcm/send/dev1'), 'the same browser, signed in to another account, moves');

-- ---- Signed out: no longer callable ----
select pg_temp.assert(not has_function_privilege('anon', 'public.session_ping()', 'execute'), 'session_ping is signed-in only');
select pg_temp.assert(has_function_privilege('authenticated', 'public.session_ping()', 'execute'), 'and still works signed in');
select pg_temp.assert(not has_function_privilege('anon', 'public.start_purchase(text, text)', 'execute'), 'start_purchase signed-in only');

rollback;
\echo security_review: ok
