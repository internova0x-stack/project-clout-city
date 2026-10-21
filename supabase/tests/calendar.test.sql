-- Scenario test for migration 0096 (culture pack C5: calendar events, cultural invites, the ballpark).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.at(p text) returns void language plpgsql security definer as $h$
begin update public.players set at_place = p, arrives_at = null where id = auth.uid(); end $h$;
-- Moves the game clock to a New York date and time.
create function pg_temp.ny(p_at text) returns void language plpgsql security definer as $h$
begin
  insert into public.game_settings (key, value) values ('dev', '{}') on conflict (key) do nothing;
  update public.game_settings set value = value || jsonb_build_object('clockOffsetSeconds',
    extract(epoch from ((p_at::timestamp at time zone 'America/New_York') - now()))) where key = 'dev';
end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000961'), ('00000000-0000-0000-0000-000000000962');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000961', false);
select 1 from public.create_player('guest', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
select 1 from public.create_player('nogift', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 2000, energy = 100, clout = 100 where id in ('00000000-0000-0000-0000-000000000961', '00000000-0000-0000-0000-000000000962');

-- The data is in: the NYE countdown on the rooftop, and the ballpark with its home games.
select pg_temp.assert((select bool_or(e ->> 'id' = 'nye-countdown-2026' and e ->> 'date' = '2026-12-31' and e ->> 'place' = 'ditmars-heights-rooftop')
                         from jsonb_array_elements((select value from public.game_settings where key = 'calendar') -> 'events') e), 'NYE on the calendar');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.city() -> 'events') e where e ->> 'id' = 'meteors-home-game' and e ->> 'placeId' = 'meteor-park'), 'Meteors home games');

-- Dimitra's name day, Oct 26: too early at noon; at 6:30 PM, at the taverna.
select pg_temp.ny('2026-10-26 12:00');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000961', false);
select pg_temp.at('feta-compli');
select pg_temp.assert(pg_temp.raises($$select public.calendar_attend('name-day-dimitra-2026')$$, 'not_now'), 'not before 6 PM');
reset role;
select pg_temp.ny('2026-10-26 18:30');
set role authenticated;
-- Gift box first, at Sal's (not at the taverna).
select pg_temp.assert(pg_temp.raises($$select public.buy_gift()$$, 'no_gifts_here'), 'the taverna sells no gift boxes');
select pg_temp.at('ditmars-deli');
select pg_temp.assert((public.buy_gift() ->> 'gifts')::int = 1, 'a gift box from Sal''s');
select pg_temp.assert(pg_temp.raises($$select public.calendar_attend('name-day-dimitra-2026')$$, 'not_here'), 'the party is at the taverna');
reset role;
-- Dressed up: wearing something from the Shop.
insert into public.player_items (player_id, sku, category, value, acquired, equipped)
values ('00000000-0000-0000-0000-000000000961', 'fit-meteors-cap', 'fashion', 45, 'bought', true);
set role authenticated;
select pg_temp.at('feta-compli');
create temp table r1 as select public.calendar_attend('name-day-dimitra-2026') as r;
grant all on r1 to authenticated;
select pg_temp.assert((select (r ->> 'clout')::int = 65 and (r ->> 'dress')::boolean and r ->> 'gift' = 'brought' from r1), 'dressed, with a gift: 40 + 25 clout');
select pg_temp.assert(pg_temp.raises($$select public.calendar_attend('name-day-dimitra-2026')$$, 'already_went'), 'once');
select pg_temp.assert(public.calendar_state() = '{"attended": ["name-day-dimitra-2026"], "gifts": 0}'::jsonb, 'state: went, gift used');

-- Empty-handed and not dressed up: the penalty comes off.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
select pg_temp.at('feta-compli');
select pg_temp.assert((public.calendar_attend('name-day-dimitra-2026') ->> 'clout')::int = 20, 'no gift, no dress code: 40 - 20');
reset role;
select pg_temp.assert((select amount = 20 from public.ledger where player_id = '00000000-0000-0000-0000-000000000962' and kind = 'calendar' and currency = 'clout'), 'the ledger has the 20');

-- NYE: C$60 at the door, 9 PM to midnight on Dec 31.
select pg_temp.ny('2026-12-31 23:50');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000961', false);
select pg_temp.at('ditmars-heights-rooftop');
select pg_temp.assert((public.calendar_attend('nye-countdown-2026') ->> 'cash')::int = -60, 'the countdown: C$60');
reset role;
select pg_temp.ny('2027-01-01 00:10');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
select pg_temp.at('ditmars-heights-rooftop');
select pg_temp.assert(pg_temp.raises($$select public.calendar_attend('nye-countdown-2026')$$, 'not_now'), 'over at midnight');
reset role;

-- A Meteors home game: attend it like any club night on a game day.
select pg_temp.assert(not has_function_privilege('anon', 'public.calendar_attend(text)', 'execute'), 'players only');

rollback;
\echo CALENDAR CHECKS PASSED
