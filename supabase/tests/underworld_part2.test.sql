-- Scenario test for migration 0150 (the underworld, part 2): the Thursday table pays once a week through underworld_save;
-- weekly jobs arrive scheduled (or paused with the autopilot off), go live after their window, and the Studio's veto,
-- pause, restore and now behave like storylets'; the Charity Gala is Halo only, at the rooftop, once a week, and pays a
-- quarter of the gift as clout. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000150' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm = msg; end $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 3) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Saint', 'Middle', 'Admin'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
reset role;
insert into public.story_admins (user_id) values (pg_temp.u(3));

-- ---- The Thursday table pays through underworld_save, once a week by its ref ----
update public.players set bank_cash = 1000 where id = pg_temp.u(2);
select public.underworld_save(pg_temp.u(2), 0, '{"v":1}', -10, 0, 0, '[{"currency":"cash","amount":600,"kind":"underworld_table","ref":"table:2026-11-02"}]', 0, null);
select public.underworld_save(pg_temp.u(2), 1, '{"v":1}', 0, 0, 0, '[{"currency":"cash","amount":600,"kind":"underworld_table","ref":"table:2026-11-02"},{"currency":"cash","amount":5000,"kind":"underworld_table","ref":"table:2026-11-09"}]', 0, null);
select pg_temp.assert((select bank_cash from public.players where id = pg_temp.u(2)) = 1600, 'the table paid C$600 once, never over C$1,000');

-- ---- Weekly jobs: scheduled, live after the window, the Studio decides ----
select pg_temp.assert(public.content_import_underworld('2026-11-02', '[{"id":"w-test-a","title":"A"},{"id":"w-test-b","title":"B"}]') = 2, 'two jobs stored');
select pg_temp.assert(public.content_import_underworld('2026-11-02', '[{"id":"w-test-a","title":"changed"}]') = 0, 'a stored job is never touched');
select pg_temp.assert(jsonb_array_length(public.underworld_jobs_live()) = 0, 'nothing live inside the window');
update public.underworld_jobs set live_at = now() - interval '1 minute' where id = 'w-test-a';
select pg_temp.assert(jsonb_array_length(public.underworld_jobs_live()) = 1 and (public.underworld_jobs_live() -> 0 ->> 'offer')::boolean, 'live after its window');
select pg_temp.as_(pg_temp.u(1)::text);
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.admin_underworld_jobs()$$, 'not_admin'), 'players can''t see the Studio list');
do $$ begin
  begin perform public.underworld_jobs_live(); raise exception 'FAIL: underworld_jobs_live callable';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_(pg_temp.u(3)::text);
select pg_temp.assert(jsonb_array_length(public.admin_underworld_jobs()) = 2, 'the Studio lists both');
select public.admin_underworld_job_set('w-test-a', 'veto');
select public.admin_underworld_job_set('w-test-b', 'now');
reset role;
select pg_temp.assert((select jsonb_agg(x ->> 'offer' order by x -> 'job' ->> 'id') from jsonb_array_elements(public.underworld_jobs_live()) x) = '["false", "true"]'::jsonb,
  'a vetoed live job stays readable but is never offered; approved now is offered');
select pg_temp.as_(pg_temp.u(3)::text);
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.admin_underworld_job_set('w-test-a', 'restore')$$, 'vetoed'), 'a live job''s veto is final');
reset role;
update public.game_settings set value = value || '{"storylets": false}' where key = 'autopilot';
insert into public.game_settings (key, value) select 'autopilot', '{"storylets": false}' where not exists (select 1 from public.game_settings where key = 'autopilot');
select public.content_import_underworld('2026-11-09', '[{"id":"w-test-c"}]');
select pg_temp.assert((select status from public.underworld_jobs where id = 'w-test-c') = 'paused', 'held while the autopilot is off');

-- ---- The Charity Gala: Halo only, at the rooftop, once a week ----
insert into public.reputation (player_id, integrity, revealed_at) values (pg_temp.u(1), 80, now()), (pg_temp.u(2), 50, now())
on conflict (player_id) do update set integrity = excluded.integrity, revealed_at = excluded.revealed_at;
update public.players set bank_cash = 2000, clout = 0, mood = 50, at_place = 'ditmars-heights-rooftop' where id in (pg_temp.u(1), pg_temp.u(2));
set role authenticated;
select pg_temp.as_(pg_temp.u(2)::text);
select pg_temp.assert(not (public.gala_state() ->> 'invited')::boolean, 'the middle isn''t on the list');
select pg_temp.assert(pg_temp.raises($$select public.gala_donate(500)$$, 'not_invited'), 'Halo only');
select pg_temp.as_(pg_temp.u(1)::text);
select pg_temp.assert((public.gala_state() ->> 'invited')::boolean, 'a Halo is on the list');
select pg_temp.assert(pg_temp.raises($$select public.gala_donate(333)$$, 'bad_amount'), 'only the listed amounts');
select pg_temp.assert((public.gala_donate(500) ->> 'clout')::int = 125, 'a quarter of the gift as clout');
select pg_temp.assert(pg_temp.raises($$select public.gala_donate(100)$$, 'done_this_week'), 'once a week');
select pg_temp.assert((public.gala_state() ->> 'donated')::int = 500, 'the state shows the gift');
reset role;
select pg_temp.assert((select bank_cash = 1500 and clout = 125 and mood = 60 from public.players where id = pg_temp.u(1)), 'paid: cash, clout, Mood');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 82, 'the meter moved toward Halo');
update public.players set at_place = 'ditmars-deli' where id = pg_temp.u(1);
delete from public.ledger where player_id = pg_temp.u(1) and kind in ('gala', 'gala_donation');
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select pg_temp.assert(pg_temp.raises($$select public.gala_donate(100)$$, 'not_here'), 'only at the rooftop');
reset role;

rollback;
