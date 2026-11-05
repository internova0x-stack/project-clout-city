-- Starter Week's message mission without other players (owner, Nov 5: "go ahead with the message mission to Lola"). Early
-- on there may be nobody to message, so answering Lola Lowdown's text in Messages also counts. The player picks one of
-- three ready-made replies (lib/starter.ts LOLA_TEXT): nothing typed, nothing stored but the mark, never seen by others.

create or replace function public.starter_lola_reply(p_reply int) returns boolean
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if p_reply is null or p_reply not between 0 and 2 then raise exception 'bad_reply' using errcode = '22023'; end if;
  if not public.starter_active(uid) then return false; end if;
  perform public.starter_mark(uid, 'message');
  return exists (select 1 from public.starter_marks where player_id = uid and mission = 'message');
end;
$$;

revoke all on function public.starter_lola_reply(int) from public, anon;
grant execute on function public.starter_lola_reply(int) to authenticated;
