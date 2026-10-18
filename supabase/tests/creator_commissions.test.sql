-- Scenario test for migration 0088 (creators step 2: commissions, refunds, the hold, the Studio's numbers).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000d' || n)::uuid $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'boss@example.com'), (pg_temp.id(2), 'fan@example.com'),
  (pg_temp.id(3), 'other@example.com'), (pg_temp.id(4), 'late@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('ccboss', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
set role authenticated; select pg_temp.as_(1);
create temp table t as select public.admin_creator_save('{"name":"Tasha Glow","code":"TASHA","rate":20,"months":12}') id;
reset role;
grant all on t to authenticated;

-- A referred player and one who isn't.
set role authenticated;
select pg_temp.as_(2); select 1 from public.create_player('ccfan', 'bodega_drip', '{}', null, true); select public.creator_attach('tasha', null);
select pg_temp.as_(3); select 1 from public.create_player('ccother', 'bodega_drip', '{}', null, true);
reset role;

-- Only the server records commissions.
select pg_temp.assert(not has_function_privilege('authenticated', 'public.creator_commission_record(text, text, text, uuid, text, text, text, int, int, int, text, boolean)', 'execute'), 'record is server only');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.creator_commission_refund(text, text, text, int, int)', 'execute'), 'refund is server only');
select pg_temp.assert(public.creator_referred(pg_temp.id(2)) and not public.creator_referred(pg_temp.id(3)), 'who is referred');

-- A $39.99 sale: net = 3999 - 146 fee - 0 tax = 3853; 20% = 771, held for 45 days.
select public.payment_grant('evt_c1', 'cs_c1', 'pi_c1', pg_temp.id(2), 'chat-unlimited-forever', 3999, 'usd');
select pg_temp.assert(public.creator_commission_record('evt_c1', 'purchase:cs_c1', 'sale', pg_temp.id(2), 'chat-unlimited-forever', 'pi_c1', null, 3999, 146, 0, 'usd') = 'recorded', 'recorded');
select pg_temp.assert(public.creator_commission_record('evt_c1b', 'purchase:cs_c1', 'sale', pg_temp.id(2), 'chat-unlimited-forever', 'pi_c1', null, 3999, 146, 0, 'usd') = 'duplicate', 'once per payment');
select pg_temp.assert((select commission_cents from public.creator_commissions where source = 'purchase:cs_c1') = 771, '20% of net');
select pg_temp.assert((select payable_on from public.creator_commissions where source = 'purchase:cs_c1') = public.ny_today() + 45, '45-day hold');
select pg_temp.assert(public.creator_commission_record('evt_c2', 'purchase:cs_c2', 'sale', pg_temp.id(3), 'x', 'pi_c2', null, 499, 44, 0, 'usd') = 'not_referred', 'unreferred players earn nothing');

-- The rate on the day of the payment; a renewal by invoice.
update public.creators set rate = 30;
select public.payment_renewal('evt_r1', 'sub_x', 499, 'usd');
select pg_temp.assert(public.creator_commission_record('evt_r1', 'renewal:in_1', 'renewal', pg_temp.id(2), 'chat-unlimited-monthly', null, 'in_1', 499, 44, 40, 'usd') = 'recorded', 'renewal');
select pg_temp.assert((select commission_cents from public.creator_commissions where source = 'renewal:in_1') = 125, '30% of 415');

-- Refunds: a half refund takes back half, the full refund the rest; replays add nothing.
select pg_temp.assert(public.creator_commission_refund('evt_f1', 'pi_c1', null, 2000, 3999) = 1, 'partial refund');
select pg_temp.assert((select sum(commission_cents) from public.creator_commissions where source = 'purchase:cs_c1') = 771 - 386, 'half back');
select pg_temp.assert(public.creator_commission_refund('evt_f1', 'pi_c1', null, 2000, 3999) = 0, 'replay adds nothing');
select pg_temp.assert(public.creator_commission_refund('evt_f2', 'pi_c1', null, 3999, 3999) = 1, 'full refund');
select pg_temp.assert((select sum(commission_cents) from public.creator_commissions where source = 'purchase:cs_c1') = 0, 'all back');
select pg_temp.assert(public.creator_commission_refund('evt_f3', null, 'in_1', 499, 499) = 1, 'refund by invoice');

-- Outside the window, nothing.
update public.creator_referrals set commission_until = now() - interval '1 day';
select pg_temp.assert(public.creator_commission_record('evt_r2', 'renewal:in_2', 'renewal', pg_temp.id(2), 'chat-unlimited-monthly', null, 'in_2', 499, 44, 0, 'usd') = 'window_over', 'window over');
update public.creator_referrals set commission_until = null;

-- Held, payable, paid.
select public.creator_commission_record('evt_r3', 'renewal:in_3', 'renewal', pg_temp.id(2), 'chat-unlimited-monthly', null, 'in_3', 1000, 59, 0, 'usd');
update public.creator_commissions set payable_on = public.ny_today() - 1 where source = 'renewal:in_3';
select pg_temp.assert((public.creator_owed((select id from t)) ->> 'payableCents')::int = 282, 'payable after the hold');
select pg_temp.assert((public.creator_owed((select id from t)) ->> 'heldCents')::int = 0, 'nothing held: the rest was refunded');

-- The Studio: admins only, with the money.
set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.admin_affiliates_overview()$$, 'not_admin'), 'overview is admin only');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_creator('%s')$$, (select id from t)), 'not_admin'), 'creator page is admin only');
select pg_temp.as_(1);
create temp table ov as select public.admin_affiliates_overview(30) j;
select pg_temp.assert((select (j -> 'totals' ->> 'signups')::int from ov) = 1, 'overview sign-ups');
select pg_temp.assert((select (j -> 'totals' ->> 'payableCents')::int from ov) = 282, 'overview payable');
select pg_temp.assert((select jsonb_array_length(j -> 'daily') from ov) = 30, 'a day per day');
create temp table pg as select public.admin_creator((select id from t), 30) j;
select pg_temp.assert((select j -> 'players' -> 0 ->> 'name' from pg) = 'ccfan', 'the player list');
select pg_temp.assert((select (j -> 'funnel' ->> 'signups')::int from pg) = 1, 'funnel');
select pg_temp.assert((select jsonb_array_length(j -> 'commissions') from pg) = 6, 'commission history with reversals');
select pg_temp.assert((select (public.admin_creators(30) -> 'creators' -> 0 -> 'owed' ->> 'payableCents')::int) = 282, 'owed on the creator list');
reset role;

rollback;
\echo 'creator_commissions: ok'
