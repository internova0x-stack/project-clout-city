-- Meeting players (owner, Oct 15): "Players who are at the same location at the same time are supposed
-- to be able to see each other and chat with each other." "Players should be able to meet other real
-- players in all locations." "Users get some reactions, and auto-suggested message to break ice, but
-- they can also send [20] messages a day. Once they reach their limit they should be prompted to get
-- unlimited chat." Monthly or forever; "if the membership ends, the message limits come back."
--   * Presence: place_presence(place, floor) marks you here and lists the other real players at the
--     same place (seen in the last few minutes, arrived, not blocked either way), crew first.
--     place_counts() is how many are at each place, for the map and place cards.
--   * Reactions: react_to(player, emoji), free, one per person every few minutes, only between
--     players at the same place (or crewmates). They land in the chat thread (messages.kind
--     'reaction') and never count toward the daily limit.
--   * Chat: 20 messages a day (game_settings chat.dailyLimit); every text message counts, replies
--     included. players.messages_from ('anyone' or 'crew') says who may message or react to you.
--   * Unlimited chat: store products of the new type 'chat_pass', monthly (store_products.recurring
--     'month', a Stripe subscription) or forever. chat_unlimited() is the one check; the subscription's
--     entitlement is revoked when Stripe ends it (payment_subscription), so the limit comes back.

update public.game_settings
   set value = value || '{"dailyLimit": 20, "reactions": ["👋", "🔥", "😂", "💅", "🥂"], "reactMinutes": 3, "hereMinutes": 3, "hereMax": 40}'::jsonb
 where key = 'chat';

alter table public.players
  add column if not exists messages_from text not null default 'anyone' check (messages_from in ('anyone', 'crew')),
  add column if not exists seen_at timestamptz,
  add column if not exists at_floor smallint not null default 1;
create index if not exists players_here_idx on public.players (at_place, seen_at) where at_place is not null;

alter table public.messages add column if not exists kind text not null default 'text' check (kind in ('text', 'reaction'));

-- ---------------------------------------------------------------------------
-- Unlimited chat: two products, one entitlement check
-- ---------------------------------------------------------------------------
alter table public.store_products drop constraint if exists store_products_product_type_check;
alter table public.store_products add constraint store_products_product_type_check
  check (product_type in ('side_arc', 'exclusive_event', 'collector_item', 'postcard', 'chat_pass'));
-- 'month': a Stripe subscription that renews until cancelled; null: a one-time payment.
alter table public.store_products add column if not exists recurring text check (recurring in ('month'));

insert into public.store_products (sku, product_type, name, price_cents, recurring) values
  ('chat-unlimited-monthly', 'chat_pass', 'Unlimited chat (monthly)', 499, 'month'),
  ('chat-unlimited-forever', 'chat_pass', 'Unlimited chat (forever)', 3999, null)
on conflict (sku) do nothing;

/** Unlimited chat: either pass, while it's active. The only check the chat functions use. */
create function public.chat_unlimited(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_entitlement(p_player, 'chat-unlimited-monthly') or public.has_entitlement(p_player, 'chat-unlimited-forever') $$;

/** 0009's start_purchase, plus: one chat pass is enough (no monthly plan on top of forever, or the other way round). */
create or replace function public.start_purchase(p_sku text, p_session text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.store_products;
begin
  select * into prod from public.store_products where sku = p_sku and active;
  if prod.sku is null then raise exception 'unknown_product' using errcode = '22023'; end if;
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if public.has_entitlement(uid, p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  -- One pass is enough: no monthly plan on top of forever, or the other way round.
  if prod.product_type = 'chat_pass' and public.chat_unlimited(uid) then raise exception 'already_owned' using errcode = '22023'; end if;
  if p_session !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'bad_session' using errcode = '22023'; end if;
  if prod.product_type = 'postcard' and not exists (select 1 from public.place_visits where player_id = uid and place_id = prod.place_id) then
    raise exception 'visit_first' using errcode = '22023';
  end if;
  if prod.product_type = 'exclusive_event' and exists (select 1 from public.exclusive_events where sku = p_sku and ends_at <= public.game_now()) then
    raise exception 'event_over' using errcode = '22023';
  end if;
  insert into public.purchases (stripe_session_id, player_id, sku) values (p_session, uid, p_sku)
  on conflict (stripe_session_id) do nothing;
end;
$$;

/**
 * customer.subscription.updated / .deleted: the monthly pass follows the subscription. Ended
 * (canceled, unpaid, incomplete_expired) revokes it, so the daily limit comes back; active again
 * restores it. past_due keeps access while Stripe retries the card. Idempotent per event id.
 */
create function public.payment_subscription(p_event text, p_subscription text, p_status text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  result text;
  n int;
begin
  if exists (select 1 from public.stripe_events where id = p_event) then return 'duplicate'; end if;
  if p_status in ('canceled', 'unpaid', 'incomplete_expired') then
    update public.entitlements set status = 'revoked', revoked_at = now()
     where stripe_payment_id = p_subscription and status = 'active';
    get diagnostics n = row_count;
    result := case when n > 0 then 'revoked' else 'nothing_to_revoke' end;
  elsif p_status in ('active', 'trialing') then
    update public.entitlements set status = 'active', revoked_at = null
     where stripe_payment_id = p_subscription and status = 'revoked';
    get diagnostics n = row_count;
    result := case when n > 0 then 'restored' else 'unchanged' end;
  else
    result := 'kept';
  end if;
  insert into public.stripe_events (id, type, result) values (p_event, 'customer.subscription', result);
  return result;
end;
$$;
revoke all on function public.payment_subscription(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chat: 20 a day, unlimited with a pass, and who may message you
-- ---------------------------------------------------------------------------
/** True when `p_from` may message or react to `p_to`: not blocked either way, and allowed by their setting. */
create function public.may_reach(p_from uuid, p_to uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.blocks where (blocker = p_from and blocked = p_to) or (blocker = p_to and blocked = p_from))
     and ((select messages_from from public.players where id = p_to) = 'anyone'
          or p_from in (select id from public.crew_of(p_to)))
$$;

create or replace function public.chat_status()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'limit', (public.game_settings_value('chat') ->> 'dailyLimit')::int,
    'left', greatest(0, (public.game_settings_value('chat') ->> 'dailyLimit')::int
                        - (select count(*) from public.messages m where m.sender = auth.uid() and m.ny_date = public.ny_today() and m.kind = 'text')),
    'unlimited', public.chat_unlimited(auth.uid()),
    'messagesFrom', (select messages_from from public.players where id = auth.uid()),
    'mutedUntil', (select chat_muted_until from public.players where id = auth.uid() and chat_muted_until > now()),
    'warned', (select chat_warned_at is not null from public.players where id = auth.uid()),
    'banned', (select banned_at is not null from public.players where id = auth.uid()));
$$;

-- 0010's chat_send: text messages count toward the daily limit unless the player has unlimited chat,
-- and the recipient's "who can message me" setting is respected.
create or replace function public.chat_send(p_to uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  them public.players;
  cfg jsonb := public.game_settings_value('chat');
  body text := btrim(coalesce(p_body, ''));
  conv public.conversations;
  sent int;
  msg public.messages;
  unlimited boolean := public.chat_unlimited(auth.uid());
begin
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'banned' using errcode = '42501'; end if;
  if me.chat_muted_until > now() then raise exception 'muted' using errcode = '42501'; end if;
  select * into them from public.players where id = p_to;
  if them.id is null or them.home_id is null or them.banned_at is not null or them.id = uid then raise exception 'unknown_player' using errcode = '22023'; end if;
  if exists (select 1 from public.blocks where (blocker = uid and blocked = p_to) or (blocker = p_to and blocked = uid)) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if not public.may_reach(uid, p_to) then raise exception 'crew_only' using errcode = '42501'; end if;
  if char_length(body) = 0 then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(body) > (cfg ->> 'maxLength')::int then raise exception 'too_long' using errcode = '22023'; end if;
  select count(*) into sent from public.messages where sender = uid and ny_date = public.ny_today() and kind = 'text';
  if not unlimited and sent >= (cfg ->> 'dailyLimit')::int then raise exception 'daily_limit' using errcode = '22023'; end if;

  insert into public.conversations (a, b, a_read_at, b_read_at)
  values (least(uid, p_to), greatest(uid, p_to), '-infinity', '-infinity')
  on conflict (a, b) do update set last_message_at = excluded.last_message_at
  returning * into conv;
  insert into public.messages (conversation_id, sender, body, ny_date, created_at)
  values (conv.id, uid, public.chat_filter(body), public.ny_today(), clock_timestamp())
  returning * into msg;
  update public.conversations
     set last_message_at = msg.created_at,
         a_read_at = case when a = uid then msg.created_at else a_read_at end,
         b_read_at = case when b = uid then msg.created_at else b_read_at end
   where id = conv.id;
  return jsonb_build_object('id', msg.id, 'body', msg.body, 'at', msg.created_at,
                            'left', case when unlimited then null else (cfg ->> 'dailyLimit')::int - sent - 1 end);
end;
$$;

-- 0010's chat_thread, plus each message's kind (a reaction shows as a big emoji).
create or replace function public.chat_thread(p_with uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.conversations;
  is_blocked boolean := exists (select 1 from public.blocks where blocker = uid and blocked = p_with);
begin
  select * into conv from public.conversations where a = least(uid, p_with) and b = greatest(uid, p_with);
  if conv.id is not null then
    update public.conversations
       set a_read_at = case when a = uid then clock_timestamp() else a_read_at end,
           b_read_at = case when b = uid then clock_timestamp() else b_read_at end
     where id = conv.id;
  end if;
  return jsonb_build_object(
    'with', p_with,
    'blocked', is_blocked,
    'blockedMe', exists (select 1 from public.blocks where blocker = p_with and blocked = uid),
    'messages', case when is_blocked or conv.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'mine', sender = uid, 'body', body, 'at', created_at, 'kind', kind) order by id), '[]')
        from (select * from public.messages where conversation_id = conv.id and not hidden order by id desc limit 100) m) end);
end;
$$;

/** "Who can message me": 'anyone' (the default) or 'crew'. */
create function public.set_messages_from(p_who text) returns text
language plpgsql security definer set search_path = public
as $$
begin
  if p_who not in ('anyone', 'crew') then raise exception 'bad_setting' using errcode = '22023'; end if;
  update public.players set messages_from = p_who where id = auth.uid();
  if not found then raise exception 'no_player' using errcode = '28000'; end if;
  return p_who;
end;
$$;

-- ---------------------------------------------------------------------------
-- Presence: who's here
-- ---------------------------------------------------------------------------
/**
 * Marks you here (place and floor) and returns the other real players at the same place: arrived,
 * seen in the last hereMinutes, not banned, not blocked either way; crew first, then the most recent.
 */
create function public.place_presence(p_place text, p_floor int default 1) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('chat');
  fresh timestamptz := now() - make_interval(mins => (cfg ->> 'hereMinutes')::int);
  me public.players;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place or me.arrives_at > clock_timestamp() then
    return jsonb_build_object('count', 0, 'people', '[]'::jsonb);
  end if;
  update public.players set seen_at = now(), at_floor = greatest(0, least(9, coalesce(p_floor, 1))) where id = uid;
  return (
    with here as (
      select p.*, p.id in (select id from public.crew_of(uid)) as crew
        from public.players p
       where p.at_place = p_place and p.id <> uid and p.seen_at > fresh and p.banned_at is null and p.home_id is not null
         and (p.arrives_at is null or p.arrives_at <= clock_timestamp())
         and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = p.id) or (b.blocker = p.id and b.blocked = uid))
    )
    select jsonb_build_object(
      'count', (select count(*) from here),
      'people', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.display_name, 'style', h.starting_style, 'look', h.look,
                                                              'crew', h.crew, 'floor', h.at_floor, 'clout', h.clout)
                                           order by h.crew desc, h.seen_at desc)
                          from (select * from here order by crew desc, seen_at desc limit (cfg ->> 'hereMax')::int) h), '[]'::jsonb)));
end;
$$;

/** For the map and place cards: how many players are at each place now, and the first three names (crew first). */
create function public.place_counts() returns jsonb
language sql stable security definer set search_path = public
as $$
  with fresh as (select now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int) as t),
  here as (
    select p.at_place, p.display_name, p.starting_style, p.id in (select id from public.crew_of(auth.uid())) as crew, p.seen_at
      from public.players p, fresh
     where p.at_place is not null and p.seen_at > fresh.t and p.id <> auth.uid() and p.banned_at is null
       and (p.arrives_at is null or p.arrives_at <= now())
       and not exists (select 1 from public.blocks b where (b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid()))
  )
  select coalesce(jsonb_object_agg(at_place, jsonb_build_object('count', n, 'names', names)), '{}'::jsonb)
    from (select at_place, count(*) as n,
                 (select jsonb_agg(jsonb_build_object('name', x.display_name, 'style', x.starting_style))
                    from (select * from here h2 where h2.at_place = h.at_place order by h2.crew desc, h2.seen_at desc limit 3) x) as names
            from here h group by at_place) g
$$;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
/** A free reaction to a player at the same place (or a crewmate): into the chat thread, never counted. */
create function public.react_to(p_to uuid, p_emoji text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('chat');
  me public.players;
  them public.players;
  conv public.conversations;
  msg public.messages;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'banned' using errcode = '42501'; end if;
  if not (cfg -> 'reactions') ? p_emoji then raise exception 'bad_reaction' using errcode = '22023'; end if;
  select * into them from public.players where id = p_to;
  if them.id is null or them.home_id is null or them.banned_at is not null or them.id = uid then raise exception 'unknown_player' using errcode = '22023'; end if;
  if not public.may_reach(uid, p_to) then raise exception 'crew_only' using errcode = '42501'; end if;
  if not (me.at_place is not null and me.at_place = them.at_place) and p_to not in (select id from public.crew_of(uid)) then
    raise exception 'not_together' using errcode = '22023';
  end if;
  insert into public.conversations (a, b, a_read_at, b_read_at)
  values (least(uid, p_to), greatest(uid, p_to), '-infinity', '-infinity')
  on conflict (a, b) do update set last_message_at = excluded.last_message_at
  returning * into conv;
  if exists (select 1 from public.messages m where m.conversation_id = conv.id and m.sender = uid and m.kind = 'reaction'
              and m.created_at > clock_timestamp() - make_interval(mins => (cfg ->> 'reactMinutes')::int)) then
    raise exception 'react_too_fast' using errcode = '22023';
  end if;
  insert into public.messages (conversation_id, sender, body, ny_date, created_at, kind)
  values (conv.id, uid, p_emoji, public.ny_today(), clock_timestamp(), 'reaction')
  returning * into msg;
  update public.conversations
     set last_message_at = msg.created_at,
         a_read_at = case when a = uid then msg.created_at else a_read_at end,
         b_read_at = case when b = uid then msg.created_at else b_read_at end
   where id = conv.id;
  return jsonb_build_object('id', msg.id, 'body', msg.body, 'at', msg.created_at, 'kind', 'reaction');
end;
$$;

-- 0024's player_card, plus what the meeting card needs: whether they're here with you, and whether
-- you can reach them (their "who can message me" setting and blocks).
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
    'netWorth', p.bank_cash + coalesce((select sum(i.value) from public.player_items i where i.player_id = p.id), 0),
    'herePlace', (select p.at_place from public.players me where me.id = auth.uid() and me.at_place is not null and me.at_place = p.at_place
                    and p.seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)),
    'canMessage', p.id <> auth.uid() and public.may_reach(auth.uid(), p.id),
    'crew', p.id in (select id from public.crew_of(auth.uid())))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

revoke all on function public.chat_unlimited(uuid) from public, anon;
grant execute on function public.chat_unlimited(uuid) to authenticated;
revoke all on function public.may_reach(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_messages_from(text) from public, anon;
grant execute on function public.set_messages_from(text) to authenticated;
revoke all on function public.place_presence(text, int) from public, anon;
grant execute on function public.place_presence(text, int) to authenticated;
revoke all on function public.place_counts() from public, anon;
grant execute on function public.place_counts() to authenticated;
revoke all on function public.react_to(uuid, text) from public, anon;
grant execute on function public.react_to(uuid, text) to authenticated;
