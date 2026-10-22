-- Scenario test for migration 0117: reading a released post pays 10 clout once; future and locked posts pay nothing.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, code text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return sqlerrm like '%' || code || '%'; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000011701'), ('00000000-0000-0000-0000-000000011702');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000011701');
update public.story_arcs set status = 'paused' where type = 'main';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000011701', false);
select public.admin_story_upsert(jsonb_build_object('id', 'read-a', 'title', 'A', 'type', 'main', 'tier', 'free', 'status', 'active',
  'beats', jsonb_build_array(
    jsonb_build_object('id', 'r-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'Today', 'body', 'Teaser', 'post', 'The post')), 'effects', '[]'::jsonb),
    jsonb_build_object('id', 'r-2', 'day', 2, 'news', jsonb_build_array(jsonb_build_object('headline', 'Tomorrow', 'body', 'Later', 'post', 'Later post')), 'effects', '[]'::jsonb))));
select public.admin_story_go_live('read-a');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000011702', false);
select 1 from public.create_player('Reader', 'bodega_drip', '{}', null, true);
select pg_temp.assert((select x -> 'beats' -> 0 ->> 'read' from jsonb_array_elements(public.story_feed() -> 'arcs') x where x ->> 'id' = 'read-a') = 'false', 'not read yet');
select pg_temp.assert(public.read_post('r-1') = 10, 'first read pays 10');
select pg_temp.assert(public.read_post('r-1') = 0, 'once only');
select pg_temp.assert((select clout from public.players where display_name = 'Reader') = 10, 'clout added once');
select pg_temp.assert((select x -> 'beats' -> 0 ->> 'read' from jsonb_array_elements(public.story_feed() -> 'arcs') x where x ->> 'id' = 'read-a') = 'true', 'the feed knows it was read');
select pg_temp.assert(pg_temp.raises($$select public.read_post('r-2')$$, 'not_released'), 'tomorrow''s post pays nothing yet');
select pg_temp.assert(pg_temp.raises($$select public.read_post('nope')$$, 'unknown_beat'), 'unknown post');

rollback;
\echo 'story_read: ok'
