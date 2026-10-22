-- Diss & Tell's paid side stories (owner, Oct 22): three, at the same price as Sarah Bird's ($2.99 each), free for VIPs
-- (has_entitlement's vip_member, migration 0052). The story files are content/stories/diss-and-tell-*.json; the Studio
-- adds them and approving Diss & Tell approves them with it. Safe to run again.

insert into public.store_products (sku, product_type, name, price_cents, parent_arc_id) values
  ('side_diss_and_tell_toni_spreadsheet', 'side_arc', 'Toni''s Spreadsheet',       299, 'diss-and-tell'),
  ('side_diss_and_tell_timeshare',        'side_arc', 'The Lawyers'' Timeshare',   299, 'diss-and-tell'),
  ('side_diss_and_tell_cosign',           'side_arc', 'Lil Cosign Tells All',      299, 'diss-and-tell')
on conflict (sku) do nothing;
