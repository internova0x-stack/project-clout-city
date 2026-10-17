-- The Clout TV Tower (owner, Oct 17: "the tower should be renamed Clout TV Tower"). The place keeps its id
-- ('clout-tower'), so visits stay; only the text a featured player gets names it. Safe to run more than once.

create or replace function public.tv_put_up(p_id bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.tv_submissions;
begin
    update public.tv_submissions set status = 'featured', featured_at = public.tv_now() where id = p_id returning * into s;
  insert into public.station_messages (player_id, station, body, ref)
  values (s.player_id, 'tv', '📺 You made it to the Big Screen! Your photo is up on the Clout TV Tower in Astoria for the next 3 hours. Now the whole city knows your name.', 'tv:' || s.id)
  on conflict do nothing;
end;
$$;
revoke all on function public.tv_put_up(bigint) from public, anon, authenticated;
