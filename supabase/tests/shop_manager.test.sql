-- Scenario test for migration 0099 (the Shop Manager, stage 1: the catalog in the database).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000009a' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000009a' || n)::uuid $$;
-- Reads the catalog (players can't; the test checks it directly).
create function pg_temp.cat(p text) returns public.shop_catalog language sql security definer as $$ select * from public.shop_catalog where sku = p $$;
create function pg_temp.shop(p text) returns jsonb language sql as $$
  select i from jsonb_array_elements(public.city() -> 'shop') i where i ->> 'sku' = p $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'shopboss@example.com'), (pg_temp.id(2), 'shopper@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('shopboss', 'bodega_drip', '{}', null, true);
select pg_temp.as_(2); select 1 from public.create_player('shopper', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
update public.players set bank_cash = 100000, clout = 0 where id = pg_temp.id(2);

-- The seed: everything on sale is live, and the game's Shop list is unchanged.
select pg_temp.assert((select count(*) from public.shop_catalog where status = 'live' and origin = 'code') = 61, 'every item on sale is live (64, less the 3 duplicates migration 0108 retires)');
select pg_temp.assert(jsonb_array_length(public.city() -> 'shop') = 68, 'the city shop lists them (and migration 0111''s four headwear pieces)');
select pg_temp.assert(public.shop_item('fit-satin-bomber') @> '{"price": 395, "clout": 25, "slot": "top", "category": "fashion", "status": "live"}', 'shop_item as before');
select pg_temp.assert(public.shop_item('house-lic-penthouse') ->> 'slot' is null, 'houses keep their null slot');
select pg_temp.assert((select price_cents from public.store_products where sku = 'col-faux-chinchilla') = 1699, 'chinchilla $16.99');
select pg_temp.assert((select price_usd_cents from public.shop_catalog where sku = 'col-faux-chinchilla') = 1699, 'catalog knows the price');

-- A later city seed can't undo the catalog.
update public.game_settings set value = value - 'shop' where key = 'city';
select pg_temp.assert(jsonb_array_length(public.city() -> 'shop') = 68, 'a city rewrite keeps the shop');

-- Players: the public Shop, and nothing for anon or a non-admin in the Studio.
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert(jsonb_array_length(public.shop_catalog_public()) = 68, 'players see what is on sale');
select pg_temp.assert(pg_temp.raises($$select public.admin_shop_list()$$, ''), 'not an admin');
reset role;
select pg_temp.assert(not has_function_privilege('anon', 'public.shop_catalog_public()', 'execute'), 'anon');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.shop_city_entries()', 'execute'), 'helper revoked');

-- Import: two drafts; re-importing the same is unchanged.
set role authenticated;
select pg_temp.as_(1);
create temp table imp as select public.admin_shop_import($$[
  {"sku":"test-hoodie","tab":"fashion","slot":"top","presentation":"all","name":"Test Hoodie","description":"A hoodie for testing.","emoji":"🧥","price":65,"clout":8,"tier":"budget","stars":1,"styleLines":["streetwear"],"template":"hoodie","wearable":false,"realCash":false,"priceUsdCents":null,"editionSize":null,"sourceImage":"https://img.example/h.png","transparent":false,"collection":null,"extra":{}},
  {"sku":"test-ring","tab":"luxury","slot":"neck","presentation":"all","name":"Test Pearls","description":"Pearls for testing.","emoji":"📿","price":6500,"clout":81,"tier":"luxury","stars":4,"styleLines":["luxury"],"template":"rigid:necklace","wearable":false,"realCash":false,"priceUsdCents":null,"editionSize":null,"sourceImage":"https://img.example/p.png","transparent":false,"collection":null,"extra":{}}
]$$::jsonb, 'shop-batch-test.json') r;
select pg_temp.assert((select r -> 'added' from imp) = '["test-hoodie", "test-ring"]', 'two added');
select pg_temp.assert((pg_temp.cat('test-hoodie')).status = 'draft', 'a draft');
select pg_temp.assert(pg_temp.shop('test-hoodie') is null, 'drafts are not in the game');
select pg_temp.assert(public.admin_shop_import($$[{"sku":"test-hoodie","tab":"fashion","slot":"top","presentation":"all","name":"Test Hoodie","description":"A hoodie for testing.","emoji":"🧥","price":65,"clout":8,"tier":"budget","stars":1,"styleLines":["streetwear"],"template":"hoodie","wearable":false,"realCash":false,"priceUsdCents":null,"editionSize":null,"sourceImage":"https://img.example/h.png","transparent":false,"collection":null,"extra":{}}]$$::jsonb, 'x') -> 'unchanged' = '["test-hoodie"]', 'same again: unchanged');
select pg_temp.assert(public.admin_shop_import($$[{"sku":"fit-satin-bomber","tab":"fashion","slot":"top","name":"Renamed","price":1}]$$::jsonb, 'x') -> 'kept' = '["fit-satin-bomber"]', 'live items are kept');
select pg_temp.assert((pg_temp.cat('fit-satin-bomber')).name = 'Satin bomber jacket', 'untouched');

-- Approving needs the picture; a processed picture moves the draft to review.
select pg_temp.assert(pg_temp.raises($$select public.admin_shop_action('test-hoodie', 'approve')$$, 'not_allowed'), 'drafts go to review first');
select public.admin_shop_set_image('test-hoodie', '{"card":"https://cdn.example/test-hoodie-256.webp","detail":"https://cdn.example/test-hoodie-768.webp"}', null);
select pg_temp.assert(((pg_temp.cat('test-hoodie')).status = 'pending_review' and (pg_temp.cat('test-hoodie')).image_status = 'ready'), 'image ready: review');
select public.admin_shop_set_image('test-ring', null, 'download failed');
select pg_temp.assert(((pg_temp.cat('test-ring')).status = 'draft' and (pg_temp.cat('test-ring')).image_error = 'download failed'), 'failed image stays draft');
select pg_temp.assert(pg_temp.raises($$select public.admin_shop_action('test-ring', 'send_back')$$, 'not_allowed'), 'a draft has nothing to send back');
select public.admin_shop_action('test-hoodie', 'approve');
select pg_temp.assert(pg_temp.shop('test-hoodie') @> '{"status":"live","wearable":false,"price":65}', 'live, locked, in the game');

-- Locked items show but can't be bought.
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.buy_item('test-hoodie', 'buy')$$, 'not_wearable_yet'), 'locked until its template exists');
select public.buy_item('fit-satin-bomber', 'buy');
select pg_temp.as_(1);

-- Edit: the game sees the new price; the audit log has it.
select public.admin_shop_edit('fit-varsity-tee', '{"price": 160, "clout": 11, "name": "Vintage varsity tee"}');
select pg_temp.assert(pg_temp.shop('fit-varsity-tee') @> '{"price":160,"clout":11}', 'edit reaches the game');
select pg_temp.assert(jsonb_array_length(public.admin_shop_audit('fit-varsity-tee')) = 1, 'audited');

-- A real-money price change: the next checkout uses it.
reset role;
update public.store_products set stripe_price_id = 'price_test_old' where sku = 'col-faux-chinchilla';
set role authenticated;
select public.admin_shop_edit('col-faux-chinchilla', '{"priceUsdCents": 1999}');
reset role;
select pg_temp.assert((select price_cents = 1999 and stripe_price_id is null from public.store_products where sku = 'col-faux-chinchilla'), 'new price, old Stripe price dropped');
set role authenticated;

-- Retire: no more sales; owners keep it; deleting a sold item is refused; restore puts it back.
select public.admin_shop_action('fit-satin-bomber', 'retire');
select pg_temp.as_(2);
select pg_temp.assert(exists (select 1 from public.player_items where player_id = pg_temp.id(2) and sku = 'fit-satin-bomber'), 'the owner keeps it');
select pg_temp.assert(pg_temp.shop('fit-satin-bomber') ->> 'status' = 'retired', 'still in the game for owners');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.admin_shop_action('fit-satin-bomber', 'delete')$$, 'sold_retire_instead'), 'sold: retire instead');
select public.admin_shop_action('fit-satin-bomber', 'restore');
select public.admin_shop_action('fit-varsity-tee', 'retire');
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.buy_item('fit-varsity-tee', 'buy')$$, 'not_for_sale'), 'retired items are not sold');
select pg_temp.as_(1);
select public.admin_shop_action('test-ring', 'delete');
select pg_temp.assert((pg_temp.cat('test-ring')).status = 'deleted', 'an unsold draft can be deleted');

-- Scheduling: hidden until its time, then live (and a drop gets Lola's News item).
select public.admin_shop_import($$[{"sku":"test-tee","tab":"fashion","slot":"top","name":"Test Drop Tee","description":"A tee for the drop.","price":55,"clout":7,"stars":1,"styleLines":[],"template":null,"wearable":true,"realCash":false,"sourceImage":"https://img.example/t.png","extra":{}}]$$::jsonb, 'x');
select public.admin_shop_set_image('test-tee', '{"card":"c","detail":"d"}', null);
select public.admin_shop_action('test-tee', 'approve', now() + interval '2 days');
select public.admin_shop_drop_news(array['test-tee'], now() + interval '2 days');
select pg_temp.assert((pg_temp.cat('test-tee')).status = 'scheduled', 'scheduled');
reset role;
select pg_temp.assert(exists (select 1 from public.news_items where id like 'shop-drop-%' and headline = 'New in the Shop: Test Drop Tee' and status = 'approved'), 'drop news');
set role authenticated;
select pg_temp.as_(1);
select pg_temp.as_(2);
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.shop_catalog_public()) x where x ->> 'sku' = 'test-tee'), 'not before its time');
select pg_temp.assert(pg_temp.raises($$select public.buy_item('test-tee', 'buy')$$, 'not_for_sale'), 'not for sale yet');
reset role;
update public.shop_catalog set go_live_at = now() - interval '1 minute' where sku = 'test-tee';
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.shop_catalog_public()) x where x ->> 'sku' = 'test-tee' and x ->> 'status' = 'live'), 'live at its time');
select public.buy_item('test-tee', 'buy');
select pg_temp.as_(1);
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.admin_shop_list()) x where x ->> 'sku' = 'test-tee' and x ->> 'status' = 'live' and (x ->> 'sold')::boolean), 'the Studio flips it live');

-- live-shop-images: a picture by exact name, for every color of a furniture line.
select pg_temp.assert(jsonb_array_length(public.admin_shop_image_source('Three-seat sofa', 'https://img.example/sofa.png', false, 'live-shop-images.json')) > 1, 'every sofa color');
select pg_temp.assert((pg_temp.cat('home-sofa-blue')).source_image = 'https://img.example/sofa.png', 'source saved');
select pg_temp.assert((pg_temp.cat('home-sofa-orange')).status = 'live', 'still live');
reset role;

rollback;
\echo 'shop_manager: ok'
