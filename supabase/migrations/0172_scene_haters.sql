-- 0172: Your Scene, step 2 (owner, Nov 21: "As their clout increases… rising costs, rivalries and pitfalls"; docs/SCENE.md).
--   * Haters: the server action rolls whether a move draws one (lib/scene.ts haterChance: 15% for a nobody, +5 points a rank,
--     at most 60%, +15 when snuck in), picks it from content/scene/haters.json by rank (petty rumours, celebrities' shade,
--     then real pitfalls) and when it lands (a quarter to three quarters of the way through): scene_set_hater. Left standing,
--     it takes its cut (0.25 to 0.4) off the pay at collect.
--   * Dealing with it (scene_deal): a Friendly regular vouches (once a week, scene_vouches), a publicist (C$100 + 75 a rank),
--     spilling tea first (+C$60 + 20 a rank, ledger 'scene_tea'; Hustler-ward) or rising above it (Halo-ward; the cut stays).
--   * The crew's hype (scene_crew_hype): a crew member or partner hypes your building move from anywhere, once per move each;
--     it counts as a hype and pays the helper 5 clout (ledger 'scene_crew'). scene_context lists the crew's moves that want it.
-- Safe to run more than once.

insert into public.game_settings (key, value) values ('scene', '{"slots":[[1,2],[3,3],[5,4],[7,5]],"hypes":{"2":0,"8":2,"24":2,"72":3},"hypeGapMin":60,"staleAfter":{"2":4,"8":8,"24":12,"72":24},"stalePay":0.25,"missedHype":0.25,"pointsPer":0.2,"costPerRank":0.1,"crewHypeClout":5,"sneak":{"confidence":{"integrity":0,"banHours":0,"extra":0},"namedrop":{"integrity":-3,"banHours":24,"extra":0},"bribe":{"integrity":-2,"banHours":0,"extra":0.5}},"moves":{"brunch-be-seen":{"places":["grind-and-gossip","ditmars-deli","feta-compli","schlep-and-schmear"],"hours":2,"cost":40,"energy":10,"clout":45,"score":"style","skill":"charisma","gated":false},"open-mic":{"places":["velvet-static","low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":15,"clout":50,"score":"stage","skill":"music","gated":false},"night-out":{"places":["velvet-static","hellgate-hall","the-sticky-floor","discount-disco"],"hours":8,"cost":120,"energy":20,"clout":130,"score":"nightlife","skill":"dance","gated":false},"photo-walk":{"places":["gantry-plaza","unisphere","hell-gate-park"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"street","skill":"photography","gated":false},"run-club":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":20,"clout":35,"score":"social","skill":"fitness","gated":false},"window-shop":{"places":["atelier-vernon","thread-count"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"style","skill":"photography","gated":false},"jazz-table":{"places":["low-light-lounge","brownstone-sessions"],"hours":8,"cost":90,"energy":10,"clout":110,"score":"nightlife","skill":"music","gated":false},"meteors-game":{"places":["meteor-park"],"hours":8,"cost":60,"energy":15,"clout":100,"score":"street","skill":"charisma","gated":false},"diner-court":{"places":["neon-spoon","still-a-dollar-slice"],"hours":2,"cost":25,"energy":5,"clout":35,"score":"social","skill":"gossip","gated":false},"chad-launch":{"places":["triborough-works","grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"status","skill":"hustle","gated":false},"tiff-collab":{"places":["gantry-plaza","grind-and-gossip"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"social","skill":"photography","gated":false},"dj-polaroid":{"places":["velvet-static","hellgate-hall"],"hours":2,"cost":15,"energy":10,"clout":40,"score":"nightlife","skill":"dance","gated":false},"barksley-bday":{"places":["hell-gate-park"],"hours":2,"cost":30,"energy":5,"clout":50,"score":"social","skill":"charisma","gated":false},"panel-speak":{"places":["triborough-works","queensboro-capital","skybridge-tower"],"hours":8,"cost":0,"energy":15,"clout":160,"score":"status","skill":"smarts","needs":{"rank":4},"gated":false},"guest-lecture":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"smarts","needs":{"rank":5},"gated":false},"fundraiser":{"places":["ditmars-heights-rooftop"],"hours":24,"cost":800,"energy":15,"clout":280,"score":"status","skill":"charisma","needs":{"rank":4,"netWorth":50000},"gated":false},"talk-show":{"places":["clout-tower"],"hours":24,"cost":0,"energy":20,"clout":350,"score":"stage","skill":"charisma","needs":{"rank":5},"gated":false},"rooftop-dinner":{"places":["ditmars-heights-rooftop","altitude-718","up-on-thirty"],"hours":8,"cost":200,"energy":10,"clout":140,"score":"nightlife","skill":"charisma","needs":{"rank":2},"gated":false},"crab-breakfast":{"places":["ditmars-heights-rooftop"],"hours":8,"cost":300,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":3},"gated":false},"car-auction":{"places":["boulevard-motors"],"hours":24,"cost":1500,"energy":10,"clout":320,"score":"status","skill":"hustle","needs":{"netWorth":100000},"gated":false},"saffron-bday":{"places":["velvet-static","ultraviolet-society"],"hours":8,"cost":200,"energy":25,"clout":190,"score":"nightlife","skill":"dance","needs":{"rank":4},"gated":false},"vale-front-row":{"places":["atelier-vernon"],"hours":8,"cost":250,"energy":10,"clout":210,"score":"style","skill":"photography","needs":{"rank":4},"gated":false},"ruckus-listening":{"places":["velvet-static","hellgate-hall","real-clout-fm"],"hours":8,"cost":80,"energy":15,"clout":150,"score":"nightlife","skill":"music","needs":{"rank":2},"gated":false},"ruckus-radio":{"places":["real-clout-fm"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"gossip","needs":{"rank":3},"gated":false},"lunaria-drop":{"places":["real-clout-fm"],"hours":8,"cost":0,"energy":20,"clout":170,"score":"stage","skill":"music","needs":{"rank":5},"gated":false},"brock-premiere":{"places":["clout-tower","reel-queens"],"hours":8,"cost":150,"energy":10,"clout":180,"score":"style","skill":"photography","needs":{"rank":4},"gated":false},"dunk-box":{"places":["meteor-park"],"hours":8,"cost":400,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":5},"gated":false},"skyler-panel":{"places":["triborough-works","skybridge-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"status","skill":"smarts","needs":{"rank":2},"gated":false},"chardonnay-reunion":{"places":["clout-tower"],"hours":8,"cost":0,"energy":15,"clout":170,"score":"stage","skill":"gossip","needs":{"rank":4},"gated":false},"peyton-apology":{"places":["grind-and-gossip","feta-compli"],"hours":2,"cost":50,"energy":10,"clout":60,"score":"social","skill":"photography","needs":{"rank":2},"gated":false},"chase-stream":{"places":["glow-up-house"],"hours":8,"cost":0,"energy":25,"clout":150,"score":"stage","skill":"charisma","needs":{"rank":3},"gated":false},"duke-watches":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":5,"clout":300,"score":"status","skill":"photography","needs":{"netWorth":250000},"gated":false},"mayor-ribbon":{"places":["city-hall-annex"],"hours":2,"cost":0,"energy":10,"clout":80,"score":"street","skill":"charisma","needs":{"rank":3},"gated":false},"brick-reading":{"places":["clout-tower","ditmars-library"],"hours":2,"cost":0,"energy":5,"clout":60,"score":"stage","skill":"smarts","needs":{"rank":2},"gated":false},"brunch-date":{"places":["grind-and-gossip","feta-compli","ditmars-deli"],"hours":2,"cost":60,"energy":10,"clout":80,"score":"social","skill":"charisma","gated":true},"speed-dating":{"places":["low-light-lounge","velvet-static"],"hours":2,"cost":30,"energy":10,"clout":50,"score":"social","skill":"charisma","gated":true},"revenge-glowup":{"places":["velvet-static","ditmars-heights-rooftop"],"hours":8,"cost":120,"energy":20,"clout":160,"score":"nightlife","skill":"dance","gated":true},"study-gram":{"places":["st-johnsons","queensborough-u","astoria-cc","ditmars-library"],"hours":2,"cost":0,"energy":10,"clout":45,"score":"social","skill":"smarts","gated":true},"greek-row":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":20,"energy":25,"clout":120,"score":"nightlife","skill":"dance","gated":true},"work-the-quad":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"social","skill":"charisma","gated":true},"investor-brunch":{"places":["feta-compli","grind-and-gossip","queensboro-capital"],"hours":8,"cost":150,"energy":10,"clout":170,"score":"status","skill":"hustle","gated":true},"launch-party":{"places":["ditmars-heights-rooftop","velvet-static"],"hours":24,"cost":1200,"energy":20,"clout":320,"score":"status","skill":"hustle","gated":true},"trading-pitch":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":20,"clout":260,"score":"status","skill":"hustle","needs":{"rank":3},"gated":true},"opening-bell":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":10,"clout":400,"score":"status","skill":"hustle","gated":true},"demo-day":{"places":["triborough-works"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"status","skill":"smarts","gated":true},"tv-cameo":{"places":["clout-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"charisma","gated":true},"latte-art":{"places":["grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":55,"score":"stage","skill":"cooking","gated":true},"front-row-intern":{"places":["atelier-vernon"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"style","skill":"photography","gated":true},"promotion-drinks":{"places":["low-light-lounge","ditmars-heights-rooftop"],"hours":8,"cost":100,"energy":10,"clout":140,"score":"social","skill":"charisma","gated":true},"kiss-babies":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"charisma","gated":true},"spin-room":{"places":["campaign-hq","city-hall-annex"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"gossip","gated":true},"free-gallery":{"places":["atelier-vernon","gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":45,"score":"style","skill":"photography","gated":true},"sample-sale":{"places":["atelier-vernon"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"style","skill":"hustle","gated":true},"pool-party":{"places":["ditmars-heights-rooftop","altitude-718"],"hours":8,"cost":60,"energy":15,"clout":150,"score":"nightlife","skill":"fitness","gated":true},"candle-mic":{"places":["low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"music","gated":true},"festival-front":{"places":["flushing-meadows","hell-gate-park"],"hours":8,"cost":40,"energy":20,"clout":140,"score":"street","skill":"dance","gated":true},"charity-5k":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":20,"energy":25,"clout":70,"score":"social","skill":"fitness","gated":true},"publicity-stunt":{"places":["gantry-plaza","unisphere"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"hustle","gated":true}}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.scene_moves add column if not exists hater text;
alter table public.scene_moves add column if not exists hater_at timestamptz;
alter table public.scene_moves add column if not exists cut numeric;
alter table public.scene_moves add column if not exists dealt text check (dealt in ('vouch', 'publicist', 'spill', 'rise'));
alter table public.scene_moves add column if not exists dealt_at timestamptz;

create table if not exists public.scene_vouches (
  player_id uuid not null references public.players (id) on delete cascade,
  npc       text not null,
  at        timestamptz not null default now()
);
create index if not exists scene_vouches_idx on public.scene_vouches (player_id, at);
alter table public.scene_vouches enable row level security;
revoke all on public.scene_vouches from anon, authenticated;

create table if not exists public.scene_crew_hypes (
  move_id uuid not null references public.scene_moves (id) on delete cascade,
  helper  uuid not null references public.players (id) on delete cascade,
  at      timestamptz not null default now(),
  primary key (move_id, helper)
);
alter table public.scene_crew_hypes enable row level security;
revoke all on public.scene_crew_hypes from anon, authenticated;

/** Whether two players can hype each other's moves: crew either way, or partners. */
create or replace function public.scene_crew(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_a is distinct from p_b and not public.is_blocked_pair(p_a, p_b)
     and (p_b in (select id from public.crew_of(p_a)) or p_a in (select id from public.crew_of(p_b))
          or coalesce(public.couple_partner(p_a) = p_b, false))
$$;

/** Puts the server's hater on a just-started move. Raises: no_move, bad_hater. */
create or replace function public.scene_set_hater(p_player uuid, p_id uuid, p_hater text, p_at timestamptz, p_cut numeric) returns void
language plpgsql security definer set search_path = public
as $$
declare r public.scene_moves;
begin
  select * into r from public.scene_moves where id = p_id and player_id = p_player and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if coalesce(p_hater, '') !~ '^[a-z0-9-]{2,40}$' or p_cut not between 0.1 and 0.5
     or p_at < r.started_at or p_at > r.ready_at or r.hater is not null then
    raise exception 'bad_hater' using errcode = '22023';
  end if;
  update public.scene_moves set hater = p_hater, hater_at = p_at, cut = p_cut where id = p_id;
end;
$$;

/** Deals with a hater that has landed. p_cash: the publicist's price (negative) or the tea's pay (positive), decided by the
 *  server from the rank. Raises: no_move, no_hater, dealt, no_vouch, cant_afford, bad_deal. */
create or replace function public.scene_deal(p_player uuid, p_id uuid, p_way text, p_npc text, p_cash int, p_integrity int) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.scene_moves;
  me public.players;
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_way not in ('vouch', 'publicist', 'spill', 'rise') or coalesce(p_integrity, 0) not between -5 and 5
     or coalesce(p_cash, 0) not between -2000 and 400
     or (p_way = 'publicist' and coalesce(p_cash, 0) >= 0) or (p_way = 'spill' and coalesce(p_cash, 0) <= 0)
     or (p_way in ('vouch', 'rise') and coalesce(p_cash, 0) <> 0) then
    raise exception 'bad_deal' using errcode = '22023';
  end if;
  select * into r from public.scene_moves where id = p_id and player_id = p_player and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if r.hater is null or r.hater_at > now() then raise exception 'no_hater' using errcode = '22023'; end if;
  if r.dealt is not null then raise exception 'dealt' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player for update;
  if p_way = 'vouch' then
    if not exists (select 1 from public.npc_bonds b where b.player_id = p_player and b.npc = p_npc and b.favors >= 2
                     and (b.burned_until is null or b.burned_until < public.ny_today()))
       or exists (select 1 from public.scene_vouches v where v.player_id = p_player and v.at > now() - interval '7 days') then
      raise exception 'no_vouch' using errcode = '22023';
    end if;
    insert into public.scene_vouches (player_id, npc) values (p_player, p_npc);
  end if;
  if p_way = 'publicist' then
    if me.bank_cash < -p_cash then raise exception 'cant_afford' using errcode = '22023'; end if;
    if public.ledger_once(p_player, 'cash', p_cash, 'scene_cost', 'publicist:' || p_id) then
      update public.players set bank_cash = bank_cash + p_cash where id = p_player;
    end if;
  end if;
  if p_way = 'spill' and public.ledger_once(p_player, 'cash', p_cash, 'scene_tea', p_id::text) then
    update public.players set bank_cash = bank_cash + p_cash where id = p_player;
  end if;
  if coalesce(p_integrity, 0) <> 0 then
    insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
    update public.reputation set integrity = least(100, greatest(0, integrity + p_integrity)), updated_at = now() where player_id = p_player;
  end if;
  update public.scene_moves set dealt = p_way, dealt_at = now() where id = p_id;
  return jsonb_build_object('way', p_way, 'cash', coalesce(p_cash, 0));
end;
$$;

/** A crew member or partner hypes your move from anywhere: once per move each, while it builds and wants one. Pays the
 *  helper 5 clout. Raises: no_move, not_crew, no_hype, hyped. */
create or replace function public.scene_crew_hype(p_player uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.scene_moves;
  n int;
  c int := coalesce((public.game_settings_value('scene') ->> 'crewHypeClout')::int, 5);
begin
  if not public.rate_hit(p_player, 'scene', 40, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  select * into r from public.scene_moves where id = p_id and collected_at is null for update;
  if r.id is null then raise exception 'no_move' using errcode = '22023'; end if;
  if not public.scene_crew(p_player, r.player_id) then raise exception 'not_crew' using errcode = '22023'; end if;
  if cardinality(r.hypes) >= r.need or now() >= r.ready_at then raise exception 'no_hype' using errcode = '22023'; end if;
  insert into public.scene_crew_hypes (move_id, helper) values (p_id, p_player) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'hyped' using errcode = '22023'; end if;
  update public.scene_moves set hypes = hypes || now() where id = p_id;
  if public.ledger_once(p_player, 'clout', c, 'scene_crew', p_id::text) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  return jsonb_build_object('clout', c);
end;
$$;

/** 0171's collect, plus the hater's cut when it was left standing (rising above it keeps the cut). */
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
  f := f * (1 - hc);
  c := round(coalesce((mv ->> 'clout')::int, 0) * f)::int;
  pts := round(c * (cfg ->> 'pointsPer')::numeric)::int;
  update public.scene_moves set collected_at = now(), stale = is_stale, clout = c, points = pts where id = p_id;
  if c > 0 and public.ledger_once(p_player, 'clout', c, 'scene', p_id::text) then
    update public.players set clout = clout + c where id = p_player;
  end if;
  if mv ? 'skill' then perform public.skill_practice(p_player, mv ->> 'skill', 'scene:' || p_id); end if;
  return jsonb_build_object('clout', c, 'points', pts, 'score', r.score, 'stale', is_stale, 'move', r.move, 'cut', hc);
end;
$$;

/** 0171's context, plus each move's hater, the regulars who'd vouch (and whether this week's vouch is free) and the crew's
 *  moves that want a hype from this player. */
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
                          'cut', case when m.hater_at <= now() then m.cut end, 'dealt', m.dealt)
                          order by m.slot)
                         from public.scene_moves m where m.player_id = p.id and m.collected_at is null), '[]'::jsonb),
    'rested', coalesce((select jsonb_agg(distinct m.move) from public.scene_moves m
                         where m.player_id = p.id and m.collected_at > now() - interval '3 days'), '[]'::jsonb),
    'bounced', coalesce((select jsonb_agg(b.move) from public.scene_bounces b where b.player_id = p.id and b.ny_date = public.ny_today()), '[]'::jsonb),
    'scores', coalesce((select jsonb_object_agg(x.score, x.pts) from
                         (select m.score, sum(m.points)::int as pts from public.scene_moves m
                           where m.player_id = p.id and m.collected_at is not null group by m.score) x), '{}'::jsonb),
    'collected', coalesce((select count(*) from public.scene_moves m where m.player_id = p.id and m.collected_at is not null), 0),
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

-- Start over also clears the vouches.
create or replace function public.scene_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.scene_moves where player_id = new.player_id;
  delete from public.scene_bounces where player_id = new.player_id;
  delete from public.scene_vouches where player_id = new.player_id;
  return new;
exception when others then return new;
end;
$$;

revoke all on function public.scene_crew(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_set_hater(uuid, uuid, text, timestamptz, numeric) from public, anon, authenticated;
revoke all on function public.scene_deal(uuid, uuid, text, text, int, int) from public, anon, authenticated;
revoke all on function public.scene_crew_hype(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_collect(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scene_context(uuid) from public, anon, authenticated;
