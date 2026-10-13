-- Scenario test for migration 0019 (hunt review notes and replacing a week's hunt).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000091'), ('00000000-0000-0000-0000-000000000092');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000091');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000092', false);
select 1 from public.create_player('reviewer', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;

create temp table h as select jsonb_build_object(
  'id', 'first-hunt', 'week', date_trunc('week', public.ny_today())::date, 'theme', 'First', 'intro', 'The first hunt of the week.',
  'places', '["ditmars-deli", "ditmars-library", "engine-7", "hell-gate-park"]'::jsonb, 'chatter', '["Hi."]'::jsonb,
  'tracks', jsonb_build_object('bodega_drip', jsonb_build_object('treasure', 'Thing', 'emoji', '👟', 'lore', 'A thing.',
    'steps', jsonb_build_array(jsonb_build_object('say', 'Go.'), jsonb_build_object('say', 'Go.'), jsonb_build_object('say', 'Go.'),
      jsonb_build_object('say', 'Password?', 'question', jsonb_build_object('q', 'Q?', 'choices', '["A", "B"]'::jsonb, 'answer', 0), 'then', 'Yes.'))))) as data;
grant select on h to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000091', false);
select public.admin_hunt_upsert((select data from h));

-- Send back with a note; approving clears it.
select public.admin_hunt_status('first-hunt', 'review', 'Make the finale harder.');
select pg_temp.assert(public.admin_hunt_list() -> 0 ->> 'note' = 'Make the finale harder.', 'note saved');
select public.admin_hunt_status('first-hunt', 'approved');
select pg_temp.assert(public.admin_hunt_list() -> 0 ->> 'note' is null, 'approving clears the note');

-- A different hunt for the same week replaces it while nobody has joined.
select public.admin_hunt_upsert((select jsonb_set(jsonb_set(data, '{id}', '"better-hunt"'), '{theme}', '"Better"') from h));
select pg_temp.assert(jsonb_array_length(public.admin_hunt_list()) = 1 and public.admin_hunt_list() -> 0 ->> 'id' = 'better-hunt'
                      and public.admin_hunt_list() -> 0 ->> 'status' = 'review', 'replaced; the new one waits for review');
select public.admin_hunt_status('better-hunt', 'approved');

-- Once a player joins, it can't be replaced or edited; unchanged re-uploads are fine.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000092', false);
select 1 from public.hunt_join();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000091', false);
select pg_temp.assert(pg_temp.raises($$select public.admin_hunt_upsert((select data from h))$$, 'week_in_play'), 'can''t replace a hunt in play');
select pg_temp.assert(pg_temp.raises($$select public.admin_hunt_upsert((select jsonb_set(jsonb_set(data, '{id}', '"better-hunt"'), '{theme}', '"Edited"') from h))$$, 'hunt_in_play'), 'can''t edit a hunt in play');
select public.admin_hunt_upsert((select jsonb_set(jsonb_set(data, '{id}', '"better-hunt"'), '{theme}', '"Better"') from h));
select pg_temp.assert(public.admin_hunt_list() -> 0 ->> 'status' = 'approved', 'unchanged re-upload keeps it approved');
select pg_temp.assert(pg_temp.raises($$select public.admin_hunt_status('better-hunt', 'nope')$$, 'bad_status'), 'bad status refused');

rollback;
\echo HUNT REVIEW CHECKS PASSED
