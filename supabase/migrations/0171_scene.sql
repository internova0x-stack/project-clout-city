-- 0171: Your Scene (owner, Nov 21; docs/SCENE.md, lib/scene.ts): the daily clout loop. A player has slots (2, then 3 at
-- Rank 3, 4 at Rank 5, 5 at Rank 7); a move is started at a place, builds in real time, longer ones want hyping (a check-in
-- at that place, an hour apart), and once ready it's collected for clout (ledger 'scene') and points on one of six scores.
-- Left past its window it goes stale and pays a quarter; each missed hype takes a quarter off.
--   * game_settings 'scene' is generated from lib/scene.ts `sceneSettings()` and content/scene/moves.json (tests/scene.test.ts
--     checks the two agree). Who a move is for (`when`, the Content Engine's memory) is checked by the server action
--     (app/home/sceneActions.ts) before it calls scene_start; this file checks the place, hours, holding, rank or money,
--     slots, Energy and the bank, and pays.
--   * Fake it till you make it (owner, Nov 21): short of a move's rank or money, a player may try to get in. The server action
--     rolls (crypto random) and passes the result: bounced spends the Energy (and a name-drop's 24-hour ban, choice_marks),
--     a bribe adds its price; both may nudge the Halo/Hustler meter (reputation). A bounced move can't be tried again that
--     New York day (scene_bounces). Invited players pay more as they rise: +10% a rank above the move's own.
--   * Every function is service role. Rate bucket 'scene' (40 a minute). Start over clears the player's Scene.
-- Safe to run more than once.

insert into public.game_settings (key, value) values ('scene', '{"slots":[[1,2],[3,3],[5,4],[7,5]],"hypes":{"2":0,"8":2,"24":2,"72":3},"hypeGapMin":60,"staleAfter":{"2":4,"8":8,"24":12,"72":24},"stalePay":0.25,"missedHype":0.25,"pointsPer":0.2,"costPerRank":0.1,"sneak":{"confidence":{"integrity":0,"banHours":0,"extra":0},"namedrop":{"integrity":-3,"banHours":24,"extra":0},"bribe":{"integrity":-2,"banHours":0,"extra":0.5}},"moves":{"brunch-be-seen":{"places":["grind-and-gossip","ditmars-deli","feta-compli","schlep-and-schmear"],"hours":2,"cost":40,"energy":10,"clout":45,"score":"style","skill":"charisma","gated":false},"open-mic":{"places":["velvet-static","low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":15,"clout":50,"score":"stage","skill":"music","gated":false},"night-out":{"places":["velvet-static","hellgate-hall","the-sticky-floor","discount-disco"],"hours":8,"cost":120,"energy":20,"clout":130,"score":"nightlife","skill":"dance","gated":false},"photo-walk":{"places":["gantry-plaza","unisphere","hell-gate-park"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"street","skill":"photography","gated":false},"run-club":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":20,"clout":35,"score":"social","skill":"fitness","gated":false},"window-shop":{"places":["atelier-vernon","thread-count"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"style","skill":"photography","gated":false},"jazz-table":{"places":["low-light-lounge","brownstone-sessions"],"hours":8,"cost":90,"energy":10,"clout":110,"score":"nightlife","skill":"music","gated":false},"meteors-game":{"places":["meteor-park"],"hours":8,"cost":60,"energy":15,"clout":100,"score":"street","skill":"charisma","gated":false},"diner-court":{"places":["neon-spoon","still-a-dollar-slice"],"hours":2,"cost":25,"energy":5,"clout":35,"score":"social","skill":"gossip","gated":false},"chad-launch":{"places":["triborough-works","grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"status","skill":"hustle","gated":false},"tiff-collab":{"places":["gantry-plaza","grind-and-gossip"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"social","skill":"photography","gated":false},"dj-polaroid":{"places":["velvet-static","hellgate-hall"],"hours":2,"cost":15,"energy":10,"clout":40,"score":"nightlife","skill":"dance","gated":false},"barksley-bday":{"places":["hell-gate-park"],"hours":2,"cost":30,"energy":5,"clout":50,"score":"social","skill":"charisma","gated":false},"panel-speak":{"places":["triborough-works","queensboro-capital","skybridge-tower"],"hours":8,"cost":0,"energy":15,"clout":160,"score":"status","skill":"smarts","needs":{"rank":4},"gated":false},"guest-lecture":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"smarts","needs":{"rank":5},"gated":false},"fundraiser":{"places":["ditmars-heights-rooftop"],"hours":24,"cost":800,"energy":15,"clout":280,"score":"status","skill":"charisma","needs":{"rank":4,"netWorth":50000},"gated":false},"talk-show":{"places":["clout-tower"],"hours":24,"cost":0,"energy":20,"clout":350,"score":"stage","skill":"charisma","needs":{"rank":5},"gated":false},"rooftop-dinner":{"places":["ditmars-heights-rooftop","altitude-718","up-on-thirty"],"hours":8,"cost":200,"energy":10,"clout":140,"score":"nightlife","skill":"charisma","needs":{"rank":2},"gated":false},"crab-breakfast":{"places":["ditmars-heights-rooftop"],"hours":8,"cost":300,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":3},"gated":false},"car-auction":{"places":["boulevard-motors"],"hours":24,"cost":1500,"energy":10,"clout":320,"score":"status","skill":"hustle","needs":{"netWorth":100000},"gated":false},"saffron-bday":{"places":["velvet-static","ultraviolet-society"],"hours":8,"cost":200,"energy":25,"clout":190,"score":"nightlife","skill":"dance","needs":{"rank":4},"gated":false},"vale-front-row":{"places":["atelier-vernon"],"hours":8,"cost":250,"energy":10,"clout":210,"score":"style","skill":"photography","needs":{"rank":4},"gated":false},"ruckus-listening":{"places":["velvet-static","hellgate-hall","real-clout-fm"],"hours":8,"cost":80,"energy":15,"clout":150,"score":"nightlife","skill":"music","needs":{"rank":2},"gated":false},"ruckus-radio":{"places":["real-clout-fm"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"gossip","needs":{"rank":3},"gated":false},"lunaria-drop":{"places":["real-clout-fm"],"hours":8,"cost":0,"energy":20,"clout":170,"score":"stage","skill":"music","needs":{"rank":5},"gated":false},"brock-premiere":{"places":["clout-tower","reel-queens"],"hours":8,"cost":150,"energy":10,"clout":180,"score":"style","skill":"photography","needs":{"rank":4},"gated":false},"dunk-box":{"places":["meteor-park"],"hours":8,"cost":400,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":5},"gated":false},"skyler-panel":{"places":["triborough-works","skybridge-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"status","skill":"smarts","needs":{"rank":2},"gated":false},"chardonnay-reunion":{"places":["clout-tower"],"hours":8,"cost":0,"energy":15,"clout":170,"score":"stage","skill":"gossip","needs":{"rank":4},"gated":false},"peyton-apology":{"places":["grind-and-gossip","feta-compli"],"hours":2,"cost":50,"energy":10,"clout":60,"score":"social","skill":"photography","needs":{"rank":2},"gated":false},"chase-stream":{"places":["glow-up-house"],"hours":8,"cost":0,"energy":25,"clout":150,"score":"stage","skill":"charisma","needs":{"rank":3},"gated":false},"duke-watches":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":5,"clout":300,"score":"status","skill":"photography","needs":{"netWorth":250000},"gated":false},"mayor-ribbon":{"places":["city-hall-annex"],"hours":2,"cost":0,"energy":10,"clout":80,"score":"street","skill":"charisma","needs":{"rank":3},"gated":false},"brick-reading":{"places":["clout-tower","ditmars-library"],"hours":2,"cost":0,"energy":5,"clout":60,"score":"stage","skill":"smarts","needs":{"rank":2},"gated":false},"brunch-date":{"places":["grind-and-gossip","feta-compli","ditmars-deli"],"hours":2,"cost":60,"energy":10,"clout":80,"score":"social","skill":"charisma","gated":true},"speed-dating":{"places":["low-light-lounge","velvet-static"],"hours":2,"cost":30,"energy":10,"clout":50,"score":"social","skill":"charisma","gated":true},"revenge-glowup":{"places":["velvet-static","ditmars-heights-rooftop"],"hours":8,"cost":120,"energy":20,"clout":160,"score":"nightlife","skill":"dance","gated":true},"study-gram":{"places":["st-johnsons","queensborough-u","astoria-cc","ditmars-library"],"hours":2,"cost":0,"energy":10,"clout":45,"score":"social","skill":"smarts","gated":true},"greek-row":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":20,"energy":25,"clout":120,"score":"nightlife","skill":"dance","gated":true},"work-the-quad":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"social","skill":"charisma","gated":true},"investor-brunch":{"places":["feta-compli","grind-and-gossip","queensboro-capital"],"hours":8,"cost":150,"energy":10,"clout":170,"score":"status","skill":"hustle","gated":true},"launch-party":{"places":["ditmars-heights-rooftop","velvet-static"],"hours":24,"cost":1200,"energy":20,"clout":320,"score":"status","skill":"hustle","gated":true},"trading-pitch":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":20,"clout":260,"score":"status","skill":"hustle","needs":{"rank":3},"gated":true},"opening-bell":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":10,"clout":400,"score":"status","skill":"hustle","gated":true},"demo-day":{"places":["triborough-works"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"status","skill":"smarts","gated":true},"tv-cameo":{"places":["clout-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"charisma","gated":true},"latte-art":{"places":["grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":55,"score":"stage","skill":"cooking","gated":true},"front-row-intern":{"places":["atelier-vernon"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"style","skill":"photography","gated":true},"promotion-drinks":{"places":["low-light-lounge","ditmars-heights-rooftop"],"hours":8,"cost":100,"energy":10,"clout":140,"score":"social","skill":"charisma","gated":true},"kiss-babies":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"charisma","gated":true},"spin-room":{"places":["campaign-hq","city-hall-annex"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"gossip","gated":true},"free-gallery":{"places":["atelier-vernon","gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":45,"score":"style","skill":"photography","gated":true},"sample-sale":{"places":["atelier-vernon"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"style","skill":"hustle","gated":true},"pool-party":{"places":["ditmars-heights-rooftop","altitude-718"],"hours":8,"cost":60,"energy":15,"clout":150,"score":"nightlife","skill":"fitness","gated":true},"candle-mic":{"places":["low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"music","gated":true},"festival-front":{"places":["flushing-meadows","hell-gate-park"],"hours":8,"cost":40,"energy":20,"clout":140,"score":"street","skill":"dance","gated":true},"charity-5k":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":20,"energy":25,"clout":70,"score":"social","skill":"fitness","gated":true},"publicity-stunt":{"places":["gantry-plaza","unisphere"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"hustle","gated":true}}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.scene_moves (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  move         text not null,
  place        text not null,
  slot         smallint not null,
  entry        text not null default 'invited' check (entry in ('invited', 'sneak')),
  score        text not null,
  need         smallint not null default 0,
  hypes        timestamptz[] not null default '{}',
  started_at   timestamptz not null default now(),
  ready_at     timestamptz not null,
  stale_at     timestamptz not null,
  collected_at timestamptz,
  stale        boolean,
  clout        int,
  points       int
);
create unique index if not exists scene_moves_slot_idx on public.scene_moves (player_id, slot) where collected_at is null;
create index if not exists scene_moves_player_idx on public.scene_moves (player_id, collected_at);
alter table public.scene_moves enable row level security;
revoke all on public.scene_moves from anon, authenticated;

create table if not exists public.scene_bounces (
  player_id uuid not null references public.players (id) on delete cascade,
  move      text not null,
  ny_date   date not null,
  way       text not null,
  primary key (player_id, move, ny_date)
);
alter table public.scene_bounces enable row level security;
revoke all on public.scene_bounces from anon, authenticated;

/** The player's rank: the best reached, or what clout or net worth gives now. */
create or replace function public.scene_rank(p_player uuid) returns int
language sql stable security definer set search_path = public
as $$
  select greatest(coalesce(p.best_rank, 1), public.rank_level(p.clout, public.net_worth(p.id)))::int
    from public.players p where p.id = p_player
$$;

/** Slots for a rank (settings 'scene'.slots: [[from rank, slots], …]). */
create or replace function public.scene_slots(p_rank int) returns int
language sql stable security definer set search_path = public
as $$
  select coalesce((select (s ->> 1)::int from jsonb_array_elements(public.game_settings_value('scene') -> 'slots') s
                    where (s ->> 0)::int <= p_rank order by (s ->> 0)::int desc limit 1), 2)
$$;

/** What the server needs: where the player is, rank, money, Energy, holding, the open boroughs, skills, the running moves,
 *  what rests, today's bounces and each score's points. */
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
                          'startedAt', m.started_at, 'readyAt', m.ready_at, 'staleAt', m.stale_at, 'hypes', to_jsonb(m.hypes), 'need', m.need)
                          order by m.slot)
                         from public.scene_moves m where m.player_id = p.id and m.collected_at is null), '[]'::jsonb),
    'rested', coalesce((select jsonb_agg(distinct m.move) from public.scene_moves m
                         where m.player_id = p.id and m.collected_at > now() - interval '3 days'), '[]'::jsonb),
    'bounced', coalesce((select jsonb_agg(b.move) from public.scene_bounces b where b.player_id = p.id and b.ny_date = public.ny_today()), '[]'::jsonb),
    'scores', coalesce((select jsonb_object_agg(x.score, x.pts) from
                         (select m.score, sum(m.points)::int as pts from public.scene_moves m
                           where m.player_id = p.id and m.collected_at is not null group by m.score) x), '{}'::jsonb),
    'collected', coalesce((select count(*) from public.scene_moves m where m.player_id = p.id and m.collected_at is not null), 0)) end
  from (select 1) one
  left join public.players p on p.id = p_player and p.home_id is not null;
$$;

/**
 * Starts a move (or records a bounce). p_entry 'invited' needs the rank or money; 'sneak' is for a player short of them,
 * with the server's roll in p_bounced, a bribe's price in p_extra, the meter nudge in p_integrity and a ban in p_ban_hours.
 * Raises: rate_limited, no_player, bad_move, not_here, closed_now, in_holding, banned_here, not_yet, no_slot, running,
 * bounced_today, no_energy, cant_afford, bad_entry.
 */
create or replace function public.scene_start(
  p_player uuid, p_move text, p_entry text, p_bounced boolean, p_extra int, p_integrity int, p_ban_hours int
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  mv jsonb := cfg -> 'moves' -> p_move;
  me public.players;
  rk int;
  worth bigint;
  ok_needs boolean;
  v_hours int;
  v_cost int;
  v_energy int;
  v_slot int;
  v_id uuid;
  base int;
  ni int := coalesce(p_integrity, 0);
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if mv is null then raise exception 'bad_move' using errcode = '22023'; end if;
  if p_entry not in ('invited', 'sneak') or coalesce(p_extra, 0) not between 0 and 5000 or ni not between -5 and 5
     or coalesce(p_ban_hours, 0) not between 0 and 24 then
    raise exception 'bad_entry' using errcode = '22023';
  end if;
  select * into me from public.players where id = p_player and home_id is not null for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not (mv -> 'places') ? coalesce(me.at_place, '') then raise exception 'not_here' using errcode = '22023'; end if;
  if not public.place_hours_open(me.at_place) then raise exception 'closed_now' using errcode = '22023'; end if;
  if public.choice_marked(p_player, 'holding') then raise exception 'in_holding' using errcode = '22023'; end if;
  if exists (select 1 from public.choice_marks where player_id = p_player and kind = 'ban' and place = me.at_place and until > now()) then
    raise exception 'banned_here' using errcode = '22023';
  end if;
  rk := public.scene_rank(p_player);
  worth := public.net_worth(p_player);
  ok_needs := case
    when mv -> 'needs' is null then true
    when (mv -> 'needs') ? 'rank' and (mv -> 'needs') ? 'netWorth' then rk >= (mv #>> '{needs,rank}')::int or worth >= (mv #>> '{needs,netWorth}')::bigint
    when (mv -> 'needs') ? 'rank' then rk >= (mv #>> '{needs,rank}')::int
    else worth >= (mv #>> '{needs,netWorth}')::bigint end;
  -- Invited needs the rank or money; sneaking is only for those short of it.
  if p_entry = 'invited' and not ok_needs then raise exception 'not_yet' using errcode = '22023'; end if;
  if p_entry = 'sneak' and ok_needs then raise exception 'bad_entry' using errcode = '22023'; end if;
  if exists (select 1 from public.scene_moves where player_id = p_player and move = p_move and collected_at is null) then
    raise exception 'running' using errcode = '22023';
  end if;
  if exists (select 1 from public.scene_bounces where player_id = p_player and move = p_move and ny_date = public.ny_today()) then
    raise exception 'bounced_today' using errcode = '22023';
  end if;
  select s into v_slot from generate_series(1, public.scene_slots(rk)) s
   where not exists (select 1 from public.scene_moves m where m.player_id = p_player and m.collected_at is null and m.slot = s)
   order by s limit 1;
  if v_slot is null then raise exception 'no_slot' using errcode = '22023'; end if;
  v_energy := (mv ->> 'energy')::int;
  if me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  base := coalesce((mv #>> '{needs,rank}')::int, 1);
  v_cost := (round((mv ->> 'cost')::int * (1 + (cfg ->> 'costPerRank')::numeric * greatest(0, rk - base)) / 5) * 5)::int;
  if p_entry = 'sneak' then v_cost := (mv ->> 'cost')::int + coalesce(p_extra, 0); end if;
  if me.bank_cash < v_cost then raise exception 'cant_afford' using errcode = '22023'; end if;

  if ni <> 0 then
    insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
    update public.reputation set integrity = least(100, greatest(0, integrity + ni)), updated_at = now() where player_id = p_player;
  end if;
  if coalesce(p_bounced, false) then
    -- Bounced: the Energy is spent (and a bribe's money, which the door kept), no move, no second try today.
    update public.players set energy = greatest(0, energy - v_energy) where id = p_player;
    if coalesce(p_extra, 0) > 0 and public.ledger_once(p_player, 'cash', -p_extra, 'scene_cost', 'bounce:' || p_move || ':' || public.ny_today()) then
      update public.players set bank_cash = bank_cash - p_extra where id = p_player;
    end if;
    insert into public.scene_bounces (player_id, move, ny_date, way)
    values (p_player, p_move, public.ny_today(), case when coalesce(p_ban_hours, 0) > 0 then 'namedrop' when coalesce(p_extra, 0) > 0 then 'bribe' else 'confidence' end)
    on conflict do nothing;
    if coalesce(p_ban_hours, 0) > 0 then
      insert into public.choice_marks (player_id, kind, place, until) values (p_player, 'ban', me.at_place, now() + make_interval(hours => p_ban_hours));
    end if;
    return jsonb_build_object('bounced', true, 'energy', v_energy, 'cash', -coalesce(p_extra, 0), 'banHours', coalesce(p_ban_hours, 0));
  end if;

  v_hours := (mv ->> 'hours')::int;
  insert into public.scene_moves (player_id, move, place, slot, entry, score, need, ready_at, stale_at)
  values (p_player, p_move, me.at_place, v_slot, p_entry, mv ->> 'score', coalesce((cfg -> 'hypes' ->> v_hours::text)::int, 0),
          now() + make_interval(hours => v_hours),
          now() + make_interval(hours => v_hours + coalesce((cfg -> 'staleAfter' ->> v_hours::text)::int, v_hours)))
  returning scene_moves.id into v_id;
  update public.players set energy = energy - v_energy where id = p_player;
  if v_cost > 0 and public.ledger_once(p_player, 'cash', -v_cost, 'scene_cost', v_id::text) then
    update public.players set bank_cash = bank_cash - v_cost where id = p_player;
  end if;
  return jsonb_build_object('bounced', false, 'id', v_id, 'slot', v_slot, 'cash', -v_cost, 'energy', v_energy);
end;
$$;

/** Hypes a building move: at its place, an hour since the last, while one is still wanted. Raises: no_move, not_here, no_hype, too_soon. */
create or replace function public.scene_hype(p_player uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.scene_moves;
  gap int := coalesce((public.game_settings_value('scene') ->> 'hypeGapMin')::int, 60);
  v_last timestamptz;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_moves where id = p_id and player_id = p_player and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if (select at_place from public.players where id = p_player) is distinct from r.place then raise exception 'not_here' using errcode = '22023'; end if;
  if cardinality(r.hypes) >= r.need or now() >= r.ready_at then raise exception 'no_hype' using errcode = '22023'; end if;
  v_last := coalesce(r.hypes[cardinality(r.hypes)], r.started_at);
  if now() - v_last < make_interval(mins => gap) then raise exception 'too_soon' using errcode = '22023'; end if;
  update public.scene_moves set hypes = hypes || now() where id = p_id;
  return jsonb_build_object('hypes', cardinality(r.hypes) + 1, 'need', r.need);
end;
$$;

/** Collects a ready move: clout (ledger 'scene', once), score points, the skill practised. Raises: no_move, not_ready. */
create or replace function public.scene_collect(p_player uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('scene');
  r public.scene_moves;
  mv jsonb;
  is_stale boolean;
  f numeric;
  c int;
  pts int;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_moves where id = p_id and player_id = p_player and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if now() < r.ready_at then raise exception 'not_ready' using errcode = '22023'; end if;
  mv := cfg -> 'moves' -> r.move;
  is_stale := now() >= r.stale_at;
  f := greatest((cfg ->> 'stalePay')::numeric, 1 - (cfg ->> 'missedHype')::numeric * greatest(0, r.need - cardinality(r.hypes)));
  if is_stale then f := least(f, (cfg ->> 'stalePay')::numeric); end if;
  c := round(coalesce((mv ->> 'clout')::int, 0) * f)::int;
  pts := round(c * (cfg ->> 'pointsPer')::numeric)::int;
  update public.scene_moves set collected_at = now(), stale = is_stale, clout = c, points = pts where id = p_id;
  if c > 0 and public.ledger_once(p_player, 'clout', c, 'scene', p_id::text) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  if mv ? 'skill' then perform public.skill_practice(p_player, mv ->> 'skill', 'scene:' || p_id); end if;
  return jsonb_build_object('clout', c, 'points', pts, 'score', r.score, 'stale', is_stale, 'move', r.move);
end;
$$;

-- Start over clears the player's Scene (moves, scores and bounces).
create or replace function public.scene_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.scene_moves where player_id = new.player_id;
  delete from public.scene_bounces where player_id = new.player_id;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists scene_on_restart on public.player_restarts;
create trigger scene_on_restart after insert on public.player_restarts
  for each row execute function public.scene_on_restart();

revoke all on function public.scene_rank(uuid) from public, anon, authenticated;
revoke all on function public.scene_slots(int) from public, anon, authenticated;
revoke all on function public.scene_context(uuid) from public, anon, authenticated;
revoke all on function public.scene_start(uuid, text, text, boolean, int, int, int) from public, anon, authenticated;
revoke all on function public.scene_hype(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_collect(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_on_restart() from public, anon, authenticated;
