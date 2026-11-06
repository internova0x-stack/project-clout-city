-- Scenario test for migration 0165 (owner, Nov 6): visits and hangouts once a New York day, meals repeat, Sleep at home.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.fails(p_place text, p_action text, p_code text) returns boolean language plpgsql security definer as $h$
begin perform pg_temp.act(p_place, p_action); return false;
exception when others then return sqlerrm like '%' || p_code || '%'; end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000001651');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001651', false);
select 1 from public.create_player('oncer', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, bank_cash = 1000, mood = 20, confidence = 50 where id = '00000000-0000-0000-0000-000000001651';

set role authenticated;
-- A hangout once: the second time is refused, and nothing more is recorded.
select pg_temp.assert(pg_temp.act('ditmars-deli', 'pet-cat') is not null, 'petting Also Sal');
select pg_temp.assert(pg_temp.fails('ditmars-deli', 'pet-cat', 'done_today'), 'not twice in a day');
-- A meal repeats (it's how Energy comes back).
select pg_temp.assert(pg_temp.act('ditmars-deli', 'bec') is not null and pg_temp.act('ditmars-deli', 'bec') is not null, 'a BEC twice');
reset role;
select pg_temp.assert((select visits = 3 from public.place_visits where player_id = '00000000-0000-0000-0000-000000001651' and place_id = 'ditmars-deli'),
                      'the refused one left no visit');

-- Sleep: once a day at home, +80 Energy at most.
update public.players set at_place = null, energy = 10 where id = '00000000-0000-0000-0000-000000001651';
set role authenticated;
select pg_temp.assert((public.rest('sleep') ->> 'energy')::int = 80, 'a night''s sleep: +80 Energy');
reset role;
select pg_temp.assert((select energy = 90 from public.players where id = '00000000-0000-0000-0000-000000001651'), 'Energy 90');
set role authenticated;
do $$ begin perform public.rest('sleep'); raise exception 'FAIL: slept twice'; exception when others then
  if sqlerrm not like '%rested_out%' then raise; end if; end $$;
reset role;

rollback;
\echo 'once_a_day: ok'
