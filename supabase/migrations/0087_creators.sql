-- Creators, step 1 (spec section 21, owner Oct 18): attribution and links. Commissions, payouts and the creator
-- page come in later steps; nothing here touches real money.
--
--   * creators: who we work with. Rate (20% default, 30% for high performers, 0 to 50), length (12 or 24 months,
--     or null for life), the welcome gift (C$ and an optional free Shop fashion item), active or paused.
--   * creator_links: /c/<slug> links, made by admins only. Retired links still land the visitor but stop
--     counting and attributing; links are never deleted so their history stays.
--   * creator_clicks: one count per link per New York day (no per-person tracking).
--   * creator_referrals: one row per player, fixed at sign-up (first creator wins). commission_until is the
--     sign-up plus the creator's length at that moment (null for life).
--   * creator_link(slug, click): the /c/<slug> route (service role): counts the click, says where it lands.
--   * creator_attach(slug, code): the new player's own call right after create_player: attaches the creator
--     and pays the welcome gift once (ledger 'creator_welcome'). Not for the creator's own account.
--   * admin_creators(days), admin_creator_save(data), admin_creator_link_save(data),
--     admin_creator_link_status(id, status): the Studio's Affiliates section (admins only). Rate and length
--     changes are logged in admin_actions.

do $$
begin
  if to_regprocedure('public.membership_state()') is null then
    raise exception 'Run migration 0079 first.';
  end if;
end $$;

create table public.creators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  handle      text check (char_length(handle) <= 60),
  email       text check (char_length(email) <= 200),
  code        text not null unique check (code ~ '^[A-Z0-9]{3,16}$'),
  rate        numeric(4, 1) not null default 20 check (rate between 0 and 50),
  months      int check (months in (12, 24)),
  gift_cash   int not null default 500 check (gift_cash between 0 and 2000),
  gift_item   text,
  status      text not null default 'active' check (status in ('active', 'paused')),
  connect_account text check (connect_account like 'acct\_%'),
  terms_at    date,
  note        text check (char_length(note) <= 500),
  created_by  uuid,
  created_at  timestamptz not null default now()
);
alter table public.creators enable row level security;

create table public.creator_links (
  id          bigint generated always as identity primary key,
  creator_id  uuid not null references public.creators (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$' and slug !~ '--'),
  label       text not null default 'Main link' check (char_length(btrim(label)) between 1 and 60),
  lands       text not null default 'home' check (lands in ('home', 'signup', 'news', 'shop', 'vip')),
  campaign    text check (char_length(campaign) <= 60),
  video_url   text check (char_length(video_url) <= 300),
  status      text not null default 'active' check (status in ('active', 'retired')),
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index creator_links_creator_idx on public.creator_links (creator_id);
alter table public.creator_links enable row level security;

create table public.creator_clicks (
  link_id bigint not null references public.creator_links (id) on delete cascade,
  day     date not null,
  clicks  int not null default 0,
  primary key (link_id, day)
);
alter table public.creator_clicks enable row level security;

create table public.creator_referrals (
  player_id        uuid primary key references public.players (id) on delete cascade,
  creator_id       uuid not null references public.creators (id),
  link_id          bigint references public.creator_links (id),
  how              text not null check (how in ('link', 'code')),
  attributed_at    timestamptz not null default now(),
  commission_until timestamptz
);
create index creator_referrals_creator_idx on public.creator_referrals (creator_id, attributed_at);
alter table public.creator_referrals enable row level security;

-- Studio actions on creators sit next to bans and unbans (rate and length changes, attribution changes).
alter table public.admin_actions alter column player_id drop not null;
alter table public.admin_actions add column creator_id uuid references public.creators (id) on delete cascade;
alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in ('ban', 'unban', 'creator_rate', 'creator_length', 'creator_status', 'creator_attribution'));

-- ---------------------------------------------------------------------------
-- The link and sign-up
-- ---------------------------------------------------------------------------

/** The /c/<slug> route: where it lands and, for an active link of an active creator, a counted click. */
create function public.creator_link(p_slug text, p_click boolean default true)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l public.creator_links;
  c public.creators;
  live boolean;
begin
  select * into l from public.creator_links where slug = lower(btrim(coalesce(p_slug, '')));
  if l.id is null then return null; end if;
  select * into c from public.creators where id = l.creator_id;
  live := l.status = 'active' and c.status = 'active';
  if live and coalesce(p_click, true) then
    insert into public.creator_clicks (link_id, day, clicks) values (l.id, public.ny_today(), 1)
    on conflict (link_id, day) do update set clicks = creator_clicks.clicks + 1;
  end if;
  return jsonb_build_object('slug', l.slug, 'lands', l.lands, 'live', live, 'name', c.name,
                            'giftCash', c.gift_cash, 'giftItem', c.gift_item);
end;
$$;
revoke all on function public.creator_link(text, boolean) from public, anon, authenticated;
grant execute on function public.creator_link(text, boolean) to service_role;

/**
 * Attaches the signed-in new player to a creator (a link's slug, or a typed code; the link wins) and pays the
 * welcome gift once. Quietly does nothing for an old account (more than a day), a player already attributed, a
 * paused creator or retired link, or the creator's own account. Returns what was given, or null.
 */
create function public.creator_attach(p_slug text, p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.players;
  l public.creator_links;
  c public.creators;
  v_how text := 'link';
  v_item jsonb;
  v_gave_item text;
begin
  select * into p from public.players where id = uid;
  if p.id is null or p.created_at < now() - interval '1 day' then return null; end if;
  if exists (select 1 from public.creator_referrals where player_id = uid) then return null; end if;

  if nullif(btrim(coalesce(p_slug, '')), '') is not null then
    select * into l from public.creator_links where slug = lower(btrim(p_slug)) and status = 'active';
    if l.id is not null then select * into c from public.creators where id = l.creator_id; end if;
  end if;
  if c.id is null and nullif(btrim(coalesce(p_code, '')), '') is not null then
    select * into c from public.creators where code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
    l := null;
    v_how := 'code';
  end if;
  if c.id is null or c.status <> 'active' then return null; end if;
  -- No self-referral: the creator's own account (same email) never counts.
  if c.email is not null and exists (select 1 from auth.users u where u.id = uid and lower(u.email) = lower(btrim(c.email))) then
    return null;
  end if;

  insert into public.creator_referrals (player_id, creator_id, link_id, how, commission_until)
  values (uid, c.id, l.id, v_how, case when c.months is null then null else now() + make_interval(months => c.months) end)
  on conflict (player_id) do nothing;
  if not found then return null; end if;

  if c.gift_cash > 0 and public.ledger_once(uid, 'cash', c.gift_cash, 'creator_welcome', c.id::text) then
    update public.players set bank_cash = bank_cash + c.gift_cash where id = uid;
  end if;
  v_item := case when c.gift_item is null then null else public.shop_item(c.gift_item) end;
  if v_item is not null and v_item ->> 'category' = 'fashion' and not coalesce((v_item ->> 'collector')::boolean, false) then
    insert into public.player_items (player_id, sku, category, value, acquired) values (uid, c.gift_item, 'fashion', 0, 'earned')
    on conflict (player_id, sku) do nothing;
    if found then v_gave_item := c.gift_item; end if;
  end if;
  return jsonb_build_object('creator', c.name, 'cash', c.gift_cash, 'item', v_gave_item);
end;
$$;
revoke all on function public.creator_attach(text, text) from public, anon;
grant execute on function public.creator_attach(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The Studio (admins only)
-- ---------------------------------------------------------------------------

/** Every creator with their links and numbers for the last p_days days (0 = all time). */
create function public.admin_creators(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  since date := case when coalesce(p_days, 0) > 0 then public.ny_today() - (p_days - 1) else '-infinity'::date end;
  since_ts timestamptz := case when coalesce(p_days, 0) > 0 then (since::timestamp at time zone 'America/New_York') else '-infinity'::timestamptz end;
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'days', coalesce(p_days, 0),
    'creators', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'handle', c.handle, 'email', c.email, 'code', c.code, 'rate', c.rate,
               'months', c.months, 'giftCash', c.gift_cash, 'giftItem', c.gift_item, 'status', c.status,
               'termsAt', c.terms_at, 'note', c.note, 'createdAt', c.created_at,
               'clicks', coalesce((select sum(k.clicks) from public.creator_clicks k join public.creator_links l on l.id = k.link_id
                                    where l.creator_id = c.id and k.day >= since), 0),
               'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and r.attributed_at >= since_ts),
               'byCode', (select count(*) from public.creator_referrals r where r.creator_id = c.id and r.attributed_at >= since_ts and r.how = 'code'),
               'signupsAll', (select count(*) from public.creator_referrals r where r.creator_id = c.id),
               'links', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', l.id, 'slug', l.slug, 'label', l.label, 'lands', l.lands, 'campaign', l.campaign,
                          'videoUrl', l.video_url, 'status', l.status, 'createdAt', l.created_at,
                          'clicks', coalesce((select sum(k.clicks) from public.creator_clicks k where k.link_id = l.id and k.day >= since), 0),
                          'signups', (select count(*) from public.creator_referrals r where r.link_id = l.id and r.attributed_at >= since_ts))
                          order by l.status, l.created_at)
                   from public.creator_links l where l.creator_id = c.id), '[]'::jsonb))
             order by c.status, c.created_at)
        from public.creators c), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_creators(int) from public, anon;
grant execute on function public.admin_creators(int) to authenticated;

/** Adds a creator (with their first link, slug = the code in lower case) or updates one. Returns the id. */
create function public.admin_creator_save(p_data jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid := nullif(p_data ->> 'id', '')::uuid;
  old public.creators;
  v_code text := upper(regexp_replace(coalesce(p_data ->> 'code', ''), '[^A-Za-z0-9]', '', 'g'));
  v_rate numeric := coalesce((p_data ->> 'rate')::numeric, 20);
  v_months int := nullif(p_data ->> 'months', '')::int;
  v_item text := nullif(p_data ->> 'giftItem', '');
  v_status text := coalesce(nullif(p_data ->> 'status', ''), 'active');
  v_item_row jsonb;
begin
  perform public.require_story_admin();
  if char_length(btrim(coalesce(p_data ->> 'name', ''))) = 0 then raise exception 'name_required' using errcode = '22023'; end if;
  if v_code !~ '^[A-Z0-9]{3,16}$' then raise exception 'bad_code' using errcode = '22023'; end if;
  if v_rate < 0 or v_rate > 50 then raise exception 'bad_rate' using errcode = '22023'; end if;
  if v_months is not null and v_months not in (12, 24) then raise exception 'bad_length' using errcode = '22023'; end if;
  if v_item is not null then
    v_item_row := public.shop_item(v_item);
    if v_item_row is null or v_item_row ->> 'category' <> 'fashion' or coalesce((v_item_row ->> 'collector')::boolean, false) then
      raise exception 'bad_gift_item' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from public.creators where code = v_code and id is distinct from v_id) then
    raise exception 'code_taken' using errcode = '23505';
  end if;

  if v_id is null then
    if exists (select 1 from public.creator_links where slug = lower(v_code)) then raise exception 'slug_taken' using errcode = '23505'; end if;
    insert into public.creators (name, handle, email, code, rate, months, gift_cash, gift_item, status, terms_at, note, created_by)
    values (btrim(p_data ->> 'name'), nullif(btrim(p_data ->> 'handle'), ''), nullif(btrim(p_data ->> 'email'), ''), v_code, v_rate,
            v_months, coalesce((p_data ->> 'giftCash')::int, 500), v_item, v_status, nullif(p_data ->> 'termsAt', '')::date,
            nullif(btrim(p_data ->> 'note'), ''), me)
    returning id into v_id;
    insert into public.creator_links (creator_id, slug, label, created_by) values (v_id, lower(v_code), 'Main link', me);
    return v_id;
  end if;

  select * into old from public.creators where id = v_id for update;
  if old.id is null then raise exception 'no_creator' using errcode = 'P0002'; end if;
  update public.creators
     set name = btrim(p_data ->> 'name'), handle = nullif(btrim(p_data ->> 'handle'), ''), email = nullif(btrim(p_data ->> 'email'), ''),
         code = v_code, rate = v_rate, months = v_months, gift_cash = coalesce((p_data ->> 'giftCash')::int, gift_cash),
         gift_item = v_item, status = v_status, terms_at = nullif(p_data ->> 'termsAt', '')::date, note = nullif(btrim(p_data ->> 'note'), '')
   where id = v_id;
  if old.rate is distinct from v_rate then
    insert into public.admin_actions (admin_id, creator_id, action, reason) values (me, v_id, 'creator_rate', old.rate || '% → ' || v_rate || '%');
  end if;
  if old.months is distinct from v_months then
    insert into public.admin_actions (admin_id, creator_id, action, reason)
    values (me, v_id, 'creator_length', coalesce(old.months || ' months', 'for life') || ' → ' || coalesce(v_months || ' months', 'for life'));
  end if;
  if old.status is distinct from v_status then
    insert into public.admin_actions (admin_id, creator_id, action, reason) values (me, v_id, 'creator_status', old.status || ' → ' || v_status);
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_creator_save(jsonb) from public, anon;
grant execute on function public.admin_creator_save(jsonb) to authenticated;

/** Adds a link for a creator, or edits one's label, landing, campaign and video (the slug never changes). */
create function public.admin_creator_link_save(p_data jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint := nullif(p_data ->> 'id', '')::bigint;
  v_slug text := lower(btrim(coalesce(p_data ->> 'slug', '')));
  v_lands text := coalesce(nullif(p_data ->> 'lands', ''), 'home');
  v_label text := coalesce(nullif(btrim(p_data ->> 'label'), ''), 'Link');
begin
  perform public.require_story_admin();
  if v_lands not in ('home', 'signup', 'news', 'shop', 'vip') then raise exception 'bad_lands' using errcode = '22023'; end if;
  if v_id is not null then
    update public.creator_links
       set label = v_label, lands = v_lands, campaign = nullif(btrim(p_data ->> 'campaign'), ''),
           video_url = nullif(btrim(p_data ->> 'videoUrl'), '')
     where id = v_id;
    if not found then raise exception 'no_link' using errcode = 'P0002'; end if;
    return v_id;
  end if;
  if not exists (select 1 from public.creators where id = nullif(p_data ->> 'creatorId', '')::uuid) then
    raise exception 'no_creator' using errcode = 'P0002';
  end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$' or v_slug ~ '--' then raise exception 'bad_slug' using errcode = '22023'; end if;
  if exists (select 1 from public.creator_links where slug = v_slug) then raise exception 'slug_taken' using errcode = '23505'; end if;
  insert into public.creator_links (creator_id, slug, label, lands, campaign, video_url, created_by)
  values ((p_data ->> 'creatorId')::uuid, v_slug, v_label, v_lands, nullif(btrim(p_data ->> 'campaign'), ''),
          nullif(btrim(p_data ->> 'videoUrl'), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_creator_link_save(jsonb) from public, anon;
grant execute on function public.admin_creator_link_save(jsonb) to authenticated;

/** Retires a link (it still lands, but stops counting and attributing) or brings it back. */
create function public.admin_creator_link_status(p_link bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('active', 'retired') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.creator_links set status = p_status where id = p_link;
  if not found then raise exception 'no_link' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_creator_link_status(bigint, text) from public, anon;
grant execute on function public.admin_creator_link_status(bigint, text) to authenticated;
