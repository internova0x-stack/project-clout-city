-- Scenario test for migration 0047 (meeting players: presence, reactions, 20 a day, unlimited chat,
-- who can message me). Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d' || n, false) $$;
create function pg_temp.at(n int, p text) returns void language sql security definer as $$
  update public.players set at_place = p, arrives_at = null where id = ('00000000-0000-0000-0000-0000000000d' || n)::uuid $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2'), ('00000000-0000-0000-0000-0000000000d3');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('meet_one', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('meet_two', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('meet_three', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');

-- Presence: only players at the same place, once they've checked in.
select pg_temp.at(1, 'velvet-static'); select pg_temp.at(2, 'velvet-static'); select pg_temp.at(3, 'grind-and-gossip');
-- 0049: upstairs needs VIP access (free from 5,000 clout at Velvet Static).
reset role; update public.players set clout = 6000 where display_name = 'meet_two'; set role authenticated;
select pg_temp.as_(2); select 1 from public.place_presence('velvet-static', 2);
select pg_temp.as_(3); select 1 from public.place_presence('grind-and-gossip', 1);
select pg_temp.as_(1);
create temp table here1 as select public.place_presence('velvet-static', 1) r;
grant all on here1 to authenticated;
select pg_temp.assert((select (r ->> 'count')::int = 1 and r -> 'people' -> 0 ->> 'name' = 'meet_two' and (r -> 'people' -> 0 ->> 'floor')::int = 2 from here1),
                      'one other player here (meet_two, upstairs); meet_three is elsewhere');
select pg_temp.assert((public.place_presence('grind-and-gossip') ->> 'count')::int = 0, 'nothing for a place you are not at');
-- 0064: players inside each room, you included (you checked in above); the names are others only.
select pg_temp.assert((public.place_counts() -> 'velvet-static' ->> 'count')::int = 2 and (public.place_counts() -> 'grind-and-gossip' ->> 'count')::int = 1,
                      'place counts for the map (players inside the room, you too)');
select pg_temp.assert((public.place_counts() -> 'velvet-static' -> 'names') = '[{"name": "meet_two", "style": "bodega_drip"}]'::jsonb,
                      'the names are other players');
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-0000000000d2') ->> 'herePlace') = 'velvet-static', 'the card says they are here with you');

-- Reactions: free, only together (or crew), one per person every few minutes, never counted.
select pg_temp.assert(pg_temp.raises($$select public.react_to('00000000-0000-0000-0000-0000000000d3', '👋')$$, 'not_together'), 'no reactions across town');
select pg_temp.assert(pg_temp.raises($$select public.react_to('00000000-0000-0000-0000-0000000000d2', '🍆')$$, 'bad_reaction'), 'only the five reactions');
select 1 from public.react_to('00000000-0000-0000-0000-0000000000d2', '👋');
select pg_temp.assert(pg_temp.raises($$select public.react_to('00000000-0000-0000-0000-0000000000d2', '🔥')$$, 'react_too_fast'), 'one reaction per person every few minutes');
select pg_temp.assert((public.chat_status() ->> 'left')::int = 20 and (public.chat_status() ->> 'limit')::int = 20, '20 a day; the reaction did not count');

-- 20 messages a day, replies included; the 21st is refused.
do $$ begin for i in 1..20 loop perform public.chat_send('00000000-0000-0000-0000-0000000000d2', 'hello ' || i); end loop; end $$;
select pg_temp.assert(pg_temp.raises($$select public.chat_send('00000000-0000-0000-0000-0000000000d2', 'one more')$$, 'daily_limit'), 'the 21st is refused');
select pg_temp.assert((public.chat_thread('00000000-0000-0000-0000-0000000000d2') -> 'messages' -> 0 ->> 'kind') = 'reaction', 'the reaction is in the thread');

-- Unlimited chat: a monthly pass lifts the limit; ending the subscription brings it back.
reset role;
select public.payment_grant('evt_sub_1', 'cs_sub_1', 'sub_123', '00000000-0000-0000-0000-0000000000d1', 'chat-unlimited-monthly', 499, 'usd');
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert((public.chat_status() ->> 'unlimited')::boolean, 'unlimited with the monthly pass');
select pg_temp.assert((public.chat_send('00000000-0000-0000-0000-0000000000d2', 'twenty-first!') ->> 'left') is null, 'no limit while it lasts');
select pg_temp.assert(pg_temp.raises($$select public.start_purchase('chat-unlimited-forever', 'cs_two')$$, 'already_owned'), 'no second pass on top');
reset role;
select pg_temp.assert(public.payment_subscription('evt_sub_2', 'sub_123', 'past_due') = 'kept', 'past due keeps access while Stripe retries');
select pg_temp.assert(public.payment_subscription('evt_sub_3', 'sub_123', 'canceled') = 'revoked', 'cancelled: revoked');
select pg_temp.assert(public.payment_subscription('evt_sub_3', 'sub_123', 'canceled') = 'duplicate', 'once per event');
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(not (public.chat_status() ->> 'unlimited')::boolean, 'the limit comes back');
select pg_temp.assert(pg_temp.raises($$select public.chat_send('00000000-0000-0000-0000-0000000000d2', 'and again')$$, 'daily_limit'), 'limited again');

-- Who can message me: crew only stops strangers (messages and reactions).
select pg_temp.as_(3); select public.set_messages_from('crew');
select pg_temp.as_(1); select pg_temp.at(1, 'grind-and-gossip');
select pg_temp.assert(not (public.player_card('00000000-0000-0000-0000-0000000000d3') ->> 'canMessage')::boolean, 'the card says you cannot message them');
select pg_temp.assert(pg_temp.raises($$select public.react_to('00000000-0000-0000-0000-0000000000d3', '👋')$$, 'crew_only'), 'crew only: no reactions from strangers');
select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.chat_send('00000000-0000-0000-0000-0000000000d3', 'hi')$$, 'crew_only'), 'crew only: no messages from strangers');
select pg_temp.assert(pg_temp.raises($$select public.set_messages_from('everyone')$$, 'bad_setting'), 'only anyone or crew');

rollback;
\echo MEET PLAYERS CHECKS PASSED
