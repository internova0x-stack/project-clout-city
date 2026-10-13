-- v0.10 step 4 (docs/08-new-features-spec.md section 8; owner Oct 13): neighborhood gossip in the game.
--
-- A live story (from a running week, 0034) has five pieces, each at a place. "Listen in" there finds
-- the overheard ones, and tapping the regular finds theirs, inside the piece's city-clock window if it
-- has one; you have to be at the place. gossip_state() sends a player only the text of pieces they've
-- found: a missing piece is a hint (overheard or a regular, the kind of place, its neighborhood, its
-- hours), and only a story's first piece names its place, so every story has a start.
--
-- The fifth piece finishes the story once: Lola's write-up becomes a Tea card (a copy), the player
-- gets clout and Mood (ledger 'gossip', ref the story) and five finished stories earn the badge.
-- A found piece can be shared with the crew once; it counts as found for them (owner, Oct 13).

/** The stories findable now: from running weeks, for liveDays from their Monday. */
create function public.gossip_live() returns table (week date, story jsonb)
language sql stable security definer set search_path = public
as $$
  select g.week, s
    from public.gossip_weeks g, jsonb_array_elements(g.data -> 'stories') s
   where g.status = 'approved'
     and public.ny_today() >= g.week
     and public.ny_today() < g.week + ((public.city() -> 'economy' -> 'gossip' ->> 'liveDays')::int)
$$;
revoke all on function public.gossip_live() from public, anon, authenticated;

/** True when the city clock's hour is inside a piece's window ([from, to), wrapping past midnight). */
create function public.gossip_in_window(p_hours jsonb) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  h int := floor(public.city_minutes() / 60)::int;
  a int;
  b int;
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then return true; end if;
  a := (p_hours ->> 0)::int;
  b := (p_hours ->> 1)::int;
  return case when a < b then h >= a and h < b else h >= a or h < b end;
end;
$$;
revoke all on function public.gossip_in_window(jsonb) from public, anon, authenticated;

/** Finish a story for a player if all its pieces are found: the Tea card, clout and Mood once, the badge. */
create function public.gossip_finish(p_player uuid, p_story text) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  g jsonb := public.city() -> 'economy' -> 'gossip';
  st jsonb;
  wk date;
  v_clout int := (g ->> 'clout')::int;
  v_mood int := (g ->> 'mood')::int;
begin
  select l.story, l.week into st, wk from public.gossip_live() l where l.story ->> 'id' = p_story;
  if st is null then return false; end if;
  if (select count(*) from public.gossip_found where player_id = p_player and story_id = p_story) < jsonb_array_length(st -> 'pieces') then return false; end if;
  insert into public.gossip_cards (player_id, story_id, week, title, emoji, topic, headline, body)
  values (p_player, p_story, wk, st ->> 'title', st ->> 'emoji', st ->> 'topic', st -> 'tea' ->> 'headline', st -> 'tea' ->> 'body')
  on conflict do nothing;
  if not found then return false; end if;
  if public.ledger_once(p_player, 'clout', v_clout, 'gossip', p_story) then
    update public.players set clout = clout + v_clout, mood = least(100, mood + v_mood) where id = p_player;
  end if;
  if (select count(*) from public.gossip_cards where player_id = p_player) >= (g ->> 'badgeAfter')::int then
    insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'tea-spiller', 'gossip:' || p_story) on conflict do nothing;
  end if;
  return true;
end;
$$;
revoke all on function public.gossip_finish(uuid, text) from public, anon, authenticated;

/** What I can see: live stories with my found pieces in full and hints for the rest, and my Tea cards. */
create function public.gossip_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  places jsonb := public.city() -> 'places';
  live_days int := (public.city() -> 'economy' -> 'gossip' ->> 'liveDays')::int;
begin
  if not exists (select 1 from public.players where id = uid) then return null; end if;
  return jsonb_build_object(
    'stories', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.story ->> 'id', 'week', l.week, 'endsOn', l.week + live_days - 1,
        'title', l.story ->> 'title', 'topic', l.story ->> 'topic', 'emoji', l.story ->> 'emoji', 'teaser', l.story ->> 'teaser',
        'done', exists (select 1 from public.gossip_cards c where c.player_id = uid and c.story_id = l.story ->> 'id'),
        'pieces', (select jsonb_agg(
            case when f.piece is not null then jsonb_build_object(
                   'n', p.n - 1, 'found', true, 'text', p.x ->> 'text', 'place', p.x ->> 'place', 'source', p.x ->> 'source', 'via', f.via,
                   'shared', exists (select 1 from public.gossip_shares sh where sh.player_id = uid and sh.story_id = l.story ->> 'id' and sh.piece = p.n - 1))
                 else jsonb_build_object(
                   'n', p.n - 1, 'found', false, 'source', p.x ->> 'source', 'hours', p.x -> 'hours',
                   -- Only the first piece names its place; the rest say what kind of place and where.
                   'place', case when p.n = 1 then p.x ->> 'place' end,
                   'kind', (select pl -> 'tags' ->> 0 from jsonb_array_elements(places) pl where pl ->> 'id' = p.x ->> 'place'),
                   'area', (select pl ->> 'area' from jsonb_array_elements(places) pl where pl ->> 'id' = p.x ->> 'place'))
            end order by p.n)
          from jsonb_array_elements(l.story -> 'pieces') with ordinality p(x, n)
          left join public.gossip_found f on f.player_id = uid and f.story_id = l.story ->> 'id' and f.piece = p.n - 1)
      ) order by l.week, l.story ->> 'id') from public.gossip_live() l), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('storyId', c.story_id, 'week', c.week, 'title', c.title, 'emoji', c.emoji, 'topic', c.topic,
                        'headline', c.headline, 'body', c.body, 'earnedAt', c.earned_at) order by c.earned_at desc)
                      from public.gossip_cards c where c.player_id = uid), '[]'::jsonb)
  );
end;
$$;

/**
 * Listen in (p_via 'overheard') or ask the regular (p_via 'regular') at the place you're at. Finds
 * every piece of that kind here that's in its window, and finishes any story that completes.
 * Returns the found pieces, and whether more is said here at other hours.
 */
create function public.gossip_find(p_place text, p_via text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  r record;
  v_found jsonb := '[]'::jsonb;
  later jsonb := null;
  finished jsonb := '[]'::jsonb;
  sid text;
begin
  if p_via not in ('overheard', 'regular') then raise exception 'bad_via' using errcode = '22023'; end if;
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place then raise exception 'gossip_not_here' using errcode = '22023'; end if;
  for r in
    select l.story ->> 'id' as story, l.story ->> 'title' as title, p.n - 1 as piece, p.x
      from public.gossip_live() l, jsonb_array_elements(l.story -> 'pieces') with ordinality p(x, n)
     where p.x ->> 'place' = p_place and p.x ->> 'source' = p_via
       and not exists (select 1 from public.gossip_found f where f.player_id = uid and f.story_id = l.story ->> 'id' and f.piece = p.n - 1)
     order by l.week, l.story ->> 'id', p.n
  loop
    if public.gossip_in_window(r.x -> 'hours') then
      insert into public.gossip_found (player_id, story_id, piece, via) values (uid, r.story, r.piece, p_via) on conflict do nothing;
      v_found := v_found || jsonb_build_object('story', r.story, 'title', r.title, 'piece', r.piece, 'text', r.x ->> 'text',
        'count', (select count(*) from public.gossip_found f where f.player_id = uid and f.story_id = r.story));
    elsif later is null then
      later := r.x -> 'hours';
    end if;
  end loop;
  for sid in select distinct x ->> 'story' from jsonb_array_elements(v_found) x loop
    if public.gossip_finish(uid, sid) then finished := finished || to_jsonb(sid); end if;
  end loop;
  return jsonb_build_object('found', v_found, 'later', later, 'finished', finished);
end;
$$;

/** Share a piece I found with my crew, once: it counts as found for each of them. Returns how many got it. */
create function public.gossip_share(p_story text, p_piece int) returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int := 0;
  c uuid;
begin
  if not exists (select 1 from public.gossip_live() l where l.story ->> 'id' = p_story) then raise exception 'gossip_over' using errcode = '22023'; end if;
  if not exists (select 1 from public.gossip_found where player_id = uid and story_id = p_story and piece = p_piece) then
    raise exception 'gossip_not_found' using errcode = '22023';
  end if;
  insert into public.gossip_shares (player_id, story_id, piece) values (uid, p_story, p_piece) on conflict do nothing;
  if not found then raise exception 'gossip_shared' using errcode = '22023'; end if;
  for c in select id from public.crew_of(uid) loop
    insert into public.gossip_found (player_id, story_id, piece, via) values (c, p_story, p_piece, 'crew') on conflict do nothing;
    if found then
      n := n + 1;
      perform public.gossip_finish(c, p_story);
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.gossip_state() from public, anon;
grant execute on function public.gossip_state() to authenticated;
revoke all on function public.gossip_find(text, text) from public, anon;
grant execute on function public.gossip_find(text, text) to authenticated;
revoke all on function public.gossip_share(text, int) from public, anon;
grant execute on function public.gossip_share(text, int) to authenticated;
