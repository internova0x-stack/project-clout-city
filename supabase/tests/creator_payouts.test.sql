-- Scenario test for migration 0090 (creators step 4: payouts by hand).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000a' || n)::uuid $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'boss@example.com'), (pg_temp.id(2), 'fan@example.com'), (pg_temp.id(3), 'tasha@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('poboss', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
set role authenticated; select pg_temp.as_(1);
create temp table t as select public.admin_creator_save('{"name":"Tasha Glow","code":"TASHA","email":"tasha@example.com","rate":30}') id;
select pg_temp.as_(2); select 1 from public.create_player('pofan', 'bodega_drip', '{}', null, true); select public.creator_attach('tasha', null);
reset role;
grant all on t to authenticated;

-- Three sales: two past the hold (payable), one still held.
select public.creator_commission_record('e1', 'purchase:s1', 'sale', pg_temp.id(2), 'x', 'pi1', null, 11999, 378, 0, 'usd');
select public.creator_commission_record('e2', 'purchase:s2', 'sale', pg_temp.id(2), 'x', 'pi2', null, 3999, 146, 0, 'usd');
select public.creator_commission_record('e3', 'purchase:s3', 'sale', pg_temp.id(2), 'x', 'pi3', null, 499, 44, 0, 'usd');
update public.creator_commissions set payable_on = public.ny_today() - 1 where source in ('purchase:s1', 'purchase:s2');

set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.admin_payouts()$$, 'not_admin'), 'payouts are admin only');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_payout_mark('%s', 'paypal')$$, (select id from t)), 'not_admin'), 'marking is admin only');

select pg_temp.as_(1);
-- 30% of (11999 − 378) = 3486; of (3999 − 146) = 1156: 4642 payable, under the $50 minimum.
select pg_temp.assert((public.admin_payouts() -> 'due' -> 0 ->> 'payableCents')::int = 4642, 'payable');
select pg_temp.assert((public.admin_payouts() -> 'due' -> 0 ->> 'heldCents')::int = 137, 'held');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_payout_mark('%s', 'paypal')$$, (select id from t)), 'below_minimum'), 'the $50 minimum');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_payout_mark('%s', 'cash')$$, (select id from t)), 'bad_method'), 'methods');
create temp table po as select public.admin_payout_mark((select id from t), 'paypal', 'PP-123', 'Ending the pilot', true) j;
select pg_temp.assert((select (j ->> 'totalCents')::int from po) = 4642, 'paid what was payable');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_payout_mark('%s', 'paypal', null, null, true)$$, (select id from t)), 'nothing_payable'), 'never twice');
select pg_temp.assert((public.admin_payouts() -> 'history' -> 0 ->> 'reference') = 'PP-123', 'history');
select pg_temp.assert((public.admin_payouts() -> 'history' -> 0 ->> 'items')::int = 2, 'two commissions in it');

-- The creator sees it; held money stays held.
select pg_temp.as_(3);
select pg_temp.assert((public.creator_me() -> 'payouts' -> 0 ->> 'totalCents')::int = 4642, 'on the creator page');
select pg_temp.assert((public.creator_me() -> 'owed' ->> 'paidCents')::int = 4642, 'paid');
select pg_temp.assert((public.creator_me() -> 'owed' ->> 'heldCents')::int = 137, 'still held');

-- A mistake is voided: the history keeps it, the money is payable again.
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises(format($$select public.admin_payout_void(%s, '')$$, (select (j ->> 'id') from po)), 'reason_required'), 'a reason');
select public.admin_payout_void((select (j ->> 'id')::bigint from po), 'Wrong creator');
select pg_temp.assert((public.admin_payouts() -> 'due' -> 0 ->> 'payableCents')::int = 4642, 'payable again');
select pg_temp.assert((public.admin_payouts() -> 'history' -> 0 ->> 'voidReason') = 'Wrong creator', 'kept as voided');
select pg_temp.as_(3);
select pg_temp.assert(jsonb_array_length(public.creator_me() -> 'payouts') = 0, 'voided payouts disappear for the creator');
reset role;

rollback;
\echo 'creator_payouts: ok'
