-- Scenario test for migration 0127 (Campaign Mode): players can't touch campaigns; starting needs Rank 2 and is one at
-- a time, one every 7 days, with a capped seed from the bank; saves are versioned and pay each payout once, inside the
-- caps; the end gives badges; goals read the campaigns; Start over abandons a running campaign. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000127' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.c(n int) returns uuid language sql as $$ select ('10000000-0000-0000-0000-0000000127' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm = msg; end $$;
create function pg_temp.goal(p uuid, g text) returns boolean language sql security definer as
  $$ select (x ->> 'done')::boolean from jsonb_array_elements(public.goal_list(p)) x where x ->> 'id' = g $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Manager', 'Newcomer'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;

-- ---- Players can't read campaigns or call the server's functions ----
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform 1 from public.campaigns; raise exception 'FAIL: campaigns readable';
  exception when insufficient_privilege then null; end;
  begin perform public.campaign_context(auth.uid()); raise exception 'FAIL: campaign_context callable';
  exception when insufficient_privilege then null; end;
  begin perform public.campaign_save(auth.uid(), gen_random_uuid(), 1, '{}', 1, 'running', null, null, '[]'); raise exception 'FAIL: campaign_save callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- Side goals: listed with the clout to Rank 2, never the suggestion without a running campaign ----
update public.players set clout = 40, best_rank = 1 where id = pg_temp.u(2);
select pg_temp.assert((select x -> 'parts' -> 0 ->> 'need' from jsonb_array_elements(public.goal_list(pg_temp.u(2))) x where x ->> 'id' = 'campaign_start')::int = 100, 'Pick your candidate shows the clout to Rank 2');
select pg_temp.assert((select bool_and((x ->> 'side')::boolean) from jsonb_array_elements(public.goal_list(pg_temp.u(2))) x where x ->> 'id' like 'campaign_%'), 'campaign goals are side goals');
insert into public.ledger (player_id, currency, amount, kind, ref)
  select pg_temp.u(2), 'clout', 0, 'goal', g from unnest(array['regular', 'first_purchase', 'first_shift', 'full_day', 'first_gig', 'own_place']) g;
select pg_temp.assert(public.goal_current(pg_temp.u(2)) ->> 'id' = 'next_chapter', 'a side goal never blocks the next chapter');

-- ---- Starting: Rank 2 first ----
update public.players set clout = 0, best_rank = 1, bank_cash = 2000 where id in (pg_temp.u(1), pg_temp.u(2));
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_begin(%L, %L, 'starr', '{}', 0)$$, pg_temp.u(2), pg_temp.c(9)), 'locked'), 'Rank 2 opens it');
update public.players set clout = 150 where id = pg_temp.u(1);
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_begin(%L, %L, 'starr', '{}', 1001)$$, pg_temp.u(1), pg_temp.c(1)), 'bad_seed'), 'seed capped at C$1,000');
select public.campaign_begin(pg_temp.u(1), pg_temp.c(1), 'starr', '{"v":1}', 800);
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 1200, 'the seed leaves the bank');
select pg_temp.assert((select amount from public.ledger where player_id = pg_temp.u(1) and kind = 'campaign_seed') = -800, 'ledger campaign_seed');
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_begin(%L, %L, 'goldcrest', '{}', 0)$$, pg_temp.u(1), pg_temp.c(2)), 'running'), 'one at a time');
select pg_temp.assert(pg_temp.goal(pg_temp.u(1), 'campaign_start'), 'goal: pick your candidate');
select pg_temp.assert(not pg_temp.goal(pg_temp.u(1), 'campaign_week3'), 'not at week 3 yet');
insert into public.ledger (player_id, currency, amount, kind, ref)
  select pg_temp.u(1), 'clout', 0, 'goal', g from unnest(array['regular', 'first_purchase', 'first_shift', 'full_day', 'first_gig', 'own_place', 'first_crew', 'save_15k', 'skill_3']) g;
select pg_temp.assert(public.goal_current(pg_temp.u(1)) ->> 'id' = 'campaign_week3', 'with a campaign running, its goals are suggested');
select pg_temp.assert((public.campaign_context(pg_temp.u(1)) -> 'latest' ->> 'status') = 'running', 'context shows the running campaign');

-- ---- Saving: versioned, payouts once, inside the caps ----
select pg_temp.assert(public.campaign_save(pg_temp.u(1), pg_temp.c(1), 1, '{"v":1,"week":2}', 2, 'running', null, null,
  format('[{"currency":"clout","amount":20,"kind":"campaign_poll","ref":"%s:1"},{"currency":"clout","amount":999,"kind":"campaign_poll","ref":"%s:x"},{"currency":"cash","amount":500,"kind":"campaign_seed","ref":"%s:y"},{"currency":"clout","amount":5,"kind":"campaign_poll","ref":"someone-else:1"}]',
         pg_temp.c(1), pg_temp.c(1), pg_temp.c(1))::jsonb) = 2, 'saved as version 2');
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 170, 'only the valid poll payout paid');
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_save(%L, %L, 1, '{}', 2, 'running', null, null, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'conflict'), 'a stale version is refused');
-- The same payout again pays nothing.
select public.campaign_save(pg_temp.u(1), pg_temp.c(1), 2, '{}', 3, 'running', null, true,
  format('[{"currency":"clout","amount":20,"kind":"campaign_poll","ref":"%s:1"},{"currency":"cash","amount":1000,"kind":"campaign_skim","ref":"%s:2"}]', pg_temp.c(1), pg_temp.c(1))::jsonb);
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 170, 'paid once');
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 2200, 'the skim reaches the bank');
select public.campaign_save(pg_temp.u(1), pg_temp.c(1), 3, '{}', 3, 'running', null, null,
  format('[{"currency":"cash","amount":1000,"kind":"campaign_skim","ref":"%s:3"}]', pg_temp.c(1))::jsonb);
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 2700, 'skims stop at C$1,500 a campaign');
select pg_temp.assert(pg_temp.goal(pg_temp.u(1), 'campaign_week3') and pg_temp.goal(pg_temp.u(1), 'campaign_debate'), 'week 3 and the debate');
-- A discovered skim is repaid, but never below zero.
update public.players set bank_cash = 300 where id = pg_temp.u(1);
select public.campaign_save(pg_temp.u(1), pg_temp.c(1), 4, '{}', 4, 'running', null, null,
  format('[{"currency":"cash","amount":-1500,"kind":"campaign_repay","ref":"%s:skim"}]', pg_temp.c(1))::jsonb);
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(1)) = 0, 'repaid down to zero');

-- ---- The end: reward, badges, goals ----
select public.campaign_save(pg_temp.u(1), pg_temp.c(1), 5, '{}', 4, 'over', 'clean_win', null,
  format('[{"currency":"clout","amount":400,"kind":"campaign_reward","ref":"%s"}]', pg_temp.c(1))::jsonb);
select pg_temp.assert((select clout from public.players where id = pg_temp.u(1)) = 570, 'the end reward');
select pg_temp.assert((select count(*) from public.player_badges where player_id = pg_temp.u(1) and badge_id in ('campaign-ran', 'campaign-mayor')) = 2, 'badges');
select pg_temp.assert(pg_temp.goal(pg_temp.u(1), 'campaign_finish') and pg_temp.goal(pg_temp.u(1), 'campaign_clean'), 'finished, clean win');
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_save(%L, %L, 6, '{}', 4, 'running', null, null, '[]')$$, pg_temp.u(1), pg_temp.c(1)), 'conflict'), 'a finished campaign is closed');

-- ---- The 7-day rule, then Start over ----
select pg_temp.assert(pg_temp.raises(format($$select public.campaign_begin(%L, %L, 'goldcrest', '{}', 0)$$, pg_temp.u(1), pg_temp.c(2)), 'too_soon'), 'one start every 7 days');
update public.campaigns set started_at = now() - interval '8 days' where id = pg_temp.c(1);
select public.campaign_begin(pg_temp.u(1), pg_temp.c(2), 'goldcrest', '{}', 0);
insert into public.player_restarts (player_id, clout_before, cash_before) values (pg_temp.u(1), 0, 0);
select pg_temp.assert((select status from public.campaigns where id = pg_temp.c(2)) = 'abandoned', 'Start over abandons the running campaign');
select pg_temp.assert(not pg_temp.goal(pg_temp.u(1), 'campaign_start'), 'goals count campaigns since Start over');
select pg_temp.assert((select count(*) from public.campaigns where player_id = pg_temp.u(1)) = 2, 'history is kept');

\echo campaign: ok
rollback;
