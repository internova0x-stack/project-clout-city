-- The home score and wall art (owner, Oct 26: "Yes to both"; spec section 26). A home's score, 0 to 100, says how well
-- it's furnished, relative to the home (a beautifully done room share can reach 100 like a penthouse):
--
--   * Rooms (40): 10 for each of living, bedroom, dining and decor with at least one bought piece placed.
--   * Quality (40): the stars of every distinct piece placed (one per furniture line, 1 to 4 each) against the home's
--     target (room share 8 ... LIC 18, an owned house 24).
--   * Wall art (20): 5 for each distinct painting placed.
--
-- Only placed pieces count (the layout's "item:<id>" entries for the player's own Home items). Real-money pieces count
-- with their stars like any other (at most 4), never more. Reaching 40, 70 and 100 pays clout once (ledger 'home_score').
-- home_score_state() is the Home screen's card and pays what's due; the player card shows the score.
--
-- Wall art: twelve paintings by invented artists (content/shop/wall-art.json) go on sale in Furniture → Art.

insert into public.game_settings (key, value) values ('home_score', '{"roomPoints":10,"rooms":["living","bedroom","dining","decor"],"qualityPoints":40,"targets":{"astoria_share":8,"astoria_studio":10,"sj_dorm":8,"qu_dorm":8,"jackson_heights_1br":14,"sunnyside_gardens":16,"lic_highrise":18},"houseTarget":24,"artPoints":20,"artEach":5,"milestones":[{"score":40,"clout":50},{"score":70,"clout":100},{"score":100,"clout":250}]}'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.shop_catalog (sku, position, status, go_live_at, tab, slot, presentation, name, description, emoji, price, clout,
                                 tier, stars, wearable, source_image, transparent, origin, file, extra, reviewed_at)
select x.sku, (select coalesce(max(position), 0) from public.shop_catalog) + x.n, 'live', now(), 'home', 'art', 'all',
       x.name, x.description, '🖼️', x.price, x.clout, x.tier, x.stars, true, x.src, true, 'import', 'wall-art.json',
       jsonb_build_object('line', x.sku, 'artist', x.artist), now()
  from (values
    (1, 'art-bodega-cat-sunday', 'Bodega Cat, Sunday', 'Oil on canvas. The only one in the deli who''s off on Sundays. By Marisol Quintero.', 140, 6, 'budget', 2, 'Marisol Quintero', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220531_8538c8db-b8d7-463a-b063-ebd840d1a193.png'),
    (2, 'art-golden-hour-7', 'Golden Hour on the 7', 'Acrylic. Painted from memory; the train was late, so there was time. By Dev Okafor.', 160, 6, 'budget', 2, 'Dev Okafor', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220531_0544dd45-3fb5-4bd9-9dc2-78c53a90d3df.png'),
    (3, 'art-rent-is-due', 'Rent Is Due', 'Neon on brick, as a painting. A reminder you''ll pay for weekly anyway. By Anonymous.', 95, 4, 'budget', 1, 'Anonymous', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220531_5bf2eb2f-38aa-47ac-872b-0718ea4483f5.png'),
    (4, 'art-astoria-rooftops', 'Astoria Rooftops at Dusk', 'Watercolor. Water towers, string lights, a bridge, and somebody''s grill smoke. By Eleni Pappas.', 220, 8, 'budget', 2, 'Eleni Pappas', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220532_466fcca5-df58-44d2-9d33-73778d6091d1.png'),
    (5, 'art-pigeon-portrait', 'Portrait of a Pigeon, No. 4', 'Oil on canvas. Old money, new feathers. Commissioned by the pigeon. By Raymond Tsang.', 480, 14, 'mid', 3, 'Raymond Tsang', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220528_dcec40b4-9ad6-45e7-a034-906caf307fbd.png'),
    (6, 'art-bagel-blue', 'Bagel in Blue', 'Cubist still life. Everything bagel, nothing else, very blue period. By Ilse Morgenthal.', 380, 12, 'mid', 2, 'Ilse Morgenthal', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220529_e84fc83a-b3e5-49e8-ab81-f47af3d507ed.png'),
    (7, 'art-globe-fog', 'The Globe in Fog', 'Oil on linen. Flushing at 6 AM, before the selfies. By Kwame Asante-Reid.', 950, 25, 'mid', 3, 'Kwame Asante-Reid', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220528_62be9453-eb2d-41be-b094-ea7de1949ec2.png'),
    (8, 'art-night-game', 'Night Game in Flushing', 'Gouache. Meteors up by one, fireworks either way. By Paz Ibarra.', 1200, 30, 'mid', 3, 'Paz Ibarra', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220529_1a17f8a3-9a58-441c-94cf-b91748015e5f.png'),
    (9, 'art-laundromat-dreams', 'Laundromat Dreams', 'Surrealist oil. The spin cycle goes further than you''d think. By Odile Varga.', 1600, 35, 'luxury', 3, 'Odile Varga', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220529_a35b93c3-3108-467f-9677-f5a8e539eb18.png'),
    (10, 'art-bridge-rain', 'Bridge in the Rain', 'Impasto oil. Every taxi off duty, every umbrella inside out. By Tomasz Wierzba.', 2400, 45, 'luxury', 3, 'Tomasz Wierzba', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220530_49ea10fd-0ad2-4034-ad7c-05621dd371c3.png'),
    (11, 'art-self-made', 'Self-Made (Gold Leaf)', 'Gold leaf, emerald and ink. Says "I did it myself" in twenty-four karats. By Celeste Aurum.', 5500, 80, 'luxury', 4, 'Celeste Aurum', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220531_70ed7e1c-445f-48ed-938f-87fba67f5056.png'),
    (12, 'art-clout', 'Clout', 'Abstract on a very large canvas. Flash photography encouraged, actually. By Valentina Moss.', 9500, 130, 'luxury', 4, 'Valentina Moss', 'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261026_220530_fb1760c3-7440-4052-9dda-3d9d0f56b93d.png')
  ) as x(n, sku, name, description, price, clout, tier, stars, artist, src)
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------------
-- The score
-- ---------------------------------------------------------------------------
create or replace function public.home_score(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  with cfg as (select public.game_settings_value('home_score') v),
  me as (select * from public.players where id = p_player),
  target as (
    select case when me.house_sku is not null then (cfg.v ->> 'houseTarget')::int
                else coalesce((cfg.v -> 'targets' ->> me.home_id)::int, 10) end t
      from me, cfg),
  pieces as (
    select distinct on (i.id) c.slot as room, coalesce(c.extra ->> 'line', c.sku) as line, least(4, greatest(1, c.stars)) as stars
      from me
      cross join lateral jsonb_array_elements(case when jsonb_typeof(me.home_layout) = 'array' then me.home_layout else '[]'::jsonb end) e
      join public.player_items i on e ->> 'id' = 'item:' || i.id and i.player_id = me.id and i.category = 'home'
      join public.shop_catalog c on c.sku = i.sku),
  rooms as (
    select jsonb_object_agg(r, exists (select 1 from pieces where room = r)) j,
           count(*) filter (where exists (select 1 from pieces where room = r)) * (select (v ->> 'roomPoints')::int from cfg) pts
      from cfg, jsonb_array_elements_text(cfg.v -> 'rooms') r),
  quality as (
    select coalesce(sum(s), 0)::int stars from (select max(stars) s from pieces where room <> 'art' group by line) x),
  art as (select count(distinct line)::int n from pieces where room = 'art'),
  parts as (
    select rooms.j, rooms.pts::int room_pts, quality.stars, target.t,
           least((cfg.v ->> 'qualityPoints')::int, round((cfg.v ->> 'qualityPoints')::numeric * quality.stars / target.t)::int) q_pts,
           art.n art_n, least((cfg.v ->> 'artPoints')::int, art.n * (cfg.v ->> 'artEach')::int) art_pts
      from rooms, quality, target, art, cfg)
  select jsonb_build_object('score', least(100, room_pts + q_pts + art_pts), 'rooms', j,
           'quality', jsonb_build_object('stars', stars, 'target', t, 'points', q_pts),
           'art', jsonb_build_object('count', art_n, 'points', art_pts))
    from parts
$$;

/** The Home screen's card: my score, and the milestones it reaches pay clout once (ledger 'home_score', ref the score). */
create or replace function public.home_score_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('home_score');
  s jsonb;
  m jsonb;
  paid jsonb := '[]'::jsonb;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  s := public.home_score(uid);
  for m in select jsonb_array_elements(cfg -> 'milestones') loop
    if (s ->> 'score')::int >= (m ->> 'score')::int
       and public.ledger_once(uid, 'clout', (m ->> 'clout')::int, 'home_score', m ->> 'score') then
      update public.players set clout = clout + (m ->> 'clout')::int where id = uid;
      paid := paid || jsonb_build_array(m);
    end if;
  end loop;
  return s || jsonb_build_object('paid', paid,
    'reached', coalesce((select jsonb_agg(l.ref::int order by l.ref::int) from public.ledger l
                          where l.player_id = uid and l.kind = 'home_score' and l.currency = 'clout'), '[]'::jsonb));
end;
$$;

-- The player card shows the home score.
create or replace function public.player_card(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'style', p.starting_style, 'clout', p.clout, 'homeId', p.home_id,
    'badges', (select count(*) from public.player_badges b where b.player_id = p.id),
    'joined', p.created_at,
    'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = p.id),
    'isMe', p.id = auth.uid(),
    'crush', case when p.id <> auth.uid() then public.crush_status(p.id) end,
    'rank', 1 + (select count(*) from public.players o
                  where o.banned_at is null
                    and (o.clout > p.clout or (o.clout = p.clout and o.created_at < p.created_at))),
    'recent', public.player_recent(p.id, 5),
    'netWorth', public.net_worth(p.id),
    'bestRank', p.best_rank,
    'jobs', public.job_rating(p.id),
    'vipSince', public.vip_since(p.id),
    'herePlace', (select p.at_place from public.players me where me.id = auth.uid() and me.at_place is not null and me.at_place = p.at_place
                    and p.seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)),
    'canMessage', p.id <> auth.uid() and public.may_reach(auth.uid(), p.id),
    'crew', p.id in (select id from public.crew_of(auth.uid())),
    'partner', public.couple_public(p.id),
    'sublet', public.sublet_public(p.id),
    'homeScore', (public.home_score(p.id) ->> 'score')::int)
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

do $$
begin
  revoke all on function public.home_score(uuid) from public, anon, authenticated;
  revoke all on function public.home_score_state() from public, anon;
  grant execute on function public.home_score_state() to authenticated;
end;
$$;
