-- Scenario test for migration 0016 (lines for the regulars).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000061'), ('00000000-0000-0000-0000-000000000062');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000061');
set role authenticated;

-- A player can't touch the table or the admin functions.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000062', false);
do $$ begin
  begin perform public.admin_npc_line_add('sal', 'Hello there, hon.'); raise exception 'FAIL: a player added a line';
  exception when others then if sqlerrm not like '%not_admin%' then raise; end if; end;
  begin perform count(*) from public.npc_lines; raise exception 'FAIL: a player read the table';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert(public.npc_lines_live() = '{}'::jsonb, 'nothing live yet');

-- The admin adds lines; only approved ones go live.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000061', false);
create temp table ids (name text, id bigint);
grant all on ids to public;
insert into ids select 'evergreen', public.admin_npc_line_add('sal', 'Also Sal got a promotion. He runs the lottery machine now.');
insert into ids select 'this_week', public.admin_npc_line_add('sal', 'I''m dating again. Don''t tell Also Sal.', 'update', date_trunc('week', public.ny_today())::date);
insert into ids select 'next_week', public.admin_npc_line_add('sal', 'Next week''s news.', 'update', (date_trunc('week', public.ny_today()) + interval '7 days')::date);
insert into ids select 'paused', public.admin_npc_line_add('gus', 'A line we changed our minds about.');
select pg_temp.assert(public.npc_lines_live() = '{}'::jsonb, 'lines wait for approval');
select public.admin_npc_line_status(id, 'approved') from ids;
select public.admin_npc_line_status(id, 'paused') from ids where name = 'paused';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000062', false);
select pg_temp.assert(jsonb_array_length(public.npc_lines_live() -> 'sal') = 2, 'sal: the evergreen line and this week''s update');
select pg_temp.assert(public.npc_lines_live() -> 'sal' ->> 0 = 'I''m dating again. Don''t tell Also Sal.', 'updates come first');
select pg_temp.assert(public.npc_lines_live() -> 'gus' is null, 'paused lines are hidden');

-- Bad input is refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000061', false);
do $$ begin
  begin perform public.admin_npc_line_add('sal', 'x'); raise exception 'FAIL: a two-letter line';
  exception when check_violation then null; end;
  begin perform public.admin_npc_line_add('sal', 'Starts on a Tuesday', 'update', date_trunc('week', public.ny_today())::date + 1); raise exception 'FAIL: a week not starting Monday';
  exception when check_violation then null; end;
  begin perform public.admin_npc_line_status(-1, 'approved'); raise exception 'FAIL: unknown line';
  exception when others then if sqlerrm not like '%unknown_line%' then raise; end if; end;
end $$;
select pg_temp.assert(jsonb_array_length(public.admin_npc_lines()) = 4, 'the Studio sees every line');

rollback;
\echo CAST CHECKS PASSED
