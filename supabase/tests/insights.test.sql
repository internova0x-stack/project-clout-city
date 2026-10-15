-- Scenario test for migration 0053 (Insights: sessions, renewals, admin_insights).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000a' || n)::uuid $$;

-- Other suites leave players behind: start from an empty city (rolled back at the end).
set client_min_messages = warning;
truncate auth.users, public.players cascade;
reset client_min_messages;
insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 4) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('ins_one', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('ins_two', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('ins_three', 'bodega_drip', '{}', null, true);
-- (player 3 never moves in; account 4 never makes a character)

-- Sessions: a ping starts one; a ping a minute later extends it; after 5 quiet minutes a new one starts.
select pg_temp.as_(1); select public.session_ping();
reset role;
select pg_temp.assert((select count(*) from public.player_sessions where player_id = pg_temp.id(1)) = 1, 'a session');
update public.player_sessions set started_at = now() - interval '10 minutes', last_seen = now() - interval '1 minute' where player_id = pg_temp.id(1);
set role authenticated; select pg_temp.as_(1); select public.session_ping(); reset role;
select pg_temp.assert((select count(*) from public.player_sessions where player_id = pg_temp.id(1)) = 1
                      and (select extract(epoch from last_seen - started_at) from public.player_sessions where player_id = pg_temp.id(1)) >= 590, 'extended to 10 minutes');
update public.player_sessions set last_seen = now() - interval '6 minutes' where player_id = pg_temp.id(1);
set role authenticated; select pg_temp.as_(1); select public.session_ping(); reset role;
select pg_temp.assert((select count(*) from public.player_sessions where player_id = pg_temp.id(1)) = 2, 'a new session after a break');

-- Player 1 joined 8 days ago and came back on day 1 and day 7; player 2 joined today.
update public.players set created_at = now() - interval '8 days' where id = pg_temp.id(1);
insert into public.analytics_events (player_id, name, ny_date) values
  (pg_temp.id(1), 'session', public.ny_today() - 7), (pg_temp.id(1), 'session', public.ny_today() - 1), (pg_temp.id(2), 'session', public.ny_today());
-- Revenue: a $2.99 story, a refunded postcard, and a VIP renewal.
select public.payment_grant('evt_i1', 'cs_i1', 'pi_i1', pg_temp.id(1), 'side_sarah_bird_momager_files', 299, 'usd');
select public.payment_grant('evt_i2', 'cs_i2', 'sub_i', pg_temp.id(2), 'chat-unlimited-monthly', 499, 'usd');
select pg_temp.assert(public.payment_renewal('evt_i3', 'sub_i', 499, 'usd') = 'recorded', 'renewal recorded');
select pg_temp.assert(public.payment_renewal('evt_i3', 'sub_i', 499, 'usd') = 'duplicate', 'once per event');

-- Admins only.
set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.admin_insights(30)$$, 'not_admin'), 'players can''t read insights');
select pg_temp.assert(pg_temp.raises($$select public.payment_renewal('x', 'y', 1, 'usd')$$, 'permission denied'), 'renewals are the webhook''s');
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
set role authenticated; select pg_temp.as_(1);
create temp table ins as select public.admin_insights(30) j;
grant all on ins to authenticated;
select pg_temp.assert((select (j -> 'totals' ->> 'players')::int from ins) = 2, 'two players moved in');
select pg_temp.assert((select (j -> 'totals' ->> 'accounts')::int from ins) = 4, 'four accounts');
select pg_temp.assert((select (j -> 'totals' ->> 'signupsToday')::int from ins) = 1, 'one sign-up today');
select pg_temp.assert((select (j -> 'totals' ->> 'revenueCents')::int from ins) = 299 + 499 + 499, 'story, VIP and its renewal');
select pg_temp.assert((select (j -> 'totals' ->> 'payers')::int from ins) = 2 and (select (j -> 'totals' ->> 'vipMembers')::int from ins) = 1, 'two payers, one VIP');
select pg_temp.assert((select (j -> 'totals' ->> 'sessionsPeriod')::int from ins) = 2, 'two sessions');
select pg_temp.assert((select (j -> 'totals' ->> 'avgSessionSeconds')::int from ins) between 110 and 130, 'average 2 minutes (4 and 0)');
select pg_temp.assert((select j -> 'retention' -> 'd1' ->> 'returned' from ins)::int = 1 and (select j -> 'retention' -> 'd1' ->> 'cohort' from ins)::int = 1, 'D1: 1 of 1');
select pg_temp.assert((select j -> 'retention' -> 'd7' ->> 'returned' from ins)::int = 1, 'D7: back on day 7');
select pg_temp.assert(jsonb_array_length((select j -> 'daily' from ins)) = 30, '30 days');
select pg_temp.assert((select (j -> 'funnel' -> 0 ->> 'n')::int from ins) = 4 and (select (j -> 'funnel' -> 1 ->> 'n')::int from ins) = 3
                      and (select (j -> 'funnel' -> 2 ->> 'n')::int from ins) = 2, 'funnel 4, 3, 2');
select pg_temp.assert((select j -> 'spending' -> 0 ->> 'type' from ins) = 'chat_pass', 'VIP earns most');
select public.admin_insights(7);

rollback;
\echo 'insights: ok'
