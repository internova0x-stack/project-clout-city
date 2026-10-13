-- v0.6 "Astoria and the News", step 3: City News (docs/08-new-features-spec.md section 3).
--
-- Light gossip about the invented cast, Lola's weekly dating column and the Monday hunt
-- announcement. A week is written as one file (content/news/<Monday>.json), checked by the app
-- (lib/news.ts) and uploaded in the Story Studio; items wait for approval, then publish on their
-- day (New York time). News never changes prices or places. Players read news_feed() only.

create table public.news_items (
  id          text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  kind        text not null check (kind in ('city', 'column', 'hunt')),
  headline    text not null check (char_length(btrim(headline)) between 8 and 110),
  body        text not null check (char_length(btrim(body)) between 20 and 600),
  cast_ids    text[] not null default '{}',
  publish_on  date not null,
  status      text not null default 'review' check (status in ('review', 'approved', 'paused')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index news_items_live_idx on public.news_items (publish_on desc) where status = 'approved';

alter table public.news_items enable row level security;
revoke all on public.news_items from anon, authenticated;

/** Approved items published by today, newest first (the last 60 days). */
create function public.news_feed() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'headline', headline, 'body', body, 'cast', to_jsonb(cast_ids), 'day', publish_on
    ) order by publish_on desc, id), '[]'::jsonb)
    from public.news_items
   where status = 'approved'
     and publish_on <= public.ny_today()
     and publish_on > public.ny_today() - 60
$$;

/** Studio: every item, newest day first. */
create function public.admin_news_list() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'headline', headline, 'body', body, 'cast', to_jsonb(cast_ids),
      'day', publish_on, 'status', status
    ) order by publish_on desc, id) from public.news_items), '[]'::jsonb);
end;
$$;

/**
 * Studio: adds or replaces a week's items (already validated by the app). A changed item goes
 * back to review; an approved item whose text and day are unchanged stays approved.
 */
create function public.admin_news_upsert(p_items jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb;
  n int := 0;
begin
  perform public.require_story_admin();
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_news' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.news_items (id, kind, headline, body, cast_ids, publish_on)
    values (it ->> 'id', it ->> 'kind', btrim(it ->> 'headline'), btrim(it ->> 'body'),
            coalesce((select array_agg(c) from jsonb_array_elements_text(coalesce(it -> 'cast', '[]'::jsonb)) c), '{}'),
            (it ->> 'day')::date)
    on conflict (id) do update
      set kind = excluded.kind, headline = excluded.headline, body = excluded.body,
          cast_ids = excluded.cast_ids, publish_on = excluded.publish_on, updated_at = now(),
          status = case when news_items.status = 'approved'
                         and (news_items.kind, news_items.headline, news_items.body, news_items.cast_ids, news_items.publish_on)
                           = (excluded.kind, excluded.headline, excluded.body, excluded.cast_ids, excluded.publish_on)
                        then 'approved' else 'review' end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

/** Studio: approve, pause, or send an item back to review. */
create function public.admin_news_status(p_id text, p_status text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('review', 'approved', 'paused') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.news_items set status = p_status, updated_at = now() where id = p_id;
  if not found then raise exception 'unknown_news' using errcode = '22023'; end if;
end;
$$;

/** Studio: move an item to another day. Moving keeps its status. */
create function public.admin_news_reschedule(p_id text, p_day date) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  update public.news_items set publish_on = p_day, updated_at = now() where id = p_id;
  if not found then raise exception 'unknown_news' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.news_feed() from public;
grant execute on function public.news_feed() to anon, authenticated;
revoke all on function public.admin_news_list() from public, anon;
revoke all on function public.admin_news_upsert(jsonb) from public, anon;
revoke all on function public.admin_news_status(text, text) from public, anon;
revoke all on function public.admin_news_reschedule(text, date) from public, anon;
grant execute on function public.admin_news_list() to authenticated;
grant execute on function public.admin_news_upsert(jsonb) to authenticated;
grant execute on function public.admin_news_status(text, text) to authenticated;
grant execute on function public.admin_news_reschedule(text, date) to authenticated;
