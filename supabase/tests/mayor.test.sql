-- Scenario test for migration 0105 (Contact the Mayor: letters, the daily limit, the Studio's inbox and replies).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000b' || n)::uuid $$;

insert into auth.users (id) select pg_temp.id(n) from generate_series(1, 3) n;
set role authenticated;
select pg_temp.as_(1); select 1 from public.create_player('mayoradmin', 'bodega_drip', '{}', null, true);
select pg_temp.as_(2); select 1 from public.create_player('mayorfan', 'bodega_drip', '{}', null, true);
select pg_temp.as_(3); select 1 from public.create_player('mayorbanned', 'bodega_drip', '{}', null, true);
reset role;
insert into public.story_admins (user_id) values (pg_temp.id(1));
update public.players set at_place = 'lucky-seven-deli' where id = pg_temp.id(2);
update public.players set banned_at = now() where id = pg_temp.id(3);

set role authenticated; select pg_temp.as_(2);
select pg_temp.assert((public.mayor_letters_state() ->> 'left')::int = 5 and jsonb_array_length(public.mayor_letters_state() -> 'letters') = 0, 'five letters a day, none yet');

-- What it's about and how long it is are checked.
select pg_temp.assert(pg_temp.raises($$select public.mayor_write('rant', 'The subway is late again', null)$$, 'bad_kind'), 'kind checked');
select pg_temp.assert(pg_temp.raises($$select public.mayor_write('bug', 'short', null)$$, 'bad_message'), '10 characters at least');
select pg_temp.assert(pg_temp.raises($$select public.mayor_write('bug', repeat('a', 1001), null)$$, 'bad_message'), '1000 at most');

-- A letter: stored with where they were and their device, newest first.
select pg_temp.assert((public.mayor_write('bug', '  The Bank app shows the wrong balance  ', 'iPhone · Safari') ->> 'left')::int = 4, 'four left');
select pg_temp.assert(public.mayor_letters_state() -> 'letters' -> 0 ->> 'message' = 'The Bank app shows the wrong balance', 'trimmed');
select pg_temp.assert(public.mayor_letters_state() -> 'letters' -> 0 ->> 'status' = 'new', 'new');
select 1 from public.mayor_write('idea', 'A ferry to Staten Island please', null);
select 1 from public.mayor_write('praise', 'Sal is the best deli man in Queens', null);
select 1 from public.mayor_write('other', 'Hello from the N train again', null);
select 1 from public.mayor_write('complaint', 'Rent is too damn high in Astoria', null);
select pg_temp.assert(pg_temp.raises($$select public.mayor_write('idea', 'One more idea for the city', null)$$, 'daily_max'), 'five a day');

-- Players can't read the table or the inbox.
select pg_temp.assert(pg_temp.raises($$select count(*) from public.mayor_letters$$, 'permission denied'), 'table closed to players');
select pg_temp.assert(pg_temp.raises($$select public.admin_mayor_letters()$$, 'not_admin'), 'inbox is admin only');

-- Banned players can't write.
select pg_temp.as_(3);
select pg_temp.assert(pg_temp.raises($$select public.mayor_write('bug', 'Let me back in please', null)$$, 'not_allowed'), 'banned');

-- The inbox: five new letters, with the player's name, place and device.
select pg_temp.as_(1);
select pg_temp.assert((public.admin_mayor_letters('new') -> 'counts' ->> 'new')::int = 5, 'five new');
select pg_temp.assert(jsonb_array_length(public.admin_mayor_letters('new') -> 'letters') = 5, 'five listed');
select pg_temp.assert((select l ->> 'message' = 'The Bank app shows the wrong balance' and l -> 'player' ->> 'name' = 'mayorfan'
                         and l -> 'context' ->> 'place' = 'lucky-seven-deli' and l -> 'context' ->> 'device' = 'iPhone · Safari'
                         from jsonb_array_elements(public.admin_mayor_letters('all') -> 'letters') l where l ->> 'kind' = 'bug'), 'context kept');

-- Read, then done with a reply; done letters leave the open list.
reset role;
select set_config('mayor.bug', (select id::text from public.mayor_letters where kind = 'bug'), false);
set role authenticated; select pg_temp.as_(1);
select 1 from public.admin_mayor_letter(current_setting('mayor.bug')::bigint, 'read');
select pg_temp.assert((public.admin_mayor_letters() -> 'counts' ->> 'read')::int = 1, 'one read');
select pg_temp.assert(pg_temp.raises($$select public.admin_mayor_letter(current_setting('mayor.bug')::bigint, 'done', repeat('x', 1001))$$, 'bad_reply'), 'reply length');
select pg_temp.assert(pg_temp.raises($$select public.admin_mayor_letter(-1, 'done')$$, 'unknown_letter'), 'unknown letter');
select pg_temp.assert(jsonb_array_length(public.admin_mayor_letter(current_setting('mayor.bug')::bigint, 'done', 'Fixed in today''s update. Thanks!') -> 'letters') = 4, 'done leaves the open list');
select pg_temp.assert((public.admin_mayor_letters('all') -> 'counts' ->> 'done')::int = 1, 'one done');

-- The player sees the reply, with a dot until they open the app.
select pg_temp.as_(2);
select pg_temp.assert((public.mayor_letters_state() ->> 'unseen')::int = 1, 'one unseen reply');
select pg_temp.assert((select l ->> 'reply' = 'Fixed in today''s update. Thanks!' and l ->> 'status' = 'done'
                         from jsonb_array_elements(public.mayor_letters_state() -> 'letters') l where l ->> 'kind' = 'bug'), 'reply shown');
select public.mayor_seen();
select pg_temp.assert((public.mayor_letters_state() ->> 'unseen')::int = 0, 'seen');

-- A status change alone keeps the reply seen; a new reply shows again.
select pg_temp.as_(1);
select 1 from public.admin_mayor_letter(current_setting('mayor.bug')::bigint, 'read');
select pg_temp.as_(2);
select pg_temp.assert((public.mayor_letters_state() ->> 'unseen')::int = 0, 'status alone stays seen');
select pg_temp.as_(1);
select 1 from public.admin_mayor_letter(current_setting('mayor.bug')::bigint, 'done', 'Really fixed now.');
select pg_temp.as_(2);
select pg_temp.assert((public.mayor_letters_state() ->> 'unseen')::int = 1, 'new reply unseen');

\echo mayor: ok
rollback;
