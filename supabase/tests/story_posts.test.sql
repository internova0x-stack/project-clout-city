-- Scenario test for migration 0115: a released beat's blog post reaches the feed; a future beat's never does.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000011501'), ('00000000-0000-0000-0000-000000011502');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000011501');
update public.story_arcs set status = 'paused' where type = 'main';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000011501', false);
select public.admin_story_upsert(jsonb_build_object('id', 'blog-a', 'title', 'A', 'type', 'main', 'tier', 'free', 'status', 'active',
  'beats', jsonb_build_array(
    jsonb_build_object('id', 'p-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'Today', 'body', 'Teaser', 'post', 'Roommates, the whole post')), 'effects', '[]'::jsonb),
    jsonb_build_object('id', 'p-2', 'day', 2, 'news', jsonb_build_array(jsonb_build_object('headline', 'Tomorrow', 'body', 'Later', 'post', 'Tomorrow''s secret post')), 'effects', '[]'::jsonb))));
select public.admin_story_go_live('blog-a');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000011502', false);
select 1 from public.create_player('Reader', 'bodega_drip', '{}', null, true);
create temp table f as select x from jsonb_array_elements(public.story_feed() -> 'arcs') x where x ->> 'id' = 'blog-a';
select pg_temp.assert((select x -> 'beats' -> 0 ->> 'post' from f) = 'Roommates, the whole post', 'today''s post in the feed');
select pg_temp.assert((select x::text not like '%secret post%' from f), 'tomorrow''s post stays on the server');

rollback;
\echo 'story_posts: ok'
