-- Switching on the new bodies (stage 4 of the avatar and Shop upgrade, docs/shop-manager.md; owner, Oct 21: "go").
-- The Shop catalog's clothes and accessories can be worn now (lib/catalogWear.ts, lib/accessories.ts draw them):
--   * Wearable accessories (the Accessories tab's hats, glasses, earrings, necklaces, bags and watch) are filed as
--     fashion when bought, like every other piece you wear, so equipping, Your Look and the style lines take them.
--     The Shop still shows them under Accessories (it reads the catalog's tab).
--   * A dress (slot 'one-piece') is a top and a bottom: wearing one takes off the top and bottom, and the other way
--     round (wear_slots, equip_item); save_look refuses both at once ('one_piece_conflict'); style_counts counts a dress
--     as covering the top and the bottom.
--   * The 84 pieces whose shapes exist are unlocked (wearable), whatever their status: the owner still approves each.

create or replace function public.wear_slots(p_slot text)
returns text[] language sql immutable as $$
  select case when p_slot = 'one-piece' then array['one-piece', 'top', 'bottom']
              when p_slot in ('top', 'bottom') then array[p_slot, 'one-piece']
              else array[p_slot] end
$$;

create or replace function public.shop_city_entries() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('sku', c.sku, 'rentPerWeek', 0, 'slot', c.slot, 'storyOnly', false, 'cloutReq', 0)
           || c.city
           || jsonb_build_object('category', case when c.tab = 'accessories' and c.slot in ('head', 'face', 'ears', 'neck', 'hand', 'wrist')
                                                  then 'fashion' else c.tab end,
                                 'price', c.price, 'clout', c.clout, 'collector', c.real_cash, 'status', c.status,
                                 'wearable', c.wearable)
           order by c.position, c.sku), '[]'::jsonb)
    from public.shop_catalog c
   where c.status in ('scheduled', 'live', 'retired')
$$;

create or replace function public.equip_item(p_item bigint, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.player_items;
  v_slot text;
begin
  select * into it from public.player_items where id = p_item and player_id = uid;
  if it.id is null or it.category <> 'fashion' then raise exception 'not_wearable' using errcode = '22023'; end if;
  v_slot := public.shop_item(it.sku) ->> 'slot';
  if p_on then
    update public.player_items pi set equipped = false
     where pi.player_id = uid and pi.category = 'fashion' and pi.id <> it.id and pi.equipped
       and public.shop_item(pi.sku) ->> 'slot' = any(public.wear_slots(v_slot));
  end if;
  update public.player_items set equipped = p_on where id = it.id;
end;
$$;

create or replace function public.save_look(p_items bigint[], p_covering text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_items bigint[] := coalesce(p_items, '{}');
  v_slots text[];
begin
  if not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '42501'; end if;
  if p_covering not in ('none', 'cap', 'fedora', 'bucket', 'durag', 'hijab', 'turban', 'headwrap', 'kippah') then
    raise exception 'bad_covering' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_items) i
              where not exists (select 1 from public.player_items pi where pi.id = i and pi.player_id = uid and pi.category = 'fashion')) then
    raise exception 'not_wearable' using errcode = '22023';
  end if;
  select array_agg(public.shop_item(pi.sku) ->> 'slot') into v_slots
    from public.player_items pi where pi.player_id = uid and pi.id = any(v_items);
  if (select count(*) <> count(distinct s) from unnest(coalesce(v_slots, '{}')) s) then
    raise exception 'one_per_slot' using errcode = '22023';
  end if;
  if 'one-piece' = any(coalesce(v_slots, '{}')) and ('top' = any(v_slots) or 'bottom' = any(v_slots)) then
    raise exception 'one_piece_conflict' using errcode = '22023';
  end if;

  update public.player_items set equipped = (id = any(v_items))
   where player_id = uid and category = 'fashion' and equipped is distinct from (id = any(v_items));
  update public.players
     set look = look || jsonb_build_object('covering', p_covering)
                     || case when look ? 'build' then '{}'::jsonb
                             else jsonb_build_object('build', case when look ->> 'body' = 'curvy' then 'curvy' else 'athletic' end) end
   where id = uid;
end;
$$;

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
      -- A dress covers the top and the bottom.
      if r.slot = 'one-piece' then covered := covered || array['top', 'bottom'];
      elsif r.slot is not null then covered := covered || r.slot; end if;
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

-- The pieces whose shapes exist: wearable now.
update public.shop_catalog set wearable = true
 where not wearable and sku = any(array[
    'cloud-puffer', 'midnight-buckle-coat', 'library-card-cardigan', 'lilac-lap-track-jacket', 'midtown-camel-blazer', 'old-money-cashmere-coat',
    'sartorio-sculpt-jacket', 'forest-floor-hoodie', 'alumni-of-nothing-varsity', 'fishnet-fridays-top', 'chained-heart-corset', 'crisp-monday-shirt',
    'baby-pink-rib-crop', 'unfinished-business-tee', 'trust-fund-quarter-zip', 'faculty-lounge-tweed-blazer', 'corner-office-pinstripe-jacket', 'sky-lap-windbreaker',
    'survived-something-hoodie', 'dune-cloud-puffer', 'moth-approved-knit', 'unfinished-thought-thermal', 'inherited-barn-jacket', 'nowhere-to-be-vest',
    'expedition-to-brunch-parka', 'already-vintage-denim-jacket', 'lilac-lap-sports-bra', 'snow-day-faux-fur', 'rooftop-halter', 'seamless-night-bodysuit',
    'commuter-trench', 'champagne-hour-trousers', 'study-hall-tartan-skirt', 'mint-condition-leggings', 'quarterly-review-trousers', 'second-life-denim-trousers',
    'every-pocket-cargos', 'emerald-satin-slip-skirt', 'post-apocalypse-lounge-pants', 'match-point-skirt', 'lilac-lap-biker-shorts', 'block-party-mini-skirt',
    'after-hours-mini', 'red-carpet-rehearsal-gown', 'midnight-velvet-dress', 'board-meeting-wrap-dress', 'sartorio-ruffle-dress', 'moth-approved-maxi',
    'corner-picnic-sundress', 'cloud-step-hitops', 'nightshift-platforms', 'honor-roll-loafers', 'glow-lap-runners', 'gala-gold-heels',
    'lime-sculpt-clogs', 'never-worked-a-day-boots', 'pre-destroyed-runners', 'stomping-ground-boots', 'hall-pass-mary-janes', 'out-of-office-slingbacks',
    'recital-ballet-flats', 'sidewalk-throne-sandals', 'patchwork-bucket-hat', 'corner-beanie', 'midtown-fedora', 'gallery-opening-hat',
    'incognito-knit', 'brunch-shades', 'future-is-bright-visor', 'old-money-frames', 'everyday-hoops', 'statement-drops',
    'double-rope-chains', 'the-clout-flame', 'inheritance-pearls', 'velvet-ring-choker', 'gilded-silk-scarf', 'farmers-market-tote',
    'commute-sling', 'emerald-hour-bag', 'blush-mini-top-handle', 'lilac-errand-bag', 'afterparty-clutch', 'ice-rink-watch'
  ]);

-- Already-bought accessories (none can be, while they were locked) would be filed as fashion too.
update public.player_items pi set category = 'fashion'
  from public.shop_catalog c
 where c.sku = pi.sku and pi.category = 'accessories' and c.slot in ('head', 'face', 'ears', 'neck', 'hand', 'wrist');

update public.game_settings set updated_at = now() where key = 'city';

revoke all on function public.wear_slots(text) from public, anon, authenticated;
revoke all on function public.equip_item(bigint, boolean) from public, anon;
grant execute on function public.equip_item(bigint, boolean) to authenticated;
revoke all on function public.save_look(bigint[], text) from public, anon;
grant execute on function public.save_look(bigint[], text) to authenticated;
revoke all on function public.style_counts(uuid) from public, anon, authenticated;
