-- Scenario test for migration 0118 (relationships: going official, the couple streak, gifts, anniversaries,
-- breakups, blocking). Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.fails(sql text, code text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm = code; end $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000181'), ('00000000-0000-0000-0000-000000000182'),
  ('00000000-0000-0000-0000-000000000183'), ('00000000-0000-0000-0000-000000000184');
set role authenticated;
do $$
declare n text; i int := 181;
begin
  foreach n in array array['Anna', 'Boris', 'Cyrus', 'Diana'] loop
    perform pg_temp.as_('00000000-0000-0000-0000-000000000' || i);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
-- Ana invited everyone (one crew); Ana, Bo and Cy are old enough, Di joined today.
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code)
select '00000000-0000-0000-0000-000000000181', id, 'TEST' from public.players
 where id in ('00000000-0000-0000-0000-000000000182', '00000000-0000-0000-0000-000000000183', '00000000-0000-0000-0000-000000000184');
update public.players set created_at = now() - interval '30 days'
 where id in ('00000000-0000-0000-0000-000000000181', '00000000-0000-0000-0000-000000000182', '00000000-0000-0000-0000-000000000183');
set role authenticated;

-- Ana and Bo match; Ana also crushes on Cy.
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000182', true);
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000183', true);
select pg_temp.as_('00000000-0000-0000-0000-000000000182');
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000181', true);

-- ---- Not yet: three dates first ----
select pg_temp.assert(pg_temp.fails($q$select public.couple_ask('00000000-0000-0000-0000-000000000181')$q$, 'more_dates'), 'needs 3 dates');
select pg_temp.assert((public.couple_state() -> 'matches' -> 0 ->> 'dates')::int = 0, 'progress shows 0 dates');
reset role;
insert into public.date_nights (host, guest, kind, target, ny_date, status, host_went_at, guest_went_at, paid_at)
select '00000000-0000-0000-0000-000000000181', '00000000-0000-0000-0000-000000000182', 'place', 'ditmars-deli',
       public.ny_today() - d, 'accepted', now(), now(), now()
  from generate_series(3, 5) d;
set role authenticated;
select pg_temp.assert((public.couple_state() -> 'matches' -> 0 ->> 'dates')::int = 3, 'progress shows 3 dates');
-- Not with someone unmatched, and not with an account under 7 days.
select pg_temp.assert(pg_temp.fails($q$select public.couple_ask('00000000-0000-0000-0000-000000000183')$q$, 'not_matched'), 'only a match');

-- ---- Bo asks, Ana says yes ----
select pg_temp.assert(jsonb_array_length(public.couple_ask('00000000-0000-0000-0000-000000000181') -> 'asks') = 1, 'ask sent');
select pg_temp.assert(pg_temp.fails($q$select public.couple_ask('00000000-0000-0000-0000-000000000181')$q$, 'ask_exists'), 'one ask at a time');
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select pg_temp.assert((public.couple_state() -> 'asks' -> 0 ->> 'mine')::boolean = false, 'Ana sees the ask');
select pg_temp.assert(public.couple_answer((public.couple_state() -> 'asks' -> 0 ->> 'id')::bigint, true) -> 'partner' ->> 'name' = 'Boris',
  'official');
-- Ana's other crush is gone, and no new ones while dating.
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000183') ->> 'crushed')::boolean, 'other crush ended');
select pg_temp.assert(pg_temp.fails($q$select public.crush_toggle('00000000-0000-0000-0000-000000000183', true)$q$, 'in_relationship'),
  'no crushes while dating');
-- Shown on the card by default; hidden on request (only on her own card).
select pg_temp.as_('00000000-0000-0000-0000-000000000183');
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000181') -> 'partner' ->> 'name' = 'Boris', 'card shows partner');
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select pg_temp.assert(not (public.couple_show(false) ->> 'shown')::boolean, 'hidden');
select pg_temp.as_('00000000-0000-0000-0000-000000000183');
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000181') ->> 'partner' is null, 'card hides partner');
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000182') -> 'partner' ->> 'name' = 'Anna', 'Bo still shows it');

-- ---- The streak: 5 messages each way today, plus two earlier days (one missed day forgiven) ----
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select pg_temp.assert(not (public.couple_state() ->> 'todayDone')::boolean, 'nothing together yet today');
do $$ begin
  for i in 1..5 loop
    perform pg_temp.as_('00000000-0000-0000-0000-000000000181'); perform public.chat_send('00000000-0000-0000-0000-000000000182', 'hi ' || i);
    perform pg_temp.as_('00000000-0000-0000-0000-000000000182'); perform public.chat_send('00000000-0000-0000-0000-000000000181', 'hey ' || i);
  end loop;
end $$;
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select pg_temp.assert((public.couple_state() ->> 'todayDone')::boolean, '5 messages each way count');
reset role;
-- The relationship began 4 days ago; days -1 and -3 were together (and -3, -4 had date nights), -2 was missed (forgiven).
update public.relationships set start_day = public.ny_today() - 4 where a = '00000000-0000-0000-0000-000000000181';
insert into public.couple_days (rel_id, ny_date)
select id, public.ny_today() - d from public.relationships, unnest(array[1, 3]) d where a = '00000000-0000-0000-0000-000000000181';
set role authenticated;
select pg_temp.assert((public.couple_state() ->> 'streak')::int = 4, 'streak 4 with one forgiven miss');
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-000000000181' and kind = 'couple_streak') = 1,
  'day-3 reward paid');
select 1 from public.couple_state();
select pg_temp.assert((select count(*) from public.ledger where player_id = '00000000-0000-0000-0000-000000000181' and kind = 'couple_streak') = 1,
  'paid once');

-- ---- Gifts ----
select pg_temp.assert(pg_temp.fails($q$select public.couple_gift()$q$, 'no_gift_box'), 'needs a gift box');
reset role;
update public.players set gifts = 2, mood = 50 where id in ('00000000-0000-0000-0000-000000000181', '00000000-0000-0000-0000-000000000182');
set role authenticated;
select pg_temp.assert((public.couple_gift() -> 'gifts' ->> 'sentToday')::boolean, 'gift sent');
select pg_temp.assert(pg_temp.fails($q$select public.couple_gift()$q$, 'gift_today'), 'one a day');
reset role;
select pg_temp.assert((select mood from public.players where id = '00000000-0000-0000-0000-000000000182') = 60, 'partner mood up');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000182');
select pg_temp.assert(jsonb_array_length(public.couple_state() -> 'gifts' -> 'received') = 1, 'Bo sees the gift');
select public.couple_seen();
select pg_temp.assert(jsonb_array_length(public.couple_state() -> 'gifts' -> 'received') = 0, 'seen');

-- ---- Partners' date nights pay the couples bonus ----
reset role;
insert into public.date_nights (host, guest, kind, target, ny_date, status, host_went_at, guest_went_at)
values ('00000000-0000-0000-0000-000000000181', '00000000-0000-0000-0000-000000000182', 'place', 'ditmars-deli', public.ny_today(),
        'accepted', now(), now());
select public.date_settle((select max(id) from public.date_nights));
select pg_temp.assert((select amount from public.ledger where player_id = '00000000-0000-0000-0000-000000000182' and kind = 'date_night'
                        and ref = public.ny_today()::text) = 35, 'couple date pays 35');
set role authenticated;

-- ---- Breakup: gentle card for the other, then 14 days' cool-off for the pair ----
select pg_temp.as_('00000000-0000-0000-0000-000000000182');
select pg_temp.assert(public.couple_end() ->> 'partner' is null, 'Bo ended it');
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select pg_temp.assert(public.couple_state() -> 'ended' ->> 'name' = 'Boris', 'Ana sees the card');
select public.couple_seen();
select pg_temp.assert(public.couple_state() ->> 'ended' is null, 'card seen once');
select pg_temp.assert(pg_temp.fails($q$select public.couple_ask('00000000-0000-0000-0000-000000000182')$q$, 'cooling_off'), 'cool-off');

-- ---- After the cool-off, back together; blocking ends it at once ----
reset role;
update public.relationships set ended_at = now() - interval '15 days' where a = '00000000-0000-0000-0000-000000000181';
set role authenticated;
select 1 from public.couple_ask('00000000-0000-0000-0000-000000000182');
select pg_temp.as_('00000000-0000-0000-0000-000000000182');
select 1 from public.couple_answer((public.couple_state() -> 'asks' -> 0 ->> 'id')::bigint, true);
select pg_temp.assert(public.couple_state() -> 'partner' ->> 'name' = 'Anna', 'together again');
select 1 from public.chat_block('00000000-0000-0000-0000-000000000181', true);
select pg_temp.assert(public.couple_state() ->> 'partner' is null, 'block ends it');
reset role;
select pg_temp.assert((select end_reason from public.relationships order by id desc limit 1) = 'blocked', 'reason blocked');

-- ---- Too new to go official ----
update public.date_nights set guest = '00000000-0000-0000-0000-000000000184' where guest = '00000000-0000-0000-0000-000000000182';
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000184');
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000181', true);
select pg_temp.as_('00000000-0000-0000-0000-000000000181');
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000184', true);
select pg_temp.assert(pg_temp.fails($q$select public.couple_ask('00000000-0000-0000-0000-000000000184')$q$, 'too_new'), 'Di is too new');

rollback;
\echo relationships ok
