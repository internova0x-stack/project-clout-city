-- Story Studio (owner, Oct 18): "I cannot make a story and push it live in a moment", and approving a story looked
-- like it was done when it still had no Day 1.
--   * admin_story_go_live(arc): approves a main story and makes today (New York) its Day 1, whatever weekday the file
--     prefers. Its side stories run with it once they're approved. A live story, or a finale on the same day as
--     another running story's, is refused as with scheduling.
--   * admin_story_review: sending a live story back to review or declining it is refused (it used to clear Day 1 and
--     pull the story from players mid-run). Pause or retire a live story instead.
-- Safe to run more than once.

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
end;
$$;
revoke all on function public.admin_story_go_live(text) from public, anon;
grant execute on function public.admin_story_go_live(text) to authenticated;

create or replace function public.admin_story_review(p_arc text, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.story_arcs;
begin
  perform public.require_story_admin();
  if p_decision not in ('approved', 'declined', 'draft') then raise exception 'bad_decision' using errcode = '22023'; end if;
  select * into a from public.story_arcs where id = p_arc;
  if a.id is null then raise exception 'unknown_arc' using errcode = '22023'; end if;
  if p_decision <> 'approved' and public.arc_day(a) is not null then raise exception 'arc_is_live' using errcode = '22023'; end if;
  update public.story_arcs
     set review_status = p_decision, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now(),
         start_at = case when p_decision = 'approved' then start_at else null end, updated_at = now()
   where id = p_arc;
end;
$$;
