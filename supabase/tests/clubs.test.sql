-- Scenario test for migration 0046 (#19 clubs: the door rule, VIP floors, restroom gossip).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.at(p text) returns void language sql security definer as $$
  update public.players set at_place = p, arrives_at = null where display_name = 'clubber' $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c7');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c7', false);
select 1 from public.create_player('clubber', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 20000, clout = 1999, energy = 100, mood = 50, confidence = 50 where display_name = 'clubber';
set role authenticated;

-- The seed: three new clubs, a restroom at every club and the lounge, VIP at medium and exclusive clubs.
select pg_temp.assert((select count(*) from jsonb_array_elements(public.city() -> 'places') p
                       where p ->> 'id' in ('the-sticky-floor', 'discount-disco', 'ultraviolet-society')) = 3, 'three new clubs');
select pg_temp.assert((select p -> 'club' ->> 'vip' is null from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = 'low-light-lounge'),
                      'the lounge has a restroom but no VIP');

-- The door: 2,000 clout to get into Ultraviolet Society at all.
select pg_temp.assert(pg_temp.raises($$select public.travel('ultraviolet-society', 'taxi')$$, 'door_clout'), '1,999 clout is turned away');
reset role;
update public.players set clout = 2000 where display_name = 'clubber';
set role authenticated;
select pg_temp.assert((public.travel('ultraviolet-society', 'taxi') ->> 'place') = 'ultraviolet-society', '2,000 clout gets in');
reset role;
update public.players set bank_cash = 20000 where display_name = 'clubber';
set role authenticated;

-- VIP at a medium club: no VIP at a cheap one; the cover (C$1,500) only when asked to pay, once a day.
select pg_temp.at('the-sticky-floor');
select pg_temp.assert(pg_temp.raises($$select public.enter_vip('the-sticky-floor', true)$$, 'no_vip'), 'cheap clubs have no VIP');
select pg_temp.at('velvet-static');
select pg_temp.assert(pg_temp.raises($$select public.vip_seen('velvet-static')$$, 'vip_locked'), 'no VIP before the cover');
select pg_temp.assert((public.enter_vip('velvet-static') ->> 'needsCover')::int = 1500, 'it says what the cover is');
select pg_temp.assert((select bank_cash = 20000 from public.players where display_name = 'clubber'), 'asking costs nothing');
select pg_temp.assert((public.enter_vip('velvet-static', true) ->> 'cash')::int = -1500, 'the cover is paid');
select pg_temp.assert((public.enter_vip('velvet-static', true) ->> 'access') = 'paid' and (public.enter_vip('velvet-static', true) ->> 'cash')::int = 0,
                      'once a day: the second time is free');
select pg_temp.assert((select bank_cash = 18500 from public.players where display_name = 'clubber'), 'C$1,500 paid once');
-- Get seen in VIP: twice the clout of the dance floor downstairs (C$140 there), once a day.
create temp table seen as select public.vip_seen('velvet-static') r;
grant all on seen to authenticated;
reset role;
create temp table floor_clout as select round((5 + 140 * 0.25) * public.clout_multiplier(50, 50))::int as c;
grant all on floor_clout to authenticated;
set role authenticated;
select pg_temp.assert((select (r ->> 'clout')::int from seen) = 2 * (select c from floor_clout), 'VIP pays twice the main floor''s clout');
select pg_temp.assert((public.vip_seen('velvet-static') ->> 'already')::boolean, 'once a day');
-- Exclusive VIP: free from 15,000 clout, else C$5,000.
select pg_temp.at('ultraviolet-society');
select pg_temp.assert((public.enter_vip('ultraviolet-society') ->> 'needsCover')::int = 5000, 'the exclusive cover is C$5,000');
reset role;
update public.players set clout = 15000 where display_name = 'clubber';
set role authenticated;
select pg_temp.assert((public.enter_vip('ultraviolet-society') ->> 'access') = 'free', 'free from 15,000 clout');

-- Restroom gossip: only where there's a restroom; it hears its own pieces and the overheard ones,
-- and a restroom piece pays the story's clout and Mood again.
reset role;
select public.gossip_import(jsonb_build_object('week', date_trunc('week', public.ny_today())::date, 'stories', jsonb_build_array(jsonb_build_object(
  'id', 'stall-talk', 'title', 'Stall talk', 'topic', 'celebrity', 'emoji', '🚻', 'teaser', 'What gets said in the Hellgate restroom stays there. Mostly.',
  'pieces', jsonb_build_array(
    jsonb_build_object('text', 'Piece one, whispered at the Hellgate Hall mirrors.', 'place', 'hellgate-hall', 'source', 'restroom'),
    jsonb_build_object('text', 'Piece two, overheard on the Velvet Static dance floor.', 'place', 'velvet-static', 'source', 'overheard'),
    jsonb_build_object('text', 'Piece three, at the café.', 'place', 'grind-and-gossip', 'source', 'overheard'),
    jsonb_build_object('text', 'Piece four, from Sal.', 'place', 'ditmars-deli', 'source', 'regular'),
    jsonb_build_object('text', 'Piece five, in the park.', 'place', 'hell-gate-park', 'source', 'overheard')),
  'tea', jsonb_build_object('headline', 'Stall talk, spilled', 'body', 'Lola explains everything.')))));
update public.players set mood = 50 where display_name = 'clubber';
create temp table c0 as select clout from public.players where display_name = 'clubber';
grant all on c0 to authenticated;
set role authenticated;
select pg_temp.at('grind-and-gossip');
select pg_temp.assert(pg_temp.raises($$select public.gossip_find('grind-and-gossip', 'restroom')$$, 'no_restroom'), 'no restroom at the café');
select pg_temp.at('hellgate-hall');
select pg_temp.assert(jsonb_array_length(public.gossip_find('hellgate-hall', 'overheard') -> 'found') = 0, 'the card''s Listen in misses the restroom piece');
create temp table r1 as select public.gossip_find('hellgate-hall', 'restroom') r;
select pg_temp.assert((select jsonb_array_length(r -> 'found') = 1 and (r -> 'bonus' ->> 'clout')::int = 25 and (r -> 'bonus' ->> 'mood')::int = 6 from r1),
                      'the restroom finds it and pays 25 clout and 6 Mood');
select pg_temp.assert((select p.clout = c0.clout + 25 and p.mood = 56 from public.players p, c0 where p.display_name = 'clubber'), 'paid to the player');
select pg_temp.assert((public.gossip_find('hellgate-hall', 'restroom') -> 'bonus' ->> 'clout')::int = 0, 'paid once');
select pg_temp.at('velvet-static');
select pg_temp.assert(jsonb_array_length(public.gossip_find('velvet-static', 'restroom') -> 'found') = 1, 'the restroom hears what''s said upstairs too');
reset role;
select pg_temp.assert((select via from public.gossip_found where story_id = 'stall-talk' and piece = 1) = 'restroom', 'found via the restroom');

rollback;
\echo CLUBS CHECKS PASSED
