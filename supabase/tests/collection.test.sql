-- Scenario test for migration 0022 (the Collection: serial numbers and collected dates).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.product(p_sku text) returns jsonb language sql as $$
  select p from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = p_sku $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2'), ('00000000-0000-0000-0000-0000000000c3');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select 1 from public.create_player('first_in', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select 1 from public.create_player('second_in', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select 1 from public.create_player('third_in', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;

-- Three players collect the Unisphere postcard, in order (the webhook grants; created_at sets the order).
select public.payment_grant('evt_c1', 'cs_c1', 'pi_c1', '00000000-0000-0000-0000-0000000000c1', 'postcard-unisphere', 99, 'usd');
update public.entitlements set created_at = now() - interval '3 days' where player_id = '00000000-0000-0000-0000-0000000000c1';
select public.payment_grant('evt_c2', 'cs_c2', 'pi_c2', '00000000-0000-0000-0000-0000000000c2', 'postcard-unisphere', 99, 'usd');
update public.entitlements set created_at = now() - interval '2 days' where player_id = '00000000-0000-0000-0000-0000000000c2';
select public.payment_grant('evt_c3', 'cs_c3', 'pi_c3', '00000000-0000-0000-0000-0000000000c3', 'postcard-unisphere', 99, 'usd');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select pg_temp.assert((pg_temp.product('postcard-unisphere') ->> 'serial')::int = 2, 'the second collector holds No. 2');
select pg_temp.assert(pg_temp.product('postcard-unisphere') ->> 'ownedAt' is not null, 'collected date');
select pg_temp.assert(pg_temp.product('postcard-gantry-plaza') ->> 'serial' is null, 'no serial on cards not owned');
reset role;

-- A refund doesn't renumber anyone; the refunded player has no serial.
select public.payment_refund('evt_c1r', 'pi_c1');
set role authenticated;
select pg_temp.assert((pg_temp.product('postcard-unisphere') ->> 'serial')::int = 2, 'numbers never change');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select pg_temp.assert((pg_temp.product('postcard-unisphere') ->> 'serial')::int = 3, 'third collector holds No. 3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert(pg_temp.product('postcard-unisphere') ->> 'serial' is null, 'refunded copy has no serial');

rollback;
\echo COLLECTION CHECKS PASSED
