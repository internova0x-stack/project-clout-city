-- Scenario test for migration 0148 (the underworld, part 1): players can't touch it; the context reads the invitation
-- (a shady choice), the meter, holding and a law job; saves are versioned and pay each payout once inside the caps; fines
-- never take the bank below zero; holding puts the player at the 114½ and blocks a job; a headline reaches the Blotter
-- unless the player opted out of News; Start over forgets it; the city seed has Pablo's. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000148' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm = msg; end $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Runner', 'Quiet'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;

-- ---- Players can't read the table or call the server's functions ----
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform 1 from public.underworld; raise exception 'FAIL: underworld readable';
  exception when insufficient_privilege then null; end;
  begin perform public.underworld_context(auth.uid()); raise exception 'FAIL: underworld_context callable';
  exception when insufficient_privilege then null; end;
  begin perform public.underworld_save(auth.uid(), 0, '{}', 0, 0, 0, '[]', 0, null); raise exception 'FAIL: underworld_save callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- The city seed and the context ----
select pg_temp.assert((select value -> 'places' @> '[{"id": "pablos-luggage"}]' from public.game_settings where key = 'city'), 'Pablo''s is on the map');
select pg_temp.assert((public.underworld_context(pg_temp.u(1)) ->> 'shady')::boolean = false, 'not shady yet');
select pg_temp.assert(public.underworld_context(pg_temp.u(1)) -> 'integrity' = 'null'::jsonb, 'the meter is unrevealed');
select pg_temp.assert(public.underworld_context(pg_temp.u(1)) -> 'row' = 'null'::jsonb, 'no state yet');
insert into public.choice_log (player_id, card, base, area, day, status, option, effects)
values (pg_temp.u(1), 'test-card', 'test', 'life', public.ny_today(), 'chosen', 'take', '{"cash": 100, "integrity": -4}');
select pg_temp.assert((public.underworld_context(pg_temp.u(1)) ->> 'shady')::boolean, 'a shady choice is Pablo''s invitation');

-- ---- Saves: versioned, effects capped ----
update public.players set energy = 50, mood = 50, bank_cash = 1000 where id = pg_temp.u(1);
select pg_temp.assert(public.underworld_save(pg_temp.u(1), 0, '{"v":1}', 0, 0, 0, '[]', 0, null) = 1, 'first save is version 1');
select pg_temp.assert(pg_temp.raises(format($$select public.underworld_save(%L, 0, '{"v":1}', 0, 0, 0, '[]', 0, null)$$, pg_temp.u(1)), 'conflict'), 'the first save happens once');
select pg_temp.assert(pg_temp.raises(format($$select public.underworld_save(%L, 1, '{}', -40, 0, 0, '[]', 0, null)$$, pg_temp.u(1)), 'bad_effects'), 'energy is capped');
select pg_temp.assert(pg_temp.raises(format($$select public.underworld_save(%L, 1, '{}', 0, 0, 0, '[]', 5, null)$$, pg_temp.u(1)), 'bad_effects'), 'holding is capped');
select pg_temp.assert((public.underworld_context(pg_temp.u(1)) -> 'row' ->> 'version')::int = 1, 'context shows the state');

-- ---- A job pays once; fines never take the bank below zero ----
select pg_temp.assert(public.underworld_save(pg_temp.u(1), 1, '{"v":1,"jobs":1}', -12, 3, -4,
  '[{"currency":"cash","amount":300,"kind":"underworld_pay","ref":"2026-11-02:found-laptop"},
    {"currency":"cash","amount":9000,"kind":"underworld_pay","ref":"2026-11-02:too-much"},
    {"currency":"clout","amount":50,"kind":"underworld_pay","ref":"2026-11-02:clout"},
    {"currency":"cash","amount":300,"kind":"career_pay","ref":"2026-11-02:other"}]', 0, null) = 2, 'a job saved');
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 1300, 'the job paid C$300, nothing else');
select pg_temp.assert((select energy from public.players where id = pg_temp.u(1)) = 38, 'the job spent Energy');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 46, 'the job moved the meter');
select public.underworld_save(pg_temp.u(1), 2, '{"v":1}', 0, 0, 0, '[{"currency":"cash","amount":300,"kind":"underworld_pay","ref":"2026-11-02:found-laptop"}]', 0, null);
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 1300, 'paid once');
update public.players set bank_cash = 200 where id = pg_temp.u(1);
select public.underworld_save(pg_temp.u(1), 3, '{"v":1}', 0, 0, 0, '[{"currency":"cash","amount":-1200,"kind":"underworld_fine","ref":"trace:2026-11-02:found-laptop"}]', 0, null);
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 0, 'a fine stops at zero');
select pg_temp.assert((select amount from public.ledger where player_id = pg_temp.u(1) and kind = 'underworld_fine') = -200, 'the ledger records what was taken');

-- ---- Caught: holding at the 114½, a job refused, the Blotter ----
select public.underworld_save(pg_temp.u(1), 4, '{"v":1}', 0, 0, 0, '[]', 2, 'Laptop lands {name} at the 114½.');
select pg_temp.assert((select at_place from public.players where id = pg_temp.u(1)) = 'precinct-114-half', 'in holding at the precinct');
select pg_temp.assert(public.choice_marked(pg_temp.u(1), 'holding'), 'held');
select pg_temp.assert((public.underworld_context(pg_temp.u(1)) ->> 'holding')::boolean, 'context shows holding');
select pg_temp.assert(pg_temp.raises(format($$select public.underworld_save(%L, 5, '{}', -10, 0, 0, '[]', 0, null)$$, pg_temp.u(1)), 'in_holding'), 'no job from holding');
select pg_temp.assert(exists (select 1 from public.choice_headlines where player_id = pg_temp.u(1) and text = 'Laptop lands @Runner at the 114½.'), 'the Blotter has it');
update public.players set news_opt_out = true where id = pg_temp.u(1);
select public.underworld_save(pg_temp.u(1), 5, '{"v":1}', 0, 0, 0, '[]', 0, 'Again, {name}.');
select pg_temp.assert(not exists (select 1 from public.choice_headlines where text like 'Again,%'), 'never for a News opt-out');

-- ---- A law job is its own lawyer ----
insert into public.careers (id, player_id, track, state) values (gen_random_uuid(), pg_temp.u(2), 'law', '{}');
select pg_temp.assert((public.underworld_context(pg_temp.u(2)) ->> 'lawJob')::boolean, 'Whitlock & Hale staff are their own lawyer');

-- ---- Start over forgets it ----
insert into public.player_restarts (player_id, clout_before, cash_before) values (pg_temp.u(1), 0, 0);
select pg_temp.assert(not exists (select 1 from public.underworld where player_id = pg_temp.u(1)), 'Start over forgets the underworld');

rollback;
