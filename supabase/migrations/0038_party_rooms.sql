-- v0.11 step 6 (docs/08-new-features-spec.md section 10; owner Oct 14): the exclusive events update.
--
-- Price: $3.99 for every party (store_products, never in code).
-- The party room: players on the list who are at the venue while the doors are open check in every
-- few seconds (party_room); each sees up to roomSize (9) of the others, crew first, and the game
-- fills the rest with NPCs (unlabeled; real players get a green dot). Blocks hide people both ways.
-- Event chat: a group chat for the people in the room, with no daily limit during the party (a short
-- gap between messages stops floods). Private messages keep their daily cap. The word filter, mutes,
-- bans, blocks and reports all apply; a report carries the message into the Studio's review queue.

update public.store_products set price_cents = 399 where product_type = 'exclusive_event';

insert into public.game_settings (key, value) values
  ('party', '{"roomSize": 9, "presenceSeconds": 40, "maxLength": 200, "gapSeconds": 2, "history": 80}')
on conflict (key) do update set value = excluded.value, updated_at = now();

create table public.party_presence (
  event_id  text not null references public.exclusive_events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  seen_at   timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table public.party_messages (
  id         bigint generated always as identity primary key,
  event_id   text not null references public.exclusive_events (id) on delete cascade,
  sender     uuid not null references public.players (id) on delete cascade,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index party_messages_event_idx on public.party_messages (event_id, id);

alter table public.party_presence enable row level security;
alter table public.party_messages enable row level security;
revoke all on public.party_presence, public.party_messages from anon, authenticated;

/** The party you're in: on the list, doors open, and at the venue. Raises the reason otherwise. */
create function public.party_gate(p_player uuid, p_event text) returns public.exclusive_events
language plpgsql stable security definer set search_path = public
as $$
declare
  ev public.exclusive_events;
  me public.players;
  now_ timestamptz := public.game_now();
begin
  select * into ev from public.exclusive_events where id = p_event;
  if ev.id is null then raise exception 'party_unknown' using errcode = '22023'; end if;
  if not public.on_party_list(p_player, ev.id) then raise exception 'party_not_on_list' using errcode = '22023'; end if;
  if now_ < ev.starts_at or now_ >= ev.ends_at then raise exception 'party_closed' using errcode = '22023'; end if;
  select * into me from public.players where id = p_player;
  if me.at_place is distinct from ev.place_id then raise exception 'party_not_here' using errcode = '22023'; end if;
  return ev;
end;
$$;
revoke all on function public.party_gate(uuid, text) from public, anon, authenticated;

/**
 * Check in and look around: who's here (up to roomSize others: crew first, then whoever came most
 * recently; never someone blocked either way), how many in all, and the chat after `p_after`.
 */
create function public.party_room(p_event text, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('party');
  ev public.exclusive_events;
  fresh timestamptz := now() - make_interval(secs => (cfg ->> 'presenceSeconds')::int);
begin
  ev := public.party_gate(uid, p_event);
  insert into public.party_presence (event_id, player_id, seen_at) values (ev.id, uid, now())
  on conflict (event_id, player_id) do update set seen_at = now();
  return jsonb_build_object(
    'count', (select count(*) from public.party_presence x where x.event_id = ev.id and x.seen_at > fresh),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'style', p.starting_style, 'look', p.look, 'crew', z.crew)
                                  order by z.crew desc, z.seen_at desc)
              from (select x.player_id, x.seen_at, x.player_id in (select id from public.crew_of(uid)) as crew
                      from public.party_presence x
                     where x.event_id = ev.id and x.seen_at > fresh and x.player_id <> uid
                       and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = x.player_id) or (b.blocker = x.player_id and b.blocked = uid))
                     order by (x.player_id in (select id from public.crew_of(uid))) desc, x.seen_at desc
                     limit (cfg ->> 'roomSize')::int) z
              join public.players p on p.id = z.player_id
             where p.banned_at is null), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'name', p.display_name, 'body', m.body, 'at', m.created_at, 'mine', m.sender = uid) order by m.id)
              from (select * from public.party_messages m
                     where m.event_id = ev.id and m.id > coalesce(p_after, 0) and not m.hidden
                       and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = m.sender) or (b.blocker = m.sender and b.blocked = uid))
                     order by m.id desc limit (cfg ->> 'history')::int) m
              join public.players p on p.id = m.sender
             where p.banned_at is null), '[]'::jsonb));
end;
$$;

/** Say something in the party chat. No daily limit during the party; the word filter still applies. */
create function public.party_say(p_event text, p_body text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('party');
  me public.players;
  ev public.exclusive_events;
  body text := btrim(coalesce(p_body, ''));
  msg public.party_messages;
begin
  select * into me from public.players where id = uid;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.banned_at is not null then raise exception 'banned' using errcode = '42501'; end if;
  if me.chat_muted_until > now() then raise exception 'muted' using errcode = '42501'; end if;
  ev := public.party_gate(uid, p_event);
  if char_length(body) = 0 then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(body) > (cfg ->> 'maxLength')::int then raise exception 'too_long' using errcode = '22023'; end if;
  if exists (select 1 from public.party_messages where event_id = ev.id and sender = uid
              and created_at > clock_timestamp() - make_interval(secs => (cfg ->> 'gapSeconds')::int)) then
    raise exception 'party_too_fast' using errcode = '22023';
  end if;
  insert into public.party_messages (event_id, sender, body) values (ev.id, uid, public.chat_filter(body)) returning * into msg;
  return jsonb_build_object('id', msg.id, 'from', uid, 'name', me.display_name, 'body', msg.body, 'at', msg.created_at, 'mine', true);
end;
$$;

/** Report a party message: it goes to the Studio's review queue with the message quoted. */
create function public.party_report(p_message bigint, p_reason text, p_note text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  msg public.party_messages;
begin
  select * into msg from public.party_messages where id = p_message;
  if msg.id is null or msg.sender = uid or not public.on_party_list(uid, msg.event_id) then raise exception 'unknown_message' using errcode = '22023'; end if;
  insert into public.reports (reporter, reported, reason, note)
  values (uid, msg.sender, p_reason,
          left('[Party chat, ' || msg.event_id || '] "' || msg.body || '"' || coalesce(' · ' || nullif(btrim(p_note), ''), ''), 500));
end;
$$;

revoke all on function public.party_room(text, bigint) from public, anon;
grant execute on function public.party_room(text, bigint) to authenticated;
revoke all on function public.party_say(text, text) from public, anon;
grant execute on function public.party_say(text, text) to authenticated;
revoke all on function public.party_report(bigint, text, text) from public, anon;
grant execute on function public.party_report(bigint, text, text) to authenticated;
