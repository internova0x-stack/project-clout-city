-- 0173: Your Scene, step 3 (owner, Nov 21; docs/SCENE.md).
--   * Plaques: collecting the same move 10, 25 and 50 times pays 50, 150 and 400 clout (ledger 'scene_plaque', once each) and a
--     badge 'scene-<move>-<n>'.
--   * Residencies: a move's first plaque opens a week's residency at that move's places (one at a time): checking in there once
--     a New York day pays half the move's clout (ledger 'scene_residency'). scene_residency_take, scene_residency_checkin.
--   * Trending: three moves a week pay 1.5× (lib/scene.ts trendingFor; the server action sets it on start, scene_set_boost).
--   * Lola's Blotter: big moves (settings move.headline) post a 'win' line when collected, never for News opt-outs.
--   * Pushes: 'scene_ready' when a move is ready, 'scene_stale' an hour before it goes stale (push_scan_scene, run by the sender).
--   * The Clout Pass: a collected move earns 10 season XP (xp.scene).
--   * scene_context adds how often each move was collected and the residency.
-- Safe to run more than once.

insert into public.game_settings (key, value) values ('scene', '{"slots":[[1,2],[3,3],[5,4],[7,5]],"hypes":{"2":0,"8":2,"24":2,"72":3},"hypeGapMin":60,"staleAfter":{"2":4,"8":8,"24":12,"72":24},"stalePay":0.25,"missedHype":0.25,"pointsPer":0.2,"costPerRank":0.1,"crewHypeClout":5,"plaques":[{"at":10,"clout":50},{"at":25,"clout":150},{"at":50,"clout":400}],"residency":{"needs":10,"days":7,"pay":0.5},"sneak":{"confidence":{"integrity":0,"banHours":0,"extra":0},"namedrop":{"integrity":-3,"banHours":24,"extra":0},"bribe":{"integrity":-2,"banHours":0,"extra":0.5}},"moves":{"brunch-be-seen":{"places":["grind-and-gossip","ditmars-deli","feta-compli","schlep-and-schmear"],"hours":2,"cost":40,"energy":10,"clout":45,"score":"style","skill":"charisma","gated":false},"open-mic":{"places":["velvet-static","low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":15,"clout":50,"score":"stage","skill":"music","gated":false},"night-out":{"places":["velvet-static","hellgate-hall","the-sticky-floor","discount-disco"],"hours":8,"cost":120,"energy":20,"clout":130,"score":"nightlife","skill":"dance","gated":false},"photo-walk":{"places":["gantry-plaza","unisphere","hell-gate-park"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"street","skill":"photography","gated":false},"run-club":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":20,"clout":35,"score":"social","skill":"fitness","gated":false},"window-shop":{"places":["atelier-vernon","thread-count"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"style","skill":"photography","gated":false},"jazz-table":{"places":["low-light-lounge","brownstone-sessions"],"hours":8,"cost":90,"energy":10,"clout":110,"score":"nightlife","skill":"music","gated":false},"meteors-game":{"places":["meteor-park"],"hours":8,"cost":60,"energy":15,"clout":100,"score":"street","skill":"charisma","gated":false},"diner-court":{"places":["neon-spoon","still-a-dollar-slice"],"hours":2,"cost":25,"energy":5,"clout":35,"score":"social","skill":"gossip","gated":false},"chad-launch":{"places":["triborough-works","grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"status","skill":"hustle","gated":false},"tiff-collab":{"places":["gantry-plaza","grind-and-gossip"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"social","skill":"photography","gated":false},"dj-polaroid":{"places":["velvet-static","hellgate-hall"],"hours":2,"cost":15,"energy":10,"clout":40,"score":"nightlife","skill":"dance","gated":false},"barksley-bday":{"places":["hell-gate-park"],"hours":2,"cost":30,"energy":5,"clout":50,"score":"social","skill":"charisma","gated":false},"panel-speak":{"places":["triborough-works","queensboro-capital","skybridge-tower"],"hours":8,"cost":0,"energy":15,"clout":160,"score":"status","skill":"smarts","needs":{"rank":4},"gated":false,"headline":"{name} said “synergy” on a panel and nobody laughed. Growth."},"guest-lecture":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"smarts","needs":{"rank":5},"gated":false,"headline":"{name} gave a guest lecture. Thirty rows of students pretended to take notes."},"fundraiser":{"places":["ditmars-heights-rooftop"],"hours":24,"cost":800,"energy":15,"clout":280,"score":"status","skill":"charisma","needs":{"rank":4,"netWorth":50000},"gated":false,"headline":"{name} wrote a very large cheque at the fundraiser, where everyone could see it. Generous. Visible."},"talk-show":{"places":["clout-tower"],"hours":24,"cost":0,"energy":20,"clout":350,"score":"stage","skill":"charisma","needs":{"rank":5},"gated":false,"headline":"{name} went on the talk show and said something unforgettable. Nobody can agree what."},"rooftop-dinner":{"places":["ditmars-heights-rooftop","altitude-718","up-on-thirty"],"hours":8,"cost":200,"energy":10,"clout":140,"score":"nightlife","skill":"charisma","needs":{"rank":2},"gated":false},"crab-breakfast":{"places":["ditmars-heights-rooftop"],"hours":8,"cost":300,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":3},"gated":false,"headline":"{name} survived Prince Nassim’s golden crab breakfast. The crabs did not."},"car-auction":{"places":["boulevard-motors"],"hours":24,"cost":1500,"energy":10,"clout":320,"score":"status","skill":"hustle","needs":{"netWorth":100000},"gated":false,"headline":"{name} outbid Prince Nassim at the car auction. Sources say he bought the auction house out of spite."},"saffron-bday":{"places":["velvet-static","ultraviolet-society"],"hours":8,"cost":200,"energy":25,"clout":190,"score":"nightlife","skill":"dance","needs":{"rank":4},"gated":false,"headline":"{name} crashed Saffron Lux’s birthday. She called them “angel” nine times and their name zero."},"vale-front-row":{"places":["atelier-vernon"],"hours":8,"cost":250,"energy":10,"clout":210,"score":"style","skill":"photography","needs":{"rank":4},"gated":false,"headline":"{name} sat front row at Vale Sartorio. Vale did not clap. {name} did not clap. A connection."},"ruckus-listening":{"places":["velvet-static","hellgate-hall","real-clout-fm"],"hours":8,"cost":80,"energy":15,"clout":150,"score":"nightlife","skill":"music","needs":{"rank":2},"gated":false},"ruckus-radio":{"places":["real-clout-fm"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"gossip","needs":{"rank":3},"gated":false},"lunaria-drop":{"places":["real-clout-fm"],"hours":8,"cost":0,"energy":20,"clout":170,"score":"stage","skill":"music","needs":{"rank":5},"gated":false,"headline":"{name} was first to Lunaria’s 3 AM drop. Insiders call it “vaguely iconic”."},"brock-premiere":{"places":["clout-tower","reel-queens"],"hours":8,"cost":150,"energy":10,"clout":180,"score":"style","skill":"photography","needs":{"rank":4},"gated":false,"headline":"{name} walked the red carpet at Brock Squarejaw’s premiere. Brock insists he is 35."},"dunk-box":{"places":["meteor-park"],"hours":8,"cost":400,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":5},"gated":false,"headline":"{name} sat with Dunk Daniels at the Meteors. Dunk arrived in the seventh inning, in new sneakers."},"skyler-panel":{"places":["triborough-works","skybridge-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"status","skill":"smarts","needs":{"rank":2},"gated":false},"chardonnay-reunion":{"places":["clout-tower"],"hours":8,"cost":0,"energy":15,"clout":170,"score":"stage","skill":"gossip","needs":{"rank":4},"gated":false,"headline":"{name} survived Chardonnay Shade’s reunion taping. Barely. Sit near the exit next time."},"peyton-apology":{"places":["grind-and-gossip","feta-compli"],"hours":2,"cost":50,"energy":10,"clout":60,"score":"social","skill":"photography","needs":{"rank":2},"gated":false},"chase-stream":{"places":["glow-up-house"],"hours":8,"cost":0,"energy":25,"clout":150,"score":"stage","skill":"charisma","needs":{"rank":3},"gated":false},"duke-watches":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":5,"clout":300,"score":"status","skill":"photography","needs":{"netWorth":250000},"gated":false,"headline":"{name} viewed Duke Ledger’s watches in private. Nobody asked the price, or his age."},"mayor-ribbon":{"places":["city-hall-annex"],"hours":2,"cost":0,"energy":10,"clout":80,"score":"street","skill":"charisma","needs":{"rank":3},"gated":false},"brick-reading":{"places":["clout-tower","ditmars-library"],"hours":2,"cost":0,"energy":5,"clout":60,"score":"stage","skill":"smarts","needs":{"rank":2},"gated":false},"brunch-date":{"places":["grind-and-gossip","feta-compli","ditmars-deli"],"hours":2,"cost":60,"energy":10,"clout":80,"score":"social","skill":"charisma","gated":true},"speed-dating":{"places":["low-light-lounge","velvet-static"],"hours":2,"cost":30,"energy":10,"clout":50,"score":"social","skill":"charisma","gated":true},"revenge-glowup":{"places":["velvet-static","ditmars-heights-rooftop"],"hours":8,"cost":120,"energy":20,"clout":160,"score":"nightlife","skill":"dance","gated":true},"study-gram":{"places":["st-johnsons","queensborough-u","astoria-cc","ditmars-library"],"hours":2,"cost":0,"energy":10,"clout":45,"score":"social","skill":"smarts","gated":true},"greek-row":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":20,"energy":25,"clout":120,"score":"nightlife","skill":"dance","gated":true},"work-the-quad":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"social","skill":"charisma","gated":true},"investor-brunch":{"places":["feta-compli","grind-and-gossip","queensboro-capital"],"hours":8,"cost":150,"energy":10,"clout":170,"score":"status","skill":"hustle","gated":true},"launch-party":{"places":["ditmars-heights-rooftop","velvet-static"],"hours":24,"cost":1200,"energy":20,"clout":320,"score":"status","skill":"hustle","gated":true,"headline":"{name} threw a launch party with a sign that spelled their name right. A first for Queens."},"trading-pitch":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":20,"clout":260,"score":"status","skill":"hustle","needs":{"rank":3},"gated":true},"opening-bell":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":10,"clout":400,"score":"status","skill":"hustle","gated":true,"headline":"{name} rang the opening bell. The market did something. Their business posed for twenty minutes."},"demo-day":{"places":["triborough-works"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"status","skill":"smarts","gated":true},"tv-cameo":{"places":["clout-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"charisma","gated":true},"latte-art":{"places":["grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":55,"score":"stage","skill":"cooking","gated":true},"front-row-intern":{"places":["atelier-vernon"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"style","skill":"photography","gated":true},"promotion-drinks":{"places":["low-light-lounge","ditmars-heights-rooftop"],"hours":8,"cost":100,"energy":10,"clout":140,"score":"social","skill":"charisma","gated":true},"kiss-babies":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"charisma","gated":true},"spin-room":{"places":["campaign-hq","city-hall-annex"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"gossip","gated":true},"free-gallery":{"places":["atelier-vernon","gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":45,"score":"style","skill":"photography","gated":true},"sample-sale":{"places":["atelier-vernon"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"style","skill":"hustle","gated":true},"pool-party":{"places":["ditmars-heights-rooftop","altitude-718"],"hours":8,"cost":60,"energy":15,"clout":150,"score":"nightlife","skill":"fitness","gated":true},"candle-mic":{"places":["low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"music","gated":true},"festival-front":{"places":["flushing-meadows","hell-gate-park"],"hours":8,"cost":40,"energy":20,"clout":140,"score":"street","skill":"dance","gated":true},"charity-5k":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":20,"energy":25,"clout":70,"score":"social","skill":"fitness","gated":true},"publicity-stunt":{"places":["gantry-plaza","unisphere"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"hustle","gated":true}}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

update public.game_settings set value = jsonb_set(value, '{xp,scene}', '10'::jsonb), updated_at = now()
 where key = 'season_pass' and not (value -> 'xp' ? 'scene');

alter table public.scene_moves add column if not exists boost numeric not null default 1;

create table if not exists public.scene_residencies (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  move       text not null,
  started_at timestamptz not null default now(),
  until      timestamptz not null,
  last_paid  date
);
create index if not exists scene_residencies_idx on public.scene_residencies (player_id, until);
alter table public.scene_residencies enable row level security;
revoke all on public.scene_residencies from anon, authenticated;

/** Trending: the server's boost on a just-started move (1 to 1.5). */
create or replace function public.scene_set_boost(p_player uuid, p_id uuid, p_boost numeric) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_boost not between 1 and 1.5 then raise exception 'bad_boost' using errcode = '22023'; end if;
  update public.scene_moves set boost = p_boost where id = p_id and player_id = p_player and collected_at is null;
end;
$$;

/** 0172's collect, plus trending's boost, plaques, Lola's Blotter for big moves. */
create or replace function public.scene_collect(p_player uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  r public.scene_moves;
  mv jsonb;
  is_stale boolean;
  f numeric;
  hc numeric;
  c int;
  pts int;
  n int;
  pl jsonb;
  plaque jsonb := null;
  me public.players;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_moves where id = p_id and player_id = p_player and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if now() < r.ready_at then raise exception 'not_ready' using errcode = '22023'; end if;
  mv := cfg -> 'moves' -> r.move;
  is_stale := now() >= r.stale_at;
  f := greatest((cfg ->> 'stalePay')::numeric, 1 - (cfg ->> 'missedHype')::numeric * greatest(0, r.need - cardinality(r.hypes)));
  if is_stale then f := least(f, (cfg ->> 'stalePay')::numeric); end if;
  hc := case when r.hater is not null and r.hater_at <= now() and (r.dealt is null or r.dealt = 'rise') then coalesce(r.cut, 0) else 0 end;
  f := f * (1 - hc) * coalesce(r.boost, 1);
  c := round(coalesce((mv ->> 'clout')::int, 0) * f)::int;
  pts := round(c * (cfg ->> 'pointsPer')::numeric)::int;
  update public.scene_moves set collected_at = now(), stale = is_stale, clout = c, points = pts where id = p_id;
  if c > 0 and public.ledger_once(p_player, 'clout', c, 'scene', p_id::text) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  if mv ? 'skill' then perform public.skill_practice(p_player, mv ->> 'skill', 'scene:' || p_id); end if;
  -- Plaques: the 10th, 25th and 50th time.
  select count(*) into n from public.scene_moves where player_id = p_player and move = r.move and collected_at is not null;
  for pl in select x from jsonb_array_elements(cfg -> 'plaques') x loop
    if n = (pl ->> 'at')::int then
      if public.ledger_once(p_player, 'clout', (pl ->> 'clout')::int, 'scene_plaque', r.move || ':' || (pl ->> 'at')) then
        update public.players set clout = clout + (pl ->> 'clout')::int where id = p_player;
      end if;
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'scene-' || r.move || '-' || (pl ->> 'at'), 'scene') on conflict do nothing;
      plaque := pl;
    end if;
  end loop;
  -- Lola's Blotter for the big ones (not when it went stale).
  if mv ? 'headline' and not is_stale then
    select * into me from public.players where id = p_player;
    if me.id is not null and not coalesce(me.news_opt_out, false) then
      insert into public.choice_headlines (player_id, text, kind)
      values (p_player, left(replace(mv ->> 'headline', '{name}', '@' || me.display_name), 260), 'win');
    end if;
  end if;
  return jsonb_build_object('clout', c, 'points', pts, 'score', r.score, 'stale', is_stale, 'move', r.move, 'cut', hc,
    'boost', coalesce(r.boost, 1), 'count', n, 'plaque', plaque);
end;
$$;

/** Takes a week's residency for a move with its first plaque, at one of its places. Raises: no_plaque, has_residency, not_here, bad_move. */
create or replace function public.scene_residency_take(p_player uuid, p_move text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  mv jsonb := cfg -> 'moves' -> p_move;
  until_ts timestamptz;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if mv is null then raise exception 'bad_move' using errcode = '22023'; end if;
  if (select count(*) from public.scene_moves where player_id = p_player and move = p_move and collected_at is not null)
     < (cfg #>> '{residency,needs}')::int then
    raise exception 'no_plaque' using errcode = '22023';
  end if;
  if exists (select 1 from public.scene_residencies where player_id = p_player and until > now()) then
    raise exception 'has_residency' using errcode = '22023';
  end if;
  if not (mv -> 'places') ? coalesce((select at_place from public.players where id = p_player), '') then
    raise exception 'not_here' using errcode = '22023';
  end if;
  until_ts := now() + make_interval(days => (cfg #>> '{residency,days}')::int);
  insert into public.scene_residencies (player_id, move, until) values (p_player, p_move, until_ts);
  return jsonb_build_object('move', p_move, 'until', until_ts);
end;
$$;

/** Checks in at the residency: once a New York day, at one of the move's places. Raises: no_residency, not_here, done. */
create or replace function public.scene_residency_checkin(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  r public.scene_residencies;
  mv jsonb;
  c int;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_residencies where player_id = p_player and until > now() order by until desc limit 1 for update;
  if r.id is null then raise exception 'no_residency' using errcode = '22023'; end if;
  mv := cfg -> 'moves' -> r.move;
  if not (mv -> 'places') ? coalesce((select at_place from public.players where id = p_player), '') then
    raise exception 'not_here' using errcode = '22023';
  end if;
  if r.last_paid = public.ny_today() then raise exception 'done' using errcode = '22023'; end if;
  c := round((mv ->> 'clout')::int * (cfg #>> '{residency,pay}')::numeric)::int;
  update public.scene_residencies set last_paid = public.ny_today() where id = r.id;
  if public.ledger_once(p_player, 'clout', c, 'scene_residency', r.id || ':' || public.ny_today()) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  return jsonb_build_object('clout', c);
end;
$$;

/** Pushes: a move ready to collect, and one about to go stale (an hour before). Run by the push sender. */
create or replace function public.push_scan_scene() returns int
language plpgsql security definer set search_path = public
as $$
declare
  n int := 0;
  r record;
  cfg jsonb := public.game_settings_value('scene');
begin
  for r in
    select m.id, m.player_id, m.move, m.ready_at, m.stale_at from public.scene_moves m
     where m.collected_at is null and m.ready_at <= now() and m.stale_at > now() and m.ready_at > now() - interval '1 day'
  loop
    if r.stale_at <= now() + interval '1 hour' then
      perform public.push_enqueue(r.player_id, 'scene_stale', 'scenestale:' || r.id, '⏳ Going stale in under an hour',
        'Collect it now or it pays a quarter. Old news travels fast.', '/home?open=scene', r.stale_at);
    else
      perform public.push_enqueue(r.player_id, 'scene_ready', 'sceneready:' || r.id, '🎬 A move is ready to collect',
        'Your Scene has clout waiting. Collect it before it goes stale.', '/home?open=scene', r.stale_at);
    end if;
    n := n + 1;
  end loop;
  return n;
exception when others then return n;
end;
$$;

/** 0172's context, plus each move's collect count, trending's boost on running moves and the residency. */
create or replace function public.scene_context(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when p.id is null then null else jsonb_build_object(
    'at', p.at_place,
    'rank', public.scene_rank(p.id),
    'netWorth', public.net_worth(p.id),
    'bank', p.bank_cash,
    'energy', p.energy,
    'holding', public.choice_marked(p.id, 'holding'),
    'today', public.ny_today(),
    'boroughs', (select jsonb_agg(b) from (select 'queens' as b union select id from public.borough_gates where opened_at is not null) x),
    'skills', coalesce((select jsonb_object_agg(s.skill, public.skill_effective(s.practice, s.best, s.last_practiced))
                          from public.player_skills s where s.player_id = p.id), '{}'::jsonb),
    'moves', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'move', m.move, 'place', m.place, 'slot', m.slot, 'entry', m.entry,
                          'startedAt', m.started_at, 'readyAt', m.ready_at, 'staleAt', m.stale_at, 'hypes', to_jsonb(m.hypes), 'need', m.need,
                          'hater', case when m.hater_at <= now() then m.hater end,
                          'haterAt', case when m.hater_at <= now() then m.hater_at end,
                          'cut', case when m.hater_at <= now() then m.cut end, 'dealt', m.dealt, 'boost', m.boost)
                          order by m.slot)
                         from public.scene_moves m where m.player_id = p.id and m.collected_at is null), '[]'::jsonb),
    'rested', coalesce((select jsonb_agg(distinct m.move) from public.scene_moves m
                         where m.player_id = p.id and m.collected_at > now() - interval '3 days'), '[]'::jsonb),
    'bounced', coalesce((select jsonb_agg(b.move) from public.scene_bounces b where b.player_id = p.id and b.ny_date = public.ny_today()), '[]'::jsonb),
    'scores', coalesce((select jsonb_object_agg(x.score, x.pts) from
                         (select m.score, sum(m.points)::int as pts from public.scene_moves m
                           where m.player_id = p.id and m.collected_at is not null group by m.score) x), '{}'::jsonb),
    'collected', coalesce((select count(*) from public.scene_moves m where m.player_id = p.id and m.collected_at is not null), 0),
    'counts', coalesce((select jsonb_object_agg(x.move, x.n) from
                         (select m.move, count(*)::int as n from public.scene_moves m
                           where m.player_id = p.id and m.collected_at is not null group by m.move) x), '{}'::jsonb),
    'residency', (select jsonb_build_object('move', r.move, 'until', r.until, 'paidToday', r.last_paid = public.ny_today())
                    from public.scene_residencies r where r.player_id = p.id and r.until > now() order by r.until desc limit 1),
    'vouchers', coalesce((select jsonb_agg(b.npc order by b.favors desc) from public.npc_bonds b
                           where b.player_id = p.id and b.favors >= 2 and (b.burned_until is null or b.burned_until < public.ny_today())), '[]'::jsonb),
    'vouchFree', not exists (select 1 from public.scene_vouches v where v.player_id = p.id and v.at > now() - interval '7 days'),
    'crew', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'owner', o.display_name, 'move', m.move, 'place', m.place,
                          'hypes', cardinality(m.hypes), 'need', m.need, 'readyAt', m.ready_at) order by m.ready_at)
                       from public.scene_moves m join public.players o on o.id = m.player_id
                      where m.collected_at is null and m.ready_at > now() and cardinality(m.hypes) < m.need
                        and public.scene_crew(p.id, m.player_id)
                        and not exists (select 1 from public.scene_crew_hypes h where h.move_id = m.id and h.helper = p.id)), '[]'::jsonb)) end
  from (select 1) one
  left join public.players p on p.id = p_player and p.home_id is not null;
$$;

-- Start over clears the residency too.
create or replace function public.scene_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.scene_moves where player_id = new.player_id;
  delete from public.scene_bounces where player_id = new.player_id;
  delete from public.scene_vouches where player_id = new.player_id;
  delete from public.scene_residencies where player_id = new.player_id;
  return new;
exception when others then return new;
end;
$$;

revoke all on function public.scene_set_boost(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.scene_collect(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_residency_take(uuid, text) from public, anon, authenticated;
revoke all on function public.scene_residency_checkin(uuid) from public, anon, authenticated;
revoke all on function public.scene_context(uuid) from public, anon, authenticated;
revoke all on function public.push_scan_scene() from public, anon, authenticated;
grant execute on function public.push_scan_scene() to service_role;
