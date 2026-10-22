-- Autopilot (owner, Oct 22: "Automate news, treasure hunts, tea, Stories unless paused"; lib/autopilot.ts):
--   * game_settings 'autopilot': one switch per kind (news, hunts, gossip, stories), all on. The game server stores the
--     weekly news, hunt and gossip files on its own only while their switch is on (lib/contentImport.ts,
--     lib/gossipImport.ts); a paused kind waits for the Studio, as before.
--   * story_autopilot() (service role, run with the weekly content import): while stories are on and no main story is
--     running or scheduled, the next main story in the Studio's order that hasn't run yet is approved and starts today
--     (its side stories waiting for review with it), like Go live now. A story the Studio declined or retired never
--     starts by itself; a paused story still running keeps its place.
--   * Tea (gossip) weeks always reach the Studio's Gossip list (it has no upload of its own); while gossip is paused a new
--     week arrives waiting for review instead of live (gossip_import).
--   * autopilot() and admin_autopilot_set(kind, on) for the Studio (admins only).
-- Safe to run more than once.

insert into public.game_settings (key, value)
values ('autopilot', '{"news": true, "hunts": true, "gossip": true, "stories": true}'::jsonb)
on conflict (key) do nothing;

/** The switches, every kind on unless set off. */
create or replace function public.autopilot() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'news', coalesce((s ->> 'news')::boolean, true), 'hunts', coalesce((s ->> 'hunts')::boolean, true),
    'gossip', coalesce((s ->> 'gossip')::boolean, true), 'stories', coalesce((s ->> 'stories')::boolean, true))
  from (select coalesce(public.game_settings_value('autopilot'), '{}'::jsonb) as s) x
$$;

/** Turns one kind's autopilot on or off (Studio admins). */
create or replace function public.admin_autopilot_set(p_kind text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_kind not in ('news', 'hunts', 'gossip', 'stories') or p_on is null then raise exception 'bad_kind' using errcode = '22023'; end if;
  insert into public.game_settings (key, value) values ('autopilot', jsonb_build_object(p_kind, p_on))
  on conflict (key) do update set value = public.game_settings.value || jsonb_build_object(p_kind, p_on), updated_at = now();
  return public.autopilot();
end;
$$;

/** Starts the next story when none is running or scheduled; returns its id, or null when nothing started. */
create or replace function public.story_autopilot() returns text
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  nxt public.story_arcs;
begin
  if not (public.autopilot() ->> 'stories')::boolean then return null; end if;
  perform pg_advisory_xact_lock(hashtext('story_autopilot'));
  -- A main story still in its days (live, paused mid-run, or scheduled) keeps the city's one story slot.
  if exists (select 1 from public.story_arcs a
              where a.type = 'main' and a.status <> 'retired' and a.review_status = 'approved' and a.start_at is not null
                and a.start_at + public.arc_last_day(a) - 1 >= today) then
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
         start_at = today, updated_at = now()
   where id = nxt.id;
  update public.story_arcs
     set review_status = 'approved', reviewed_at = now(), updated_at = now()
   where parent_id = nxt.id and type = 'side' and review_status = 'draft';
  return nxt.id;
end;
$$;

/** The game server's import of a checked gossip week (0034); a new week waits for review while gossip is paused. */
create or replace function public.gossip_import(p_data jsonb) returns text
language plpgsql security definer set search_path = public
as $$
declare r text;
begin
  r := public.gossip_store(p_data);
  if r = 'new' and not (public.autopilot() ->> 'gossip')::boolean then
    update public.gossip_weeks set status = 'review', review_note = 'Autopilot is paused for Tea: approve this week to put it live.'
     where week = (p_data ->> 'week')::date;
  end if;
  return r;
end;
$$;
revoke all on function public.gossip_import(jsonb) from public, anon, authenticated;
grant execute on function public.gossip_import(jsonb) to service_role;

revoke all on function public.autopilot() from public, anon;
grant execute on function public.autopilot() to authenticated;
revoke all on function public.admin_autopilot_set(text, boolean) from public, anon;
grant execute on function public.admin_autopilot_set(text, boolean) to authenticated;
revoke all on function public.story_autopilot() from public, anon, authenticated;
