-- Scenario test for migration 0092 (skill perks: skill gigs, invites, the club door and VIP floor from Dance).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.me() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false) $$;
create function pg_temp.lvl(p_skill text, p_practice int, p_idle int default 0) returns void language sql as $$
  insert into public.player_skills (player_id, skill, practice, best, last_practiced)
  values ('00000000-0000-0000-0000-0000000000a9', p_skill, p_practice, public.skill_level(p_practice), public.ny_today() - p_idle)
  on conflict (player_id, skill) do update set practice = excluded.practice, best = excluded.best, last_practiced = excluded.last_practiced $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a9');
set role authenticated; select pg_temp.me();
select 1 from public.create_player('perky', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100, clout = 10, bank_cash = 5000 where display_name = 'perky';

-- The rules list made it into the database.
select pg_temp.assert(jsonb_array_length((select value from public.game_settings where key = 'skill_perks')) = 27, '27 perks');
select pg_temp.assert(public.skill_perk('cooking-6') ->> 'pay' = '600', 'private chef pays C$600');

-- Helpers are internal.
set role authenticated; select pg_temp.me();
select pg_temp.assert(pg_temp.raises($$select public.skill_now('00000000-0000-0000-0000-0000000000a9', 'dance')$$, 'permission denied'), 'skill_now is internal');
select pg_temp.assert(pg_temp.raises($$select public.perk_access('00000000-0000-0000-0000-0000000000a9', 'vip')$$, 'permission denied'), 'perk_access is internal');

-- Nothing opens at level 0.
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('cooking-3')$$, 'skill_locked'), 'level 0 cannot cook for money');
select pg_temp.assert(pg_temp.raises($$select public.skill_invite_accept('charisma-3')$$, 'skill_locked'), 'level 0 gets no invites');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('charisma-3')$$, 'unknown_perk'), 'an invite is not a gig');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('nope-3')$$, 'unknown_perk'), 'unknown perk');
select pg_temp.assert((public.skill_perks_state() -> 'levels' ->> 'cooking')::int = 0, 'state: cooking 0');

-- Cooking 6 (60 practice): the private chef gig. Energy up front, pay on collect, once a week.
reset role; select pg_temp.lvl('cooking', 60); set role authenticated; select pg_temp.me();
select pg_temp.assert((public.skill_perks_state() -> 'levels' ->> 'cooking')::int = 6, 'state: cooking 6');
select public.skill_gig_take('cooking-6');
select pg_temp.assert((select energy from public.players where display_name = 'perky') = 50, 'took 50 Energy');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('cooking-3')$$, 'gig_active'), 'one skill gig at a time');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_collect('cooking-6')$$, 'not_ready'), 'not ready yet');
select pg_temp.assert(jsonb_array_length(public.skill_perks_state() -> 'gigs') = 1, 'state shows the gig');
reset role;
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
  select id, public.ny_today(), 'side', 'Board gig', 200, 10, 60, 0 from public.players where display_name = 'perky';
set role authenticated; select pg_temp.me();
select pg_temp.assert(pg_temp.raises(format('select public.accept_gig(%s)', (select id from public.gig_offers where title = 'Board gig')), 'gig_active'),
  'a board gig waits for the skill gig');
reset role;
update public.skill_gig_runs set ready_at = public.game_now() - interval '1 minute' where perk = 'cooking-6';
set role authenticated; select pg_temp.me();
select pg_temp.assert(public.skill_gig_collect('cooking-6') = 600, 'collect pays 600');
select pg_temp.assert((select bank_cash from public.players where display_name = 'perky') = 5600, 'C$600 in the bank');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_collect('cooking-6')$$, 'unknown_perk'), 'collected once');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('cooking-6')$$, 'gig_done_week'), 'once a week');
select pg_temp.assert((select count(*) from public.ledger l join public.players p on p.id = l.player_id
                        where p.display_name = 'perky' and l.kind = 'skill_gig') = 1, 'one ledger row (no clout below level 9)');
select 1 from public.skill_gig_take('cooking-3');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('cooking-6')$$, 'gig_done_week'), 'still done this week');

-- Cooking 9 pays clout too.
reset role;
update public.skill_gig_runs set ready_at = public.game_now() - interval '1 minute';
set role authenticated; select pg_temp.me();
select 1 from public.skill_gig_collect('cooking-3');
reset role; select pg_temp.lvl('cooking', 150); update public.players set energy = 100, clout = 10 where display_name = 'perky';
set role authenticated; select pg_temp.me();
select 1 from public.skill_gig_take('cooking-9');
reset role; update public.skill_gig_runs set ready_at = public.game_now() - interval '1 minute' where perk = 'cooking-9';
set role authenticated; select pg_temp.me();
select pg_temp.assert(public.skill_gig_collect('cooking-9') = 2000, 'celebrity dinner pays 2000');
select pg_temp.assert((select clout from public.players where display_name = 'perky') >= 110, 'and 100 clout');

-- Rust: 60 days idle at best 6 is level 4, and the level-6 gig closes again.
reset role; select pg_temp.lvl('photography', 60, 60); update public.players set energy = 100 where display_name = 'perky';
set role authenticated; select pg_temp.me();
select pg_temp.assert((public.skill_perks_state() -> 'levels' ->> 'photography')::int = 4, 'rusty photography is 4');
select pg_temp.assert(pg_temp.raises($$select public.skill_gig_take('photography-6')$$, 'skill_locked'), 'rust closes the gig');

-- Invites: clout once, a badge at level 9.
reset role; select pg_temp.lvl('charisma', 150); set role authenticated; select pg_temp.me();
select pg_temp.assert(public.skill_invite_accept('charisma-9') = 500, 'award show: 500 clout');
select pg_temp.assert(public.skill_invite_accept('charisma-9') = 0, 'once');
select pg_temp.assert(public.skill_invite_accept('charisma-3') = 50, 'lower invites still open');
select pg_temp.assert(exists (select 1 from public.player_badges b join public.players p on p.id = b.player_id
                               where p.display_name = 'perky' and b.badge_id = 'perk-charisma-9'), 'presenter badge');
select pg_temp.assert(not exists (select 1 from public.player_badges b join public.players p on p.id = b.player_id
                                   where p.display_name = 'perky' and b.badge_id = 'perk-charisma-3'), 'no badge below 9');
select pg_temp.assert(public.skill_perks_state() -> 'invites' ? 'charisma-9', 'state lists the invite');

-- Dance 3: past the exclusive club's door without the clout.
reset role; update public.players set clout = 10, at_place = null where display_name = 'perky';
set role authenticated; select pg_temp.me();
select pg_temp.assert(pg_temp.raises($$select public.travel('ultraviolet-society', 'taxi')$$, 'door_clout'), 'bouncer says no at Dance 0');
reset role; select pg_temp.lvl('dance', 15); set role authenticated; select pg_temp.me();
select pg_temp.assert(public.travel('ultraviolet-society', 'taxi') ->> 'place' = 'ultraviolet-society', 'Dance 3 gets in');
select pg_temp.assert(pg_temp.raises($$select public.use_guest_pass('ultraviolet-society')$$, 'no_pass'), 'pass check runs (no pass to spend)');

-- Dance 9: every club's VIP floor.
reset role;
select pg_temp.assert(public.vip_access((select id from public.players where display_name = 'perky'), 'velvet-static') is null, 'no VIP at Dance 3');
select pg_temp.lvl('dance', 150);
select pg_temp.assert(public.vip_access((select id from public.players where display_name = 'perky'), 'velvet-static') = 'skill', 'Dance 9 is VIP');
select pg_temp.assert(public.vip_access((select id from public.players where display_name = 'perky'), 'grind-and-gossip') is null, 'not a club, no VIP');

rollback;
\echo skill_perks.test.sql PASSED
