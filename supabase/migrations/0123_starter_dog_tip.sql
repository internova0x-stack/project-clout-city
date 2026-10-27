-- Starter Week (owner, Oct 27): consoling Sir Barksley, the billionaire's depressed dog in Astoria Park, pays a sizable
-- cash tip from his allowance (C$500) instead of 10 clout. starter_state() now pays a mission once whatever currency it
-- paid in before, so a player who already got the 10 clout isn't paid again.

update public.game_settings
   set value = jsonb_set(value, '{missions}', (
     select jsonb_agg(case when m ->> 'id' = 'park' then jsonb_build_object('id', 'park', 'cash', 500, 'clout', 0) else m end)
       from jsonb_array_elements(value -> 'missions') m))
 where key = 'starter';

create or replace function public.starter_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('starter');
  sp public.starter_progress;
  m jsonb;
  paid jsonb := '[]'::jsonb;
  fin jsonb := cfg -> 'finish';
  all_done boolean;
  finished boolean := false;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if not public.starter_active(uid) and not exists (select 1 from public.starter_progress where player_id = uid) then return null; end if;
  if public.starter_active(uid) then insert into public.starter_progress (player_id) values (uid) on conflict do nothing; end if;
  select * into sp from public.starter_progress where player_id = uid;
  for m in select jsonb_array_elements(cfg -> 'missions') loop
    if exists (select 1 from public.starter_marks where player_id = uid and mission = m ->> 'id')
       -- Once per mission, in any currency (the park mission changed from clout to cash in 0123).
       and not exists (select 1 from public.ledger where player_id = uid and kind = 'starter' and ref = m ->> 'id')
       and public.ledger_once(uid, case when (m ->> 'cash')::int > 0 then 'cash' else 'clout' end,
                              greatest((m ->> 'cash')::int, (m ->> 'clout')::int), 'starter', m ->> 'id') then
      update public.players set bank_cash = bank_cash + (m ->> 'cash')::int, clout = clout + (m ->> 'clout')::int where id = uid;
      paid := paid || jsonb_build_array(m);
    end if;
  end loop;
  all_done := (select count(*) from public.starter_marks where player_id = uid) >= jsonb_array_length(cfg -> 'missions');
  if all_done and sp.finished_at is null then
    update public.starter_progress set finished_at = now() where player_id = uid returning * into sp;
    if public.ledger_once(uid, 'cash', (fin ->> 'cash')::int, 'starter_finish', 'week') then
      update public.players set bank_cash = bank_cash + (fin ->> 'cash')::int where id = uid;
      insert into public.player_badges (player_id, badge_id, arc_id) values (uid, fin ->> 'badge', 'starter') on conflict do nothing;
      insert into public.player_items (player_id, sku, category, value, acquired)
      values (uid, fin ->> 'item', 'home', 0, 'earned') on conflict do nothing;
      finished := true;
    end if;
  end if;
  return jsonb_build_object(
    'done', coalesce((select jsonb_agg(mission) from public.starter_marks where player_id = uid), '[]'::jsonb),
    'startedAt', sp.started_at,
    'daysLeft', greatest(0, (cfg ->> 'days')::int - (public.ny_today() - (sp.started_at at time zone 'America/New_York')::date)),
    'active', public.starter_active(uid),
    'paid', paid,
    'finished', finished);
end;
$$;
revoke all on function public.starter_state() from public, anon;
grant execute on function public.starter_state() to authenticated;
