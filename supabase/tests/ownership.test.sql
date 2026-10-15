-- Scenario test for migration 0048 (v0.12 Ownership: businesses, net worth with businesses, ranks).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
-- Moves the game clock forward (the dev clock offset), as the superuser.
create function pg_temp.later(hours numeric) returns void language sql security definer as $$
  update public.game_settings set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb(coalesce((value ->> 'clockOffsetSeconds')::numeric, 0) + hours * 3600))
   where key = 'dev' $$;
create function pg_temp.cash() returns bigint language sql security definer as $$
  select bank_cash from public.players where display_name = 'tycoon' $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select 1 from public.create_player('tycoon', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 10000, clout = 0 where display_name = 'tycoon';
set role authenticated;

-- Buying: in order, only what you can afford, once.
select pg_temp.assert(pg_temp.raises($$select public.buy_business('bodega')$$, 'business_locked'), 'the bodega waits for the cart');
select pg_temp.assert(pg_temp.raises($$select public.buy_business('yacht')$$, 'unknown_business'), 'only the eight');
select pg_temp.assert((public.buy_business('hot-dog-cart') ->> 'cash')::int = -5000, 'the cart costs C$5,000');
select pg_temp.assert(pg_temp.raises($$select public.buy_business('hot-dog-cart')$$, 'already_owned'), 'one of each');
select pg_temp.assert(pg_temp.raises($$select public.buy_business('bodega')$$, 'cant_afford'), 'C$50,000 for the bodega');
select pg_temp.assert(pg_temp.cash() = 5000, 'paid once');
select pg_temp.assert((select amount from public.ledger l join public.players p on p.id = l.player_id
                        where p.display_name = 'tycoon' and l.kind = 'business_buy' and l.ref = 'hot-dog-cart') = -5000, 'a ledger row');

-- The till: C$750 a day by the hour, full after two days.
select pg_temp.later(12);
select pg_temp.assert((public.collect_tills() ->> 'cash')::int = 375, 'half a day: C$375');
select pg_temp.assert((public.collect_tills() ->> 'cash')::int = 0, 'nothing twice');
select pg_temp.later(24 * 5);
select pg_temp.assert((public.collect_tills() -> 'paid' -> 0 ->> 'cash')::int = 1500, 'five days away: the till stopped at two days');
select pg_temp.assert(pg_temp.cash() = 5000 + 375 + 1500, 'the till paid into cash');

-- Upgrades: C$3,000 (60% of the price), empties the till first, +50% pay; three at most.
select pg_temp.later(24);
select pg_temp.assert((select (r ->> 'till')::int = 750 and (r ->> 'level')::int = 1 from (select public.upgrade_business('hot-dog-cart') r) x), 'the till at the old pay, then level 1');
select pg_temp.assert(pg_temp.cash() = 6875 + 750 - 3000, 'paid C$3,000');
select pg_temp.later(24);
select pg_temp.assert((public.collect_tills() ->> 'cash')::int = 1125, 'C$1,125 a day at level 1');
reset role;
update public.players set bank_cash = 100000 where display_name = 'tycoon';
set role authenticated;
select 1 from public.upgrade_business('hot-dog-cart'); select 1 from public.upgrade_business('hot-dog-cart');
select pg_temp.assert(pg_temp.raises($$select public.upgrade_business('hot-dog-cart')$$, 'max_level'), 'three upgrades');
select pg_temp.assert(pg_temp.raises($$select public.upgrade_business('bodega')$$, 'not_owned'), 'only your own');

-- Net worth counts businesses at their worth, with hype from clout.
create temp table s1 as select public.business_state() r;
grant all on s1 to authenticated;
select pg_temp.assert((select jsonb_array_length(r -> 'owned') = 1 and (r -> 'owned' -> 0 ->> 'level')::int = 3 from s1), 'one business, level 3');
select pg_temp.assert((select (r ->> 'netWorth')::bigint = pg_temp.cash() + 12500 from s1), 'worth C$12,500 (C$5,000 × 2.5) with no clout');
reset role;
update public.players set clout = 75000 where display_name = 'tycoon';
set role authenticated;
select pg_temp.assert((public.business_state() ->> 'netWorth')::bigint = pg_temp.cash() + 18750, 'fame: ×1.5 at 75,000 clout');
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-0000000000e1') ->> 'netWorth')::bigint = pg_temp.cash() + 18750, 'the card agrees');

-- Ranks: the higher of clout or net worth; the best is kept.
select pg_temp.assert((public.business_state() ->> 'bestRank')::int = 8, '75,000 clout: New Money Rich');
reset role;
update public.players set clout = 0 where display_name = 'tycoon';
select pg_temp.assert(public.rank_level(0, 1000000000) = 9 and public.rank_level(0, 999999999) = 8, 'C$1B is Self-Made Billionaire');
set role authenticated;
select pg_temp.assert((public.business_state() ->> 'bestRank')::int = 8, 'the best rank stays');

-- Going public: the startup fully upgraded, 50,000 clout and C$50M; its worth triples.
reset role;
insert into public.player_businesses (player_id, business_id, level, bought_at, collected_at)
select p.id, b ->> 'id', 3, now(), public.game_now() from public.players p, jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') b
 where p.display_name = 'tycoon' and b ->> 'id' <> 'hot-dog-cart';
update public.players set bank_cash = 60000000, clout = 40000 where display_name = 'tycoon';
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.go_public()$$, 'need_clout'), 'investors want a famous founder');
reset role;
update public.players set clout = 50000 where display_name = 'tycoon';
set role authenticated;
create temp table w0 as select (public.business_state() ->> 'netWorth')::bigint w;
grant all on w0 to authenticated;
select pg_temp.assert((public.go_public() ->> 'cash')::bigint = -50000000, 'the fee');
select pg_temp.assert(pg_temp.raises($$select public.go_public()$$, 'already_public'), 'once');
-- The startup at level 3 with 50,000 clout: C$700M × 2.5 × (1 + 1/3), tripled; less the fee.
select pg_temp.assert(abs((public.business_state() ->> 'netWorth')::bigint
                          - ((select w from w0) - 50000000 + 2 * round(700000000 * 2.5 * (1 + 50000::numeric / 150000))::bigint)) <= 2,
                      'going public triples the startup''s worth');

rollback;
\echo OWNERSHIP CHECKS PASSED
