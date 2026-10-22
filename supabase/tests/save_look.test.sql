-- Scenario test for migration 0021 (Your Look: save the whole outfit and the headwear at once).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select 1 from public.create_player('look_other', 'arcade_nerd', '{}', null, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
-- A pre-v0.7 look: no build.
select 1 from public.create_player('look_saver', 'bodega_drip', '{"body": "straight", "covering": "none"}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 5000, look = look - 'build' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.player_items (player_id, sku, category, value, acquired)
  select '00000000-0000-0000-0000-0000000000b2', 'fit-varsity-tee', 'fashion', 65, 'bought';
create temp table theirs as select id from public.player_items where player_id = '00000000-0000-0000-0000-0000000000b2';
grant select on theirs to authenticated;

set role authenticated;
select 1 from public.buy_item('fit-satin-bomber'); select 1 from public.buy_item('fit-leather-blazer'); select 1 from public.buy_item('fit-mini-skirt');
create temp table ids as select sku, id from public.player_items where player_id = auth.uid();
grant select on ids to authenticated;

select public.save_look(array[(select id from ids where sku = 'fit-leather-blazer'), (select id from ids where sku = 'fit-mini-skirt')], 'fedora');
select pg_temp.assert((select array_agg(sku order by sku) from public.player_items where player_id = auth.uid() and equipped)
                      = array['fit-leather-blazer', 'fit-mini-skirt'], 'worn exactly what was saved');
select pg_temp.assert((select look ->> 'covering' from public.players where id = auth.uid()) = 'fedora', 'headwear saved');
select pg_temp.assert((select look ->> 'build' from public.players where id = auth.uid()) = 'athletic', 'legacy look gets its build');

select public.save_look('{}', 'none');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = auth.uid() and equipped), 'empty list takes everything off');

select pg_temp.assert(pg_temp.raises($$select public.save_look(array(select id from ids where sku in ('fit-satin-bomber', 'fit-leather-blazer')), 'none')$$, 'one_per_slot'), 'two tops refused');
select pg_temp.assert(pg_temp.raises($$select public.save_look(array(select id from theirs), 'none')$$, 'not_wearable'), 'someone else''s item refused');
select pg_temp.assert(pg_temp.raises($$select public.save_look('{}', 'crown')$$, 'bad_covering'), 'unknown headwear refused');

-- Migration 0109: the starter clothes switch with the look (free), and switch back to the style's own with null.
select public.save_look(array[(select id from ids where sku = 'fit-satin-bomber')], 'none',
  '{"top": "hoodie", "topColor": "#2F6FDB", "bottom": "shorts", "bottomColor": "#26232D", "shoeColor": "#E8692E"}');
select pg_temp.assert((select look -> 'fit' ->> 'top' from public.players where id = auth.uid()) = 'hoodie', 'starter top saved');
select pg_temp.assert((select array_agg(sku) from public.player_items where player_id = auth.uid() and equipped) = array['fit-satin-bomber'], 'items saved with it');
select public.save_look('{}', 'none', null);
select pg_temp.assert(not ((select look from public.players where id = auth.uid()) ? 'fit'), 'null wears the style''s own');
select pg_temp.assert(pg_temp.raises($$select public.save_look('{}', 'none', '{"top": "hoodie"}')$$, 'bad_fit'), 'half a fit refused');
select pg_temp.assert(pg_temp.raises($$select public.save_look('{}', 'none', '{"top": 1, "topColor": "x", "bottom": "y", "bottomColor": "z", "shoeColor": "w"}')$$, 'bad_fit'), 'non-text fit refused');
select pg_temp.assert(pg_temp.raises($$select public.save_look('{}', 'crown', null)$$, 'bad_covering'), 'the two-argument checks still apply');

rollback;
\echo SAVE LOOK CHECKS PASSED
