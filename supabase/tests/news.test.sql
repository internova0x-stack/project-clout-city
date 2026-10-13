-- Scenario test for migration 0017 (City News).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000051'), ('00000000-0000-0000-0000-000000000052');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000051');
set role authenticated;

-- Players can't upload or read the table.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', false);
do $$ begin
  begin perform public.admin_news_upsert('[]'); raise exception 'FAIL: a player uploaded news';
  exception when others then if sqlerrm not like '%not_admin%' then raise; end if; end;
  begin perform count(*) from public.news_items; raise exception 'FAIL: a player read the table';
  exception when insufficient_privilege then null; end;
end $$;

-- The admin uploads three items: yesterday, today and tomorrow.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
select pg_temp.assert(public.admin_news_upsert(jsonb_build_array(
  jsonb_build_object('id', 'old-one', 'kind', 'city', 'headline', 'Yesterday''s headline', 'body', 'Something happened yesterday in Queens.', 'cast', '["chase-clout"]'::jsonb, 'day', public.ny_today() - 1),
  jsonb_build_object('id', 'today-one', 'kind', 'column', 'headline', 'Ask Lola: today', 'body', 'Lola has advice for you today, hon.', 'day', public.ny_today()),
  jsonb_build_object('id', 'future-one', 'kind', 'city', 'headline', 'Tomorrow''s headline', 'body', 'Something will happen tomorrow, probably.', 'day', public.ny_today() + 1)
)) = 3, 'three items saved');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', false);
select pg_temp.assert(public.news_feed() = '[]'::jsonb, 'nothing published before approval');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
select public.admin_news_status(id, 'approved') from (values ('old-one'), ('today-one'), ('future-one')) v(id);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', false);
select pg_temp.assert(jsonb_array_length(public.news_feed()) = 2, 'tomorrow''s item waits for its day');
select pg_temp.assert(public.news_feed() -> 0 ->> 'id' = 'today-one', 'newest first');
select pg_temp.assert(public.news_feed() -> 1 -> 'cast' ->> 0 = 'chase-clout', 'cast ids come through');

-- Re-uploading unchanged keeps approval; a change sends it back to review.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
select public.admin_news_upsert(jsonb_build_array(
  jsonb_build_object('id', 'old-one', 'kind', 'city', 'headline', 'Yesterday''s headline', 'body', 'Something happened yesterday in Queens.', 'cast', '["chase-clout"]'::jsonb, 'day', public.ny_today() - 1),
  jsonb_build_object('id', 'today-one', 'kind', 'column', 'headline', 'Ask Lola: today, edited', 'body', 'Lola has advice for you today, hon.', 'day', public.ny_today())
));
select pg_temp.assert((select jsonb_agg(x ->> 'status' order by x ->> 'id') from jsonb_array_elements(public.admin_news_list()) x
                        where x ->> 'id' in ('old-one', 'today-one')) = '["approved", "review"]'::jsonb, 'unchanged stays approved, edited goes to review');

-- Pause hides an item at once; reschedule moves it.
select public.admin_news_status('old-one', 'paused');
select public.admin_news_reschedule('future-one', public.ny_today());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', false);
select pg_temp.assert((select array_agg(x ->> 'id') from jsonb_array_elements(public.news_feed()) x) = array['future-one'], 'only the moved item shows');

-- Bad input is refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', false);
do $$ begin
  begin perform public.admin_news_upsert(jsonb_build_array(jsonb_build_object('id', 'Bad Id', 'kind', 'city', 'headline', 'A fine headline', 'body', 'A body long enough to pass.', 'day', public.ny_today()))); raise exception 'FAIL: bad id';
  exception when check_violation then null; end;
  begin perform public.admin_news_status('nope', 'approved'); raise exception 'FAIL: unknown item';
  exception when others then if sqlerrm not like '%unknown_news%' then raise; end if; end;
end $$;

rollback;
\echo NEWS CHECKS PASSED
