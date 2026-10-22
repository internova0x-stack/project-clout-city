-- Your Look keeps the starter clothes (owner, Oct 22: "It should also have the default clothes players start the game
-- with"). Every player can switch, for free, between their starting style's tops, bottoms and colors, as in the
-- creator: save_look(items, covering, fit) saves the pick in players.look.fit with the rest of the look.
--   * p_fit is the creator's shape {top, topColor, bottom, bottomColor, shoeColor} (all short strings), or null for the
--     style's own outfit. Which pieces and colors a style offers is checked by the game (lib/styles.ts isValidFit),
--     which also ignores a stored fit that isn't on its style's lists, as it always has.
--   * The two-argument save_look (migration 0101) is unchanged; this one runs it, then stores the fit.
-- Safe to run more than once.

create or replace function public.save_look(p_items bigint[], p_covering text, p_fit jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  k text;
begin
  if p_fit is not null and jsonb_typeof(p_fit) <> 'null' then
    if jsonb_typeof(p_fit) <> 'object'
       or (select array_agg(x order by x) from jsonb_object_keys(p_fit) x) <> array['bottom', 'bottomColor', 'shoeColor', 'top', 'topColor'] then
      raise exception 'bad_fit' using errcode = '22023';
    end if;
    foreach k in array array['top', 'topColor', 'bottom', 'bottomColor', 'shoeColor'] loop
      if jsonb_typeof(p_fit -> k) <> 'string' or length(p_fit ->> k) not between 1 and 20 then
        raise exception 'bad_fit' using errcode = '22023';
      end if;
    end loop;
  end if;
  perform public.save_look(p_items, p_covering);
  update public.players
     set look = case when p_fit is null or jsonb_typeof(p_fit) = 'null' then look - 'fit' else look || jsonb_build_object('fit', p_fit) end
   where id = auth.uid();
end;
$$;

revoke all on function public.save_look(bigint[], text, jsonb) from public, anon;
grant execute on function public.save_look(bigint[], text, jsonb) to authenticated;
