-- Clout for reading a story's blog post (owner, Oct 22): opening "Read the full post" pays 10 clout, once per post
-- (ledger 'story_read', ref = the beat), for a released beat the player can read (main stories, and side stories they
-- own or get with VIP). GAME_CONFIG.story.readClout mirrors the amount. story_feed() is 0115's plus `read` on each beat.
-- Safe to run more than once.

create or replace function public.read_post(p_beat text) returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.story_arcs;
  b jsonb;
  v_arc text;
  reward constant int := 10;
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '28000'; end if;
  select arc.id, bt into v_arc, b
    from public.story_arcs arc, jsonb_array_elements(arc.data -> 'beats') bt
   where bt ->> 'id' = p_beat limit 1;
  select * into a from public.story_arcs where id = v_arc;
  if a.id is null or b -> 'news' -> 0 ->> 'post' is null then raise exception 'unknown_beat' using errcode = '22023'; end if;
  if a.status <> 'active' or coalesce(b ->> 'status', 'active') <> 'active'
     or public.arc_day(a) is null or (b ->> 'day')::int > public.arc_day(a) then
    raise exception 'not_released' using errcode = '22023';
  end if;
  if not (a.type = 'main' or public.has_entitlement(uid, a.sku)) then raise exception 'locked' using errcode = '42501'; end if;
  if public.ledger_once(uid, 'clout', reward, 'story_read', p_beat) then
    update public.players set clout = clout + reward where id = uid;
    return reward;
  end if;
  return 0;
end;
$$;
revoke all on function public.read_post(text) from public, anon;
grant execute on function public.read_post(text) to authenticated;

create or replace function public.story_feed()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_t timestamptz := public.game_now();
  arcs jsonb := '[]';
  a public.story_arcs;
  sd int;
  entitled boolean;
  beats jsonb;
  preds jsonb;
  finished boolean;
  topics jsonb;
  upcoming jsonb;
begin
  perform public.claim_story_rewards(uid);
  for a in select * from public.story_arcs order by type, id loop
    sd := public.arc_day(a);
    continue when sd is null;
    entitled := a.type = 'main' or public.has_entitlement(uid, a.sku);
    finished := sd > public.arc_last_day(a);
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', b ->> 'id', 'day', (b ->> 'day')::int,
               'headline', b -> 'news' -> 0 ->> 'headline',
               'locked', not entitled,
               'seen', exists (select 1 from public.story_beats_seen s where s.player_id = uid and s.beat_id = b ->> 'id'))
             || case when entitled then jsonb_strip_nulls(jsonb_build_object(
                  'body', b -> 'news' -> 0 ->> 'body',
                  'post', b -> 'news' -> 0 ->> 'post',
                  'read', case when b -> 'news' -> 0 ->> 'post' is not null then exists (select 1 from public.ledger l where l.player_id = uid and l.kind = 'story_read' and l.ref = b ->> 'id') end,
                  'hook', b -> 'news' -> 0 ->> 'hook',
                  'previously', b -> 'news' -> 0 ->> 'previously',
                  'cardNote', b ->> 'card_note',
                  'evidence', b -> 'evidence',
                  'pointsAtAnswer', (b ->> 'points_at_answer')::boolean)) else '{}'::jsonb end
             order by (b ->> 'day')::int), '[]')
      into beats
      from jsonb_array_elements(a.data -> 'beats') b
     where coalesce(b ->> 'status', 'active') = 'active' and (b ->> 'day')::int <= sd;

    select coalesce(jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'id', p.pred ->> 'id', 'beatId', p.beat_id, 'question', p.pred ->> 'question', 'options', p.pred -> 'options',
               'reward', p.pred -> 'reward', 'closesAt', p.closes_at, 'revealsAt', p.reveals_at, 'revealBeat', p.pred ->> 'reveal_beat',
               'state', case when now_t <= p.closes_at then 'open'
                             when p.reveals_at is null or now_t < p.reveals_at then 'closed' else 'revealed' end,
               'myVote', v.option_id,
               'shadowGuess', g.option_id,
               -- Live results after voting, and for everyone once voting closes.
               'results', case when v.option_id is not null or now_t > p.closes_at then (
                   select jsonb_build_object('total', count(*), 'counts', coalesce(jsonb_object_agg(x.option_id, x.n), '{}'))
                     from (select option_id, count(*) as n from public.story_votes where prediction_id = p.pred ->> 'id' group by option_id) x
                 ) end,
               'correct', case when p.reveals_at is not null and now_t >= p.reveals_at
                                 and (not finished or v.option_id is not null or g.option_id is not null)
                               then p.pred ->> 'correct' end,
               'roast', case when p.reveals_at is not null and now_t >= p.reveals_at and v.option_id is not null and v.option_id <> p.pred ->> 'correct'
                             then p.pred -> 'roasts' ->> v.option_id end))
             order by p.beat_day), '[]')
      into preds
      from public.story_predictions() p
      left join public.story_votes v on v.player_id = uid and v.prediction_id = p.pred ->> 'id'
      left join public.story_shadow_guesses g on g.player_id = uid and g.prediction_id = p.pred ->> 'id'
     where p.arc_id = a.id;

    -- Owner, Oct 18: the feed lists every beat. Future beats come locked: their day, and the next one's headline only.
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x.id, 'day', x.day,
             'headline', case when x.rk = 1 then x.headline end)) order by x.day, x.id), '[]')
      into upcoming
      from (select b ->> 'id' as id, (b ->> 'day')::int as day, b -> 'news' -> 0 ->> 'headline' as headline,
                   dense_rank() over (order by (b ->> 'day')::int) as rk
              from jsonb_array_elements(a.data -> 'beats') b
             where coalesce(b ->> 'status', 'active') = 'active' and (b ->> 'day')::int > sd) x;

    arcs := arcs || jsonb_strip_nulls(jsonb_build_object(
      'id', a.id, 'title', a.data ->> 'title', 'type', a.type, 'kind', a.data ->> 'kind', 'tier', a.tier, 'sku', a.sku,
      'parent', a.parent_id, 'teaser', a.data ->> 'teaser', 'emoji', a.data ->> 'emoji', 'prompt', a.data ->> 'prompt',
      'day', sd, 'lastDay', public.arc_last_day(a), 'finished', finished, 'entitled', entitled,
      'beats', beats, 'upcoming', upcoming, 'predictions', preds, 'badges', a.data -> 'badges'));
  end loop;

  -- Up to two chatter topics, by priority; the latest phase wins within a topic.
  select coalesce(jsonb_agg(t order by (t ->> 'priority')::int desc), '[]') into topics from (
    select distinct on (effect ->> 'topic')
           jsonb_build_object('topic', effect ->> 'topic', 'phase', effect ->> 'phase', 'priority', coalesce((effect ->> 'priority')::int, 1),
                              'lines', (select data -> 'chatter' -> (effect ->> 'topic') -> (effect ->> 'phase') from public.story_arcs where id = arc_id)) as t
      from public.world_effects()
     where effect ->> 'type' = 'chatter_topic'
     order by effect ->> 'topic', beat_day desc
     limit 2
  ) s;

  return jsonb_build_object(
    'today', public.ny_today(),
    'arcs', arcs,
    'effects', (select coalesce(jsonb_agg(jsonb_build_object('arc', arc_id, 'beat', beat_id, 'effect', effect - 'add' - 'remove')), '[]')
                  from public.world_effects() where effect ->> 'type' in ('price_multiplier', 'availability', 'place_state', 'flag')),
    'events', (select coalesce(jsonb_agg(public.story_event(effect ->> 'spawn_event')), '[]')
                 from public.world_effects() where effect ->> 'type' = 'place_state' and effect ? 'spawn_event'),
    'tasks', (select coalesce(jsonb_agg(task || jsonb_build_object('arc', arc_id, 'done',
                       exists (select 1 from public.story_task_done d where d.player_id = uid and d.task_id = task ->> 'id'))), '[]')
                from public.story_tasks_today()),
    'chatter', topics,
    'badges', (select coalesce(jsonb_agg(jsonb_build_object('id', pb.badge_id, 'arc', pb.arc_id, 'earnedAt', pb.earned_at)), '[]')
                 from public.player_badges pb where pb.player_id = uid),
    'startedArcs', (select coalesce(jsonb_agg(id), '[]') from public.story_arcs a2 where public.arc_day(a2) is not null)
  );
end;
$$;
