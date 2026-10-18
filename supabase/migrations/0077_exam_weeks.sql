-- 0077: weekly exam questions from the repo (v0.15 campus life; docs/08-new-features-spec.md section 18). Each week file
-- in content/exams (checked by lib/exams.ts) is stored by the game server with content_import_exams(), like hunts and
-- news (migration 0037). campus_exam_set (0072) already prefers the week's own set over the standing bank.
--   * A course's questions for a week are replaced only until someone has sat that exam, so a grade never changes
--     under a player.
--   * Service role only; answers stay in campus_questions, which no browser can read.

create or replace function public.content_import_exams(p_week date, p_rows jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  r jsonb;
  v_course text;
  n int := 0;
begin
  if p_week is null or extract(isodow from p_week) <> 1 then raise exception 'bad_week' using errcode = '22023'; end if;
  for v_course in select distinct x ->> 'course' from jsonb_array_elements(p_rows) x loop
    continue when exists (select 1 from public.campus_exams where week = p_week and course_id = v_course);
    delete from public.campus_questions where week = p_week and course_id = v_course;
    for r in select x from jsonb_array_elements(p_rows) x where x ->> 'course' = v_course order by (x ->> 'position')::int loop
      insert into public.campus_questions (course_id, week, position, prompt, choices, answer)
      values (v_course, p_week, (r ->> 'position')::int, r ->> 'prompt',
              array(select jsonb_array_elements_text(r -> 'choices')), (r ->> 'answer')::int);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

revoke all on function public.content_import_exams(date, jsonb) from public, anon, authenticated;
grant execute on function public.content_import_exams(date, jsonb) to service_role;
