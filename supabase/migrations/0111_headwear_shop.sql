-- Headwear moves to the Shop (owner, Oct 22: "remove all hats except the cap; the rest should have a Higgsfield image
-- and be in the Shop"). The cap is the only free hat now; the durag, turban, headwrap and kippah are Shop pieces
-- (content/shop/headwear.json, pictures shipped in public/shop-img/), drawn as the coverings they used to be.
--   * The four go live in the catalog, as if loaded and approved in Studio → Shop.
--   * Whoever wore one as a free covering gets that piece (acquired 'earned', free), worn, in place of the covering;
--     any other hat they had on comes off (one per slot). Nobody loses their headwear.
-- The hijab, the fedora and the bucket hat were taken off the free list in the game; a saved one reads as no hat.
-- Safe to run more than once.

insert into public.shop_catalog (sku, position, status, go_live_at, tab, slot, presentation, name, description, emoji, price, clout,
                                 tier, stars, style_lines, template, wearable, source_image, origin, file, reviewed_at)
select x.sku, (select coalesce(max(position), 0) from public.shop_catalog) + x.n, 'live', now(), 'accessories', 'head', 'all',
       x.name, x.description, x.emoji, x.price, x.clout, 'budget', 1, x.lines, 'rigid:hat', true, x.src, 'import', 'headwear.json', now()
  from (values
    (1, 'satin-durag', 'Satin Durag', 'Black satin with long ties. Waves protected.', '🧢', 35, 6, array['streetwear'],
     'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261022_145316_32213a25-2948-45c7-bc3a-bd2380f6c855.png'),
    (2, 'wrapped-turban', 'Wrapped Turban', 'A neatly wrapped turban in deep navy.', '🧢', 70, 8, array[]::text[],
     'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261022_145317_357c95b4-7fe6-4608-897b-2c6d4ac1bc6b.png'),
    (3, 'terracotta-headwrap', 'Terracotta Headwrap', 'Terracotta cotton, tied with a knot on top.', '🧢', 55, 7, array[]::text[],
     'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261022_145317_21ca16a2-e0ad-4f7b-8a8a-2e98b00e6b1f.png'),
    (4, 'knit-kippah', 'Knit Kippah', 'A simple navy knit kippah.', '🧢', 30, 5, array[]::text[],
     'https://d8j0ntlcm91z4.cloudfront.net/user_3Kt1pu7c4Uz3DGQBKKhT7AptIgl/hf_20261022_145316_77f53038-adde-4919-a7c4-0aabf7b971cf.png')
  ) as x(n, sku, name, description, emoji, price, clout, lines, src)
on conflict (sku) do nothing;

do $$
declare
  r record;
  v_sku text;
begin
  for r in select p.id, p.look ->> 'covering' as covering from public.players p
            where p.look ->> 'covering' in ('durag', 'turban', 'headwrap', 'kippah') loop
    v_sku := case r.covering when 'durag' then 'satin-durag' when 'turban' then 'wrapped-turban'
                             when 'headwrap' then 'terracotta-headwrap' else 'knit-kippah' end;
    -- Any other hat comes off; the covering they chose is now the piece they own.
    update public.player_items pi set equipped = false
     where pi.player_id = r.id and pi.equipped and pi.category = 'fashion' and pi.sku <> v_sku
       and public.shop_item(pi.sku) ->> 'slot' = 'head';
    if exists (select 1 from public.player_items where player_id = r.id and sku = v_sku) then
      update public.player_items set equipped = true where player_id = r.id and sku = v_sku;
    else
      insert into public.player_items (player_id, sku, category, value, acquired, equipped)
      values (r.id, v_sku, 'fashion', 0, 'earned', true);
    end if;
    update public.players set look = look || '{"covering": "none"}'::jsonb where id = r.id;
  end loop;
end;
$$;
