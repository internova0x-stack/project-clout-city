-- Scenario test for migration 0020 (the player card's rank and public "Recently").
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select 1 from public.create_player('profile_one', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select 1 from public.create_player('profile_two', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;

-- Player one's history: public moments and private ones (cash, a date night).
update public.players set clout = 1000000000 where id = '00000000-0000-0000-0000-0000000000a1';
update public.players set clout = 999999999 where id = '00000000-0000-0000-0000-0000000000a2';
insert into public.ledger (player_id, currency, amount, kind, ref, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'clout', 30, 'party', 'first_party', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-0000000000a1', 'clout', 12, 'visit', 'velvet-static:2026-10-12', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-0000000000a1', 'cash', -60, 'visit', 'velvet-static:2026-10-12:1', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-0000000000a1', 'clout', 20, 'date_night', 'x', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000000a1', 'cash', -900, 'rent', 'r1', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000a1', 'clout', 40, 'purchase', 'satin-bomber', now() - interval '2 hours');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
create temp table c as select public.player_card('00000000-0000-0000-0000-0000000000a1') as card;
select pg_temp.assert((select (card ->> 'rank')::int from c) = 1, 'player one leads Queens');
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-0000000000a2') ->> 'rank')::int = 2, 'player two is second');
select pg_temp.assert((select jsonb_array_length(card -> 'recent') from c) = 3, 'only public moments are listed');
select pg_temp.assert((select card -> 'recent' -> 0 ->> 'kind' from c) = 'purchase', 'newest first');
select pg_temp.assert((select card -> 'recent' -> 1 ->> 'ref' from c) = 'velvet-static:2026-10-12', 'the visit, by clout row');
select pg_temp.assert(not exists (select 1 from c, jsonb_array_elements(card -> 'recent') e
                                  where e ->> 'kind' in ('rent', 'date_night') or e ? 'amount'), 'nothing private, no amounts');
select pg_temp.assert((select count(*) from pg_proc where proname = 'player_recent'
                         and has_function_privilege('authenticated', oid, 'execute')) = 0, 'player_recent is not callable directly');

rollback;
\echo PROFILE CHECKS PASSED
