-- Scenario test for migration 0039 (v0.11 economy recalibration, owner Oct 14): a work day is at most
-- three shifts across every job, and the new prices and rents are live.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select 1 from public.create_player('worker', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, bank_cash = 1000 where display_name = 'worker';
set role authenticated;

-- The settings carry the new numbers.
select pg_temp.assert((public.city() -> 'economy' ->> 'shiftsPerDay')::int = 3, 'three shifts a day');
reset role;
select pg_temp.assert(public.rent_for('astoria_studio') = 1750 and public.rent_for('lic_highrise') = 4500, 'new weekly rents');
set role authenticated;

-- Three shifts across two jobs, then the fourth is refused.
select 1 from public.travel('grind-and-gossip', 'taxi');
select pg_temp.assert((public.do_action('grind-and-gossip', 'shift') ->> 'cash')::int >= 120, 'first shift pays');
select 1 from public.do_action('grind-and-gossip', 'shift');
select 1 from public.travel('pedal-pushers', 'taxi');
reset role;
update public.players set energy = 100 where display_name = 'worker';
set role authenticated;
select 1 from public.do_action('pedal-pushers', 'shift');
select pg_temp.assert(pg_temp.raises($$select public.do_action('pedal-pushers', 'shift')$$, 'shift_limit'), 'no fourth shift today, at any job');
select pg_temp.assert((select count(*) = 3 from public.ledger where player_id = auth.uid() and kind = 'shift'), 'three shifts in the ledger');

rollback;
\echo ECONOMY RECALIBRATION CHECKS PASSED
