-- Scenario test for migration 0122 (Starter Week): missions marked by what the game already writes, paid once by
-- starter_state(), the finish reward, hiding, the end after rent day, and players from before it never seeing it.
-- Migration 0163: missions by the day (day 1 on the day it started), three new missions (work, choice, host), the dog's
-- C$150 tip, the C$1,000 finish, and the week running by New York day through rent day (day 8).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000003' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(11, 13) n;
set role authenticated;
do $$
declare n text; i int := 11;
begin
  foreach n in array array['Newbie', 'Veteran', 'Quitter'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
-- Veteran joined before Starter Week shipped.
reset role;
update public.players set created_at = now() - interval '30 days' where id = pg_temp.u(12);
set role authenticated;

-- ---- Before anything: the first mission is next, nothing paid ----
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(jsonb_array_length(public.starter_state() -> 'done') = 0, 'nothing done yet');
select pg_temp.assert((public.starter_state() ->> 'day')::int = 1, 'day 1');
select pg_temp.assert((public.starter_state() ->> 'daysLeft')::int = 7, 'seven more days, through rent day');
select pg_temp.as_(pg_temp.u(12)::text);
select pg_temp.assert(public.starter_state() is null, 'older players never see it');

-- ---- Marks from what the game writes ----
reset role;
update public.players set at_place = 'ditmars-deli' where id in (pg_temp.u(11), pg_temp.u(12));
insert into public.place_visits (player_id, place_id, ny_date) values (pg_temp.u(11), 'ditmars-deli', public.ny_today());
update public.players set at_place = 'hell-gate-park' where id = pg_temp.u(11);
insert into public.place_visits (player_id, place_id, ny_date) values (pg_temp.u(12), 'ditmars-deli', public.ny_today());
set role authenticated;
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(jsonb_array_length(public.starter_state() -> 'paid') = 2, 'breakfast and park paid now');
select pg_temp.assert(pg_temp.paid('starter', pg_temp.u(11)) = 175, 'C$25 + the dog''s C$150 tip (migration 0163)');
select pg_temp.assert(jsonb_array_length(public.starter_state() -> 'paid') = 0, 'paid once');
select pg_temp.assert(pg_temp.paid('starter', pg_temp.u(12)) = 0, 'veteran: nothing');
reset role;
select pg_temp.assert(not exists (select 1 from public.starter_marks where player_id = pg_temp.u(12)), 'veteran: no marks');

-- The rest: a gig taken and collected, a look, a placed bought rug, a message, gossip, rent, an event.
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
  values (pg_temp.u(11), public.ny_today(), 'side', 'Flyers', 40, 5, 10, 0);
update public.gig_offers set accepted_at = now(), ready_at = now() where player_id = pg_temp.u(11);
update public.gig_offers set collected_at = now() where player_id = pg_temp.u(11);
update public.players set look = coalesce(look, '{}'::jsonb) || '{"t": 1}' where id = pg_temp.u(11);
insert into public.player_items (player_id, sku, category, value) values (pg_temp.u(11), 'home-rug-pink', 'home', 120);
update public.players set home_layout = jsonb_build_array(jsonb_build_object('id', 'item:' ||
  (select id from public.player_items where player_id = pg_temp.u(11) and sku = 'home-rug-pink'), 'x', 1, 'z', 1))
  where id = pg_temp.u(11);
insert into public.conversations (a, b) values (least(pg_temp.u(11), pg_temp.u(13)), greatest(pg_temp.u(11), pg_temp.u(13)));
insert into public.messages (conversation_id, sender, body, ny_date)
  select id, pg_temp.u(11), 'hi', public.ny_today() from public.conversations where a = least(pg_temp.u(11), pg_temp.u(13));
insert into public.gossip_found (player_id, story_id, piece, via) values (pg_temp.u(11), 'test', 0, 'overheard');
insert into public.bills (player_id, kind, amount, due_date) values (pg_temp.u(11), 'rent', 100, public.ny_today());
update public.bills set status = 'paid', paid_at = now() where player_id = pg_temp.u(11) and kind = 'rent';
insert into public.event_attendance (player_id, event_id, ny_date) values (pg_temp.u(11), 'test-night', public.ny_today());
-- Migration 0163: a workday at a career job, a choice made, people over.
insert into public.careers (id, player_id, track, state) values (gen_random_uuid(), pg_temp.u(11), 'hospitality', '{}');
update public.careers set last_work_day = public.ny_today() where player_id = pg_temp.u(11);
insert into public.choice_log (player_id, card, base, area, day) values (pg_temp.u(11), 'test-card', 'test-card', 'street', public.ny_today());
select pg_temp.assert(not exists (select 1 from public.starter_marks where player_id = pg_temp.u(11) and mission = 'choice'), 'a card shown is not a choice made');
update public.choice_log set status = 'chosen', option = 'a', chosen_at = now() where player_id = pg_temp.u(11);
insert into public.visits (host, kind, home_id, starts_at, ends_at, capacity, ny_date)
  values (pg_temp.u(11), 'hang', 'astoria_studio', now(), now() + interval '1 hour', 4, public.ny_today());
select pg_temp.assert((select count(*) from public.starter_marks where player_id = pg_temp.u(11)) = 13, 'all thirteen marked');
set role authenticated;

-- ---- Finishing: every mission paid, then C$500, the badge and the rug ----
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert((public.starter_state() ->> 'finished')::boolean, 'finished');
select pg_temp.assert(pg_temp.paid('starter_finish', pg_temp.u(11)) = 1000, 'C$1,000');
select pg_temp.assert(pg_temp.paid('starter', pg_temp.u(11)) = 25 + 150 + 15 + 50 + 10 + 75 + 20 + 15 + 25 + 20 + 20 + 25 + 20, 'every mission once');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.u(11) and badge_id = 'starter-week'), 'badge');
select pg_temp.assert(exists (select 1 from public.player_items where player_id = pg_temp.u(11) and sku = 'home-rug-violet' and acquired = 'earned'), 'the rug');
select pg_temp.assert(not (public.starter_state() ->> 'finished')::boolean, 'finish shows once');
select pg_temp.assert(not (public.starter_state() ->> 'active')::boolean, 'over once finished');

-- ---- Hiding, and the week running out ----
select pg_temp.as_(pg_temp.u(13)::text);
select 1 from public.starter_state();
select public.starter_hide();
select pg_temp.assert(not (public.starter_state() ->> 'active')::boolean, 'hidden');
reset role;
select public.starter_mark(pg_temp.u(13), 'event');
select pg_temp.assert(not exists (select 1 from public.starter_marks where player_id = pg_temp.u(13)), 'no marks once hidden');
-- The rent fix (0163): a week after it started is rent day, day 8, and it's still on; the day after, it's over.
update public.starter_progress set hidden_at = null, started_at = (public.ny_today() - 7)::timestamp at time zone 'America/New_York' + interval '23 hours'
 where player_id = pg_temp.u(13);
select pg_temp.assert(public.starter_active(pg_temp.u(13)), 'still on on rent day, even for a late-night start');
select pg_temp.assert(public.starter_day(pg_temp.u(13)) = 8, 'rent day is day 8');
update public.starter_progress set started_at = now() - interval '8 days' where player_id = pg_temp.u(13);
select pg_temp.assert(not public.starter_active(pg_temp.u(13)), 'over after rent day');

-- ---- Players can't call the internals ----
set role authenticated;
select pg_temp.as_(pg_temp.u(13)::text);
do $$ begin perform 1 from public.starter_marks; raise exception 'FAIL: marks readable';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.starter_mark(pg_temp.u(13), 'gig'); raise exception 'FAIL: starter_mark callable';
exception when insufficient_privilege then null; end $$;

-- ---- Migration 0123: a player already paid 10 clout for the park isn't paid the C$500 tip as well ----
reset role;
update public.starter_progress set hidden_at = null, started_at = now() where player_id = pg_temp.u(13);
insert into public.ledger (player_id, currency, amount, kind, ref) values (pg_temp.u(13), 'clout', 10, 'starter', 'park');
insert into public.starter_marks (player_id, mission) values (pg_temp.u(13), 'park');
set role authenticated;
select pg_temp.as_(pg_temp.u(13)::text);
select pg_temp.assert(jsonb_array_length(public.starter_state() -> 'paid') = 0, 'the park paid once, in clout');
select pg_temp.assert(pg_temp.paid('starter', pg_temp.u(13)) = 10, 'no tip on top');

-- ---- Migration 0164: answering Lola's text counts as the message mission ----
reset role;
select pg_temp.assert(not exists (select 1 from public.starter_marks where player_id = pg_temp.u(13) and mission = 'message'), 'no message yet');
set role authenticated;
select pg_temp.as_(pg_temp.u(13)::text);
select pg_temp.assert(public.starter_lola_reply(1), 'Lola answered');
do $$ begin perform public.starter_lola_reply(7); raise exception 'FAIL: a reply that does not exist';
exception when sqlstate '22023' then null; end $$;
select pg_temp.as_(pg_temp.u(12)::text);
select pg_temp.assert(not public.starter_lola_reply(0), 'older players: nothing to mark');
reset role;
select pg_temp.assert(exists (select 1 from public.starter_marks where player_id = pg_temp.u(13) and mission = 'message'), 'message mission marked');
select pg_temp.assert(not exists (select 1 from public.starter_marks where player_id = pg_temp.u(12)), 'veteran: still no marks');
rollback;
