-- Scenario test for migration 0132 (Moral Choices with real stakes: bigger effects, bans, the gig lock, the holding cell
-- and bail, chain cards, Lola's Blotter). Runs in a transaction and rolls back. Run with scripts/test-db.sh.
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

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000151');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000151', false);
select public.create_player('Stakes', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']);
select public.roll_birth_lottery();
select public.move_in('astoria_studio');
reset role;
\set p '''00000000-0000-0000-0000-000000000151'''
update public.players set bank_cash = 5000, clout = 1000 where id = :p;

-- ---- Bigger numbers ----
select pg_temp.assert(public.choice_effects_ok('{"cash": 3000, "clout": -300}'), 'C$3,000 and 300 clout are fine');
select pg_temp.assert(not public.choice_effects_ok('{"cash": 3001}'), 'over the cap');
select pg_temp.assert(not public.choice_effects_ok('{"ban": {"place": "ditmars-deli", "days": 8}}'), 'a ban is a week at most');
select pg_temp.assert(not public.choice_effects_ok('{"holding": 4}'), 'three hours in holding at most');

-- ---- Banned from a place ----
select public.choice_apply(:p, '{"ban": {"place": "ditmars-deli", "days": 2}}', 'choice', 'ban-test');
select pg_temp.assert(pg_temp.raises($$update public.players set at_place = 'ditmars-deli' where id = '00000000-0000-0000-0000-000000000151'$$, 'banned_here'), 'can''t go there');
select pg_temp.assert(pg_temp.raises($$insert into public.place_visits (player_id, place_id, ny_date) values ('00000000-0000-0000-0000-000000000151', 'ditmars-deli', public.ny_today())$$, 'banned_here'), 'nor do anything there');
update public.players set at_place = 'hell-gate-park' where id = :p;
select pg_temp.assert((select at_place = 'hell-gate-park' from public.players where id = :p), 'other places are fine');

-- ---- The gig board locked ----
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
values (:p, public.ny_today(), 'side', 'Hold a ring light', 200, 5, 60, 0);
select public.choice_apply(:p, '{"gigLock": 1}', 'choice', 'lock-test');
select pg_temp.assert(pg_temp.raises($$update public.gig_offers set accepted_at = now() where player_id = '00000000-0000-0000-0000-000000000151'$$, 'gigs_locked'), 'no gigs while locked');

-- ---- The holding cell, and bail ----
select public.choice_apply(:p, '{"holding": 2}', 'choice', 'hold-test');
select pg_temp.assert((select at_place = 'precinct-114-half' from public.players where id = :p), 'taken to the 114½');
select pg_temp.assert(pg_temp.raises($$update public.players set at_place = 'hell-gate-park' where id = '00000000-0000-0000-0000-000000000151'$$, 'in_holding'), 'no leaving');
select pg_temp.assert(public.choice_bail(:p) = 300, 'bail: C$150 an hour left');
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'bail'), 'paid once');
update public.players set at_place = 'hell-gate-park' where id = :p;
select pg_temp.assert((select at_place = 'hell-gate-park' from public.players where id = :p), 'free to go');
select pg_temp.assert(pg_temp.raises(format('select public.choice_bail(%L)', '00000000-0000-0000-0000-000000000151'), 'not_held'), 'nothing to bail');

-- ---- A chain: the follow-up opens on its day, past the daily limit; a headline lands in the Blotter ----
create temp table l1 as select public.choice_open(:p, 'fence-phone', 'fence-phone', 'money', null) as id;
select public.choice_settle(:p, (select id from l1), 'fence', 0, 'You moved the phone.', '{"cash": 400, "integrity": -10}',
  jsonb_build_object('due', public.ny_today() + 1, 'text', 'Remember the phone?', 'effects', '{}'::jsonb, 'card', 'fence-phone-ten',
                     'headline', 'BREAKING: {name} seen moving boxes on Steinway.'));
update public.choice_log set shown_at = now() - interval '3 hours' where id = (select id from l1);
create temp table l2 as select public.choice_open(:p, 'other', 'other', 'life', null) as id;
select public.choice_skip(:p, (select id from l2));
update public.choice_later set due = public.ny_today() where player_id = :p;
select pg_temp.assert(jsonb_array_length(public.choice_land(:p)) = 0, 'a chain doesn''t land as a receipt');
select pg_temp.assert(public.choice_status(:p) ->> 'chainDue' = 'fence-phone-ten', 'the follow-up is due');
create temp table c as select public.choice_chain_open(:p, 'fence-phone', 'money', null) as r;
select pg_temp.assert((select r ->> 'card' = 'fence-phone-ten' from c), 'opened past two cards today');
select pg_temp.assert((select status = 'open' from public.choice_log where id = (select (r ->> 'log')::bigint from c)), 'waiting for an answer');
select pg_temp.assert(public.choice_chain_open(:p, 'x', 'life', null) is null, 'nothing else due');
set role authenticated;
select pg_temp.assert((public.choice_blotter() -> 0 ->> 'text') = 'BREAKING: @Stakes seen moving boxes on Steinway.', 'the Blotter names them');
reset role;
update public.players set news_opt_out = true where id = :p;
set role authenticated;
select pg_temp.assert(jsonb_array_length(public.choice_blotter()) = 0, 'never someone who opted out of News mentions');
reset role;

-- ---- Start over ends the lasting effects ----
insert into public.player_restarts (player_id, clout_before, cash_before) values (:p, 0, 0);
select pg_temp.assert(not exists (select 1 from public.choice_marks where player_id = :p), 'Start over clears them');

rollback;
\echo choice_stakes: ok
