-- Scenario test for migration 0085: the story feed lists future beats locked, with only the next day's headline.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000008501'), ('00000000-0000-0000-0000-000000008502');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000008501');
update public.story_arcs set status = 'paused' where type = 'main';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008501', false);
select public.admin_story_upsert(jsonb_build_object('id', 'upc-a', 'title', 'A', 'type', 'main', 'tier', 'free', 'status', 'active',
  'beats', jsonb_build_array(
    jsonb_build_object('id', 'u-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'Today', 'body', 'Out now')), 'effects', '[]'::jsonb),
    jsonb_build_object('id', 'u-2', 'day', 2, 'news', jsonb_build_array(jsonb_build_object('headline', 'Tomorrow', 'body', 'Secret body')), 'effects', '[]'::jsonb),
    jsonb_build_object('id', 'u-3', 'day', 3, 'news', jsonb_build_array(jsonb_build_object('headline', 'Way later', 'body', 'Spoiler')), 'effects', '[]'::jsonb))));
select public.admin_story_go_live('upc-a');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008502', false);
select 1 from public.create_player('Reader', 'bodega_drip', '{}', null, true);
create temp table f as select x from jsonb_array_elements(public.story_feed() -> 'arcs') x where x ->> 'id' = 'upc-a';
select pg_temp.assert((select jsonb_array_length(x -> 'beats') from f) = 1, 'one beat released');
select pg_temp.assert((select x -> 'upcoming' from f) = '[{"id": "u-2", "day": 2, "headline": "Tomorrow"}, {"id": "u-3", "day": 3}]'::jsonb,
  'tomorrow''s headline only, later beats by day');
select pg_temp.assert((select x::text not like '%Secret body%' and x::text not like '%Way later%' and x::text not like '%Spoiler%' from f),
  'nothing else from future beats');

rollback;
\echo 'story_feed_upcoming: ok'
