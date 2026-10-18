-- Scenario test for migration 0091 (creators step 5: videos, fees and results).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000b' || n)::uuid $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'boss@example.com'), (pg_temp.id(2), 'fan@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('vdboss', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
set role authenticated; select pg_temp.as_(1);
create temp table t as select public.admin_creator_save('{"name":"Tasha Glow","code":"TASHA","rate":20}') id;
create temp table t2 as select public.admin_creator_save('{"name":"Dev Okafor","code":"DEVQ","rate":20}') id;
reset role;
grant all on t, t2 to authenticated;
create temp table lk as select id from public.creator_links where slug = 'tasha';
create temp table lk2 as select id from public.creator_links where slug = 'devq';
grant all on lk, lk2 to authenticated;

-- A sign-up and a payment through Tasha's link; two clicks.
select public.creator_link('tasha'); select public.creator_link('tasha');
set role authenticated; select pg_temp.as_(2); select 1 from public.create_player('vdfan', 'bodega_drip', '{}', null, true); select public.creator_attach('tasha', null);
reset role;
select public.payment_grant('evt_v1', 'cs_v1', 'pi_v1', pg_temp.id(2), 'chat-unlimited-forever', 3999, 'usd');
select public.creator_commission_record('evt_v1', 'purchase:cs_v1', 'sale', pg_temp.id(2), 'chat-unlimited-forever', 'pi_v1', null, 3999, 146, 0, 'usd');

set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.admin_creator_videos()$$, 'not_admin'), 'videos are admin only');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises(format($$select public.admin_creator_video_save('{"creatorId":"%s","linkId":%s,"title":"x"}')$$, (select id from t), (select id from lk2)), 'link_not_theirs'), 'a link must be the creator''s own');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_creator_video_save('{"creatorId":"%s","title":" "}')$$, (select id from t)), 'title_required'), 'a title');
create temp table v as select public.admin_creator_video_save(jsonb_build_object('creatorId', (select id from t), 'linkId', (select id from lk), 'title', 'Halloween scratch', 'platform', 'tiktok', 'postedOn', '2026-10-10', 'feeCents', 15000)) id;
select public.admin_creator_video_save(jsonb_build_object('creatorId', (select id from t), 'title', 'Code-only story', 'platform', 'instagram', 'feeCents', 5000));

create temp table j as select public.admin_creator_videos() j;
select pg_temp.assert((select jsonb_array_length(j -> 'videos') from j) = 2, 'two videos');
select pg_temp.assert((select (x ->> 'clicks')::int from j, jsonb_array_elements(j -> 'videos') x where x ->> 'title' = 'Halloween scratch') = 2, 'clicks through its link');
select pg_temp.assert((select (x ->> 'payers')::int from j, jsonb_array_elements(j -> 'videos') x where x ->> 'title' = 'Halloween scratch') = 1, 'a payer');
select pg_temp.assert((select (x ->> 'revenueCents')::int from j, jsonb_array_elements(j -> 'videos') x where x ->> 'title' = 'Halloween scratch') = 3999, 'revenue');
select pg_temp.assert((select x -> 'clicks' from j, jsonb_array_elements(j -> 'videos') x where x ->> 'title' = 'Code-only story') = 'null'::jsonb, 'no link, no per-video numbers');
select pg_temp.assert((select (x ->> 'spendCents')::int from j, jsonb_array_elements(j -> 'creators') x where x ->> 'name' = 'Tasha Glow') = 20000, 'creator spend');
select pg_temp.assert((select (x ->> 'payers')::int from j, jsonb_array_elements(j -> 'creators') x where x ->> 'name' = 'Tasha Glow') = 1, 'creator payers');

select public.admin_creator_video_status((select id from v), 'removed');
select pg_temp.assert((select (x ->> 'videos')::int from jsonb_array_elements(public.admin_creator_videos() -> 'creators') x where x ->> 'name' = 'Tasha Glow') = 1, 'removed videos leave the count');
select pg_temp.assert((select (x ->> 'spendCents')::int from jsonb_array_elements(public.admin_creator_videos() -> 'creators') x where x ->> 'name' = 'Tasha Glow') = 20000, 'but their spend stays');
reset role;

rollback;
\echo 'creator_videos: ok'
