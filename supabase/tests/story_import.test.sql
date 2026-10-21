-- Scenario test for migration 0098 (C6): story files load into the Studio by themselves, waiting for review, and never
-- overwrite a story the Studio already has.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

select pg_temp.assert(public.content_import_story('{"id":"c6-test-lease","type":"main","tier":"free","title":"T","beats":[]}'::jsonb) = 'added', 'a new story is added');
select pg_temp.assert((select review_status = 'draft' and start_at is null and status = 'active' from public.story_arcs where id = 'c6-test-lease'), 'it waits for review, no Day 1');
update public.story_arcs set review_status = 'approved' where id = 'c6-test-lease';
select pg_temp.assert(public.content_import_story('{"id":"c6-test-lease","type":"main","tier":"free","title":"Changed","beats":[]}'::jsonb) = 'kept', 'an existing story is kept');
select pg_temp.assert((select review_status = 'approved' and data ->> 'title' = 'T' from public.story_arcs where id = 'c6-test-lease'), 'untouched');
select pg_temp.assert(public.content_import_story('{"id":"c6-side","type":"side","tier":"premium","parent_arc_id":"c6-nobody","beats":[]}'::jsonb) = 'waiting_for_parent', 'a side story waits for its parent');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.content_import_story(jsonb)', 'execute'), 'not for the browser');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = 'downstairs-on-main' and p ->> 'name' = 'Downstairs on Main Food Court'), 'the food court is in the city');
select pg_temp.assert((select p ->> 'story' from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = 'court-square-courthouse') = 'lady-liberty', 'story places belong to their story');
select pg_temp.assert(public.date_target('place', 'downstairs-on-main') ->> 'price' = '15', 'the food court is a date spot');

rollback;
\echo 'story_import: ok'
