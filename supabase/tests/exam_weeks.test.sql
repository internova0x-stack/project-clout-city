-- Weekly exam questions (migration 0077): content_import_exams stores a week's set, campus_exam_set prefers it over the
-- standing bank, a course is locked once someone has sat it, and only the service role may import.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.rows(p_tag text) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('course', 'napping-301', 'position', i, 'prompt', p_tag || ' question ' || i,
                                      'choices', jsonb_build_array('Yes', 'No', 'Maybe'), 'answer', i % 3))
    from generate_series(1, 5) i $$;

-- Before: the standing bank.
select pg_temp.assert((select bool_and(week is null) from public.campus_exam_set('napping-301')), 'the bank by default');
-- Import this week's set: it's used, in order, with its answers kept on the server.
select pg_temp.assert(public.content_import_exams(public.ny_week(), pg_temp.rows('First')) = 5, 'five stored');
select pg_temp.assert((select array_agg(prompt order by position) from public.campus_exam_set('napping-301'))[1] = 'First question 1', 'this week''s set first');
select pg_temp.assert((select count(*) from public.campus_exam_set('napping-301')) = 5, 'five questions');
-- Re-importing replaces it, until someone has sat the exam.
select public.content_import_exams(public.ny_week(), pg_temp.rows('Second'));
select pg_temp.assert((select prompt from public.campus_exam_set('napping-301') limit 1) = 'Second question 1', 'replaced before anyone sat it');
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000077a1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000077a1', false);
select 1 from public.create_player('Exa', 'bodega_drip', '{}', null, true);
reset role;
insert into public.campus_exams (player_id, week, course_id, correct, percent, grade)
values ('00000000-0000-0000-0000-0000000077a1', public.ny_week(), 'napping-301', 5, 100, 'A');
select pg_temp.assert(public.content_import_exams(public.ny_week(), pg_temp.rows('Third')) = 0, 'locked once sat');
select pg_temp.assert((select prompt from public.campus_exam_set('napping-301') limit 1) = 'Second question 1', 'unchanged');
-- Not a Monday: refused. Players can't import.
select pg_temp.assert(pg_temp.raises($$select public.content_import_exams(public.ny_week() + 1, '[]'::jsonb)$$, 'bad_week'), 'Mondays only');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.content_import_exams(date, jsonb)', 'execute'), 'players can''t import');
select pg_temp.assert(not has_function_privilege('anon', 'public.content_import_exams(date, jsonb)', 'execute'), 'anon can''t import');
select pg_temp.assert(has_function_privilege('service_role', 'public.content_import_exams(date, jsonb)', 'execute'), 'the game server can');

rollback;
\echo EXAM WEEKS CHECKS PASSED
