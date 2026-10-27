-- Per-player rate limits (owner, Oct 27; gap analysis: abuse and cost). The game's browser talks to the database
-- directly, so the limit lives here: PostgREST runs public.check_request() before every request (pgrst.db_pre_request).
-- Writes only (reads run read-only and are never counted); signed-in players only (the webhook and server jobs use the
-- service role and are never limited). Fixed one-minute windows, one counter row per player and bucket:
--   * all: every write a player makes (240 a minute: the busiest screens poll a few times a minute);
--   * guess: answers and lookups someone could brute-force (hunt answers, exams, gossip, name checks);
--   * post: things the team reviews (Mayor letters, Clout TV, shoutouts, reports);
--   * chat: messages; checkout: Stripe checkouts.
-- Over the limit, the request fails with HTTP 429 ('rate_limited') and changes nothing. Tunable in game_settings
-- 'rate_limits' (mirrored by lib/rateLimits.ts). Anything unexpected inside the check lets the request through.

create table if not exists public.rate_counters (
  player_id    uuid not null,
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null,
  primary key (player_id, bucket)
);
alter table public.rate_counters enable row level security;
revoke all on public.rate_counters from anon, authenticated;

insert into public.game_settings (key, value) values ('rate_limits', '{"windowSeconds":60,"all":240,"buckets":{"guess":{"limit":20,"rpc":["hunt_answer","campus_exam_check","campus_exam_submit","gossip_find","is_name_available"]},"post":{"limit":10,"rpc":["mayor_write","tv_submit","radio_request","chat_report","party_report","radio_report"]},"chat":{"limit":30,"rpc":["chat_send"]},"checkout":{"limit":10,"rpc":["start_purchase"]}}}'::jsonb)
on conflict (key) do update set value = excluded.value;

/** One hit on a player's bucket; true while the window's hits are within the limit. */
create or replace function public.rate_hit(p_player uuid, p_bucket text, p_limit int, p_window int) returns boolean
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  insert into public.rate_counters as c (player_id, bucket, window_start, hits) values (p_player, p_bucket, now(), 1)
  on conflict (player_id, bucket) do update set
    hits = case when c.window_start <= now() - make_interval(secs => p_window) then 1 else c.hits + 1 end,
    window_start = case when c.window_start <= now() - make_interval(secs => p_window) then now() else c.window_start end
  returning hits into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.rate_hit(uuid, text, int, int) from public, anon, authenticated;

/** PostgREST's pre-request hook: raises 'rate_limited' (HTTP 429) when a signed-in player's write is over a limit. */
create or replace function public.check_request() returns void
language plpgsql security definer set search_path = public
as $$
declare
  who uuid;
  method text := current_setting('request.method', true);
  fn text;
  cfg jsonb;
  win int;
  b record;
begin
  if coalesce(method, 'GET') in ('GET', 'HEAD', 'OPTIONS') then return; end if;
  who := auth.uid();
  if who is null then return; end if;
  begin
    cfg := public.game_settings_value('rate_limits');
    if cfg is null then return; end if;
    win := coalesce((cfg ->> 'windowSeconds')::int, 60);
    if not public.rate_hit(who, 'all', (cfg ->> 'all')::int, win) then
      raise exception 'rate_limited' using errcode = 'PT429', hint = 'all';
    end if;
    fn := substring(current_setting('request.path', true) from '/rpc/([A-Za-z0-9_]+)');
    if fn is not null then
      for b in select key, value from jsonb_each(cfg -> 'buckets') loop
        if (b.value -> 'rpc') ? fn and not public.rate_hit(who, b.key, (b.value ->> 'limit')::int, win) then
          raise exception 'rate_limited' using errcode = 'PT429', hint = b.key;
        end if;
      end loop;
    end if;
  exception
    when sqlstate 'PT429' then raise;
    when others then return; -- never block the game because the check itself broke
  end;
end;
$$;
revoke all on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated;

-- Switch it on (Supabase: the authenticator role is PostgREST's). The local test database has no such role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.check_request''';
    perform pg_notify('pgrst', 'reload config');
  end if;
end $$;
