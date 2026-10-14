-- Test phase (owner, Oct 14): news and treasure hunts go live without approval, like gossip
-- (0034). The game server checks every week file in content/news and content/hunts with the
-- Studio's rules (lib/news.ts, lib/hunts.ts) and stores it with these functions, which only the
-- service role can call. A stored item is approved at once; the Studio still lists everything and
-- can pause an item or a hunt (paused stays paused when the file is stored again) or send it back.

/** Stores a checked news week as approved items. Paused items stay paused. Returns how many. */
create function public.content_import_news(p_items jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb;
  n int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_news' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.news_items (id, kind, headline, body, cast_ids, publish_on, status)
    values (it ->> 'id', it ->> 'kind', btrim(it ->> 'headline'), btrim(it ->> 'body'),
            coalesce((select array_agg(c) from jsonb_array_elements_text(coalesce(it -> 'cast', '[]'::jsonb)) c), '{}'),
            (it ->> 'day')::date, 'approved')
    on conflict (id) do update
      set kind = excluded.kind, headline = excluded.headline, body = excluded.body,
          cast_ids = excluded.cast_ids, publish_on = excluded.publish_on,
          updated_at = case when (news_items.kind, news_items.headline, news_items.body, news_items.cast_ids, news_items.publish_on)
                                 = (excluded.kind, excluded.headline, excluded.body, excluded.cast_ids, excluded.publish_on)
                            then news_items.updated_at else now() end,
          status = case when news_items.status = 'paused' then 'paused' else 'approved' end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

/**
 * Stores a checked hunt as approved: 'stored', 'same', or (players have started it, or another hunt
 * that week) 'in_play' and nothing changes. Paused hunts stay paused.
 */
create function public.content_import_hunt(p_data jsonb) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id text := p_data ->> 'id';
  v_week date := (p_data ->> 'week')::date;
  old public.hunts;
begin
  if jsonb_typeof(p_data -> 'tracks') is distinct from 'object' then raise exception 'bad_hunt' using errcode = '22023'; end if;
  select * into old from public.hunts where id = v_id;
  if old.id is not null and old.data = p_data and old.week = v_week then
    if old.status = 'review' then update public.hunts set status = 'approved', review_note = null, updated_at = now() where id = v_id; end if;
    return 'same';
  end if;
  if old.id is not null and exists (select 1 from public.hunt_progress where hunt_id = v_id) then return 'in_play'; end if;
  -- Another hunt holds the week: replace it if nobody has joined it.
  for old in select * from public.hunts where week = v_week and id <> v_id loop
    if exists (select 1 from public.hunt_progress where hunt_id = old.id) then return 'in_play'; end if;
    delete from public.hunts where id = old.id;
  end loop;
  insert into public.hunts (id, week, data, status) values (v_id, v_week, p_data, 'approved')
  on conflict (id) do update
    set week = excluded.week, data = excluded.data, updated_at = now(), review_note = null,
        status = case when hunts.status = 'paused' then 'paused' else 'approved' end;
  return 'stored';
end;
$$;

revoke all on function public.content_import_news(jsonb) from public, anon, authenticated;
revoke all on function public.content_import_hunt(jsonb) from public, anon, authenticated;
grant execute on function public.content_import_news(jsonb) to service_role;
grant execute on function public.content_import_hunt(jsonb) to service_role;
