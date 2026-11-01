-- Scenario test for migration 0151 (the Player Economy: the shared core, gifting and the Jobs board upgrades).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh
-- (ONLY=$PWD/supabase/tests/player_economy.test.sql npm run test:db).
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
create function pg_temp.worth(n int) returns bigint language sql security definer as $$ select public.net_worth(pg_temp.id(n)) $$;
create function pg_temp.rows(k text, n int) returns bigint language sql security definer as $$
  select count(*) from public.ledger where kind = k and player_id = pg_temp.id(n) $$;
create function pg_temp.owns(n int, s text) returns boolean language sql security definer as $$
  select exists (select 1 from public.player_items where player_id = pg_temp.id(n) and sku = s) $$;
create function pg_temp.flags(r text) returns bigint language sql security definer as $$
  select count(*) from public.economy_flags where rule = r $$;
create function pg_temp.reset_limits() returns void language sql security definer as $$ delete from public.economy_limits $$;
create function pg_temp.an_event() returns text language sql security definer as $$
  select e ->> 'id' from jsonb_array_elements(public.city() -> 'events') e order by e ->> 'id' limit 1 $$;

-- A check-in (what any activity at a place writes) and attending an event, standing there, as the superuser.
create function pg_temp.checkin(n int, place text) returns void language plpgsql security definer as $$
begin
  update public.players set at_place = place, arrives_at = null, seen_at = now() where id = pg_temp.id(n);
  insert into public.place_visits (player_id, place_id, ny_date) values (pg_temp.id(n), place, public.ny_today())
  on conflict (player_id, place_id, ny_date) do update set visits = place_visits.visits + 1;
end $$;
create function pg_temp.attend(n int, ev text, day date) returns void language plpgsql security definer as $$
begin
  update public.players set at_place = (select e ->> 'placeId' from jsonb_array_elements(public.city() -> 'events') e where e ->> 'id' = ev),
         arrives_at = null where id = pg_temp.id(n);
  insert into public.event_attendance (player_id, event_id, ny_date) values (pg_temp.id(n), ev, day);
end $$;

-- Ana (1) gives, Bo (2) is her crew, Cy (3) is a stranger, newbie (4) joined today, Dee (5) is crew but Rank 1,
-- Eve (6) is a Studio admin, Fay (7) is a stranger who opts in to the open board.
insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 7) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('anaaa', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('boboo', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('cyyyy', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(4); select 1 from public.create_player('newbie', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(5); select 1 from public.create_player('deeee', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(7); select 1 from public.create_player('fayyy', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set created_at = now() - interval '8 days', bank_cash = 20000, clout = 100, energy = 100
 where id in (pg_temp.id(1), pg_temp.id(2), pg_temp.id(3), pg_temp.id(7));
update public.players set created_at = now() - interval '8 days', bank_cash = 10000, clout = 0 where id = pg_temp.id(5);
update public.players set bank_cash = 10000, clout = 100 where id = pg_temp.id(4);
insert into public.invites (inviter_id, invitee_id, invite_code) values
  (pg_temp.id(1), pg_temp.id(2), 'ana-bo'), (pg_temp.id(1), pg_temp.id(5), 'ana-dee'), (pg_temp.id(1), pg_temp.id(4), 'ana-new');
insert into public.story_admins (user_id) values (pg_temp.id(6));
set role authenticated;

-- ---------------------------------------------------------------------------
-- The core stays internal
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.economy_can(pg_temp.id(1), 'gift', 1, 'send')$$, 'permission denied'), 'economy_can is internal');
select pg_temp.assert(pg_temp.raises($$select public.economy_note('gift', 'x', pg_temp.id(1), pg_temp.id(2), 1, 0, null, false, '{}')$$, 'permission denied'), 'economy_note is internal');
select pg_temp.assert(pg_temp.raises($$select public.economy_pay(pg_temp.id(1), 1000, 0, 'job_pay', 'x')$$, 'permission denied'), 'economy_pay is internal');
select pg_temp.assert(pg_temp.raises($$select public.economy_hold(pg_temp.id(2), 1000, 'job_hold', 'x')$$, 'permission denied'), 'economy_hold is internal');
select pg_temp.assert(pg_temp.raises($$select public.economy_flag('x', array[pg_temp.id(1)], 'x', '{}')$$, 'permission denied'), 'economy_flag is internal');
select pg_temp.assert(pg_temp.raises($$select public.gift_settle(1, true, 'declined')$$, 'permission denied'), 'gift_settle is internal');
select pg_temp.assert(pg_temp.raises($$select public.job_pay_out(1)$$, 'permission denied'), 'job_pay_out is internal');
select pg_temp.assert(pg_temp.raises($$select public.economy_release(1)$$, 'permission denied'), 'economy_release is internal');
select pg_temp.assert(pg_temp.raises($$select * from public.economy_limits$$, 'permission denied'), 'no direct reads of the limits');
select pg_temp.assert(pg_temp.raises($$select * from public.gifts$$, 'permission denied'), 'no direct reads of gifts');
select pg_temp.assert(pg_temp.raises($$select public.admin_economy()$$, 'admin'), 'the Studio is for admins');

-- ---------------------------------------------------------------------------
-- Unlock to send: 3 days and Rank 2 (receiving needs only a home)
-- ---------------------------------------------------------------------------
select pg_temp.assert((public.economy_state() ->> 'unlocked')::boolean, 'Ana is unlocked');
select pg_temp.as_(4);
select pg_temp.assert(public.economy_state() ->> 'reason' = 'too_new', 'newbie is too new');
select pg_temp.as_(5);
select pg_temp.assert(public.economy_state() ->> 'reason' = 'economy_locked', 'Dee is Rank 1');

-- ---------------------------------------------------------------------------
-- Gifting
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(jsonb_array_length(public.gift_candidates()) = 3, 'crew: Bo, Dee and newbie');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(3), 'home-tv', null)$$, 'not_friends'), 'strangers get no gifts');
-- Owner, Nov 1: receiving needs only a home; sending waits for 3 days and Rank 2.
select pg_temp.assert((select bool_and((x ->> 'canReceive')::boolean) from jsonb_array_elements(public.gift_candidates()) x), 'new and Rank 1 players can receive');
select pg_temp.as_(4);
select pg_temp.assert(pg_temp.raises(format($$select public.gift_send(%L, 'home-tv', null)$$, pg_temp.id(1)), 'too_new'), 'too new to send');
select pg_temp.as_(5);
select pg_temp.assert(pg_temp.raises(format($$select public.gift_send(%L, 'home-tv', null)$$, pg_temp.id(1)), 'economy_locked'), 'Rank 1 can''t send');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'col-holo-boots', null)$$, 'not_giftable'), 'never real-money pieces');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'home-streak-lava-lamp', null)$$, 'not_giftable'), 'never streak rewards');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'house-astoria-townhouse', null)$$, 'not_giftable'), 'never houses');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'car-hatchback', null)$$, 'not_giftable'), 'never cars');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'lux-diamond-studs', null)$$, 'weekly_limit'), 'C$6,000 is over the C$5,000 week');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'home-tv', repeat('x', 141))$$, 'message_too_long'), '140 characters at most');

create temp table g1 as select public.gift_send(pg_temp.id(2), 'home-island', 'For the kitchen you swear you''ll use') r;
grant all on g1 to authenticated;
select pg_temp.assert((pg_temp.p(1)).bank_cash = 20000 - 1400, 'Ana paid the Shop price, no fee on gifts');
select pg_temp.assert(pg_temp.rows('gift_send', 1) = 1, 'a ledger row');
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'home-island', null)$$, 'they_own_it'), 'one of each');
select pg_temp.assert((public.economy_state() -> 'week' ->> 'sent')::int = 1400 and (public.economy_state() -> 'week' ->> 'giftsLeft')::int = 4, 'counted in Ana''s week');

select pg_temp.as_(2);
select pg_temp.assert((public.gift_inbox() -> 'incoming' -> 0 ->> 'fromName') = 'anaaa', 'Bo sees it');
select pg_temp.assert(pg_temp.raises($$select public.gift_answer((select (r ->> 'id')::bigint from g1) + 999, true)$$, 'gift_gone'), 'only real gifts');
select 1 from public.gift_answer((select (r ->> 'id')::bigint from g1), true);
select pg_temp.assert(pg_temp.owns(2, 'home-island') and not pg_temp.owns(1, 'home-island'), 'Bo has it, Ana doesn''t');
-- No resale for 14 days: not back to the game at 60%.
select pg_temp.assert(pg_temp.raises($$select public.sell_item((select id from public.player_items where sku = 'home-island'))$$, 'no_resale'), 'gifts can''t be sold back yet');
reset role;
select pg_temp.assert(not public.economy_item_tradable((select id from public.player_items where player_id = pg_temp.id(2) and sku = 'home-island')), 'not tradable while held');
select pg_temp.assert((select count(*) from public.choice_headlines where kind = 'win' and text like '%gave @boboo%') = 1, 'Lola saw a C$1,400 gift');
set role authenticated;
select pg_temp.assert(jsonb_array_length(public.economy_history()) = 1 and public.economy_history() -> 0 ->> 'direction' = 'received', 'Bo''s history');

-- Declined: the item goes to the giver.
select pg_temp.as_(1);
create temp table g2 as select public.gift_send(pg_temp.id(2), 'fit-chunky-sneakers', null) r;
grant all on g2 to authenticated;
select pg_temp.as_(2);
select 1 from public.gift_answer((select (r ->> 'id')::bigint from g2), false);
select pg_temp.assert(pg_temp.owns(1, 'fit-chunky-sneakers') and not pg_temp.owns(2, 'fit-chunky-sneakers'), 'Ana got the sneakers back');
select pg_temp.as_(1);
select pg_temp.assert((public.economy_state() -> 'week' ->> 'sent')::int = 1400, 'a declined gift isn''t counted');
-- Declined when the giver already owns one: the money comes back.
create temp table g3 as select public.gift_send(pg_temp.id(2), 'fit-chunky-sneakers', null) r;
grant all on g3 to authenticated;
select pg_temp.as_(2);
select 1 from public.gift_answer((select (r ->> 'id')::bigint from g3), false);
select pg_temp.assert(pg_temp.rows('gift_refund', 1) = 1, 'refunded instead');
-- Expired after 7 days: back to the giver.
select pg_temp.as_(1);
create temp table g4 as select public.gift_send(pg_temp.id(2), 'home-tv', null) r;
grant all on g4 to authenticated;
reset role;
update public.gifts set created_at = now() - interval '8 days' where id = (select (r ->> 'id')::bigint from g4);
set role authenticated;
select 1 from public.gift_inbox();
select pg_temp.assert(pg_temp.owns(1, 'home-tv'), 'expired gifts go home');
-- Five a week (declined and expired ones count).
create temp table g5 as select public.gift_send(pg_temp.id(2), 'art-golden-hour-7', null) r;
grant all on g5 to authenticated;
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'home-plant', null)$$, 'gift_limit'), 'five gifts a week');

-- The repeat-pair flag: a third gift that stays given, in a new week's count.
reset role;
select pg_temp.assert(pg_temp.flags('repeat_pair') = 0, 'declined and expired gifts aren''t transfers');
select pg_temp.reset_limits();
set role authenticated;
create temp table g6 as select public.gift_send(pg_temp.id(2), 'home-plant', null) r;
grant all on g6 to authenticated;
reset role;
select pg_temp.assert(pg_temp.flags('repeat_pair') = 1, 'Ana sent Bo three things this week');
set role authenticated;

-- Caps for the recipient.
reset role;
select pg_temp.reset_limits();
insert into public.economy_limits (player_id, week, received) values (pg_temp.id(2), public.ny_week(), 4900);
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'set-ranch-hand', null)$$, 'their_weekly_limit'), 'Bo''s week is full');

-- ---------------------------------------------------------------------------
-- Studio: phases, flags, freezing
-- ---------------------------------------------------------------------------
select pg_temp.as_(6);
select pg_temp.assert(jsonb_array_length(public.admin_economy() -> 'flags') >= 1, 'the review queue');
select 1 from public.admin_economy_set('gifting', false);
select pg_temp.as_(1);
reset role; select pg_temp.reset_limits(); set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'home-plant', null)$$, 'phase_off'), 'phase 1 off: no gifts');
select pg_temp.assert(pg_temp.raises($$select public.post_task('errand', 500, '{"places":["velvet-static","grind-and-gossip"]}', 24, null)$$, 'phase_off'), 'and no jobs');
select pg_temp.as_(6);
select 1 from public.admin_economy_set('gifting', true);
select pg_temp.assert(not (public.admin_economy() -> 'settings' -> 'phases' ->> 'marketplace')::boolean, 'phase 2 stays off');
select 1 from public.admin_economy_flag((select (f ->> 'id')::bigint from jsonb_array_elements(public.admin_economy() -> 'flags') f where f ->> 'rule' = 'repeat_pair'), 'frozen', 'Looks like a funnel');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.gift_send(pg_temp.id(2), 'home-plant', null)$$, 'economy_frozen'), 'frozen: no gifts');
select pg_temp.as_(6);
select pg_temp.assert(jsonb_array_length(public.admin_economy() -> 'frozen') = 2, 'both frozen');
select 1 from public.admin_economy_freeze(pg_temp.id(1), false, 'Talked it out');
select 1 from public.admin_economy_freeze(pg_temp.id(2), false, null);
reset role;
select pg_temp.assert((select count(*) from public.admin_actions where action in ('economy_freeze', 'economy_unfreeze')) = 4, 'logged');
select pg_temp.assert((select status = 'reviewed' and outcome = 'frozen' from public.economy_flags where rule = 'repeat_pair'), 'reviewed');
delete from public.economy_flags;
select pg_temp.reset_limits();
set role authenticated;

-- ---------------------------------------------------------------------------
-- Jobs: errands, event support, the fee, visibility, deadlines, ratings
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.post_task('errand', 500, '{"places":["velvet-static"]}', 24, null)$$, 'bad_target'), 'two places at least');
select pg_temp.assert(pg_temp.raises($$select public.post_task('errand', 500, '{"places":["velvet-static","nowhere"]}', 24, null)$$, 'bad_target'), 'real places');
select pg_temp.assert(pg_temp.raises($$select public.post_task('errand', 500, '{"places":["velvet-static","grind-and-gossip"]}', 5, null)$$, 'bad_hours'), '6, 24 or 72 hours');
select pg_temp.assert(pg_temp.raises($$select public.post_task('errand', 50, '{"places":["velvet-static","grind-and-gossip"]}', 24, null)$$, 'bad_pay'), 'C$100 at least');
create temp table e1 as select public.post_task('errand', 1000, '{"places":["velvet-static","grind-and-gossip"]}', 24, 'Pick up my dry cleaning, metaphorically') r;
grant all on e1 to authenticated;
select pg_temp.assert((select (r ->> 'fee')::int = 50 from e1), 'the 5% fee, shown up front');
reset role;
create temp table bank0 as select (pg_temp.p(1)).bank_cash a, (pg_temp.p(2)).bank_cash b;
grant all on bank0 to authenticated;
set role authenticated;
-- Cy isn't a friend and isn't on the open board.
select pg_temp.as_(3);
select pg_temp.assert(jsonb_array_length(public.jobs_board() -> 'open') = 0, 'hidden from strangers');
select pg_temp.assert(pg_temp.raises($$select public.take_job((select (r ->> 'id')::bigint from e1))$$, 'not_friends'), 'and they can''t take it');
select pg_temp.as_(2);
select pg_temp.assert((public.jobs_board() -> 'open' -> 0 ->> 'fee')::int = 50, 'Bo sees it with its fee');
select 1 from public.take_job((select (r ->> 'id')::bigint from e1));
-- Bo checks in at both places (any activity there writes place_visits).
reset role;
select pg_temp.checkin(2, 'velvet-static');
set role authenticated;
select pg_temp.assert((public.job_check((select (r ->> 'id')::bigint from e1)) ->> 'status') = 'active', 'one of two');
reset role;
select pg_temp.checkin(2, 'grind-and-gossip');
set role authenticated;
select pg_temp.assert((pg_temp.p(2)).bank_cash = (select b from bank0) + 950, 'Bo got C$950 after the fee');
select pg_temp.assert((pg_temp.p(2)).clout = 110, 'and 10 clout');
select pg_temp.assert(pg_temp.rows('economy_fee', 2) = 1 and pg_temp.rows('job_pay', 2) = 2, 'the fee row and the pay rows');
reset role;
select pg_temp.assert((select sum(amount) from public.ledger where player_id = pg_temp.id(2) and currency = 'cash' and kind in ('job_pay', 'economy_fee')) = 950,
                      'the ledger adds up to what Bo got');
set role authenticated;
select pg_temp.assert(public.economy_history() -> 0 ->> 'kind' = 'job' and (public.economy_history() -> 0 ->> 'fee')::int = 50, 'in the history');
select 1 from public.rate_client((select (r ->> 'id')::bigint from e1), 4);
select pg_temp.assert(pg_temp.raises($$select public.rate_client((select (r ->> 'id')::bigint from e1), 5)$$, 'unknown_job'), 'once');
select pg_temp.assert((public.job_rating(pg_temp.id(1)) ->> 'clientRating')::numeric = 4, 'Ana is rated as a client');

-- Event support: there during the event (attend_event checks the time), and paid.
select pg_temp.as_(1);
create temp table ev as select public.post_task('event', 400, jsonb_build_object('event', pg_temp.an_event()), 6, null) r;
grant all on ev to authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.take_job((select (r ->> 'id')::bigint from ev))$$, 'pair_limit'), 'one job a day between the same two');
reset role;
update public.jobs set taken_at = taken_at - interval '1 day' where id = (select (r ->> 'id')::bigint from e1);
set role authenticated;
select 1 from public.take_job((select (r ->> 'id')::bigint from ev));
reset role;
select pg_temp.attend(2, pg_temp.an_event(), public.ny_today());
set role authenticated;
select pg_temp.assert((public.jobs_board() -> 'working' -> 0 ->> 'status') = 'kept', 'paid on attendance');

-- The deadline: nobody took it, the pay comes back.
select pg_temp.as_(1);
create temp table late as select public.post_task('errand', 300, '{"places":["velvet-static","lucky-seven-deli"]}', 6, null) r;
grant all on late to authenticated;
reset role;
update public.jobs set deadline = now() - interval '1 minute' where id = (select (r ->> 'id')::bigint from late);
create temp table bank1 as select (pg_temp.p(1)).bank_cash a;
grant all on bank1 to authenticated;
set role authenticated;
select 1 from public.jobs_board();
select pg_temp.assert((pg_temp.p(1)).bank_cash = (select a from bank1) + 300, 'refunded at the deadline');

-- The open board: Fay (a stranger) sees Ana's jobs only once both opted in.
select pg_temp.as_(1);
create temp table open1 as select public.post_task('errand', 200, '{"places":["velvet-static","altitude-718"]}', 24, null) r;
grant all on open1 to authenticated;
select pg_temp.as_(7);
select pg_temp.assert(jsonb_array_length(public.jobs_board() -> 'open') = 0, 'not yet');
select 1 from public.economy_set_open(true);
select pg_temp.as_(1);
select 1 from public.economy_set_open(true);
select pg_temp.as_(7);
select pg_temp.assert(jsonb_array_length(public.jobs_board() -> 'open') = 1, 'both on the open board');

-- Repeated trivial jobs: C$1,000+ a check-in, twice in a week between the same two.
reset role;
delete from public.jobs where poster = pg_temp.id(1) and status = 'open';
update public.jobs set taken_at = taken_at - interval '1 day' where worker = pg_temp.id(2);
select pg_temp.reset_limits();
set role authenticated;
select pg_temp.as_(1);
create temp table t1 as select public.post_task('errand', 2500, '{"places":["velvet-static","grind-and-gossip"]}', 24, null) r;
grant all on t1 to authenticated;
select pg_temp.as_(2);
select 1 from public.take_job((select (r ->> 'id')::bigint from t1));
reset role;
select pg_temp.checkin(2, 'velvet-static');
select pg_temp.checkin(2, 'grind-and-gossip');
update public.jobs set taken_at = taken_at - interval '1 day' where worker = pg_temp.id(2);
set role authenticated;
select pg_temp.assert(pg_temp.flags('trivial_jobs') = 0, 'once is fine');
select pg_temp.as_(1);
create temp table t2 as select public.post_task('errand', 2200, '{"places":["velvet-static","grind-and-gossip"]}', 24, null) r;
grant all on t2 to authenticated;
select pg_temp.as_(2);
select 1 from public.take_job((select (r ->> 'id')::bigint from t2));
reset role;
select pg_temp.checkin(2, 'velvet-static');
select pg_temp.checkin(2, 'grind-and-gossip');
select pg_temp.assert(pg_temp.flags('trivial_jobs') = 1, 'twice is flagged');
select pg_temp.assert(pg_temp.flags('new_heavy') >= 1, 'an 8-day-old account moving C$3,000+ in a week');
-- Weekly cap for jobs too: Bo received C$4,700 this week, so a C$1,000 job from Cy is too much for him.
update public.players set economy_open = true where id in (pg_temp.id(2), pg_temp.id(3));
set role authenticated;
select pg_temp.as_(3);
create temp table t3 as select public.post_task('event', 1000, jsonb_build_object('event', pg_temp.an_event()), 24, null) r;
grant all on t3 to authenticated;
reset role; update public.jobs set taken_at = taken_at - interval '1 day' where worker = pg_temp.id(2); set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.take_job((select (r ->> 'id')::bigint from t3))$$, 'weekly_limit'), 'Bo''s week is nearly full');

-- ---------------------------------------------------------------------------
-- Rank fairness: gifts at Shop value at most; job C$ in net worth only up to C$5,000 a week
-- ---------------------------------------------------------------------------
reset role;
delete from public.jobs where status = 'open';
select pg_temp.reset_limits();
-- A gifted item whose stored value was pushed up (a phase-2 trade at a silly price) still counts at Shop value.
create temp table w0 as select pg_temp.worth(2) w;
update public.player_items set value = 999999 where player_id = pg_temp.id(2) and sku = 'home-island';
select pg_temp.assert(pg_temp.worth(2) = (select w from w0), 'gifts count at Shop value, never above');
-- Bo earns well (C$80,000 in shifts lately), so his weekly cap is C$10,000; he takes two C$5,000 jobs.
insert into public.ledger (player_id, currency, amount, kind, ref) values (pg_temp.id(2), 'cash', 80000, 'shift', 'test:big-earner');
update public.players set bank_cash = bank_cash + (44000 - pg_temp.worth(2)) where id = pg_temp.id(2);
select pg_temp.assert(pg_temp.worth(2) = 44000, 'Bo is worth C$44,000');
select pg_temp.assert(public.economy_cap(pg_temp.id(2)) between 10000 and 11000, 'half his weekly earnings: about C$10,000');
update public.players set bank_cash = 20000 where id = pg_temp.id(3);
update public.jobs set taken_at = taken_at - interval '1 day' where worker = pg_temp.id(2);
set role authenticated;
select pg_temp.as_(1);
create temp table r1 as select public.post_task('errand', 5000, '{"places":["velvet-static","grind-and-gossip","lucky-seven-deli","altitude-718"]}', 24, null) r;
grant all on r1 to authenticated;
select pg_temp.as_(3);
create temp table r2 as select public.post_task('event', 5000, jsonb_build_object('event', pg_temp.an_event()), 24, null) r;
grant all on r2 to authenticated;
select pg_temp.as_(2);
select 1 from public.take_job((select (r ->> 'id')::bigint from r1));
select 1 from public.take_job((select (r ->> 'id')::bigint from r2));
reset role;
select pg_temp.checkin(2, x) from unnest(array['velvet-static', 'grind-and-gossip', 'lucky-seven-deli', 'altitude-718']) x;
select pg_temp.attend(2, pg_temp.an_event(), public.ny_today() + 1);
select pg_temp.assert((select count(*) from public.jobs where id in ((select (r ->> 'id')::bigint from r1), (select (r ->> 'id')::bigint from r2)) and status = 'kept') = 2, 'both paid');
-- C$9,500 landed in his bank (two C$5,000 jobs less the fee), but only C$5,000 of it counts toward net worth.
select pg_temp.assert((select earned = 9500 and uncounted = 4500 from public.economy_limits where player_id = pg_temp.id(2)), 'C$4,500 uncounted');
select pg_temp.assert(pg_temp.worth(2) = 49000, 'net worth C$49,000, not C$53,500');
select pg_temp.assert(public.rank_level((pg_temp.p(2)).clout, pg_temp.worth(2)) = 2, 'still Rank 2: the C$50,000 rung needs real money');
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert((public.business_state() ->> 'bestRank')::int = 2, 'the best rank stays 2');
select pg_temp.assert((public.economy_state() ->> 'uncounted')::int = 4500, 'the player sees what doesn''t count');
-- And Start over forgets it.
reset role;
insert into public.player_restarts (player_id, clout_before, cash_before, home_before) values (pg_temp.id(2), 0, 0, null);
select pg_temp.assert((select uncounted from public.economy_limits where player_id = pg_temp.id(2)) = 0, 'reset on Start over');

rollback;
