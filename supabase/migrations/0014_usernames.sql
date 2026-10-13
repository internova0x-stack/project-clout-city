-- 0014: names are usernames (@handles), from testing (Oct 13, 2026).
-- New players pick a username: 3 to 20 letters, numbers, _ or . with no spaces; a leading @
-- is dropped. Names claimed before this stay as they are (the table constraint still allows
-- them), so no player data changes. Uniqueness stays case-insensitive.

create or replace function public.create_player(
  p_display_name text,
  p_starting_style text,
  p_look jsonb,
  p_invite_code text,
  p_age_confirmed boolean
) returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := regexp_replace(btrim(coalesce(p_display_name, '')), '^@+', '');
  inviter uuid;
  created public.players;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if coalesce(p_age_confirmed, false) is not true then
    raise exception 'age_not_confirmed' using errcode = '22023';
  end if;

  if exists (select 1 from public.players where id = uid) then
    select * into created from public.players where id = uid;
    return created;
  end if;

  -- New names are usernames (0014): 3 to 20 letters, numbers, _ or . (no spaces).
  if clean_name !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'name_format' using errcode = '22023';
  end if;

  if exists (select 1 from public.players where lower(btrim(display_name)) = lower(clean_name)) then
    raise exception 'name_taken' using errcode = '23505';
  end if;

  insert into public.players (id, display_name, starting_style, look, invite_code, age_confirmed_at)
  values (uid, clean_name, p_starting_style, coalesce(p_look, '{}'::jsonb), public.generate_invite_code(), now())
  returning * into created;

  if p_invite_code is not null then
    select id into inviter from public.players
      where invite_code = upper(btrim(p_invite_code)) and id <> uid;
    if inviter is not null then
      insert into public.invites (inviter_id, invitee_id, invite_code)
      values (inviter, uid, upper(btrim(p_invite_code)))
      on conflict (invitee_id) do nothing;
    end if;
  end if;

  return created;
end;
$$;


-- is_name_available ignores a leading @, like create_player.
create or replace function public.is_name_available(p_display_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.players
    where lower(btrim(display_name)) = lower(regexp_replace(btrim(coalesce(p_display_name, '')), '^@+', ''))
  );
$$;
