-- Scenario test for migration 0049 (hardening: invites, dev tools, gossip trips, VIP presence, helpers).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'), false) $$;
create function pg_temp.clout(n int) returns int language sql security definer as $$
  select clout from public.players where id = ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;

insert into auth.users (id) select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 8) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('host', 'bodega_drip', '{}', null, true);
reset role;
create temp table code as select invite_code from public.players where display_name = 'host';
grant all on code to authenticated;
set role authenticated;

-- Invites: the first five pay at once; the sixth and seventh wait for a second day.
do $$ begin
  for n in 2..8 loop
    perform pg_temp.as_(n);
    perform public.create_player('friend' || n, 'bodega_drip', '{}', (select invite_code from code), true);
  end loop;
end $$;
select pg_temp.as_(1);
select pg_temp.assert((select count(*) from public.ledger where kind = 'invite') = 5, 'five invites paid at once');
reset role;
select pg_temp.assert(pg_temp.clout(1) = 5 * 50 + 500, 'five invites and the full-crew bonus');
-- friend7 comes back the next day: a ledger row dated a day after sign-up pays their invite.
update public.players set created_at = created_at - interval '1 day' where display_name = 'friend7';
select public.ledger_once(id, 'clout', 1, 'test_return', 'day2') from public.players where display_name = 'friend7';
select pg_temp.assert(pg_temp.clout(1) = 6 * 50 + 500, 'the sixth invite pays when the friend comes back');
select pg_temp.assert((select reward_paid_at is null from public.invites i join public.players p on p.id = i.invitee_id where p.display_name = 'friend8'),
                      'the one who never came back stays unpaid');
-- A same-day ledger row doesn't count as coming back.
select public.ledger_once(id, 'clout', 1, 'test_return', 'day1') from public.players where display_name = 'friend8';
select pg_temp.assert(pg_temp.clout(1) = 6 * 50 + 500, 'same day: still waiting');

-- Dev tools need an admin even when switched on.
update public.game_settings set value = jsonb_set(value, '{tools}', 'true') where key = 'dev';
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.dev_set_clock_offset(48)$$, 'not_admin'), 'no clock travel for players');
select pg_temp.assert(pg_temp.raises($$select public.dev_grant_entitlement('chat-unlimited-forever', true)$$, 'not_admin'), 'no free products');
select pg_temp.assert(pg_temp.raises($$select public.story_debug()$$, 'not_admin'), 'no prediction answers');

-- Helpers the browser can't call.
select pg_temp.assert(not has_function_privilege('authenticated', 'public.rank_level(bigint, bigint)', 'execute'), 'rank_level is internal');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.business_worth(text, int, boolean, bigint)', 'execute'), 'business_worth is internal');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.chat_unlimited(uuid)', 'execute'), 'who pays for chat is private');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.came_back(uuid)', 'execute'), 'came_back is internal');
select pg_temp.assert(has_function_privilege('authenticated', 'public.business_state()', 'execute'), 'the game''s own calls still work');

-- Gossip waits for the trip; presence stays downstairs without VIP.
reset role;
update public.players set at_place = 'velvet-static', arrives_at = clock_timestamp() + interval '10 minutes', home_id = 'astoria_studio'
 where display_name = 'friend2';
set role authenticated;
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.gossip_find('velvet-static', 'overheard')$$, 'still_travelling'), 'no gossip mid-trip');
reset role;
update public.players set arrives_at = null where display_name = 'friend2';
set role authenticated;
select 1 from public.place_presence('velvet-static', 2);
reset role;
select pg_temp.assert((select at_floor = 1 from public.players where display_name = 'friend2'), 'no VIP floor without access');

rollback;
\echo HARDENING CHECKS PASSED
