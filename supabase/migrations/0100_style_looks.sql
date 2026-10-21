-- Style lines in play (stage 4 of the avatar and Shop upgrade; docs/fashion-style-lines.md "Making styles matter in
-- play"; lib/style.ts holds the same rules, copied into game_settings 'style' and checked by tests/style.test.ts).
--   * style_counts(player): how many pieces of each line a player wears. Each equipped fashion piece counts 1 toward
--     each of its lines, whatever it cost; a whole outfit counts fullMin; top, bottom and shoes without a Shop piece
--     count toward the starting style's line (a new player arrives in a full look).
--   * The pieces on sale before the catalog files get their lines (shop_catalog.style_lines was empty for them).
--   * Venue match: venueMin pieces of a line that fits a place (by its tags) give venueConfidence Confidence there,
--     once a New York day (style_boosts; a deferred trigger on action_uses, after the action, swallowing its errors).
--   * Full look: fullMin pieces of a line earn the badge "look-<line>" the first time (a trigger on player_items).
--   * Style tasks: on the day's list being made, a taskChance chance that its last ordinary task becomes
--     'style:<line>' at a place that fits a line the player owns a full look of. complete_task only counts it while
--     the look is worn.
--   * style_state(): the player's counts, full looks and today's venue boost (the profile and the Shop).

insert into public.game_settings (key, value) values ('style', '{"venueMin":2,"fullMin":3,"venueConfidence":5,"taskChance":0.5,"venues":{"streetwear":["park","pizza","diner","bodega","hot_dog_cart","halal_cart","dining_budget"],"gothic":["club","late_night","music_venue"],"nerdy-preppy":["library","university","campus","games"],"sporty":["gym","park","sports","stadium"],"business-casual":["office","coworking","rooftop"],"fashionista":["rooftop","dining_luxury","fashion","first_party_venue"],"luxury":["lounge","exclusive_venue","exclusive_club","dining_luxury"],"avant-garde":["fashion","music_venue","cinema"],"wasteland-luxe":["club","lounge","exclusive_venue"]},"startingLines":{"bodega_drip":"streetwear","thrift_store_icon":"avant-garde","midtown_finance":"business-casual","night_owl_goth":"gothic","pilates_princess":"sporty","startup_founder":"business-casual","influencer_soft_glam":"fashionista","arcade_nerd":"nerdy-preppy"},"liveLines":{"fit-satin-bomber":["streetwear","fashionista"],"fit-leather-blazer":["business-casual","gothic"],"fit-varsity-tee":["streetwear","nerdy-preppy"],"fit-wide-trousers":["fashionista","business-casual"],"fit-mini-skirt":["nerdy-preppy","fashionista"],"fit-chunky-sneakers":["streetwear","sporty"],"forever-our-bird-hoodie":["streetwear"],"col-faux-chinchilla":["luxury"],"col-holo-boots":["avant-garde","fashionista"],"fit-meteors-cap":["sporty","streetwear"],"fit-meteors-jersey":["sporty"],"fit-bucket-hat":["streetwear"],"set-site-crew":["streetwear"],"set-st-marks-punk":["gothic"],"set-gala-night":["luxury","business-casual"],"set-ranch-hand":["avant-garde"],"set-rockaway-beach":["sporty"],"set-adventurer":["sporty"],"set-tactical":["streetwear"],"set-witch":["gothic"],"set-ranger":["avant-garde"],"set-spacefarer":["avant-garde"],"set-royalty":["luxury"]}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.style_settings()
returns jsonb language sql stable security definer set search_path = public
as $$ select value from public.game_settings where key = 'style' $$;

-- The pieces on sale before the catalog files: their lines.
update public.shop_catalog c
   set style_lines = array(select jsonb_array_elements_text(public.style_settings() -> 'liveLines' -> c.sku))
 where c.style_lines = '{}' and public.style_settings() -> 'liveLines' ? c.sku;

create or replace function public.style_counts(p_player uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  st jsonb := public.style_settings();
  full_min int := (st ->> 'fullMin')::int;
  out_c jsonb := '{}'::jsonb;
  covered text[] := '{}';
  r record;
  l text;
  own text;
  s text;
begin
  for r in
    select pi.sku, coalesce(c.slot, public.shop_item(pi.sku) ->> 'slot') as slot,
           coalesce(nullif(c.style_lines, '{}'), array(select jsonb_array_elements_text(st -> 'liveLines' -> pi.sku))) as lines
      from public.player_items pi left join public.shop_catalog c on c.sku = pi.sku
     where pi.player_id = p_player and pi.category = 'fashion' and pi.equipped
  loop
    if r.slot = 'outfit' then
      covered := covered || array['top', 'bottom', 'shoes'];
      foreach l in array coalesce(r.lines, '{}') loop
        out_c := jsonb_set(out_c, array[l], to_jsonb(coalesce((out_c ->> l)::int, 0) + full_min));
      end loop;
    else
      if r.slot is not null then covered := covered || r.slot; end if;
      foreach l in array coalesce(r.lines, '{}') loop
        out_c := jsonb_set(out_c, array[l], to_jsonb(coalesce((out_c ->> l)::int, 0) + 1));
      end loop;
    end if;
  end loop;
  own := st -> 'startingLines' ->> (select starting_style from public.players where id = p_player);
  if own is not null then
    foreach s in array array['top', 'bottom', 'shoes'] loop
      if not (s = any(covered)) then out_c := jsonb_set(out_c, array[own], to_jsonb(coalesce((out_c ->> own)::int, 0) + 1)); end if;
    end loop;
  end if;
  return out_c;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Venue match: once a New York day, at a place that fits a line worn venueMin times.
-- ---------------------------------------------------------------------------------------------------------------
create table public.style_boosts (
  player_id uuid not null references public.players (id) on delete cascade,
  ny_date   date not null,
  line      text not null,
  place_id  text not null,
  at        timestamptz not null default now(),
  primary key (player_id, ny_date)
);
alter table public.style_boosts enable row level security;
create policy "own style boosts" on public.style_boosts for select to authenticated using (player_id = auth.uid());

create or replace function public.style_venue_boost(p_player uuid, p_place text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  st jsonb := public.style_settings();
  today date := public.ny_today();
  counts jsonb;
  tags text[];
  v record;
  n int;
  best text;
  best_n int := 0;
begin
  if st is null or exists (select 1 from public.style_boosts where player_id = p_player and ny_date = today) then return null; end if;
  tags := array(select jsonb_array_elements_text(p -> 'tags') from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  if coalesce(array_length(tags, 1), 0) = 0 then return null; end if;
  counts := public.style_counts(p_player);
  for v in select key, value from jsonb_each(st -> 'venues') loop
    n := coalesce((counts ->> v.key)::int, 0);
    if n >= (st ->> 'venueMin')::int and n > best_n
       and tags && array(select jsonb_array_elements_text(v.value)) then
      best := v.key; best_n := n;
    end if;
  end loop;
  if best is null then return null; end if;
  insert into public.style_boosts (player_id, ny_date, line, place_id) values (p_player, today, best, p_place) on conflict do nothing;
  if not found then return null; end if;
  update public.players set confidence = least(100, confidence + (st ->> 'venueConfidence')::int) where id = p_player;
  return best;
end;
$$;

create or replace function public.style_on_action()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.style_venue_boost(new.player_id, new.place_id);
  exception when others then null; -- a bonus never blocks the action
  end;
  return new;
end;
$$;
-- Deferred to the end of the action's transaction: the boost comes after the action, so it never changes the clout
-- that same action pays (clout scales with Confidence).
create constraint trigger style_on_action after insert on public.action_uses
  deferrable initially deferred for each row execute function public.style_on_action();

-- ---------------------------------------------------------------------------------------------------------------
-- Full look: the badge the first time.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.style_full_badges(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  full_min int := (public.style_settings() ->> 'fullMin')::int;
begin
  for r in select key, value from jsonb_each(public.style_counts(p_player)) loop
    if (r.value #>> '{}')::int >= full_min then
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'look-' || r.key, 'style') on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.style_on_equip()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  begin
    if new.category = 'fashion' and new.equipped then perform public.style_full_badges(new.player_id); end if;
  exception when others then null;
  end;
  return new;
end;
$$;
create trigger style_on_equip after insert or update of equipped on public.player_items for each row execute function public.style_on_equip();

-- ---------------------------------------------------------------------------------------------------------------
-- The player's screen.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.style_state()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  counts jsonb;
  b record;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  -- A starting look (no Shop pieces needed) earns its badge here, the first time the profile asks.
  perform public.style_full_badges(uid);
  counts := public.style_counts(uid);
  select line, place_id into b from public.style_boosts where player_id = uid and ny_date = public.ny_today();
  return jsonb_build_object(
    'counts', counts,
    'full', coalesce((select jsonb_agg(key order by (value #>> '{}')::int desc) from jsonb_each(counts)
                       where (value #>> '{}')::int >= (public.style_settings() ->> 'fullMin')::int), '[]'::jsonb),
    'boost', case when b.line is null then null else jsonb_build_object('line', b.line, 'place', b.place_id) end);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Style tasks: the day's list as before (0094's ensure_daily, renamed), then maybe one style task.
-- ---------------------------------------------------------------------------------------------------------------
alter function public.ensure_daily(uuid) rename to ensure_daily_v0094;

create or replace function public.ensure_daily(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  st jsonb := public.style_settings();
  had boolean := exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today);
  owned jsonb := '{}'::jsonb;
  r record;
  l text;
  own text;
  pick_line text;
  pick record;
  slot_id bigint;
begin
  perform public.ensure_daily_v0094(p_player);
  if had or st is null or random() >= coalesce((st ->> 'taskChance')::float, 0) then return; end if;
  -- The lines the player owns a full look of: their pieces (equipped or not), a whole outfit, their starting clothes.
  for r in
    select coalesce(c.slot, public.shop_item(pi.sku) ->> 'slot') as slot,
           coalesce(nullif(c.style_lines, '{}'), array(select jsonb_array_elements_text(st -> 'liveLines' -> pi.sku))) as lines
      from public.player_items pi left join public.shop_catalog c on c.sku = pi.sku
     where pi.player_id = p_player and pi.category = 'fashion'
  loop
    foreach l in array coalesce(r.lines, '{}') loop
      owned := jsonb_set(owned, array[l], to_jsonb(coalesce((owned ->> l)::int, 0) + case when r.slot = 'outfit' then (st ->> 'fullMin')::int else 1 end));
    end loop;
  end loop;
  own := st -> 'startingLines' ->> (select starting_style from public.players where id = p_player);
  if own is not null then owned := jsonb_set(owned, array[own], to_jsonb(coalesce((owned ->> own)::int, 0) + 3)); end if;
  -- A place that fits one of those lines: open to the player, not a story place, not already on today's list, with
  -- something ordinary to do there.
  select x.line, x.place, x.action into pick
    from (
      select o.key as line, p ->> 'id' as place,
             (select a ->> 'id' from jsonb_array_elements(p -> 'actions') a where a ->> 'kind' in ('visit', 'hangout', 'eat') limit 1) as action
        from jsonb_each(owned) o
        cross join jsonb_array_elements(public.city() -> 'places') p
       where (o.value #>> '{}')::int >= (st ->> 'fullMin')::int
         and p ->> 'story' is null
         and array(select jsonb_array_elements_text(p -> 'tags')) && array(select jsonb_array_elements_text(st -> 'venues' -> o.key))
         and public.place_open(p ->> 'id')
         and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = p ->> 'id')
    ) x
   where x.action is not null
   order by random() limit 1;
  if pick.line is null then return; end if;
  select id into slot_id from public.daily_tasks
   where player_id = p_player and ny_date = today and done_at is null and kind not in ('gossip', 'class') and kind not like 'style:%'
   order by slot desc limit 1;
  if slot_id is null then return; end if;
  update public.daily_tasks set kind = 'style:' || pick.line, place_id = pick.place, action_id = pick.action where id = slot_id;
end;
$$;

-- 0042's complete_task, except a style task only counts while its look is worn.
create or replace function public.complete_task(p_player uuid, p_place text, p_action text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  t record;
  bonus int := (public.city() -> 'economy' -> 'dailyTasks' ->> 'bonus')::int;
  task_clout int := coalesce((public.city() -> 'economy' -> 'gossip' ->> 'taskClout')::int, 0);
  paid int := 0;
  counts jsonb := public.style_counts(p_player);
  full_min int := coalesce((public.style_settings() ->> 'fullMin')::int, 3);
begin
  perform public.crew_went(p_player, p_place, p_action);
  select * into t from public.daily_tasks
   where player_id = p_player and ny_date = today and place_id = p_place and action_id = p_action and done_at is null
     and (kind not like 'style:%' or coalesce((counts ->> substr(kind, 7))::int, 0) >= full_min)
   order by slot limit 1 for update;
  if t.id is null then return 0; end if;
  update public.daily_tasks set done_at = now() where id = t.id;
  if t.kind = 'gossip' then
    if task_clout > 0 and public.ledger_once(p_player, 'clout', task_clout, 'daily_task', t.id::text) then
      update public.players set clout = clout + task_clout where id = p_player;
    end if;
  elsif public.ledger_once(p_player, 'cash', t.reward, 'daily_task', t.id::text) then
    update public.players set bank_cash = bank_cash + t.reward where id = p_player;
    paid := t.reward;
  end if;
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today and done_at is null)
     and public.ledger_once(p_player, 'cash', bonus, 'daily_bonus', today::text) then
    update public.players set bank_cash = bank_cash + bonus where id = p_player;
    paid := paid + bonus;
  end if;
  return paid;
end;
$$;

revoke all on function public.style_settings() from public, anon, authenticated;
revoke all on function public.style_counts(uuid) from public, anon, authenticated;
revoke all on function public.style_venue_boost(uuid, text) from public, anon, authenticated;
revoke all on function public.style_on_action() from public, anon, authenticated;
revoke all on function public.style_full_badges(uuid) from public, anon, authenticated;
revoke all on function public.style_on_equip() from public, anon, authenticated;
revoke all on function public.ensure_daily(uuid) from public, anon, authenticated;
revoke all on function public.ensure_daily_v0094(uuid) from public, anon, authenticated;
revoke all on function public.style_state() from public, anon, authenticated;
grant execute on function public.style_state() to authenticated;
