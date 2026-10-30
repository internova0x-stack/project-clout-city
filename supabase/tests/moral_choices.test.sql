-- Scenario test for migration 0131 (Moral Choices: the private Integrity meter, cards shown and settled once, later
-- consequences, limits, Start over). The meter is Halo ↔ Hustler for players; the column says integrity. Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(p_sql text, p_code text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then return sqlerrm = p_code;
end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000141');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000141', false);
select public.create_player('Moral', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']);
select public.roll_birth_lottery();
select public.move_in('astoria_studio');
-- Players can't read or call any of it.
select pg_temp.assert(pg_temp.raises($$select * from public.reputation$$, 'permission denied for table reputation'), 'no reading the meter');
select pg_temp.assert(pg_temp.raises($$select public.choice_context('00000000-0000-0000-0000-000000000141')$$, 'permission denied for function choice_context'), 'server only');
reset role;

update public.players set clout = 500 where id = '00000000-0000-0000-0000-000000000141';
create temp table cash0 as select bank_cash, clout, mood from public.players where id = '00000000-0000-0000-0000-000000000141';
\set p '''00000000-0000-0000-0000-000000000141'''

select pg_temp.assert((public.choice_context(:p) ->> 'integrity')::int = 50 and not (public.choice_context(:p) ->> 'revealed')::boolean, 'starts in the middle, hidden');

-- ---- A card is shown and answered: paid once, the meter revealed ----
create temp table l1 as select public.choice_open(:p, 'found-wallet-subway', 'found-wallet', 'transit', 'astoria-blvd-station') as id;
select pg_temp.assert(pg_temp.raises(format($$select public.choice_open(%L, 'x', 'x', 'life', null)$$, '00000000-0000-0000-0000-000000000141'), 'already_open'), 'one waiting at a time');
select pg_temp.assert(pg_temp.raises(format($$select public.choice_settle(%L, %s, 'keep', 0, 'r', '{"cash": 99999}', null)$$, '00000000-0000-0000-0000-000000000141', (select id from l1)), 'bad_effects'), 'effects are capped');
create temp table s1 as select public.choice_settle(:p, (select id from l1), 'skim', 1, 'C$300 richer.', '{"cash": 300, "integrity": -8}',
  jsonb_build_object('due', public.ny_today() + 2, 'emoji', '📸', 'text', 'Remember the wallet?', 'effects', '{"clout": -40, "mood": -8}'::jsonb)) as r;
select pg_temp.assert((select (r ->> 'integrity')::int = 42 and (r ->> 'first')::boolean from s1), 'toward Hustler; the first choice reveals the meter');
select pg_temp.assert((select p.bank_cash - c.bank_cash = 300 from public.players p, cash0 c where p.id = '00000000-0000-0000-0000-000000000141'), 'paid C$300');
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'choice' and ref = (select id::text from l1)), 'one ledger row');
select pg_temp.assert(pg_temp.raises(format($$select public.choice_settle(%L, %s, 'keep', 0, 'r', '{"cash": 300}', null)$$, '00000000-0000-0000-0000-000000000141', (select id from l1)), 'not_open'), 'answered once');

-- ---- A second card the same day; gains count at half; a third is too many ----
update public.choice_log set shown_at = now() - interval '3 hours' where id = (select id from l1);
create temp table l2 as select public.choice_open(:p, 'tip-jar-cafe', 'tip-jar', 'work', 'grind-and-gossip') as id;
select pg_temp.assert((public.choice_settle(:p, (select id from l2), 'honest', 0, 'You split it.', '{"integrity": 9, "cash": -20}', null) ->> 'integrity')::int = 51, 'toward Halo, the same rate');
select pg_temp.assert(pg_temp.raises(format($$select public.choice_open(%L, 'third', 'third', 'life', null)$$, '00000000-0000-0000-0000-000000000141'), 'enough_today'), 'two a day');
select pg_temp.assert(jsonb_array_length(public.choice_context(:p) -> 'history') = 2, 'history for the cooldowns');

-- ---- The consequence lands on its day, once ----
select pg_temp.assert(jsonb_array_length(public.choice_land(:p)) = 0, 'not yet');
update public.choice_later set due = public.ny_today() where player_id = '00000000-0000-0000-0000-000000000141';
create temp table land as select public.choice_land(:p) as r;
select pg_temp.assert((select jsonb_array_length(r) = 1 and r -> 0 ->> 'card' = 'found-wallet-subway' and (r -> 0 -> 'effects' ->> 'clout')::int = -40 from land), 'it came back, naming the card');
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'choice_later'), 'paid once');
select public.choice_land(:p);
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'choice_later'), 'never twice');
select public.choice_seen(:p, array(select id from public.choice_later));
select pg_temp.assert(jsonb_array_length(public.choice_land(:p)) = 0, 'seen: not shown again');
select pg_temp.assert(jsonb_array_length(public.choice_history(:p) -> 'log') = 3 and (public.choice_history(:p) ->> 'integrity')::int = 51, 'the record: two choices and a consequence');

-- ---- A loss never takes more than the bank holds; clout never below zero ----
update public.players set bank_cash = 50, clout = 10 where id = '00000000-0000-0000-0000-000000000141';
update public.choice_log set day = day - 1 where player_id = '00000000-0000-0000-0000-000000000141';
create temp table l3 as select public.choice_open(:p, 'fine-card', 'fine', 'life', null) as id;
select public.choice_settle(:p, (select id from l3), 'pay', 0, 'Ouch.', '{"cash": -500, "clout": -50}', null);
select pg_temp.assert((select bank_cash = 0 and clout = 0 from public.players where id = '00000000-0000-0000-0000-000000000141'), 'floored at zero');

-- ---- Yesterday's open card expires; skipping counts as shown ----
create temp table l4 as select public.choice_open(:p, 'skip-card', 'skip', 'life', null) as id;
select public.choice_skip(:p, (select id from l4));
select pg_temp.assert((select status = 'skipped' from public.choice_log where id = (select id from l4)), 'skipped');

-- ---- Start over: a new life, a new meter ----
insert into public.player_restarts (player_id, clout_before, cash_before) values ('00000000-0000-0000-0000-000000000141', 0, 0);
select pg_temp.assert(not exists (select 1 from public.reputation where player_id = '00000000-0000-0000-0000-000000000141')
                      and not exists (select 1 from public.choice_log where player_id = '00000000-0000-0000-0000-000000000141'), 'Start over clears it');

rollback;
\echo moral_choices: ok
