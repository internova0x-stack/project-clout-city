-- Scenario test for migration 0052 (VIP: side stories free for monthly and yearly members, forever = chat only).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e' || n, false) $$;
create function pg_temp.side_owned(sku text) returns boolean language sql as $$
  select (x ->> 'owned')::boolean from jsonb_array_elements(public.store_catalog()) x where x ->> 'sku' = sku $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('vip_one', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('vip_two', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');

-- Names.
reset role;
select pg_temp.assert((select name from public.store_products where sku = 'chat-unlimited-monthly') = 'VIP (monthly)', 'VIP monthly');
select pg_temp.assert((select name from public.store_products where sku = 'chat-unlimited-yearly') = 'VIP (yearly)', 'VIP yearly');

-- Not a member: side stories locked.
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(not pg_temp.side_owned('side_sarah_bird_momager_files'), 'locked before VIP');
select pg_temp.assert(not (public.chat_status() ->> 'vip')::boolean, 'not a VIP');

-- Yearly VIP: every side story, the badge, and no buying a story on top.
reset role;
select public.payment_grant('evt_v1', 'cs_v1', 'sub_vip', '00000000-0000-0000-0000-0000000000e1', 'chat-unlimited-yearly', 3999, 'usd');
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert((public.chat_status() ->> 'vip')::boolean and (public.chat_status() ->> 'unlimited')::boolean, 'VIP and unlimited chat');
select pg_temp.assert(pg_temp.side_owned('side_sarah_bird_momager_files') and pg_temp.side_owned('side_sarah_bird_plus_one'), 'every side story');
select pg_temp.assert(not pg_temp.side_owned('postcard-unisphere'), 'postcards still cost');
select pg_temp.assert(pg_temp.raises($$select public.start_purchase('side_sarah_bird_night_book', 'cs_buy')$$, 'already_owned'), 'nothing to buy');
select pg_temp.as_(2);
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-0000000000e1') ->> 'vipSince') is not null, 'others see the badge');
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-0000000000e2') ->> 'vipSince') is null, 'no badge without VIP');
select pg_temp.assert(pg_temp.raises($$select public.vip_member('00000000-0000-0000-0000-0000000000e1')$$, 'permission denied'), 'membership is private');

-- The membership ends: stories lock again, a bought one stays.
reset role;
select public.payment_grant('evt_v2', 'cs_v2', 'pi_story', '00000000-0000-0000-0000-0000000000e1', 'side_sarah_bird_plus_one', 299, 'usd');
select public.payment_subscription('evt_v3', 'sub_vip', 'canceled');
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(not (public.chat_status() ->> 'vip')::boolean, 'VIP ended');
select pg_temp.assert(not pg_temp.side_owned('side_sarah_bird_momager_files'), 'locked again');
select pg_temp.assert(pg_temp.side_owned('side_sarah_bird_plus_one'), 'the bought one stays');

-- Chat forever: unlimited chat only.
reset role;
select public.payment_grant('evt_f1', 'cs_f1', 'pi_forever', '00000000-0000-0000-0000-0000000000e2', 'chat-unlimited-forever', 11999, 'usd');
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert((public.chat_status() ->> 'unlimited')::boolean and not (public.chat_status() ->> 'vip')::boolean, 'forever = chat, not VIP');
select pg_temp.assert(not pg_temp.side_owned('side_sarah_bird_momager_files'), 'side stories not included');

rollback;
\echo 'vip: ok'
