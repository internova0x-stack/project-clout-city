-- v0.9 step 2 (owner, Oct 13, option A): each activity's Mood and Confidence once a day, everywhere.
-- Before, only the first thing a player did at a place each day lifted their stats, which made a
-- five-activity monument plaza mostly empty calories. Clout stays once a day per place.

create table public.action_uses (
  player_id uuid not null references public.players (id) on delete cascade,
  place_id  text not null,
  action_id text not null,
  ny_date   date not null,
  primary key (player_id, place_id, action_id, ny_date)
);
alter table public.action_uses enable row level security;
create policy "own action uses" on public.action_uses for select to authenticated using (player_id = auth.uid());

create or replace function public.do_action(p_place text, p_action text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a jsonb := public.place_action(p_place, p_action);
  v_kind text := a ->> 'kind';
  v_price int := coalesce((a ->> 'price')::int, 0);
  v_pay int := coalesce((a ->> 'pay')::int, 0);
  v_energy int := coalesce((a ->> 'energy')::int, 0);
  e jsonb := public.city() -> 'economy';
  today date := public.ny_today();
  me public.players;
  first_today boolean;
  first_action boolean;
  n int;
  v_clout int := 0;
  v_mood int := 0;
  v_conf int := 0;
  task_cash int;
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  av record;
  pm record;
  v_paid int;
  story_done jsonb := '[]';
begin
  if a is null then raise exception 'unknown_action' using errcode = '22023'; end if;
  -- Story places exist only once their arc has started; story-unlock actions need their effect.
  if place ->> 'story' is not null and not public.arc_started(place ->> 'story') then raise exception 'unknown_action' using errcode = '22023'; end if;
  if coalesce((a ->> 'storyUnlock')::boolean, false) and not public.story_unlocked(p_place, p_action) then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  select * into av from public.story_availability(place -> 'tags', null);
  if av.state = 'closed' then raise exception 'place_closed: %', av.reason using errcode = '22023'; end if;
  if av.state = 'restricted' and not coalesce(av.allow ? p_action, false) then raise exception 'place_restricted: %', av.reason using errcode = '22023'; end if;
  if v_kind = 'gigs' then return jsonb_build_object('openGigs', true); end if;
  -- Story prices change what players pay, never the clout (which uses the base price).
  select * into pm from public.story_price(place -> 'tags', 'visit_price');
  v_paid := round(v_price * pm.multiplier);
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  -- At zero Energy players can't visit, attend or work; meals always work.
  if v_energy > 0 and me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_paid then raise exception 'cant_afford' using errcode = '22023'; end if;

  insert into public.place_visits (player_id, place_id, ny_date) values (uid, p_place, today)
  on conflict (player_id, place_id, ny_date) do update set visits = public.place_visits.visits + 1
  returning visits into n;
  first_today := n = 1;
  -- v0.9: each activity once a day for Mood and Confidence (owner, Oct 13).
  insert into public.action_uses (player_id, place_id, action_id, ny_date) values (uid, p_place, p_action, today)
  on conflict do nothing;
  first_action := found;

  -- Clout once a day per place, by base price.
  if first_today and v_kind in ('visit', 'eat') then
    v_clout := coalesce((a ->> 'clout')::int,
                        round(((e ->> 'baseVisitClout')::int + v_price * (e ->> 'cloutPerDollar')::numeric) * public.clout_multiplier(me.mood, me.confidence)));
  end if;
  if first_action then
    v_mood := coalesce((a ->> 'mood')::int, 0);
    v_conf := coalesce((a ->> 'confidence')::int, 0);
  end if;

  update public.players
     set bank_cash = bank_cash - v_paid + v_pay,
         energy = least(100, greatest(0, energy - v_energy)),
         clout = clout + v_clout,
         mood = least(100, mood + v_mood),
         confidence = least(100, confidence + v_conf)
   where id = uid;
  if v_paid > 0 then perform public.ledger_once(uid, 'cash', -v_paid, v_kind, p_place || ':' || today || ':' || n); end if;
  if v_pay > 0 then perform public.ledger_once(uid, 'cash', v_pay, 'shift', p_place || ':' || today || ':' || n); end if;
  if v_clout > 0 then perform public.ledger_once(uid, 'clout', v_clout, 'visit', p_place || ':' || today); end if;

  task_cash := public.complete_task(uid, p_place, p_action);
  story_done := public.story_complete(uid, 'place', p_place, p_action);
  return jsonb_build_object('storyTasks', story_done, 'priceReason', pm.reason, 'cash', v_pay - v_paid + task_cash, 'clout', v_clout, 'energy', -v_energy, 'mood', v_mood,
                            'confidence', v_conf, 'firstToday', first_today, 'firstAction', first_action, 'taskCash', task_cash);
end;
$$;

