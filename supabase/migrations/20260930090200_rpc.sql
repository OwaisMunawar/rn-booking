-- Functions called by the app through PostgREST.

-- Customers need to know when a provider is busy without seeing whose bookings
-- those are. This returns bare intervals for a bounded window.
create function public.get_busy_intervals(p_provider_id uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.start_at, b.buffer_end_at
  from public.bookings b
  where b.provider_id = p_provider_id
    and b.status in ('pending', 'confirmed')
    and b.buffer_end_at > p_from
    and b.start_at < p_to
    and p_to - p_from <= interval '31 days'
  order by b.start_at;
$$;

revoke execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Replaces a provider's weekly hours in one transaction. Runs as the caller, so
-- the availability_rules RLS policies decide who may do it.
create function public.replace_availability_rules(p_provider_id uuid, p_rules jsonb)
returns setof public.availability_rules
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.owns_provider(p_provider_id)) then
    raise exception 'Not allowed to edit this provider''s hours' using errcode = 'insufficient_privilege';
  end if;

  delete from public.availability_rules where provider_id = p_provider_id;

  insert into public.availability_rules (provider_id, kind, weekday, start_time, end_time)
  select
    p_provider_id,
    (rule ->> 'kind')::public.availability_kind,
    (rule ->> 'weekday')::smallint,
    (rule ->> 'startTime')::time,
    (rule ->> 'endTime')::time
  from jsonb_array_elements(p_rules) as rule;

  return query
    select * from public.availability_rules
    where provider_id = p_provider_id
    order by weekday, start_time;
end;
$$;

revoke execute on function public.replace_availability_rules(uuid, jsonb) from public, anon;
grant execute on function public.replace_availability_rules(uuid, jsonb) to authenticated;

-- Books a service for the signed-in user. Provider, end times and price are
-- derived by the bookings trigger; RLS and the exclusion constraint still apply.
create function public.create_booking(p_service_id uuid, p_start_at timestamptz, p_notes text default null)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created public.bookings;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to book' using errcode = 'insufficient_privilege';
  end if;

  insert into public.bookings (customer_id, service_id, start_at, notes)
  values ((select auth.uid()), p_service_id, p_start_at, nullif(trim(p_notes), ''))
  returning * into created;

  return created;
end;
$$;

revoke execute on function public.create_booking(uuid, timestamptz, text) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, text) to authenticated;
