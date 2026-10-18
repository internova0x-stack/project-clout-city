-- Go live now (migration 0080) approved only the main story, so its side stories, still waiting for review, stayed
-- off (owner, Oct 18: "I did not see the side stories"). Now they go live with it; a declined, paused or retired side
-- story stays as it is. Safe to run more than once.

create or replace function public.admin_story_go_live(p_arc text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.story_arcs;
  today date := public.ny_today();
begin
  perform public.require_story_admin();
  select * into a from public.story_arcs where id = p_arc for update;
  if a.id is null then raise exception 'unknown_arc' using errcode = '22023'; end if;
  if a.type <> 'main' then raise exception 'side_arcs_follow_parent' using errcode = '22023'; end if;
  if public.arc_day(a) is not null then raise exception 'arc_is_live' using errcode = '22023'; end if;
  if exists (select 1 from public.story_arcs o
              where o.id <> a.id and o.type = 'main' and o.start_at is not null and o.status = 'active'
                and o.start_at + public.arc_last_day(o) - 1 = today + public.arc_last_day(a) - 1) then
    raise exception 'finale_collision' using errcode = '22023';
  end if;
  update public.story_arcs
     set review_status = 'approved',
         reviewed_by = case when review_status = 'approved' then reviewed_by else auth.uid() end,
         reviewed_at = case when review_status = 'approved' then reviewed_at else now() end,
         status = 'active', start_at = today, updated_at = now()
   where id = p_arc;
  -- Its side stories waiting for review go live with it; declined, paused and retired ones stay as they are.
  update public.story_arcs
     set review_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where parent_id = p_arc and type = 'side' and review_status = 'draft';
end;
$$;
