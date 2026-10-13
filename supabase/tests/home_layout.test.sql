-- Scenario test for migration 0006 (saved home layouts). Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000020');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000020', false);
select 1 from public.create_player('Hal', 'bodega_drip', '{}', null, true);
select public.save_home_layout('[{"id": "sofa", "x": 0.5, "z": 1.25, "rot": 2}]');
select pg_temp.assert((select home_layout -> 0 ->> 'id' = 'sofa' from public.players where display_name = 'Hal'), 'layout saved');
do $$ begin
  begin perform public.save_home_layout('[{"id": "sofa", "x": 99, "z": 0, "rot": 0}]'); raise exception 'FAIL: far away accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.save_home_layout('[{"id": "sofa", "x": 0, "z": 0, "rot": 5}]'); raise exception 'FAIL: bad rotation accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.save_home_layout('{"id": "sofa"}'); raise exception 'FAIL: object accepted';
  exception when sqlstate '22023' then null; end;
  begin update public.players set home_layout = '[]'; if found then raise exception 'FAIL: direct write'; end if;
  exception when insufficient_privilege then null; end;
end $$;
select 'LAYOUT CHECKS PASSED' as result;
