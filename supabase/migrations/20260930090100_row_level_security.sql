-- Row level security.
--
--   customers  read the public catalogue, manage their own bookings (cancel only)
--   providers  manage their own provider row, services, hours; see their bookings
--   admins     everything
--
-- Helper functions are SECURITY DEFINER so policies on one table can look at
-- another without recursing through that table's own policies.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.owns_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.providers where id = p_provider_id and user_id = (select auth.uid())
  );
$$;

-- Table privileges are granted explicitly; RLS then narrows them row by row.
grant usage on schema public to anon, authenticated;
grant select on public.providers, public.services, public.availability_rules to anon, authenticated;
grant insert, update, delete on public.providers, public.services, public.availability_rules to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant execute on function public.is_admin(), public.owns_provider(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.bookings enable row level security;

-- profiles ------------------------------------------------------------------

create policy "profiles: read own, admin, or provider's customers"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
    or exists (
      select 1 from public.bookings b
      where b.customer_id = profiles.id and public.owns_provider(b.provider_id)
    )
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Role escalation guard: only full_name is writable by end users.
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- providers -----------------------------------------------------------------

create policy "providers: public catalogue"
  on public.providers for select to anon, authenticated
  using (is_active or user_id = (select auth.uid()) or (select public.is_admin()));

create policy "providers: admin inserts"
  on public.providers for insert to authenticated
  with check ((select public.is_admin()));

create policy "providers: owner or admin updates"
  on public.providers for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "providers: admin deletes"
  on public.providers for delete to authenticated
  using ((select public.is_admin()));

-- Owners may edit their listing but not reassign it or touch their own rating.
create function public.providers_guard_owner_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
    or new.rating <> old.rating
    or new.review_count <> old.review_count then
    raise exception 'Only admins can change ownership or ratings' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger providers_10_guard_owner_update
  before update on public.providers
  for each row execute function public.providers_guard_owner_update();

-- services ------------------------------------------------------------------

create policy "services: public catalogue"
  on public.services for select to anon, authenticated
  using (
    (is_active and exists (select 1 from public.providers p where p.id = provider_id and p.is_active))
    or public.owns_provider(provider_id)
    or (select public.is_admin())
  );

create policy "services: owner or admin inserts"
  on public.services for insert to authenticated
  with check (public.owns_provider(provider_id) or (select public.is_admin()));

create policy "services: owner or admin updates"
  on public.services for update to authenticated
  using (public.owns_provider(provider_id) or (select public.is_admin()))
  with check (public.owns_provider(provider_id) or (select public.is_admin()));

create policy "services: owner or admin deletes"
  on public.services for delete to authenticated
  using (public.owns_provider(provider_id) or (select public.is_admin()));

-- availability_rules --------------------------------------------------------

create policy "availability: public"
  on public.availability_rules for select to anon, authenticated
  using (true);

create policy "availability: owner or admin writes"
  on public.availability_rules for all to authenticated
  using (public.owns_provider(provider_id) or (select public.is_admin()))
  with check (public.owns_provider(provider_id) or (select public.is_admin()));

-- bookings ------------------------------------------------------------------

create policy "bookings: customer, provider or admin reads"
  on public.bookings for select to authenticated
  using (
    customer_id = (select auth.uid())
    or public.owns_provider(provider_id)
    or (select public.is_admin())
  );

create policy "bookings: customers book for themselves, in the future"
  on public.bookings for insert to authenticated
  with check (customer_id = (select auth.uid()) and start_at > now());

create policy "bookings: customer, provider or admin updates"
  on public.bookings for update to authenticated
  using (
    customer_id = (select auth.uid())
    or public.owns_provider(provider_id)
    or (select public.is_admin())
  )
  with check (
    customer_id = (select auth.uid())
    or public.owns_provider(provider_id)
    or (select public.is_admin())
  );

-- No delete policy: bookings are cancelled, never removed.

-- What each party may change on an existing booking.
create function public.bookings_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.customer_id <> old.customer_id
    or new.service_id <> old.service_id
    or new.start_at <> old.start_at
    or new.price_cents <> old.price_cents then
    raise exception 'Only admins can reassign, reschedule or reprice a booking'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.owns_provider(old.provider_id) and new.status <> old.status then
    if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') then
      raise exception 'Customers can only cancel upcoming bookings'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger bookings_10_guard_update
  before update on public.bookings
  for each row execute function public.bookings_guard_update();
