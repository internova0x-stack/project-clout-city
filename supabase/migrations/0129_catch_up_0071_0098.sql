-- Catch-up (owner, Oct 29): the "which have run" check showed 0071 and 0098 hadn't run on the live database. Their
-- functions exist nowhere else, but running 0098 as it is now would put back an old city seed over the newer ones
-- (0106, 0128). This file applies only what they add:
--   * 0071: story_arcs.position (the Studio's story order, which story_autopilot reads), admin_story_list,
--     admin_story_reorder and admin_beat_edit. Nothing later replaces them.
--   * 0098: content_import_story (repo story files land in the Studio as drafts).
-- Safe to run more than once, and harmless where 0071 and 0098 did run.

alter table public.story_arcs add column if not exists position int;

create or replace function public.admin_story_list()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.data ->> 'title', 'type', a.type, 'tier', a.tier, 'sku', a.sku, 'parent', a.parent_id,
      'status', a.status, 'review', a.review_status, 'reviewNote', a.review_note, 'reviewedAt', a.reviewed_at,
      'startAt', public.arc_start(a), 'day', public.arc_day(a), 'lastDay', public.arc_last_day(a), 'updatedAt', a.updated_at,
      'startWeekday', a.data ->> 'start_weekday', 'position', a.position,
      'beats', (select jsonb_agg(jsonb_build_object('id', b ->> 'id', 'day', (b ->> 'day')::int, 'headline', b -> 'news' -> 0 ->> 'headline',
                                                     'status', coalesce(b ->> 'status', 'active'), 'prediction', b -> 'prediction' ->> 'id'))
                  from jsonb_array_elements(a.data -> 'beats') b),
      'votes', (select coalesce(jsonb_object_agg(prediction_id, n), '{}') from (
                  select v.prediction_id, count(*) as n from public.story_votes v
                   where v.prediction_id in (select b -> 'prediction' ->> 'id' from jsonb_array_elements(a.data -> 'beats') b where b ? 'prediction')
                   group by v.prediction_id) t)
    ) order by a.position nulls last, a.type, a.id), '[]') from public.story_arcs a);
end;
$$;

/** The Studio's order: every story id, top to bottom. Ids it doesn't know are skipped. */
create or replace function public.admin_story_reorder(p_ids text[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  update public.story_arcs a set position = x.ord
    from unnest(p_ids) with ordinality as x(id, ord)
   where a.id = x.id;
end;
$$;

/** Replaces one beat (its words, from the Studio). Same id and day as the stored beat; the approval stays. */
create or replace function public.admin_beat_edit(p_arc text, p_beat text, p_data jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  old jsonb;
begin
  perform public.require_story_admin();
  select b into old from public.story_arcs a, jsonb_array_elements(a.data -> 'beats') b where a.id = p_arc and b ->> 'id' = p_beat;
  if old is null then raise exception 'unknown_beat' using errcode = '22023'; end if;
  if p_data ->> 'id' is distinct from p_beat or p_data -> 'day' is distinct from old -> 'day'
     or jsonb_typeof(p_data -> 'news') <> 'array' then
    raise exception 'bad_beat' using errcode = '22023';
  end if;
  update public.story_arcs
     set data = jsonb_set(data, '{beats}', (
           select jsonb_agg(case when b ->> 'id' = p_beat then p_data else b end order by ord)
             from jsonb_array_elements(data -> 'beats') with ordinality as x(b, ord))),
         updated_at = now()
   where id = p_arc;
end;
$$;

revoke all on function public.admin_story_reorder(text[]) from public, anon;
grant execute on function public.admin_story_reorder(text[]) to authenticated;
revoke all on function public.admin_beat_edit(text, text, jsonb) from public, anon;
grant execute on function public.admin_beat_edit(text, text, jsonb) to authenticated;

create or replace function public.content_import_story(p_data jsonb) returns text
language plpgsql security definer set search_path = public
as $$
declare
  id_ text := p_data ->> 'id';
begin
  if id_ is null or p_data ->> 'type' not in ('main', 'side') or jsonb_typeof(p_data -> 'beats') <> 'array' then
    raise exception 'bad_arc' using errcode = '22023';
  end if;
  if exists (select 1 from public.story_arcs where id = id_) then return 'kept'; end if;
  if p_data ->> 'parent_arc_id' is not null and not exists (select 1 from public.story_arcs where id = p_data ->> 'parent_arc_id') then
    return 'waiting_for_parent';
  end if;
  insert into public.story_arcs (id, parent_id, type, tier, sku, data, review_status)
  values (id_, p_data ->> 'parent_arc_id', p_data ->> 'type', p_data ->> 'tier', p_data ->> 'sku', p_data, 'draft')
  on conflict (id) do nothing;
  return 'added';
end;
$$;

revoke all on function public.content_import_story(jsonb) from public, anon, authenticated;
grant execute on function public.content_import_story(jsonb) to service_role;

comment on function public.content_import_story(jsonb) is 'Repo story files to Studio drafts (0098, caught up by 0129).';
