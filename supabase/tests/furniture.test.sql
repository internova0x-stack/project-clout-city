-- Scenario test for migration 0044 (Fif's Furniture: Home pieces bought like clothes, placed by the layout).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f2');
select pg_temp.assert(public.shop_item('home-sofa-blue') ->> 'category' = 'home', 'Home pieces are in the shop');
select pg_temp.assert((select count(*) from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = 'fifs-furniture') = 1, 'Fif''s Furniture is a place');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select 1 from public.create_player('fifs_buyer', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 20000 where display_name = 'fifs_buyer';
set role authenticated;

-- Bought like clothes: cash out, clout in, one row; two colors of the same sofa are two pieces.
select 1 from public.buy_item('home-sofa-blue');
select 1 from public.buy_item('home-sofa-green');
select pg_temp.assert((select count(*) from public.player_items where sku like 'home-sofa-%') = 2, 'two sofas');
select pg_temp.assert(pg_temp.raises($$select public.buy_item('home-sofa-blue')$$, 'already_owned'), 'one of each color');

-- Placed through the layout: more than the old 40 entries now fit, bad numbers still don't.
select public.save_home_layout((select jsonb_agg(jsonb_build_object('id', 'item:' || g, 'x', 0, 'z', 0, 'rot', 0)) from generate_series(1, 100) g));
select pg_temp.assert(jsonb_array_length((select home_layout from public.players where display_name = 'fifs_buyer')) = 100, '100 entries saved');
select pg_temp.assert(pg_temp.raises($$select public.save_home_layout((select jsonb_agg(jsonb_build_object('id', 'x', 'x', 0, 'z', 0, 'rot', 0)) from generate_series(1, 121)))$$, 'bad_layout'), 'no more than 120');
select pg_temp.assert(pg_temp.raises($$select public.save_home_layout('[{"id":"item:1","x":0,"z":0,"rot":5}]')$$, 'bad_layout'), 'quarter turns only');

rollback;
\echo FURNITURE CHECKS PASSED
