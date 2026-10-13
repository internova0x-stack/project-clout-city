-- Scenario test for migration 0029 (exclusive event keepsakes: plus-ones, badges, News mentions).
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
create function pg_temp.attend_x(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select place_id from public.exclusive_events where id = p_event) where id = auth.uid();
  return public.attend_exclusive_event(p_event);
end $h$;
create function pg_temp.at(p_ts timestamptz) returns void language plpgsql security definer as $$
begin
  update public.game_settings set value = jsonb_build_object('tools', true, 'clockOffsetSeconds', floor(extract(epoch from (p_ts - now())))::bigint) where key = 'dev';
end $$;
create function pg_temp.product(p_sku text) returns jsonb language sql as $$
  select p from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = p_sku $$;

-- Dana (d1) has a ticket. Marco (d2) and Priya (d4) are in her crew; Sam (d3) is a stranger.
insert into auth.users (id) select pg_temp.id(n) from unnest(array[81, 82, 83, 84]) n;
update public.game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';
set role authenticated;
do $$
declare n text; i int;
begin
  foreach i in array array[81, 82, 83, 84] loop
    perform pg_temp.as_(i);
    n := case i when 81 then 'Dana' when 82 then 'Marco' when 83 then 'Sam' else 'Priya' end;
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code) values (pg_temp.id(81), pg_temp.id(82), 'TEST'), (pg_temp.id(84), pg_temp.id(81), 'TEST');
update public.players set energy = 100, mood = 50, confidence = 50 where id in (select pg_temp.id(n) from unnest(array[81, 82, 83, 84]) n);
select pg_temp.assert(public.payment_grant('evt_p1', 'cs_p1', 'pi_p1', pg_temp.id(81), 'event-jada-sol-listening', 499, 'usd') = 'granted', 'Dana has a ticket');
select pg_temp.assert((select mood = 8 and confidence = 8 from public.exclusive_events where id = 'jada-sol-listening'), 'club-level stats');
set role authenticated;

-- Invites: crew only, one per ticket, and only from a ticket holder.
select pg_temp.as_(83);
select pg_temp.assert(pg_temp.raises($$select public.party_invite('jada-sol-listening', '00000000-0000-0000-0000-000000000082')$$, 'not_on_list'), 'no ticket, no plus-one');
select pg_temp.as_(81);
select pg_temp.assert(pg_temp.raises($$select public.party_invite('jada-sol-listening', '00000000-0000-0000-0000-000000000083')$$, 'not_in_crew'), 'strangers are out');
select 1 from public.party_invite('jada-sol-listening', pg_temp.id(82));
select pg_temp.assert(pg_temp.raises($$select public.party_invite('jada-sol-listening', '00000000-0000-0000-0000-000000000084')$$, 'plus_one_taken'), 'one plus-one per ticket');
select pg_temp.assert((select jsonb_array_length(public.party_inbox() -> 'plusOnes') = 1 and (public.party_inbox() #>> '{plusOnes,0,mine}')::boolean), 'Dana sees her invite');

-- Marco declines, Dana asks Priya, Priya says yes.
select pg_temp.as_(82);
select pg_temp.assert((select public.party_inbox() #>> '{plusOnes,0,host,name}' = 'Dana'), 'Marco sees who asked');
select pg_temp.assert((pg_temp.product('event-jada-sol-listening') #>> '{event,plusOneOf}') is null, 'an invite is not a spot yet');
select 1 from public.party_respond('jada-sol-listening', false);
select pg_temp.as_(81);
select 1 from public.party_invite('jada-sol-listening', pg_temp.id(84));
select pg_temp.as_(84);
select 1 from public.party_respond('jada-sol-listening', true);
select pg_temp.assert(pg_temp.raises($$select public.party_respond('jada-sol-listening', true)$$, 'no_invite'), 'answer once');
select pg_temp.assert((pg_temp.product('event-jada-sol-listening') #>> '{event,plusOneOf}') = 'Dana', 'Priya is on the list as Dana''s plus-one');
select pg_temp.assert(not (pg_temp.product('event-jada-sol-listening') ->> 'owned')::boolean, 'without a ticket of her own');

-- The party: both go in, both get the badge; the guest gets no ticket clout.
reset role;
select pg_temp.assert((select count(*) = 1 from public.entitlements where sku = 'event-jada-sol-listening'), 'serial numbers untouched');
create temp table before as select id, clout from public.players;
grant select on before to public;
set role authenticated;
select pg_temp.at((select starts_at + interval '1 hour' from public.exclusive_events where id = 'jada-sol-listening'));
select pg_temp.as_(84);
create temp table g as select pg_temp.attend_x('jada-sol-listening') as r;
select pg_temp.assert((select (r ->> 'mood')::int = 8 and (r ->> 'confidence')::int = 8 and r ->> 'badge' = 'party:jada-sol-listening' from g), 'the plus-one gets in, with the badge');
select pg_temp.assert((select clout from public.players where id = auth.uid()) = (select clout from before where id = pg_temp.id(84)), 'no ticket clout for the guest');
select pg_temp.as_(81);
select 1 from pg_temp.attend_x('jada-sol-listening');
select pg_temp.as_(83);
select pg_temp.assert(pg_temp.raises($$select pg_temp.attend_x('jada-sol-listening')$$, 'not_on_list'), 'Sam is not on the list');
reset role;
select pg_temp.assert((select count(*) = 2 from public.player_badges where badge_id = 'party:jada-sol-listening'), 'two badges');
-- Marco went too, on his own (he declined the plus-one but got in another way).
update public.players set at_place = 'low-light-lounge' where id = pg_temp.id(82);
insert into public.event_attendance (player_id, event_id, ny_date) select pg_temp.id(82), 'jada-sol-listening', public.ny_today();
set role authenticated;

-- "Spotted at": Dana's mention names Priya (plus-one first) and Marco (crew), counts everyone.
select pg_temp.as_(81);
create temp table m as select public.party_mentions() -> 0 as r;
select pg_temp.assert((select (r ->> 'total')::int = 3 from m), 'three were there');
select pg_temp.assert((select r -> 'names' = '["Priya", "Marco"]'::jsonb from m), 'plus-one first, then crew');
-- Priya opts out: gone from Dana's mention, and no mentions of her own.
select pg_temp.as_(84);
select 1 from public.set_news_opt_out(true);
select pg_temp.assert((public.party_inbox() ->> 'newsOptOut')::boolean, 'the setting reads back');
select pg_temp.assert(jsonb_array_length(public.party_mentions()) = 0, 'opted out: no mentions');
select pg_temp.as_(81);
select pg_temp.assert((public.party_mentions() -> 0 -> 'names') = '["Marco"]'::jsonb, 'opted-out names are left out');

-- After the party: the event card stays for the plus-one; no new invites.
select pg_temp.at((select ends_at + interval '1 minute' from public.exclusive_events where id = 'jada-sol-listening'));
select pg_temp.as_(84);
select pg_temp.assert((pg_temp.product('event-jada-sol-listening') #>> '{event,attended}')::boolean, 'the guest keeps the event card');
select pg_temp.as_(81);
select pg_temp.assert(jsonb_array_length(public.party_inbox() -> 'plusOnes') = 0, 'past parties leave the inbox');

reset role;
update public.game_settings set value = '{"tools": false, "clockOffsetSeconds": 0}' where key = 'dev';
rollback;
\echo PARTY CHECKS PASSED
