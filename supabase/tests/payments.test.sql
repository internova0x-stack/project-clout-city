-- Scenario test for migration 0008 (payments: side stories). Run with scripts/test-db.sh.
-- Runs in a transaction and rolls back, so later tests see a clean database.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
-- The side story as one player sees it in their feed.
create function pg_temp.side(p_sku text) returns jsonb language sql as $$
  select a from jsonb_array_elements(public.story_feed() -> 'arcs') a where a ->> 'sku' = p_sku $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000040'), ('00000000-0000-0000-0000-000000000041');
update public.game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000040', false);
select 1 from public.create_player('Kim', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', false);
select 1 from public.create_player('Lee', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
select 1 from public.dev_story_start('sarah-bird', public.ny_today() - 4); -- Day 5: two Momager beats out

-- ---- The catalog, and a pending purchase ----
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000040', false);
select pg_temp.assert(jsonb_array_length(public.store_catalog()) = 3, 'three side stories for sale');
select pg_temp.assert((select bool_and(not (p ->> 'owned')::boolean and (p ->> 'priceCents')::int = 299) from jsonb_array_elements(public.store_catalog()) p), '$2.99, not owned');
select public.start_purchase('side_sarah_bird_momager_files', 'cs_test_1');
select pg_temp.assert((select (p ->> 'pending')::boolean from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = 'side_sarah_bird_momager_files'), 'pending after checkout starts');
select pg_temp.assert((select not (p ->> 'owned')::boolean from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = 'side_sarah_bird_momager_files'), 'pending grants nothing');
select pg_temp.assert((pg_temp.side('side_sarah_bird_momager_files') ->> 'entitled')::boolean is false, 'still locked while pending');
select pg_temp.assert(pg_temp.side('side_sarah_bird_momager_files') #> '{beats,0,body}' is null, 'locked beats carry no text');
do $$ begin
  begin perform public.start_purchase('no_such_sku', 'cs_test_2'); raise exception 'FAIL: unknown sku';
  exception when sqlstate '22023' then null; end;
  begin perform public.start_purchase('side_sarah_bird_night_book', 'not a session'); raise exception 'FAIL: bad session id';
  exception when sqlstate '22023' then null; end;
  -- Only the webhook (service role) grants: players can't call it or write entitlements.
  begin perform public.payment_grant('evt_x', 'cs_x', 'pi_x', auth.uid(), 'side_sarah_bird_night_book', 299, 'usd'); raise exception 'FAIL: player granted';
  exception when insufficient_privilege then null; end;
  begin insert into public.entitlements (player_id, sku, product_type) values (auth.uid(), 'side_sarah_bird_night_book', 'side_arc'); raise exception 'FAIL: direct insert';
  exception when insufficient_privilege then null; end;
  begin perform public.payment_refund('evt_y', 'pi_y'); raise exception 'FAIL: player refunded';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- The webhook grants, once ----
reset role;
create temp table before as select clout from public.players where display_name = 'Kim';
select pg_temp.assert(public.payment_grant('evt_1', 'cs_test_1', 'pi_1', '00000000-0000-0000-0000-000000000040', 'side_sarah_bird_momager_files', 299, 'usd') = 'granted', 'webhook grants');
select pg_temp.assert(public.payment_grant('evt_1', 'cs_test_1', 'pi_1', '00000000-0000-0000-0000-000000000040', 'side_sarah_bird_momager_files', 299, 'usd') = 'duplicate', 'replayed event is a no-op');
select pg_temp.assert(public.payment_grant('evt_1b', 'cs_test_1', 'pi_1', '00000000-0000-0000-0000-000000000040', 'side_sarah_bird_momager_files', 299, 'usd') = 'granted', 'a second delivery of the same purchase');
select pg_temp.assert((select count(*) = 1 from public.entitlements where sku = 'side_sarah_bird_momager_files'), 'one entitlement, never two');
select pg_temp.assert((select status = 'paid' and amount_cents = 299 from public.purchases where stripe_session_id = 'cs_test_1'), 'purchase marked paid');
select pg_temp.assert((select clout from public.players where display_name = 'Kim') = (select clout from before), 'side stories pay no clout');
select pg_temp.assert(public.payment_grant('evt_2', 'cs_test_9', 'pi_9', '00000000-0000-0000-0000-000000000040', 'nope', 299, 'usd') = 'unknown_product', 'unknown products grant nothing');

set role authenticated;
select pg_temp.assert((pg_temp.side('side_sarah_bird_momager_files') ->> 'entitled')::boolean, 'unlocked for the buyer');
select pg_temp.assert(pg_temp.side('side_sarah_bird_momager_files') #> '{beats,0,body}' is not null, 'catch-up: released beats readable');
select pg_temp.assert((select (p ->> 'owned')::boolean and not (p ->> 'pending')::boolean from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = 'side_sarah_bird_momager_files'), 'owned, no longer pending');
select pg_temp.assert((pg_temp.side('side_sarah_bird_night_book') ->> 'entitled')::boolean is false, 'other side stories stay locked');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', false);
select pg_temp.assert(pg_temp.side('side_sarah_bird_momager_files') #> '{beats,0,body}' is null, 'someone who did not pay gets no text');
select pg_temp.assert((select count(*) = 0 from public.entitlements), 'players only see their own entitlements');

-- ---- Refund: locked again ----
reset role;
select pg_temp.assert(public.payment_refund('evt_3', 'pi_1') = 'revoked', 'refund revokes');
select pg_temp.assert(public.payment_refund('evt_3', 'pi_1') = 'duplicate', 'replayed refund is a no-op');
select pg_temp.assert((select status = 'refunded' from public.purchases where stripe_session_id = 'cs_test_1'), 'purchase marked refunded');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000040', false);
select pg_temp.assert((pg_temp.side('side_sarah_bird_momager_files') ->> 'entitled')::boolean is false, 'locked again after refund');
select pg_temp.assert(pg_temp.side('side_sarah_bird_momager_files') #> '{beats,0,body}' is null, 'beats back to teasers');

-- ---- Clawback for products that pay clout (events, collector items): exact, never below zero ----
reset role;
insert into public.entitlements (player_id, sku, product_type, stripe_session_id, stripe_payment_id)
values ('00000000-0000-0000-0000-000000000041', 'side_sarah_bird_plus_one', 'side_arc', 'cs_clout', 'pi_clout');
select public.ledger_once('00000000-0000-0000-0000-000000000041', 'clout', 50, 'purchase_clout', 'cs_clout');
update public.players set clout = 30 where display_name = 'Lee';
select pg_temp.assert(public.payment_refund('evt_4', 'pi_clout') = 'revoked', 'refund with clout');
select pg_temp.assert((select clout = 0 from public.players where display_name = 'Lee'), 'clawback stops at zero');
select pg_temp.assert((select amount = -30 from public.ledger where kind = 'refund_clout' and ref = 'cs_clout'), 'clawback is logged');
select pg_temp.assert((select count(*) = 5 from public.stripe_events), 'every event logged once (1, 1b, 2, 3, 4)');

select 'PAYMENT CHECKS PASSED' as result;
rollback;
