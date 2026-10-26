-- Scenario test for migration 0121 (having people over): who can be invited, limits, arriving, the room, payouts
-- multiplied by the Crib Rating, chat, blocking, parties and their snacks. Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.fails(sql text, code text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm = code; end $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000002' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(11, 14) n;
set role authenticated;
do $$
declare n text; i int := 11;
begin
  foreach n in array array['Hostess', 'Bobby', 'Cyril', 'Dorian'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
-- Hostess invited Bobby (crew); Hostess and Cyril have a chat; Dorian is a stranger who only takes messages from crew.
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.u(11), pg_temp.u(12), 'TEST');
insert into public.conversations (a, b) values (least(pg_temp.u(11), pg_temp.u(13)), greatest(pg_temp.u(11), pg_temp.u(13)));
update public.players set messages_from = 'crew' where id = pg_temp.u(14);
update public.players set bank_cash = 5000, mood = 50 where id in (pg_temp.u(11), pg_temp.u(12), pg_temp.u(13), pg_temp.u(14));
set role authenticated;

-- ---- Who can come ----
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(jsonb_array_length(public.visit_state() -> 'invitable') = 2, 'crew and a chat, not a stranger');
select pg_temp.assert((public.visit_state() ->> 'capacity')::int = 3, 'a studio holds 3');
select pg_temp.assert(pg_temp.fails(format('select public.visit_host(%L, array[%L]::uuid[])', 'hang', pg_temp.u(14)), 'cant_invite'), 'not a stranger');

-- ---- A hangout ----
select pg_temp.assert(public.visit_host('hang', array[pg_temp.u(12), pg_temp.u(13)]) -> 'hosting' ->> 'kind' = 'hang', 'hosting');
select pg_temp.assert(pg_temp.fails(format('select public.visit_host(%L, array[%L]::uuid[])', 'hang', pg_temp.u(12)), 'already_hosting'), 'one at a time');
select pg_temp.as_(pg_temp.u(12)::text);
select pg_temp.assert(jsonb_array_length(public.visit_state() -> 'invites') = 1, 'Bobby sees the invite');
select pg_temp.assert(public.visit_arrive((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint) ->> 'mine' = 'false', 'Bobby goes in');
select pg_temp.assert(public.visit_home((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint) ->> 'homeId' = 'astoria_studio', 'Bobby sees the home');
select pg_temp.assert(pg_temp.paid('visit_guest', pg_temp.u(12)) = 0, 'not paid on arrival');

-- Two minutes later he's still there: both paid (the host times 1 + Crib Rating 0 / 100 = 8).
reset role;
update public.visit_guests set arrived_at = now() - interval '3 minutes' where player_id = pg_temp.u(12);
set role authenticated;
select 1 from public.visit_room((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint, 0);
select pg_temp.assert(pg_temp.paid('visit_guest', pg_temp.u(12)) = 10, 'Bobby +10 clout');
select pg_temp.assert(pg_temp.paid('visit_host', pg_temp.u(11)) = 8, 'host +8 clout');
select 1 from public.visit_room((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint, 0);
select pg_temp.assert(pg_temp.paid('visit_host', pg_temp.u(11)) = 8, 'paid once');

-- Chat
select pg_temp.assert(public.visit_say((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint, 'Nice place') ->> 'body' = 'Nice place', 'said');
select pg_temp.as_(pg_temp.u(11)::text);
select pg_temp.assert(jsonb_array_length(public.visit_room((public.visit_state() -> 'hosting' ->> 'id')::bigint, 0) -> 'messages') = 1, 'host reads it');
select pg_temp.assert(jsonb_array_length(public.visit_room((public.visit_state() -> 'hosting' ->> 'id')::bigint, 0) -> 'people') = 1, 'Bobby is here');

-- Cyril arrives; the host blocks him and he's out.
select pg_temp.as_(pg_temp.u(13)::text);
select 1 from public.visit_arrive((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint);
reset role;
insert into public.blocks (blocker, blocked) values (pg_temp.u(11), pg_temp.u(13));
select pg_temp.assert((select status from public.visit_guests where player_id = pg_temp.u(13)) = 'sent_home', 'block sends him home');
set role authenticated;

-- ---- A party: the Crib Rating multiplies the host's clout; snacks are paid; one a day ----
select pg_temp.as_(pg_temp.u(11)::text);
select 1 from public.visit_end();
reset role;
update public.players set home_layout = '[]' where id = pg_temp.u(11);
-- A Crib Rating of 50 at the start: 20 × 1.5 = 30 a guest.
create or replace function public.home_score(p_player uuid) returns jsonb language sql stable as $$ select '{"score": 50}'::jsonb $$;
set role authenticated;
select pg_temp.assert(public.visit_host('party', array[pg_temp.u(12)]) -> 'hosting' ->> 'crib' = '50', 'party hosted');
select pg_temp.assert(pg_temp.paid('visit_snacks', pg_temp.u(11)) = -100, 'snacks C$40 + 20 × 3');
select pg_temp.as_(pg_temp.u(12)::text);
select 1 from public.visit_arrive((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint);
reset role;
update public.visit_guests set arrived_at = now() - interval '3 minutes' where player_id = pg_temp.u(12) and paid_at is null;
set role authenticated;
select 1 from public.visit_room((public.visit_state() -> 'invites' -> 0 ->> 'id')::bigint, 0);
select pg_temp.assert(pg_temp.paid('visit_host', pg_temp.u(11)) = 8 + 30, 'party pays 30 at Crib 50');
select pg_temp.assert(pg_temp.paid('visit_guest', pg_temp.u(12)) = 10 + 25, 'party guest +25');
select pg_temp.as_(pg_temp.u(11)::text);
select 1 from public.visit_end();
select pg_temp.assert(pg_temp.fails(format('select public.visit_host(%L, array[%L]::uuid[])', 'party', pg_temp.u(12)), 'daily_limit'), 'one party a day');

rollback;
\echo home_visits ok
