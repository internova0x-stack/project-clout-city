-- Scenario test for migration 0142 (reputation option C): players can't call campaign_rep; each End Week's nudge moves
-- the manager's meter once; a campaign moves it at most ±15 in total; the meter stays 0 to 100; only the manager's own
-- campaign counts. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000142' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.meter(p uuid) returns int language sql as $$ select integrity from public.reputation where player_id = p $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Manager', 'Other'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    i := i + 1;
  end loop;
end $$;
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform public.campaign_rep(pg_temp.u(1), gen_random_uuid(), 1, -5); raise exception 'FAIL: campaign_rep callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

insert into public.campaigns (id, player_id, candidate, state) values ('00000000-0000-0000-0000-00000014c001', pg_temp.u(1), 'goldcrest', '{}');

-- A dirty week: −8; the same week again changes nothing.
select pg_temp.assert(public.campaign_rep(pg_temp.u(1), '00000000-0000-0000-0000-00000014c001', 1, -8) = -8, 'week 1 applied');
select pg_temp.assert(pg_temp.meter(pg_temp.u(1)) = 42, 'meter moved toward Hustler');
select pg_temp.assert(public.campaign_rep(pg_temp.u(1), '00000000-0000-0000-0000-00000014c001', 1, -8) = 0, 'once per week');
select pg_temp.assert(pg_temp.meter(pg_temp.u(1)) = 42, 'still 42');
-- The campaign cap: −8 more is clipped to −7 (−15 in all), then nothing.
select pg_temp.assert(public.campaign_rep(pg_temp.u(1), '00000000-0000-0000-0000-00000014c001', 2, -8) = -7, 'capped at -15 a campaign');
select pg_temp.assert(public.campaign_rep(pg_temp.u(1), '00000000-0000-0000-0000-00000014c001', 3, -8) = 0, 'nothing past the cap');
select pg_temp.assert(pg_temp.meter(pg_temp.u(1)) = 35, 'meter at 35');
-- Both ways: a clean week moves it back.
select pg_temp.assert(public.campaign_rep(pg_temp.u(1), '00000000-0000-0000-0000-00000014c001', 4, 6) = 6, 'a clean week counts too');
select pg_temp.assert(pg_temp.meter(pg_temp.u(1)) = 41, 'meter back to 41');
-- Checks: another player's campaign, a too-big nudge.
select pg_temp.assert(pg_temp.raises($$select public.campaign_rep(pg_temp.u(2), '00000000-0000-0000-0000-00000014c001', 1, -3)$$, 'not_found'), 'only the manager''s own campaign');
select pg_temp.assert(pg_temp.raises($$select public.campaign_rep(pg_temp.u(1), '00000000-0000-0000-0000-00000014c001', 4, -9)$$, 'bad_effects'), 'at most ±8 a week');

rollback;
