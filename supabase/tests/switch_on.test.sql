-- Scenario test for migration 0101 (switching on: catalog clothes and accessories worn, dresses fill top and bottom).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000101a01'::uuid $$;
create function pg_temp.item(p text) returns bigint language sql security definer as $$
  select id from public.player_items where player_id = pg_temp.id() and sku = p order by id limit 1 $$;
create function pg_temp.on(p text) returns boolean language sql security definer as $$
  select equipped from public.player_items where player_id = pg_temp.id() and sku = p order by id limit 1 $$;
create function pg_temp.counts() returns jsonb language sql security definer as $$ select public.style_counts(pg_temp.id()) $$;

-- Three catalog pieces as the Studio imports them, approved and live: a shirt, a dress, sunglasses (Accessories tab).
insert into public.shop_catalog (sku, position, status, tab, slot, presentation, name, description, emoji, price, clout, stars, style_lines, template, wearable, origin, extra)
values ('test-shirt', 900, 'live', 'fashion', 'top', 'all', 'Shirt', '', '👔', 100, 5, 2, array['business-casual'], 'button_down', true, 'import', '{}'),
       ('test-dress', 901, 'live', 'fashion', 'one-piece', 'all', 'Dress', '', '👗', 100, 5, 2, array['fashionista'], 'midi_dress', true, 'import', '{}'),
       ('test-shades', 902, 'live', 'accessories', 'face', 'all', 'Shades', '', '🕶️', 100, 5, 2, array['fashionista'], 'rigid:eyewear', true, 'import', '{}'),
       ('test-locked', 903, 'live', 'accessories', 'neck', 'all', 'Locked', '', '📿', 100, 5, 2, '{}', 'rigid:necklace', false, 'import', '{}');

insert into auth.users (id, email) values (pg_temp.id(), 'switch@example.com');
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.id()::text, false);
select 1 from public.create_player('switch', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 100000, clout = 100000 where id = pg_temp.id();

-- Accessories are filed as fashion, so they can be worn; the Shop's list says so too.
select pg_temp.assert((public.shop_item('test-shades') ->> 'category') = 'fashion', 'wearable accessories are fashion');
select pg_temp.assert((public.shop_item('test-dress') ->> 'slot') = 'one-piece', 'a dress keeps its slot');
set role authenticated;
select 1 from public.buy_item('test-shirt');
select 1 from public.buy_item('test-dress');
select 1 from public.buy_item('test-shades');
reset role;
select pg_temp.assert((select category from public.player_items where id = pg_temp.item('test-shades')) = 'fashion', 'bought as fashion');

-- A locked piece still can't be bought.
set role authenticated;
do $$ begin perform public.buy_item('test-locked'); raise exception 'FAIL: locked piece bought'; exception when others then
  if sqlerrm like 'FAIL%' then raise; end if; end $$;
reset role;

-- Shirt and shades together; the dress takes the shirt off, and the shirt takes the dress off.
set role authenticated;
select 1 from public.equip_item(pg_temp.item('test-shirt'), true);
select 1 from public.equip_item(pg_temp.item('test-shades'), true);
reset role;
select pg_temp.assert(pg_temp.on('test-shirt') and pg_temp.on('test-shades'), 'shirt and shades');
select pg_temp.assert(pg_temp.counts() = '{"streetwear": 2, "fashionista": 1, "business-casual": 1}', 'shirt and shades count: ' || pg_temp.counts()::text);
set role authenticated;
select 1 from public.equip_item(pg_temp.item('test-dress'), true);
reset role;
select pg_temp.assert(pg_temp.on('test-dress') and not pg_temp.on('test-shirt') and pg_temp.on('test-shades'), 'the dress replaces the shirt, not the shades');
-- A dress covers the top and the bottom: only the shoes stay the starting style's.
select pg_temp.assert(pg_temp.counts() = '{"streetwear": 1, "fashionista": 2}', 'the dress counts: ' || pg_temp.counts()::text);
set role authenticated;
select 1 from public.equip_item(pg_temp.item('test-shirt'), true);
reset role;
select pg_temp.assert(pg_temp.on('test-shirt') and not pg_temp.on('test-dress'), 'the shirt replaces the dress');

-- Your Look can't save a dress with a top.
set role authenticated;
do $$ begin perform public.save_look(array[pg_temp.item('test-shirt'), pg_temp.item('test-dress')], 'none'); raise exception 'FAIL: dress and shirt saved';
exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  if sqlerrm <> 'one_piece_conflict' then raise exception 'FAIL: wrong error %', sqlerrm; end if; end $$;
select 1 from public.save_look(array[pg_temp.item('test-dress'), pg_temp.item('test-shades')], 'none');
reset role;
select pg_temp.assert(pg_temp.on('test-dress') and pg_temp.on('test-shades') and not pg_temp.on('test-shirt'), 'saved: the dress and the shades');

select 'switch_on: all passed';
rollback;
