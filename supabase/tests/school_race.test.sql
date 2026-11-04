-- Scenario test for migration 0162 (the Homecoming race): players can't touch races; declaring needs enrolment at that
-- campus, an account 7+ days old, no running campaign and no running race; campaign_begin refuses while a race runs; saves
-- are versioned and pay each payout once, inside the caps (cash, spend never below a zero bank, Mood, the meter, clout);
-- a crowned ending gives the badge and facts; Start over abandons a running race. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000162' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.r(n int) returns uuid language sql as $$ select ('20000000-0000-0000-0000-0000000162' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm = msg; end $$;
create function pg_temp.begin_(p uuid, r uuid, campus text, crown text) returns text language plpgsql as $$
begin perform public.school_begin(p, r, campus, crown, '{"v":1}'); return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Student', 'Freshman'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{"body":"curvy"}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;

-- ---- Players can't read races or call the server's functions ----
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform 1 from public.school_races; raise exception 'FAIL: school_races readable';
  exception when insufficient_privilege then null; end;
  begin perform public.school_context(auth.uid()); raise exception 'FAIL: school_context callable';
  exception when insufficient_privilege then null; end;
  begin perform public.school_begin(auth.uid(), gen_random_uuid(), 'st-johnsons', 'queen', '{}'); raise exception 'FAIL: school_begin callable';
  exception when insufficient_privilege then null; end;
  begin perform public.school_save(auth.uid(), gen_random_uuid(), 1, '{}', 'running', '[]'); raise exception 'FAIL: school_save callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- Declaring: enrolled at that campus, 7 days in, no campaign, one race ----
select pg_temp.assert(pg_temp.begin_(pg_temp.u(1), pg_temp.r(1), 'st-johnsons', 'queen') = 'not_enrolled', 'students only');
insert into public.campus_enrolments (player_id, campus, enrolled_on) values (pg_temp.u(1), 'st-johnsons', current_date), (pg_temp.u(2), 'st-johnsons', current_date);
select pg_temp.assert(pg_temp.begin_(pg_temp.u(1), pg_temp.r(1), 'queensborough-u', 'queen') = 'not_enrolled', 'at their own campus');
select pg_temp.assert(pg_temp.begin_(pg_temp.u(1), pg_temp.r(1), 'st-johnsons', 'queen') = 'too_new', 'accounts 7+ days old');
update public.players set created_at = now() - interval '8 days', bank_cash = 1000, mood = 50, clout = 0 where id in (pg_temp.u(1), pg_temp.u(2));
select pg_temp.assert((public.school_context(pg_temp.u(1)) ->> 'oldEnough')::boolean, 'context: old enough');
select pg_temp.assert(public.school_context(pg_temp.u(1)) ->> 'body' = 'curvy', 'context: the body (queen)');
select pg_temp.assert(public.school_context(pg_temp.u(1)) ->> 'campus' = 'st-johnsons', 'context: the campus');

-- A running campaign blocks declaring.
insert into public.campaigns (id, player_id, candidate, state) values (pg_temp.r(9), pg_temp.u(2), 'starr', '{}');
select pg_temp.assert(pg_temp.begin_(pg_temp.u(2), pg_temp.r(2), 'st-johnsons', 'queen') = 'campaign_running', 'not while a campaign runs');
delete from public.campaigns where id = pg_temp.r(9);

select pg_temp.assert(pg_temp.begin_(pg_temp.u(1), pg_temp.r(1), 'st-johnsons', 'queen') = 'ok', 'declared');
select pg_temp.assert(pg_temp.begin_(pg_temp.u(1), pg_temp.r(3), 'st-johnsons', 'queen') = 'running', 'one race at a time');
select pg_temp.assert(public.school_context(pg_temp.u(1)) -> 'latest' ->> 'status' = 'running', 'context shows the running race');
select pg_temp.assert(exists (select 1 from public.player_facts where player_id = pg_temp.u(1) and key = 'school.declared' and subject = 'queen'), 'fact: declared');

-- And no campaign while a race runs.
update public.players set clout = 150 where id = pg_temp.u(1);
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_begin(%L, %L, 'starr', '{}', 0)$$, pg_temp.u(1), pg_temp.r(8)), 'school_running'), 'no campaign while a race runs');
update public.players set clout = 0 where id = pg_temp.u(1);

-- ---- Saving: versioned, payouts once, inside the caps ----
select pg_temp.assert(public.school_save(pg_temp.u(1), pg_temp.r(1), 1, '{"v":1}', 'running', format('[
  {"kind":"school_cash","currency":"cash","amount":80,"ref":"%1$s:2026-11-09:1"},
  {"kind":"school_cash","currency":"cash","amount":999,"ref":"%1$s:big"},
  {"kind":"school_cash","currency":"cash","amount":80,"ref":"someone-else:1"},
  {"kind":"school_spend","currency":"cash","amount":-300,"ref":"%1$s:budget:1"},
  {"kind":"school_mood","currency":"mood","amount":3,"ref":"%1$s:2026-11-09:1:mood"},
  {"kind":"school_mood","currency":"mood","amount":30,"ref":"%1$s:x:mood"},
  {"kind":"school_meter","currency":"meter","amount":-6,"ref":"%1$s:card:a:meter"},
  {"kind":"school_week","currency":"clout","amount":15,"ref":"%1$s:week:1"},
  {"kind":"school_crown","currency":"clout","amount":400,"ref":"%1$s:crown"}
]', pg_temp.r(1))::jsonb) = 2, 'saved as version 2');
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 780, 'cash in and the budget out, nothing over the caps');
select pg_temp.assert((select mood from public.players where id = pg_temp.u(1)) = 53, 'Mood +3, the oversized one refused');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 44, 'the meter moved −6');
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 15, 'the week paid; no crown while running');
select pg_temp.assert(pg_temp.raises(format($$select public.school_save(%L, %L, 1, '{}', 'running', '[]')$$, pg_temp.u(1), pg_temp.r(1)), 'conflict'), 'a stale version is refused');

-- The same payouts again pay nothing; the meter stops at ±15 a race; spending never takes the bank below zero.
select public.school_save(pg_temp.u(1), pg_temp.r(1), 2, '{"v":1}', 'running', format('[
  {"kind":"school_cash","currency":"cash","amount":80,"ref":"%1$s:2026-11-09:1"},
  {"kind":"school_mood","currency":"mood","amount":3,"ref":"%1$s:2026-11-09:1:mood"},
  {"kind":"school_meter","currency":"meter","amount":-6,"ref":"%1$s:card:a:meter"},
  {"kind":"school_meter","currency":"meter","amount":-8,"ref":"%1$s:card:b:meter"},
  {"kind":"school_meter","currency":"meter","amount":-8,"ref":"%1$s:card:c:meter"},
  {"kind":"school_week","currency":"clout","amount":15,"ref":"%1$s:week:1"},
  {"kind":"school_spend","currency":"cash","amount":-1500,"ref":"%1$s:budget:2"}
]', pg_temp.r(1))::jsonb);
select pg_temp.assert((select mood from public.players where id = pg_temp.u(1)) = 53, 'Mood once');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 35, 'the meter capped at −15 a race');
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 15, 'the week once');
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 0, 'spending stops at a zero bank');
select pg_temp.assert((select amount from public.ledger where player_id = pg_temp.u(1) and kind = 'school_spend' and ref like '%:budget:2') = -780, 'the ledger records what was really spent');

-- ---- The end: the crown once, the badge and the fact ----
select public.school_save(pg_temp.u(1), pg_temp.r(1), 3, '{"v":1,"result":{"ending":"crown"}}', 'over', format('[
  {"kind":"school_crown","currency":"clout","amount":400,"ref":"%1$s:crown"},
  {"kind":"school_crown","currency":"clout","amount":80,"ref":"%1$s:runnerup"}
]', pg_temp.r(1))::jsonb);
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 415, 'the crown pays once a race');
select pg_temp.assert((select status = 'over' and ending = 'crown' from public.school_races where id = pg_temp.r(1)), 'over, crowned');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.u(1) and badge_id = 'homecoming-queen'), 'badge homecoming-queen');
select pg_temp.assert(exists (select 1 from public.player_facts where player_id = pg_temp.u(1) and key = 'school.crowned' and subject = 'queen'), 'fact: crowned');
select pg_temp.assert(pg_temp.raises(format($$select public.school_save(%L, %L, 4, '{}', 'running', '[]')$$, pg_temp.u(1), pg_temp.r(1)), 'conflict'), 'a finished race takes no saves');

-- ---- Start over abandons a running race ----
select pg_temp.assert(pg_temp.begin_(pg_temp.u(2), pg_temp.r(2), 'st-johnsons', 'king') = 'ok', 'the second student declares');
insert into public.player_restarts (player_id, clout_before, cash_before) values (pg_temp.u(2), 0, 0);
select pg_temp.assert((select status from public.school_races where id = pg_temp.r(2)) = 'abandoned', 'Start over abandons the race');
select pg_temp.assert(public.school_context(pg_temp.u(2)) -> 'latest' = 'null'::jsonb, 'an abandoned race is gone from the context');

rollback;
