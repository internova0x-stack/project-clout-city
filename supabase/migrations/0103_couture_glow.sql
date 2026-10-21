-- Clout Couture's extras (owner, Oct 21: "go"):
--   * The 24k Glow Ritual: a gold shimmer on the avatar's skin, put on or taken off in
--     Your Look like any piece (its own slot, 'face-effect'; lib/wearing.ts calls it "glow"). Sold in Makeup, it is filed
--     as fashion to be worn and valued by its Makeup tab (0102's collector_tab_value). It works now, so it is unlocked.
--   * A piece made yours (player_items.options, set_item_options): the Clout Crown as a crown or a tiara; the Sartorio
--     suit's cloth and lining colors and up to three monogram initials (the chat word filter applies).
--   * crowned_players(): crown owners, for the crown by their name on the leaderboard and in chat.

create or replace function public.shop_city_entries() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('sku', c.sku, 'rentPerWeek', 0, 'slot', c.slot, 'storyOnly', false, 'cloutReq', 0)
           || c.city
           || jsonb_build_object('category', case when c.tab in ('accessories', 'luxury') and c.slot in ('head', 'face', 'ears', 'neck', 'hand', 'wrist')
                                                  then 'fashion'
                                                  when c.slot = 'face-effect' then 'fashion'
                                                  else c.tab end,
                                 'price', c.price, 'clout', c.clout, 'collector', c.real_cash, 'status', c.status,
                                 'wearable', c.wearable, 'tab', c.tab)
           order by c.position, c.sku), '[]'::jsonb)
    from public.shop_catalog c
   where c.status in ('scheduled', 'live', 'retired')
$$;

update public.player_items i set category = 'fashion'
  from public.shop_catalog c
 where c.sku = i.sku and c.slot = 'face-effect' and i.category <> 'fashion';

-- Unlocked (the statement trigger rebuilds the game's Shop list).
update public.shop_catalog set wearable = true where not wearable and sku = '24k-glow-ritual';
update public.game_settings set updated_at = now() where key = 'city';

-- ---------------------------------------------------------------------------
-- A piece made yours: the crown or a tiara, the suit's cloth, lining and monogram (owner, Oct 21: "go")
-- ---------------------------------------------------------------------------
-- The choices live on the owned piece. The palettes match lib/couture.ts (tests/couture.test.ts reads both).
alter table public.player_items add column if not exists options jsonb not null default '{}';

create or replace function public.set_item_options(p_item bigint, p_options jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.player_items;
  o jsonb := coalesce(p_options, '{}');
  v_out jsonb := '{}';
  v_mono text;
begin
  select * into it from public.player_items where id = p_item and player_id = uid for update;
  if it.id is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if it.sku = 'clout-crown' then
    if coalesce(o ->> 'style', 'crown') not in ('crown', 'tiara') then raise exception 'bad_option' using errcode = '22023'; end if;
    v_out := jsonb_build_object('style', coalesce(o ->> 'style', 'crown'));
  elsif it.sku = 'sartorio-bespoke-suit' then
    if coalesce(o ->> 'cloth', '#1B2440') not in ('#1B2440', '#14111A', '#3A3F47', '#EDE3CF', '#1F4A3A', '#5A1A2A')
       or coalesce(o ->> 'lining', '#D4AF37') not in ('#D4AF37', '#C0C6CE', '#B3122E', '#1F6B4A', '#6B4FD8') then
      raise exception 'bad_option' using errcode = '22023';
    end if;
    v_mono := upper(btrim(coalesce(o ->> 'monogram', '')));
    if v_mono !~ '^[A-Z]{0,3}$' then raise exception 'bad_monogram' using errcode = '22023'; end if;
    if v_mono <> '' and public.chat_filter(v_mono) <> v_mono then raise exception 'monogram_not_allowed' using errcode = '22023'; end if;
    v_out := jsonb_build_object('cloth', coalesce(o ->> 'cloth', '#1B2440'), 'lining', coalesce(o ->> 'lining', '#D4AF37'), 'monogram', v_mono);
  else
    raise exception 'no_options' using errcode = '22023';
  end if;
  update public.player_items set options = v_out where id = it.id;
  return v_out;
end;
$$;

/** Who wears the Clout Crown's status: everyone holding an active crown, for the crown by their name (leaderboards, chat). */
create or replace function public.crowned_players() returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(e.player_id), '{}')
    from public.entitlements e join public.players p on p.id = e.player_id
   where e.sku = 'clout-crown' and e.status = 'active' and p.banned_at is null
$$;

revoke all on function public.set_item_options(bigint, jsonb) from public, anon;
grant execute on function public.set_item_options(bigint, jsonb) to authenticated;
revoke all on function public.crowned_players() from public, anon;
grant execute on function public.crowned_players() to authenticated;
