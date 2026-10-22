-- No product listed twice (owner, Oct 22: "two necklaces with the same image but different names"). Three pieces from
-- before the Shop Manager were given a newer item's picture by live-shop-images.json, so the Shop showed what looked
-- like the same product twice:
--   * Chunky gold-tone chain (lux-gold-chain)    : the Double Rope Chains picture
--   * Designer watch        (lux-designer-watch) : the Ice Rink Watch picture
--   * Wide-leg trousers     (fit-wide-trousers)  : the Champagne Hour Trousers picture
-- The newer item keeps its picture and stays on sale; the older one is retired (players who own it keep it, and the
-- Studio can put it back on sale) and loses the borrowed picture, so it shows its emoji again. Each step is logged in
-- shop_audit ('dedupe'). Safe to run more than once.

do $$
declare
  r public.shop_catalog;
begin
  for r in select * from public.shop_catalog where sku in ('lux-gold-chain', 'lux-designer-watch', 'fit-wide-trousers') loop
    update public.shop_catalog
       set status = case when status = 'live' then 'retired' else status end,
           images = null, image_status = 'none', image_error = null, source_image = null, updated_at = now()
     where sku = r.sku;
    if not exists (select 1 from public.shop_audit a where a.sku = r.sku and a.action = 'dedupe') then
      insert into public.shop_audit (sku, action, before, after, note)
      values (r.sku, 'dedupe', jsonb_build_object('status', r.status, 'sourceImage', r.source_image),
              jsonb_build_object('status', case when r.status = 'live' then 'retired' else r.status end, 'sourceImage', null),
              'Retired: it showed another item''s picture (migration 0108).');
    end if;
  end loop;
end;
$$;
