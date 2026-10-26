-- Scenario test for migration 0119 (sublets: listing, the crew-first window, applying, accepting, weekly rent, the
-- held lease, roommate hang, notice, ratings, unpaid rent, the host moving, blocking). Runs in a transaction and rolls
-- back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.fails(sql text, code text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm = code; end $$;
create function pg_temp.hangs() returns bigint language sql security definer as $$ select count(*) from public.ledger where kind = 'sublet_hang' $$;
create function pg_temp.bank(p text) returns int language sql security definer as $$ select bank_cash from public.players where id = p::uuid $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000191'), ('00000000-0000-0000-0000-000000000192'),
  ('00000000-0000-0000-0000-000000000193'), ('00000000-0000-0000-0000-000000000194');
set role authenticated;
do $$
declare n text; i int := 191;
begin
  foreach n in array array['Hana', 'Sam', 'Cara', 'Dex'] loop
    perform pg_temp.as_('00000000-0000-0000-0000-000000000' || i);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
-- Hana invited Cara (crew); Hana, Sam and Cara are old enough, Dex joined today.
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code)
values ('00000000-0000-0000-0000-000000000191', '00000000-0000-0000-0000-000000000193', 'TEST');
update public.players set created_at = now() - interval '30 days', bank_cash = 5000
 where id in ('00000000-0000-0000-0000-000000000191', '00000000-0000-0000-0000-000000000192', '00000000-0000-0000-0000-000000000193');
update public.players set bank_cash = 5000 where id = '00000000-0000-0000-0000-000000000194';
set role authenticated;

-- ---- Only a 1BR or bigger can host ----
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select pg_temp.assert(public.sublet_state() ->> 'hostBlock' = 'home_too_small', 'a studio can''t host');
reset role;
update public.players set home_id = 'lic_highrise' where id = '00000000-0000-0000-0000-000000000191';
set role authenticated;
select pg_temp.assert(public.sublet_state() ->> 'hostBlock' is null, 'the LIC high-rise can host');
select pg_temp.assert(public.sublet_state() -> 'bounds' = '[263, 525]'::jsonb, 'a quarter to half the rent');
select pg_temp.assert(pg_temp.fails($q$select public.sublet_list(600, 2, 6, null)$q$, 'rent_out_of_range'), 'at most half the rent');
select pg_temp.assert(pg_temp.fails($q$select public.sublet_list(200, 2, 6, null)$q$, 'rent_out_of_range'), 'at least a quarter');
select pg_temp.assert(pg_temp.fails($q$select public.sublet_list(480, 2, 9, null)$q$, 'bad_weeks'), 'at most 8 weeks');
select pg_temp.assert((public.sublet_list(480, 2, 6, 'Quiet after 2 AM. Mostly.') -> 'mine' ->> 'rent')::int = 480, 'listed');

-- ---- Crew first for 24 hours ----
select pg_temp.as_('00000000-0000-0000-0000-000000000193');
select pg_temp.assert(jsonb_array_length(public.sublet_state() -> 'listings') = 1, 'crew sees it at once');
select pg_temp.assert((public.sublet_state() -> 'listings' -> 0 ->> 'crewOnly')::boolean, 'marked crew first');
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select pg_temp.assert(jsonb_array_length(public.sublet_state() -> 'listings') = 0, 'not crew: not yet');
reset role;
update public.sublet_listings set crew_until = now() - interval '1 minute';
set role authenticated;
select pg_temp.assert(jsonb_array_length(public.sublet_state() -> 'listings') = 1, 'everyone after 24 hours');

-- ---- Applying ----
select pg_temp.assert(pg_temp.fails(format('select public.sublet_apply(%s, 8, null)', public.sublet_state() -> 'listings' -> 0 ->> 'id'), 'bad_weeks'),
  'within the listing''s lengths');
select pg_temp.assert((public.sublet_apply((public.sublet_state() -> 'listings' -> 0 ->> 'id')::bigint, 4, 'Neat, quiet, I bring bagels.') -> 'listings' -> 0 ->> 'applied')::boolean,
  'applied');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000192') = 5000, 'nothing charged on applying');
select pg_temp.as_('00000000-0000-0000-0000-000000000194');
select pg_temp.assert(pg_temp.fails(format('select public.sublet_apply(%s, 4, null)', public.sublet_state() -> 'listings' -> 0 ->> 'id'), 'too_new'),
  'accounts 7 days old');

-- ---- Accepting: first week to the host, the deposit held ----
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select pg_temp.assert(jsonb_array_length(public.sublet_state() -> 'mine' -> 'apps') = 1, 'the host sees the application');
select pg_temp.assert(public.sublet_answer((public.sublet_state() -> 'mine' -> 'apps' -> 0 ->> 'id')::bigint, true) -> 'live' ->> 'role' = 'host', 'accepted');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000192') = 5000 - 960, 'rent and deposit paid');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000191') = 5480, 'the host got the first week');
select pg_temp.assert(public.sublet_state() ->> 'mine' is null, 'the listing came down');
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000192') -> 'sublet' ->> 'role' = 'sub', 'card line');
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select pg_temp.assert(public.sublet_home() ->> 'homeId' = 'lic_highrise', 'Sam lives at Hana''s');
select 1 from public.sublet_show(false);
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000192') ->> 'sublet' is null, 'hidden card line');
select pg_temp.assert(pg_temp.fails($q$select public.sublet_list(300, 1, 2, null)$q$, 'home_too_small'), 'Sam can''t host from a studio');

-- ---- Sam's own lease is held ----
reset role;
insert into public.bills (player_id, kind, amount, due_date) values ('00000000-0000-0000-0000-000000000192', 'rent', 425, public.ny_today());
select pg_temp.assert(not exists (select 1 from public.bills where player_id = '00000000-0000-0000-0000-000000000192' and kind = 'rent'),
  'no rent at home while subletting');

-- ---- A week later: the second week is charged ----
update public.sublets set start_day = start_day - 7, end_day = end_day - 7;
set role authenticated;
select pg_temp.assert((public.sublet_state() -> 'live' ->> 'week')::int = 2, 'week 2');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000192') = 5000 - 1440, 'week 2 rent charged');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000191') = 5960, 'week 2 rent paid to the host');
select 1 from public.sublet_state();
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000192') = 5000 - 1440, 'charged once');

-- ---- Roommate hang: both tap it ----
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select 1 from public.sublet_hang();
select pg_temp.assert(pg_temp.hangs() = 0, 'one tap pays nothing');
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select 1 from public.sublet_hang();
select pg_temp.assert(pg_temp.hangs() = 2, 'both paid');
select 1 from public.sublet_hang();
select pg_temp.assert(pg_temp.hangs() = 2, 'once a day');

-- ---- Renewing ----
select 1 from public.sublet_renew(2);
select pg_temp.assert(pg_temp.fails($q$select public.sublet_renew_answer(true)$q$, 'no_renewal'), 'the asker can''t answer');
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select pg_temp.assert((public.sublet_renew_answer(true) -> 'live' ->> 'weeks')::int = 6, 'renewed to 6 weeks');

-- ---- Notice: 7 days, then it ends and the deposit comes back ----
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select pg_temp.assert((public.sublet_notice(true) -> 'live' ->> 'noticeEnd')::date = public.ny_today() + 7, 'notice runs 7 days');
select pg_temp.assert(public.sublet_notice(false) -> 'live' ->> 'noticeEnd' is null, 'notice taken back');
select 1 from public.sublet_notice(true);
reset role;
update public.sublets set notice_end = public.ny_today();
set role authenticated;
select pg_temp.assert(public.sublet_state() ->> 'live' is null, 'over');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000192') = 5000 - 960, 'deposit back');
reset role;
select pg_temp.assert((select end_reason from public.sublets order by id desc limit 1) = 'notice', 'reason notice');
set role authenticated;

-- ---- Ratings ----
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select pg_temp.assert(public.sublet_state() -> 'ended' ->> 'reason' = 'notice', 'Sam sees the ending');
select pg_temp.assert(public.sublet_rate((public.sublet_state() -> 'ended' ->> 'id')::bigint, 5) ->> 'ended' is null, 'rated and closed');
reset role;
select pg_temp.assert((public.sublet_person('00000000-0000-0000-0000-000000000191') -> 'rating' ->> 'avg')::numeric = 5, 'Hana''s rating');
set role authenticated;

-- ---- Unpaid rent ends it, deposit back ----
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select 1 from public.sublet_list(300, 1, 4, null);
reset role; update public.sublet_listings set crew_until = now() where status = 'open'; set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000193');
select 1 from public.sublet_apply((public.sublet_state() -> 'listings' -> 0 ->> 'id')::bigint, 2, null);
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select 1 from public.sublet_answer((public.sublet_state() -> 'mine' -> 'apps' -> 0 ->> 'id')::bigint, true);
reset role;
update public.players set bank_cash = 100 where id = '00000000-0000-0000-0000-000000000193';
update public.sublets set start_day = start_day - 7, end_day = end_day - 7 where ended_at is null;
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000193');
select pg_temp.assert(public.sublet_state() ->> 'live' is null, 'unpaid ends it');
select pg_temp.assert(pg_temp.bank('00000000-0000-0000-0000-000000000193') = 400, 'deposit back after unpaid rent');

-- ---- The host moving ends it ----
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select 1 from public.sublet_list(300, 1, 4, null);
reset role; update public.sublet_listings set crew_until = now() where status = 'open'; set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select 1 from public.sublet_apply((public.sublet_state() -> 'listings' -> 0 ->> 'id')::bigint, 1, null);
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select 1 from public.sublet_answer((public.sublet_state() -> 'mine' -> 'apps' -> 0 ->> 'id')::bigint, true);
reset role;
update public.players set home_id = 'sunnyside_gardens' where id = '00000000-0000-0000-0000-000000000191';
select pg_temp.assert((select end_reason from public.sublets order by id desc limit 1) = 'host_moved', 'host moved');
set role authenticated;

-- ---- Blocking closes applications ----
select pg_temp.as_('00000000-0000-0000-0000-000000000191');
select 1 from public.sublet_list(300, 1, 4, null);
reset role; update public.sublet_listings set crew_until = now() where status = 'open'; set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000192');
select 1 from public.sublet_apply((public.sublet_state() -> 'listings' -> 0 ->> 'id')::bigint, 1, null);
reset role;
insert into public.blocks (blocker, blocked) values ('00000000-0000-0000-0000-000000000191', '00000000-0000-0000-0000-000000000192');
select pg_temp.assert(not exists (select 1 from public.sublet_apps where status = 'pending'), 'block closes the application');

rollback;
\echo sublets ok
