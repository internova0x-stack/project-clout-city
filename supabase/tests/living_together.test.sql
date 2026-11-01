-- Scenario test for migration 0149 (living together: moving in, the split rent, "Home together", moving out,
-- breakups, blocks, Start over, the couples' Shop guard). Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.fails(sql text, code text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm = code; end $$;
create function pg_temp.denied(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;
-- Hana hosts, Milo moves in; Cleo and Dev are another couple later; all old enough.
create function pg_temp.h() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001491'::uuid $$;
create function pg_temp.m() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001492'::uuid $$;
create function pg_temp.c() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001493'::uuid $$;
create function pg_temp.d() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001494'::uuid $$;
create function pg_temp.couple(p_a uuid, p_b uuid, p_days int) returns void language plpgsql as $$
declare rid bigint;
begin
  insert into public.relationships (a, b, start_day) values (least(p_a, p_b), greatest(p_a, p_b), public.ny_today() - p_days) returning id into rid;
  insert into public.couple_members (player_id, rel_id) values (p_a, rid), (p_b, rid);
end $$;
create function pg_temp.home(p uuid) returns text language sql as $$ select home_id from public.players where id = p $$;
create function pg_temp.live() returns public.cohabits language sql as $$ select * from public.cohabits where ended_at is null and host = pg_temp.h() $$;

insert into auth.users (id) values (pg_temp.h()), (pg_temp.m()), (pg_temp.c()), (pg_temp.d());
set role authenticated;
do $$
declare n text; i int := 1491;
begin
  foreach n in array array['Hana', 'Milo', 'Cleo', 'Dev'] loop
    perform pg_temp.as_('00000000-0000-0000-0000-00000000' || i);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
reset role;
update public.players set created_at = now() - interval '60 days', bank_cash = 5000 where id in (pg_temp.h(), pg_temp.m(), pg_temp.c(), pg_temp.d());
-- Hana rents the Jackson Heights 1BR (C$600 a week).
update public.players set home_id = 'jackson_heights_1br' where id = pg_temp.h();
select pg_temp.couple(pg_temp.h(), pg_temp.m(), 3);
set role authenticated;

-- ---- Players can't call the internals ----
select pg_temp.assert(pg_temp.denied($q$select public.cohabit_close(1, null, 'moved_out')$q$), 'cohabit_close is internal');
select pg_temp.assert(pg_temp.denied($q$select public.cohabit_rent_part(null, 100)$q$), 'cohabit_rent_part is internal');
select pg_temp.assert(pg_temp.denied($q$select public.cohabit_block_reason(null, null)$q$), 'cohabit_block_reason is internal');
select pg_temp.assert(pg_temp.denied($q$select public.cohabit_view(null)$q$), 'cohabit_view is internal');
select pg_temp.assert(pg_temp.denied($q$select * from public.cohabits$q$), 'no table access');
select pg_temp.assert(not has_function_privilege('anon', 'public.cohabit_ask()', 'execute'), 'anon can''t ask');

-- ---- Asking: official 7+ days, a home that fits two, no sublet, no rent due ----
select pg_temp.as_(pg_temp.c()::text);
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'not_dating'), 'single players can''t ask');
select pg_temp.as_(pg_temp.h()::text);
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'too_soon'), 'official 3 days: too soon');
select pg_temp.assert(public.couple_state() -> 'home' ->> 'blockedBy' = 'too_soon', 'Us says why');
reset role;
update public.relationships set start_day = public.ny_today() - 10 where a = pg_temp.h();
update public.players set home_id = 'astoria_share' where id = pg_temp.h();
set role authenticated;
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'home_too_small'), 'not from a room share');
reset role;
update public.players set home_id = 'sj_dorm' where id = pg_temp.h();
set role authenticated;
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'home_too_small'), 'not from a dorm');
reset role;
update public.players set home_id = 'jackson_heights_1br' where id = pg_temp.h();
insert into public.sublet_listings (host, home_id, rent, min_weeks, max_weeks, crew_until) values (pg_temp.h(), 'jackson_heights_1br', 200, 1, 2, now());
set role authenticated;
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'sublet_listed'), 'not with a listing up');
reset role;
update public.sublet_listings set status = 'closed' where host = pg_temp.h();
insert into public.bills (player_id, kind, amount, due_date) values (pg_temp.m(), 'rent', 425, public.ny_today());
set role authenticated;
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'rent_due'), 'not with rent due on either side');
reset role;
update public.bills set status = 'paid', paid_at = now() where player_id = pg_temp.m() and kind = 'rent' and status = 'due';
set role authenticated;
select pg_temp.assert(public.couple_state() -> 'home' ->> 'blockedBy' is null, 'now they can');
select pg_temp.assert(jsonb_array_length(public.cohabit_ask() -> 'home' -> 'asks') = 1, 'Hana asks');
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_ask()$q$, 'ask_exists'), 'one ask at a time');

-- ---- Milo says yes: his rental ends, his furniture goes to storage, Lola posts it ----
reset role;
update public.players set home_layout = '[{"id":"x","x":0,"z":0,"rot":0}]'::jsonb where id = pg_temp.m();
set role authenticated;
select pg_temp.as_(pg_temp.m()::text);
select pg_temp.assert(not (public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'mine')::boolean, 'Milo sees the ask');
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_answer(999999, true)$q$, 'unknown_ask'), 'unknown ask');
select pg_temp.assert(public.cohabit_answer((public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'id')::bigint, true) -> 'home' -> 'live' ->> 'role' = 'mover',
  'moved in');
reset role;
select pg_temp.assert(pg_temp.home(pg_temp.m()) = 'jackson_heights_1br', 'Milo lives at Hana''s');
select pg_temp.assert((select home_layout from public.players where id = pg_temp.m()) is null, 'his furniture is in storage');
select pg_temp.assert((select next_rent_due from public.players where id = pg_temp.m()) = (select next_rent_due from public.players where id = pg_temp.h()),
  'rent day lines up');
select pg_temp.assert((select mover_from from public.cohabits where mover = pg_temp.m() and ended_at is null) = 'astoria_studio', 'where he came from');
select pg_temp.assert(exists (select 1 from public.choice_headlines where kind = 'win' and text like '%@Hana and @Milo moved in together%'), 'Lola''s line');
select pg_temp.assert(exists (select 1 from public.player_facts where player_id = pg_temp.m() and key = 'couple.moved_in'), 'memory: moved in');
set role authenticated;
select pg_temp.assert(public.cohabit_home() ->> 'hostName' = 'Hana', 'Milo sees Hana''s home');
select pg_temp.as_(pg_temp.h()::text);
select pg_temp.assert(public.cohabit_home() is null, 'the host just sees her own');
select pg_temp.assert(public.couple_state() -> 'home' ->> 'blockedBy' = 'already_together', 'already together');
select pg_temp.as_(pg_temp.c()::text);
select pg_temp.assert((public.player_card(pg_temp.h()) -> 'partner' ->> 'together')::boolean, 'card: living together');

-- ---- Rent halves: each pays their part (the mover floor(rent / 2), the host the rest) ----
reset role;
select pg_temp.assert(public.cohabit_rent_part(pg_temp.m(), 425) = 212 and public.cohabit_rent_part(pg_temp.h(), 425) = 213, 'odd rents split exactly');
select pg_temp.assert(public.cohabit_rent_part(pg_temp.c(), 425) = 425, 'alone: the whole rent');
update public.players set next_rent_due = public.ny_today() where id in (pg_temp.h(), pg_temp.m());
select public.tick(pg_temp.h());
select public.tick(pg_temp.m());
select pg_temp.assert((select amount from public.bills where player_id = pg_temp.h() and kind = 'rent' and status = 'due') = 300, 'Hana pays half of 600');
select pg_temp.assert((select amount from public.bills where player_id = pg_temp.m() and kind = 'rent' and status = 'due') = 300, 'Milo pays half of 600');
set role authenticated;
select pg_temp.as_(pg_temp.m()::text);
select pg_temp.assert(public.cohabit_rent() = 300, 'next rent shows his part');
select pg_temp.assert((public.couple_state() -> 'home' -> 'live' ->> 'myRent')::int = 300, 'Us shows his part');
reset role;
update public.bills set status = 'paid', paid_at = now() where player_id in (pg_temp.h(), pg_temp.m()) and kind = 'rent' and status = 'due';
set role authenticated;

-- ---- Migration 0155: the rent alarm warns about his part (C$300), not the whole C$600 ----
select pg_temp.as_(pg_temp.m()::text);
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/0155m', 'k', 'a', 'America/New_York');
reset role;
update public.players set next_rent_due = public.ny_today() + 2, bank_cash = 400 where id = pg_temp.m();
delete from public.push_queue where player_id = pg_temp.m();
select public.push_scan_rent_short();
select pg_temp.assert(not exists (select 1 from public.push_queue where player_id = pg_temp.m() and kind = 'rent_short'), 'C$400 covers his C$300: no alarm');
update public.players set bank_cash = 200 where id = pg_temp.m();
select public.push_scan_rent_short();
select pg_temp.assert((select body from public.push_queue where player_id = pg_temp.m() and kind = 'rent_short') like 'C$300 due%', 'short of his part: warned about C$300');
update public.players set next_rent_due = (select next_rent_due from public.players where id = pg_temp.h()), bank_cash = 5000 where id = pg_temp.m();
set role authenticated;

-- ---- While together: no sublets, the mover doesn't host visits ----
select pg_temp.assert(public.sublet_state() ->> 'hostBlock' = 'living_together', 'no listing while together');
reset role;
select pg_temp.assert(pg_temp.fails(format($q$insert into public.visits (host, kind, home_id, starts_at, ends_at, capacity, ny_date)
  values (%L, 'hang', 'jackson_heights_1br', now(), now() + interval '1 hour', 4, public.ny_today())$q$, pg_temp.m()), 'partner_hosts'), 'the host hosts');
set role authenticated;

-- ---- Home together: both tap it, both get Mood and clout once ----
select 1 from public.cohabit_hang();
select pg_temp.assert(not exists (select 1 from public.ledger where kind = 'cohabit_home'), 'one tap pays nothing');
reset role;
update public.players set mood = 50 where id in (pg_temp.h(), pg_temp.m());
set role authenticated;
select pg_temp.as_(pg_temp.h()::text);
select pg_temp.assert((public.cohabit_hang() -> 'home' -> 'live' ->> 'homeOther')::boolean, 'both home');
select 1 from public.cohabit_hang();
select pg_temp.as_(pg_temp.m()::text);
select 1 from public.cohabit_hang();
reset role;
select pg_temp.assert((select count(*) from public.ledger where kind = 'cohabit_home' and amount = 5) = 2, 'both paid once');
select pg_temp.assert((select mood from public.players where id = pg_temp.h()) = 58, 'Mood +8');
set role authenticated;

-- ---- Hana ends it: Milo goes back to a room share, Hana keeps the home at full rent ----
select pg_temp.as_(pg_temp.h()::text);
select pg_temp.assert(public.cohabit_leave() -> 'home' ->> 'live' is null, 'not living together');
select pg_temp.assert(pg_temp.fails($q$select public.cohabit_leave()$q$, 'not_living_together'), 'nothing to leave');
reset role;
select pg_temp.assert(pg_temp.home(pg_temp.m()) = public.cheapest_home() and pg_temp.home(pg_temp.h()) = 'jackson_heights_1br', 'homes after');
select pg_temp.assert(not exists (select 1 from public.choice_headlines where text like '%@Hana and @Milo moved in together%'), 'Lola''s line comes down');
update public.players set next_rent_due = public.ny_today() where id in (pg_temp.h(), pg_temp.m());
select public.tick(pg_temp.h());
select public.tick(pg_temp.m());
select pg_temp.assert((select amount from public.bills where player_id = pg_temp.h() and kind = 'rent' and status = 'due') = 600, 'full rent again');
select pg_temp.assert((select amount from public.bills where player_id = pg_temp.m() and kind = 'rent' and status = 'due') = public.rent_for(public.cheapest_home()),
  'room share rent');
update public.bills set status = 'paid', paid_at = now() where player_id in (pg_temp.h(), pg_temp.m()) and kind = 'rent' and status = 'due';
set role authenticated;
select pg_temp.as_(pg_temp.m()::text);
select pg_temp.assert(public.couple_state() -> 'home' -> 'ended' ->> 'name' = 'Hana', 'Milo gets the note');
select public.couple_seen();
select pg_temp.assert(public.couple_state() -> 'home' ->> 'ended' is null, 'note seen once');

-- ---- A declined ask, then a breakup ends it ----
select pg_temp.as_(pg_temp.h()::text);
select 1 from public.cohabit_ask();
select pg_temp.as_(pg_temp.m()::text);
select 1 from public.cohabit_answer((public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'id')::bigint, false);
select pg_temp.assert(pg_temp.home(pg_temp.m()) = 'astoria_share', 'no means no move');
select pg_temp.as_(pg_temp.h()::text);
select 1 from public.cohabit_ask();
select pg_temp.as_(pg_temp.m()::text);
select 1 from public.cohabit_answer((public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'id')::bigint, true);
select pg_temp.assert(pg_temp.home(pg_temp.m()) = 'jackson_heights_1br', 'together again');
select 1 from public.couple_end();
reset role;
select pg_temp.assert((select end_reason from public.cohabits where mover = pg_temp.m() order by id desc limit 1) = 'breakup', 'a breakup ends it');
select pg_temp.assert(pg_temp.home(pg_temp.m()) = public.cheapest_home(), 'Milo back in a room share');

-- ---- Start over ends it: the host restarts, the mover goes to a room share ----
select pg_temp.couple(pg_temp.h(), pg_temp.m(), 10);
set role authenticated;
select pg_temp.as_(pg_temp.h()::text);
select 1 from public.cohabit_ask();
select pg_temp.as_(pg_temp.m()::text);
select 1 from public.cohabit_answer((public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'id')::bigint, true);
select pg_temp.as_(pg_temp.h()::text);
select 1 from public.restart_player();
reset role;
select pg_temp.assert((select end_reason from public.cohabits where mover = pg_temp.m() order by id desc limit 1) = 'restart', 'Start over ends it');
select pg_temp.assert(pg_temp.home(pg_temp.m()) = public.cheapest_home(), 'the mover has a home');
select pg_temp.assert((pg_temp.live()).id is null, 'nothing live');

-- ---- Couples-only Shop pieces; blocking ends living together ----
insert into public.shop_catalog (sku, status, go_live_at, tab, slot, name, description, emoji, price, clout, wearable, origin, extra)
values ('couple-test-seat', 'live', now(), 'home', 'living', 'Test loveseat', 'A loveseat for tests only.', '🛋️', 100, 5, true, 'import',
        '{"couplesOnly": true, "line": "couple-test-seat"}');
set role authenticated;
select pg_temp.as_(pg_temp.c()::text);
select pg_temp.assert(pg_temp.fails($q$select public.buy_item('couple-test-seat', 'buy')$q$, 'couples_only'), 'single: couples only');
reset role;
select pg_temp.couple(pg_temp.c(), pg_temp.d(), 10);
set role authenticated;
select 1 from public.buy_item('couple-test-seat', 'buy');
select pg_temp.assert(exists (select 1 from public.player_items where player_id = pg_temp.c() and sku = 'couple-test-seat'), 'dating: bought');
-- Cleo's studio fits two; Dev moves in; then Cleo blocks Dev.
select 1 from public.cohabit_ask();
select pg_temp.as_(pg_temp.d()::text);
select 1 from public.cohabit_answer((public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'id')::bigint, true);
reset role;
select pg_temp.assert(pg_temp.home(pg_temp.d()) = 'astoria_studio' and exists (select 1 from public.cohabits where mover = pg_temp.d() and ended_at is null),
  'Dev lives at Cleo''s');
insert into public.blocks (blocker, blocked) values (pg_temp.c(), pg_temp.d());
select pg_temp.assert((select end_reason from public.cohabits where mover = pg_temp.d()) = 'blocked', 'blocking ends it');
select pg_temp.assert(pg_temp.home(pg_temp.d()) = public.cheapest_home(), 'Dev back in a room share');

-- ---- The mover moving out on their own (move_home) ends it too, without moving them twice ----
reset role;
delete from public.blocks;
select pg_temp.couple(pg_temp.c(), pg_temp.d(), 10);
set role authenticated;
select pg_temp.as_(pg_temp.c()::text);
select 1 from public.cohabit_ask();
select pg_temp.as_(pg_temp.d()::text);
select 1 from public.cohabit_answer((public.couple_state() -> 'home' -> 'asks' -> 0 ->> 'id')::bigint, true);
select 1 from public.move_home('jackson_heights_1br');
reset role;
select pg_temp.assert((select end_reason from public.cohabits where mover = pg_temp.d() order by id desc limit 1) = 'moved', 'moving ends it');
select pg_temp.assert(pg_temp.home(pg_temp.d()) = 'jackson_heights_1br', 'Dev keeps his new place');

rollback;
