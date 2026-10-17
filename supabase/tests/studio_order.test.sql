-- Scenario test for migration 0071 (the Studio's story order and beat word edits).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000007101'), ('00000000-0000-0000-0000-000000007102');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000007101');
delete from public.story_arcs where id like 'order-test-%';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007101', false);
select public.admin_story_upsert(jsonb_build_object('id', 'order-test-a', 'title', 'A', 'type', 'main', 'tier', 'free', 'status', 'active',
  'beats', jsonb_build_array(jsonb_build_object('id', 'a-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'Old words')), 'effects', '[]'::jsonb))));
select public.admin_story_upsert(jsonb_build_object('id', 'order-test-b', 'title', 'B', 'type', 'main', 'tier', 'free', 'status', 'active', 'beats', '[]'::jsonb));
select public.admin_story_review('order-test-a', 'approved');

-- Order: B above A once the Studio says so.
select public.admin_story_reorder(array['order-test-b', 'order-test-a']);
select pg_temp.assert((select array_agg(x ->> 'id') from jsonb_array_elements(public.admin_story_list()) x where x ->> 'id' like 'order-test-%')
                      = array['order-test-b', 'order-test-a'], 'listed in the Studio''s order');
select pg_temp.assert((select (x ->> 'position')::int from jsonb_array_elements(public.admin_story_list()) x where x ->> 'id' = 'order-test-a') = 2, 'position shown');

-- Beat words: saved, approval kept; a different day or id is refused.
select public.admin_beat_edit('order-test-a', 'a-1', jsonb_build_object('id', 'a-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'New words')), 'effects', '[]'::jsonb));
select pg_temp.assert(public.admin_story_get('order-test-a') -> 'beats' -> 0 -> 'news' -> 0 ->> 'headline' = 'New words', 'words saved');
select pg_temp.assert((select x ->> 'review' from jsonb_array_elements(public.admin_story_list()) x where x ->> 'id' = 'order-test-a') = 'approved', 'still approved');
select pg_temp.assert(pg_temp.raises($$select public.admin_beat_edit('order-test-a', 'a-1', '{"id": "a-1", "day": 2, "news": []}'::jsonb)$$, 'bad_beat'), 'the day stays');
select pg_temp.assert(pg_temp.raises($$select public.admin_beat_edit('order-test-a', 'a-1', '{"id": "a-9", "day": 1, "news": []}'::jsonb)$$, 'bad_beat'), 'the id stays');
select pg_temp.assert(pg_temp.raises($$select public.admin_beat_edit('order-test-a', 'nope', '{"id": "nope", "day": 1, "news": []}'::jsonb)$$, 'unknown_beat'), 'unknown beat');

-- Players can't.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007102', false);
select pg_temp.assert(pg_temp.raises($$select public.admin_story_reorder(array['order-test-a'])$$, 'not_admin'), 'reorder is admins only');
select pg_temp.assert(pg_temp.raises($$select public.admin_beat_edit('order-test-a', 'a-1', '{"id": "a-1", "day": 1, "news": []}'::jsonb)$$, 'not_admin'), 'edits are admins only');

select 'studio_order: ok';
rollback;
