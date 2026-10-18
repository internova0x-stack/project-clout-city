-- 0076: campus step 3b (v0.15; docs/08-new-features-spec.md section 18).
--   * "Go to class": enrolled students get it in their daily tasks (in place of the random one); attending any of the
--     week's classes completes it (campus_attend).
--   * Study dates: a date night on campus. The campuses have no meal to pay for, so a study date is free: going to the
--     campus (any action there) counts, as at any other date spot (date_visit_trigger).

-- 0075's ensure_daily, plus "Go to class" for students.
create or replace function public.ensure_daily(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  c jsonb := public.city();
  dt jsonb := c -> 'economy' -> 'dailyTasks';
  g jsonb := c -> 'economy' -> 'gigs';
  gs jsonb := public.goals_settings();
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
  goal_max int := coalesce((gs ->> 'goalTasksPerDay')::int, 0);
  me_clout bigint;
  sk record;
  v_goal jsonb;
  v_gid text;
  v_cash boolean;
  v_tags text[];
  v_def jsonb;
  v_campus text;
begin
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today) then
    -- 0073: finished goals pay their clout first (once each), so today's goal is the next one up. Only here, when
    -- the day's list is made (and in goals_state), never in the middle of another action's tick.
    if gs is not null then perform public.goal_settle(p_player); end if;
    me_clout := coalesce((select clout from public.players where id = p_player), 0);
    -- v0.11: up to tasksPerDay tasks send the player to their next gossip piece (one per story, never
    -- two at the same place). Talking to a regular comes first; the rest of the list fills the five.
    for lead in
      select * from (select distinct on (gl.place) gl.* from public.gossip_leads(p_player) gl
                      order by gl.place, (gl.source = 'regular') desc, gl.story) one_per_place
       order by (source = 'regular') desc, random()
    loop
      exit when v_slot >= gossip_max;
      -- 0066: never a lead in a borough that hasn't opened.
      continue when not public.place_open(lead.place);
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, 'gossip', lead.place, 'gossip-' || lead.source,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end loop;

    -- 0073 (owner, Oct 18): goal-linked tasks. Cash goals (and moving up, once its clout is there) get a shift,
    -- then a place that fits the goal (the dealership for a car), then free fun that leaves the savings alone;
    -- clout and Confidence goals get the places that give them, the goal's own kinds (gym, campus, club,
    -- monument) first. One of each kind before a second of any; never a place twice; same filters as below.
    v_goal := case when goal_max > 0 then public.goal_current(p_player) end;
    v_gid := v_goal ->> 'id';
    if v_gid is not null then
      -- 0074: each goal's lean and tags come from its ladder entry. A cash goal still short on clout or Confidence
      -- (a move with a clout bar) gets clout and Confidence places until that part is met.
      v_def := (select x from jsonb_array_elements(gs -> 'ladder') x where x ->> 'id' = v_gid);
      v_cash := coalesce(v_def ->> 'lean', 'boost') = 'cash'
            and not exists (select 1 from jsonb_array_elements(v_goal -> 'parts') pt
                             where pt ->> 'unit' in ('clout', 'confidence') and (pt ->> 'have')::numeric < (pt ->> 'need')::numeric);
      v_tags := coalesce(array(select jsonb_array_elements_text(v_def -> 'tags')), '{}');
      for cand in
        select * from (
          select *, row_number() over (partition by prio order by random()) as k from (
            select *, row_number() over (partition by place_id order by prio, random()) as n from (
              select a ->> 'kind' as kind, p ->> 'id' as place_id, a ->> 'id' as action_id,
                     case when v_cash then
                            case when a ->> 'kind' = 'shift' then 1
                                 when coalesce(p -> 'tags', '[]'::jsonb) ?| v_tags then 2
                                 when coalesce((a ->> 'price')::int, 0) = 0 then 3 end
                          when coalesce((a ->> 'confidence')::int, 0) > 0 or coalesce((a ->> 'clout')::int, 0) > 0 then
                            case when coalesce(p -> 'tags', '[]'::jsonb) ?| v_tags then 1 else 2 end
                     end as prio
                from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
               where a ->> 'kind' <> 'gigs'
                 and p ->> 'story' is null
                 and not coalesce((a ->> 'storyUnlock')::boolean, false)
                 and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
                 and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
                 and public.place_open(p ->> 'id')
            ) x
            where x.prio is not null
              and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = x.place_id)
          ) one_each
          where one_each.n = 1
        ) ranked
        order by k, prio
        limit goal_max
      loop
        v_slot := v_slot + 1;
        insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward, goal)
        values (p_player, today, v_slot, cand.kind, cand.place_id, cand.action_id,
                5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5), v_gid);
      end loop;
    end if;

    -- 0063 (owner, Oct 16): one task levels up a skill. A skill at random (one with somewhere to train it today),
    -- then a place that trains it: cooking at home, a shift for hustle, or a place whose tags train a skill.
    select * into sk from (
      with cands as (
        select * from (
          select 'cook' as kind, 'home' as place_id, 'cook' as action_id, 'cooking' as skill
          union all
          select a ->> 'kind', p ->> 'id', a ->> 'id',
                 case when a ->> 'kind' = 'shift' then 'hustle' else coalesce(a ->> 'skill', public.skill_for_place(p ->> 'id')) end
            from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
           where a ->> 'kind' <> 'gigs'
             and p ->> 'story' is null
             and not coalesce((a ->> 'storyUnlock')::boolean, false)
             and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
             and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
             and public.place_open(p ->> 'id')
        ) x
        where x.skill is not null
          and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = x.place_id)
      ),
      pick as (select skill from (select distinct skill from cands) d order by random() limit 1)
      select cands.* from cands join pick using (skill) order by random() limit 1
    ) q;
    if sk.place_id is not null and v_slot < (dt ->> 'count')::int then
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward, skill)
      values (p_player, today, v_slot, sk.kind, sk.place_id, sk.action_id,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5), sk.skill);
    end if;
    -- 0076 (v0.15): enrolled students get "Go to class" at their campus, in place of the random task. It's done by
    -- attending any of the week's classes (campus_attend).
    select en.campus into v_campus from public.campus_enrolments en where en.player_id = p_player;
    if v_campus is not null and v_slot < (dt ->> 'count')::int and public.place_open(v_campus)
       and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = v_campus) then
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, 'class', v_campus, 'class',
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end if;
    -- Every place action except the gigs board, plus each club event; only places that exist.
    for cand in
      select * from (select *, row_number() over (partition by place_id order by random()) as n from (select * from (
        select a ->> 'kind' as kind, p ->> 'id' as place_id, a ->> 'id' as action_id
          from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
         where a ->> 'kind' <> 'gigs'
           -- Never a closed or restricted place, a story place or a story-unlock action, so no task is impossible.
           and p ->> 'story' is null
           and not coalesce((a ->> 'storyUnlock')::boolean, false)
           and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
           -- #19 (0046): never a club whose bouncer would turn this player away.
           and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
           -- 0066: never a place in a borough that hasn't opened.
           and public.place_open(p ->> 'id')
        union all
        select 'event', e ->> 'placeId', e ->> 'id' from jsonb_array_elements(c -> 'events') e
         where (not e ? 'days' or exists (select 1 from jsonb_array_elements_text(e -> 'days') d where d::int = extract(isodow from today)::int))
           and coalesce((select (p -> 'club' ->> 'doorClout')::int from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId'), 0) <= me_clout
           and public.place_open(e ->> 'placeId')
           and (select state from public.story_availability(
                  (select p -> 'tags' from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId') || jsonb_build_array(e ->> 'id'), null)) <> 'closed'
      ) all_actions
      where not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = all_actions.place_id)
      ) candidates  -- 0066: one action per place (a place with several actions could otherwise come up twice)
      ) one_each where one_each.n = 1
      order by random()
      limit greatest(0, (dt ->> 'count')::int - v_slot)
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

-- 0072's campus_attend, plus today's "Go to class" task.
create or replace function public.campus_attend(p_course text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.campus_settings();
  a jsonb := s -> 'attend';
  en public.campus_enrolments := public.campus_here(uid);
  today date := public.ny_today();
  me public.players;
  v_clout int := 0;
  v_task int := 0;
begin
  if not exists (select 1 from public.campus_schedule where player_id = uid and week = public.ny_week() and course_id = p_course) then
    raise exception 'not_your_course' using errcode = '22023';
  end if;
  if exists (select 1 from public.campus_attendance where player_id = uid and course_id = p_course and day = today) then
    raise exception 'already_in_class' using errcode = '22023';
  end if;
  select * into me from public.players where id = uid;
  if me.energy < (a ->> 'energy')::int then raise exception 'no_energy' using errcode = '22023'; end if;
  insert into public.campus_attendance (player_id, course_id, day, campus) values (uid, p_course, today, en.campus);
  if public.ledger_once(uid, 'clout', (a ->> 'clout')::int, 'campus_class', p_course || ':' || today) then
    v_clout := (a ->> 'clout')::int;
  end if;
  update public.players
     set energy = greatest(0, energy - (a ->> 'energy')::int),
         confidence = least(100, confidence + (a ->> 'confidence')::int),
         clout = clout + v_clout
   where id = uid;
  perform public.skill_practice(uid, 'smarts', 'class:' || p_course || ':' || today);
  -- 0076: today's "Go to class" task.
  v_task := public.complete_task(uid, en.campus, 'class');
  return jsonb_build_object('clout', v_clout, 'confidence', (a ->> 'confidence')::int, 'energy', -(a ->> 'energy')::int,
    'streak', public.campus_streak(uid, p_course), 'taskCash', v_task);
end;
$$;

-- 0011's date_target, plus free study dates at the campuses.
create or replace function public.date_target(p_kind text, p_target text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case p_kind
    when 'place' then coalesce((
      select jsonb_build_object('placeId', p ->> 'id', 'price', (a ->> 'price')::int)
        from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
       where p ->> 'id' = p_target and a ->> 'kind' = 'eat'
         and (p ->> 'story' is null or public.arc_started(p ->> 'story'))
       limit 1), (
      select jsonb_build_object('placeId', p ->> 'id', 'price', 0)
        from jsonb_array_elements(public.city() -> 'places') p
       where p ->> 'id' = p_target and p -> 'tags' ? 'campus'
       limit 1))
    when 'event' then (
      select jsonb_build_object('placeId', e ->> 'placeId', 'price', (e ->> 'entry')::int)
        from jsonb_array_elements(public.city() -> 'events') e where e ->> 'id' = p_target)
  end
$$;

revoke all on function public.ensure_daily(uuid) from public, anon, authenticated;
revoke all on function public.date_target(text, text) from public, anon, authenticated;
revoke all on function public.campus_attend(text) from public, anon;
grant execute on function public.campus_attend(text) to authenticated;
