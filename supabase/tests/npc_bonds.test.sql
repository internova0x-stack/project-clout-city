-- Scenario test for migration 0159 (NPC favors and friendships): a favor opens only at the regular's place, 2 a day, once
-- every 3 days per regular, and doesn't count toward Moral Choices' 2 a day; help/exploit move the friendship; at Family an
-- exploit burns it; the weekly "on the house" and the monthly big favor back (C$300, or out of holding for Sgt. Bev).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.pid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000050' || n)::uuid $$;
create function pg_temp.as_player(n int) returns void language sql as $$ select set_config('request.jwt.claim.sub', pg_temp.pid(n)::text, false) $$;
create function pg_temp.open_refused(n int, p_card text, p_npc text, p_place text, p_code text) returns boolean language plpgsql as $$
begin
  perform public.favor_open(pg_temp.pid(n), p_card, p_card, p_npc, p_place);
  return false;
exception when others then return sqlerrm = p_code;
end $$;
create function pg_temp.call_refused(p_sql text, p_code text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then return sqlerrm = p_code;
end $$;

insert into auth.users (id) select pg_temp.pid(n) from generate_series(1, 2) n;
set role authenticated;
do $$ begin
  for n in 1..2 loop
    perform set_config('request.jwt.claim.sub', pg_temp.pid(n)::text, false);
    perform public.create_player('Neighbor' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;
update public.players set at_place = 'ditmars-deli', energy = 50, mood = 50, bank_cash = 100 where id = pg_temp.pid(1);

-- ---- Opening: at the place, then the limits ----
select pg_temp.assert(pg_temp.open_refused(1, 'favor-sal-a', 'sal', 'feta-compli', 'not_here'), 'not at the regular''s place');
select public.favor_open(pg_temp.pid(1), 'favor-sal-a', 'favor-sal-a', 'sal', 'ditmars-deli');
select pg_temp.assert(exists (select 1 from public.choice_log where player_id = pg_temp.pid(1) and area = 'favor' and status = 'open'), 'a favor is open');
select pg_temp.assert(pg_temp.open_refused(1, 'favor-sal-b', 'sal', 'ditmars-deli', 'asked_lately'), 'Sal asked today: not again for 3 days');
update public.players set at_place = 'grind-and-gossip' where id = pg_temp.pid(1);
select public.favor_open(pg_temp.pid(1), 'favor-jojo-a', 'favor-jojo-a', 'jojo', 'grind-and-gossip');
update public.players set at_place = 'velvet-static' where id = pg_temp.pid(1);
select pg_temp.assert(pg_temp.open_refused(1, 'favor-mags-a', 'mags', 'velvet-static', 'enough_favors'), 'two favors a day');
-- Favors don't use up Moral Choices' own two.
select pg_temp.assert((public.choice_context(pg_temp.pid(1)) ->> 'shownToday')::int = 0, 'favors left out of the day''s count');
select pg_temp.assert((public.choice_context(pg_temp.pid(1)) ->> 'favorsToday')::int = 2, 'favors counted on their own');
update public.choice_log set status = 'chosen' where player_id = pg_temp.pid(1);
select public.choice_open(pg_temp.pid(1), 'found-wallet-park', 'found-wallet', 'life', null);
select pg_temp.assert(true, 'a Moral Choices card still opens after two favors');

-- ---- The friendship ----
select public.npc_bond_note(pg_temp.pid(1), 'sal', 'help');
select pg_temp.assert((select favors = 1 from public.npc_bonds where player_id = pg_temp.pid(1) and npc = 'sal'), 'help: +1');
select public.npc_bond_note(pg_temp.pid(1), 'sal', 'exploit');
select pg_temp.assert((select favors = 0 from public.npc_bonds where player_id = pg_temp.pid(1) and npc = 'sal'), 'exploit: -2, never below 0');
update public.npc_bonds set favors = 5 where player_id = pg_temp.pid(1) and npc = 'sal';
select pg_temp.assert(public.npc_level(5) = 'friend', 'five favors: Friend');

-- ---- Friend: on the house once a week, at their place ----
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(pg_temp.call_refused('select public.npc_perk(''sal'', ''ditmars-deli'')', 'not_here'), 'on the house only at the deli');
reset role;
update public.players set at_place = 'ditmars-deli' where id = pg_temp.pid(1);
set role authenticated;
select pg_temp.as_player(1);
select public.npc_perk('sal', 'ditmars-deli');
reset role;
select pg_temp.assert((select energy = 60 and mood = 58 from public.players where id = pg_temp.pid(1)), 'Energy +10, Mood +8');
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(pg_temp.call_refused('select public.npc_perk(''sal'', ''ditmars-deli'')', 'done'), 'once a week');
select pg_temp.assert(pg_temp.call_refused('select public.npc_big_favor(''sal'')', 'not_family'), 'the big favor is for Family');
reset role;

-- ---- Family: the big favor back, and burning it ----
update public.npc_bonds set favors = 10 where player_id = pg_temp.pid(1) and npc = 'sal';
set role authenticated;
select pg_temp.as_player(1);
select public.npc_big_favor('sal');
select pg_temp.assert(pg_temp.call_refused('select public.npc_big_favor(''sal'')', 'done'), 'once every 30 days');
reset role;
select pg_temp.assert((select bank_cash = 400 from public.players where id = pg_temp.pid(1)), 'C$300 from Sal');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = pg_temp.pid(1) and kind = 'npc_favor' and amount = 300), 'ledger row');
select public.npc_bond_note(pg_temp.pid(1), 'sal', 'exploit');
select pg_temp.assert((select favors = 0 and burned_until = public.ny_today() + 30 from public.npc_bonds where player_id = pg_temp.pid(1) and npc = 'sal'), 'exploiting Family burns it for 30 days');
select pg_temp.assert(public.favor_block(pg_temp.pid(1), 'sal', 'ditmars-deli') = 'burned', 'a burned regular doesn''t ask');
select public.npc_bond_note(pg_temp.pid(1), 'sal', 'help');
select pg_temp.assert((select favors = 0 from public.npc_bonds where player_id = pg_temp.pid(1) and npc = 'sal'), 'help doesn''t count while burned');

-- ---- Sgt. Bev: out of holding ----
insert into public.npc_bonds (player_id, npc, favors) values (pg_temp.pid(2), 'sgt-bev', 10);
set role authenticated;
select pg_temp.as_player(2);
select pg_temp.assert(pg_temp.call_refused('select public.npc_big_favor(''sgt-bev'')', 'not_needed'), 'not in holding: nothing to do');
reset role;
insert into public.choice_marks (player_id, kind, place, until) values (pg_temp.pid(2), 'holding', 'precinct-114-half', now() + interval '2 hours');
set role authenticated;
select pg_temp.as_player(2);
select public.npc_big_favor('sgt-bev');
select pg_temp.assert(jsonb_array_length(public.npc_bonds_state()) = 1, 'the state lists the friendship');
reset role;
select pg_temp.assert(not exists (select 1 from public.choice_marks where player_id = pg_temp.pid(2) and kind = 'holding' and until > now()), 'out of holding');

rollback;
