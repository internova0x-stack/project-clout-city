-- Scenario test for migration 0133 (Steam accounts). Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000161', 'steam-76561197960287930@users.cloutcity.app'),
  ('00000000-0000-0000-0000-000000000162', 'someone@example.com');

-- The server links a Steam id to an account, one each way.
insert into public.steam_accounts (steam_id, user_id, made_here) values ('76561197960287930', '00000000-0000-0000-0000-000000000161', true);
select pg_temp.assert((select count(*) = 1 from public.steam_accounts), 'linked');
do $$ begin
  insert into public.steam_accounts (steam_id, user_id) values ('76561197960287931', '00000000-0000-0000-0000-000000000161');
  raise exception 'FAIL: one Steam id per account';
exception when unique_violation then null; end $$;
do $$ begin
  insert into public.steam_accounts (steam_id, user_id) values ('123', '00000000-0000-0000-0000-000000000162');
  raise exception 'FAIL: a Steam id is 17 digits';
exception when check_violation then null; end $$;

-- A half-made Steam account is found by its address; nothing else is.
select pg_temp.assert(public.steam_user_by_email('steam-76561197960287930@users.cloutcity.app') = '00000000-0000-0000-0000-000000000161', 'found by address');
select pg_temp.assert(public.steam_user_by_email('someone@example.com') is null, 'only Steam-made addresses');

-- Players can't read or write links, or call the lookup.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000162', false);
do $$ begin
  perform 1 from public.steam_accounts;
  raise exception 'FAIL: players read steam_accounts';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.steam_user_by_email('steam-76561197960287930@users.cloutcity.app');
  raise exception 'FAIL: players call the lookup';
exception when insufficient_privilege then null; end $$;
reset role;

-- Deleting the account deletes its link.
delete from auth.users where id = '00000000-0000-0000-0000-000000000161';
select pg_temp.assert((select count(*) = 0 from public.steam_accounts), 'the link goes with the account');

select 'STEAM CHECKS PASSED';
rollback;
