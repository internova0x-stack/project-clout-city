-- Scenario test for migration 0033 (Lucky Star's weekly jackpot: a lazy, once-only draw).
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

-- Players can't see draws directly or roll the winner themselves.
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select * from public.lotto_draws$$, 'permission denied'), 'no reading draws');
select pg_temp.assert(pg_temp.raises($$select public.lotto_rand(10)$$, 'permission denied'), 'no rolling from the browser');

-- This week: ana buys two C$100 cards (C$10 each to the pot), bo scratches a free card.
select count(*) from (select public.buy_lotto_card('lucky-star', 'main-character', false) from generate_series(1, 2)) s;
select pg_temp.as_(2);
select 1 from public.buy_lotto_card('lucky-star', 'corner-store', true);
select pg_temp.assert((public.lotto_state() -> 'week' ->> 'pool')::int = 5020, 'C$5,000 + 2 × C$10');
select pg_temp.assert(public.lotto_settle() = 0, 'nothing to draw before the week ends');
select pg_temp.assert(jsonb_array_length(public.lotto_state() -> 'draws') = 0, 'no draws yet');

-- A week later: the first call draws it, once.
reset role;
update public.game_settings set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb(7 * 86400)) where key = 'dev';
create temp table cash0 as select id, bank_cash from public.players where display_name in ('anabel', 'bobby');
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert(public.lotto_settle() = 1, 'last week is drawn');
select pg_temp.assert(public.lotto_settle() = 0, 'and only once');
reset role;
select pg_temp.assert((select entries = 3 and pool = 5020 and winner is not null from public.lotto_draws), 'three entries, one winner, the full pot');
select pg_temp.assert((select count(*) from public.players p join cash0 c using (id) where p.bank_cash = c.bank_cash + 5020) = 1, 'the winner is paid the pot');
select pg_temp.assert((select count(*) from public.players p join cash0 c using (id) where p.bank_cash = c.bank_cash) = 1, 'nobody else is paid');
select pg_temp.assert((select count(*) from public.ledger where kind = 'lotto_jackpot' and amount = 5020) = 1, 'one ledger row');
select pg_temp.assert((select count(*) from public.player_badges b join public.lotto_draws d on d.winner = b.player_id where b.badge_id = 'lotto-jackpot') = 1, 'the winner gets the badge');
-- The new week starts empty, at the seed.
create temp table w as select d.winner, p.display_name from public.lotto_draws d join public.players p on p.id = d.winner;
grant select on w to authenticated;
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert((public.lotto_state() -> 'week' ->> 'pool')::int = 5000, 'a new pot starts at the seed');

-- The News card: the winner sees "mine"; others see the name, unless the winner opted out.
create temp table d as select public.lotto_state() -> 'draws' -> 0 as x;
grant select on d to authenticated;
select pg_temp.assert((select (x ->> 'pool')::int = 5020 and x ->> 'winner' = (select display_name from w) from d), 'named in the News');
select pg_temp.assert((select (x ->> 'mine')::boolean = ((select winner from w) = auth.uid()) from d), 'mine only for the winner');
reset role;
update public.players set news_opt_out = true where id = (select winner from w);
set role authenticated;
select pg_temp.as_(1);
select pg_temp.as_(case when (select winner from w) = '00000000-0000-0000-0000-0000000000c1' then 2 else 1 end);
select pg_temp.assert((public.lotto_state() -> 'draws' -> 0 ->> 'winner') is null, 'opted out: not named to others');
select pg_temp.as_(case when (select winner from w) = '00000000-0000-0000-0000-0000000000c1' then 1 else 2 end);
select pg_temp.assert((public.lotto_state() -> 'draws' -> 0 ->> 'winner') is not null and (public.lotto_state() -> 'draws' -> 0 ->> 'mine')::boolean, 'the winner still sees their own win');

rollback;
\echo 'LOTTO JACKPOT CHECKS PASSED'
