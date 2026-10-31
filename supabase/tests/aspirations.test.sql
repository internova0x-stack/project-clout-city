-- Scenario test for migration 0143 (aspirations): picking and the 30-day rule, the degree from passed exams (not caught,
-- since the last Start over), Start over clearing the pick, a Stay-at-home Spouse's hosting paying a quarter more clout,
-- and the Studio's career numbers (admins only). Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000143' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Homebody', 'Guest'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;

-- ---- Picking ----
select pg_temp.as_(pg_temp.u(1)::text);
select pg_temp.assert(public.aspiration_state() ->> 'aspiration' is null, 'no pick yet');
select pg_temp.assert(public.aspiration_set('corporate') ->> 'aspiration' = 'corporate', 'picked Corporate');
select pg_temp.assert(public.aspiration_set('corporate') ->> 'aspiration' = 'corporate', 'the same pick again is fine');
select pg_temp.assert(pg_temp.raises($$select public.aspiration_set('home')$$, 'too_soon'), '30 days between picks');
select pg_temp.assert(pg_temp.raises($$select public.aspiration_set('astronaut')$$, 'unknown'), 'only the seven');
reset role;
update public.aspirations set chosen_at = now() - interval '31 days' where player_id = pg_temp.u(1);
set role authenticated;
select pg_temp.assert(public.aspiration_set('home') ->> 'aspiration' = 'home', 'a new pick after 30 days');
reset role;
select pg_temp.assert((select count(*) from public.player_facts where player_id = pg_temp.u(1) and key = 'life.aspiration') = 2, 'remembered (two subjects)');
do $$ begin
  set local role authenticated;
  begin perform public.aspiration_of(pg_temp.u(1)); raise exception 'FAIL: aspiration_of callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- The degree: 3 exams at C or better, never a caught one ----
insert into public.campus_exams (player_id, week, course_id, correct, percent, grade, caught) values
  (pg_temp.u(1), '2026-10-05', 'a', 9, 90, 'A', false), (pg_temp.u(1), '2026-10-12', 'b', 7, 70, 'C', false),
  (pg_temp.u(1), '2026-10-19', 'c', 9, 90, 'A', true), (pg_temp.u(1), '2026-10-19', 'd', 3, 30, 'F', false);
select pg_temp.assert((public.aspiration_of(pg_temp.u(1)) ->> 'exams')::int = 2, 'two count (not caught, not F)');
select pg_temp.assert(not (public.aspiration_of(pg_temp.u(1)) ->> 'degree')::boolean, 'no degree yet');
insert into public.campus_exams (player_id, week, course_id, correct, percent, grade) values (pg_temp.u(1), '2026-10-26', 'e', 8, 80, 'B');
select pg_temp.assert((public.aspiration_of(pg_temp.u(1)) ->> 'degree')::boolean, 'three passed: a degree');

-- ---- A Stay-at-home Spouse's hangout: the host's 8 clout becomes 10 ----
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.u(1), pg_temp.u(2), 'T143');
update public.players set bank_cash = 5000, mood = 50 where id in (pg_temp.u(1), pg_temp.u(2));
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select 1 from public.visit_host('hang', array[pg_temp.u(2)]);
select pg_temp.as_(pg_temp.u(2)::text);
select 1 from public.visit_arrive((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint);
reset role;
update public.visit_guests set arrived_at = now() - interval '3 minutes' where player_id = pg_temp.u(2);
set role authenticated;
select 1 from public.visit_room((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint, 0);
select pg_temp.assert(pg_temp.paid('visit_guest', pg_temp.u(2)) = 10, 'the guest is paid as usual');
select pg_temp.assert(pg_temp.paid('visit_host', pg_temp.u(1)) = 10, 'the host gets a quarter more (8 → 10)');

-- ---- The Studio's numbers: admins only ----
select pg_temp.assert(pg_temp.raises($$select public.admin_career_stats(30)$$, ''), 'players can''t read the Studio numbers');

-- ---- Start over: the pick goes, and older exams stop counting ----
reset role;
insert into public.player_restarts (player_id, clout_before, cash_before) values (pg_temp.u(1), 0, 0);
select pg_temp.assert(not exists (select 1 from public.aspirations where player_id = pg_temp.u(1)), 'Start over clears the pick');
select pg_temp.assert((public.aspiration_of(pg_temp.u(1)) ->> 'exams')::int = 0, 'exams before Start over don''t count');

rollback;
