-- v0.6 "Astoria and the News", step 2: lines for the regulars at places
-- (docs/08-new-features-spec.md section 4; the cast is in lib/cast.ts and docs/CAST.md).
--
-- Regulars' evergreen lines ship with the app (content/cast-lines.json). This table holds the
-- lines written with each week's content: personal updates and cast news. They're added and
-- approved in the Story Studio and can be paused there with no deploy. Players only ever see
-- approved lines, through npc_lines_live(); a line with a week shows only that week (Monday to
-- Sunday, New York time).

create table public.npc_lines (
  id          bigint generated always as identity primary key,
  npc_id      text not null check (npc_id ~ '^[a-z0-9-]{2,40}$'),
  line        text not null check (char_length(btrim(line)) between 3 and 240),
  kind        text not null default 'line' check (kind in ('line', 'update')),
  week_of     date check (week_of is null or extract(isodow from week_of) = 1),
  status      text not null default 'review' check (status in ('review', 'approved', 'paused')),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index npc_lines_live_idx on public.npc_lines (npc_id) where status = 'approved';

-- No policies: nobody reads or writes the table directly.
alter table public.npc_lines enable row level security;
revoke all on public.npc_lines from anon, authenticated;

/** Approved lines live today, by regular: { "sal": ["…"], … }. Updates come first. */
create function public.npc_lines_live() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(npc_id, lines), '{}'::jsonb)
    from (select npc_id, jsonb_agg(line order by (kind = 'update') desc, id) as lines
            from public.npc_lines
           where status = 'approved'
             and (week_of is null or public.ny_today() between week_of and week_of + 6)
           group by npc_id) t
$$;

/** Studio: every line, newest first. */
create function public.admin_npc_lines() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'npc', npc_id, 'line', line, 'kind', kind, 'weekOf', week_of, 'status', status, 'at', created_at
    ) order by id desc) from public.npc_lines), '[]'::jsonb);
end;
$$;

/** Studio: adds a line for review. */
create function public.admin_npc_line_add(p_npc text, p_line text, p_kind text default 'line', p_week date default null)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare new_id bigint;
begin
  perform public.require_story_admin();
  insert into public.npc_lines (npc_id, line, kind, week_of)
  values (lower(btrim(p_npc)), btrim(p_line), coalesce(p_kind, 'line'), p_week)
  returning id into new_id;
  return new_id;
end;
$$;

/** Studio: approve, pause, or send a line back to review. */
create function public.admin_npc_line_status(p_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('review', 'approved', 'paused') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.npc_lines set status = p_status, updated_at = now() where id = p_id;
  if not found then raise exception 'unknown_line' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.npc_lines_live() from public;
grant execute on function public.npc_lines_live() to anon, authenticated;
revoke all on function public.admin_npc_lines() from public, anon;
revoke all on function public.admin_npc_line_add(text, text, text, date) from public, anon;
revoke all on function public.admin_npc_line_status(bigint, text) from public, anon;
grant execute on function public.admin_npc_lines() to authenticated;
grant execute on function public.admin_npc_line_add(text, text, text, date) to authenticated;
grant execute on function public.admin_npc_line_status(bigint, text) to authenticated;
