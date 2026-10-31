-- Scenario test for migration 0152 (the Player Economy, Phase 2: listings, swaps, the trade hold, reversals and underworld
-- jobs between players). Runs in a transaction and rolls back.
-- (ONLY=$PWD/supabase/tests/marketplace.test.sql npm run test:db).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.id(n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.id(n)::text, false) $$;
create function pg_temp.cash(n int) returns bigint language sql security definer as $$
  select bank_cash from public.players where id = pg_temp.id(n) $$;
create function pg_temp.item(n int, s text) returns bigint language sql security definer as $$
  select id from public.player_items where player_id = pg_temp.id(n) and sku = s $$;
create function pg_temp.owner(i bigint) returns uuid language sql security definer as $$
  select player_id from public.player_items where id = i $$;
create function pg_temp.lock(i bigint) returns text language sql security definer as $$
  select market_lock from public.player_items where id = i $$;
create function pg_temp.flags(r text) returns bigint language sql security definer as $$
  select count(*) from public.economy_flags where rule = r $$;
create function pg_temp.reset_limits() returns void language sql security definer as $$ delete from public.economy_limits $$;
create function pg_temp.give(n int, s text) returns bigint language sql security definer as $$
  insert into public.player_items (player_id, sku, category, value)
  select pg_temp.id(n), s, public.shop_item(s) ->> 'category', (public.shop_item(s) ->> 'price')::bigint returning id $$;
create function pg_temp.setting(path text[], v jsonb) returns void language sql security definer as $$
  update public.game_settings set value = jsonb_set(value, path, v) where key = 'marketplace' $$;

-- Ana (1) and Bo (2) are crew; Cy (3) and Fay (7) are strangers; Dee (5) is crew but Rank 1; Eve (6) is a Studio admin.
insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 7) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('anaaa', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('boboo', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('cyyyy', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(5); select 1 from public.create_player('deeee', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(7); select 1 from public.create_player('fayyy', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set created_at = now() - interval '20 days', bank_cash = 20000, clout = 100, energy = 100
 where id in (pg_temp.id(1), pg_temp.id(2), pg_temp.id(3), pg_temp.id(7));
update public.players set created_at = now() - interval '20 days', bank_cash = 10000, clout = 0 where id = pg_temp.id(5);
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.id(1), pg_temp.id(2), 'ana-bo'), (pg_temp.id(1), pg_temp.id(5), 'ana-dee');
insert into public.story_admins (user_id) values (pg_temp.id(6));
select pg_temp.give(1, 'home-tv'); select pg_temp.give(1, 'fit-chunky-sneakers'); select pg_temp.give(1, 'home-island'); select pg_temp.give(1, 'set-witch');
select pg_temp.give(2, 'fit-leather-blazer'); select pg_temp.give(2, 'home-bookshelf'); select pg_temp.give(2, 'home-bed-blue');
select pg_temp.give(3, 'fit-chunky-sneakers'); select pg_temp.give(3, 'home-plant');
select pg_temp.give(7, 'home-desk');
create temp table ids as select pg_temp.item(1, 'home-tv') tv, pg_temp.item(1, 'fit-chunky-sneakers') sneakers, pg_temp.item(1, 'home-island') island,
  pg_temp.item(1, 'set-witch') chain, pg_temp.item(2, 'fit-leather-blazer') blazer, pg_temp.item(2, 'home-bookshelf') shelf, pg_temp.item(2, 'home-bed-blue') bed,
  pg_temp.item(3, 'fit-chunky-sneakers') cy_sneakers, pg_temp.item(7, 'home-desk') desk;
grant all on ids to authenticated;
set role authenticated;

-- ---------------------------------------------------------------------------
-- Internals stay internal; tables stay private
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.market_trade_settle(1)$$, 'permission denied'), 'settling is internal');
select pg_temp.assert(pg_temp.raises($$select public.market_trade_lock(1, 'a')$$, 'permission denied'), 'locking is internal');
select pg_temp.assert(pg_temp.raises($$select public.market_check_hold(pg_temp.id(1), false)$$, 'permission denied'), 'the hold check is internal');
select pg_temp.assert(pg_temp.raises($$select public.market_settle_due(pg_temp.id(1))$$, 'permission denied'), 'the sweep is internal');
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'x', 'x', null, 100)$$, 'permission denied'), 'hiring runs on the server');
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_settle(1, pg_temp.id(2), 'win', 2500)$$, 'permission denied'), 'paying a runner runs on the server');
select pg_temp.assert(pg_temp.raises($$select public.market_give_back(pg_temp.id(1), 1000, 'x')$$, 'permission denied'), 'no free money');
select pg_temp.assert(pg_temp.raises($$select * from public.market_listings$$, 'permission denied'), 'no direct reads of listings');
select pg_temp.assert(pg_temp.raises($$select * from public.market_trades$$, 'permission denied'), 'no direct reads of swaps');
select pg_temp.assert(pg_temp.raises($$select public.admin_market_recent()$$, 'admin'), 'the Studio is for admins');

-- ---------------------------------------------------------------------------
-- Phase 2 starts off: everything refuses
-- ---------------------------------------------------------------------------
select pg_temp.assert(not (public.market_state() ->> 'on')::boolean, 'the Market says opening soon');
select pg_temp.assert(pg_temp.raises($$select public.market_list((select tv from ids), 700)$$, 'phase_off'), 'no listing while off');
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(2), array[(select tv from ids)], array[(select blazer from ids)], 0, 0)$$, 'phase_off'), 'no swaps while off');
select pg_temp.assert(pg_temp.raises($$select public.market_buy(1, false)$$, 'phase_off'), 'no buying while off');
select pg_temp.as_(6);
select 1 from public.admin_economy_set('marketplace', true);
select pg_temp.as_(1);
select pg_temp.assert((public.market_state() ->> 'on')::boolean, 'open now');

-- ---------------------------------------------------------------------------
-- Listings: the band, one listing per item, locks
-- ---------------------------------------------------------------------------
select pg_temp.assert(pg_temp.raises($$select public.market_list((select tv from ids), 1000)$$, 'out_of_band'), 'C$1,000 is over 150% of C$650');
select pg_temp.assert(pg_temp.raises($$select public.market_list((select tv from ids), 300)$$, 'out_of_band'), 'C$300 is under 50%');
select pg_temp.assert(pg_temp.raises($$select public.market_list((select blazer from ids), 900)$$, 'unknown_item'), 'only your own things');
create temp table l1 as select public.market_list((select tv from ids), 700) r;
grant all on l1 to authenticated;
select pg_temp.assert((select (r ->> 'fee')::int from l1) = 35, '5% shown up front');
select pg_temp.assert(pg_temp.lock((select tv from ids)) = 'listing:' || (select r ->> 'id' from l1), 'the TV is locked');
select pg_temp.assert(pg_temp.raises($$select public.market_list((select tv from ids), 700)$$, 'item_locked'), 'one listing per item');
select pg_temp.assert(pg_temp.raises($$select public.sell_item((select tv from ids))$$, 'item_locked'), 'a listed piece can''t go back to the game');
reset role;
select pg_temp.assert(pg_temp.raises($$update public.player_items set equipped = true where id = (select tv from ids)$$, 'item_locked'), 'or be worn');
set role authenticated;
-- Who sees it: Crew yes, strangers no, strangers on the open board yes.
select pg_temp.as_(2);
select pg_temp.assert(jsonb_array_length(public.market_state() -> 'browse') = 1, 'Bo (crew) sees the TV');
select pg_temp.as_(3);
select pg_temp.assert(jsonb_array_length(public.market_state() -> 'browse') = 0, 'Cy (a stranger) doesn''t');
select pg_temp.assert(pg_temp.raises($$select public.market_buy((select (r ->> 'id')::bigint from l1), false)$$, 'not_visible'), 'and can''t buy it');
select 1 from public.economy_set_open(true);
select pg_temp.as_(1); select 1 from public.economy_set_open(true);
select pg_temp.as_(3);
select pg_temp.assert(jsonb_array_length(public.market_state() -> 'browse') = 1, 'both on the open board: Cy sees it');
select pg_temp.as_(1); select 1 from public.economy_set_open(false);

-- Bo buys: escrow, the fee, the item moves with a fresh hold, both histories.
select pg_temp.as_(2);
select 1 from public.market_buy((select (r ->> 'id')::bigint from l1), false);
select pg_temp.assert(pg_temp.cash(2) = 20000 - 700, 'Bo paid C$700');
select pg_temp.assert(pg_temp.cash(1) = 20000 + 665, 'Ana got C$700 minus the C$35 fee');
select pg_temp.assert(pg_temp.owner((select tv from ids)) = pg_temp.id(2) and pg_temp.lock((select tv from ids)) is null, 'the TV is Bo''s, unlocked');
reset role;
select pg_temp.assert((select received_via = 'sale' and no_resale_until > now() + interval '13 days' from public.player_items where id = (select tv from ids)), 'a fresh 14-day hold');
select pg_temp.assert((select count(*) from public.ledger where kind = 'economy_fee' and player_id = pg_temp.id(1)) = 1, 'the fee is a ledger row');
select pg_temp.assert((select count(*) from public.ledger where kind = 'market_hold' and player_id = pg_temp.id(2) and amount = -700) = 1, 'the buyer''s escrow');
set role authenticated;
select pg_temp.assert(public.economy_history() -> 0 ->> 'kind' = 'sale' and public.economy_history() -> 0 ->> 'direction' = 'sent', 'in Bo''s history');
select pg_temp.assert((public.economy_state() -> 'week' ->> 'sent')::int = 700, 'counted in Bo''s week');
select pg_temp.assert(pg_temp.raises($$select public.market_list((select tv from ids), 700)$$, 'no_resale'), 'no flipping it for 14 days');
select pg_temp.as_(1);
select pg_temp.assert(public.economy_history() -> 0 ->> 'kind' = 'sale' and public.economy_history() -> 0 ->> 'direction' = 'received', 'in Ana''s history');

-- Big sales need the second confirmation.
create temp table l2 as select public.market_list((select chain from ids), 2600) r;
grant all on l2 to authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.market_buy((select (r ->> 'id')::bigint from l2), false)$$, 'confirm_big'), 'over C$2,500: are you sure?');
select pg_temp.as_(1);
select 1 from public.market_cancel((select (r ->> 'id')::bigint from l2));
select pg_temp.assert(pg_temp.lock((select chain from ids)) is null, 'cancelled: unlocked');

-- The per-sku weekly limit (1 for this test), and its flag.
reset role; select pg_temp.setting('{perSkuWeek}', '1'); set role authenticated;
select pg_temp.as_(1);
create temp table l3 as select public.market_list((select sneakers from ids), 460) r;
grant all on l3 to authenticated;
select pg_temp.as_(2);
select 1 from public.market_buy((select (r ->> 'id')::bigint from l3), false);
reset role;
select pg_temp.assert(pg_temp.flags('sku_limit') = 1, 'Bo hit the limit for sneakers: flagged');
delete from public.player_items where id = (select sneakers from ids);
update public.players set economy_open = true where id in (pg_temp.id(2), pg_temp.id(3));
set role authenticated;
select pg_temp.as_(3);
create temp table l4 as select public.market_list((select cy_sneakers from ids), 460) r;
grant all on l4 to authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.market_buy((select (r ->> 'id')::bigint from l4), false)$$, 'sku_limit'), 'one pair of sneakers a week');
select pg_temp.as_(3); select 1 from public.market_cancel((select (r ->> 'id')::bigint from l4));
reset role; select pg_temp.setting('{perSkuWeek}', '2'); select pg_temp.reset_limits(); delete from public.economy_flags; set role authenticated;

-- ---------------------------------------------------------------------------
-- Swaps: the trade window
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(2), array[(select island from ids)], array[(select blazer from ids)], 0, 0)$$, 'unbalanced'), 'C$1,400 for C$925 doesn''t balance');
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(2), array[(select island from ids)], array[(select blazer from ids)], 0, 1000)$$, 'too_much_cash'), 'C$ only tops up');
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(7), array[(select island from ids)], array[(select desk from ids)], 0, 0)$$, 'not_visible'), 'no swaps with strangers');
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(2), array[]::bigint[], array[(select blazer from ids)], 0, 0)$$, 'no_items'), 'items on both sides');
create temp table t1 as select public.trade_offer(pg_temp.id(2), array[(select island from ids)], array[(select blazer from ids)], 0, 400) r;
grant all on t1 to authenticated;
select pg_temp.assert((select (r -> 'you' ->> 'ok')::boolean and not (r -> 'them' ->> 'ok')::boolean from t1), 'sending it confirms Ana''s side');
select pg_temp.assert(pg_temp.lock((select island from ids)) like 'trade:%', 'the island is in escrow');
select pg_temp.assert(pg_temp.raises($$select public.market_list((select island from ids), 1400)$$, 'item_locked'), 'can''t be listed while in a swap');
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(2), array[(select chain from ids)], array[(select shelf from ids)], 0, 0)$$, 'trade_open'), 'one window per pair');
-- Bo sees exactly the same contents, and changes them: both confirmations reset, the island comes back.
select pg_temp.as_(2);
select pg_temp.assert((public.market_state() -> 'trades' -> 0 -> 'them' -> 'items' -> 0 ->> 'sku') = 'home-island', 'Bo sees the island on their side');
select 1 from public.trade_edit((select (r ->> 'id')::bigint from t1), 1, array[(select blazer from ids)], array[(select island from ids)], 500, 0);
select pg_temp.assert(pg_temp.lock((select island from ids)) is null, 'a change gives everything back');
select pg_temp.assert(pg_temp.raises($$select public.trade_confirm((select (r ->> 'id')::bigint from t1), 1, false)$$, 'trade_changed'), 'confirm only what''s on screen');
select 1 from public.trade_confirm((select (r ->> 'id')::bigint from t1), 2, false);
select pg_temp.assert(pg_temp.cash(2) = 20000 - 700 - 460 - 500, 'Bo''s C$500 is held');
select pg_temp.assert(pg_temp.lock((select blazer from ids)) like 'trade:%', 'Bo''s blazer is in escrow');
select pg_temp.assert(pg_temp.owner((select island from ids)) = pg_temp.id(1), 'nothing moved yet');
reset role;
select pg_temp.assert(pg_temp.raises($$update public.player_items set player_id = pg_temp.id(3) where id = (select blazer from ids)$$, 'item_locked'), 'escrowed pieces don''t move');
set role authenticated;
-- Ana confirms: everything moves at once.
select pg_temp.as_(1);
select pg_temp.assert((select (x -> 'them' ->> 'ok')::boolean and not (x -> 'you' ->> 'ok')::boolean from (select public.market_state() -> 'trades' -> 0 x) q), 'Ana must confirm again');
create temp table t1d as select public.trade_confirm((select (r ->> 'id')::bigint from t1), 2, false) r;
grant all on t1d to authenticated;
select pg_temp.assert((select r ->> 'status' from t1d) = 'done', 'done');
select pg_temp.assert(pg_temp.owner((select island from ids)) = pg_temp.id(2) and pg_temp.owner((select blazer from ids)) = pg_temp.id(1), 'swapped');
select pg_temp.assert(pg_temp.lock((select island from ids)) is null and pg_temp.lock((select blazer from ids)) is null, 'unlocked');
select pg_temp.assert(pg_temp.cash(1) = 20000 + 665 + 437 + 475, 'Ana got C$500 minus the C$25 fee');
reset role;
select pg_temp.assert((select received_via from public.player_items where id = (select island from ids)) = 'trade', 'received via trade');
select pg_temp.assert((select count(*) from public.economy_log where kind = 'trade' and status = 'done') = 2, 'both sides logged');
set role authenticated;

-- Expiry and declining give everything back.
create temp table t2 as select public.trade_offer(pg_temp.id(2), array[(select chain from ids)], array[(select bed from ids)], 0, 600) r;
grant all on t2 to authenticated;
select pg_temp.as_(2);
select 1 from public.trade_cancel((select (r ->> 'id')::bigint from t2));
select pg_temp.assert(pg_temp.lock((select chain from ids)) is null, 'declined: the chain is back');
-- Bo sends one this time: his bed and C$600 go into escrow when he sends it.
create temp table t3 as select public.trade_offer(pg_temp.id(1), array[(select bed from ids)], array[(select chain from ids)], 600, 0) r;
grant all on t3 to authenticated;
select pg_temp.assert(pg_temp.lock((select bed from ids)) like 'trade:%', 'Bo''s bed is held');
reset role;
update public.market_trades set expires_at = now() - interval '1 minute' where id = (select (r ->> 'id')::bigint from t3);
set role authenticated;
create temp table cash_before as select pg_temp.cash(2) c;
grant all on cash_before to authenticated;
select 1 from public.market_state();
select pg_temp.assert(pg_temp.cash(2) = (select c from cash_before) + 600, 'expired: Bo''s C$600 came back');
select pg_temp.assert(pg_temp.lock((select chain from ids)) is null and pg_temp.lock((select bed from ids)) is null, 'expired: both unlocked');

-- ---------------------------------------------------------------------------
-- Reversal (Studio)
-- ---------------------------------------------------------------------------
select pg_temp.as_(6);
select pg_temp.assert(jsonb_array_length(public.admin_market_recent() -> 'recent') = 3, 'two sales and a swap');
select pg_temp.assert(pg_temp.raises($$select public.admin_market_reverse('trade', (select (r ->> 'id')::bigint from t1), '')$$, 'reason_needed'), 'a reason');
create temp table ab as select pg_temp.cash(1) a, pg_temp.cash(2) b;
grant all on ab to authenticated;
select 1 from public.admin_market_reverse('trade', (select (r ->> 'id')::bigint from t1), 'Bo''s account was stolen');
select pg_temp.assert(pg_temp.owner((select island from ids)) = pg_temp.id(1) and pg_temp.owner((select blazer from ids)) = pg_temp.id(2), 'items went back');
select pg_temp.assert(pg_temp.cash(2) = (select b from ab) + 500 and pg_temp.cash(1) = (select a from ab) - 475, 'C$ went back');
select pg_temp.assert(pg_temp.raises($$select public.admin_market_reverse('trade', (select (r ->> 'id')::bigint from t1), 'again')$$, 'cant_reverse'), 'once');
select 1 from public.admin_market_reverse('sale', (select (r ->> 'id')::bigint from l1), 'Exploit report');
select pg_temp.assert(pg_temp.owner((select tv from ids)) = pg_temp.id(1), 'the TV is Ana''s again');
reset role;
select pg_temp.assert((select count(*) from public.economy_log where status = 'reversed') = 3, 'the notes were released');
select pg_temp.assert((select count(*) from public.admin_actions where action = 'market_reverse') = 2, 'logged');
-- Too old to reverse.
update public.market_listings set sold_at = now() - interval '8 days' where id = (select (r ->> 'id')::bigint from l3);
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.admin_market_reverse('sale', (select (r ->> 'id')::bigint from l3), 'late')$$, 'cant_reverse'), 'outside the 7-day window');

-- ---------------------------------------------------------------------------
-- The trade hold: a new device, an account that played elsewhere before
-- ---------------------------------------------------------------------------
select pg_temp.as_(7);
select set_config('request.jwt.claims', '{"session_id":"sess-fay-1"}', false);
select 1 from public.market_state();
reset role;
select pg_temp.assert(exists (select 1 from public.economy_devices where player_id = pg_temp.id(7) and device = 'session:sess-fay-1'), 'the device was noted');
insert into public.economy_devices (player_id, device, first_seen) values (pg_temp.id(2), 'ua:old', now() - interval '30 days'), (pg_temp.id(2), 'ua:new', now() - interval '1 hour');
set role authenticated;
select set_config('request.jwt.claims', '', false);
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.market_list((select shelf from ids), 210)$$, 'trade_hold'), 'a new device: 72 hours');
select pg_temp.assert((public.market_state() ->> 'hold') is not null, 'the Market says until when');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.trade_offer(pg_temp.id(2), array[(select chain from ids)], array[(select bed from ids)], 0, 600)$$, 'their_trade_hold'), 'nobody can offer them a swap either');
reset role;
delete from public.economy_devices where player_id = pg_temp.id(2);
-- An email change (Supabase Auth's column; the test stub doesn't have it until now).
alter table auth.users add column email_change_sent_at timestamptz;
update auth.users set email_change_sent_at = now() - interval '2 hours' where id = pg_temp.id(7);
set role authenticated;
select pg_temp.as_(7);
select pg_temp.assert(pg_temp.raises($$select public.market_list((select desk from ids), 260)$$, 'trade_hold'), 'an email change: 72 hours');
reset role;
update auth.users set email_change_sent_at = now() - interval '4 days' where id = pg_temp.id(7);
set role authenticated;
select pg_temp.assert((public.market_list((select desk from ids), 260) ->> 'id') is not null, 'and then it lifts');

-- ---------------------------------------------------------------------------
-- Start over hands everything back
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
create temp table l5 as select public.market_list((select chain from ids), 1800) r;
grant all on l5 to authenticated;
reset role;
insert into public.player_restarts (player_id, clout_before, cash_before, home_before) values (pg_temp.id(1), 100, 20000, 'astoria_studio');
select pg_temp.assert((select status from public.market_listings where id = (select (r ->> 'id')::bigint from l5)) = 'cancelled', 'Start over cancels listings');
select pg_temp.assert(pg_temp.lock((select chain from ids)) is null, 'and unlocks them');
delete from public.player_restarts;

-- ---------------------------------------------------------------------------
-- Underworld jobs between players (the server's service role)
-- ---------------------------------------------------------------------------
select pg_temp.reset_limits();
insert into public.underworld (player_id, state) values
  (pg_temp.id(1), jsonb_build_object('v', 1, 'heat', 10, 'earned', 0, 'receipts', '[]'::jsonb,
     'offers', jsonb_build_object('day', public.ny_today()::text, 'ids', jsonb_build_array('job-x', 'job-y', 'job-z'), 'done', '[]'::jsonb))),
  (pg_temp.id(2), jsonb_build_object('v', 1, 'heat', 0, 'earned', 0, 'receipts', '[]'::jsonb,
     'offers', jsonb_build_object('day', public.ny_today()::text, 'ids', '[]'::jsonb, 'done', '[]'::jsonb)));
create temp table cb as select pg_temp.cash(1) a, pg_temp.cash(2) b;
select pg_temp.assert(jsonb_array_length(public.underworld_runners(pg_temp.id(1))) = 1, 'Bo can run for Ana');
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'job-x', 'Knockoff sneakers', '👟', 333)$$, 'bad_cut'), 'the agreed cuts');
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'job-q', 'Nope', null, 250)$$, 'no_offer'), 'only today''s offers');
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(3), 'job-x', 'Knockoff sneakers', null, 250)$$, 'not_friends'), 'only friends');
create temp table h1 as select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'job-x', 'Knockoff sneakers', '👟', 250) r;
select pg_temp.assert(pg_temp.cash(1) = (select a from cb) - 250, 'the cut is in escrow');
select pg_temp.assert((select state -> 'offers' -> 'done' ? 'job-x' from public.underworld where player_id = pg_temp.id(1)), 'Ana handed the job over');
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'job-y', 'Scalped tickets', null, 250)$$, 'hire_limit'), 'one a day');
select pg_temp.assert((public.underworld_hire_get(pg_temp.id(2), (select (r ->> 'id')::bigint from h1)) ->> 'job') = 'job-x', 'Bo sees it');
select pg_temp.assert(public.underworld_hire_get(pg_temp.id(3), (select (r ->> 'id')::bigint from h1)) is null, 'nobody else does');
select 1 from public.underworld_hire_settle((select (r ->> 'id')::bigint from h1), pg_temp.id(2), 'win', 400);
select 1 from public.underworld_hire_settle((select (r ->> 'id')::bigint from h1), pg_temp.id(2), 'win', 400);
select pg_temp.assert(pg_temp.cash(2) = (select b from cb) + 250 - 12, 'Bo got the cut minus 5%, once');
select pg_temp.assert(pg_temp.cash(1) = (select a from cb) - 250 + 400, 'Ana got Pablo''s take');
select pg_temp.assert((select (state ->> 'heat')::int from public.underworld where player_id = pg_temp.id(1)) = 15, 'and Heat');
select pg_temp.assert((select meta ->> 'jobKind' from public.economy_log where kind = 'job' and ref = 'hire:' || (select r ->> 'id' from h1)) = 'underworld', 'a player job in the history');
-- Declined: the cut and the offer go back.
select pg_temp.setting('{hire,perDay}', '2');
create temp table h2 as select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'job-y', 'Scalped tickets', '🎟️', 100) r;
select public.underworld_hire_decline(pg_temp.id(2), (select (r ->> 'id')::bigint from h2));
select pg_temp.assert(pg_temp.cash(1) = (select a from cb) - 250 + 400, 'the C$100 came back');
select pg_temp.assert(not (select state -> 'offers' -> 'done' ? 'job-y' from public.underworld where player_id = pg_temp.id(1)), 'and the job is Ana''s to do again');
-- Phase off: no hires either.
update public.game_settings set value = jsonb_set(value, '{phases,marketplace}', 'false') where key = 'player_economy';
select pg_temp.assert(pg_temp.raises($$select public.underworld_hire_post(pg_temp.id(1), pg_temp.id(2), 'job-z', 'A rigged contest', null, 100)$$, 'phase_off'), 'phase 2 off: no runners');

rollback;
