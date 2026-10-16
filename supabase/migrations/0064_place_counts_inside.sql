-- Players inside each place's room (owner, Oct 16: "the number of players isn't showing on the places list";
-- "I meant the number of players inside the room"). place_counts() already counted players inside a room
-- in the last few minutes (seen_at, set by place_presence while indoors), but never you: on your own you
-- always saw nothing. Now you count too when you're inside; the names stay other players only (crew first).
-- Never NPCs. Safe to run more than once.

create or replace function public.place_counts() returns jsonb
language sql stable security definer set search_path = public
as $$
  with fresh as (select now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int) as t),
  here as (
    select p.id, p.at_place, p.display_name, p.starting_style, p.id in (select id from public.crew_of(auth.uid())) as crew, p.seen_at
      from public.players p, fresh
     where p.at_place is not null and p.seen_at > fresh.t and p.banned_at is null
       and (p.arrives_at is null or p.arrives_at <= now())
       and not exists (select 1 from public.blocks b where (b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid()))
  )
  select coalesce(jsonb_object_agg(at_place, jsonb_build_object('count', n, 'names', names)), '{}'::jsonb)
    from (select at_place, count(*) as n,
                 coalesce((select jsonb_agg(jsonb_build_object('name', x.display_name, 'style', x.starting_style))
                             from (select * from here h2 where h2.at_place = h.at_place and h2.id <> auth.uid()
                                    order by h2.crew desc, h2.seen_at desc limit 3) x), '[]'::jsonb) as names
            from here h group by at_place) g
$$;
revoke all on function public.place_counts() from public, anon;
grant execute on function public.place_counts() to authenticated;
