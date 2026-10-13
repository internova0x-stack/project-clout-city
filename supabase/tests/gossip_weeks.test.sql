-- Scenario test for migration 0034 (gossip weeks: upload, review and approval in the Studio).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-0000000000d1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select 1 from public.create_player('teadrinker', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;

create temp table g as select jsonb_build_object('week', '2026-10-19', 'stories', jsonb_build_array(
  jsonb_build_object('id', 'test-story', 'title', 'A test', 'pieces', jsonb_build_array()))) as data;
grant select on g to authenticated;

-- Players can't read the week files (every piece is in there), or use the Studio.
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select * from public.gossip_weeks$$, 'permission denied'), 'no reading gossip weeks');
select pg_temp.assert(pg_temp.raises($$select * from public.gossip_found$$, 'permission denied'), 'no reading progress directly');
select pg_temp.assert(pg_temp.raises($$select public.admin_gossip_upsert((select data from g))$$, 'not_admin'), 'only admins upload');

-- Automatic: the game server's import (service role only) puts a week live without anyone approving it.
select pg_temp.assert(pg_temp.raises($$select public.gossip_import((select data from g))$$, 'permission denied'), 'players can''t import');
reset role;
select pg_temp.assert(public.gossip_import((select data from g)) = 'new', 'imported');
select pg_temp.assert(public.gossip_import((select data from g)) = 'same', 'importing again changes nothing');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select pg_temp.assert(public.admin_gossip_list() -> 0 ->> 'status' = 'approved', 'a new week goes live on its own');
-- The owner holds it with a note; the same file again stays held; a changed file goes live again.
select public.admin_gossip_status('2026-10-19', 'review', 'Make Benny meaner.');
select pg_temp.assert(public.admin_gossip_list() -> 0 ->> 'note' = 'Make Benny meaner.', 'note saved');
reset role;
select public.gossip_import((select data from g));
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select pg_temp.assert(public.admin_gossip_list() -> 0 ->> 'status' = 'review', 'the same file stays held');
select pg_temp.assert(public.admin_gossip_upsert((select jsonb_set(data, '{stories,0,title}', '"A better test"') from g)) = 'changed', 'a fixed file');
select pg_temp.assert(public.admin_gossip_list() -> 0 ->> 'status' = 'approved' and public.admin_gossip_list() -> 0 ->> 'note' is null, 'the fix goes live, note cleared');
-- Paused stays paused, even when the file changes.
select public.admin_gossip_status('2026-10-19', 'paused');
select public.admin_gossip_upsert((select data from g));
select pg_temp.assert(public.admin_gossip_list() -> 0 ->> 'status' = 'paused', 'paused stays paused');
select public.admin_gossip_status('2026-10-19', 'approved');
-- A story id belongs to one week.
select pg_temp.assert(pg_temp.raises($$select public.admin_gossip_upsert(jsonb_set((select data from g), '{week}', '"2026-10-26"'))$$, 'gossip_id_taken'), 'ids are unique across weeks');

-- Once a player has found a piece, the week can't change (pause it instead).
reset role;
insert into public.gossip_found (player_id, story_id, piece, via) select id, 'test-story', 0, 'overheard' from public.players where display_name = 'teadrinker';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select pg_temp.assert((public.admin_gossip_list() -> 0 -> 'started' ->> 'test-story')::int = 1, 'the Studio counts who started');
select pg_temp.assert(pg_temp.raises($$select public.admin_gossip_upsert(jsonb_set((select data from g), '{stories,0,title}', '"Late edit"'))$$, 'gossip_in_play'), 'no edits once players are in');
reset role;
select pg_temp.assert(public.gossip_import(jsonb_set((select data from g), '{stories,0,title}', '"Late edit"')) = 'in_play', 'the import leaves a week in play alone');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select public.admin_gossip_status('2026-10-19', 'paused');
select pg_temp.assert(public.admin_gossip_list() -> 0 ->> 'status' = 'paused', 'paused');

rollback;
\echo 'GOSSIP WEEK CHECKS PASSED'
