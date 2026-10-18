-- Scenario test for migration 0089 (the creator page: a creator's own numbers, counts only).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000f' || n)::uuid $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'boss@example.com'), (pg_temp.id(2), 'fan@example.com'),
  (pg_temp.id(3), 'Tasha@Example.com'), (pg_temp.id(4), 'nobody@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('cpboss', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
set role authenticated; select pg_temp.as_(1);
select public.admin_creator_save('{"name":"Tasha Glow","code":"TASHA","email":"tasha@example.com","rate":20}');
reset role;
select public.creator_link('tasha'); select public.creator_link('tasha');
set role authenticated;
select pg_temp.as_(2); select 1 from public.create_player('cpfan', 'bodega_drip', '{}', null, true); select public.creator_attach('tasha', null);
reset role;
select public.payment_grant('evt_p1', 'cs_p1', 'pi_p1', pg_temp.id(2), 'chat-unlimited-forever', 3999, 'usd');
select public.creator_commission_record('evt_p1', 'purchase:cs_p1', 'sale', pg_temp.id(2), 'chat-unlimited-forever', 'pi_p1', null, 3999, 146, 0, 'usd');

-- The creator signs in with their email (any case) and sees their own numbers; no creator account sees nothing.
set role authenticated;
select pg_temp.as_(3);
create temp table me as select public.creator_me() j;
select pg_temp.assert((select j ->> 'code' from me) = 'TASHA', 'their code');
select pg_temp.assert((select (j -> 'totals' ->> 'clicks')::int from me) = 2, 'clicks');
select pg_temp.assert((select (j -> 'totals' ->> 'signups')::int from me) = 1, 'sign-ups');
select pg_temp.assert((select (j -> 'totals' ->> 'payers')::int from me) = 1, 'payers');
select pg_temp.assert((select (j -> 'owed' ->> 'heldCents')::int from me) = 771, 'held earnings');
select pg_temp.assert((select (j -> 'links' -> 0 ->> 'earnedCents')::int from me) = 771, 'earnings per link');
select pg_temp.assert((select jsonb_array_length(j -> 'daily') from me) = 30, '30 days');
select pg_temp.assert((select not (j::text like '%cpfan%') and not (j::text like '%fan@example%') from me), 'never a player''s name or email');
select pg_temp.as_(4);
select pg_temp.assert(public.creator_me() is null, 'not a creator');
select pg_temp.as_(2);
select pg_temp.assert(public.creator_me() is null, 'players see nothing');
reset role;

rollback;
\echo 'creator_page: ok'
