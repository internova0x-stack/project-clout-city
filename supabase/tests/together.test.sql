-- Scenario test for migration 0050 (v0.13 Better Together: together bonuses, ride together, jobs).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
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
create function pg_temp.ledger_rows(k text) returns bigint language sql security definer as $$
  select count(*) from public.ledger where kind = k $$;
create function pg_temp.p(n int) returns public.players language sql security definer as $$
  select * from public.players where id = pg_temp.id(n) $$;
-- Puts a player at a place right now, as the superuser.
create function pg_temp.at(n int, place text) returns void language sql security definer as $$
  update public.players set at_place = place, arrives_at = null, seen_at = now() where id = pg_temp.id(n) $$;

insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 4) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('anaaa', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('boboo', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('cyyyy', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(4); select 1 from public.create_player('newbie', 'pilates_princess', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
-- Ana, Bo and Cy joined a week ago; newbie today.
update public.players set created_at = now() - interval '7 days', bank_cash = 10000, energy = 100, confidence = 40, clout = 0
 where id in (pg_temp.id(1), pg_temp.id(2), pg_temp.id(3));
update public.players set bank_cash = 10000, energy = 100 where id = pg_temp.id(4);
set role authenticated;

-- ---------------------------------------------------------------------------
-- Together bonuses
-- ---------------------------------------------------------------------------
select pg_temp.as_(1);
select pg_temp.assert(public.together_action('ditmars-library', 'study'), 'studying counts');
select pg_temp.assert(not public.together_action('triborough-works', 'gigs'), 'the gigs board doesn''t');
select pg_temp.assert(pg_temp.raises($$select public.together_invite(pg_temp.id(2), 'ditmars-library', 'study')$$, 'not_here'), 'not crew and not there: no invite');
select pg_temp.at(2, 'ditmars-library');
select pg_temp.assert(pg_temp.raises($$select public.together_invite(pg_temp.id(2), 'triborough-works', 'gigs')$$, 'not_together'), 'only together activities');
create temp table inv as select (public.together_invite(pg_temp.id(2), 'ditmars-library', 'study') ->> 'id')::bigint id;
grant all on inv to authenticated;
select pg_temp.assert(pg_temp.raises($$select public.together_invite(pg_temp.id(2), 'ditmars-library', 'study')$$, 'already_invited'), 'once a day');
select pg_temp.as_(4);
select pg_temp.assert(pg_temp.raises($$select public.together_invite(pg_temp.id(2), 'ditmars-library', 'study')$$, 'too_new'), 'new accounts can''t invite');

select pg_temp.as_(2);
select pg_temp.assert((public.together_inbox() -> 'plans' -> 0 ->> 'withName') = 'anaaa', 'Bo sees the plan');
select pg_temp.assert((public.together_respond((select id from inv), true) ->> 'status') = 'accepted', 'Bo is in');
select pg_temp.assert(pg_temp.raises($$select public.together_claim((select id from inv))$$, 'not_yet'), 'nobody studied yet');
select 1 from public.do_action('ditmars-library', 'study');
select pg_temp.assert(pg_temp.raises($$select public.together_claim((select id from inv))$$, 'not_yet'), 'Ana hasn''t studied');
select pg_temp.as_(1);
select pg_temp.at(1, 'ditmars-library');
select 1 from public.do_action('ditmars-library', 'study');
create temp table r1 as select public.together_claim((select id from inv)) r;
grant all on r1 to authenticated;
select pg_temp.assert((select (r ->> 'confidenceBase')::int = 5 and (r ->> 'confidence')::int = 3 and (r ->> 'left')::int = 4 from r1), '+3 confidence on top of 5 (×1.5), 4 left');
select pg_temp.assert((select (r ->> 'clout')::int = round((r ->> 'cloutBase')::int * 0.5) and (r ->> 'cloutBase')::int > 0 from r1), 'half the visit clout again');
select pg_temp.assert((pg_temp.p(1)).confidence = 40 + 5 + 3, 'Ana''s confidence');
select pg_temp.assert((pg_temp.p(2)).confidence = 40 + 5 + 3, 'Bo got the same');
select pg_temp.assert(pg_temp.ledger_rows('together') = 2, 'one clout row each');
select pg_temp.assert((public.together_claim((select id from inv)) ->> 'clout')::int = (select (r ->> 'clout')::int from r1), 'claiming twice pays nothing more');
select pg_temp.assert(pg_temp.ledger_rows('together') = 2, 'still one each');
select pg_temp.as_(2);
select pg_temp.assert(jsonb_array_length(public.together_inbox() -> 'bonuses') = 1, 'Bo''s bonus card');
select public.together_seen((select id from inv));
select pg_temp.assert(jsonb_array_length(public.together_inbox() -> 'bonuses') = 0, 'seen once');

-- Too far apart: Cy studies 11 minutes after Ana.
select pg_temp.as_(1);
select pg_temp.at(3, 'ditmars-library');
create temp table inv2 as select (public.together_invite(pg_temp.id(3), 'ditmars-library', 'study') ->> 'id')::bigint id;
grant all on inv2 to authenticated;
select pg_temp.as_(3);
select 1 from public.together_respond((select id from inv2), true);
select 1 from public.do_action('ditmars-library', 'study');
reset role;
update public.action_uses set used_at = now() + interval '11 minutes' where player_id = pg_temp.id(3);
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.together_claim((select id from inv2))$$, 'too_far_apart'), '10 minutes at most');

-- Five a day.
reset role;
update public.action_uses set used_at = now() where player_id = pg_temp.id(3);
-- Ana already has one; four more count her out.
insert into public.together_invites (from_id, to_id, place_id, action_id, ny_date, status)
select pg_temp.id(1), pg_temp.id(2), 'x' || n, 'y', public.ny_today(), 'done' from generate_series(1, 4) n;
insert into public.together_bonuses (invite_id, player_id, ny_date, clout, clout_base, confidence, confidence_base)
select i.id, pg_temp.id(1), public.ny_today(), 0, 0, 0, 0 from public.together_invites i where i.place_id like 'x%';
set role authenticated;
select pg_temp.as_(3);
select pg_temp.assert((select (r ->> 'paid')::boolean from (select public.together_claim((select id from inv2)) r) x), 'Cy gets theirs');
reset role;
select pg_temp.assert((select count(*) from public.together_bonuses where player_id = pg_temp.id(1) and ny_date = public.ny_today()) = 5, 'Ana stays at five');
set role authenticated;

-- ---------------------------------------------------------------------------
-- Ride together
-- ---------------------------------------------------------------------------
select pg_temp.at(1, 'ditmars-library'); select pg_temp.at(2, 'ditmars-library');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.ride_offer(pg_temp.id(2), 'discount-disco', 'walk')$$, 'bad_mode'), 'subway or taxi');
create temp table ride as select public.ride_offer(pg_temp.id(2), 'discount-disco', 'taxi') r;
grant all on ride to authenticated;
select pg_temp.assert((select (r ->> 'each')::int = ceil((r ->> 'fare')::int / 2.0) from ride), 'half each');
select pg_temp.assert(pg_temp.raises($$select public.ride_respond((select (r ->> 'id')::bigint from ride), true)$$, 'unknown_ride'), 'only Bo answers');
select pg_temp.as_(2);
select pg_temp.assert((public.together_inbox() -> 'rides' -> 0 ->> 'fromName') = 'anaaa', 'Bo sees the ride');
create temp table rode as select public.ride_respond((select (r ->> 'id')::bigint from ride), true) r;
grant all on rode to authenticated;
select pg_temp.assert((select r ->> 'status' = 'accepted' from rode), 'they ride');
select pg_temp.assert((pg_temp.p(1)).at_place = 'discount-disco' and (pg_temp.p(2)).at_place = 'discount-disco'
                      and (pg_temp.p(1)).arrives_at = (pg_temp.p(2)).arrives_at, 'arriving together');
select pg_temp.assert((pg_temp.p(1)).bank_cash = 10000 - (select (r ->> 'each')::int from ride)
                      and (pg_temp.p(2)).bank_cash = 10000 - (select (r ->> 'each')::int from ride), 'each paid half');
select pg_temp.assert((public.ride_respond((select (r ->> 'id')::bigint from ride), true) ->> 'status') = 'accepted', 'answering twice moves nobody again');
select pg_temp.as_(1);
select pg_temp.assert((public.ride_status((select (r ->> 'id')::bigint from ride)) ->> 'status') = 'accepted', 'Ana sees it');
-- The exclusive club's door checks both.
select pg_temp.at(1, 'ditmars-library'); select pg_temp.at(2, 'ditmars-library');
create temp table ride2 as select public.ride_offer(pg_temp.id(2), 'ultraviolet-society', 'subway') r;
grant all on ride2 to authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.ride_respond((select (r ->> 'id')::bigint from ride2), true)$$, 'door_clout'), 'the bouncer checks');
-- Expired after three minutes.
reset role;
update public.ride_offers set created_at = now() - interval '4 minutes' where id = (select (r ->> 'id')::bigint from ride2);
set role authenticated;
select pg_temp.assert((public.ride_respond((select (r ->> 'id')::bigint from ride2), true) ->> 'status') = 'gone', 'too late');

-- ---------------------------------------------------------------------------
-- Jobs: the interior decorator
-- ---------------------------------------------------------------------------
reset role;
update public.players set home_layout = '[{"id":"sofa","x":1,"z":1,"rot":0}]', bank_cash = 10000, clout = 0
 where id in (pg_temp.id(1), pg_temp.id(2), pg_temp.id(3));
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.post_job('decorator', 100, null, null)$$, 'bad_pay'), 'C$200 at least');
select pg_temp.assert(pg_temp.raises($$select public.post_job('decorator', 20001, null, null)$$, 'bad_pay'), 'C$20,000 at most');
create temp table job as select (public.post_job('decorator', 2500, null, 'Make it look like I have taste') ->> 'id')::bigint id;
grant all on job to authenticated;
select pg_temp.assert((pg_temp.p(1)).bank_cash = 7500, 'the pay is held');
select pg_temp.assert(pg_temp.raises($$select public.post_job('decorator', 500, null, null)$$, 'already_posted'), 'one at a time');
select pg_temp.assert(pg_temp.raises($$select public.take_job((select id from job))$$, 'own_job'), 'not your own');
select pg_temp.as_(4);
select pg_temp.assert(pg_temp.raises($$select public.take_job((select id from job))$$, 'too_new'), 'new accounts can''t work');
select pg_temp.as_(2);
select pg_temp.assert(jsonb_array_length(public.jobs_board() -> 'open') = 1, 'Bo sees it');
select 1 from public.take_job((select id from job));
select pg_temp.assert((public.job_home((select id from job)) -> 'layout' -> 0 ->> 'id') = 'sofa', 'Bo sees Ana''s home');
select pg_temp.assert(pg_temp.raises($$select public.decorate_save((select id from job), '[{"id":"sofa","x":99,"z":1,"rot":0}]')$$, 'bad_layout'), 'checked like home layouts');
select pg_temp.assert((public.decorate_save((select id from job), '[{"id":"sofa","x":2,"z":1,"rot":1},{"id":"lamp","x":0,"z":0,"rot":0}]') ->> 'moved')::int = 2, 'two pieces moved');
select pg_temp.assert(((pg_temp.p(1)).home_layout -> 0 ->> 'x')::int = 2, 'Ana''s home changed');
select pg_temp.as_(3);
select pg_temp.assert(pg_temp.raises($$select public.decorate_save((select id from job), '[]')$$, 'job_over'), 'only the decorator');
select pg_temp.as_(1);
select pg_temp.assert(pg_temp.raises($$select public.job_settle((select id from job), true, 5)$$, 'not_done'), 'not before they finish');
select pg_temp.as_(2);
select 1 from public.job_finish((select id from job));
select pg_temp.assert(pg_temp.raises($$select public.decorate_save((select id from job), '[]')$$, 'job_over'), 'no edits after');
select pg_temp.as_(1);
select 1 from public.job_settle((select id from job), true, 5);
select pg_temp.assert((pg_temp.p(2)).bank_cash = 12500 and (pg_temp.p(2)).clout = 25, 'Bo is paid C$2,500 and 25 clout');
select pg_temp.assert((public.player_card(pg_temp.id(2)) -> 'jobs' ->> 'rating')::numeric = 5 and (public.player_card(pg_temp.id(2)) -> 'jobs' ->> 'hired')::int = 1, '⭐ 5 · hired once');

-- Undo: every piece back and the pay refunded. Same pair again the same day is too much.
create temp table job2 as select (public.post_job('decorator', 1000, null, null) ->> 'id')::bigint id;
grant all on job2 to authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.take_job((select id from job2))$$, 'pair_limit'), 'one job a day between the same two');
select pg_temp.as_(3);
select 1 from public.take_job((select id from job2));
select 1 from public.decorate_save((select id from job2), '[]');
-- Time runs out: the deadline finishes the job.
reset role;
update public.jobs set taken_at = now() - interval '31 minutes' where id = (select id from job2);
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert((select j ->> 'status' from jsonb_array_elements(public.jobs_board() -> 'mine') j where (j ->> 'id')::bigint = (select id from job2)) = 'done', 'done at the deadline');
select 1 from public.job_settle((select id from job2), false, 2);
select pg_temp.assert(((pg_temp.p(1)).home_layout -> 0 ->> 'x')::int = 2 and jsonb_array_length((pg_temp.p(1)).home_layout) = 2, 'the layout is back');
select pg_temp.assert((pg_temp.p(1)).bank_cash = 7500, 'the C$1,000 came back');
select pg_temp.assert((pg_temp.p(3)).bank_cash = 10000, 'Cy got nothing');

-- Kept on its own after 24 hours.
create temp table job3 as select (public.post_job('decorator', 300, null, null) ->> 'id')::bigint id;
grant all on job3 to authenticated;
reset role;
update public.jobs set status = 'done', worker = pg_temp.id(3), taken_at = now() - interval '2 days', finished_at = now() - interval '25 hours' where id = (select id from job3);
set role authenticated;
select pg_temp.as_(3);
select 1 from public.jobs_board();
select pg_temp.assert((pg_temp.p(3)).bank_cash = 10300, 'Cy paid after 24 hours');

-- Cancel an open job: the pay comes back.
select pg_temp.as_(2);
create temp table job4 as select (public.post_job('decorator', 400, null, null) ->> 'id')::bigint id;
grant all on job4 to authenticated;
select 1 from public.cancel_job((select id from job4));
select pg_temp.assert(pg_temp.ledger_rows('job_refund') = 2, 'refunded');

-- ---------------------------------------------------------------------------
-- Jobs: the business manager
-- ---------------------------------------------------------------------------
select pg_temp.as_(3);
select pg_temp.assert(pg_temp.raises($$select public.post_job('manager', 0, 10, null)$$, 'no_business'), 'a business first');
select 1 from public.buy_business('hot-dog-cart');
select pg_temp.assert(pg_temp.raises($$select public.post_job('manager', 0, 30, null)$$, 'bad_cut'), '20% at most');
create temp table mjob as select (public.post_job('manager', 0, 20, null) ->> 'id')::bigint id;
grant all on mjob to authenticated;
select pg_temp.as_(2);
select pg_temp.assert((select (j ->> 'perDay')::int from jsonb_array_elements(public.jobs_board() -> 'open') j where (j ->> 'id')::bigint = (select id from mjob)) = 150, '20% of C$750 a day');
select 1 from public.take_job((select id from mjob));
reset role;
update public.player_businesses set collected_at = collected_at - interval '1 day' where player_id = pg_temp.id(3);
create temp table before as select (pg_temp.p(2)).bank_cash b, (pg_temp.p(3)).bank_cash c;
grant all on before to authenticated;
set role authenticated;
create temp table mc as select public.manager_collect((select id from mjob)) r;
grant all on mc to authenticated;
select pg_temp.assert((select (r ->> 'collected')::int = 750 and (r ->> 'cash')::int = 150 from mc), 'collected C$750, kept C$150');
select pg_temp.assert((pg_temp.p(2)).bank_cash = (select b from before) + 150 and (pg_temp.p(3)).bank_cash = (select c from before) + 600, 'the client keeps 80%');
select pg_temp.assert((public.manager_collect((select id from mjob)) ->> 'cash')::int = 0, 'an empty till pays nothing');
select pg_temp.as_(3);
select 1 from public.end_job((select id from mjob));
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.manager_collect((select id from mjob))$$, 'job_over'), 'fired');

-- Blocks: no jobs from someone who blocked you.
select pg_temp.as_(1);
reset role;
insert into public.blocks (blocker, blocked) values (pg_temp.id(1), pg_temp.id(3));
set role authenticated;
create temp table job5 as select (public.post_job('decorator', 500, null, null) ->> 'id')::bigint id;
grant all on job5 to authenticated;
select pg_temp.as_(3);
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.jobs_board() -> 'open') j where (j ->> 'id')::bigint = (select id from job5)), 'hidden from the blocked');
select pg_temp.assert(pg_temp.raises($$select public.take_job((select id from job5))$$, 'blocked'), 'and can''t be taken');

-- Internal helpers stay internal.
select pg_temp.assert(pg_temp.raises($$select public.job_keep(1, true)$$, 'permission denied'), 'job_keep is internal');
select pg_temp.assert(pg_temp.raises($$select public.together_pay(null, pg_temp.id(1))$$, 'permission denied'), 'together_pay is internal');

rollback;
\echo 'together: ok'
