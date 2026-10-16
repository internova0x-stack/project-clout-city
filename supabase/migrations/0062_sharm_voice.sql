-- Voices (owner, Oct 16): DJ Sharm Almight talks like New York, "yo son, you buggin'", with the slang a younger
-- audience uses. This is the text Real Clout FM sends when a shoutout airs or makes the wall: 0058's
-- station_sync with only those two lines changed. Texts already sent keep their words.
-- Safe to run more than once.

create or replace function public.station_sync() returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur public.tv_submissions;
  nxt bigint;
begin
  perform pg_advisory_xact_lock(hashtext('station_sync'));
  cur := public.tv_current();
  if cur.id is null then
    select id into nxt from public.tv_submissions where status = 'approved' order by approved_at, id limit 1;
    if nxt is not null then perform public.tv_put_up(nxt); end if;
  end if;
  insert into public.station_messages (player_id, station, body, ref)
  select s.player_id, 'fm',
         case s.status
           when 'on_air' then '🎙️ Yo, you''re ON AIR! Sharm Almight just read your shoutout on The Wake-Up Call, no cap: "' || s.message || '" The whole borough heard it, son.'
           else '📌 Ayo, your shoutout made today''s wall on Real Clout FM. That''s a W, fam. Peep it in the Radio app.'
         end,
         'fm:' || s.id
    from public.radio_shoutouts s
   where s.status in ('on_air', 'wall') and s.ny_date >= public.ny_today() - 1
     and exists (select 1 from public.radio_shoutouts a where a.ny_date = s.ny_date and a.status = 'on_air'
                   and coalesce(a.aired_at, public.radio_air_time(a.ny_date)) <= public.game_now())
  on conflict do nothing;
end;
$$;
