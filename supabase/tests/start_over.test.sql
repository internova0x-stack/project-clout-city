-- Scenario test for migration 0114 (Start over): what a restart keeps and resets, the creator again, once in 30 days.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, code text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return sqlerrm like '%' || code || '%'; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000114a1'), ('00000000-0000-0000-0000-0000000114a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000114a1', false);
select 1 from public.create_player('again', 'bodega_drip', '{}', null, true);
select invite_code as code from public.players where display_name = 'again' \gset
select pg_temp.assert(pg_temp.raises($$select public.restart_player()$$, 'nothing_to_restart'), 'nothing to restart before moving in');
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000114a2', false);
select 1 from public.create_player('crewmate', 'bodega_drip', '{}', :'code', true);

reset role;
update public.players set bank_cash = 9999, clout = 4321, best_rank = 3 where display_name = 'again';
insert into public.player_items (player_id, sku, category, value, acquired, equipped)
values ('00000000-0000-0000-0000-0000000114a1', 'col-faux-chinchilla', 'fashion', 100, 'collector', true);
insert into public.player_badges (player_id, badge_id, arc_id) values ('00000000-0000-0000-0000-0000000114a1', 'first-party', 'city');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000114a1', false);
select 1 from public.buy_item('fit-varsity-tee', 'buy');
select pg_temp.assert((public.restart_status() ->> 'can')::boolean, 'can start over');

select 1 from public.restart_player();
reset role;
select pg_temp.assert((select home_id is null and bank_cash = 0 and clout = 0 and best_rank = 1 and birth_cash is null and traits is null
                         and onboarding_step = 'look_done' and display_name = 'again' and invite_code = :'code'
                       from public.players where display_name = 'again'), 'progress reset, name and invite code kept');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = '00000000-0000-0000-0000-0000000114a1' and sku = 'fit-varsity-tee'), 'C$ items gone');
select pg_temp.assert((select not equipped from public.player_items where player_id = '00000000-0000-0000-0000-0000000114a1' and sku = 'col-faux-chinchilla'), 'real-money piece kept, taken off');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = '00000000-0000-0000-0000-0000000114a1'), 'badges kept');
select pg_temp.assert(exists (select 1 from public.invites where inviter_id = '00000000-0000-0000-0000-0000000114a1'), 'crew kept');
select pg_temp.assert(not exists (select 1 from public.ledger where player_id = '00000000-0000-0000-0000-0000000114a1'), 'ledger starts empty');
select pg_temp.assert((select count(*) > 0 from public.ledger_archive where player_id = '00000000-0000-0000-0000-0000000114a1' and kind = 'birth_lottery'), 'old ledger archived');
select pg_temp.assert(not exists (select 1 from public.bills where player_id = '00000000-0000-0000-0000-0000000114a1'), 'bills cleared');
set role authenticated;

-- Back through the creator: a new look first, then traits, a new roll and a home.
select pg_temp.assert(public.restart_pending(), 'creator opens on the look step');
select pg_temp.assert(pg_temp.raises($$select public.restart_player()$$, 'nothing_to_restart'), 'not twice mid-creation');
select 1 from public.restart_look('night_owl_goth', '{}');
select pg_temp.assert(not public.restart_pending() and (select starting_style = 'night_owl_goth' from public.players where display_name = 'again'), 'new look saved');
select pg_temp.assert(pg_temp.raises($$select public.restart_look('bodega_drip', '{}')$$, 'no_restart'), 'the look step runs once');
select 1 from public.set_traits(array['loud', 'hustler']);
select public.roll_birth_lottery() as roll \gset
select pg_temp.assert(:roll between 1500 and 3000, 'a new birth lottery');
select 1 from public.move_in('astoria_share');
select pg_temp.assert((select home_id = 'astoria_share' and bank_cash = :roll - 225 from public.players where display_name = 'again'), 'moved in again, first rent paid again');

-- Once every 30 days.
select pg_temp.assert(not (public.restart_status() ->> 'can')::boolean and public.restart_status() ->> 'nextAt' is not null, 'next chance in 30 days');
select pg_temp.assert(pg_temp.raises($$select public.restart_player()$$, 'restart_too_soon'), 'too soon');
reset role;
update public.player_restarts set restarted_at = now() - interval '31 days' where player_id = '00000000-0000-0000-0000-0000000114a1';
set role authenticated;
select pg_temp.assert((public.restart_status() ->> 'can')::boolean, 'open again after 30 days');

rollback;
