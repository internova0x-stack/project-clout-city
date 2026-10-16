-- Scenario test for migration 0056 (skills: practice, levels, level-up clout, badges, rust).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.lvl(n text) returns int language sql as $$ select (e ->> 'level')::int from jsonb_array_elements(public.my_skills()) e where e ->> 'id' = n $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1'), ('00000000-0000-0000-0000-0000000000f2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select 1 from public.create_player('skilly', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.assert(jsonb_array_length(public.my_skills()) = 9, 'nine skills, all at 0');
select pg_temp.assert(pg_temp.lvl('fitness') = 0, 'fitness starts at 0');

-- The browser can't hand out practice.
select pg_temp.assert(pg_temp.raises($$select public.skill_practice('00000000-0000-0000-0000-0000000000f1', 'dance', 'x')$$, 'permission denied'), 'practice is internal');
reset role;

-- Visits: a gym trains fitness; a cash row and a clout row for the same visit count once.
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'clout', 5, 'visit', 'rep-count:2026-10-01');
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'cash', -20, 'visit', 'rep-count:2026-10-01');
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'clout', 5, 'visit', 'pressed-iron-gym:2026-10-01');
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'clout', 5, 'visit', 'hell-gate-park:2026-10-01');
select pg_temp.assert((select practice from public.player_skills where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'fitness') = 3, '3 fitness practice');
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select pg_temp.assert(pg_temp.lvl('fitness') = 1, 'fitness level 1 at 3 practice');
reset role;
select pg_temp.assert(exists (select 1 from public.ledger where player_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'skill' and ref = 'fitness:1' and amount = 10), 'level 1 paid 10 clout');

-- Shifts and gigs train hustle; 40 practice is level 5: a badge, and 10+20+30+40+50 clout in all.
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'cash', 100, 'shift', 'grind-and-gossip:2026-10-0' || n) from generate_series(1, 9) n;
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'cash', 100, 'shift', 'grind-and-gossip:2026-10-1' || n) from generate_series(0, 9) n;
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'cash', 100, 'gig', 'g' || n) from generate_series(1, 21) n;
select pg_temp.assert((select best from public.player_skills where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'hustle') = 5, 'hustle best 5 at 40 practice');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = '00000000-0000-0000-0000-0000000000f1' and badge_id = 'skill-hustle-5'), 'level 5 badge');
select pg_temp.assert((select sum(amount) from public.ledger where player_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'skill' and ref like 'hustle:%') = 150, 'hustle levels paid 10+20+30+40+50');

-- Events: a club night is dance, the open mic is music.
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'clout', 40, 'event', 'bass-bath:2026-10-01');
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'clout', 40, 'event', 'quad-open-mic:2026-10-01');
select pg_temp.assert((select practice from public.player_skills where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'dance') = 1, 'club night trains dance');
select pg_temp.assert((select practice from public.player_skills where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'music') = 1, 'open mic trains music');

-- Cooking: the fridge going down while energy goes up.
update public.players set fridge_meals = 3, energy = 40 where id = '00000000-0000-0000-0000-0000000000f1';
update public.players set fridge_meals = 2, energy = 65 where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.assert((select practice from public.player_skills where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'cooking') = 1, 'cooking practice');

-- Rust: 47 days idle is 2 levels (27 days: 1, 47 days: 2), never more than 2 under the best.
update public.player_skills set last_practiced = public.ny_today() - 47 where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'hustle';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select pg_temp.assert(pg_temp.lvl('hustle') = 3, 'rusty: 5 down to 3');
select pg_temp.assert((select (e ->> 'rusty')::boolean from jsonb_array_elements(public.my_skills()) e where e ->> 'id' = 'hustle'), 'shown as rusty');
reset role;
update public.player_skills set last_practiced = public.ny_today() - 400 where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'hustle';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select pg_temp.assert(pg_temp.lvl('hustle') = 3, 'never more than 2 under the best');
reset role;
-- Practicing settles the rust and stops it; the lost levels pay nothing twice.
select public.ledger_once('00000000-0000-0000-0000-0000000000f1', 'cash', 100, 'gig', 'after-rust');
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select pg_temp.assert(pg_temp.lvl('hustle') = 3 and (select (e ->> 'rusty')::boolean = false from jsonb_array_elements(public.my_skills()) e where e ->> 'id' = 'hustle'), 'back to practicing from level 3');
reset role;
select pg_temp.assert((select practice from public.player_skills where player_id = '00000000-0000-0000-0000-0000000000f1' and skill = 'hustle') = 16, 'practice set to level 3 floor (15) + 1');
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'skill' and ref like 'hustle:%') = 5, 'no level paid twice');

-- Player cards: someone else sees the top three.
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select pg_temp.assert(jsonb_array_length(public.skills_of('00000000-0000-0000-0000-0000000000f1')) = 2, 'skills at level 1 and up on the card (hustle, fitness)');
select pg_temp.assert((public.skills_of('00000000-0000-0000-0000-0000000000f1') -> 0 ->> 'id') = 'hustle', 'best first');
reset role;

rollback;
\echo 'skills: ok'
