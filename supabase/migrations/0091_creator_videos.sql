-- Creators, step 5 (spec section 21, owner Oct 18): the UGC engine's tracking. Each creator video we pay for is
-- logged with its link, the fee we paid and the post date, so spend sits next to results: clicks, sign-ups, paying
-- players, revenue and commission through that video's link, and each creator's cost per paying player.
--
--   * creator_videos: one row per video (creator, optional link, title, platform, URL, posted date, fee, note).
--     Removed videos stay for the record.
--   * admin_creator_videos(): every video with its results, and each creator's totals (admins only).
--   * admin_creator_video_save(data), admin_creator_video_status(id, status).

do $$
begin
  if to_regclass('public.creator_payouts') is null then
    raise exception 'Run migration 0090 first.';
  end if;
end $$;

create table public.creator_videos (
  id         bigint generated always as identity primary key,
  creator_id uuid not null references public.creators (id) on delete cascade,
  link_id    bigint references public.creator_links (id),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  platform   text not null default 'tiktok' check (platform in ('tiktok', 'instagram', 'youtube', 'other')),
  url        text check (char_length(url) <= 300),
  posted_on  date,
  fee_cents  int not null default 0 check (fee_cents between 0 and 10000000),
  note       text check (char_length(note) <= 300),
  status     text not null default 'live' check (status in ('live', 'removed')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index creator_videos_creator_idx on public.creator_videos (creator_id, posted_on desc);
alter table public.creator_videos enable row level security;

/** Every logged video with what its link brought in, and each creator's spend against their results. */
create function public.admin_creator_videos()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'creatorId', v.creator_id, 'creator', c.name, 'linkId', v.link_id, 'slug', l.slug,
               'title', v.title, 'platform', v.platform, 'url', v.url, 'postedOn', v.posted_on, 'feeCents', v.fee_cents,
               'note', v.note, 'status', v.status,
               'clicks', case when v.link_id is null then null else
                           coalesce((select sum(k.clicks) from public.creator_clicks k where k.link_id = v.link_id), 0) end,
               'signups', case when v.link_id is null then null else
                            (select count(*) from public.creator_referrals r where r.link_id = v.link_id) end,
               'payers', case when v.link_id is null then null else
                           (select count(distinct p.player_id) from public.creator_payments() p where p.link_id = v.link_id and not p.refunded) end,
               'revenueCents', case when v.link_id is null then null else
                                 (select coalesce(sum(p.cents), 0) from public.creator_payments() p where p.link_id = v.link_id and not p.refunded) end,
               'commissionCents', case when v.link_id is null then null else
                                    (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m
                                       join public.creator_referrals r on r.player_id = m.player_id where r.link_id = v.link_id) end)
             order by v.posted_on desc nulls last, v.id desc)
        from public.creator_videos v join public.creators c on c.id = v.creator_id
        left join public.creator_links l on l.id = v.link_id), '[]'::jsonb),
    'creators', coalesce((
      select jsonb_agg(jsonb_build_object(
               'creatorId', c.id, 'name', c.name,
               'videos', (select count(*) from public.creator_videos v where v.creator_id = c.id and v.status = 'live'),
               'spendCents', (select coalesce(sum(v.fee_cents), 0) from public.creator_videos v where v.creator_id = c.id),
               'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id),
               'payers', (select count(distinct p.player_id) from public.creator_payments() p where p.creator_id = c.id and not p.refunded),
               'revenueCents', (select coalesce(sum(p.cents), 0) from public.creator_payments() p where p.creator_id = c.id and not p.refunded),
               'netCents', (select coalesce(sum(m.net_cents), 0) from public.creator_commissions m where m.creator_id = c.id),
               'commissionCents', (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m where m.creator_id = c.id))
             order by c.created_at)
        from public.creators c), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_creator_videos() from public, anon;
grant execute on function public.admin_creator_videos() to authenticated;

/** Logs a video or edits one. The link, if given, must be the same creator's. */
create function public.admin_creator_video_save(p_data jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint := nullif(p_data ->> 'id', '')::bigint;
  v_creator uuid := nullif(p_data ->> 'creatorId', '')::uuid;
  v_link bigint := nullif(p_data ->> 'linkId', '')::bigint;
  v_platform text := coalesce(nullif(p_data ->> 'platform', ''), 'tiktok');
  v_fee int := coalesce((p_data ->> 'feeCents')::int, 0);
begin
  perform public.require_story_admin();
  if not exists (select 1 from public.creators where id = v_creator) then raise exception 'no_creator' using errcode = 'P0002'; end if;
  if v_link is not null and not exists (select 1 from public.creator_links where id = v_link and creator_id = v_creator) then
    raise exception 'link_not_theirs' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_data ->> 'title', ''))) = 0 then raise exception 'title_required' using errcode = '22023'; end if;
  if v_platform not in ('tiktok', 'instagram', 'youtube', 'other') then raise exception 'bad_platform' using errcode = '22023'; end if;
  if v_fee < 0 then raise exception 'bad_fee' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.creator_videos (creator_id, link_id, title, platform, url, posted_on, fee_cents, note, created_by)
    values (v_creator, v_link, btrim(p_data ->> 'title'), v_platform, nullif(btrim(p_data ->> 'url'), ''),
            nullif(p_data ->> 'postedOn', '')::date, v_fee, nullif(btrim(p_data ->> 'note'), ''), auth.uid())
    returning id into v_id;
  else
    update public.creator_videos
       set creator_id = v_creator, link_id = v_link, title = btrim(p_data ->> 'title'), platform = v_platform,
           url = nullif(btrim(p_data ->> 'url'), ''), posted_on = nullif(p_data ->> 'postedOn', '')::date, fee_cents = v_fee,
           note = nullif(btrim(p_data ->> 'note'), '')
     where id = v_id;
    if not found then raise exception 'no_video' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_creator_video_save(jsonb) from public, anon;
grant execute on function public.admin_creator_video_save(jsonb) to authenticated;

/** Marks a video removed (taken down) or live again; its spend still counts. */
create function public.admin_creator_video_status(p_video bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('live', 'removed') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.creator_videos set status = p_status where id = p_video;
  if not found then raise exception 'no_video' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_creator_video_status(bigint, text) from public, anon;
grant execute on function public.admin_creator_video_status(bigint, text) to authenticated;
