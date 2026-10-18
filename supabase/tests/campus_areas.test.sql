-- Campus areas (migration 0075): the Quad and Library actions, and events that run on set days (Greek Row party
-- night). Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
-- Set an event's days and make it open all day (city time), so only the day decides.
create function pg_temp.event_days(p_event text, p_days jsonb) returns void language sql as $$
  update public.game_settings
     set value = jsonb_set(value, '{events}', (select jsonb_agg(case when e ->> 'id' = p_event
                   then e || jsonb_build_object('days', p_days, 'startHour', 0, 'hours', 24) else e end)
                   from jsonb_array_elements(value -> 'events') e))
   where key = 'city' $$;

-- The new actions and events are in the seed.
select pg_temp.assert((select count(*) from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
                        where p ->> 'id' in ('st-johnsons', 'queensborough-u') and a ->> 'id' in ('quad', 'study')) = 4, 'Quad and Library at both campuses');
select pg_temp.assert((select a ->> 'skill' from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
                        where p ->> 'id' = 'st-johnsons' and a ->> 'id' = 'study') = 'smarts', 'studying trains Smarts');
select pg_temp.assert((select e -> 'days' from jsonb_array_elements(public.city() -> 'events') e where e ->> 'id' = 'greek-row-sj') = '[2, 4, 5, 6]'::jsonb,
                      'Greek Row: Tuesday, Thursday, Friday, Saturday');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000075a1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000075a1', false);
select 1 from public.create_player('Party', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, at_place = 'st-johnsons', arrives_at = null where id = '00000000-0000-0000-0000-0000000075a1';

-- Not on today: refused. On today: in.
select pg_temp.event_days('greek-row-sj', jsonb_build_array(extract(isodow from public.ny_today())::int % 7 + 1));
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.attend_event('greek-row-sj')$$, 'not_tonight'), 'not tonight');
reset role;
select pg_temp.event_days('greek-row-sj', jsonb_build_array(extract(isodow from public.ny_today())::int));
set role authenticated;
select pg_temp.assert((public.attend_event('greek-row-sj') ->> 'clout')::int > 0, 'party night, in');
reset role;

-- The daily list never picks an event that isn't on today.
update public.game_settings
   set value = jsonb_set(value, '{events}', (select jsonb_agg(e || jsonb_build_object('days', jsonb_build_array(extract(isodow from public.ny_today())::int % 7 + 1)))
                                             from jsonb_array_elements(value -> 'events') e))
 where key = 'city';
do $$ begin
  for i in 1..15 loop
    delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000075a1';
    perform public.ensure_daily('00000000-0000-0000-0000-0000000075a1');
    if exists (select 1 from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000075a1' and kind = 'event') then
      raise exception 'FAIL: an event off today was picked';
    end if;
  end loop;
end $$;
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000075a1') = 5, 'still five tasks');

rollback;
\echo CAMPUS AREAS CHECKS PASSED
