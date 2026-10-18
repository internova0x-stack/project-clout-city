-- Scenario test for migration 0087 (creators step 1: links, clicks, sign-up attribution, welcome gift, Studio).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000c' || n)::uuid $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'boss@example.com'), (pg_temp.id(2), 'fan@example.com'),
  (pg_temp.id(3), 'tasha@example.com'), (pg_temp.id(4), 'coder@example.com'), (pg_temp.id(5), 'late@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('crboss', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));

-- Only admins manage creators.
set role authenticated; select pg_temp.as_(2); select 1 from public.create_player('crfan', 'bodega_drip', '{}', null, true);
select pg_temp.assert(pg_temp.raises($$select public.admin_creators()$$, 'not_admin'), 'list is admin only');
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_save('{"name":"X","code":"XXX"}')$$, 'not_admin'), 'save is admin only');
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_link_save('{"slug":"x"}')$$, 'not_admin'), 'links are admin only');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.creator_link(text, boolean)', 'execute'), 'the click counter is server only');

-- The admin adds a creator: 20% and 24 months by default; a first link from the code.
select pg_temp.as_(1);
create temp table t as select public.admin_creator_save('{"name":"Tasha Glow","handle":"@tashaglow","email":"tasha@example.com","code":"tasha","months":24,"giftItem":"fit-bucket-hat"}') id;
grant all on t to authenticated;
select pg_temp.assert((public.admin_creators() -> 'creators' -> 0 ->> 'rate')::numeric = 20, 'default rate 20%');
select pg_temp.assert((public.admin_creators() -> 'creators' -> 0 -> 'links' -> 0 ->> 'slug') = 'tasha', 'first link is the code');
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_save('{"name":"Copy","code":"TASHA"}')$$, 'code_taken'), 'codes are unique');
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_save('{"name":"Big","code":"BIGG","rate":60}')$$, 'bad_rate'), 'rate tops out at 50');
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_save('{"name":"Big","code":"BIGG","months":6}')$$, 'bad_length'), '12, 24 or life');
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_save('{"name":"Big","code":"BIGG","giftItem":"car-hatchback"}')$$, 'bad_gift_item'), 'gift is a fashion item');

-- Custom links: slug rules, uniqueness.
select public.admin_creator_link_save(jsonb_build_object('creatorId', (select id from t), 'slug', 'tasha-tiktok', 'label', 'TikTok bio', 'lands', 'signup', 'campaign', 'Halloween'));
select pg_temp.assert(pg_temp.raises(format($$select public.admin_creator_link_save('{"creatorId":"%s","slug":"tasha-tiktok"}')$$, (select id from t)), 'slug_taken'), 'slugs are unique');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_creator_link_save('{"creatorId":"%s","slug":"Bad Slug!"}')$$, (select id from t)), 'bad_slug'), 'slug characters');
reset role;

-- Clicks: counted per day for live links.
select public.creator_link('tasha-tiktok'); select public.creator_link('TASHA-TIKTOK'); select public.creator_link('tasha', false);
select pg_temp.assert((select sum(clicks) from public.creator_clicks) = 2, 'two clicks counted, a peek is not');
select pg_temp.assert((public.creator_link('tasha-tiktok', false) ->> 'lands') = 'signup', 'it says where it lands');
select pg_temp.assert(public.creator_link('nobody') is null, 'unknown slug');

-- A new player through the link gets the gift once; a second attach does nothing.
set role authenticated; select pg_temp.as_(5); select 1 from public.create_player('crlate', 'bodega_drip', '{}', null, true);
reset role;
update public.players set created_at = now() - interval '2 days' where id = pg_temp.id(5);
update public.players set created_at = now() - interval '2 days' where id = pg_temp.id(2);
insert into auth.users (id, email) values (pg_temp.id(6), 'newbie@example.com');
set role authenticated;
select pg_temp.as_(6); select 1 from public.create_player('crnew', 'bodega_drip', '{}', null, true);
create temp table cash0 as select bank_cash from public.players where id = pg_temp.id(6);
select pg_temp.assert((public.creator_attach('tasha-tiktok', null) ->> 'cash')::int = 500, 'the welcome gift');
select pg_temp.assert(public.creator_attach('tasha-tiktok', null) is null, 'once only');
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.id(6)) = (select bank_cash from cash0) + 500, 'C$500 paid');
select pg_temp.assert(exists (select 1 from public.player_items where player_id = pg_temp.id(6) and sku = 'fit-bucket-hat' and acquired = 'earned'), 'the free item');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = pg_temp.id(6) and kind = 'creator_welcome'), 'ledger row');

-- Old accounts can't claim it; the creator's own account doesn't count.
select pg_temp.as_(5);
select pg_temp.assert(public.creator_attach(null, 'TASHA') is null, 'old accounts are not attributed');
select pg_temp.as_(3); select 1 from public.create_player('crtasha', 'bodega_drip', '{}', null, true);
select pg_temp.assert(public.creator_attach('tasha', null) is null, 'no self-referral');

-- A typed code works (any case, stray characters); a retired link stops attributing.
select pg_temp.as_(4); select 1 from public.create_player('crcoder', 'bodega_drip', '{}', null, true);
reset role;
create temp table lk as select id from public.creator_links where slug = 'tasha';
grant all on lk to authenticated;
set role authenticated; select pg_temp.as_(1);
select public.admin_creator_link_status((select id from lk), 'retired');
select pg_temp.as_(4);
select pg_temp.assert(public.creator_attach('tasha', ' tasha ') is not null, 'retired link falls back to the code');
reset role;
select pg_temp.assert((select how from public.creator_referrals where player_id = pg_temp.id(4)) = 'code', 'attributed by code');
select pg_temp.assert((select commission_until::date from public.creator_referrals where player_id = pg_temp.id(6)) = (now() + interval '24 months')::date, '24 months from sign-up');
select public.creator_link('tasha');
select pg_temp.assert((select sum(clicks) from public.creator_clicks) = 2, 'retired links stop counting');

set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(not exists (select 1 from public.creators) and not exists (select 1 from public.creator_referrals), 'no browser reads');
reset role;

-- The Studio: numbers, and rate and length changes logged.
set role authenticated; select pg_temp.as_(1);
select pg_temp.assert((public.admin_creators(30) -> 'creators' -> 0 ->> 'signups')::int = 2, 'two sign-ups');
select pg_temp.assert((public.admin_creators(30) -> 'creators' -> 0 ->> 'byCode')::int = 1, 'one by code');
select pg_temp.assert((public.admin_creators(0) -> 'creators' -> 0 ->> 'clicks')::int = 2, 'clicks all time');
select public.admin_creator_save(jsonb_build_object('id', (select id from t), 'name', 'Tasha Glow', 'code', 'TASHA', 'rate', 30, 'months', null, 'giftItem', 'fit-bucket-hat'));
reset role;
select pg_temp.assert((select count(*) from public.admin_actions where creator_id = (select id from t)) = 2, 'rate and length changes logged');
select pg_temp.assert((select commission_until::date from public.creator_referrals where player_id = pg_temp.id(6)) = (now() + interval '24 months')::date, 'a player keeps their length');

-- A paused creator's link still lands but does not count.
update public.creators set status = 'paused';
select pg_temp.assert((public.creator_link('tasha-tiktok') ->> 'live')::boolean = false, 'paused');
select pg_temp.assert((select sum(clicks) from public.creator_clicks) = 2, 'paused links do not count');

rollback;
\echo 'creators: ok'
