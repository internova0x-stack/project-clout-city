-- Scenario test for migration 0055 (Studio Players: list, profile, ban and unban).
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
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000e' || n)::uuid $$;

insert into auth.users (id, email) values (pg_temp.id(1), 'boss@example.com'), (pg_temp.id(2), 'mia@example.com'), (pg_temp.id(3), 'zed@example.com');
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('apboss', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(2); select 1 from public.create_player('apmia', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.as_(3); select 1 from public.create_player('apzed', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
select public.payment_grant('evt_ap1', 'cs_ap1', 'pi_ap1', pg_temp.id(2), 'side_sarah_bird_momager_files', 299, 'usd');

-- Players can't read the list, a profile, or ban anyone.
set role authenticated; select pg_temp.as_(2);
select pg_temp.assert(pg_temp.raises($$select public.admin_players()$$, 'not_admin'), 'list is admin only');
select pg_temp.assert(pg_temp.raises($$select public.admin_player('00000000-0000-0000-0000-0000000000e3')$$, 'not_admin'), 'profile is admin only');
select pg_temp.assert(pg_temp.raises($$select public.admin_player_ban('00000000-0000-0000-0000-0000000000e3', true, 'x')$$, 'not_admin'), 'ban is admin only');

-- The admin: search, filters, a profile.
select pg_temp.as_(1);
select pg_temp.assert((public.admin_players('apmia') -> 'rows' -> 0 ->> 'email') = 'mia@example.com', 'search by handle finds the email');
select pg_temp.assert((public.admin_players('zed@') ->> 'total')::int = 1, 'search by email');
select pg_temp.assert((public.admin_players('ap', 'paying') -> 'rows' -> 0 ->> 'name') = 'apmia', 'paying filter');
select pg_temp.assert((public.admin_players('ap', 'no_home') -> 'rows' -> 0 ->> 'name') = 'apzed', 'never moved in');
select pg_temp.assert((public.admin_players('ap', 'all', 'spend') -> 'rows' -> 0 ->> 'name') = 'apmia', 'sort by spend');
create temp table prof as select public.admin_player(pg_temp.id(2)) j;
select pg_temp.assert((select (j -> 'numbers' ->> 'spendCents')::int from prof) = 299, 'spend on the profile');
select pg_temp.assert((select jsonb_array_length(j -> 'timeline') from prof) >= 3, 'a timeline: joined, moved in, the purchase and ledger lines');
select pg_temp.assert((select bool_or(e ->> 'type' = 'purchase') from prof, jsonb_array_elements(j -> 'timeline') e), 'the purchase is on it');
select pg_temp.assert((select bool_or(e ->> 'kind' = 'birth_lottery') from prof, jsonb_array_elements(j -> 'timeline') e), 'ledger lines are on it');
select pg_temp.assert((select not (j::text like '%"body"%') from prof), 'no message texts');

-- Ban and unban, logged; admins can't be banned.
select pg_temp.assert(pg_temp.raises($$select public.admin_player_ban('00000000-0000-0000-0000-0000000000e1', true, 'x')$$, 'is_admin'), 'no banning admins');
select public.admin_player_ban(pg_temp.id(2), true, 'Spam in chat');
select pg_temp.assert((public.admin_player(pg_temp.id(2)) -> 'profile' ->> 'banReason') = 'Spam in chat', 'banned with a reason');
select pg_temp.assert((public.admin_players('', 'banned') ->> 'total')::int = 1, 'banned filter');
select pg_temp.as_(2);
select pg_temp.assert((public.chat_status() ->> 'banned')::boolean, 'the player sees they are banned');
select pg_temp.as_(1);
select public.admin_player_ban(pg_temp.id(2), false, 'Appeal accepted');
select pg_temp.assert((public.admin_player(pg_temp.id(2)) -> 'profile' ->> 'banned')::boolean = false, 'unbanned');
select pg_temp.assert(jsonb_array_length(public.admin_player(pg_temp.id(2)) -> 'safety' -> 'actions') = 2, 'both actions logged');
reset role;

rollback;
\echo 'admin_players: ok'
