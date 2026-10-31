-- Scenario test for migration 0139 (weekly storylets with a veto window): players can't read or import them; a week's new
-- cards arrive scheduled and go live after the window; the Studio vetoes, pauses, restores and puts one live now; a card
-- that went live stays readable after a veto; a card already stored is never touched; with the autopilot off new cards
-- arrive paused. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.card(p_id text, p_family text default 'favor') returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'base', p_id, 'family', p_family, 'title', 'A test card', 'options', '[]'::jsonb)
$$;
create function pg_temp.st(p_id text) returns text language sql as $$
  select c ->> 'status' from jsonb_array_elements(public.admin_storylets() -> 'cards') c where c ->> 'id' = p_id
$$;
create function pg_temp.offered(p_id text) returns boolean language sql as $$
  select coalesce((select (c ->> 'offer')::boolean from jsonb_array_elements(public.storylets_live()) c where c -> 'card' ->> 'id' = p_id), false)
$$;
create function pg_temp.listed(p_id text) returns boolean language sql as $$
  select exists (select 1 from jsonb_array_elements(public.storylets_live()) c where c -> 'card' ->> 'id' = p_id)
$$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000013901'), ('00000000-0000-0000-0000-000000013902');
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000013901');

select pg_temp.assert((public.autopilot() ->> 'storylets')::boolean, 'the storylets autopilot is on by default');

-- ---- Private: players can't read the cards or call the server's functions ----
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000013902', false);
do $$ begin
  begin perform 1 from public.storylet_cards; raise exception 'FAIL: storylet_cards readable';
  exception when insufficient_privilege then null; end;
  begin perform public.storylets_live(); raise exception 'FAIL: storylets_live callable';
  exception when insufficient_privilege then null; end;
  begin perform public.content_import_storylets('2031-01-06', '[]'); raise exception 'FAIL: content_import_storylets callable';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert(pg_temp.raises($$select public.admin_storylets()$$, 'not_admin'), 'the Studio list is admins only');
select pg_temp.assert(pg_temp.raises($$select public.admin_storylet_set('x', 'veto')$$, 'not_admin'), 'decisions are admins only');
reset role;

-- ---- A week arrives: scheduled, 24 hours out, not offered yet ----
select pg_temp.assert(public.content_import_storylets('2031-01-06', jsonb_build_array(pg_temp.card('sl-a'), pg_temp.card('sl-b', 'temptation'), pg_temp.card('sl-c', 'windfall'))) = 3, 'three new cards');
select pg_temp.assert((select bool_and(status = 'scheduled' and live_at between now() + interval '23 hours' and now() + interval '25 hours') from public.storylet_cards), 'scheduled, live in 24 hours');
select pg_temp.assert(not pg_temp.listed('sl-a'), 'not offered during its window');
-- Again: nothing new, nothing changed.
select pg_temp.assert(public.content_import_storylets('2031-01-06', jsonb_build_array(pg_temp.card('sl-a'))) = 0, 'a stored card is never added twice');

-- ---- The window passes: live by itself ----
update public.storylet_cards set live_at = now() - interval '1 minute' where id in ('sl-a', 'sl-b');
select pg_temp.assert(pg_temp.offered('sl-a') and pg_temp.offered('sl-b'), 'live after the window');
select pg_temp.assert(not pg_temp.listed('sl-c'), 'the other is still waiting');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000013901', false);
select pg_temp.assert(pg_temp.st('sl-a') = 'live' and pg_temp.st('sl-c') = 'scheduled', 'the Studio sees live and scheduled');
-- Veto a live card: no longer offered, but still readable (open cards and histories find it); its veto is final.
select pg_temp.assert(public.admin_storylet_set('sl-a', 'veto') is not null, 'veto sl-a');
select pg_temp.assert(pg_temp.st('sl-a') = 'vetoed', 'vetoed');
select pg_temp.assert(pg_temp.raises($$select public.admin_storylet_set('sl-a', 'restore')$$, 'vetoed'), 'a live card''s veto is final');
-- Pause and restore.
select pg_temp.assert(public.admin_storylet_set('sl-b', 'pause') is not null, 'pause sl-b');
select pg_temp.assert(pg_temp.st('sl-b') = 'paused', 'paused');
select pg_temp.assert(public.admin_storylet_set('sl-b', 'restore') is not null, 'restore sl-b');
select pg_temp.assert(pg_temp.st('sl-b') = 'live', 'restored past its window: live again');
-- Veto during the window can be undone; Go live now skips the rest of the window.
select pg_temp.assert(public.admin_storylet_set('sl-c', 'veto') is not null, 'veto sl-c');
select pg_temp.assert(public.admin_storylet_set('sl-c', 'restore') is not null, 'restore sl-c');
select pg_temp.assert(pg_temp.st('sl-c') = 'scheduled', 'a veto in the window can be undone');
select pg_temp.assert(public.admin_storylet_set('sl-c', 'now') is not null, 'now sl-c');
select pg_temp.assert(pg_temp.st('sl-c') = 'live', 'live now');
select pg_temp.assert(pg_temp.raises($$select public.admin_storylet_set('sl-c', 'shout')$$, 'bad_action'), 'actions checked');
select pg_temp.assert(pg_temp.raises($$select public.admin_storylet_set('nope', 'veto')$$, 'not_found'), 'unknown card');
reset role;
select pg_temp.assert(pg_temp.listed('sl-a') and not pg_temp.offered('sl-a'), 'the vetoed live card stays readable, never offered');
select pg_temp.assert(pg_temp.offered('sl-b') and pg_temp.offered('sl-c'), 'the others are offered');

-- ---- Autopilot off: new cards arrive paused ----
update public.game_settings set value = value || '{"storylets": false}' where key = 'autopilot';
select pg_temp.assert(public.content_import_storylets('2031-01-13', jsonb_build_array(pg_temp.card('sl-d', 'loyalty'))) = 1, 'added');
select pg_temp.assert((select status = 'paused' from public.storylet_cards where id = 'sl-d'), 'held while the autopilot is off');
select pg_temp.assert(pg_temp.raises($$select public.content_import_storylets('2031-01-13', jsonb_build_array(pg_temp.card('sl-e', 'gossip')))$$, 'storylet_cards_family_check'), 'families checked');

rollback;
