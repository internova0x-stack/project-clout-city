-- Clout City v0.3: walkable 3D homes. Players can rearrange their furniture; the
-- layout is a small list of { id, x, z, rot } entries (lib/rooms.ts LayoutEntry),
-- validated here and re-checked against the room when it's drawn.

alter table public.players add column home_layout jsonb;

create function public.save_home_layout(p_layout jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  e jsonb;
begin
  if auth.uid() is null then raise exception 'no_player' using errcode = '28000'; end if;
  if jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 40 then
    raise exception 'bad_layout' using errcode = '22023';
  end if;
  for e in select value from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 'id') <> 'string' or length(e ->> 'id') > 40
       or jsonb_typeof(e -> 'x') <> 'number' or abs((e ->> 'x')::numeric) > 10
       or jsonb_typeof(e -> 'z') <> 'number' or abs((e ->> 'z')::numeric) > 10
       or jsonb_typeof(e -> 'rot') <> 'number' or (e ->> 'rot')::numeric not in (0, 1, 2, 3) then
      raise exception 'bad_layout' using errcode = '22023';
    end if;
  end loop;
  update public.players set home_layout = p_layout where id = auth.uid();
end;
$$;

revoke all on function public.save_home_layout(jsonb) from public, anon;
grant execute on function public.save_home_layout(jsonb) to authenticated;
