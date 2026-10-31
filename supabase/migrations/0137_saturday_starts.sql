-- 0137: stories and hunts start on Saturdays (owner, Oct 31: "Veto window for stories and hunts should be once a week on
-- Fridays. They should go live on Saturdays"; news and gossip keep their 24-hour window and Monday weeks).
--
--   * Hunts run Saturday to Friday from 2026-11-07 (lib/hunts.ts HUNT_SATURDAYS_FROM); earlier weeks keep their Monday.
--     The week check now takes either; the app's checks say which (validateHunt). hunt_current's seven days are unchanged.
--   * story_autopilot starts the next main story only on a Saturday, with that Saturday as Day 1 (or the Sunday after,
--     Day 1 still the Saturday, if nobody opened the game on Saturday). Friday is the owner's window to decline or
--     reorder it in the Studio; the Calendar names the story it will start. Stories the owner schedules keep any day.
--     It takes the day as an optional argument so tests can pick one.

do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.hunts'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%isodow%' loop
    execute format('alter table public.hunts drop constraint %I', c);
  end loop;
end $$;
alter table public.hunts add constraint hunts_week_start check (extract(isodow from week) in (1, 6));

drop function if exists public.story_autopilot();
create or replace function public.story_autopilot(p_today date default null) returns text
language plpgsql security definer set search_path = public
as $$
declare
  today date := coalesce(p_today, public.ny_today());
  -- The Saturday this weekend: today if it's Saturday, yesterday if it's Sunday.
  sat date := today - ((extract(isodow from today)::int + 1) % 7);
  nxt public.story_arcs;
begin
  if not (public.autopilot() ->> 'stories')::boolean then return null; end if;
  if today - sat > 1 then return null; end if;
  perform pg_advisory_xact_lock(hashtext('story_autopilot'));
  -- A main story still in its days on that Saturday (live, paused mid-run, or scheduled) keeps the city's one story slot.
  if exists (select 1 from public.story_arcs a
              where a.type = 'main' and a.status <> 'retired' and a.review_status = 'approved' and a.start_at is not null
                and a.start_at + public.arc_last_day(a) - 1 >= sat) then
    return null;
  end if;
  select * into nxt from public.story_arcs a
   where a.type = 'main' and a.status = 'active' and a.review_status in ('draft', 'approved') and a.start_at is null
   order by a.position nulls last, a.id
   limit 1;
  if nxt.id is null then return null; end if;
  update public.story_arcs
     set review_status = 'approved',
         reviewed_at = case when review_status = 'approved' then reviewed_at else now() end,
         start_at = sat, updated_at = now()
   where id = nxt.id;
  update public.story_arcs
     set review_status = 'approved', reviewed_at = now(), updated_at = now()
   where parent_id = nxt.id and type = 'side' and review_status = 'draft';
  return nxt.id;
end;
$$;
revoke all on function public.story_autopilot(date) from public, anon, authenticated;
grant execute on function public.story_autopilot(date) to service_role;
