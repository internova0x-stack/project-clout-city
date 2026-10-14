-- Scenario test for migration 0038 (party rooms and the event chat; $3.99 parties).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || n)::uuid $$;
create function pg_temp.at(p_ts timestamptz) returns void language plpgsql security definer as $$
begin
  update public.game_settings set value = jsonb_build_object('tools', true, 'clockOffsetSeconds', floor(extract(epoch from (p_ts - now())))::bigint) where key = 'dev';
end $$;
create function pg_temp.go(n int, p text) returns void language sql security definer as $$
  update public.players set at_place = p where id = ('00000000-0000-0000-0000-0000000000' || n)::uuid $$;

select pg_temp.assert((select bool_and(price_cents = 399) from public.store_products where product_type = 'exclusive_event'), 'parties are $3.99');

-- Ana (91) and Bo (92) have tickets; Cy (93) doesn't.
insert into auth.users (id) select pg_temp.id(n) from unnest(array[91, 92, 93]) n;
update public.game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';
set role authenticated;
do $$
declare i int;
begin
  foreach i in array array[91, 92, 93] loop
    perform pg_temp.as_(i);
    perform public.create_player(case i when 91 then 'Ana' when 92 then 'Bo' else 'Cy' end || 'party', 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;
select public.payment_grant('evt_r1', 'cs_r1', 'pi_r1', pg_temp.id(91), 'event-jada-sol-listening', 399, 'usd');
select public.payment_grant('evt_r2', 'cs_r2', 'pi_r2', pg_temp.id(92), 'event-jada-sol-listening', 399, 'usd');

-- Before the doors open: closed.
set role authenticated;
select pg_temp.as_(91); select pg_temp.go(91, 'low-light-lounge');
select pg_temp.assert(pg_temp.raises($$select public.party_room('jada-sol-listening')$$, 'party_closed'), 'doors closed');
reset role;
select pg_temp.at((select starts_at + interval '30 minutes' from public.exclusive_events where id = 'jada-sol-listening'));
set role authenticated;

-- Doors open: Ana is in; Cy has no ticket; Bo isn't at the venue yet.
select pg_temp.assert((public.party_room('jada-sol-listening') ->> 'count')::int = 1, 'Ana checks in');
select pg_temp.as_(93); select pg_temp.go(93, 'low-light-lounge');
select pg_temp.assert(pg_temp.raises($$select public.party_room('jada-sol-listening')$$, 'party_not_on_list'), 'no ticket, no room');
select pg_temp.assert(pg_temp.raises($$select public.party_say('jada-sol-listening', 'hi')$$, 'party_not_on_list'), 'no ticket, no chat');
select pg_temp.as_(92);
select pg_temp.assert(pg_temp.raises($$select public.party_room('jada-sol-listening')$$, 'party_not_here'), 'be at the venue');
select pg_temp.go(92, 'low-light-lounge');
select pg_temp.assert((public.party_room('jada-sol-listening') -> 'people' -> 0 ->> 'name') = 'Anaparty', 'Bo sees Ana');

-- The chat: no daily limit (eleven messages, past the private cap of 10), a short gap between messages.
select pg_temp.as_(91);
select pg_temp.assert((public.party_say('jada-sol-listening', 'Love the fit 🔥') ->> 'mine')::boolean, 'Ana says hi');
select pg_temp.assert(pg_temp.raises($$select public.party_say('jada-sol-listening', 'again')$$, 'party_too_fast'), 'not a flood');
reset role;
update public.party_messages set created_at = created_at - interval '1 minute';
insert into public.party_messages (event_id, sender, body, created_at)
  select 'jada-sol-listening', pg_temp.id(91), 'msg ' || n, clock_timestamp() - interval '1 minute' from generate_series(1, 10) n;
set role authenticated;
select pg_temp.as_(91);
select pg_temp.assert((public.party_say('jada-sol-listening', 'number twelve') ->> 'body') = 'number twelve', 'no daily limit at the party');
select pg_temp.as_(92);
select pg_temp.assert(jsonb_array_length(public.party_room('jada-sol-listening') -> 'messages') = 12, 'Bo reads the chat');
create temp table last_id as select ((public.party_room('jada-sol-listening') -> 'messages' -> 11 ->> 'id')::bigint) id;
grant all on last_id to authenticated;
select pg_temp.assert(jsonb_array_length(public.party_room('jada-sol-listening', (select id from last_id)) -> 'messages') = 0, 'only new messages after an id');

-- Reports reach the queue; blocking hides people and their messages both ways.
select public.party_report((select id from last_id), 'spam', 'too much');
reset role;
select pg_temp.assert(exists (select 1 from public.reports where reporter = pg_temp.id(92) and reported = pg_temp.id(91) and note like '[Party chat%number twelve%'), 'report quoted');
set role authenticated;
select pg_temp.as_(92);
select public.chat_block(pg_temp.id(91), true);
select pg_temp.assert(jsonb_array_length(public.party_room('jada-sol-listening') -> 'people') = 0, 'blocked: not in my room');
select pg_temp.assert(jsonb_array_length(public.party_room('jada-sol-listening') -> 'messages') = 0, 'blocked: not in my chat');
select pg_temp.as_(91);
select pg_temp.assert(jsonb_array_length(public.party_room('jada-sol-listening') -> 'people') = 0, 'and the other way');
reset role;
rollback;
\echo 'PARTY ROOM CHECKS PASSED'
