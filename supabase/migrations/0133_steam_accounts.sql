-- Steam (owner, Oct 30: "publish to Steam"; step 2 of 3, docs/STEAM.md). The Steam app signs players in with their
-- Steam account: the app asks Steam for a Web API ticket, the server checks it with Steam (lib/steam.ts) and finds or
-- makes the account here. One Steam account per game account and the other way round.
--   * steam_accounts: Steam id → auth user. Written only by the server (service role): /api/steam/session.
--   * A player who already plays on the web signs in with email inside the Steam app once; the server then links their
--     Steam id to that account. If the Steam id is on an account the Steam app made that never got a character, the
--     link moves (nothing is lost); one with a character keeps it.
--   * Deleting the account deletes the link (cascade).

create table if not exists public.steam_accounts (
  steam_id   text primary key check (steam_id ~ '^[0-9]{17}$'),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  made_here  boolean not null default false,       -- the Steam app made this account (no email of the player's own)
  linked_at  timestamptz not null default now()
);

alter table public.steam_accounts enable row level security;
revoke all on public.steam_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.steam_accounts to service_role;

-- A Steam-made account that exists but never got its link (a first launch that failed half way): found by its address
-- so the next launch can finish the link. Service role only.
create or replace function public.steam_user_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public, auth
as $$ select id from auth.users where lower(email) = lower(p_email) and p_email like 'steam-%@users.cloutcity.app' $$;

revoke all on function public.steam_user_by_email(text) from public, anon, authenticated;
grant execute on function public.steam_user_by_email(text) to service_role;
