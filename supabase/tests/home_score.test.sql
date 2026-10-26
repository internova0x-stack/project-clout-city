-- Scenario test for migration 0120 (the home score and wall art): paintings are on sale, the score counts placed pieces
-- by room, quality and art, and milestones pay clout once. Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.item(p text, s text) returns bigint language sql security definer as
  $$ select id from public.player_items where player_id = p::uuid and sku = s $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000201');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000201');
select 1 from public.create_player('Gallerist', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 50000 where id = '00000000-0000-0000-0000-000000000201';
select pg_temp.assert((select count(*) from public.shop_catalog where slot = 'art' and status = 'live') = 12, 'twelve paintings live');
select pg_temp.assert(public.shop_item('art-clout') ->> 'category' = 'home', 'a painting is in the Shop');
set role authenticated;

-- ---- Bare walls ----
select pg_temp.assert((public.home_score_state() ->> 'score')::int = 0, 'nothing placed');

-- ---- Buying a painting works like any Home piece ----
select 1 from public.buy_item('art-clout', 'buy');
select 1 from public.buy_item('art-rent-is-due', 'buy');
select 1 from public.buy_item('home-sofa-orange', 'buy');
select 1 from public.buy_item('home-sofa-blue', 'buy');
select 1 from public.buy_item('home-bed-blue', 'buy');
select 1 from public.buy_item('home-plant', 'buy');
select 1 from public.buy_item('home-chair-oak', 'buy');
select pg_temp.assert((public.home_score_state() ->> 'score')::int = 0, 'bought but not placed: nothing');

-- ---- Placed: rooms 30, quality round(40 * (3 sofa + 3 bed + 1 plant) / 10) = 28, art 2 x 5 = 10 → 68 ----
select 1 from public.save_home_layout(jsonb_build_array(
  jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'art-clout'), 'x', 0, 'z', -2, 'rot', 0),
  jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'art-rent-is-due'), 'x', 1, 'z', -2, 'rot', 0),
  jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'home-sofa-orange'), 'x', 0, 'z', 0, 'rot', 0),
  jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'home-sofa-blue'), 'x', 0, 'z', 1, 'rot', 0),
  jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'home-bed-blue'), 'x', 2, 'z', 0, 'rot', 0),
  jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'home-plant'), 'x', -2, 'z', 0, 'rot', 0)));
select pg_temp.assert((public.home_score_state() ->> 'score')::int = 68, 'score 68: ' || (public.home_score_state())::text);
select pg_temp.assert((public.home_score_state() -> 'rooms' ->> 'dining')::boolean = false, 'no dining yet');
select pg_temp.assert(public.home_score_state() -> 'reached' = '[40]'::jsonb, '40 reached');

-- ---- A chair in the dining area: rooms 40, quality 32, art 10 → 82; 70 pays once ----
select 1 from public.save_home_layout((select home_layout from public.players where id = auth.uid())
  || jsonb_build_array(jsonb_build_object('id', 'item:' || pg_temp.item('00000000-0000-0000-0000-000000000201', 'home-chair-oak'), 'x', -2, 'z', 2, 'rot', 0)));
select pg_temp.assert((public.home_score_state() ->> 'score')::int = 82, 'score 82');
select pg_temp.assert(jsonb_array_length(public.home_score_state() -> 'paid') = 0, 'milestones pay once');
reset role;
select pg_temp.assert((select sum(amount) from public.ledger where player_id = '00000000-0000-0000-0000-000000000201' and kind = 'home_score') = 150,
  '40 and 70 paid 150 clout');
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-000000000201') ->> 'homeScore')::int = 82, 'card shows the score');

-- ---- A bigger home asks for more: the same pieces in the LIC high-rise (target 18) ----
update public.players set home_id = 'lic_highrise' where id = '00000000-0000-0000-0000-000000000201';
select pg_temp.assert((public.home_score('00000000-0000-0000-0000-000000000201') ->> 'score')::int = 40 + 18 + 10, 'relative to the home');

rollback;
\echo home_score ok
