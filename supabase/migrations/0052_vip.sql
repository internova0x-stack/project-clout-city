-- VIP (owner, Oct 15: "Call it VIP, chat only"; mockup /preview/vip). Unlimited chat's monthly and yearly
-- plans become VIP: unlimited chat, every side story free while the membership lasts, and a VIP badge on
-- the player card. The forever plan stays unlimited chat only (side stories not included).
--   * has_entitlement(player, side-story sku) is also true for an active VIP, so every gate that already
--     asks it (the story feed, the catalog, start_purchase) unlocks side stories for members. When a VIP
--     subscription ends (payment_subscription revokes it), they lock again; a story bought for $2.99 stays.
--   * vip_member(player) and vip_since(player): the membership check and when it started.
--   * chat_status() says whether you're a VIP; player_card() shows the badge.

do $$
begin
  if to_regprocedure('public.together_claim(bigint)') is null then
    raise exception 'Run migration 0050_better_together.sql (and 0051) first: 0052 builds on them.';
  end if;
end $$;

update public.store_products set name = 'VIP (monthly)' where sku = 'chat-unlimited-monthly';
update public.store_products set name = 'VIP (yearly)' where sku = 'chat-unlimited-yearly';
update public.store_products set name = 'Unlimited chat (forever)' where sku = 'chat-unlimited-forever';

/** An active VIP membership (monthly or yearly). Reads entitlements directly, so has_entitlement can call it. */
create function public.vip_member(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.entitlements
                  where player_id = p_player and sku in ('chat-unlimited-monthly', 'chat-unlimited-yearly') and status = 'active')
$$;

/** When the current VIP membership started (null when not a member). */
create function public.vip_since(p_player uuid) returns timestamptz
language sql stable security definer set search_path = public
as $$
  select min(created_at) from public.entitlements
   where player_id = p_player and sku in ('chat-unlimited-monthly', 'chat-unlimited-yearly') and status = 'active'
$$;

/** 0007's single gate, plus: VIP members have every side story. */
create or replace function public.has_entitlement(p_player uuid, p_sku text) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.entitlements where player_id = p_player and sku = p_sku and status = 'active')
      or (exists (select 1 from public.store_products where sku = p_sku and product_type = 'side_arc')
          and public.vip_member(p_player))
$$;

/** 0047's chat_status, plus whether you're a VIP. */
create or replace function public.chat_status()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'limit', (public.game_settings_value('chat') ->> 'dailyLimit')::int,
    'left', greatest(0, (public.game_settings_value('chat') ->> 'dailyLimit')::int
                        - (select count(*) from public.messages m where m.sender = auth.uid() and m.ny_date = public.ny_today() and m.kind = 'text')),
    'unlimited', public.chat_unlimited(auth.uid()),
    'vip', public.vip_member(auth.uid()),
    'messagesFrom', (select messages_from from public.players where id = auth.uid()),
    'mutedUntil', (select chat_muted_until from public.players where id = auth.uid() and chat_muted_until > now()),
    'warned', (select chat_warned_at is not null from public.players where id = auth.uid()),
    'banned', (select banned_at is not null from public.players where id = auth.uid()));
$$;

/** 0050's player_card, plus the VIP badge and since when. */
create or replace function public.player_card(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'style', p.starting_style, 'clout', p.clout, 'homeId', p.home_id,
    'badges', (select count(*) from public.player_badges b where b.player_id = p.id),
    'joined', p.created_at,
    'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = p.id),
    'isMe', p.id = auth.uid(),
    'crush', case when p.id <> auth.uid() then public.crush_status(p.id) end,
    'rank', 1 + (select count(*) from public.players o
                  where o.banned_at is null
                    and (o.clout > p.clout or (o.clout = p.clout and o.created_at < p.created_at))),
    'recent', public.player_recent(p.id, 5),
    'netWorth', public.net_worth(p.id),
    'bestRank', p.best_rank,
    'jobs', public.job_rating(p.id),
    'vipSince', public.vip_since(p.id),
    'herePlace', (select p.at_place from public.players me where me.id = auth.uid() and me.at_place is not null and me.at_place = p.at_place
                    and p.seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)),
    'canMessage', p.id <> auth.uid() and public.may_reach(auth.uid(), p.id),
    'crew', p.id in (select id from public.crew_of(auth.uid())))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

-- Who pays is private: the badge on player_card is the only public view.
revoke all on function public.vip_member(uuid) from public, anon, authenticated;
revoke all on function public.vip_since(uuid) from public, anon, authenticated;
