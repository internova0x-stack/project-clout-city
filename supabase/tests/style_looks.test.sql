-- Scenario test for migration 0100 (style lines in play: venue match, full looks, style tasks).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000100a01'::uuid $$;
create function pg_temp.item(p text) returns bigint language sql security definer as $$
  select id from public.player_items where player_id = pg_temp.id() and sku = p order by id limit 1 $$;
create function pg_temp.counts() returns jsonb language sql security definer as $$ select public.style_counts(pg_temp.id()) $$;
create function pg_temp.conf() returns int language sql security definer as $$ select confidence from public.players where id = pg_temp.id() $$;

insert into auth.users (id, email) values (pg_temp.id(), 'drip@example.com');
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.id()::text, false);
select 1 from public.create_player('drip', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 100000, clout = 100000, confidence = 50 where id = pg_temp.id();

-- The old pieces have lines now; the settings match lib/style.ts (tests/style.test.ts).
select pg_temp.assert((select style_lines from public.shop_catalog where sku = 'fit-leather-blazer') = array['business-casual', 'gothic'], 'old pieces get lines');
select pg_temp.assert((public.style_settings() ->> 'fullMin')::int = 3, 'settings');

-- A new player arrives in their starting style's full look, and the profile's first look earns its badge.
select pg_temp.assert(pg_temp.counts() = '{"streetwear": 3}', 'starting look: ' || pg_temp.counts()::text);
set role authenticated;
select pg_temp.assert(public.style_state() -> 'full' = '["streetwear"]', 'full streetwear look');
reset role;
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.id() and badge_id = 'look-streetwear'), 'the badge');

-- Shop pieces replace their slot's starting clothes; each counts once per line, whatever it cost.
set role authenticated;
select 1 from public.buy_item('fit-leather-blazer');
select 1 from public.equip_item(pg_temp.item('fit-leather-blazer'), true);
reset role;
select pg_temp.assert(pg_temp.counts() = '{"streetwear": 2, "business-casual": 1, "gothic": 1}', 'blazer: ' || pg_temp.counts()::text);

-- A whole outfit is a look on its own; wearing it earns its badge at once.
set role authenticated;
select 1 from public.buy_item('set-st-marks-punk');
select 1 from public.equip_item(pg_temp.item('set-st-marks-punk'), true);
reset role;
select pg_temp.assert((pg_temp.counts() ->> 'gothic')::int >= 3, 'the punk set is a full gothic look: ' || pg_temp.counts()::text);
select pg_temp.assert(not (pg_temp.counts() ? 'streetwear'), 'the outfit covers the starting clothes');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.id() and badge_id = 'look-gothic'), 'gothic badge on equip');

-- Venue match: at a club, once a day; nowhere that doesn't fit.
select pg_temp.assert(public.style_venue_boost(pg_temp.id(), 'steinway-fresh') is null, 'the supermarket fits nothing worn');
select pg_temp.assert(pg_temp.conf() = 50, 'no boost there');
insert into public.action_uses (player_id, place_id, action_id, ny_date) values (pg_temp.id(), 'hellgate-hall', 'visit', public.ny_today());
-- (The trigger waits for the end of the action's transaction; here, the end of this statement.)
set constraints public.style_on_action immediate;
select pg_temp.assert(pg_temp.conf() = 55, 'the trigger gave +5 Confidence at the club');
select pg_temp.assert((select line from public.style_boosts where player_id = pg_temp.id()) = 'gothic', 'as the gothic look');
select pg_temp.assert(public.style_venue_boost(pg_temp.id(), 'velvet-static') is null and pg_temp.conf() = 55, 'once a day');
set role authenticated;
select pg_temp.assert(public.style_state() -> 'boost' = '{"line": "gothic", "place": "hellgate-hall"}', 'the screen shows it');
reset role;

-- Style tasks: when the list is made (here every time), the last ordinary task asks for a look the player owns.
update public.game_settings set value = jsonb_set(value, '{taskChance}', '1') where key = 'style';
delete from public.daily_tasks where player_id = pg_temp.id();
select public.ensure_daily(pg_temp.id());
create temp table st as select * from public.daily_tasks where player_id = pg_temp.id() and kind like 'style:%';
grant select on st to authenticated;
select pg_temp.assert((select count(*) from st) = 1, 'one style task');
select pg_temp.assert((select substr(kind, 7) from st) in ('gothic', 'streetwear'), 'for a look owned: ' || (select kind from st));
-- Not wearing that look: the action doesn't count. Wearing it: it does.
set role authenticated;
select 1 from public.equip_item(pg_temp.item('set-st-marks-punk'), (select kind from st) <> 'style:gothic');
select 1 from public.equip_item(pg_temp.item('fit-leather-blazer'), true);
reset role;
select pg_temp.assert(public.complete_task(pg_temp.id(), (select place_id from st), (select action_id from st)) = 0, 'look not worn: not done');
select pg_temp.assert((select done_at from public.daily_tasks where id = (select id from st)) is null, 'still open');
set role authenticated;
select 1 from public.equip_item(pg_temp.item('fit-leather-blazer'), false);
select 1 from public.equip_item(pg_temp.item('set-st-marks-punk'), (select kind from st) = 'style:gothic');
reset role;
select pg_temp.assert(public.complete_task(pg_temp.id(), (select place_id from st), (select action_id from st)) > 0, 'look worn: done and paid');

-- Helpers stay server-side.
select pg_temp.assert(not has_function_privilege('authenticated', 'public.style_counts(uuid)', 'execute'), 'style_counts revoked');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.ensure_daily(uuid)', 'execute'), 'ensure_daily revoked');
select pg_temp.assert(not has_function_privilege('anon', 'public.style_state()', 'execute'), 'anon');
select pg_temp.assert(has_function_privilege('authenticated', 'public.style_state()', 'execute'), 'players read their style');

rollback;
