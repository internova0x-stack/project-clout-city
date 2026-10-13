-- Scenario test for migration 0014 (usernames).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || n)::uuid $$;

insert into auth.users (id) select pg_temp.id(n) from generate_series(81, 83) n;
-- A name claimed before usernames (with a space) stays as it is.
insert into public.players (id, display_name, starting_style, look, invite_code, age_confirmed_at)
values (pg_temp.id(83), 'Old Timer', 'bodega_drip', '{}', public.generate_invite_code(), now());
set role authenticated;

select pg_temp.as_(81);
do $$ begin
  begin perform public.create_player('Big Sal', 'bodega_drip', '{}', null, true); raise exception 'FAIL: a space got in';
  exception when others then if sqlerrm not like '%name_format%' then raise; end if; end;
  begin perform public.create_player('ab', 'bodega_drip', '{}', null, true); raise exception 'FAIL: two letters got in';
  exception when others then if sqlerrm not like '%name_format%' then raise; end if; end;
  begin perform public.create_player('o''neil', 'bodega_drip', '{}', null, true); raise exception 'FAIL: an apostrophe got in';
  exception when others then if sqlerrm not like '%name_format%' then raise; end if; end;
end $$;
select 1 from public.create_player('  @Big_Sal ', 'bodega_drip', '{}', null, true);
select pg_temp.assert((select display_name from public.players where id = pg_temp.id(81)) = 'Big_Sal', 'the @ and spaces are dropped');

select pg_temp.as_(82);
select pg_temp.assert(public.is_name_available('@big_sal') = false, 'taken, ignoring @ and capitals');
select pg_temp.assert(public.is_name_available('old timer') = false, 'older names still count as taken');
do $$ begin
  begin perform public.create_player('BIG_SAL', 'bodega_drip', '{}', null, true); raise exception 'FAIL: same name, other capitals';
  exception when others then if sqlerrm not like '%name_taken%' then raise; end if; end;
end $$;
select pg_temp.assert(public.is_name_available('j.lo_2'), 'a fresh username is free');

select 'usernames: ok';
rollback;
