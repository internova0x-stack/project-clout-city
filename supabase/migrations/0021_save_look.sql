-- v0.7 step 4, Your Look as a dressing room (docs/testing-feedback.md #24): players try things on
-- freely in the client, then "Save look" stores the whole outfit at once: which owned clothes are
-- worn (one per slot) and the headwear, which is free (docs/02 section 9).
--
-- Only the covering field of players.look changes. Rows from before v0.7 get their build filled
-- in at the same time, so normalizeLook stops treating them as legacy (it would otherwise put
-- Bodega Drip's old cap back on a player who just took it off).

create function public.save_look(p_items bigint[], p_covering text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_items bigint[] := coalesce(p_items, '{}');
begin
  if not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '42501'; end if;
  if p_covering not in ('none', 'cap', 'fedora', 'bucket', 'durag', 'hijab', 'turban', 'headwrap', 'kippah') then
    raise exception 'bad_covering' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_items) i
              where not exists (select 1 from public.player_items pi where pi.id = i and pi.player_id = uid and pi.category = 'fashion')) then
    raise exception 'not_wearable' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct public.shop_item(pi.sku) ->> 'slot')
        from public.player_items pi where pi.player_id = uid and pi.id = any(v_items)) then
    raise exception 'one_per_slot' using errcode = '22023';
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

revoke all on function public.save_look(bigint[], text) from public, anon;
grant execute on function public.save_look(bigint[], text) to authenticated;
