-- Scenario test for migration 0126 (per-player rate limits): writes are counted per player and minute, reads and the
-- service role never are, guessable functions have their own tighter bucket, and the window resets. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
-- One PostgREST request: its method and path, then the pre-request hook. True when it was let through.
create function pg_temp.req(p_method text, p_path text) returns boolean language plpgsql as $$
begin
  perform set_config('request.method', p_method, true);
  perform set_config('request.path', p_path, true);
  perform public.check_request();
  return true;
exception when sqlstate 'PT429' then return false;
end $$;
-- Let n requests through, then report whether the next one was.
create function pg_temp.burst(n int, p_method text, p_path text) returns boolean language plpgsql as $$
begin
  for i in 1..n loop
    if not pg_temp.req(p_method, p_path) then raise exception 'FAIL: request % of % was refused', i, n; end if;
  end loop;
  return pg_temp.req(p_method, p_path);
end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000001261'), ('00000000-0000-0000-0000-000000001262');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001261', true);

-- Players can't read or reset their counters, or call the hit counter.
do $$ begin
  begin perform 1 from public.rate_counters; raise exception 'FAIL: counters readable';
  exception when insufficient_privilege then null; end;
  begin perform public.rate_hit(auth.uid(), 'all', 1000, 60); raise exception 'FAIL: rate_hit callable';
  exception when insufficient_privilege then null; end;
end $$;

-- Guesses: 20 a minute, then refused; other writes still go through.
select pg_temp.assert(not pg_temp.burst(20, 'POST', '/rpc/hunt_answer'), 'the 21st hunt answer in a minute is refused');
select pg_temp.assert(not pg_temp.req('POST', '/rpc/is_name_available'), 'the guess bucket is shared');
select pg_temp.assert(pg_temp.req('POST', '/rpc/travel'), 'an ordinary write still goes through');

-- Reads are never counted.
select pg_temp.assert(pg_temp.burst(500, 'GET', '/players'), 'reads are free');

-- Every write: 240 a minute (21 used above: refused requests roll back and count nothing).
select pg_temp.assert(not pg_temp.burst(240 - 21, 'POST', '/rpc/do_action'), 'the 241st write in a minute is refused');
select pg_temp.assert(not pg_temp.req('PATCH', '/players'), 'any write method counts');

-- Another player has their own counters.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001262', true);
select pg_temp.assert(pg_temp.req('POST', '/rpc/do_action'), 'another player is unaffected');

-- A new minute starts afresh.
reset role;
update public.rate_counters set window_start = now() - interval '61 seconds' where player_id = '00000000-0000-0000-0000-000000001261';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001261', true);
select pg_temp.assert(pg_temp.req('POST', '/rpc/hunt_answer'), 'the window resets');

-- Signed-out requests and the service role are never limited.
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert(pg_temp.burst(300, 'POST', '/rpc/is_name_available'), 'no player, no limit');

-- A broken setting lets requests through rather than blocking the game.
reset role;
update public.game_settings set value = '{"all": "lots"}' where key = 'rate_limits';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001262', true);
select pg_temp.assert(pg_temp.req('POST', '/rpc/do_action'), 'a broken setting fails open');
rollback;
