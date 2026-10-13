-- Scenario test for migration 0011 (crushes, the "It's mutual" reveal, date nights, blocking).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000071'), ('00000000-0000-0000-0000-000000000072'),
  ('00000000-0000-0000-0000-000000000073'), ('00000000-0000-0000-0000-000000000074'),
  ('00000000-0000-0000-0000-000000000075'), ('00000000-0000-0000-0000-000000000076');
set role authenticated;
do $$
declare n text; i int := 71;
begin
  foreach n in array array['Dex', 'Eli', 'Fen', 'Gus', 'Hal', 'Ivo'] loop
    perform pg_temp.as_('00000000-0000-0000-0000-0000000000' || i);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
-- Dex invited Eli, Fen, Hal and Ivo (one clique). Gus is a stranger to everyone.
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code)
select '00000000-0000-0000-0000-000000000071', id, 'TEST' from public.players
 where id in ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000073',
              '00000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000076');
update public.players set bank_cash = 500 where id::text like '00000000-0000-0000-0000-00000000007%';
set role authenticated;

-- ---- Who can be a crush ----
select pg_temp.as_('00000000-0000-0000-0000-000000000072');
select pg_temp.assert((public.crush_status('00000000-0000-0000-0000-000000000071') ->> 'eligible')::boolean, 'clique member is eligible');
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000074') ->> 'eligible')::boolean, 'stranger is not eligible');
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000073') ->> 'eligible')::boolean, 'invited by the same person is not enough');
do $$ begin
  begin perform public.crush_toggle('00000000-0000-0000-0000-000000000074', true); raise exception 'FAIL: crush on a stranger';
  exception when sqlstate '22023' then null; end;
  begin perform public.date_invite('00000000-0000-0000-0000-000000000074', 'place', 'lucky-seven-deli'); raise exception 'FAIL: date a stranger';
  exception when sqlstate '22023' then null; end;
end $$;
-- A one-way chat isn't a connection; a two-way one is.
select 1 from public.chat_send('00000000-0000-0000-0000-000000000074', 'hi');
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000074') ->> 'eligible')::boolean, 'one-way chat is not enough');
select pg_temp.as_('00000000-0000-0000-0000-000000000074');
select 1 from public.chat_send('00000000-0000-0000-0000-000000000072', 'hey back');
select pg_temp.as_('00000000-0000-0000-0000-000000000072');
select pg_temp.assert((public.crush_status('00000000-0000-0000-0000-000000000074') ->> 'eligible')::boolean, 'two-way chat is a connection');

-- ---- One-sided stays secret ----
select pg_temp.assert((public.crush_toggle('00000000-0000-0000-0000-000000000071', true) ->> 'crushed')::boolean, 'crush saved');
select pg_temp.assert((public.crush_status('00000000-0000-0000-0000-000000000071') ->> 'count')::int = 1, '1 of 3');
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000072') ->> 'crushed')::boolean, 'Dex sees no crush from Eli');
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000072') ->> 'matched')::boolean, 'not matched');
select pg_temp.assert(jsonb_array_length(public.dating_inbox() -> 'matches') = 0, 'no reveal for Dex');
select pg_temp.assert(public.player_card('00000000-0000-0000-0000-000000000072') -> 'crush' ->> 'crushed' = 'false', 'card shows my side only');
do $$ begin
  begin perform 1 from public.crushes; if found then raise exception 'FAIL: read crushes directly'; end if;
  exception when insufficient_privilege then null; end;
end $$;

-- ---- Mutual: both get the card ----
select pg_temp.assert((public.crush_toggle('00000000-0000-0000-0000-000000000072', true) ->> 'matched')::boolean, 'it is mutual');
select pg_temp.assert(public.dating_inbox() -> 'matches' -> 0 ->> 'name' = 'Eli', 'Dex gets the card');
select pg_temp.assert(not (public.dating_inbox() -> 'matches' -> 0 ->> 'seen')::boolean, 'unseen');
select public.match_seen('00000000-0000-0000-0000-000000000072');
select pg_temp.assert((public.dating_inbox() -> 'matches' -> 0 ->> 'seen')::boolean, 'seen');
select pg_temp.as_('00000000-0000-0000-0000-000000000072');
select pg_temp.assert(public.dating_inbox() -> 'matches' -> 0 ->> 'name' = 'Dex', 'Eli gets the card');
select pg_temp.assert(not (public.dating_inbox() -> 'matches' -> 0 ->> 'seen')::boolean, 'still unseen for Eli');

-- ---- At most 3 crushes ----
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000073', true);
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000075', true);
do $$ begin
  begin perform public.crush_toggle('00000000-0000-0000-0000-000000000076', true); raise exception 'FAIL: 4th crush';
  exception when sqlstate '22023' then null; end;
end $$;
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000075', false);
select pg_temp.assert((public.crush_toggle('00000000-0000-0000-0000-000000000076', true) ->> 'count')::int = 3, 'room again after taking one back');

-- ---- Date night: the bonus only once both have gone ----
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
do $$ begin
  begin perform public.date_invite('00000000-0000-0000-0000-000000000072', 'place', 'velvet-static'); raise exception 'FAIL: date at a place with no meal';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.assert(public.date_invite('00000000-0000-0000-0000-000000000072', 'place', 'lucky-seven-deli') > 0, 'invite sent');
do $$ begin
  begin perform public.date_invite('00000000-0000-0000-0000-000000000072', 'event', 'neon-nights'); raise exception 'FAIL: two dates with one person tonight';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.assert(jsonb_array_length(public.date_candidates()) >= 4 and (public.date_candidates() -> 0 ->> 'matched')::boolean, 'matches first');
select pg_temp.assert(public.dating_inbox() -> 'dates' -> 0 ->> 'status' = 'pending', 'host sees pending');
select pg_temp.assert((public.dating_inbox() -> 'dates' -> 0 ->> 'price')::int = 7, 'price');

select pg_temp.as_('00000000-0000-0000-0000-000000000072');
select pg_temp.assert(not (public.dating_inbox() -> 'dates' -> 0 ->> 'mine')::boolean, 'guest sees the invite');
-- Eli goes first (before answering), then says yes.
select 1 from public.do_action('lucky-seven-deli', 'eat');
select public.date_respond((public.dating_inbox() -> 'dates' -> 0 ->> 'id')::bigint, true);
select pg_temp.assert((public.dating_inbox() -> 'dates' -> 0 ->> 'iWent')::boolean, 'going before answering counts');
select pg_temp.assert(not (public.dating_inbox() -> 'dates' -> 0 ->> 'paid')::boolean, 'no bonus while one has gone');
reset role;
create temp table before_date as select id, clout, mood from public.players where id in ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000072');
grant select on before_date to public;
update public.players set mood = 50 where id in ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000072');
update before_date set mood = 50;
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select 1 from public.do_action('lucky-seven-deli', 'eat');
select pg_temp.assert((public.dating_inbox() -> 'dates' -> 0 ->> 'paid')::boolean, 'bonus once both went');
reset role;
-- The visit pays its own clout; the date adds exactly +25 clout and +10 Mood on top, once each.
select pg_temp.assert((select count(*) = 2 from public.ledger where kind = 'date_night' and amount = 25
                         and player_id in ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000072')), 'two date ledger rows');
select pg_temp.assert((select p.mood = 60 from public.players p where p.id = '00000000-0000-0000-0000-000000000071'), 'Dex +10 Mood');
select pg_temp.assert((select p.mood = 60 from public.players p where p.id = '00000000-0000-0000-0000-000000000072'), 'Eli +10 Mood');
set role authenticated;

-- A second date the same night pays nothing more (once per day per player).
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select 1 from public.date_invite('00000000-0000-0000-0000-000000000073', 'place', 'grind-and-gossip');
select pg_temp.as_('00000000-0000-0000-0000-000000000073');
select public.date_respond((select (d ->> 'id')::bigint from jsonb_array_elements(public.dating_inbox() -> 'dates') d limit 1), true);
select 1 from public.do_action('grind-and-gossip', 'eat');
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select 1 from public.do_action('grind-and-gossip', 'eat');
reset role;
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'date_night' and player_id = '00000000-0000-0000-0000-000000000071'), 'Dex paid once today');
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'date_night' and player_id = '00000000-0000-0000-0000-000000000073'), 'Fen gets theirs');
set role authenticated;

-- "Not tonight" is quiet: the guest's list drops it.
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select 1 from public.date_invite('00000000-0000-0000-0000-000000000075', 'event', 'neon-nights');
select pg_temp.as_('00000000-0000-0000-0000-000000000075');
select public.date_respond((public.dating_inbox() -> 'dates' -> 0 ->> 'id')::bigint, false);
select pg_temp.assert(jsonb_array_length(public.dating_inbox() -> 'dates') = 0, 'declined leaves the guest list');
do $$ begin
  begin perform public.date_respond(1, true); raise exception 'FAIL: answer someone else''s date';
  exception when sqlstate '22023' then null; end;
end $$;

-- ---- Blocking cancels everything ----
select pg_temp.as_('00000000-0000-0000-0000-000000000076');
select 1 from public.crush_toggle('00000000-0000-0000-0000-000000000071', true);
-- Dex has used today's 3 date invites, so Ivo asks.
select 1 from public.date_invite('00000000-0000-0000-0000-000000000071', 'place', 'altitude-718');
select pg_temp.assert(jsonb_array_length(public.dating_inbox() -> 'matches') = 1, 'Ivo matched Dex');
select public.chat_block('00000000-0000-0000-0000-000000000071', true);
select pg_temp.assert(jsonb_array_length(public.dating_inbox() -> 'matches') = 0, 'block ends the match');
select pg_temp.assert(jsonb_array_length(public.dating_inbox() -> 'dates') = 0, 'block cancels the date');
select pg_temp.assert((public.dating_inbox() ->> 'crushes')::int = 0, 'block drops the crush');
select pg_temp.as_('00000000-0000-0000-0000-000000000071');
select pg_temp.assert(not (public.crush_status('00000000-0000-0000-0000-000000000076') ->> 'eligible')::boolean, 'blocked: no crush button');
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.date_candidates()) c where c ->> 'name' = 'Ivo'), 'blocked: not a date candidate');
do $$ begin
  begin perform public.crush_toggle('00000000-0000-0000-0000-000000000076', true); raise exception 'FAIL: crush on a blocker';
  exception when insufficient_privilege then null; end;
  begin perform public.date_invite('00000000-0000-0000-0000-000000000076', 'place', 'altitude-718'); raise exception 'FAIL: date a blocker';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- Crush invites count as analytics ----
select public.track('crush_invite_shared');

rollback;
\echo DATING CHECKS PASSED
