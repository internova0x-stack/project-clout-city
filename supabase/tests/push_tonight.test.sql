-- Scenario test for migration 0084 (push: date tonight, the crew is there, party night, a guest pass tonight).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.q(p text, k text) returns bigint language sql as $$
  select count(*) from public.push_queue where player_id = p::uuid and kind = k $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000084a1'), ('00000000-0000-0000-0000-0000000084a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000084a1', false);
select 1 from public.create_player('Romeo', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://push.example/84a', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000084a2', false);
select 1 from public.create_player('Juno', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://push.example/84b', 'k', 'a', 'America/New_York');
reset role;

-- The crew is there: when Juno arrives, Romeo (in, not there yet) hears; an invited-only member doesn't.
with o as (insert into public.crew_outings (host, kind, place_id, activity, ny_date)
           values ('00000000-0000-0000-0000-0000000084a2', 'place', 'neon-spoon', 'eat', public.ny_today()) returning id)
insert into public.crew_outing_members (outing_id, player_id, status)
  select id, '00000000-0000-0000-0000-0000000084a2'::uuid, 'host' from o union all select id, '00000000-0000-0000-0000-0000000084a1'::uuid, 'in' from o;
delete from public.push_queue where player_id in ('00000000-0000-0000-0000-0000000084a1', '00000000-0000-0000-0000-0000000084a2');
update public.crew_outing_members set went_at = now() where player_id = '00000000-0000-0000-0000-0000000084a2';
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000084a1', 'crew_there') = 1, 'Romeo hears the crew is there');
select pg_temp.assert((select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000084a1' and kind = 'crew_there') like '👯 Juno is at %', 'crew copy');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000084a2', 'crew_there') = 0, 'not the one who arrived');

-- Tonight: an accepted date, a party night for students, an unused guest pass. The scan only fires in the evening
-- (New York), so outside 7 to 10 PM the checks are skipped.
insert into public.date_nights (host, guest, kind, target, ny_date, status, guest_went_at)
  values ('00000000-0000-0000-0000-0000000084a1', '00000000-0000-0000-0000-0000000084a2', 'place', 'neon-spoon', public.ny_today(), 'accepted', now());
insert into public.campus_enrolments (player_id, campus, enrolled_on) values ('00000000-0000-0000-0000-0000000084a1', 'st-johnsons', public.ny_today());
insert into public.guest_passes (player_id, earned_on) values ('00000000-0000-0000-0000-0000000084a1', public.ny_today());
select public.push_scan_tonight();
select pg_temp.assert(extract(hour from now() at time zone 'America/New_York') not between 19 and 22
  or (pg_temp.q('00000000-0000-0000-0000-0000000084a1', 'date_now') = 1 and pg_temp.q('00000000-0000-0000-0000-0000000084a2', 'date_now') = 0),
  'date tonight only for the one who hasn''t gone');
select pg_temp.assert(extract(hour from now() at time zone 'America/New_York') not between 20 and 22
  or (pg_temp.q('00000000-0000-0000-0000-0000000084a1', 'pass_tonight') = 1
      and pg_temp.q('00000000-0000-0000-0000-0000000084a1', 'party_soon') = case when extract(isodow from public.ny_today()) in (2, 4, 5, 6) then 1 else 0 end),
  'pass and party night');
-- The full scan still runs, and twice changes nothing.
select public.push_scan();
select pg_temp.assert(public.push_scan() = 0, 'scan is idempotent');

rollback;
\echo 'push_tonight: ok'
