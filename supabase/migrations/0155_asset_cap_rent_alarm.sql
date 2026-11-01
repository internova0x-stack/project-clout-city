-- 0155 (owner, Nov 1: "fix the property limit and rent alarm").
--   * Business and house sales (migration 0153) no longer stop at the Player Economy's weekly cap (C$5,000 for most players,
--     which put every house and most businesses out of reach). They keep their own limits (2 deals a month, 14 days of
--     ownership first, 24 hours of cooling-off, the 10% fee) and now sit in a tighter price band: 80% to 120% of the
--     appraisal (game_settings 'asset_sales'.band, mirrored by lib/assetSales.ts ASSET_BAND), so a sale can't hide a big
--     cash transfer. Sales still count toward the week's totals, the flags still run, and only the part of a price over
--     the appraisal is left out of rank (0153).
--   * The rent alarm (migration 0112) compares the bank with the player's own part of the rent: a partner living together
--     pays their share (cohabit_rent_part, migration 0149), so they're no longer warned early about the whole rent; a
--     partner in the other's owned house pays nothing and is never warned.
-- Safe to run more than once.

update public.game_settings set value = value || '{"band":{"min":0.8,"max":1.2,"edge":0.03}}'::jsonb, updated_at = now()
 where key = 'asset_sales';

/** The price band for a business or house sale: min and max around the appraisal (asset_sales.band). */
create or replace function public.asset_band(p_reference bigint) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('min', ceil(p_reference * coalesce((b ->> 'min')::numeric, 0.8))::bigint,
                            'max', floor(p_reference * coalesce((b ->> 'max')::numeric, 1.2))::bigint)
    from (select public.asset_settings() -> 'band' b) x
$$;

/** Refuses an asset price outside its band ('out_of_band') and flags one at either edge ('band_edge'). */
create or replace function public.asset_band_check(p_players uuid[], p_reference bigint, p_price bigint, p_ref text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  b jsonb := public.asset_settings() -> 'band';
  lo numeric := coalesce((b ->> 'min')::numeric, 0.8);
  hi numeric := coalesce((b ->> 'max')::numeric, 1.2);
  edge numeric := coalesce((b ->> 'edge')::numeric, 0.03);
  r numeric;
begin
  if p_reference is null or p_reference <= 0 then raise exception 'no_reference' using errcode = '22023'; end if;
  r := p_price::numeric / p_reference;
  if r < lo or r > hi then raise exception 'out_of_band' using errcode = '22023'; end if;
  if r <= lo + edge or r >= hi - edge then
    perform public.economy_flag('band_edge', p_players, p_ref, jsonb_build_object('reference', p_reference, 'price', p_price));
  end if;
end;
$$;

-- 0151's gate, with asset sales off the weekly cap.
create or replace function public.economy_can(p_player uuid, p_kind text, p_amount bigint, p_direction text) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  why text;
begin
  if p_direction not in ('send', 'receive') then raise exception 'bad_direction' using errcode = '22023'; end if;
  if not public.economy_phase_on(p_kind) then raise exception 'phase_off' using errcode = '22023'; end if;
  why := case when p_direction = 'receive' then public.economy_unlock_receive(p_player) else public.economy_unlock(p_player) end;
  if why = 'no_player' then raise exception 'no_player' using errcode = '28000'; end if;
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  -- 0155 (owner, Nov 1): business and house sales have their own limits (2 deals a month, 14 days' ownership, a tight
  -- price band around the appraisal), so the general weekly cap no longer blocks them; they still count toward it.
  if p_kind <> 'asset' and coalesce(p_amount, 0) > public.economy_room(p_player, p_direction) then
    raise exception 'weekly_limit' using errcode = '22023', hint = p_direction;
  end if;
  return true;
end;
$$;

-- 0153's sale sheet and offer, on the asset band.
create or replace function public.asset_view(p_kind text, p_id text, p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  s jsonb := public.asset_settings();
  v bigint := public.asset_appraisal(p_kind, p_id, p_player);
  def jsonb;
  item jsonb;
  lvl int := 0;
  since timestamptz := public.asset_since(p_kind, p_id, p_player);
begin
  if v is null then return null; end if;
  if p_kind = 'business' then
    def := public.business_def(p_id);
    select level into lvl from public.player_businesses where player_id = p_player and business_id = p_id;
  else
    item := public.shop_item(p_id);
  end if;
  return jsonb_build_object(
    'kind', p_kind, 'id', p_id,
    'label', coalesce(def ->> 'name', item ->> 'name', p_id), 'emoji', coalesce(def ->> 'emoji', item ->> 'emoji', case when p_kind = 'house' then '🏡' else '🏪' end),
    'level', lvl, 'appraisal', v, 'band', public.asset_band(v), 'feeRate', coalesce((public.economy_settings() -> 'fees' ->> 'asset')::numeric, 0.1),
    'block', public.asset_block(p_kind, p_id, p_player),
    'sellableFrom', since + make_interval(days => coalesce((s ->> 'minOwnDays')::int, 14)));
end;
$$;

create or replace function public.asset_sale_offer(p_kind text, p_id text, p_buyer uuid, p_price bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.asset_settings();
  why text;
  v bigint;
  def jsonb;
  item jsonb;
  lvl int := 0;
  hid bigint;
  a public.asset_sales;
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.rate_hit(uid, 'assets', 20, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_kind not in ('business', 'house') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if p_buyer is null or p_buyer = uid then raise exception 'own_sale' using errcode = '22023'; end if;
  if coalesce(p_price, 0) <= 0 then raise exception 'out_of_band' using errcode = '22023'; end if;
  perform public.economy_can(uid, 'asset', p_price, 'receive');
  perform public.tick(uid);
  perform 1 from public.players where id in (uid, p_buyer) order by id for update;
  perform public.asset_sales_settle_due(uid);
  why := public.asset_block(p_kind, p_id, uid);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = p_buyer and home_id is not null and banned_at is null) then
    raise exception 'unknown_player' using errcode = '22023';
  end if;
  if not public.economy_visible(uid, p_buyer) then raise exception 'not_friends' using errcode = '22023'; end if;
  if public.economy_unlock(p_buyer) is not null then raise exception 'they_cant_buy' using errcode = '22023'; end if;
  why := public.asset_buyer_block(p_kind, p_id, p_buyer);
  if why is not null then raise exception '%', why using errcode = '22023'; end if;
  v := public.asset_appraisal(p_kind, p_id, uid);
  if p_kind = 'business' then
    def := public.business_def(p_id);
    select level into lvl from public.player_businesses where player_id = uid and business_id = p_id;
  else
    item := public.shop_item(p_id);
    select id into hid from public.player_items where player_id = uid and sku = p_id;
  end if;
  insert into public.asset_sales (seller, buyer, kind, asset, item_id, label, emoji, level, appraisal, price, fee, traces, expires_at)
  values (uid, p_buyer, p_kind, p_id, hid, coalesce(def ->> 'name', item ->> 'name', p_id),
          coalesce(def ->> 'emoji', item ->> 'emoji', case when p_kind = 'house' then '🏡' else '🏪' end), lvl, v, p_price,
          public.economy_fee('asset', p_price), public.asset_traces(p_kind, p_id, uid),
          now() + make_interval(days => coalesce((s ->> 'offerDays')::int, 3)))
  returning * into a;
  -- Out of the band: refused (the insert goes with it); at either edge: flagged for the Studio.
  perform public.asset_band_check(array[uid, p_buyer], v, p_price, 'asset:' || a.id);
  begin
    perform public.push_enqueue(p_buyer, 'asset_offer', 'asset_offer:' || a.id, '🏷️ ' || public.push_name(uid) || ' wants to sell you something',
      'The ' || lower(a.label) || ', for C$' || to_char(p_price, 'FM999,999,999') || '. Take a look before it walks.', '/home?open=assets', null, true, 'asset');
  exception when others then null;
  end;
  return public.asset_sale_json(a, uid);
end;
$$;

-- 0112's rent alarm, on the player's own part of the rent.
create or replace function public.push_scan_rent_short() returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  n int := 0;
  r record;
begin
  for r in
    select x.id, x.due, x.rent, x.bank_cash from (
      select p.id, p.next_rent_due as due, p.bank_cash,
             public.cohabit_rent_part(p.id, public.rent_for(p.home_id)) as rent
        from public.players p
       where p.house_sku is null and p.home_id is not null
         and p.next_rent_due between today and today + 3) x
     where x.rent > 0 and x.bank_cash < x.rent
  loop
    perform public.push_enqueue(r.id, 'rent_short', 'rentshort:' || r.id || ':' || r.due,
      '💸 Rent''s due ' || (case r.due - today when 0 then 'today' when 1 then 'tomorrow' else 'in ' || (r.due - today) || ' days' end)
        || ' and you''re short',
      'C$' || to_char(r.rent, 'FM999,999,999') || ' due, C$' || to_char(greatest(r.bank_cash, 0), 'FM999,999,999')
        || ' in the bank. Grab a gig before your landlord grabs your keys.',
      '/home?open=gigs', public.push_day_end(r.due));
    n := n + 1;
  end loop;
  return n;
exception when others then return n;
end;
$$;

revoke all on function public.asset_band(bigint) from public, anon, authenticated;
revoke all on function public.asset_band_check(uuid[], bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.economy_can(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.asset_view(text, text, uuid) from public, anon, authenticated;
revoke all on function public.push_scan_rent_short() from public, anon, authenticated;
grant execute on function public.push_scan_rent_short() to service_role;
