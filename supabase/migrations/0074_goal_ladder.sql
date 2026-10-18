-- 0074: the long goal ladder (docs/08-new-features-spec.md section 19; owner, Oct 18): 25 goals in ten chapters, one
-- per rank's clout (lib/ranks.ts), so most goals open as clout grows. Pro gigs come before a better apartment, and
-- owning a home is a long-run goal (15,000 clout, 1,500 clout reward).
--   * game_settings 'goals' now holds the ladder as entries {id, unlock, reward, lean, tags, check} (lib/goals.ts GOALS).
--   * goal_list reads each entry's check; goal_current suggests the first unfinished goal the player's clout has
--     unlocked, else 'next_chapter' (the clout that opens the next one; it pays nothing), else null.
--   * A goal finished early (locked or not) still counts and pays, once (ledger clout 'goal', ref the goal id), so the
--     goals 0073 already paid stay paid; the ids that carry over keep their meaning.
--   * ensure_daily picks the two goal tasks from the entry's lean and tags; goal_settle pays from the entry's reward.

insert into public.game_settings (key, value) values ('goals', '{"ladder":[{"id":"first_purchase","unlock":0,"reward":25,"lean":"cash","tags":["boutique","shopping"],"check":{"type":"purchase"}},{"id":"first_shift","unlock":0,"reward":25,"lean":"cash","tags":[],"check":{"type":"shift"}},{"id":"full_day","unlock":0,"reward":50,"lean":"boost","tags":[],"check":{"type":"full_day"}},{"id":"first_gig","unlock":0,"reward":50,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig"}},{"id":"first_crew","unlock":100,"reward":75,"lean":"boost","tags":["club","nightlife"],"check":{"type":"crew","count":1}},{"id":"save_15k","unlock":100,"reward":75,"lean":"cash","tags":[],"check":{"type":"save","cash":15000}},{"id":"skill_3","unlock":100,"reward":75,"lean":"boost","tags":["gym","campus"],"check":{"type":"skill","level":3}},{"id":"pro_gigs","unlock":500,"reward":150,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig_tier","tier":"pro"}},{"id":"first_business","unlock":500,"reward":150,"lean":"cash","tags":[],"check":{"type":"business","id":"hot-dog-cart"}},{"id":"move_up","unlock":500,"reward":150,"lean":"cash","tags":[],"check":{"type":"home","home":"jackson_heights_1br"}},{"id":"first_car","unlock":1000,"reward":200,"lean":"cash","tags":["dealership","cars"],"check":{"type":"car"}},{"id":"move_sunnyside","unlock":1000,"reward":200,"lean":"cash","tags":[],"check":{"type":"home","home":"sunnyside_gardens"}},{"id":"skill_5","unlock":1000,"reward":200,"lean":"boost","tags":["gym","campus"],"check":{"type":"skill","level":5}},{"id":"big_gigs","unlock":2000,"reward":300,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig_tier","tier":"big"}},{"id":"ultraviolet","unlock":2000,"reward":300,"lean":"boost","tags":["club","nightlife"],"check":{"type":"door","place":"ultraviolet-society"}},{"id":"bodega","unlock":2000,"reward":300,"lean":"cash","tags":[],"check":{"type":"business","id":"bodega"}},{"id":"vip_floor","unlock":5000,"reward":500,"lean":"boost","tags":["club","nightlife"],"check":{"type":"vip","level":"medium"}},{"id":"move_highrise","unlock":5000,"reward":500,"lean":"cash","tags":[],"check":{"type":"home","home":"lic_highrise"}},{"id":"own_home","unlock":15000,"reward":1500,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-astoria-townhouse"}},{"id":"laundromat","unlock":15000,"reward":750,"lean":"cash","tags":[],"check":{"type":"business","id":"laundromat"}},{"id":"penthouse","unlock":50000,"reward":2500,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-lic-penthouse"}},{"id":"cafe","unlock":50000,"reward":2500,"lean":"cash","tags":[],"check":{"type":"business","id":"cafe"}},{"id":"duplex","unlock":150000,"reward":5000,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-hunters-point-duplex"}},{"id":"taco_trucks","unlock":150000,"reward":5000,"lean":"cash","tags":[],"check":{"type":"business","id":"taco-trucks"}},{"id":"go_public","unlock":500000,"reward":10000,"lean":"boost","tags":[],"check":{"type":"public"}}],"goalTasksPerDay":2,"streak":{"freezesPerWeek":1,"day3Clout":50,"every":7,"collectibles":["home-neon-five-sign","home-trophy-shelf","home-employee-frame","home-streak-lava-lamp"],"fallbackClout":100}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

/**
 * Every goal on the ladder, in order: {id, unlock, done, parts, target}. A goal is done once its check holds or its
 * reward has been paid (so a goal stays done when Confidence drifts down or a car is sold).
 */
create or replace function public.goal_list(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  gs jsonb := public.goals_settings();
  e jsonb := public.economy();
  c jsonb := public.city();
  me public.players;
  v_out jsonb := '[]'::jsonb;
  g jsonb;
  chk jsonb;
  gid text;
  v_done boolean;
  v_parts jsonb;
  v_target text;
  v_n numeric;
  h jsonb;
  t jsonb;
  it jsonb;
  b jsonb;
begin
  select * into me from public.players where id = p_player;
  if me.id is null or gs is null then return '[]'::jsonb; end if;
  for g in select x from jsonb_array_elements(gs -> 'ladder') x loop
    gid := g ->> 'id';
    chk := g -> 'check';
    v_target := null;
    v_parts := '[]'::jsonb;
    case chk ->> 'type'
      when 'purchase' then
        v_done := exists (select 1 from public.player_items where player_id = p_player and acquired = 'bought')
               or exists (select 1 from public.ledger where player_id = p_player and currency = 'cash' and kind = 'purchase');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'shift' then
        v_done := exists (select 1 from public.ledger where player_id = p_player and currency = 'cash' and kind = 'shift');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'full_day' then
        v_done := exists (select 1 from public.ledger where player_id = p_player and kind = 'daily_bonus');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'gig' then
        v_done := exists (select 1 from public.gig_offers where player_id = p_player and collected_at is not null);
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'crew' then
        v_n := (select count(*) from public.invites where inviter_id = p_player);
        v_done := v_n >= (chk ->> 'count')::int;
        v_parts := jsonb_build_array(public.goal_part(v_n, (chk ->> 'count')::int, 'count'));
      when 'save' then
        v_done := me.bank_cash >= (chk ->> 'cash')::int;
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash, (chk ->> 'cash')::int, 'cash'));
      when 'skill' then
        v_n := coalesce((select max(best) from public.player_skills where player_id = p_player), 0);
        v_done := v_n >= (chk ->> 'level')::int;
        v_parts := jsonb_build_array(public.goal_part(v_n, (chk ->> 'level')::int, 'count'));
      when 'gig_tier' then
        t := c -> 'economy' -> 'gigs' -> (chk ->> 'tier');
        v_done := me.clout >= coalesce((t ->> 'clout')::int, 0) and me.confidence >= coalesce((t ->> 'confidence')::int, 0);
        v_parts := jsonb_build_array(public.goal_part(me.clout, coalesce((t ->> 'clout')::int, 0), 'clout'),
                                     public.goal_part(me.confidence, coalesce((t ->> 'confidence')::int, 0), 'confidence'));
      when 'business' then
        b := (select x from jsonb_array_elements(c -> 'economy' -> 'businesses' -> 'list') x where x ->> 'id' = chk ->> 'id');
        v_done := exists (select 1 from public.player_businesses where player_id = p_player and business_id = chk ->> 'id');
        v_target := chk ->> 'id';
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash, coalesce((b ->> 'price')::int, 0), 'cash'));
      when 'home' then
        -- That home or a better one (by rent; never a campus dorm), any house, or (move_up) moving up at all.
        h := (select x from jsonb_array_elements(e -> 'homes') x where x ->> 'id' = chk ->> 'home');
        v_done := me.house_sku is not null
               or (coalesce(public.rent_for(me.home_id), 0) >= (h ->> 'rent')::int
                   and not exists (select 1 from jsonb_array_elements(e -> 'homes') x where x ->> 'id' = me.home_id and x ? 'campus'))
               or (gid = 'move_up' and me.moved_up);
        v_target := chk ->> 'home';
        if coalesce((h ->> 'moveClout')::int, 0) > 0 then
          v_parts := v_parts || jsonb_build_array(public.goal_part(me.clout, (h ->> 'moveClout')::int, 'clout'));
        end if;
        v_parts := v_parts || jsonb_build_array(public.goal_part(me.bank_cash,
                     (h ->> 'rent')::int * (1 + coalesce((e -> 'moving' ->> 'brokerWeeks')::int, 1)), 'cash'));
      when 'car' then
        select i into it from jsonb_array_elements(c -> 'shop') i
         where i ->> 'category' = 'cars' and not coalesce((i ->> 'collector')::boolean, false) and not coalesce((i ->> 'reward')::boolean, false)
         order by (i ->> 'price')::int limit 1;
        v_done := me.car_sku is not null;
        v_target := it ->> 'sku';
        if it is not null then v_parts := jsonb_build_array(public.goal_part(me.bank_cash, (it ->> 'price')::int, 'cash')); end if;
      when 'house' then
        -- That house or a dearer one (owner, Oct 18: any house finishes "own a home").
        it := (select i from jsonb_array_elements(c -> 'shop') i where i ->> 'sku' = chk ->> 'sku');
        v_done := me.house_sku is not null
              and coalesce((select (i ->> 'price')::int from jsonb_array_elements(c -> 'shop') i where i ->> 'sku' = me.house_sku), 0)
                  >= coalesce((it ->> 'price')::int, 0);
        v_target := chk ->> 'sku';
        v_parts := jsonb_build_array(public.goal_part(me.bank_cash, coalesce((it ->> 'price')::int, 0), 'cash'));
      when 'door' then
        v_done := exists (select 1 from public.place_visits where player_id = p_player and place_id = chk ->> 'place');
        v_target := chk ->> 'place';
        v_parts := jsonb_build_array(public.goal_part(me.clout,
                     coalesce((select (p -> 'club' ->> 'doorClout')::int from jsonb_array_elements(c -> 'places') p where p ->> 'id' = chk ->> 'place'), 0), 'clout'));
      when 'vip' then
        -- Up to a VIP floor at a club of that level (0046's vip_seen, ledger clout 'vip', ref place:day).
        v_done := exists (select 1 from public.ledger l, jsonb_array_elements(c -> 'places') p
                           where l.player_id = p_player and l.kind = 'vip' and p -> 'club' ->> 'vip' = chk ->> 'level'
                             and l.ref like (p ->> 'id') || ':%');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'public' then
        v_done := exists (select 1 from public.player_businesses where player_id = p_player and went_public);
        v_parts := jsonb_build_array(public.goal_part(me.clout, coalesce((c -> 'economy' -> 'businesses' -> 'goPublic' ->> 'clout')::int, 0), 'clout'));
      else continue;
    end case;
    v_done := v_done or exists (select 1 from public.ledger where player_id = p_player and currency = 'clout' and kind = 'goal' and ref = gid);
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', gid, 'unlock', coalesce((g ->> 'unlock')::int, 0),
                                                           'done', v_done, 'parts', v_parts, 'target', v_target));
  end loop;
  return v_out;
end;
$$;

/**
 * The goal the game suggests ({id, parts, target}): the first unfinished goal the player's clout has unlocked; when
 * those are all done, 'next_chapter' (reach the clout that unlocks the next goals); null once the ladder is done.
 */
create or replace function public.goal_current(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_list jsonb := public.goal_list(p_player);
  v_clout bigint := coalesce((select clout from public.players where id = p_player), 0);
  v_goal jsonb;
  v_next int;
begin
  select g - 'done' - 'unlock' into v_goal from jsonb_array_elements(v_list) with ordinality x(g, n)
   where not (g ->> 'done')::boolean and (g ->> 'unlock')::int <= v_clout order by n limit 1;
  if v_goal is not null then return v_goal; end if;
  select min((g ->> 'unlock')::int) into v_next from jsonb_array_elements(v_list) g
   where not (g ->> 'done')::boolean and (g ->> 'unlock')::int > v_clout;
  if v_next is null then return null; end if;
  return jsonb_build_object('id', 'next_chapter', 'parts', jsonb_build_array(public.goal_part(v_clout, v_next, 'clout')), 'target', null);
end;
$$;

/** Pays each finished goal's clout once (ledger clout 'goal', ref the goal id), from its ladder entry. Returns the clout paid now. */
create or replace function public.goal_settle(p_player uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  gs jsonb := public.goals_settings();
  g jsonb;
  v_reward int;
  paid int := 0;
begin
  for g in select x from jsonb_array_elements(public.goal_list(p_player)) x where (x ->> 'done')::boolean loop
    v_reward := coalesce((select (d ->> 'reward')::int from jsonb_array_elements(gs -> 'ladder') d where d ->> 'id' = g ->> 'id'), 0);
    if v_reward > 0 and public.ledger_once(p_player, 'clout', v_reward, 'goal', g ->> 'id') then
      update public.players set clout = clout + v_reward where id = p_player;
      paid := paid + v_reward;
    end if;
  end loop;
  return paid;
end;
$$;

-- 0073's ensure_daily, with the goal tasks' lean and tags from the goal's ladder entry (and 'next_chapter' as a
-- clout goal).
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
         where coalesce((select (p -> 'club' ->> 'doorClout')::int from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId'), 0) <= me_clout
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

-- 0073's goals_state_for, with the suggested goal from goal_current (unlocks and 'next_chapter'), and the streak's
-- days and rewards for the Streaks section.
create or replace function public.goals_state_for(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  st jsonb := public.goals_settings() -> 'streak';
  v_list jsonb;
  s public.player_streaks;
  v_alive boolean;
  v_cur int;
  v_next int;
  v_tonight text;
begin
  perform public.goal_settle(p_player);
  v_list := public.goal_list(p_player);
  select * into s from public.player_streaks where player_id = p_player;
  -- A streak is alive through yesterday, or through the day before when this week's freeze can still cover the gap.
  v_alive := s.last_day is not null and (s.last_day >= today - 1
             or (s.last_day = today - 2 and coalesce((st ->> 'freezesPerWeek')::int, 0) > 0
                 and s.freeze_week is distinct from date_trunc('week', today - 1)::date));
  v_cur := case when v_alive then s.current else 0 end;
  v_next := case when v_cur < 3 then 3 else (v_cur / (st ->> 'every')::int + 1) * (st ->> 'every')::int end;
  select used_place into v_tonight from public.guest_passes where player_id = p_player and used_on = today order by id desc limit 1;
  return jsonb_build_object(
    'goal', public.goal_current(p_player),
    'done', coalesce((select jsonb_agg(g -> 'id' order by n) from jsonb_array_elements(v_list) with ordinality x(g, n) where (g ->> 'done')::boolean), '[]'::jsonb),
    'streak', jsonb_build_object(
      'current', v_cur, 'best', coalesce(s.best, 0), 'lastDay', s.last_day,
      -- 0074, the Streaks section (owner, Oct 18): the run's first day, the full days of the last five weeks (New
      -- York dates, the daily bonus's ref) and the rewards this run has paid.
      'startedOn', case when v_alive then s.started_on end,
      'days', coalesce((select jsonb_agg(l.ref order by l.ref) from public.ledger l
                         where l.player_id = p_player and l.kind = 'daily_bonus' and l.ref >= (today - 34)::text), '[]'::jsonb),
      'rewards', case when v_alive then coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'reward', r.reward, 'sku', r.sku) order by r.day)
                                                   from public.player_streak_rewards r where r.player_id = p_player and r.run = s.started_on), '[]'::jsonb)
                      else '[]'::jsonb end,
      'today', coalesce(s.last_day = today, false),
      'frozenThisWeek', coalesce(s.freeze_week = public.ny_week(), false),
      'next', jsonb_build_object('day', v_next, 'reward', coalesce(public.streak_reward_on(v_next), 'clout'))),
    'passes', jsonb_build_object(
      'held', (select count(*) from public.guest_passes where player_id = p_player and used_on is null),
      'tonight', case when v_tonight is null then null else jsonb_build_object('place', v_tonight) end));
end;
$$;

revoke all on function public.goal_list(uuid) from public, anon, authenticated;
revoke all on function public.goal_current(uuid) from public, anon, authenticated;
revoke all on function public.goal_settle(uuid) from public, anon, authenticated;
revoke all on function public.ensure_daily(uuid) from public, anon, authenticated;
revoke all on function public.goals_state_for(uuid) from public, anon, authenticated;
