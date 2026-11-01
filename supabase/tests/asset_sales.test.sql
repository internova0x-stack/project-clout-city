-- Scenario test for migration 0153 (the Player Economy, Phase 3: business and property sales).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh
-- (ONLY=$PWD/supabase/tests/asset_sales.test.sql npm run test:db).
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
create function pg_temp.p(n int) returns public.players language sql security definer as $$
  select * from public.players where id = pg_temp.id(n) $$;
create function pg_temp.rows(k text, n int) returns bigint language sql security definer as $$
  select count(*) from public.ledger where kind = k and player_id = pg_temp.id(n) $$;
create function pg_temp.sum_(k text, n int) returns bigint language sql security definer as $$
  select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = pg_temp.id(n) and currency = 'cash' $$;
create function pg_temp.owns_biz(n int, b text) returns boolean language sql security definer as $$
  select exists (select 1 from public.player_businesses where player_id = pg_temp.id(n) and business_id = b) $$;
create function pg_temp.sale(i bigint) returns public.asset_sales language sql security definer as $$
  select * from public.asset_sales where id = i $$;
create function pg_temp.log_status(i bigint) returns text language sql security definer as $$
  select e.status from public.economy_log e where e.kind = 'asset' and e.ref = 'asset:' || i $$;
create function pg_temp.week(n int, col text) returns bigint language plpgsql security definer as $$
declare v bigint;
begin
  execute format('select coalesce((select %I from public.economy_limits where player_id = $1 and week = public.ny_week()), 0)', col)
    into v using pg_temp.id(n);
  return v;
end $$;
create function pg_temp.flags(r text, i bigint) returns bigint language sql security definer as $$
  select count(*) from public.economy_flags where rule = r and ref = 'asset:' || i $$;
-- The cooling-off is over (24 real hours, fast-forwarded).
create function pg_temp.cool(i bigint) returns void language sql security definer as $$
  update public.asset_sales set cooling_until = now() - interval '1 second' where id = i $$;
create function pg_temp.phase(on_ boolean) returns void language sql security definer as $$
  update public.game_settings set value = jsonb_set(value, '{phases,assets}', to_jsonb(on_)) where key = 'player_economy' $$;

-- Ana (1) sells, Bo (2) is her crew, Cy (3) is a stranger, Dee (4) is crew with an account 10 days old, Eve (6) is a Studio admin.
insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 6) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('anaaa', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('boboo', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('cyyyy', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(4); select 1 from public.create_player('deeee', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set created_at = now() - interval '40 days', bank_cash = 20000, clout = 100, best_rank = 2, energy = 100
 where id in (pg_temp.id(1), pg_temp.id(2), pg_temp.id(3));
update public.players set created_at = now() - interval '10 days', bank_cash = 300000, clout = 100, best_rank = 2 where id = pg_temp.id(4);
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.id(1), pg_temp.id(2), 'ana-bo'), (pg_temp.id(1), pg_temp.id(4), 'ana-dee');
insert into public.story_admins (user_id) values (pg_temp.id(6));
-- Big weekly caps for this test (the cap itself is the core's, tested in player_economy.test.sql).
update public.game_settings set value = jsonb_set(value, '{weeklyCap,min}', '1000000') where key = 'player_economy';
-- Ana's hot dog cart (one upgrade) and bodega, bought 20 days ago, tills just emptied; and a townhouse she got yesterday.
insert into public.player_businesses (player_id, business_id, level, bought_at, collected_at) values
  (pg_temp.id(1), 'hot-dog-cart', 1, public.game_now() - interval '20 days', public.game_now()),
  (pg_temp.id(1), 'bodega', 0, public.game_now() - interval '20 days', public.game_now());
insert into public.player_items (player_id, sku, category, value, created_at) values (pg_temp.id(1), 'house-astoria-townhouse', 'houses', 270000, now() - interval '1 day');
update public.players set house_sku = 'house-astoria-townhouse', next_rent_due = null where id = pg_temp.id(1);
set role authenticated;

-- ---------------------------------------------------------------------------
-- Internals stay internal
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_settle(1)$$, 'permission denied'), 'asset_sale_settle is internal');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_close(1, 'cancelled', null, null)$$, 'permission denied'), 'asset_sale_close is internal');
select pg_temp.assert(pg_temp.raises($$select public.asset_appraisal('business', 'bodega', pg_temp.id(1))$$, 'permission denied'), 'asset_appraisal is internal');
select pg_temp.assert(pg_temp.raises($$select public.asset_sales_settle_all()$$, 'permission denied'), 'the sweep is for the sender');
select pg_temp.assert(pg_temp.raises($$select public.asset_block('business', 'bodega', pg_temp.id(1), null)$$, 'permission denied'), 'asset_block is internal');
select pg_temp.assert(pg_temp.raises($$select * from public.asset_sales$$, 'permission denied'), 'no direct reads of sales');
select pg_temp.assert(pg_temp.raises($$select public.admin_asset_sales()$$, 'admin'), 'the Studio is for admins');

-- ---------------------------------------------------------------------------
-- The assets switch starts off: everything refuses
-- ---------------------------------------------------------------------------
select pg_temp.assert(pg_temp.raises($$select public.asset_appraise('business', 'hot-dog-cart')$$, 'phase_off'), 'appraisal: phase off');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(2), 7000)$$, 'phase_off'), 'offer: phase off');
select pg_temp.assert(pg_temp.raises($$select public.asset_sales_state()$$, 'phase_off'), 'state: phase off');
select pg_temp.assert(pg_temp.raises($$select public.asset_buyers()$$, 'phase_off'), 'buyers: phase off');
reset role;
select pg_temp.phase(true);
set role authenticated;

-- ---------------------------------------------------------------------------
-- Appraisal and the band
-- ---------------------------------------------------------------------------
-- Hot dog cart, 1 upgrade: book 7,500 (0.6), put in 5,000 + 3,000 (0.2), a week of 1,125 a day (0.2) = 7,675.
select pg_temp.assert((public.asset_appraise('business', 'hot-dog-cart') ->> 'appraisal')::bigint = 7675, 'business appraisal');
select pg_temp.assert(public.asset_appraise('business', 'hot-dog-cart') -> 'band' = '{"min": 3838, "max": 11512}'::jsonb, 'band 50% to 150%');
select pg_temp.assert((public.asset_appraise('house', 'house-astoria-townhouse') ->> 'appraisal')::bigint = 270000, 'house appraisal: Shop price, Astoria ×1');
select pg_temp.assert(public.asset_appraise('house', 'house-astoria-townhouse') ->> 'block' = 'too_soon', 'owned a day: not yet');
select pg_temp.assert(pg_temp.raises($$select public.asset_appraise('business', 'laundromat')$$, 'not_owned'), 'only your own');
select pg_temp.assert(jsonb_array_length(public.asset_sales_state() -> 'assets') = 3, 'two businesses and a house');
select pg_temp.assert(jsonb_array_length(public.asset_buyers()) = 2, 'Bo and Dee');

select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('house', 'house-astoria-townhouse', pg_temp.id(2), 270000)$$, 'too_soon'), 'minimum ownership');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(2), 20000)$$, 'out_of_band'), 'over 150%');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(2), 3000)$$, 'out_of_band'), 'under 50%');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(3), 7000)$$, 'not_friends'), 'friends only');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'bodega', pg_temp.id(2), 48000)$$, 'business_locked'), 'buyers keep the ladder');
reset role;
select pg_temp.assert(not exists (select 1 from public.asset_sales), 'nothing stored by refused offers');
set role authenticated;

-- ---------------------------------------------------------------------------
-- Offer, escrow, and a cancel during the cooling-off
-- ---------------------------------------------------------------------------
create temp table s1 as select (public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(2), 8000) ->> 'id')::bigint id;
grant all on s1 to authenticated;
select pg_temp.assert((pg_temp.sale((select id from s1))).status = 'offered', 'offered');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(4), 8000)$$, 'sale_live'), 'one deal per asset');
select pg_temp.assert((pg_temp.p(2)).bank_cash = 20000, 'nothing moves on an offer');
select pg_temp.as_(3);
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_answer((select id from s1), true)$$, 'sale_gone'), 'only the buyer answers');
select pg_temp.as_(2);
select pg_temp.assert(public.asset_sales_state() -> 'sales' -> 0 ->> 'role' = 'buyer', 'Bo sees the offer');
select pg_temp.assert(not (public.asset_sales_state() -> 'sales' -> 0 ->> 'issues')::boolean, 'no traces, no warning');
select 1 from public.asset_sale_answer((select id from s1), true);
select pg_temp.assert((pg_temp.sale((select id from s1))).status = 'cooling', 'cooling-off');
select pg_temp.assert((pg_temp.sale((select id from s1))).cooling_until between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute', '24 hours');
select pg_temp.assert((pg_temp.p(2)).bank_cash = 12000 and pg_temp.sum_('asset_hold', 2) = -8000, 'the price in escrow');
select pg_temp.assert(pg_temp.week(2, 'sent') = 8000 and pg_temp.week(1, 'received') = 8000, 'counted in both weeks');
select pg_temp.assert(pg_temp.log_status((select id from s1)) = 'done', 'logged');
-- Not before the cooling-off is over.
reset role;
select pg_temp.assert(public.asset_sales_settle_all() = 0, 'nothing due yet');
set role authenticated;
select pg_temp.assert(pg_temp.owns_biz(1, 'hot-dog-cart'), 'still Ana''s');
select 1 from public.asset_sale_cancel((select id from s1));
select pg_temp.assert((pg_temp.sale((select id from s1))).status = 'cancelled', 'cancelled');
select pg_temp.assert((pg_temp.p(2)).bank_cash = 20000 and pg_temp.sum_('asset_refund', 2) = 8000, 'escrow back');
select pg_temp.assert(pg_temp.log_status((select id from s1)) = 'reversed' and pg_temp.week(2, 'sent') = 0 and pg_temp.week(1, 'received') = 0, 'released');
select pg_temp.assert(pg_temp.owns_biz(1, 'hot-dog-cart') and not pg_temp.owns_biz(2, 'hot-dog-cart'), 'nothing changed hands');

-- ---------------------------------------------------------------------------
-- The handover: atomic, with the 10% fee
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
create temp table s2 as select (public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(2), 7000) ->> 'id')::bigint id;
grant all on s2 to authenticated;
select pg_temp.as_(2);
select 1 from public.asset_sale_answer((select id from s2), true);
reset role;
select pg_temp.cool((select id from s2));
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.asset_sales_state() -> 'sales') x
                              where (x ->> 'id')::bigint = (select id from s2) and x ->> 'status' = 'done'), 'settled on read');
select pg_temp.assert(pg_temp.owns_biz(2, 'hot-dog-cart') and not pg_temp.owns_biz(1, 'hot-dog-cart'), 'the cart is Bo''s');
reset role;
select pg_temp.assert((select level = 1 and acquired_price = 7000 and acquired_level = 1 from public.player_businesses
                        where player_id = pg_temp.id(2) and business_id = 'hot-dog-cart'), 'with its upgrade, at the price paid');
set role authenticated;
select pg_temp.assert((pg_temp.p(1)).bank_cash = 20000 + 7000 - 700, 'Ana got C$6,300 after the 10% fee');
select pg_temp.assert(pg_temp.sum_('asset_sale', 1) = 7000 and pg_temp.sum_('economy_fee', 1) = -700, 'ledger: the sale and the city''s cut');
select pg_temp.assert((pg_temp.p(2)).bank_cash = 13000, 'Bo paid C$7,000');
select pg_temp.assert(public.economy_history() -> 0 ->> 'kind' = 'asset' and public.economy_history() -> 0 ->> 'direction' = 'received', 'in Ana''s history');
select pg_temp.as_(2);
select pg_temp.assert(public.economy_history() -> 0 ->> 'kind' = 'asset' and public.economy_history() -> 0 ->> 'direction' = 'sent', 'in Bo''s history');
-- Bo's appraisal now counts what he paid: book 7,500 × 0.6 + 7,000 × 0.2 + 7,875 × 0.2 = 7,475.
select pg_temp.assert((public.asset_appraise('business', 'hot-dog-cart') ->> 'appraisal')::bigint = 7475, 'appraised on the price paid');
-- 14 days before he can flip it.
select pg_temp.assert(public.asset_appraise('business', 'hot-dog-cart') ->> 'block' = 'too_soon', 'minimum ownership after a sale');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'hot-dog-cart', pg_temp.id(1), 7000)$$, 'too_soon'), 'no quick flips');

-- ---------------------------------------------------------------------------
-- The monthly limit (both sides; a cancelled yes counts too)
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert((public.asset_sales_state() ->> 'used')::int = 2, 'two this month');
select pg_temp.assert(pg_temp.raises($$select public.asset_sale_offer('business', 'bodega', pg_temp.id(2), 48000)$$, 'sales_limit'), 'two a month');
reset role;
update public.asset_sales set accepted_at = accepted_at - interval '40 days';
set role authenticated;

-- ---------------------------------------------------------------------------
-- Flags: the band's edge, a new account buying
-- ---------------------------------------------------------------------------
-- Bodega: book 50,000 × 0.6 + 50,000 × 0.2 + 42,000 × 0.2 = 48,400; the top of the band is 72,600.
create temp table s3 as select (public.asset_sale_offer('business', 'bodega', pg_temp.id(2), 72600) ->> 'id')::bigint id;
grant all on s3 to authenticated;
select pg_temp.assert(pg_temp.flags('band_edge', (select id from s3)) = 1, 'flagged at the band''s edge');
select 1 from public.asset_sale_cancel((select id from s3));
select pg_temp.assert((pg_temp.sale((select id from s3))).status = 'cancelled', 'withdrawn');

reset role;
update public.player_items set created_at = now() - interval '20 days' where sku = 'house-astoria-townhouse';
set role authenticated;
create temp table s4 as select (public.asset_sale_offer('house', 'house-astoria-townhouse', pg_temp.id(4), 270000) ->> 'id')::bigint id;
grant all on s4 to authenticated;
select pg_temp.as_(4);
select 1 from public.asset_sale_answer((select id from s4), true);
select pg_temp.assert(pg_temp.flags('asset_new_buyer', (select id from s4)) = 1, 'a 10-day-old account buying a house');
reset role;
select pg_temp.cool((select id from s4));
select pg_temp.assert(public.asset_sales_settle_all() = 1, 'the sender''s sweep hands it over');
select pg_temp.assert((pg_temp.p(4)).house_sku = 'house-astoria-townhouse' and (pg_temp.p(4)).next_rent_due is null, 'Dee owns it, no rent');
select pg_temp.assert((pg_temp.p(1)).house_sku is null and (pg_temp.p(1)).next_rent_due is not null, 'Ana rents again');
select pg_temp.assert((select received_via = 'asset' and no_resale_until > now() + interval '13 days' from public.player_items where sku = 'house-astoria-townhouse' and player_id = pg_temp.id(4)), 'held 14 days');
select pg_temp.assert((pg_temp.p(1)).bank_cash = 26300 + 243000, 'Ana got C$243,000');
select pg_temp.assert((pg_temp.p(4)).bank_cash = 30000, 'Dee paid C$270,000');

-- ---------------------------------------------------------------------------
-- Studio: the list and a reversal within 7 days
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.admin_asset_reverse((select id from s4), 'nope')$$, 'admin'), 'players can''t reverse');
select pg_temp.as_(6);
select pg_temp.assert((select bool_or((x ->> 'canReverse')::boolean) from jsonb_array_elements(public.admin_asset_sales() -> 'sales') x where (x ->> 'id')::bigint = (select id from s4)), 'reversible');
select pg_temp.assert((select x -> 'flags' ? 'asset_new_buyer' from jsonb_array_elements(public.admin_asset_sales() -> 'sales') x where (x ->> 'id')::bigint = (select id from s4)), 'its flag shows');
select 1 from public.admin_asset_reverse((select id from s4), 'Alt account, confirmed');
select pg_temp.assert((pg_temp.sale((select id from s4))).status = 'reversed', 'reversed');
select pg_temp.assert((pg_temp.p(1)).house_sku = 'house-astoria-townhouse' and (pg_temp.p(4)).house_sku is null, 'the house went back');
select pg_temp.assert((pg_temp.p(4)).bank_cash = 300000 and (pg_temp.p(1)).bank_cash = 26300, 'and the C$');
select pg_temp.assert(pg_temp.log_status((select id from s4)) = 'reversed', 'released in the log');
reset role;
select pg_temp.assert((select count(*) from public.admin_actions where action = 'asset_reverse') = 2, 'logged for both');
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.admin_asset_reverse((select id from s4), 'again')$$, 'cant_reverse'), 'once');
-- Past the window: not reversible.
reset role;
update public.asset_sales set settled_at = now() - interval '8 days' where id = (select id from s2);
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.admin_asset_reverse((select id from s2), 'late')$$, 'cant_reverse'), 'only within 7 days');

-- ---------------------------------------------------------------------------
-- A public company isn't sold privately; switched off mid-deal, the deal can still be cancelled
-- ---------------------------------------------------------------------------
reset role;
update public.player_businesses set went_public = true where player_id = pg_temp.id(1) and business_id = 'bodega';
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(public.asset_appraise('business', 'bodega') ->> 'block' = 'went_public', 'public: not for private sale');
reset role;
update public.player_businesses set went_public = false where player_id = pg_temp.id(1) and business_id = 'bodega';
set role authenticated;
create temp table s5 as select (public.asset_sale_offer('business', 'bodega', pg_temp.id(2), 48000) ->> 'id')::bigint id;
grant all on s5 to authenticated;
reset role;
select pg_temp.phase(false);
set role authenticated;
select pg_temp.assert(not (public.asset_sales_state() ->> 'on')::boolean, 'off, but the live deal shows');
select pg_temp.assert(pg_temp.raises($$select public.asset_appraise('business', 'bodega')$$, 'phase_off'), 'no new appraisals');
select 1 from public.asset_sale_cancel((select id from s5));
select pg_temp.assert((pg_temp.sale((select id from s5))).status = 'cancelled', 'cancel works while off');

-- Buying a business from the game a second time keeps its ledger row (a suffixed ref).
reset role;
delete from public.player_businesses where player_id = pg_temp.id(2) and business_id = 'hot-dog-cart';
insert into public.ledger (player_id, currency, amount, kind, ref) values (pg_temp.id(2), 'cash', -5000, 'business_buy', 'hot-dog-cart');
set role authenticated;
select pg_temp.as_(2);
select 1 from public.buy_business('hot-dog-cart');
select pg_temp.assert(pg_temp.rows('business_buy', 2) = 2, 'a second purchase, a second row');

rollback;
\echo 'asset_sales: ok'
