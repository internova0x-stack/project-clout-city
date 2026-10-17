-- Clout TV (owner, Oct 17: "uploaded around 7am and it is off the billboard by 9:30"): a photo stays on the
-- Big Screen for a full 3 hours from the moment it goes up. Before, slots were fixed clock blocks (6 to 9,
-- 9 to 12, ...), so a photo that went up at 7 came down at 9. The next approved photo goes up when the
-- current one's 3 hours end (station_sync, unchanged); nextAt is that moment.
-- Safe to run more than once.

/** The photo on the screen now: the latest to go up in the last 3 hours (none: "Make it BIG in NY"). */
create or replace function public.tv_current() returns public.tv_submissions
language sql volatile security definer set search_path = public
as $$
  select * from public.tv_submissions
   where status = 'featured' and featured_at <= public.tv_now()
     and featured_at > public.tv_now() - make_interval(hours => (public.game_settings_value('tv') ->> 'slotHours')::int)
   order by featured_at desc limit 1
$$;

/** When the current slot started: when the photo on screen went up (now, when nothing is up). */
create or replace function public.tv_slot_start() returns timestamptz
language sql volatile security definer set search_path = public
as $$ select coalesce((public.tv_current()).featured_at, public.tv_now()) $$;

revoke all on function public.tv_current() from public, anon, authenticated;
revoke all on function public.tv_slot_start() from public, anon, authenticated;
