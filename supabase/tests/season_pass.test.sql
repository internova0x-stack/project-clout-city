-- Scenario test for migration 0156 (the Clout Pass and the starter pack): XP from tasks and goals while a season runs,
-- claiming both rows once, the paid row opened by the pass or VIP, refunds, the pack's window and pieces.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_player(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000020' || n, false) $$;
create function pg_temp.pid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000020' || n)::uuid $$;
create function pg_temp.refused(p_sku text, p_session text, p_code text) returns boolean language plpgsql as $$
begin
  perform public.start_purchase(p_sku, p_session);
  return false;
exception when sqlstate '22023' then return sqlerrm = p_code;
end $$;
create function pg_temp.claim_refused(p_code text) returns boolean language plpgsql as $$
begin
  perform public.season_claim_all();
  return false;
exception when sqlstate '22023' then return sqlerrm = p_code;
end $$;

insert into auth.users (id) select pg_temp.pid(n) from generate_series(1, 3) n;
set role authenticated;
do $$ begin
  for n in 1..3 loop
    perform pg_temp.as_player(n);
    perform public.create_player('Passer' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;

-- ---- Before the season: no XP, no checkout, nothing to claim ----
update public.game_settings set value = value || jsonb_build_object('starts', public.ny_today() + 3, 'ends', public.ny_today() + 30)
 where key = 'season_pass';
select public.ledger_once(pg_temp.pid(1), 'clout', 5, 'goal', 'early-goal');
select pg_temp.assert(not exists (select 1 from public.season_xp where player_id = pg_temp.pid(1)), 'no XP before the season');
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(public.season_state() ->> 'phase' = 'soon', 'phase soon');
select pg_temp.assert(pg_temp.refused('season-pass-s1', 'cs_sp_0', 'season_soon'), 'the pass is not sold before its season');
select pg_temp.assert(pg_temp.claim_refused('season_soon'), 'nothing to claim before the season');
reset role;

-- ---- The season runs: goals and tasks earn XP, once per ref ----
update public.game_settings set value = value || jsonb_build_object('starts', public.ny_today() - 1, 'ends', public.ny_today() + 30)
 where key = 'season_pass';
select public.ledger_once(pg_temp.pid(1), 'clout', 5, 'goal', 'g' || n) from generate_series(1, 7) n;
select public.ledger_once(pg_temp.pid(1), 'cash', 30, 'daily_task', 't1');
select public.ledger_once(pg_temp.pid(1), 'clout', 30, 'daily_task', 't1');
select public.ledger_once(pg_temp.pid(1), 'cash', 30, 'gig', 'not-counted');
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert((public.season_state() ->> 'xp')::int = 360, 'seven goals and one task (cash and clout rows count once): 360 XP');
select pg_temp.assert(public.season_state() ->> 'phase' = 'on' and not (public.season_state() ->> 'paid')::boolean, 'on, paid row closed');

-- ---- Claiming the free row: tiers 1 and 2 (160 XP a tier) ----
create temp table before1 as select bank_cash, clout from public.players where id = pg_temp.pid(1);
select pg_temp.assert(jsonb_array_length(public.season_claim_all() -> 'got') = 2, 'two free rewards');
select pg_temp.assert((select p.bank_cash - b.bank_cash = 100 and p.clout - b.clout = 10 from public.players p, before1 b where p.id = pg_temp.pid(1)),
                      'tier 1 paid C$100, tier 2 paid 10 clout');
select pg_temp.assert(public.season_state() -> 'claimed' = '{"free": [1, 2], "paid": []}', 'free tiers 1 and 2 claimed');
select pg_temp.assert(jsonb_array_length(public.season_claim_all() -> 'got') = 0, 'claiming again gives nothing');

-- ---- Buying the pass opens the paid row, back to tier 1 ----
select public.start_purchase('season-pass-s1', 'cs_sp_1');
reset role;
select pg_temp.assert(public.payment_grant('evt_sp_1', 'cs_sp_1', 'pi_sp_1', pg_temp.pid(1), 'season-pass-s1', 799, 'usd') = 'granted', 'pass granted');
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert((public.season_state() ->> 'paid')::boolean, 'paid row open');
select pg_temp.assert(jsonb_array_length(public.season_claim_all() -> 'got') = 2, 'two paid pieces');
select pg_temp.assert((select count(*) = 2 from public.player_items where player_id = pg_temp.pid(1) and acquired = 'collector' and value = 0
                        and sku in ('pass-s1-cuffing-hoodie', 'home-pass-s1-situationship-neon')), 'the hoodie and the neon sign, worth nothing in Net Worth');
select pg_temp.assert(pg_temp.refused('season-pass-s1', 'cs_sp_1b', 'already_owned'), 'one pass is enough');
reset role;

-- ---- A refund takes the paid row back ----
select public.payment_refund('evt_sp_1r', 'pi_sp_1');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = pg_temp.pid(1) and sku in ('pass-s1-cuffing-hoodie', 'home-pass-s1-situationship-neon')),
                      'refund: the paid pieces go');
select pg_temp.assert(not exists (select 1 from public.season_claims where player_id = pg_temp.pid(1) and track = 'paid'), 'refund: paid claims go');
select pg_temp.assert(exists (select 1 from public.season_claims where player_id = pg_temp.pid(1) and track = 'free'), 'refund: the free row stays');

-- ---- VIP includes the pass ----
insert into public.store_products (sku, product_type, name, price_cents) values ('chat-unlimited-monthly', 'chat_pass', 'VIP', 499)
on conflict (sku) do nothing;
insert into public.entitlements (player_id, sku, product_type, status) values (pg_temp.pid(2), 'chat-unlimited-monthly', 'chat_pass', 'active');
set role authenticated;
select pg_temp.as_player(2);
select pg_temp.assert((public.season_state() ->> 'paid')::boolean and (public.season_state() ->> 'vip')::boolean, 'a VIP has the paid row');
select pg_temp.assert(pg_temp.refused('season-pass-s1', 'cs_sp_2', 'vip_has_pass'), 'a VIP is not sold the pass');

-- ---- The starter pack: once, in the first days ----
select pg_temp.as_player(3);
select pg_temp.assert((public.starter_pack_state() ->> 'offer')::boolean, 'a new player is offered the pack');
select public.start_purchase('starter-pack', 'cs_pp_3');
reset role;
select pg_temp.assert(public.payment_grant('evt_pp_3', 'cs_pp_3', 'pi_pp_3', pg_temp.pid(3), 'starter-pack', 299, 'usd') = 'granted', 'pack granted');
select pg_temp.assert((select count(*) = 6 from public.player_items where player_id = pg_temp.pid(3) and acquired = 'collector' and value = 0
                        and sku in (select jsonb_array_elements_text(public.game_settings_value('starter_pack') -> 'items'))), 'six pieces');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.pid(3) and badge_id = 'day-one'), 'Day One badge');
set role authenticated;
select pg_temp.as_player(3);
select pg_temp.assert((public.starter_pack_state() ->> 'owned')::boolean and not (public.starter_pack_state() ->> 'offer')::boolean, 'owned, no longer offered');
select pg_temp.assert(pg_temp.refused('starter-pack', 'cs_pp_3b', 'already_owned'), 'only once');
-- Pack pieces can't be sold back for C$.
do $$
declare refused boolean;
begin
  begin
    perform public.sell_item((select id from public.player_items where player_id = pg_temp.pid(3) and sku = 'home-pp-starter-sofa'));
    refused := false;
  exception when sqlstate '22023' then refused := true;
  end;
  perform pg_temp.assert(refused, 'a pack piece is never sold back');
end $$;
reset role;
select public.payment_refund('evt_pp_3r', 'pi_pp_3');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = pg_temp.pid(3) and sku like '%pp-%'), 'refund: the pieces go');
select pg_temp.assert(not exists (select 1 from public.player_badges where player_id = pg_temp.pid(3) and badge_id = 'day-one'), 'refund: the badge goes');

-- After the window, no pack.
update public.players set created_at = now() - interval '30 days' where id = pg_temp.pid(1);
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(not (public.starter_pack_state() ->> 'offer')::boolean, 'an older account is not offered the pack');
select pg_temp.assert(pg_temp.refused('starter-pack', 'cs_pp_1', 'offer_over'), 'an older account cannot buy it');
reset role;

-- ---- After the season: the grace days still claim, then nothing ----
update public.game_settings set value = value || jsonb_build_object('starts', public.ny_today() - 40, 'ends', public.ny_today() - 3)
 where key = 'season_pass';
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(public.season_state() ->> 'phase' = 'claim', 'grace days');
select pg_temp.assert(pg_temp.refused('season-pass-s1', 'cs_sp_late', 'season_over'), 'no pass after the season');
reset role;
update public.game_settings set value = value || jsonb_build_object('starts', public.ny_today() - 60, 'ends', public.ny_today() - 30)
 where key = 'season_pass';
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert(pg_temp.claim_refused('season_over'), 'nothing to claim once it is over');
reset role;

rollback;
