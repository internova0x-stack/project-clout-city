-- Scenario test for migration 0111 (headwear moves to the Shop): the four pieces are on sale as head pieces, and
-- running the migration gives a player who wore a free covering that piece, worn, in its place.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

select pg_temp.assert((select count(*) = 4 from public.shop_catalog where sku in ('satin-durag', 'wrapped-turban', 'terracotta-headwrap', 'knit-kippah')
                        and status = 'live' and slot = 'head' and wearable), 'four live head pieces');
select pg_temp.assert(public.shop_item('satin-durag') ->> 'category' = 'fashion', 'worn as fashion');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000111a1'), ('00000000-0000-0000-0000-0000000111a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000111a1', false);
select 1 from public.create_player('wrap_wearer', 'arcade_nerd', '{"body": "curvy", "covering": "turban"}', null, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000111a2', false);
select 1 from public.create_player('cap_wearer', 'arcade_nerd', '{"body": "straight", "covering": "cap"}', null, true);
reset role;
update public.players set look = look || '{"covering": "turban"}' where id = '00000000-0000-0000-0000-0000000111a1';

\i supabase/migrations/0111_headwear_shop.sql
select pg_temp.assert((select equipped from public.player_items where player_id = '00000000-0000-0000-0000-0000000111a1' and sku = 'wrapped-turban'), 'the turban is theirs, worn');
select pg_temp.assert((select look ->> 'covering' from public.players where id = '00000000-0000-0000-0000-0000000111a1') = 'none', 'the free covering is gone');
select pg_temp.assert((select look ->> 'covering' from public.players where id = '00000000-0000-0000-0000-0000000111a2') = 'cap', 'the cap stays free');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = '00000000-0000-0000-0000-0000000111a2'), 'nothing given to a cap wearer');
\i supabase/migrations/0111_headwear_shop.sql
select pg_temp.assert((select count(*) = 1 from public.player_items where player_id = '00000000-0000-0000-0000-0000000111a1'), 'safe to run twice');

select 'headwear_shop: ok';
rollback;
