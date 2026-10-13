-- v0.7 step 6, bug fixes from the Oct 13 testing round (docs/testing-feedback.md).

-- #20: events are uncapped, so no copy may promise a small crowd.
update public.exclusive_events
   set blurb = 'The pop star plays her new album for a guest list that keeps growing and one very nervous publicist. Phones in a velvet bag at the door.'
 where id = 'jada-sol-listening';

-- #29: the Bank's history says where and what, not just "Shop" or "Daily task". Ledger refs point at
-- rows the player owns (their items, tasks and gig offers) or to the week's hunt; this joins them
-- in. Every join is limited to the caller's own rows. Sold items are gone, so a sale stays
-- "Sold an item".
create function public.ledger_feed(p_limit int default 50)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'amount', l.amount, 'kind', l.kind, 'ref', l.ref, 'at', l.created_at,
      'sku', (select pi.sku from public.player_items pi where l.kind = 'purchase' and pi.player_id = auth.uid() and pi.id::text = l.ref),
      'task', (select jsonb_build_object('place', t.place_id, 'action', t.action_id) from public.daily_tasks t
                where l.kind = 'daily_task' and t.player_id = auth.uid() and t.id::text = l.ref),
      'gig', (select g.title from public.gig_offers g where l.kind = 'gig' and g.player_id = auth.uid() and g.id::text = l.ref),
      'theme', (select h.data ->> 'theme' from public.hunts h where l.kind = 'hunt' and h.id = l.ref)
    ) order by l.created_at desc, l.id desc), '[]'::jsonb)
  from (select * from public.ledger
         where player_id = auth.uid() and currency = 'cash'
         order by created_at desc, id desc
         limit least(greatest(coalesce(p_limit, 50), 1), 100)) l;
$$;

revoke all on function public.ledger_feed(int) from public, anon;
grant execute on function public.ledger_feed(int) to authenticated;
