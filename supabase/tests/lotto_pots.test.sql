-- Scenario test for migration 0041 (Lucky Star pots: a lucky number and a pot per game, daily or weekly,
-- won instantly by a star on the card). Replaces the weekly jackpot draw's test (0033).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

-- Rolls stay in range (and every value turns up).
select pg_temp.assert(min(v) = 0 and max(v) = 2 and count(distinct v) = 3, 'lotto_rand(3) covers 0, 1 and 2')
  from (select public.lotto_rand(3) v from generate_series(1, 300)) s;

-- The settings: pots get harder with every game; the small games are daily, the big ones weekly.
select pg_temp.assert(
  (select string_agg(g ->> 'id' || ':' || (g -> 'pot' ->> 'seed') || '/' || (g -> 'pot' ->> 'oneIn') || ':' || (g ->> 'period'), ' ' order by (g ->> 'price')::int)
     from jsonb_array_elements(public.city() -> 'economy' -> 'lotto' -> 'games') g)
  = 'corner-store:5000/5000:day bodega-cat:10000/10000:day rents-due:15000/20000:day penthouse-dreams:50000/50000:week main-character:100000/100000:week',
  'pots 5k to 100k, 1 in 5k to 1 in 100k, daily then weekly');

-- The weekly draw is retired.
select pg_temp.assert(public.lotto_settle() = 0, 'lotto_settle is a no-op now');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c' || n, false) $$;
set role authenticated;
select pg_temp.as_(1);
select 1 from public.create_player('anabel', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2);
select 1 from public.create_player('bobby', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 2000, energy = 100, at_place = 'lucky-star';
update public.game_settings set value = jsonb_set(coalesce(value, '{}'), '{clockOffsetSeconds}', to_jsonb(0)) where key = 'dev';

-- Players can't read pots, wins or rolls directly.
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select * from public.lotto_pots$$, 'permission denied'), 'no reading pots');
select pg_temp.assert(pg_temp.raises($$select * from public.lotto_pot_wins$$, 'permission denied'), 'no reading wins');
select pg_temp.assert(pg_temp.raises($$select public.lotto_numbers(5, 5, 0, 7)$$, 'permission denied'), 'no laying out cards from the browser');

-- Everyone sees the same lucky number and pot for a game today.
create temp table s1 as select public.lotto_state() s;
grant select on s1 to authenticated;
select pg_temp.as_(2);
select pg_temp.assert((select s -> 'pots' from s1) = public.lotto_state() -> 'pots', 'one number and pot per game for everyone');
select pg_temp.assert((select (p ->> 'pool')::int from jsonb_array_elements(public.lotto_state() -> 'pots') p where p ->> 'game' = 'penthouse-dreams') = 50000, 'pots start at their seed');

-- Force a pot win: make Penthouse Dreams' pot 1 in 1. ana buys a card (C$5 into the pot first).
reset role;
update public.game_settings set value = jsonb_set(value, '{economy,lotto,games,3,pot,oneIn}', '1') where key = 'city';
create temp table cash0 as select id, bank_cash from public.players;
set role authenticated;
select pg_temp.as_(1);
create temp table k as select public.buy_lotto_card('lucky-star', 'penthouse-dreams', false) as r;
select pg_temp.assert(not ((select r from k) ? 'pot'), 'the pot win stays hidden until scratched');
-- The pot starts again from the seed right away; the News doesn't show the win before it's scratched.
select pg_temp.assert((select (p ->> 'pool')::int from jsonb_array_elements(public.lotto_state() -> 'pots') p where p ->> 'game' = 'penthouse-dreams') = 50000, 'a won pot starts again at its seed');
select pg_temp.assert(jsonb_array_length(public.lotto_state() -> 'wins') = 0, 'no win in the News before the scratch');
create temp table sc as select public.scratch_lotto_card((select (r ->> 'id')::bigint from k)) as r;
select pg_temp.assert((select (r ->> 'pot')::int from sc) = 50005, 'the pot: seed plus this card''s 10%');
select pg_temp.assert((select count(*) from jsonb_array_elements((select r -> 'numbers' from sc)) c where (c ->> 'n')::int = 0 and (c ->> 'prize')::int = 50005) = 1, 'one star on the card, with the pot under it');
reset role;
select pg_temp.assert((select p.bank_cash - c.bank_cash from public.players p join cash0 c using (id) where p.display_name = 'anabel')
  = -50 + 50005 + (select (r ->> 'prize')::int from sc), 'paid the pot and the prize, minus the card');
select pg_temp.assert((select count(*) from public.ledger where kind = 'lotto_pot' and amount = 50005) = 1, 'one pot ledger row');
select pg_temp.assert((select count(*) from public.player_badges b join public.players p on p.id = b.player_id where p.display_name = 'anabel' and b.badge_id = 'lotto-jackpot') = 1, 'the winner gets the badge');

-- The News card: the winner sees "mine"; others see the name, unless the winner opted out.
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert((public.lotto_state() -> 'wins' -> 0 ->> 'winner') = 'anabel' and not (public.lotto_state() -> 'wins' -> 0 ->> 'mine')::boolean, 'named in the News');
reset role;
update public.players set news_opt_out = true where display_name = 'anabel';
set role authenticated;
select pg_temp.assert((public.lotto_state() -> 'wins' -> 0 ->> 'winner') is null, 'opted out: not named to others');
select pg_temp.as_(1);
select pg_temp.assert((public.lotto_state() -> 'wins' -> 0 ->> 'mine')::boolean, 'the winner still sees their own win');

-- A new day: daily pots and numbers start over; weekly ones run until Monday.
reset role;
update public.game_settings set value = jsonb_set(value, '{economy,lotto,games,3,pot,oneIn}', '50000') where key = 'city';
create temp table p0 as select game, period from public.lotto_pots;
update public.game_settings set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb(86400)) where key = 'dev';
set role authenticated;
select pg_temp.as_(2);
select 1 from public.lotto_state();
reset role;
select pg_temp.assert((select count(*) from public.lotto_pots where game = 'corner-store') = 2, 'a new daily pot the next day');
select pg_temp.assert((select count(distinct period) from public.lotto_pots where game = 'main-character') = 1
  or extract(isodow from (now() at time zone 'America/New_York') + interval '1 day') = 1, 'the weekly pot carries on (unless the new day is a Monday)');

rollback;
\echo 'LOTTO POTS CHECKS PASSED'
