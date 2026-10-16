-- Studio Players (owner, Oct 15): "see the individual users who signed up ... their profile and activities",
-- and ban or unban them. Admins only (require_story_admin). Private message texts never appear here: a
-- profile shows how many messages someone sent; texts stay in the Reports tab, for reported chats only.
--
--   * admin_players(query, filter, sort, limit, offset): the searchable list.
--   * admin_player(id): one player's profile, numbers, sessions, safety record and activity timeline
--     (every cash and clout change from the ledger, plus purchases, reports and admin actions).
--   * admin_player_ban(id, ban, reason): bans (the account sees the suspended screen, as since 0010) or
--     unbans, with a reason, logged in admin_actions. Admins can't be banned here.

do $$
begin
  if to_regprocedure('public.admin_insights(integer)') is null then
    raise exception 'Run migration 0053 first.';
  end if;
end $$;

alter table public.players add column ban_reason text check (char_length(ban_reason) <= 300);

create table public.admin_actions (
  id         bigint generated always as identity primary key,
  admin_id   uuid not null,
  player_id  uuid not null references public.players (id) on delete cascade,
  action     text not null check (action in ('ban', 'unban')),
  reason     text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
create index admin_actions_player_idx on public.admin_actions (player_id, created_at desc);
alter table public.admin_actions enable row level security;

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------
create function public.admin_players(p_query text default '', p_filter text default 'all', p_sort text default 'joined',
                                     p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  lim int := greatest(1, least(200, coalesce(p_limit, 50)));
  off int := greatest(0, coalesce(p_offset, 0));
  today date := public.ny_today();
  result jsonb;
begin
  perform public.require_story_admin();
  with base as (
    select p.id, p.display_name as name, u.email, p.starting_style as style, p.created_at as joined,
           greatest(p.seen_at, (select max(s.last_seen) from public.player_sessions s where s.player_id = p.id)) as last_seen,
           p.clout, p.bank_cash as cash, public.net_worth(p.id) as worth, p.home_id is not null as moved_in,
           p.banned_at is not null as banned,
           coalesce((select sum(pu.amount_cents) from public.purchases pu where pu.player_id = p.id and pu.status = 'paid'), 0)
             + coalesce((select sum(sp.amount_cents) from public.subscription_payments sp where sp.player_id = p.id), 0) as spend,
           public.vip_member(p.id) as vip,
           (select count(*) from public.reports r where r.reported = p.id and r.status = 'open') as open_reports,
           (select max(s.ny_date) from public.player_sessions s where s.player_id = p.id) as last_day
      from public.players p
      left join auth.users u on u.id = p.id
     where q = '' or lower(p.display_name) like '%' || q || '%' or lower(coalesce(u.email, '')) like '%' || q || '%'
  ), picked as (
    select * from base b
     where case coalesce(p_filter, 'all')
             when 'new' then b.joined > now() - interval '7 days'
             when 'active' then b.last_day = today or (b.last_seen at time zone 'America/New_York')::date = today
             when 'paying' then b.spend > 0
             when 'vip' then b.vip
             when 'banned' then b.banned
             when 'reported' then b.open_reports > 0
             when 'no_home' then not b.moved_in
             else true end
  )
  select jsonb_build_object(
    'total', (select count(*) from picked),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'name', x.name, 'email', x.email, 'style', x.style, 'joinedAt', x.joined, 'lastSeen', x.last_seen,
               'clout', x.clout, 'cash', x.cash, 'netWorth', x.worth, 'rank', public.rank_level(x.clout, x.worth),
               'spendCents', x.spend, 'vip', x.vip, 'banned', x.banned, 'openReports', x.open_reports, 'movedIn', x.moved_in))
        from (select * from picked
               order by case p_sort when 'clout' then picked.clout when 'worth' then picked.worth when 'spend' then picked.spend else null end desc nulls last,
                        case when p_sort = 'seen' then picked.last_seen end desc nulls last,
                        picked.joined desc
               limit lim offset off) x), '[]'::jsonb)) into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- One player
-- ---------------------------------------------------------------------------
create function public.admin_player(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  p public.players;
  email text;
  worth bigint;
  inviter uuid;
begin
  perform public.require_story_admin();
  select * into p from public.players where id = p_player;
  if p.id is null then raise exception 'unknown_player' using errcode = '22023'; end if;
  select u.email into email from auth.users u where u.id = p.id;
  worth := public.net_worth(p.id);
  select i.inviter_id into inviter from public.invites i where i.invitee_id = p.id;
  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'name', p.display_name, 'email', email, 'style', p.starting_style, 'look', p.look, 'traits', p.traits,
      'homeId', p.home_id, 'houseSku', p.house_sku, 'carSku', p.car_sku, 'carMode', p.car_mode, 'atPlace', p.at_place,
      'birthCash', p.birth_cash, 'joinedAt', p.created_at, 'movedInAt', p.moved_in_at, 'firstPartyAt', p.first_party_at,
      'lastSeen', greatest(p.seen_at, (select max(s.last_seen) from public.player_sessions s where s.player_id = p.id)),
      'inviteCode', p.invite_code,
      'invitedBy', (select jsonb_build_object('id', ip.id, 'name', ip.display_name) from public.players ip where ip.id = inviter),
      'invitedCount', (select count(*) from public.invites i where i.inviter_id = p.id),
      'crewSize', (select count(*) from public.crew_of(p.id)),
      'rank', public.rank_level(p.clout, worth), 'vip', public.vip_member(p.id), 'vipSince', public.vip_since(p.id),
      'chatForever', public.has_entitlement(p.id, 'chat-unlimited-forever'),
      'banned', p.banned_at is not null, 'bannedAt', p.banned_at, 'banReason', p.ban_reason,
      'mutedUntil', p.chat_muted_until, 'warnedAt', p.chat_warned_at,
      'admin', exists (select 1 from public.story_admins a where a.user_id = p.id)),
    'numbers', jsonb_build_object(
      'clout', p.clout, 'cash', p.bank_cash, 'netWorth', worth, 'energy', p.energy, 'mood', p.mood, 'confidence', p.confidence,
      'spendCents', coalesce((select sum(pu.amount_cents) from public.purchases pu where pu.player_id = p.id and pu.status = 'paid'), 0)
                    + coalesce((select sum(sp.amount_cents) from public.subscription_payments sp where sp.player_id = p.id), 0),
      'purchases', (select count(*) from public.purchases pu where pu.player_id = p.id and pu.status in ('paid', 'refunded')),
      'sessions', (select count(*) from public.player_sessions s where s.player_id = p.id),
      'secondsPlayed', coalesce((select sum(extract(epoch from s.last_seen - s.started_at))::bigint from public.player_sessions s where s.player_id = p.id), 0),
      'daysActive', (select count(*) from (select s.ny_date from public.player_sessions s where s.player_id = p.id
                                            union select a.ny_date from public.analytics_events a where a.player_id = p.id and a.name = 'session') d),
      'messagesSent', (select count(*) from public.messages m where m.sender = p.id),
      'businesses', (select count(*) from public.player_businesses b where b.player_id = p.id),
      'placesVisited', (select count(distinct v.place_id) from public.place_visits v where v.player_id = p.id)),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('startedAt', s.started_at, 'seconds', extract(epoch from s.last_seen - s.started_at)::int)
                                           order by s.started_at desc)
                            from (select * from public.player_sessions s where s.player_id = p.id order by s.started_at desc limit 10) s), '[]'::jsonb),
    'safety', jsonb_build_object(
      'reportsAgainst', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason, 'status', r.status, 'at', r.created_at,
                                                                     'by', (select display_name from public.players rp where rp.id = r.reporter))
                                                   order by r.created_at desc)
                                    from public.reports r where r.reported = p.id), '[]'::jsonb),
      'reportsMade', (select count(*) from public.reports r where r.reporter = p.id),
      'blocked', (select count(*) from public.blocks b where b.blocker = p.id),
      'blockedBy', (select count(*) from public.blocks b where b.blocked = p.id),
      'actions', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'reason', a.reason, 'at', a.created_at,
                                                              'by', (select display_name from public.players ap where ap.id = a.admin_id))
                                            order by a.created_at desc)
                             from public.admin_actions a where a.player_id = p.id), '[]'::jsonb)),
    'timeline', coalesce((select jsonb_agg(t order by t ->> 'at' desc) from (
      select x.t from (
        -- Every cash and clout change, one line per thing that happened (a kind and its ref).
        select jsonb_build_object('type', 'ledger', 'kind', l.kind, 'ref', l.ref, 'at', min(l.created_at),
                                  'cash', coalesce(sum(l.amount) filter (where l.currency = 'cash'), 0),
                                  'clout', coalesce(sum(l.amount) filter (where l.currency = 'clout'), 0)) as t,
               min(l.created_at) as at
          from public.ledger l where l.player_id = p.id
         group by l.kind, l.ref
        union all
        select jsonb_build_object('type', 'purchase', 'ref', pu.sku, 'name', sp.name, 'status', pu.status, 'cents', pu.amount_cents, 'at', pu.created_at), pu.created_at
          from public.purchases pu left join public.store_products sp on sp.sku = pu.sku
         where pu.player_id = p.id and pu.status in ('paid', 'refunded')
        union all
        select jsonb_build_object('type', 'renewal', 'cents', s.amount_cents, 'at', s.created_at), s.created_at
          from public.subscription_payments s where s.player_id = p.id
        union all
        select jsonb_build_object('type', 'joined', 'at', p.created_at), p.created_at
        union all
        select jsonb_build_object('type', 'moved_in', 'ref', p.home_id, 'at', p.moved_in_at), p.moved_in_at where p.moved_in_at is not null
        union all
        select jsonb_build_object('type', 'reported', 'ref', r.reason, 'status', r.status, 'at', r.created_at), r.created_at
          from public.reports r where r.reported = p.id
        union all
        select jsonb_build_object('type', a.action, 'ref', a.reason, 'at', a.created_at), a.created_at
          from public.admin_actions a where a.player_id = p.id
      ) x order by x.at desc limit 150) y), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Ban and unban
-- ---------------------------------------------------------------------------
create function public.admin_player_ban(p_player uuid, p_ban boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  perform public.require_story_admin();
  if not exists (select 1 from public.players where id = p_player) then raise exception 'unknown_player' using errcode = '22023'; end if;
  if p_ban and exists (select 1 from public.story_admins a where a.user_id = p_player) then
    raise exception 'is_admin' using errcode = '22023';
  end if;
  update public.players
     set banned_at = case when p_ban then coalesce(banned_at, now()) else null end,
         ban_reason = case when p_ban then reason else null end
   where id = p_player;
  insert into public.admin_actions (admin_id, player_id, action, reason)
  values (auth.uid(), p_player, case when p_ban then 'ban' else 'unban' end, reason);
  return jsonb_build_object('banned', p_ban);
end;
$$;
