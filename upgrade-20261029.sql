-- Run once in the existing Supabase project's SQL Editor before deploying the app.
begin;
alter table public.expenses add column if not exists coverage_start date;
alter table public.expenses add column if not exists coverage_end date;

-- The parent and its earnings are saved in one transaction. Retries replace totals.
create or replace function public.save_driver_day(entry jsonb, earnings jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare entry_id uuid := (entry->>'id')::uuid;
begin
  if auth.uid() is null or (entry->>'user_id')::uuid is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  insert into public.daily_entries (id, user_id, work_date, hours_worked, odometer_start, odometer_end, fuel_cost, notes)
  values (entry_id, auth.uid(), (entry->>'work_date')::date, (entry->>'hours_worked')::numeric,
    (entry->>'odometer_start')::numeric, (entry->>'odometer_end')::numeric,
    (entry->>'fuel_cost')::numeric, coalesce(entry->>'notes', ''))
  on conflict (id) do update set work_date = excluded.work_date, hours_worked = excluded.hours_worked,
    odometer_start = excluded.odometer_start, odometer_end = excluded.odometer_end,
    fuel_cost = excluded.fuel_cost, notes = excluded.notes;
  delete from public.platform_earnings where daily_entry_id = entry_id;
  insert into public.platform_earnings (daily_entry_id, platform_name, gross_income, trips)
  select entry_id, value->>'name', (value->>'amount')::numeric, (value->>'trips')::integer
  from jsonb_array_elements(earnings);
end;
$$;
revoke all on function public.save_driver_day(jsonb, jsonb) from public, anon;
grant execute on function public.save_driver_day(jsonb, jsonb) to authenticated;
commit;
