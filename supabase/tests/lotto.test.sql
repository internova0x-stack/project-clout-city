-- Scenario test for migrations 0032 and 0041 (Lucky Star Lotto: scratch cards drawn and paid by the server).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

-- The prize table, exactly: across all 100,000 rolls a C$100 card pays C$6,050,000 (60.5%), 32,771
-- rolls win something, 21 are big prizes (100 times the card or more) and one is the top prize.
select pg_temp.assert(sum(public.lotto_prize(100, r)) = 6050000, 'the average card pays back 60.5%') from generate_series(0, 99999) r;
select pg_temp.assert(count(*) filter (where public.lotto_prize(100, r) > 0) = 32771, 'about 1 card in 3 wins') from generate_series(0, 99999) r;
select pg_temp.assert(count(*) filter (where public.lotto_prize(100, r) >= 10000) = 21, '21 big prizes in 100,000') from generate_series(0, 99999) r;
select pg_temp.assert(count(*) filter (where public.lotto_prize(100, r) = 100000) = 1, 'one top prize in 100,000') from generate_series(0, 99999) r;
select pg_temp.assert(min(v) >= 0 and max(v) <= 99999 and count(distinct v) > 1900, 'rolls are spread over 0 to 99,999')
  from (select public.lotto_roll() v from generate_series(1, 2000)) s;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2');
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b' || n, false) $$;
set role authenticated;
select pg_temp.as_(1);
select 1 from public.create_player('lucky', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2);
select 1 from public.create_player('snoop', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 1000, energy = 100;
set role authenticated;
select pg_temp.as_(1);

-- Players can't read or write the cards table: prizes stay on the server until scratched.
select pg_temp.assert(pg_temp.raises($$select prize from public.lotto_cards$$, 'permission denied'), 'no reading prizes');
select pg_temp.assert(pg_temp.raises($$insert into public.lotto_cards (player_id, game, price, paid, prize, ny_date, week) values (auth.uid(), 'corner-store', 5, 0, 5000, current_date, date_trunc('week', current_date)::date)$$, 'permission denied'), 'no writing cards');
select pg_temp.assert(pg_temp.raises($$select public.lotto_roll()$$, 'permission denied'), 'no rolling from the browser');
select pg_temp.assert(pg_temp.raises($$select public.lotto_prize(100, 0)$$, 'permission denied'), 'no prize lookups from the browser');

-- You have to be there, and the place has to be the lotto.
select pg_temp.assert(pg_temp.raises($$select public.buy_lotto_card('lucky-star', 'corner-store', true)$$, 'lotto_not_here'), 'cards need you at the counter');
select pg_temp.assert(pg_temp.raises($$select public.buy_lotto_card('velvet-static', 'corner-store', true)$$, 'unknown_action'), 'only the lotto sells cards');
select 1 from public.travel('lucky-star', 'taxi');
select pg_temp.assert(pg_temp.raises($$select public.buy_lotto_card('lucky-star', 'gold-rush', false)$$, 'lotto_unknown_game'), 'only the five games');

-- Free cards: the C$5 game only; two a day through the first 7 days (beginner's luck).
select pg_temp.assert((public.lotto_state() ->> 'freeToday')::int = 2, 'beginner''s luck: two free cards');
select pg_temp.assert(public.lotto_state() ->> 'beginnerUntil' is not null, 'beginner''s luck shows when it ends');
select pg_temp.assert(pg_temp.raises($$select public.buy_lotto_card('lucky-star', 'main-character', true)$$, 'lotto_not_free_game'), 'the free card is the C$5 game');
create temp table cash_free as select bank_cash from public.players where id = auth.uid();
create temp table cards (n serial, r jsonb);
grant all on cards, cards_n_seq to authenticated;
insert into cards (r) select public.buy_lotto_card('lucky-star', 'corner-store', true);
insert into cards (r) select public.buy_lotto_card('lucky-star', 'corner-store', true);
select pg_temp.assert(pg_temp.raises($$select public.buy_lotto_card('lucky-star', 'corner-store', true)$$, 'lotto_free_used'), 'no third free card');
select pg_temp.assert((select bank_cash from public.players where id = auth.uid()) = (select bank_cash from cash_free), 'free cards are free');
select pg_temp.assert(not (r ? 'prize'), 'a bought card hides its prize') from cards;

-- Bought cards: five a day across all games, paid from the bank, each in the ledger.
create temp table cash0 as select bank_cash from public.players where id = auth.uid();
insert into cards (r) select public.buy_lotto_card('lucky-star', 'rents-due', false) from generate_series(1, 3);
insert into cards (r) select public.buy_lotto_card('lucky-star', 'main-character', false);
insert into cards (r) select public.buy_lotto_card('lucky-star', 'corner-store', false);
select pg_temp.assert(pg_temp.raises($$select public.buy_lotto_card('lucky-star', 'bodega-cat', false)$$, 'lotto_daily_cap'), 'five bought cards a day');
select pg_temp.assert((select bank_cash from public.players where id = auth.uid()) = (select bank_cash from cash0) - 165, '3×C$20 + C$100 + C$5 = C$165');
select pg_temp.assert((select count(*) from public.ledger where player_id = auth.uid() and kind = 'lotto_card') = 5, 'one ledger row per bought card');

-- The counter's numbers: every game's pot and lucky number, and seven cards to scratch, no prizes.
-- The pots grow by 10% of bought cards: Rent's Due C$15,000 + 3 × C$2 (unless one was just won).
create temp table st as select public.lotto_state() s;
select pg_temp.assert(jsonb_array_length(s -> 'pots') = 5, 'a pot for every game') from st;
select pg_temp.assert((select bool_and((p ->> 'lucky')::int between 1 and 40) from jsonb_array_elements(s -> 'pots') p), 'lucky numbers from 1 to 40') from st;
select pg_temp.assert((select (p ->> 'pool')::int in (15006, 15000, 15002, 15004) from jsonb_array_elements(s -> 'pots') p where p ->> 'game' = 'rents-due'), 'the pot grows by 10% of bought cards') from st;
select pg_temp.assert((s ->> 'bought')::int = 5 and (s ->> 'freeUsed')::int = 2, 'today''s counts') from st;
select pg_temp.assert(jsonb_array_length(s -> 'unscratched') = 7, 'seven cards to scratch') from st;
select pg_temp.assert(not (s::text like '%prize%') and not (s::text like '%numbers%'), 'no prizes or numbers before scratching') from st;

-- Someone else can't scratch (or peek at) my cards.
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises(format('select public.scratch_lotto_card(%s)', (select (r ->> 'id') from cards where n = 1)), 'lotto_unknown_card'), 'not your card');
select pg_temp.as_(1);

-- Scratching reveals the prize drawn at purchase and pays it once.
create temp table cash1 as select bank_cash from public.players where id = auth.uid();
create temp table scratched (r jsonb);
grant all on scratched to authenticated;
insert into scratched select public.scratch_lotto_card((r ->> 'id')::bigint) from cards;
reset role;
select pg_temp.assert((select sum((r ->> 'prize')::int) from scratched) = (select sum(prize) from public.lotto_cards c join cards k on c.id = (k.r ->> 'id')::bigint), 'the prizes are the ones drawn at purchase');
select pg_temp.assert((select bank_cash from public.players where display_name = 'lucky') = (select bank_cash from cash1) + (select sum((r ->> 'prize')::int) from scratched), 'prizes go to the bank');
select pg_temp.assert((select coalesce(sum(amount), 0) from public.ledger l join public.players p on p.id = l.player_id where p.display_name = 'lucky' and kind = 'lotto_prize') = (select sum((r ->> 'prize')::int) from scratched), 'every prize is in the ledger');
select pg_temp.assert((select bool_and(prize = 0 or prize in (5, 10, 25, 100, 500, 5000)) from public.lotto_cards where game = 'corner-store'), 'C$5 prizes come from its table');
-- Each card shows six numbers; a prize is the lucky number with that prize under it, and a card
-- without a prize has no lucky number on it.
select pg_temp.assert(bool_and(jsonb_array_length(r -> 'numbers') = 6), 'six numbers on every card') from scratched;
select pg_temp.assert(bool_and(
    (select count(*) from jsonb_array_elements(r -> 'numbers') c where (c ->> 'n')::int = (r ->> 'lucky')::int)
      = case when (r ->> 'prize')::int > 0 then 1 else 0 end), 'the lucky number shows exactly when there''s a prize') from scratched;
select pg_temp.assert(bool_and((r ->> 'prize')::int = 0 or exists (select 1 from jsonb_array_elements(r -> 'numbers') c
    where (c ->> 'n')::int = (r ->> 'lucky')::int and (c ->> 'prize')::int = (r ->> 'prize')::int)), 'the prize sits under the lucky number') from scratched;
select pg_temp.assert(bool_and((select count(distinct c ->> 'n') from jsonb_array_elements(r -> 'numbers') c) = 6), 'no number twice on a card') from scratched;
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises(format('select public.scratch_lotto_card(%s)', (select (r ->> 'id') from cards where n = 1)), 'lotto_already_scratched'), 'one scratch per card');
select pg_temp.assert(jsonb_array_length(public.lotto_state() -> 'unscratched') = 0, 'nothing left to scratch');

-- A new day: new free cards and a fresh cap. Beginner's luck ends after 7 days.
reset role;
update public.game_settings set value = jsonb_set(coalesce(value, '{}'), '{clockOffsetSeconds}', to_jsonb(86400)) where key = 'dev';
update public.players set bank_cash = 1000 where display_name = 'lucky';
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert((public.lotto_state() ->> 'freeUsed')::int = 0 and (public.lotto_state() ->> 'bought')::int = 0, 'counts reset at midnight');
select 1 from public.buy_lotto_card('lucky-star', 'bodega-cat', false);
reset role;
update public.players set created_at = created_at - interval '8 days' where display_name = 'lucky';
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert((public.lotto_state() ->> 'freeToday')::int = 1 and public.lotto_state() ->> 'beginnerUntil' is null, 'one free card a day after the first week');

rollback;
\echo 'LOTTO CHECKS PASSED'
