-- Rent alarm (owner, Oct 22: "I'm low on cash but there's no sense of emergency to get gigs to make rent"). Players got a
-- push when a bill was due today or tomorrow, and when it was late; nothing warned them early enough to earn the money.
--   * push_scan_rent_short() (service role, run by the sender after push_scan): rent due in the next 3 days and not
--     enough cash in the bank for it: one push per rent date ('rent_short', P1 money), opening the Gigs app.
--   * In the game, the home screen shows a rent alert card and the bank pill turns red (lib/cityState.ts rentAlert).
-- Safe to run more than once.

create or replace function public.push_scan_rent_short() returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  n int := 0;
  r record;
begin
  for r in
    select p.id, p.next_rent_due as due, public.rent_for(p.home_id) as rent, p.bank_cash
      from public.players p
     where p.house_sku is null and p.home_id is not null
       and p.next_rent_due between today and today + 3
       and p.bank_cash < coalesce(public.rent_for(p.home_id), 0)
  loop
    perform public.push_enqueue(r.id, 'rent_short', 'rentshort:' || r.id || ':' || r.due,
      '💸 Rent''s due ' || (case r.due - today when 0 then 'today' when 1 then 'tomorrow' else 'in ' || (r.due - today) || ' days' end)
        || ' and you''re short',
      'C$' || to_char(r.rent, 'FM999,999,999') || ' due, C$' || to_char(greatest(r.bank_cash, 0), 'FM999,999,999')
        || ' in the bank. Grab a gig before your landlord grabs your keys.',
      '/home?open=gigs', public.push_day_end(r.due));
    n := n + 1;
  end loop;
  return n;
exception when others then return n;
end;
$$;
revoke all on function public.push_scan_rent_short() from public, anon, authenticated;
grant execute on function public.push_scan_rent_short() to service_role;
