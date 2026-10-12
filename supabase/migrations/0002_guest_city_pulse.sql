-- Clout City: the city's public pulse for the guest screen.
-- Real numbers only (no made-up activity): how many residents have moved in,
-- and the latest arrivals for the live ticker. Names are public in-game handles.

create function public.city_pulse()
returns table (residents bigint, newest_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select count(*), max(created_at) from public.players;
$$;

create function public.recent_arrivals(p_limit int default 8)
returns table (display_name text, starting_style text, arrived_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select display_name, starting_style, created_at
  from public.players
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.city_pulse() from public;
revoke all on function public.recent_arrivals(int) from public;
grant execute on function public.city_pulse() to anon, authenticated;
grant execute on function public.recent_arrivals(int) to anon, authenticated;
