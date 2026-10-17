-- Boroughs open the moment (owner, Oct 17: "the unlock milestone should be the moment the target is hit, not after
-- 3 consecutive days"). Replaces 0069's day counting: Brooklyn (100), The Bronx (250), Staten Island (500) and
-- Manhattan last (1,000) open in order, each the moment its target is out at once, once the borough before it has opened.
-- Players out = games that checked in within the last 2 minutes (session_ping, every minute while open).
-- Studio admins can still open any borough by hand (admin_open_borough).
-- Targets live in borough_gates: change one with an update, no code change needed.
-- Safe to run more than once.

alter table public.borough_gates add column if not exists position int;
update public.borough_gates set position = 1 where id = 'brooklyn' and position is null;
insert into public.borough_gates (id, target, days_needed, position) values
  ('bronx', 250, 1, 2), ('staten_island', 500, 1, 3), ('manhattan', 1000, 1, 4)
on conflict (id) do nothing;
-- One moment is enough now (0066 asked for 3 days).
update public.borough_gates set days_needed = 1 where days_needed <> 1;
drop function if exists public.borough_counts_from(text);
drop function if exists public.borough_days_hit(text);

/** Whether a borough is next in line: every borough before it has opened. */
create or replace function public.borough_in_line(p_borough text) returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.borough_gates g, public.borough_gates p
                      where g.id = p_borough and p.position < g.position and p.opened_at is null)
$$;

/** Records today's peak and opens the borough next in line the moment its target is out at once. */
create or replace function public.borough_tick() returns void
language plpgsql security definer set search_path = public
as $$
declare n int := public.players_online();
begin
  insert into public.concurrency_days (ny_date, peak) values (public.ny_today(), n)
  on conflict (ny_date) do update set peak = greatest(public.concurrency_days.peak, excluded.peak);
  update public.borough_gates g set opened_at = now(), opened_by = 'players'
   where g.id = (select id from public.borough_gates where opened_at is null order by position limit 1)
     and n >= g.target;
end;
$$;

/** What the app shows for each gated borough, in unlock order. counting: it's next in line. */
create or replace function public.borough_state() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'open', g.opened_at is not null, 'target', g.target,
           'counting', g.opened_at is null and public.borough_in_line(g.id),
           'online', public.players_online(),
           'peakToday', coalesce((select peak from public.concurrency_days where ny_date = public.ny_today()), 0))
         order by g.position), '[]'::jsonb)
    from public.borough_gates g
   where auth.uid() is not null
$$;

revoke all on function public.borough_in_line(text) from public, anon, authenticated;
revoke all on function public.borough_tick() from public, anon, authenticated;
revoke all on function public.borough_state() from public, anon;
grant execute on function public.borough_state() to authenticated;
