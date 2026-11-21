-- Scenario test for migration 0169 (build mode): home_build_save charges the server's price once and stores the plan,
-- refuses what the bank can't cover, is service-role only, and moving out clears the plan.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000005' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.fails(q text, code text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like code || '%'; end $$;

insert into auth.users (id) select pg_temp.u(11);
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select public.create_player('Builder', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
select pg_temp.assert(pg_temp.fails($$ select public.home_build_save(auth.uid(), '{"v":1}', 0, 'b:aaaaaaaa') $$, 'permission denied'), 'players can''t call it');
reset role;
update public.players set bank_cash = 1000 where id = pg_temp.u(11);
select public.home_build_save(pg_temp.u(11), '{"v":1,"home":"astoria_studio","floors":{}}', 400, 'b:aaaaaaaa');
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(11)) = 600, 'charged C$400');
select pg_temp.assert((select home_plan ->> 'home' from public.players where id = pg_temp.u(11)) = 'astoria_studio', 'stored');
select pg_temp.assert(pg_temp.fails($$ select public.home_build_save(pg_temp.u(11), '{"v":1}', 400, 'b:aaaaaaaa') $$, 'done'), 'the same ref charges once');
select pg_temp.assert(pg_temp.fails($$ select public.home_build_save(pg_temp.u(11), '{"v":1}', 5000, 'b:bbbbbbbb') $$, 'cant_afford'), 'not past the bank');
select public.home_build_save(pg_temp.u(11), '{"v":1,"home":"astoria_studio","floors":{},"paint":"sage"}', 0, 'b:cccccccc');
select pg_temp.assert((select home_plan ->> 'paint' from public.players where id = pg_temp.u(11)) = 'sage', 'a free save stores too');
update public.players set home_id = 'astoria_share' where id = pg_temp.u(11);
select pg_temp.assert((select home_plan from public.players where id = pg_temp.u(11)) is null, 'moving out clears the plan');
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(public.home_plans(array[pg_temp.u(11)]) = '{}', 'home_plans reads plans (none now)');
rollback;
