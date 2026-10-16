-- Skill tasks (owner, Oct 16): "Let at least one of the daily tasks be skill based. Show the skill level and
-- progress on the card. For example 'Level up your cooking skills by cooking at xyz today'."
--   * daily_tasks gains skill: the skill a task levels up (null for other tasks).
--   * ensure_daily: after the gossip leads, one task is a skill task. A skill is picked at random from those
--     with somewhere to train today, then a place that trains it (0056's practice rules): cooking at home
--     (kind 'cook', place 'home'), a shift for hustle, or a place whose tags train a skill (gyms and parks
--     fitness, libraries and campuses smarts, monuments and rooftops photography, lounges music, clubs dance).
--     The rest of the list never repeats its place.
--   * cook(): cooking at home completes the cooking task (complete_task 'home' 'cook'), paying as usual.
-- Today's lists already made stay as they are; tomorrow's have a skill task. Safe to run more than once.

alter table public.daily_tasks add column if not exists skill text;

create or replace function public.ensure_daily(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  c jsonb := public.city();
  dt jsonb := c -> 'economy' -> 'dailyTasks';
  g jsonb := c -> 'economy' -> 'gigs';
  rate int := (c -> 'economy' ->> 'shiftRate')::int;
  shift_energy int := (c -> 'economy' ->> 'shiftEnergy')::int;
  cand record;
  v_slot int := 0;
  v_tier text;
  t jsonb;
  rolls int;
  titles jsonb;
  lead record;
  gossip_max int := coalesce((c -> 'economy' -> 'gossip' ->> 'tasksPerDay')::int, 0);
  me_clout bigint := coalesce((select clout from public.players where id = p_player), 0);
  sk record;
begin
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today) then
    -- v0.11: up to tasksPerDay tasks send the player to their next gossip piece (one per story, never
    -- two at the same place). Talking to a regular comes first; the rest of the list fills the five.
    for lead in
      select * from (select distinct on (gl.place) gl.* from public.gossip_leads(p_player) gl
                      order by gl.place, (gl.source = 'regular') desc, gl.story) one_per_place
       order by (source = 'regular') desc, random()
    loop
      exit when v_slot >= gossip_max;
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, 'gossip', lead.place, 'gossip-' || lead.source,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end loop;
    -- 0063 (owner, Oct 16): one task levels up a skill. A skill at random (one with somewhere to train it today),
    -- then a place that trains it: cooking at home, a shift for hustle, or a place whose tags train a skill.
    select * into sk from (
      with cands as (
        select * from (
          select 'cook' as kind, 'home' as place_id, 'cook' as action_id, 'cooking' as skill
          union all
          select a ->> 'kind', p ->> 'id', a ->> 'id',
                 case when a ->> 'kind' = 'shift' then 'hustle' else public.skill_for_place(p ->> 'id') end
            from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
           where a ->> 'kind' <> 'gigs'
             and p ->> 'story' is null
             and not coalesce((a ->> 'storyUnlock')::boolean, false)
             and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
             and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
        ) x
        where x.skill is not null
          and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = x.place_id)
      ),
      pick as (select skill from (select distinct skill from cands) d order by random() limit 1)
      select cands.* from cands join pick using (skill) order by random() limit 1
    ) q;
    if sk.place_id is not null then
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward, skill)
      values (p_player, today, v_slot, sk.kind, sk.place_id, sk.action_id,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5), sk.skill);
    end if;
    -- Every place action except the gigs board, plus each club event; only places that exist.
    for cand in
      select * from (
        select a ->> 'kind' as kind, p ->> 'id' as place_id, a ->> 'id' as action_id
          from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
         where a ->> 'kind' <> 'gigs'
           -- Never a closed or restricted place, a story place or a story-unlock action, so no task is impossible.
           and p ->> 'story' is null
           and not coalesce((a ->> 'storyUnlock')::boolean, false)
           and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
           -- #19 (0046): never a club whose bouncer would turn this player away.
           and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
        union all
        select 'event', e ->> 'placeId', e ->> 'id' from jsonb_array_elements(c -> 'events') e
         where coalesce((select (p -> 'club' ->> 'doorClout')::int from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId'), 0) <= me_clout
           and (select state from public.story_availability(
                  (select p -> 'tags' from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId') || jsonb_build_array(e ->> 'id'), null)) <> 'closed'
      ) all_actions
      where not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = all_actions.place_id)
      order by random()
      limit (dt ->> 'count')::int - v_slot
    loop
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, cand.kind, cand.place_id, cand.action_id,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end loop;
  end if;

  if not exists (select 1 from public.gig_offers where player_id = p_player and ny_date = today) then
    foreach v_tier in array array['side', 'pro', 'big'] loop
      t := g -> v_tier;
      titles := c -> 'gigs' -> v_tier;
      rolls := case when v_tier = 'side' then 2 else 1 end;
      for i in 1..rolls loop
        if random() < (t ->> 'chance')::numeric then
          insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
          values (p_player, today, v_tier,
                  titles ->> floor(random() * jsonb_array_length(titles))::int,
                  10 * round(rate * ((t ->> 'payMin')::numeric + random() * ((t ->> 'payMax')::numeric - (t ->> 'payMin')::numeric)) / 10),
                  round(shift_energy * (t ->> 'energy')::numeric),
                  (t ->> 'waitMinutes')::int,
                  (t ->> 'confidence')::int);
        end if;
      end loop;
    end loop;
  end if;

  -- Story gigs injected by a beat today (task_injection "gigs"), under the normal gig rules.
  insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, story_id)
  select p_player, today, sg ->> 'tier', sg ->> 'title',
         10 * round(rate * coalesce((sg ->> 'pay_multiple')::numeric, (g -> (sg ->> 'tier') ->> 'payMin')::numeric) / 10),
         round(shift_energy * coalesce((sg ->> 'energy_multiple')::numeric, (g -> (sg ->> 'tier') ->> 'energy')::numeric)),
         coalesce((sg ->> 'wait_minutes')::int, (g -> (sg ->> 'tier') ->> 'waitMinutes')::int),
         coalesce((sg ->> 'confidence')::int, (g -> (sg ->> 'tier') ->> 'confidence')::int),
         sg ->> 'id'
    from public.world_effects() w
   cross join lateral jsonb_array_elements(coalesce(w.effect -> 'gigs', '[]')) sg
   where w.effect ->> 'type' = 'task_injection'
     and not exists (select 1 from public.gig_offers o where o.player_id = p_player and o.ny_date = today and o.story_id = sg ->> 'id');
end;
$$;

create or replace function public.cook()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c jsonb := public.city() -> 'economy' -> 'groceries' -> 'cook';
  me public.players;
  v_energy int;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is not null then raise exception 'not_home' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  if me.fridge_meals < 1 then raise exception 'fridge_empty' using errcode = '22023'; end if;
  if me.energy >= 100 then raise exception 'full_energy' using errcode = '22023'; end if;
  v_energy := least(100 - me.energy, (c ->> 'energy')::int);
  update public.players set fridge_meals = fridge_meals - 1, energy = energy + v_energy where id = uid;
  -- 0063: cooking at home completes today's "level up your cooking" task.
  return jsonb_build_object('energy', v_energy, 'meals', me.fridge_meals - 1, 'taskCash', public.complete_task(uid, 'home', 'cook'));
end;
$$;
