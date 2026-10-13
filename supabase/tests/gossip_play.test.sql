-- Scenario test for migration 0035 (gossip in the game: Listen in, regulars, Tea cards, crew sharing).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e' || n, false) $$;
create function pg_temp.at(n int, p text) returns void language sql security definer as $$
  update public.players set at_place = p where id = ('00000000-0000-0000-0000-0000000000e' || n)::uuid $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2'), ('00000000-0000-0000-0000-0000000000e3');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('tealover', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('crewmate', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('stranger', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
insert into public.invites (inviter_id, invitee_id, invite_code) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'TEST');
update public.players set mood = 50 where display_name in ('tealover', 'crewmate', 'stranger');

-- This week's story: five pieces; the third only at an hour that isn't now on the city clock.
create temp table h as select floor(public.city_minutes() / 60)::int as now_h;
select public.gossip_import(jsonb_build_object('week', date_trunc('week', public.ny_today())::date, 'stories', jsonb_build_array(jsonb_build_object(
  'id', 'test-tea', 'title', 'The test tea', 'topic', 'regulars', 'emoji', '🫖', 'teaser', 'Something is brewing in Astoria today.',
  'pieces', jsonb_build_array(
    jsonb_build_object('text', 'Piece one, overheard at the café.', 'place', 'grind-and-gossip', 'source', 'overheard'),
    jsonb_build_object('text', 'Piece two, from Sal.', 'place', 'ditmars-deli', 'source', 'regular'),
    jsonb_build_object('text', 'Piece three, at the firehouse, later.', 'place', 'engine-7', 'source', 'overheard',
      'hours', jsonb_build_array(((select now_h from h) + 2) % 24, ((select now_h from h) + 4) % 24)),
    jsonb_build_object('text', 'Piece four, overheard in the park.', 'place', 'hell-gate-park', 'source', 'overheard'),
    jsonb_build_object('text', 'Piece five, from Mr. Penwright.', 'place', 'ditmars-library', 'source', 'regular')),
  'tea', jsonb_build_object('headline', 'The test tea, spilled', 'body', 'Lola explains everything.'))))) ;

set role authenticated;
select pg_temp.as_(1);
-- The state: no text before finding, only the first piece names its place, hints for the rest.
create temp table s0 as select public.gossip_state() s;
grant all on s0 to authenticated;
select pg_temp.assert(jsonb_array_length(s -> 'stories') = 1, 'one live story') from s0;
select pg_temp.assert(not ((s -> 'stories' -> 0 -> 'pieces')::text like '%Piece one%'), 'no text before it''s found') from s0;
select pg_temp.assert(s -> 'stories' -> 0 -> 'pieces' -> 0 ->> 'place' = 'grind-and-gossip', 'the first piece names its place') from s0;
select pg_temp.assert(s -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'place' is null and s -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'kind' = 'bodega'
  and s -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'area' = 'Astoria', 'the rest are hints: kind of place and neighborhood') from s0;
select pg_temp.assert(pg_temp.raises($$select * from public.gossip_found$$, 'permission denied'), 'no reading progress directly');

-- You have to be there; listening finds only overheard pieces; the regular finds theirs.
select pg_temp.assert(pg_temp.raises($$select public.gossip_find('grind-and-gossip', 'overheard')$$, 'gossip_not_here'), 'be there first');
select pg_temp.at(1, 'grind-and-gossip');
select pg_temp.assert(jsonb_array_length(public.gossip_find('grind-and-gossip', 'overheard') -> 'found') = 1, 'piece one, overheard');
select pg_temp.assert(jsonb_array_length(public.gossip_find('grind-and-gossip', 'overheard') -> 'found') = 0, 'only once');
select pg_temp.at(1, 'ditmars-deli');
select pg_temp.assert(jsonb_array_length(public.gossip_find('ditmars-deli', 'overheard') -> 'found') = 0, 'Sal''s piece isn''t overheard');
select pg_temp.assert((public.gossip_find('ditmars-deli', 'regular') -> 'found' -> 0 ->> 'count')::int = 2, 'Sal tells piece two: 2 of 5');
-- Outside its hours: nothing, but "later".
select pg_temp.at(1, 'engine-7');
create temp table f3 as select public.gossip_find('engine-7', 'overheard') r;
grant all on f3 to authenticated;
select pg_temp.assert(jsonb_array_length(r -> 'found') = 0 and r -> 'later' is not null and r -> 'later' <> 'null'::jsonb, 'not now: try later') from f3;

-- Share piece two with the crew (once): the crewmate has it, the stranger doesn't.
select pg_temp.assert(public.gossip_share('test-tea', 1) = 1, 'shared with one crewmate');
select pg_temp.assert(pg_temp.raises($$select public.gossip_share('test-tea', 1)$$, 'gossip_shared'), 'once per piece');
select pg_temp.assert(pg_temp.raises($$select public.gossip_share('test-tea', 3)$$, 'gossip_not_found'), 'only pieces you found');
select pg_temp.as_(2);
select pg_temp.assert((public.gossip_state() -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'via') = 'crew', 'the crewmate got it from the crew');
select pg_temp.assert((public.gossip_state() -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'text') = 'Piece two, from Sal.', 'and can read it');
select pg_temp.as_(3);
select pg_temp.assert(not (public.gossip_state() -> 'stories' -> 0 -> 'pieces' -> 1 ->> 'found')::boolean, 'strangers don''t');

-- Finish: pieces four and five (and three, faked into its window), then the Tea card, clout and Mood, once.
select pg_temp.as_(1);
select pg_temp.at(1, 'hell-gate-park');
select 1 from public.gossip_find('hell-gate-park', 'overheard');
reset role;
insert into public.gossip_found (player_id, story_id, piece, via) values ('00000000-0000-0000-0000-0000000000e1', 'test-tea', 2, 'overheard');
create temp table c0 as select clout, mood from public.players where display_name = 'tealover';
grant all on c0 to authenticated;
set role authenticated;
select pg_temp.as_(1);
select pg_temp.at(1, 'ditmars-library');
create temp table f5 as select public.gossip_find('ditmars-library', 'regular') r;
grant all on f5 to authenticated;
select pg_temp.assert(r -> 'finished' -> 0 #>> '{}' = 'test-tea', 'the fifth piece finishes it') from f5;
select pg_temp.assert((public.gossip_state() -> 'cards' -> 0 ->> 'headline') = 'The test tea, spilled', 'Lola''s Tea card');
select pg_temp.assert((public.gossip_state() -> 'stories' -> 0 ->> 'done')::boolean, 'marked done');
reset role;
select pg_temp.assert((select p.clout = c.clout + 25 and p.mood = c.mood + 6 from public.players p, c0 c where p.display_name = 'tealover'), '+25 clout, +6 Mood');
select pg_temp.assert((select count(*) from public.ledger l join public.players p on p.id = l.player_id where p.display_name = 'tealover' and l.kind = 'gossip') = 1, 'one ledger row');
select pg_temp.assert(not public.gossip_finish('00000000-0000-0000-0000-0000000000e1', 'test-tea'), 'pays once');
-- The fifth finished story earns the badge.
insert into public.gossip_cards (player_id, story_id, week, title, emoji, topic, headline, body)
select '00000000-0000-0000-0000-0000000000e2', 'old-' || n, '2026-09-07', 'Old', '🫖', 'regulars', 'Old news', 'Old tea.' from generate_series(1, 4) n;
insert into public.gossip_found (player_id, story_id, piece, via) select '00000000-0000-0000-0000-0000000000e2', 'test-tea', n, 'overheard' from generate_series(0, 4) n on conflict do nothing;
select pg_temp.assert(public.gossip_finish('00000000-0000-0000-0000-0000000000e2', 'test-tea'), 'the crewmate finishes too');
select pg_temp.assert(exists (select 1 from public.player_badges b where b.player_id = '00000000-0000-0000-0000-0000000000e2' and b.badge_id = 'tea-spiller'), 'five Tea cards: the badge');
select pg_temp.assert(not exists (select 1 from public.player_badges b where b.player_id = '00000000-0000-0000-0000-0000000000e1' and b.badge_id = 'tea-spiller'), 'one card: no badge yet');

-- A paused week disappears at once; the Tea card stays.
update public.gossip_weeks set status = 'paused';
set role authenticated;
select pg_temp.as_(1);
select pg_temp.assert(jsonb_array_length(public.gossip_state() -> 'stories') = 0 and jsonb_array_length(public.gossip_state() -> 'cards') = 1, 'paused: gone, card kept');

rollback;
\echo 'GOSSIP PLAY CHECKS PASSED'
