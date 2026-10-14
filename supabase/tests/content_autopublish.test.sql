-- Scenario test for migration 0037 (test phase: news and hunts publish without approval).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

-- Players can't call it.
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.content_import_news('[]'::jsonb)$$, 'permission denied'), 'not for players');
select pg_temp.assert(pg_temp.raises($$select public.content_import_hunt('{}'::jsonb)$$, 'permission denied'), 'not for players');
reset role;

-- News: stored approved and in the feed today; a paused item stays paused when stored again.
select public.content_import_news(jsonb_build_array(
  jsonb_build_object('id', 'auto-one', 'kind', 'city', 'headline', 'Something juicy happened', 'body', 'And you will not believe who was there.', 'cast', '[]'::jsonb, 'day', public.ny_today()),
  jsonb_build_object('id', 'auto-two', 'kind', 'city', 'headline', 'Something else happened', 'body', 'Nobody is talking. Everybody is talking.', 'cast', '[]'::jsonb, 'day', public.ny_today())));
select pg_temp.assert((select status from public.news_items where id = 'auto-one') = 'approved', 'approved at once');
select pg_temp.assert(public.news_feed()::text like '%Something juicy happened%', 'in the feed');
update public.news_items set status = 'paused' where id = 'auto-two';
select public.content_import_news(jsonb_build_array(
  jsonb_build_object('id', 'auto-two', 'kind', 'city', 'headline', 'Something else happened', 'body', 'Nobody is talking. Everybody is talking.', 'cast', '[]'::jsonb, 'day', public.ny_today())));
select pg_temp.assert((select status from public.news_items where id = 'auto-two') = 'paused', 'a pause holds');

-- Hunts: stored approved and current this week; the same file again is 'same'.
create temp table hdata as select jsonb_build_object('id', 'auto-hunt', 'week', date_trunc('week', public.ny_today())::date, 'theme', 'Test', 'places', '["a","b","c","d"]'::jsonb,
  'tracks', '{}'::jsonb) d;
select pg_temp.assert(public.content_import_hunt(d) = 'stored', 'stored') from hdata;
select pg_temp.assert((select status from public.hunts where id = 'auto-hunt') = 'approved', 'approved at once');
select pg_temp.assert((public.hunt_current()).id = 'auto-hunt', 'it is this week''s hunt');
select pg_temp.assert(public.content_import_hunt(d) = 'same', 'same file, nothing changes') from hdata;
rollback;
\echo 'CONTENT AUTOPUBLISH CHECKS PASSED'
