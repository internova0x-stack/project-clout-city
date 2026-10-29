-- Scenario test for migration 0082 (push step 2: P0 triggers and the P1 scan). Only players with a device get pushes.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.q(k text) returns bigint language sql as $$
  select count(*) from public.push_queue where player_id = '00000000-0000-0000-0000-0000000082a1' and kind = k $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000082a1'), ('00000000-0000-0000-0000-0000000082a2'), ('00000000-0000-0000-0000-0000000082a3');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000082a1', false);
select 1 from public.create_player('Ping', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/82', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000082a2', false);
select 1 from public.create_player('Tasha', 'bodega_drip', '{}', null, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000082a3', false);
select 1 from public.create_player('Quiet', 'bodega_drip', '{}', null, true);
reset role;
delete from public.push_queue where player_id in ('00000000-0000-0000-0000-0000000082a1', '00000000-0000-0000-0000-0000000082a2', '00000000-0000-0000-0000-0000000082a3');

-- P0: a message from Tasha (text only; a reaction pushes nothing).
insert into public.conversations (a, b) values ('00000000-0000-0000-0000-0000000082a1', '00000000-0000-0000-0000-0000000082a2');
insert into public.messages (conversation_id, sender, body, ny_date)
  select id, '00000000-0000-0000-0000-0000000082a2', 'u up? the deli has the good bagels', public.ny_today() from public.conversations
   where a = '00000000-0000-0000-0000-0000000082a1' and b = '00000000-0000-0000-0000-0000000082a2';
insert into public.messages (conversation_id, sender, body, ny_date, kind)
  select id, '00000000-0000-0000-0000-0000000082a2', '🔥', public.ny_today(), 'reaction' from public.conversations
   where a = '00000000-0000-0000-0000-0000000082a1' and b = '00000000-0000-0000-0000-0000000082a2';
select pg_temp.assert(pg_temp.q('message') = 1, 'one message push, no reaction push');
select pg_temp.assert((select title = '💬 Tasha' and body like 'u up?%' and group_key = 'chat:00000000-0000-0000-0000-0000000082a2'
                         from public.push_queue where player_id = '00000000-0000-0000-0000-0000000082a1' and kind = 'message'), 'from Tasha, grouped by sender');

-- A match pushes both; only the one with a device gets it. A date invite, a crew invite, a ride, a together invite.
insert into public.crush_matches (a, b) values ('00000000-0000-0000-0000-0000000082a1', '00000000-0000-0000-0000-0000000082a2');
select pg_temp.assert(pg_temp.q('crush_match') = 1, 'match pushed');
select pg_temp.assert((select count(*) from public.push_queue where player_id = '00000000-0000-0000-0000-0000000082a2') = 0, 'no device, no push');
insert into public.date_nights (host, guest, kind, target, ny_date) values ('00000000-0000-0000-0000-0000000082a2', '00000000-0000-0000-0000-0000000082a1', 'place', 'neon-spoon', public.ny_today());
select pg_temp.assert(pg_temp.q('date_invite') = 1, 'date invite');
select pg_temp.assert((select close and deadline_at is not null from public.push_queue where player_id = '00000000-0000-0000-0000-0000000082a1' and kind = 'date_invite'), 'date invite is close, ends tonight');
with o as (insert into public.crew_outings (host, kind, place_id, activity, ny_date) values ('00000000-0000-0000-0000-0000000082a2', 'place', 'neon-spoon', 'eat', public.ny_today()) returning id)
insert into public.crew_outing_members (outing_id, player_id, status) select id, '00000000-0000-0000-0000-0000000082a1', 'invited' from o;
select pg_temp.assert(pg_temp.q('crew_invite') = 1, 'crew invite');
insert into public.ride_offers (from_id, to_id, from_place, place_id, mode, fare, seconds) values ('00000000-0000-0000-0000-0000000082a2', '00000000-0000-0000-0000-0000000082a1', 'neon-spoon', 'neon-spoon', 'taxi', 10, 60);
select pg_temp.assert(pg_temp.q('ride_request') = 1, 'ride');
insert into public.together_invites (from_id, to_id, place_id, action_id, ny_date) values ('00000000-0000-0000-0000-0000000082a2', '00000000-0000-0000-0000-0000000082a1', 'neon-spoon', 'eat', public.ny_today());
select pg_temp.assert(pg_temp.q('together_invite') = 1, 'together invite');
insert into public.invites (inviter_id, invitee_id, invite_code) values ('00000000-0000-0000-0000-0000000082a1', '00000000-0000-0000-0000-0000000082a3', 'X');
select pg_temp.assert((select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000082a1' and kind = 'friend_joined') = '🎉 Quiet just landed', 'friend joined');

-- P1: the scan. A bill due today, a late one, a gig ready, a full till, a party ticket within the hour.
delete from public.bills where player_id = '00000000-0000-0000-0000-0000000082a1';
insert into public.bills (player_id, kind, amount, due_date) values ('00000000-0000-0000-0000-0000000082a1', 'rent', 1800, public.ny_today()),
  ('00000000-0000-0000-0000-0000000082a1', 'phone', 60, public.ny_today() - 2);
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, accepted_at, ready_at)
  values ('00000000-0000-0000-0000-0000000082a1', public.ny_today(), 'side', 'Dog walking', 480, 5, 60, 0, now() - interval '2 hours', now() - interval '1 hour');
insert into public.player_businesses (player_id, business_id, bought_at, collected_at)
  values ('00000000-0000-0000-0000-0000000082a1', 'test-biz', now() - interval '5 days', now() - interval '3 days');
insert into public.store_products (sku, product_type, name, price_cents) values ('event-push-test', 'exclusive_event', 'Push Party', 399);
insert into public.exclusive_events (id, sku, place_id, name, host, blurb, starts_at, ends_at)
  values ('push-test', 'event-push-test', 'neon-spoon', 'Push Party', 'Lola', 'A test.', now() + interval '30 minutes', now() + interval '3 hours');
insert into public.entitlements (player_id, sku, product_type) values ('00000000-0000-0000-0000-0000000082a1', 'event-push-test', 'exclusive_event');
select pg_temp.assert(public.push_scan() >= 5, 'scan queued them');
select pg_temp.assert(pg_temp.q('bill_due') = 1 and pg_temp.q('bill_overdue') = 1, 'bill due and late');
select pg_temp.assert((select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000082a1' and kind = 'bill_due') = '🧾 Rent is due today', 'rent copy');
select pg_temp.assert(pg_temp.q('gig_ready') = 1 and pg_temp.q('till_full') = 1 and pg_temp.q('event_ticket') = 1, 'gig, till, ticket');
-- Each key once: scanning again adds nothing.
select pg_temp.assert(public.push_scan() = 0, 'scan is idempotent');

-- Triggers never break the action they watch.
create or replace function public.push_enqueue(p_player uuid, p_kind text, p_key text, p_title text, p_body text,
  p_url text default '/home', p_deadline timestamptz default null, p_close boolean default false, p_group text default null)
returns void language plpgsql as $$ begin raise exception 'boom'; end $$;
insert into public.messages (conversation_id, sender, body, ny_date)
  select id, '00000000-0000-0000-0000-0000000082a2', 'still sends', public.ny_today() from public.conversations
   where a = '00000000-0000-0000-0000-0000000082a1' and b = '00000000-0000-0000-0000-0000000082a2';
select pg_temp.assert(exists (select 1 from public.messages where body = 'still sends'), 'message saved despite a push error');

-- The browser can't run the scan.
set role authenticated;
select pg_temp.assert((select not has_function_privilege('authenticated', 'public.push_scan()', 'execute')), 'scan is server only');

rollback;
\echo 'push_triggers: ok'
