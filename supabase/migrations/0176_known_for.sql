-- 0176: One "Known for" for the whole game and Clout Pass XP from everything (owner, Nov 21: "build 3 and 4", after the
-- reward review; lib/fame.ts KNOWN_FOR, lib/seasonPass.ts SEASON.xp; docs/FAME.md).
--   * Your Scene's six scores counted Scene moves only. Now a ledger row of a mapped kind (game_settings 'fame'.knownFor:
--     promotions and paydays → Status, dates and the crew → Social, club nights and parties → Nightlife, the campaign →
--     Stage, the Shop and the Crib Rating → Style, hunts, gossip and being a regular → Street cred) adds its points to that
--     score once per thing (fame_points, unique by kind and ref; a trigger that never raises). scene_context adds them up.
--   * The Clout Pass: paydays, promotions, the campaign's weekly poll, buying or upgrading a business, dates, hosting,
--     parties, hunt clues, anniversaries, the Crib Rating and plaques earn season XP too (season_pass xp, merged in).
--   * Start over clears fame_points (its ledger moves to the archive, so they'd be earned again).
-- Safe to run more than once.

insert into public.game_settings (key, value) values ('fame', '{"perRank":0.2,"cap":2.8,"scaleKinds":["daily_task","daily_bonus","visit","event","place_life"],"paparazzi":0.1,"perks":{"ticket":2,"comp":3,"invite":4,"spotlight":5,"match":7,"paparazzi":8},"spotlight":{"5":"📸 Lola’s Spotlight: {name} is officially On the List. The bouncers nod now. Sources say they practised nodding back.","6":"📸 Lola’s Spotlight: {name} is a Local Celebrity. Recognised at the grocery store; pretended not to be. Badly.","7":"📸 Lola’s Spotlight: {name} has Nepo Baby Energy now. Every VIP rope opens. Nobody’s sure whose kid they are.","8":"📸 Lola’s Spotlight: {name} is New Money Rich. The paparazzi have their schedule. Everything they own is still in the box.","9":"📸 Lola’s Spotlight: {name} made Self-Made Billionaire*. Terms and conditions apply. They’re throwing their own night.","10":"🗽 Mayor Papa-Dani declares today {name} Day. God Status. The city speaks their name in hushed tones."},"hosted":["barksley-bday","brick-reading","brock-premiere","car-auction","chad-launch","chardonnay-reunion","chase-stream","crab-breakfast","dj-polaroid","duke-watches","dunk-box","lunaria-drop","mayor-ribbon","peyton-apology","ruckus-listening","ruckus-radio","saffron-bday","skyler-panel","tiff-collab","vale-front-row"],"knownFor":{"event":{"score":"nightlife","points":5},"party":{"score":"nightlife","points":10},"vip":{"score":"nightlife","points":8},"vip_cover":{"score":"nightlife","points":8},"calendar":{"score":"nightlife","points":8},"purchase":{"score":"style","points":5},"home_score":{"score":"style","points":15},"career_promo":{"score":"status","points":25},"career_pay":{"score":"status","points":6},"career_screen":{"score":"status","points":10},"business_buy":{"score":"status","points":20},"business_upgrade":{"score":"status","points":10},"business_public":{"score":"status","points":60},"gala":{"score":"status","points":15},"date_night":{"score":"social","points":10},"crew_friend":{"score":"social","points":6},"crew_full":{"score":"social","points":12},"together":{"score":"social","points":6},"visit_host":{"score":"social","points":10},"visit_guest":{"score":"social","points":6},"couple_streak":{"score":"social","points":8},"couple_anniv":{"score":"social","points":15},"cohabit_home":{"score":"social","points":5},"invite":{"score":"social","points":10},"campaign_poll":{"score":"stage","points":5},"campaign_reward":{"score":"stage","points":10},"campaign_task":{"score":"stage","points":6},"hunt":{"score":"street","points":10},"gossip":{"score":"street","points":4},"gossip_restroom":{"score":"street","points":4},"place_life":{"score":"street","points":4},"visit":{"score":"street","points":2},"story_read":{"score":"street","points":3},"streak":{"score":"street","points":5}}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

update public.game_settings set value = jsonb_set(value, '{xp}', (value -> 'xp') || '{"career_pay":10,"career_promo":40,"campaign_poll":15,"business_buy":25,"business_upgrade":20,"date_night":15,"visit_host":10,"party":10,"hunt":10,"couple_anniv":15,"home_score":20,"scene_plaque":30}'::jsonb), updated_at = now()
 where key = 'season_pass';

create table if not exists public.fame_points (
  player_id  uuid not null references public.players (id) on delete cascade,
  kind       text not null,
  ref        text not null,
  score      text not null check (score in ('nightlife', 'style', 'stage', 'status', 'social', 'street')),
  points     int not null,
  created_at timestamptz not null default now(),
  primary key (player_id, kind, ref)
);
alter table public.fame_points enable row level security;
revoke all on public.fame_points from anon, authenticated;

/** Known for: a mapped ledger row adds its points to a score, once per thing (a cash and a clout row of one thing count once). */
create or replace function public.fame_known() returns trigger
language plpgsql security definer set search_path = public
as $$
declare k jsonb;
begin
  begin
    k := public.game_settings_value('fame') -> 'knownFor' -> new.kind;
    if k is not null then
      insert into public.fame_points (player_id, kind, ref, score, points)
      values (new.player_id, new.kind, new.ref, k ->> 'score', (k ->> 'points')::int)
      on conflict do nothing;
    end if;
  exception when others then
    raise warning 'fame_known: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists ledger_fame_known on public.ledger;
create trigger ledger_fame_known after insert on public.ledger
  for each row execute function public.fame_known();

/** 0173's context, with Known for counting everything a player does (fame_points) beside Scene moves. */
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
    -- Migration 0176: one Known for for the whole game: Scene moves plus everything else (fame_points).
    'scores', coalesce((select jsonb_object_agg(x.score, x.pts) from
                         (select y.score, sum(y.pts)::int as pts from (
                            select m.score, m.points as pts from public.scene_moves m where m.player_id = p.id and m.collected_at is not null
                            union all
                            select f.score, f.points from public.fame_points f where f.player_id = p.id) y group by y.score) x), '{}'::jsonb),
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

-- Start over forgets the points (the ledger they came from is archived, so they'd be earned again).
create or replace function public.fame_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.fame_points where player_id = new.player_id;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists fame_on_restart on public.player_restarts;
create trigger fame_on_restart after insert on public.player_restarts
  for each row execute function public.fame_on_restart();

revoke all on function public.fame_known() from public, anon, authenticated;
revoke all on function public.fame_on_restart() from public, anon, authenticated;
revoke all on function public.scene_context(uuid) from public, anon, authenticated;
