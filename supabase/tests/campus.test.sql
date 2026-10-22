-- Campus life (migration 0072): enrolment, courses, classes and streaks, exams and the scholarship, the dining hall,
-- dorms for students only, and the leaderboard. Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.at(p text) returns void language plpgsql security definer as $$
begin update public.players set at_place = p, arrives_at = null where id = auth.uid(); end $$;

-- The clock on a Friday (exams open), keeping today's week if it's already Friday to Sunday.
update public.game_settings
   set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb(((5 - extract(isodow from public.ny_today())::int + 7) % 7) * 86400))
 where key = 'dev' and extract(isodow from public.ny_today()) < 5;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000072a1'), ('00000000-0000-0000-0000-0000000072a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000072a1', false);
select 1 from public.create_player('Cam', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, bank_cash = 5000 where id = '00000000-0000-0000-0000-0000000072a1';
set role authenticated;

-- Not a student yet: no classes, no dorm. Enrolling needs you on campus.
select pg_temp.assert(pg_temp.raises($$select public.campus_pick(array['napping-301','subway-studies','group-project'])$$, 'not_enrolled'), 'pick needs enrolment');
select pg_temp.assert(pg_temp.raises($$select public.move_home('sj_dorm')$$, 'dorm_students_only'), 'dorms are for students');
select pg_temp.assert(pg_temp.raises($$select public.campus_enrol('st-johnsons')$$, 'not_here'), 'enrol on campus');
select pg_temp.at('st-johnsons');
select pg_temp.assert(public.campus_enrol('st-johnsons') ->> 'campus' = 'st-johnsons', 'enrolled');
select pg_temp.assert(pg_temp.raises($$select public.campus_enrol('st-johnsons')$$, 'already_enrolled'), 'already enrolled');
select pg_temp.assert(pg_temp.raises($$select public.campus_enrol('queensborough-u')$$, 'not_here'), 'transfer needs the other campus');

-- Courses: exactly three different, known ones.
select pg_temp.assert(pg_temp.raises($$select public.campus_pick(array['napping-301','napping-301','group-project'])$$, 'pick_courses'), 'three different');
select pg_temp.assert(pg_temp.raises($$select public.campus_pick(array['napping-301','basket-weaving','group-project'])$$, 'unknown_course'), 'catalog only');
select pg_temp.assert(jsonb_array_length(public.campus_pick(array['napping-301','subway-studies','group-project']) -> 'courses') = 3, 'three courses');

-- Class: Energy for Confidence, 5 clout, Smarts practice, once a day per course.
select pg_temp.assert((public.campus_attend('napping-301') ->> 'clout')::int = 5, 'class pays clout');
select pg_temp.assert(pg_temp.raises($$select public.campus_attend('napping-301')$$, 'already_in_class'), 'once a day');
select pg_temp.assert(pg_temp.raises($$select public.campus_attend('finance-for-broke')$$, 'not_your_course'), 'only your courses');
select pg_temp.assert(pg_temp.raises($$select public.campus_pick(array['napping-301','subway-studies','intro-to-clout'])$$, 'schedule_locked'), 'schedule set after the first class');
reset role;
select pg_temp.assert((select energy from public.players where id = '00000000-0000-0000-0000-0000000072a1') = 90, 'class costs 10 Energy');
select pg_temp.assert(exists (select 1 from public.skill_log where player_id = '00000000-0000-0000-0000-0000000072a1' and skill = 'smarts'), 'smarts practice');
-- Streak: yesterday and the day before count (written straight in), so today makes 3.
insert into public.campus_attendance (player_id, course_id, day, campus) values
  ('00000000-0000-0000-0000-0000000072a1', 'subway-studies', public.ny_today() - 1, 'st-johnsons'),
  ('00000000-0000-0000-0000-0000000072a1', 'subway-studies', public.ny_today() - 2, 'st-johnsons');
set role authenticated;
select pg_temp.assert((public.campus_attend('subway-studies') ->> 'streak')::int = 3, 'streak counts consecutive days');

-- Exams: no answers in what the browser gets; a grade from attendance and answers.
select pg_temp.assert(jsonb_array_length(public.campus_exam('napping-301')) = 5, 'five questions');
select pg_temp.assert(not (public.campus_exam('napping-301') -> 0 ? 'answer'), 'no answer sent');
select pg_temp.assert(pg_temp.raises($$select public.campus_exam_submit('napping-301', array[0,0], false)$$, 'bad_answers'), 'all five answers');
-- napping-301 answers: 0, 0, 3, 0, 3. One day attended (of 4 for full marks) and 5 right: 12.5 + 50 = 63: D.
select pg_temp.assert(public.campus_exam_submit('napping-301', array[0,0,3,0,3], false) ->> 'grade' = 'D', 'one class and full marks is a D');
select pg_temp.assert(pg_temp.raises($$select public.campus_exam_submit('napping-301', array[0,0,3,0,3], false)$$, 'exam_taken'), 'no retakes');
reset role;
insert into public.campus_attendance (player_id, course_id, day, campus)
select '00000000-0000-0000-0000-0000000072a1', 'group-project', public.ny_week() + i, 'st-johnsons' from generate_series(0, 3) i
on conflict do nothing;
update public.campus_exams set grade = 'A' where player_id = '00000000-0000-0000-0000-0000000072a1' and course_id = 'napping-301';
set role authenticated;
-- subway-studies (3 days this week at most) and group-project (4 days): all right answers.
select pg_temp.assert(public.campus_exam_submit('group-project', array[1,0,2,0,1], false) ->> 'grade' = 'A', 'full attendance and full marks is an A');
-- subway-studies: 3 days and full marks is 88, a B; A, A and B make 3.67, so the scholarship pays.
select pg_temp.assert(((public.campus_exam_submit('subway-studies', array[0,3,1,0,0], false)) ->> 'scholarship')::int = 300, 'scholarship for a 3.5+ week');
reset role;
select pg_temp.assert((select count(*) from public.campus_exams where player_id = '00000000-0000-0000-0000-0000000072a1') = 3, 'three exams');
-- A week of A, A and at least a B is 3.67 or more: the scholarship pays once.
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-0000000072a1' and kind = 'scholarship') = 1, 'scholarship paid once');
set role authenticated;
select pg_temp.assert(public.campus_state() ->> 'gpa' is not null, 'GPA shown');

-- Dining hall: the student price at your campus.
select pg_temp.assert((public.campus_eat() ->> 'cash')::int = -6, 'student price');
-- Dorm: students of that campus only.
select pg_temp.assert(pg_temp.raises($$select public.move_home('qu_dorm')$$, 'dorm_students_only'), 'not the other campus dorm');
select pg_temp.assert((public.move_home('sj_dorm') ->> 'cash')::int = -500, 'dorm move-in: a week plus the broker week');

-- A visitor pays the visitor price at the dining hall; anon can't call anything.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000072a2', false);
select 1 from public.create_player('Vis', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.at('st-johnsons');
select pg_temp.assert((public.campus_eat() ->> 'cash')::int = -12, 'visitor price');
select pg_temp.assert(pg_temp.raises($$select public.campus_attend('napping-301')$$, 'not_enrolled'), 'visitors cannot attend');

-- Leaderboard: St. Johnsons leads with one student.
select pg_temp.assert((public.campus_leaderboard() -> 'campuses' -> 0 ->> 'campus') = 'st-johnsons', 'leaderboard order');
select pg_temp.assert((public.campus_leaderboard() -> 'campuses' -> 0 ->> 'students')::int >= 1, 'students counted');
reset role;
set role anon;
select pg_temp.assert(pg_temp.raises($$select public.campus_state()$$, 'permission denied'), 'anon cannot read');
reset role;
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select * from public.campus_questions$$, 'permission denied'), 'answers stay on the server');
select pg_temp.assert(pg_temp.raises($$select public.campus_exam_set('napping-301')$$, 'permission denied'), 'the full set is private');
reset role;

rollback;
\echo CAMPUS CHECKS PASSED
