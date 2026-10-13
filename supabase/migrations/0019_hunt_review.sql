-- v0.6, finishing the Studio's hunt review (docs/08-new-features-spec.md section 2).
--
-- 1. "Send back with a note": a hunt sent back to review can carry a note for the writer.
-- 2. Replacing a week's hunt: a new hunt (different id) for a week that already has one replaces
--    it, as long as nobody has joined the old one. Once players have joined, a hunt can't be
--    replaced or edited (their steps would point at the wrong places); pause it instead.

alter table public.hunts add column review_note text;

create or replace function public.admin_hunt_list() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'week', h.week, 'status', h.status, 'data', h.data, 'note', h.review_note,
      'joined', (select count(*) from public.hunt_progress p where p.hunt_id = h.id),
      'completed', (select count(*) from public.hunt_progress p where p.hunt_id = h.id and p.completed_at is not null),
      'atStep', (select coalesce(jsonb_agg(n order by i), '[]'::jsonb) from (
                   select i, (select count(*) from public.hunt_progress p where p.hunt_id = h.id and p.completed_at is null and p.step = i) n
                     from generate_series(0, jsonb_array_length(h.data -> 'places') - 1) i) x)
    ) order by h.week desc) from public.hunts h), '[]'::jsonb);
end;
$$;

create or replace function public.admin_hunt_upsert(p_data jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id text := p_data ->> 'id';
  v_week date := (p_data ->> 'week')::date;
  old public.hunts;
begin
  perform public.require_story_admin();
  if jsonb_typeof(p_data -> 'tracks') is distinct from 'object' then raise exception 'bad_hunt' using errcode = '22023'; end if;
  -- Edits to a hunt players have joined would break their progress.
  select * into old from public.hunts where id = v_id;
  if old.id is not null and (old.data is distinct from p_data or old.week is distinct from v_week)
     and exists (select 1 from public.hunt_progress where hunt_id = v_id) then
    raise exception 'hunt_in_play' using errcode = '22023';
  end if;
  -- Another hunt already holds the week: replace it if nobody has joined it.
  for old in select * from public.hunts where week = v_week and id <> v_id loop
    if exists (select 1 from public.hunt_progress where hunt_id = old.id) then
      raise exception 'week_in_play' using errcode = '22023';
    end if;
    delete from public.hunts where id = old.id;
  end loop;
  insert into public.hunts (id, week, data) values (v_id, v_week, p_data)
  on conflict (id) do update
    set week = excluded.week, data = excluded.data, updated_at = now(),
        review_note = case when hunts.data = excluded.data and hunts.week = excluded.week then hunts.review_note end,
        status = case when hunts.status = 'approved' and hunts.data = excluded.data and hunts.week = excluded.week
                      then 'approved' else 'review' end;
end;
$$;

/** Approve, pause (hides it at once; progress is kept) or send back to review, optionally with a note. */
drop function public.admin_hunt_status(text, text);
create function public.admin_hunt_status(p_id text, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('review', 'approved', 'paused') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.hunts
     set status = p_status, updated_at = now(),
         review_note = case when p_status = 'review' then nullif(btrim(p_note), '') when p_status = 'approved' then null else review_note end
   where id = p_id;
  if not found then raise exception 'unknown_hunt' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.admin_hunt_status(text, text, text) from public, anon;
grant execute on function public.admin_hunt_status(text, text, text) to authenticated;
