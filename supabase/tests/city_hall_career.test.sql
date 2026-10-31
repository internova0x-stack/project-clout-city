-- Scenario test for migration 0144 (the City Hall career): a 'cityhall' job can be taken, its key skills are Aura and
-- Smarts, an unknown track is still refused, and the City Hall Annex is on the map. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000144' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm like '%' || msg || '%'; end $$;

insert into auth.users (id) values (pg_temp.u(1));
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select 1 from public.create_player('Aide', 'bodega_drip', '{}', null, true);
reset role;

select pg_temp.assert(public.career_skills('cityhall') = array['charisma', 'smarts'], 'Aura and Smarts');
select 1 from public.career_hire(pg_temp.u(1), '10000000-0000-0000-0000-000000014401', 'cityhall', 2, '{"v":1}');
select pg_temp.assert((select track from public.careers where player_id = pg_temp.u(1)) = 'cityhall', 'hired at City Hall');
update public.careers set status = 'quit', ended_at = now() where player_id = pg_temp.u(1);
select pg_temp.assert(pg_temp.raises($$insert into public.careers (id, player_id, track, state) values (gen_random_uuid(), pg_temp.u(1), 'finance', '{}')$$, 'careers_track_check'), 'unknown tracks still refused');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.game_settings_value('city') -> 'places') p where p ->> 'id' = 'city-hall-annex'), 'the Annex is on the map');

rollback;
