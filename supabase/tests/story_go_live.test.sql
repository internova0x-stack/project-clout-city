-- Scenario test for migration 0080 (Go live now, and no "back to review" for a live story).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000008001'), ('00000000-0000-0000-0000-000000008002');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000008001');
delete from public.story_arcs where id like 'golive-%';
update public.story_arcs set status = 'paused' where type = 'main';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008001', false);
-- A draft written for some other weekday than today.
select public.admin_story_upsert(jsonb_build_object('id', 'golive-a', 'title', 'A', 'type', 'main', 'tier', 'free', 'status', 'active',
  'start_weekday', case when trim(to_char(public.ny_today(), 'fmday')) = 'monday' then 'tuesday' else 'monday' end,
  'beats', jsonb_build_array(jsonb_build_object('id', 'ga-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'Day one')), 'effects', '[]'::jsonb),
                             jsonb_build_object('id', 'ga-2', 'day', 2, 'news', jsonb_build_array(jsonb_build_object('headline', 'Day two')), 'effects', '[]'::jsonb))));
select public.admin_story_upsert(jsonb_build_object('id', 'golive-side', 'title', 'S', 'type', 'side', 'tier', 'free', 'parent_arc_id', 'golive-a', 'status', 'active',
  'beats', jsonb_build_array(jsonb_build_object('id', 'gs-1', 'day', 1, 'news', jsonb_build_array(jsonb_build_object('headline', 'Side')), 'effects', '[]'::jsonb))));
select pg_temp.assert(pg_temp.raises($$select public.admin_story_go_live('golive-side')$$, 'side_arcs_follow_parent'), 'sides follow their main');

-- Go live now: approved, today is Day 1, on any weekday; players see Day 1.
select public.admin_story_go_live('golive-a');
select pg_temp.assert((select x ->> 'review' = 'approved' and (x ->> 'day')::int = 1 and x ->> 'startAt' = public.ny_today()::text
                         from jsonb_array_elements(public.admin_story_list()) x where x ->> 'id' = 'golive-a'), 'live today');
select pg_temp.assert(pg_temp.raises($$select public.admin_story_go_live('golive-a')$$, 'arc_is_live'), 'once');
-- Its side story runs with it once approved.
select pg_temp.assert((select x ->> 'day' is null from jsonb_array_elements(public.admin_story_list()) x where x ->> 'id' = 'golive-side'), 'side waits for approval');
select public.admin_story_review('golive-side', 'approved');
select pg_temp.assert((select (x ->> 'day')::int = 1 from jsonb_array_elements(public.admin_story_list()) x where x ->> 'id' = 'golive-side'), 'side runs with its main');

-- A live story can't go back to review or be declined (that used to clear Day 1 mid-run).
select pg_temp.assert(pg_temp.raises($$select public.admin_story_review('golive-a', 'draft')$$, 'arc_is_live'), 'no back to review when live');
select pg_temp.assert(pg_temp.raises($$select public.admin_story_review('golive-a', 'declined', 'no')$$, 'arc_is_live'), 'no decline when live');
-- Paused, it can.
select public.admin_story_status('golive-a', 'paused');
select public.admin_story_review('golive-a', 'draft');
reset role;
select pg_temp.assert((select start_at is null from public.story_arcs where id = 'golive-a'), 'back to review clears Day 1 when not live');
set role authenticated;

-- Admins only.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008002', false);
select pg_temp.assert(pg_temp.raises($$select public.admin_story_go_live('golive-a')$$, 'not_admin'), 'admins only');

rollback;
\echo 'story_go_live: ok'
