-- Weekly due dates for everyone (owner, Oct 15: "Rent should be weekly so there's a sense of urgency").
--
-- Bills have been weekly since 0028, but players who moved in while they were monthly (0005) kept a
-- next due date up to a month away: the Bills sheet said "Due in 28 days" and its bar stayed empty.
-- Nothing moved those dates closer, because sync_player only rolls a date forward once it's reached.
-- This brings every next due date (rent, phone, car) to at most one period from today. Run once.

do $$
begin
  if to_regprocedure('public.admin_insights(integer)') is null then
    raise exception 'Run migration 0053 first.';
  end if;
end $$;

update public.players p
   set next_rent_due  = least(p.next_rent_due,  (public.ny_today() + (public.city() -> 'economy' -> 'bills' ->> 'every')::interval)::date),
       next_phone_due = least(p.next_phone_due, (public.ny_today() + (public.city() -> 'economy' -> 'bills' ->> 'every')::interval)::date),
       next_car_due   = least(p.next_car_due,   public.ny_today() + greatest(
                          coalesce((public.city() -> 'economy' -> 'bills' ->> 'carRentalDays')::int, 7),
                          extract(day from (public.city() -> 'economy' -> 'bills' ->> 'every')::interval)::int))
 where p.next_rent_due  > (public.ny_today() + (public.city() -> 'economy' -> 'bills' ->> 'every')::interval)::date
    or p.next_phone_due > (public.ny_today() + (public.city() -> 'economy' -> 'bills' ->> 'every')::interval)::date
    or p.next_car_due   > public.ny_today() + 7;
