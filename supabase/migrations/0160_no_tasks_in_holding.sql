-- No tasks from the bench (owner, Nov 3: "A player shouldn't be able to complete tasks while on the bench").
-- Every daily task is done through complete_task (actions at a place, gossip found, cooking at home, a class, an event).
-- Travel, gigs and activities were already refused in holding, but the 114½ Precinct itself stays open to the player
-- held there, so a task that landed at the precinct (its "report" action, a gossip lead there) could still be done.
-- complete_task now does nothing while the player is in holding: the action itself still happens, and the task waits
-- for them once they're out (or bailed). This is 0100's complete_task with that one line first.

create or replace function public.complete_task(p_player uuid, p_place text, p_action text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  t record;
  bonus int := (public.city() -> 'economy' -> 'dailyTasks' ->> 'bonus')::int;
  task_clout int := coalesce((public.city() -> 'economy' -> 'gossip' ->> 'taskClout')::int, 0);
  paid int := 0;
  counts jsonb := public.style_counts(p_player);
  full_min int := coalesce((public.style_settings() ->> 'fullMin')::int, 3);
begin
  -- 0160: nothing is done from the bench (owner, Nov 3).
  if public.choice_marked(p_player, 'holding') then return 0; end if;
  perform public.crew_went(p_player, p_place, p_action);
  select * into t from public.daily_tasks
   where player_id = p_player and ny_date = today and place_id = p_place and action_id = p_action and done_at is null
     and (kind not like 'style:%' or coalesce((counts ->> substr(kind, 7))::int, 0) >= full_min)
   order by slot limit 1 for update;
  if t.id is null then return 0; end if;
  update public.daily_tasks set done_at = now() where id = t.id;
  if t.kind = 'gossip' then
    if task_clout > 0 and public.ledger_once(p_player, 'clout', task_clout, 'daily_task', t.id::text) then
      update public.players set clout = clout + task_clout where id = p_player;
    end if;
  elsif public.ledger_once(p_player, 'cash', t.reward, 'daily_task', t.id::text) then
    update public.players set bank_cash = bank_cash + t.reward where id = p_player;
    paid := t.reward;
  end if;
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today and done_at is null)
     and public.ledger_once(p_player, 'cash', bonus, 'daily_bonus', today::text) then
    update public.players set bank_cash = bank_cash + bonus where id = p_player;
    paid := paid + bonus;
  end if;
  return paid;
end;
$$;

revoke all on function public.complete_task(uuid, text, text) from public, anon, authenticated;
