-- Scenario test for migration 0175 (fame perks, rewards that grow): the rank bonus on everyday rewards, the weekly free
-- ticket, the daily comped meal, a celebrity's free Scene invite, the Gala match, the paparazzi, Lola's Spotlight on a new
-- rank (not for News opt-outs), the Mayor's day at Rank 10, and nothing for a Rank 1 player.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000009' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.paid(k text, p uuid, c text) returns bigint language sql security definer as
  $$ select coalesce(sum(amount), 0) from public.ledger where kind = k and player_id = p and currency = c $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Famous', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
select pg_temp.as_(pg_temp.u(2)::text);
select public.create_player('Nobody', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;
update public.players set clout = 0, bank_cash = 1000, best_rank = 1 where id in (pg_temp.u(1), pg_temp.u(2));

-- ---- Rank 1: nothing extra ----
select public.ledger_once(pg_temp.u(2), 'cash', 40, 'daily_task', 'x1');
select pg_temp.assert(pg_temp.paid('fame_scale', pg_temp.u(2), 'cash') = 0, 'no bonus at Rank 1');

-- ---- Rank 6: ×2 on everyday rewards; Spotlights for 5 and 6 ----
update public.players set best_rank = 6 where id = pg_temp.u(1);
select pg_temp.assert((select count(*) from public.choice_headlines where player_id = pg_temp.u(1) and kind = 'win' and text like '%Spotlight%') = 2, 'Spotlights for Ranks 5 and 6');
select public.ledger_once(pg_temp.u(1), 'cash', 40, 'daily_task', 'x1');
select pg_temp.assert(pg_temp.paid('fame_scale', pg_temp.u(1), 'cash') = 40, '×2 at Rank 6');
select public.ledger_once(pg_temp.u(1), 'clout', 10, 'visit', 'v1');
select pg_temp.assert(pg_temp.paid('fame_scale', pg_temp.u(1), 'clout') = 10, 'visits too');
select public.ledger_once(pg_temp.u(1), 'cash', 500, 'shift', 's1');
select pg_temp.assert(pg_temp.paid('fame_scale', pg_temp.u(1), 'cash') = 40, 'not shifts');

-- ---- Rank 2+: the week's first ticket; Rank 3+: the day's first meal ----
select public.ledger_once(pg_temp.u(1), 'cash', -35, 'event_entry', 'e1');
select public.ledger_once(pg_temp.u(1), 'cash', -35, 'event_entry', 'e2');
select pg_temp.assert(pg_temp.paid('fame_ticket', pg_temp.u(1), 'cash') = 35, 'one free ticket a week');
select public.ledger_once(pg_temp.u(1), 'cash', -16, 'eat', 'm1');
select public.ledger_once(pg_temp.u(1), 'cash', -16, 'eat', 'm2');
select pg_temp.assert(pg_temp.paid('fame_comp', pg_temp.u(1), 'cash') = 16, 'one comped meal a day');

-- ---- Rank 4+: a celebrity-hosted Scene move a day is free ----
update public.players set at_place = 'ditmars-heights-rooftop', energy = 100 where id = pg_temp.u(1);
insert into public.scene_moves (id, player_id, move, place, slot, score, need, ready_at, stale_at)
values ('11111111-1111-1111-1111-111111111111', pg_temp.u(1), 'crab-breakfast', 'ditmars-heights-rooftop', 1, 'status', 2, now() + interval '8 hours', now() + interval '16 hours');
select public.ledger_once(pg_temp.u(1), 'cash', -300, 'scene_cost', '11111111-1111-1111-1111-111111111111');
select pg_temp.assert(pg_temp.paid('fame_invite', pg_temp.u(1), 'cash') = 300, 'the celebrity invite');

-- ---- Rank 7+: the Gala match; Rank 8+: the paparazzi ----
update public.players set best_rank = 8 where id = pg_temp.u(1);
select public.ledger_once(pg_temp.u(1), 'clout', 50, 'gala', 'g1');
select pg_temp.assert(pg_temp.paid('fame_match', pg_temp.u(1), 'clout') = 50, 'matched');
select public.ledger_once(pg_temp.u(1), 'clout', 200, 'scene', 'sc1');
select pg_temp.assert(pg_temp.paid('fame_paparazzi', pg_temp.u(1), 'clout') = 20, '+10%');

-- ---- The state the perks sheet reads ----
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select pg_temp.assert((public.fame_state() ->> 'rank')::int >= 8 and (public.fame_state() ->> 'ticketUsed')::boolean and (public.fame_state() ->> 'compUsed')::boolean, 'fame_state');
reset role;

-- ---- Rank 10: the Mayor's day; News opt-outs get no Spotlight ----
update public.players set news_opt_out = true where id = pg_temp.u(1);
update public.players set best_rank = 10 where id = pg_temp.u(1);
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = pg_temp.u(1) and badge_id = 'mayor-day'), 'the Mayor''s day');
select pg_temp.assert((select count(*) from public.choice_headlines where player_id = pg_temp.u(1)) = 4, 'no Spotlight after opting out of the News');
rollback;
