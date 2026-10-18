-- Scenario test for migration 0083 (push step 3: P2 rewards, on air / on screen, the morning roundup, win-back).
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.q(p text, k text) returns bigint language sql as $$
  select count(*) from public.push_queue where player_id = p::uuid and kind = k $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000083a1'), ('00000000-0000-0000-0000-0000000083a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000083a1', false);
select 1 from public.create_player('Winner', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://push.example/83a', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000083a2', false);
select 1 from public.create_player('Away', 'bodega_drip', '{}', null, true);
select public.push_subscribe('https://push.example/83b', 'k', 'a', 'America/New_York');
reset role;
delete from public.push_queue where player_id in ('00000000-0000-0000-0000-0000000083a1', '00000000-0000-0000-0000-0000000083a2');

-- P2 from the ledger: a goal, a skill level, the jackpot; ordinary pay pushes nothing.
select public.ledger_once('00000000-0000-0000-0000-0000000083a1', 'clout', 200, 'goal', 'pro_gigs');
select public.ledger_once('00000000-0000-0000-0000-0000000083a1', 'cash', 500, 'goal', 'pro_gigs');
select public.ledger_once('00000000-0000-0000-0000-0000000083a1', 'clout', 50, 'skill', 'charisma:5');
select public.ledger_once('00000000-0000-0000-0000-0000000083a1', 'cash', 12000, 'lotto_jackpot', '2026-10-12');
select public.ledger_once('00000000-0000-0000-0000-0000000083a1', 'cash', 120, 'shift', 'x');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000083a1', 'goal_done') = 1, 'one goal push for cash and clout');
select pg_temp.assert((select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000083a1' and kind = 'skill_up') = '📈 Charisma level 5', 'skill copy');
select pg_temp.assert((select body from public.push_queue where player_id = '00000000-0000-0000-0000-0000000083a1' and kind = 'lotto_win') like 'C$12,000%', 'jackpot amount');
select pg_temp.assert((select count(*) from public.push_queue where player_id = '00000000-0000-0000-0000-0000000083a1') = 3, 'pay pushes nothing');

-- A new best rank.
update public.players set best_rank = 3 where id = '00000000-0000-0000-0000-0000000083a1';
select pg_temp.assert((select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000083a1' and kind = 'rank_up') = 'New rank: 💼 Side Hustler', 'rank up');
update public.players set best_rank = 3 where id = '00000000-0000-0000-0000-0000000083a1';
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000083a1', 'rank_up') = 1, 'same rank, no second push');

-- On air and on screen, at the moment they air.
insert into public.radio_shoutouts (player_id, handle, message, ny_date, status, owner_confirmed, aired_at)
  values ('00000000-0000-0000-0000-0000000083a1', 'winner', 'hi queens', public.ny_today(), 'on_air', true, now() - interval '5 minutes');
insert into public.tv_submissions (player_id, photo_path, handle, confirmed_self_at, confirmed_adult_at, confirmed_public_at, ny_date, status, featured_at)
  values ('00000000-0000-0000-0000-0000000083a1', '00000000-0000-0000-0000-0000000083a1/x.jpg', 'winner', now(), now(), now(), public.ny_today(), 'featured', now() - interval '10 minutes');
select public.push_scan_rewards();
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000083a1', 'radio_on_air') = 1 and pg_temp.q('00000000-0000-0000-0000-0000000083a1', 'tv_on_screen') = 1, 'on air, on screen');

-- The roundup: only players who haven't opened the game today. Winner played today; Away last played 7 days ago.
insert into public.player_sessions (player_id, ny_date) values ('00000000-0000-0000-0000-0000000083a1', public.ny_today()),
  ('00000000-0000-0000-0000-0000000083a2', public.ny_today() - 7);
-- push_roundup only runs from 8 AM to 8 PM New York, so outside those hours the checks below are skipped.
select public.push_roundup();
select pg_temp.assert(extract(hour from now() at time zone 'America/New_York') not between 8 and 19
  or (pg_temp.q('00000000-0000-0000-0000-0000000083a2', 'daily_tasks') = 1
      and pg_temp.q('00000000-0000-0000-0000-0000000083a2', 'winback') = 1
      and pg_temp.q('00000000-0000-0000-0000-0000000083a1', 'daily_tasks') = 0), 'roundup for players away only, win-back at 7 days');
select pg_temp.assert(extract(hour from now() at time zone 'America/New_York') not between 8 and 19
  or (select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000083a2' and kind = 'winback') = '👀 Queens keeps asking about you', 'win-back copy');
-- The whole scan runs clean, twice.
select public.push_scan();
select pg_temp.assert(public.push_scan() = 0, 'scan is idempotent');

-- A reward trigger never breaks the ledger.
create or replace function public.push_enqueue(p_player uuid, p_kind text, p_key text, p_title text, p_body text,
  p_url text default '/home', p_deadline timestamptz default null, p_close boolean default false, p_group text default null)
returns void language plpgsql as $$ begin raise exception 'boom'; end $$;
select public.ledger_once('00000000-0000-0000-0000-0000000083a1', 'clout', 10, 'goal', 'another');
select pg_temp.assert(exists (select 1 from public.ledger where kind = 'goal' and ref = 'another'), 'ledger row saved despite a push error');

rollback;
\echo 'push_rewards: ok'
