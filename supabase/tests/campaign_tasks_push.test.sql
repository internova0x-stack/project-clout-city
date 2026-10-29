-- Scenario test for migration 0128 (Campaign Mode part 2): campaign tasks pay through campaign_save once, inside their
-- cap; "Your poll results are in" is queued once per week, only once its results' New York day has come. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000012801');
set role authenticated;
select pg_temp.as_('00000000-0000-0000-0000-000000012801');
select public.create_player('Organizer', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']); select public.roll_birth_lottery(); select public.move_in('astoria_studio');
reset role;
update public.players set clout = 150 where id = '00000000-0000-0000-0000-000000012801';
insert into public.push_subscriptions (player_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-000000012801', 'https://push.example/campaign', 'k', 'a');

select public.campaign_begin('00000000-0000-0000-0000-000000012801', '20000000-0000-0000-0000-000000012801', 'starr', '{"phase":"planning"}', 0);

-- ---- Campaign tasks: 15 clout each, once; anything over 25 is refused ----
select public.campaign_save('00000000-0000-0000-0000-000000012801', '20000000-0000-0000-0000-000000012801', 1,
  format('{"phase":"waiting","recap":{"week":1,"revealOn":"%s"}}', public.ny_today() + 1)::jsonb, 2, 'running', null, null,
  '[{"currency":"clout","amount":15,"kind":"campaign_task","ref":"20000000-0000-0000-0000-000000012801:1:answer"},
    {"currency":"clout","amount":15,"kind":"campaign_task","ref":"20000000-0000-0000-0000-000000012801:1:answer"},
    {"currency":"clout","amount":90,"kind":"campaign_task","ref":"20000000-0000-0000-0000-000000012801:1:big"}]'::jsonb);
select pg_temp.assert((select clout from public.players where id = '00000000-0000-0000-0000-000000012801') = 165, 'one task paid, once');

-- ---- Poll results: not before their day ----
select public.push_scan_campaign();
select pg_temp.assert(not exists (select 1 from public.push_queue where kind = 'campaign_poll'), 'nothing before the morning');
update public.campaigns set state = jsonb_set(state, '{recap,revealOn}', to_jsonb((public.ny_today())::text)) where id = '20000000-0000-0000-0000-000000012801';
select public.push_scan_campaign();
select public.push_scan_campaign();
select pg_temp.assert((select count(*) from public.push_queue where kind = 'campaign_poll') = 1, 'one push for week 1, however often the scan runs');
select pg_temp.assert((select url from public.push_queue where kind = 'campaign_poll') = '/home?open=campaign', 'opens the campaign');
-- Once opened (planning again), nothing more for that week.
update public.campaigns set state = jsonb_set(state, '{phase}', '"planning"') where id = '20000000-0000-0000-0000-000000012801';
select public.push_scan_campaign();
select pg_temp.assert((select count(*) from public.push_queue where kind = 'campaign_poll') = 1, 'still one');
-- Players can't call the scan.
set role authenticated;
do $$ begin
  begin perform public.push_scan_campaign(); raise exception 'FAIL: push_scan_campaign callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo campaign_tasks_push: ok
rollback;
