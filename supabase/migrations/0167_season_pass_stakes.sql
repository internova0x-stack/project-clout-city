-- The Clout Pass gets stakes (owner, Nov 16: "Clout pass seems to have no stakes. One just continues to play as usual and
-- gets rewards for continuing to play"; the preview: weekly challenges, a pace line, a Level 18 title; "go ahead").
--   * Rebalance: a level costs 200 XP (was 160), a daily task 5 (was 10), all five in a day 20 (was 30), a goal still 50.
--     Levels already reached are kept: every player's XP gets a one-off 'rebalance' row so their level and progress into
--     the next stay where they were.
--   * Weekly challenges: three a New York week (Monday to Sunday) from game_settings 'season_pass'.challenges, scheduled in
--     .weeks (lib/seasonPass.ts WEEKS). season_state() counts each from that week's ledger rows (distinct kind and ref) or
--     Moral Choices made, pays its XP once when the count is reached (season_xp kind 'challenge', ref '<monday>:<id>') and
--     returns the week. It writes, so it is no longer `stable`.
--   * Level 18's free reward adds the season title (kind 'title': a player_badges row 'title-<id>'); season_titled() lists
--     who holds it, for the chip by their name. Anyone who already claimed Level 18 gets it now.

-- Keep levels: old level L and progress p (of 160) become L × 200 + p × 200/160.
insert into public.season_xp (player_id, season, kind, ref, xp, ny_date)
select player_id, 's1', 'rebalance', 's1:0167',
       (total / 160) * 200 + ((total % 160) * 200) / 160 - total, public.ny_today()
from (select player_id, sum(xp)::int as total from public.season_xp where season = 's1' group by player_id) t
where (total / 160) * 200 + ((total % 160) * 200) / 160 - total > 0
on conflict do nothing;

update public.game_settings set value = '{"id":"s1","sku":"season-pass-s1","name":"Cuffing Season","starts":"2026-11-07","ends":"2027-01-01","claimDays":14,"xpPerTier":200,"xp":{"daily_task":5,"daily_bonus":20,"goal":50},"badge":"pass-s1","tiers":[{"tier":1,"free":[{"kind":"cash","amount":100}],"paid":[{"kind":"item","sku":"pass-s1-cuffing-hoodie"}]},{"tier":2,"free":[{"kind":"clout","amount":10}],"paid":[{"kind":"item","sku":"home-pass-s1-situationship-neon"}]},{"tier":3,"free":[{"kind":"cash","amount":150}],"paid":[{"kind":"item","sku":"pass-s1-winter-tee"}]},{"tier":4,"free":[{"kind":"clout","amount":15}],"paid":[{"kind":"item","sku":"home-pass-s1-velvet-loveseat"}]},{"tier":5,"free":[{"kind":"cash","amount":200}],"paid":[{"kind":"item","sku":"pass-s1-plaid-pants"}]},{"tier":6,"free":[{"kind":"item","sku":"home-pass-s1-free-rug"}],"paid":[{"kind":"item","sku":"home-pass-s1-fireplace-rug"}]},{"tier":7,"free":[{"kind":"clout","amount":20}],"paid":[{"kind":"item","sku":"pass-s1-rink-zip"}]},{"tier":8,"free":[{"kind":"cash","amount":250}],"paid":[{"kind":"item","sku":"home-pass-s1-candle-lamp"}]},{"tier":9,"free":[{"kind":"clout","amount":25}],"paid":[{"kind":"item","sku":"pass-s1-skate-skirt"}]},{"tier":10,"free":[{"kind":"cash","amount":300}],"paid":[{"kind":"item","sku":"home-pass-s1-cocoa-bar"}]},{"tier":11,"free":[{"kind":"clout","amount":30}],"paid":[{"kind":"item","sku":"home-pass-s1-cuffing-bed"}]},{"tier":12,"free":[{"kind":"item","sku":"home-pass-s1-free-plant"}],"paid":[{"kind":"item","sku":"pass-s1-date-blazer"}]},{"tier":13,"free":[{"kind":"cash","amount":350}],"paid":[{"kind":"item","sku":"home-pass-s1-snow-plant"}]},{"tier":14,"free":[{"kind":"clout","amount":35}],"paid":[{"kind":"item","sku":"home-pass-s1-record-shelf"}]},{"tier":15,"free":[{"kind":"cash","amount":400}],"paid":[{"kind":"item","sku":"pass-s1-cocoa-boots"}]},{"tier":16,"free":[{"kind":"clout","amount":40}],"paid":[{"kind":"item","sku":"home-pass-s1-heart-armchair"}]},{"tier":17,"free":[{"kind":"cash","amount":450}],"paid":[{"kind":"item","sku":"home-pass-s1-mug-stand"}]},{"tier":18,"free":[{"kind":"cash","amount":500},{"kind":"clout","amount":50},{"kind":"title","id":"cuffed-26"}],"paid":[{"kind":"item","sku":"pass-s1-cuffed-cap"},{"kind":"badge","id":"pass-s1"}]}],"title":"cuffed-26","challenges":{"dates2":{"need":2,"xp":120,"source":{"ledger":["date_night"]}},"host1":{"need":1,"xp":90,"source":{"ledger":["visit_host"]}},"guest1":{"need":1,"xp":90,"source":{"ledger":["visit_guest"]}},"events2":{"need":2,"xp":100,"source":{"ledger":["event"]}},"choices3":{"need":3,"xp":90,"source":{"choices":true}},"life3":{"need":3,"xp":90,"source":{"ledger":["place_life"]}},"shifts3":{"need":3,"xp":90,"source":{"ledger":["shift"]}},"five4":{"need":4,"xp":100,"source":{"ledger":["daily_bonus"]}},"goal1":{"need":1,"xp":90,"source":{"ledger":["goal"]}}},"weeks":[{"from":"2026-11-16","ids":["dates2","choices3","five4"]},{"from":"2026-11-23","ids":["host1","shifts3","goal1"]},{"from":"2026-11-30","ids":["guest1","life3","five4"]},{"from":"2026-12-07","ids":["events2","choices3","goal1"]},{"from":"2026-12-14","ids":["dates2","shifts3","five4"]},{"from":"2026-12-21","ids":["host1","life3","goal1"]},{"from":"2026-12-28","ids":["guest1","choices3","five4"]}]}'::jsonb where key = 'season_pass';

/** Gives one reward (a piece arrives acquired 'collector', value 0; a title is a badge row 'title-<id>'). */
create or replace function public.season_give(p_player uuid, p_reward jsonb, p_ref text, p_paid boolean) returns void
language plpgsql security definer set search_path = public
as $$
declare
  k text := p_reward ->> 'kind';
  amt int := (p_reward ->> 'amount')::int;
begin
  if k = 'cash' and not p_paid then
    if public.ledger_once(p_player, 'cash', amt, 'season_free', p_ref) then
      update public.players set bank_cash = bank_cash + amt where id = p_player;
    end if;
  elsif k = 'clout' and not p_paid then
    if public.ledger_once(p_player, 'clout', amt, 'season_free', p_ref) then
      update public.players set clout = clout + amt where id = p_player;
    end if;
  elsif k = 'item' then
    insert into public.player_items (player_id, sku, category, value, acquired)
    values (p_player, p_reward ->> 'sku', coalesce(public.shop_item(p_reward ->> 'sku') ->> 'category', 'home'), 0, 'collector')
    on conflict (player_id, sku) do nothing;
  elsif k = 'badge' then
    insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, p_reward ->> 'id', 'season')
    on conflict do nothing;
  elsif k = 'title' and not p_paid then
    insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'title-' || (p_reward ->> 'id'), 'season')
    on conflict do nothing;
  end if;
end;
$$;

-- Level 18 was already claimed: the title comes with it.
insert into public.player_badges (player_id, badge_id, arc_id)
select player_id, 'title-cuffed-26', 'season' from public.season_claims where season = 's1' and tier = 18 and track = 'free'
on conflict do nothing;

/** This week's challenges for a player: each one's count, and its XP paid once when reached (only while the season runs). */
create or replace function public.season_week(p_player uuid, p_pay boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s jsonb := public.season_settings();
  today date := public.ny_today();
  monday date := today - (extract(isodow from today)::int - 1);
  wk jsonb;
  ws timestamptz := (monday::timestamp at time zone 'America/New_York');
  we timestamptz := ((monday + 7)::timestamp at time zone 'America/New_York');
  cid text;
  def jsonb;
  have int;
  need int;
  out jsonb := '[]'::jsonb;
begin
  if s is null or s -> 'weeks' is null then return null; end if;
  select x into wk from jsonb_array_elements(s -> 'weeks') x where (x ->> 'from')::date = monday limit 1;
  if wk is null then return null; end if;
  for cid in select jsonb_array_elements_text(wk -> 'ids') loop
    def := s -> 'challenges' -> cid;
    if def is null then continue; end if;
    need := (def ->> 'need')::int;
    if def -> 'source' ? 'choices' then
      select count(*) into have from public.choice_log
      where player_id = p_player and status = 'chosen' and chosen_at >= ws and chosen_at < we;
    else
      select count(distinct (l.kind, l.ref)) into have from public.ledger l
      where l.player_id = p_player and l.created_at >= ws and l.created_at < we
        and l.kind in (select jsonb_array_elements_text(def -> 'source' -> 'ledger'));
    end if;
    if p_pay and have >= need and (def ->> 'xp')::int > 0 then
      insert into public.season_xp (player_id, season, kind, ref, xp, ny_date)
      values (p_player, s ->> 'id', 'challenge', monday::text || ':' || cid, (def ->> 'xp')::int, today)
      on conflict do nothing;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('id', cid, 'have', least(have, need), 'done', have >= need));
  end loop;
  return jsonb_build_object('from', monday::text, 'challenges', out);
end;
$$;

/** The player's season: XP, phase, the paid row, what's claimed and this week's challenges (paying the ones reached). */
create or replace function public.season_state() returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.season_settings();
  today date := public.ny_today();
  v_phase text;
  v_week jsonb;
begin
  if uid is null or s is null then return null; end if;
  v_phase := case when today < (s ->> 'starts')::date then 'soon'
                  when today <= (s ->> 'ends')::date then 'on'
                  when today <= (s ->> 'ends')::date + (s ->> 'claimDays')::int then 'claim'
                  else 'over' end;
  v_week := case when v_phase = 'on' then public.season_week(uid, true) end;
  return jsonb_build_object(
    'seasonId', s ->> 'id',
    'xp', coalesce((select sum(xp) from public.season_xp where player_id = uid and season = s ->> 'id'), 0),
    'today', coalesce((select sum(xp) from public.season_xp where player_id = uid and season = s ->> 'id' and ny_date = today), 0),
    'paid', public.has_entitlement(uid, s ->> 'sku'),
    'vip', public.vip_member(uid),
    'phase', v_phase,
    'week', v_week,
    'pending', exists (select 1 from public.purchases u where u.player_id = uid and u.sku = s ->> 'sku' and u.status = 'pending'
                         and u.created_at > now() - interval '1 hour'),
    'claimed', jsonb_build_object(
      'free', coalesce((select jsonb_agg(tier order by tier) from public.season_claims where player_id = uid and season = s ->> 'id' and track = 'free'), '[]'::jsonb),
      'paid', coalesce((select jsonb_agg(tier order by tier) from public.season_claims where player_id = uid and season = s ->> 'id' and track = 'paid'), '[]'::jsonb)));
end;
$$;

/** Who holds this season's title (the chip by their name on the leaderboard, in chat and on the player card). */
create or replace function public.season_titled() returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(b.player_id), '{}') from public.player_badges b
  where b.badge_id = 'title-' || (public.season_settings() ->> 'title')
$$;

revoke all on function public.season_give(uuid, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.season_week(uuid, boolean) from public, anon, authenticated;
revoke all on function public.season_state() from public, anon;
revoke all on function public.season_titled() from public, anon;
grant execute on function public.season_state() to authenticated;
grant execute on function public.season_titled() to authenticated;
