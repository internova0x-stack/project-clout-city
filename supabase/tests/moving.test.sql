-- Scenario test for migration 0045 (moving up: Sunnyside Gardens, move_home, the moved_up goal).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f3'), ('00000000-0000-0000-0000-0000000000f4');
set role authenticated;
-- Sunnyside can't be picked at sign-up.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f4', false);
select 1 from public.create_player('mover_two', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery();
select pg_temp.assert(pg_temp.raises($$select public.move_in('sunnyside_gardens')$$, 'unknown_home'), 'no Sunnyside at sign-up');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f3', false);
select 1 from public.create_player('mover_one', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 10000, clout = 999 where display_name = 'mover_one';
-- C3 (0094): a studio finishes "Get your own place"; count it paid so its 75 clout doesn't tip this player past 1,000.
insert into public.ledger (player_id, currency, amount, kind, ref) values ('00000000-0000-0000-0000-0000000000f3', 'clout', 0, 'goal', 'own_place');
set role authenticated;

select pg_temp.assert(pg_temp.raises($$select public.move_home('astoria_studio')$$, 'already_home'), 'already living there');
select pg_temp.assert(pg_temp.raises($$select public.move_home('sunnyside_gardens')$$, 'home_needs_clout'), '999 clout is short of Sunnyside');
reset role;
update public.players set clout = 1000 where display_name = 'mover_one';
set role authenticated;
select 1 from public.move_home('sunnyside_gardens');
select pg_temp.assert((select home_id = 'sunnyside_gardens' and moved_up and bank_cash = 10000 - 1500 and next_rent_due = public.ny_today() + 7
                       from public.players where display_name = 'mover_one'), 'moved: C$1,500 paid, moved_up set, next rent in a week');
select pg_temp.assert((select count(*) from public.ledger l join public.players p on p.id = l.player_id
                       where p.display_name = 'mover_one' and l.ref like 'move:sunnyside_gardens:%') = 2, 'rent and broker fee in the ledger');
select pg_temp.assert(pg_temp.raises($$select public.move_home('lic_highrise')$$, 'home_needs_clout'), 'the high-rise needs 3,000 clout');
reset role;
update public.players set clout = 5000, bank_cash = 1000 where display_name = 'mover_one';
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.move_home('lic_highrise')$$, 'cant_afford'), 'C$2,100 to move');
-- Moving down is allowed and keeps the goal.
reset role;
update public.players set bank_cash = 10000 where display_name = 'mover_one';
set role authenticated;
select 1 from public.move_home('astoria_studio');
select pg_temp.assert((select home_id = 'astoria_studio' and moved_up from public.players where display_name = 'mover_one'), 'moved down, goal kept');

rollback;
\echo MOVING CHECKS PASSED
