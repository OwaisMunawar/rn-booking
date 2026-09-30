-- Core booking schema: people, providers, what they sell, when they work, and bookings.

create extension if not exists btree_gist with schema extensions;

create type public.user_role as enum ('customer', 'provider', 'admin');
create type public.service_category as enum ('hair', 'beauty', 'wellness', 'fitness', 'home', 'pets');
create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.availability_kind as enum ('working', 'break');

-- IANA zone names are validated against Postgres' own tz database so the
-- availability engine and SQL agree on what a zone means.
create function public.is_valid_time_zone(tz text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'Only changeable with the service role. Authenticated users can update full_name only.';

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  category public.service_category not null,
  bio text not null default '' check (char_length(bio) <= 500),
  neighborhood text not null default '',
  address text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  time_zone text not null check (public.is_valid_time_zone(time_zone)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  category public.service_category not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 120),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index services_provider_id_idx on public.services (provider_id);

-- Weekly recurring hours in the provider's local time. end_time may be 24:00.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind public.availability_kind not null default 'working',
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  constraint availability_rules_time_order check (end_time > start_time)
);

create index availability_rules_provider_id_idx on public.availability_rules (provider_id, weekday);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.providers (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- end_at plus the service's clean-up buffer; the provider is busy until then.
  buffer_end_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  price_cents integer not null check (price_cents >= 0),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (end_at > start_at and buffer_end_at >= end_at),
  -- The double-booking guarantee: no two active bookings for one provider may
  -- overlap, buffers included. Holds under concurrent inserts, unlike a
  -- read-then-write check in application code.
  constraint bookings_no_overlap exclude using gist (
    provider_id with =,
    tstzrange(start_at, buffer_end_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index bookings_customer_start_idx on public.bookings (customer_id, start_at);
create index bookings_provider_start_idx on public.bookings (provider_id, start_at);
create index bookings_service_id_idx on public.bookings (service_id);

-- Profiles are created for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Derive provider, end times and price from the service so clients cannot
-- submit their own, then check the booking sits inside working hours.
create function public.bookings_derive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  svc public.services%rowtype;
  tz text;
  local_start timestamp;
  local_end timestamp;
  local_day date;
begin
  select * into svc from public.services where id = new.service_id;
  if not found then
    raise exception 'Service % not found', new.service_id using errcode = 'foreign_key_violation';
  end if;

  if tg_op = 'INSERT' and not svc.is_active then
    raise exception 'Service is not bookable' using errcode = 'check_violation';
  end if;

  new.provider_id := svc.provider_id;
  new.end_at := new.start_at + make_interval(mins => svc.duration_minutes);
  new.buffer_end_at := new.end_at + make_interval(mins => svc.buffer_minutes);
  if tg_op = 'INSERT' then
    new.price_cents := svc.price_cents;
  end if;

  select p.time_zone into tz from public.providers p where p.id = svc.provider_id;
  local_start := new.start_at at time zone tz;
  local_end := new.end_at at time zone tz;
  local_day := local_start::date;

  if not exists (
    select 1 from public.availability_rules r
    where r.provider_id = svc.provider_id
      and r.kind = 'working'
      and r.weekday = extract(dow from local_day)
      and local_start >= local_day + r.start_time
      and local_end <= local_day + r.end_time
  ) or exists (
    select 1 from public.availability_rules r
    where r.provider_id = svc.provider_id
      and r.kind = 'break'
      and r.weekday = extract(dow from local_day)
      and tsrange(local_start, local_end) && tsrange(local_day + r.start_time, local_day + r.end_time)
  ) then
    raise exception 'Booking is outside the provider''s working hours'
      using errcode = 'check_violation', constraint = 'bookings_within_hours';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_20_derive_fields
  before insert or update of service_id, start_at on public.bookings
  for each row execute function public.bookings_derive_fields();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_30_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();
