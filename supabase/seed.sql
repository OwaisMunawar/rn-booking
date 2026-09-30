-- Local demo data for `supabase db reset`.
--
-- Every account's password is "demo-password". These users exist only in your
-- local database; never run this file against a hosted project.

-- BEGIN GENERATED CATALOG (npm run seed:generate -w @rn-booking/shared)

with demo_users (id, email, full_name, role) as (values
  ('c0000000-0000-4000-8000-000000000001', 'admin@example.com', 'Morgan Lee', 'admin'),
  ('c0000000-0000-4000-8000-000000000002', 'provider@example.com', 'Marcus Hale', 'provider'),
  ('c0000000-0000-4000-8000-000000000003', 'priya@example.com', 'Priya Shah', 'provider'),
  ('c0000000-0000-4000-8000-000000000010', 'customer@example.com', 'Alex Rivera', 'customer'),
  ('c0000000-0000-4000-8000-000000000011', 'jordan@example.com', 'Jordan Kim', 'customer'),
  ('c0000000-0000-4000-8000-000000000012', 'sam@example.com', 'Sam Patel', 'customer'),
  ('c0000000-0000-4000-8000-000000000013', 'taylor@example.com', 'Taylor Brooks', 'customer'),
  ('c0000000-0000-4000-8000-000000000014', 'casey@example.com', 'Casey Nguyen', 'customer')
), inserted as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email,
    extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', full_name),
    now(), now(), '', '', '', ''
  from demo_users
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from inserted;

-- handle_new_user() created the profiles; now assign roles.
update public.profiles p set role = u.role::public.user_role
from (values
  ('c0000000-0000-4000-8000-000000000001', 'admin'),
  ('c0000000-0000-4000-8000-000000000002', 'provider'),
  ('c0000000-0000-4000-8000-000000000003', 'provider'),
  ('c0000000-0000-4000-8000-000000000010', 'customer'),
  ('c0000000-0000-4000-8000-000000000011', 'customer'),
  ('c0000000-0000-4000-8000-000000000012', 'customer'),
  ('c0000000-0000-4000-8000-000000000013', 'customer'),
  ('c0000000-0000-4000-8000-000000000014', 'customer')
) as u (id, role)
where p.id = u.id::uuid;

insert into public.providers (id, user_id, name, category, bio, neighborhood, address, lat, lng, rating, review_count, time_zone) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Fade & Co Barbers', 'hair', 'Classic cuts, skin fades and hot-towel shaves. Walk-ins welcome, bookings preferred.', 'Downtown', '410 Congress Ave', 30.2669, -97.7428, 4.8, 212, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'Loft Hair Studio', 'hair', 'Colour, cuts and styling in a bright second-floor studio.', 'South Congress', '1500 S Congress Ave', 30.2489, -97.7497, 4.7, 158, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000003', null, 'East Side Clippers', 'hair', 'No-fuss neighbourhood barber with late opening on Fridays.', 'Mueller', '1801 Aldrich St', 30.2988, -97.7057, 4.5, 87, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000004', null, 'Still Water Massage', 'wellness', 'Licensed therapists offering Swedish, deep tissue and prenatal massage.', 'Clarksville', '1204 W Lynn St', 30.2805, -97.7616, 4.9, 301, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000005', null, 'Polished Nail Bar', 'beauty', 'Non-toxic polishes, gel and nail art.', 'Rainey Street', '72 Rainey St', 30.2585, -97.7385, 4.6, 143, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000006', null, 'Core Form Pilates', 'fitness', 'Reformer and mat sessions, one-to-one with certified instructors.', 'Zilker', '2201 Barton Springs Rd', 30.2644, -97.7689, 4.8, 96, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000007', null, 'Brightside Home Cleaning', 'home', 'Insured two-person teams. Supplies included.', 'Hyde Park', '4300 Speedway', 30.3051, -97.7302, 4.4, 64, 'America/Chicago'),
  ('a0000000-0000-4000-8000-000000000008', null, 'Happy Paws Grooming', 'pets', 'Gentle grooming for dogs and cats of every size.', 'Bouldin Creek', '901 W Mary St', 30.2473, -97.7593, 4.7, 119, 'America/Chicago');

insert into public.services (id, provider_id, name, description, category, duration_minutes, buffer_minutes, price_cents) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Men''s haircut', 'Consultation, cut, wash and style.', 'hair', 30, 10, 3500),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Beard trim', 'Shape-up with hot towel finish.', 'hair', 20, 5, 2000),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Haircut + beard', 'The full works.', 'hair', 50, 10, 5000),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'Women''s cut & style', 'Wash, cut and blow-dry.', 'hair', 60, 15, 6500),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'Blowout', 'Wash and bouncy blow-dry.', 'hair', 45, 10, 4500),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'Kids haircut', 'Under 12s.', 'hair', 30, 10, 2500),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003', 'Haircut', 'Clipper or scissor cut.', 'hair', 30, 5, 2800),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003', 'Skin fade', 'Foil-shaver finish.', 'hair', 45, 5, 3800),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004', 'Swedish massage (60 min)', 'Relaxing full-body massage.', 'wellness', 60, 15, 9000),
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000004', 'Deep tissue (90 min)', 'Focused work on problem areas.', 'wellness', 90, 15, 13000),
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000005', 'Classic manicure', 'Shape, cuticle care and polish.', 'beauty', 45, 10, 3000),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000005', 'Gel manicure', 'Long-wear gel polish.', 'beauty', 60, 10, 4500),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000006', 'Private reformer session', 'One-to-one reformer class.', 'fitness', 55, 5, 7500),
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000007', 'Standard clean (2 hrs)', 'Up to two bedrooms.', 'home', 120, 30, 12000),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000008', 'Bath & brush', 'Bath, blow-dry, brush and nail trim.', 'pets', 60, 15, 4000),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000008', 'Full groom', 'Bath & brush plus breed-specific cut.', 'pets', 90, 15, 7000);

insert into public.availability_rules (id, provider_id, kind, weekday, start_time, end_time) values
  ('e0000000-0000-4000-8000-000000000100', 'a0000000-0000-4000-8000-000000000001', 'working', 1, '09:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'break', 1, '13:00', '13:30'),
  ('e0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'working', 2, '09:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'break', 2, '13:00', '13:30'),
  ('e0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000001', 'working', 3, '09:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 'break', 3, '13:00', '13:30'),
  ('e0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000001', 'working', 4, '09:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000107', 'a0000000-0000-4000-8000-000000000001', 'break', 4, '13:00', '13:30'),
  ('e0000000-0000-4000-8000-000000000108', 'a0000000-0000-4000-8000-000000000001', 'working', 5, '09:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000001', 'break', 5, '13:00', '13:30'),
  ('e0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000001', 'working', 6, '09:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000001', 'break', 6, '13:00', '13:30'),
  ('e0000000-0000-4000-8000-000000000200', 'a0000000-0000-4000-8000-000000000002', 'working', 2, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000002', 'break', 2, '13:00', '14:00'),
  ('e0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000002', 'working', 3, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000002', 'break', 3, '13:00', '14:00'),
  ('e0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000002', 'working', 4, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000205', 'a0000000-0000-4000-8000-000000000002', 'break', 4, '13:00', '14:00'),
  ('e0000000-0000-4000-8000-000000000206', 'a0000000-0000-4000-8000-000000000002', 'working', 5, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000207', 'a0000000-0000-4000-8000-000000000002', 'break', 5, '13:00', '14:00'),
  ('e0000000-0000-4000-8000-000000000208', 'a0000000-0000-4000-8000-000000000002', 'working', 6, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000209', 'a0000000-0000-4000-8000-000000000002', 'break', 6, '13:00', '14:00'),
  ('e0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000003', 'working', 1, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000003', 'working', 2, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000003', 'working', 3, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000303', 'a0000000-0000-4000-8000-000000000003', 'working', 4, '10:00', '18:00'),
  ('e0000000-0000-4000-8000-000000000304', 'a0000000-0000-4000-8000-000000000003', 'working', 5, '10:00', '21:00'),
  ('e0000000-0000-4000-8000-000000000305', 'a0000000-0000-4000-8000-000000000003', 'working', 6, '09:00', '15:00'),
  ('e0000000-0000-4000-8000-000000000400', 'a0000000-0000-4000-8000-000000000004', 'working', 1, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000004', 'break', 1, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000004', 'working', 2, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000403', 'a0000000-0000-4000-8000-000000000004', 'break', 2, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000404', 'a0000000-0000-4000-8000-000000000004', 'working', 3, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000405', 'a0000000-0000-4000-8000-000000000004', 'break', 3, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000406', 'a0000000-0000-4000-8000-000000000004', 'working', 4, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000407', 'a0000000-0000-4000-8000-000000000004', 'break', 4, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000408', 'a0000000-0000-4000-8000-000000000004', 'working', 5, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000409', 'a0000000-0000-4000-8000-000000000004', 'break', 5, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000410', 'a0000000-0000-4000-8000-000000000004', 'working', 6, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000411', 'a0000000-0000-4000-8000-000000000004', 'break', 6, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000412', 'a0000000-0000-4000-8000-000000000004', 'working', 0, '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000413', 'a0000000-0000-4000-8000-000000000004', 'break', 0, '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000500', 'a0000000-0000-4000-8000-000000000005', 'working', 1, '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000501', 'a0000000-0000-4000-8000-000000000005', 'working', 2, '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000502', 'a0000000-0000-4000-8000-000000000005', 'working', 3, '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000503', 'a0000000-0000-4000-8000-000000000005', 'working', 4, '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000504', 'a0000000-0000-4000-8000-000000000005', 'working', 5, '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000505', 'a0000000-0000-4000-8000-000000000005', 'working', 6, '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000600', 'a0000000-0000-4000-8000-000000000006', 'working', 1, '07:00', '11:00'),
  ('e0000000-0000-4000-8000-000000000601', 'a0000000-0000-4000-8000-000000000006', 'working', 2, '07:00', '11:00'),
  ('e0000000-0000-4000-8000-000000000602', 'a0000000-0000-4000-8000-000000000006', 'working', 3, '07:00', '11:00'),
  ('e0000000-0000-4000-8000-000000000603', 'a0000000-0000-4000-8000-000000000006', 'working', 4, '07:00', '11:00'),
  ('e0000000-0000-4000-8000-000000000604', 'a0000000-0000-4000-8000-000000000006', 'working', 5, '07:00', '11:00'),
  ('e0000000-0000-4000-8000-000000000605', 'a0000000-0000-4000-8000-000000000006', 'working', 1, '16:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000606', 'a0000000-0000-4000-8000-000000000006', 'working', 2, '16:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000607', 'a0000000-0000-4000-8000-000000000006', 'working', 3, '16:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000608', 'a0000000-0000-4000-8000-000000000006', 'working', 4, '16:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000609', 'a0000000-0000-4000-8000-000000000006', 'working', 5, '16:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000610', 'a0000000-0000-4000-8000-000000000006', 'working', 6, '08:00', '12:00'),
  ('e0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000007', 'working', 1, '08:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000007', 'working', 2, '08:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000007', 'working', 3, '08:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000007', 'working', 4, '08:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000704', 'a0000000-0000-4000-8000-000000000007', 'working', 5, '08:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000800', 'a0000000-0000-4000-8000-000000000008', 'working', 2, '09:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000008', 'break', 2, '12:30', '13:00'),
  ('e0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000008', 'working', 3, '09:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000008', 'break', 3, '12:30', '13:00'),
  ('e0000000-0000-4000-8000-000000000804', 'a0000000-0000-4000-8000-000000000008', 'working', 4, '09:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000008', 'break', 4, '12:30', '13:00'),
  ('e0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000008', 'working', 5, '09:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000008', 'break', 5, '12:30', '13:00'),
  ('e0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000008', 'working', 6, '09:00', '17:00'),
  ('e0000000-0000-4000-8000-000000000809', 'a0000000-0000-4000-8000-000000000008', 'break', 6, '12:30', '13:00');

-- END GENERATED CATALOG

-- Bookings are generated relative to today so the dashboard always has data.
-- Candidates that fall outside working hours or overlap an earlier booking are
-- rejected by the same trigger and exclusion constraint the app relies on.
do $$
declare
  prov record;
  svc record;
  win record;
  customers uuid[] := array(
    select id from public.profiles where role = 'customer' order by id
  );
  local_day date;
  local_start timestamp;
  v_start timestamptz;
  n integer := 0;
  day_offset integer;
  k integer;
  svc_count integer;
  booking_status public.booking_status;
begin
  for day_offset in -21..10 loop
    for prov in select * from public.providers order by id loop
      local_day := (now() at time zone prov.time_zone)::date + day_offset;
      select count(*) into svc_count from public.services where provider_id = prov.id;

      for win in
        select * from public.availability_rules
        where provider_id = prov.id and kind = 'working' and weekday = extract(dow from local_day)
        order by start_time
      loop
        for k in 0..2 loop
          n := n + 1;
          select * into svc from public.services
          where provider_id = prov.id
          order by id
          offset (n % svc_count) limit 1;

          local_start := local_day + win.start_time + make_interval(mins => 30 + k * 150 + (n % 3) * 30);
          v_start := local_start at time zone prov.time_zone;

          if v_start < now() then
            booking_status := case when n % 11 = 0 then 'cancelled' when n % 17 = 0 then 'no_show' else 'completed' end;
          else
            booking_status := case when n % 6 = 0 then 'pending' when n % 13 = 0 then 'cancelled' else 'confirmed' end;
          end if;

          begin
            insert into public.bookings (customer_id, service_id, start_at, status)
            values (customers[1 + n % array_length(customers, 1)], svc.id, v_start, booking_status);
          exception
            when exclusion_violation or check_violation then
              null;
          end;
        end loop;
      end loop;
    end loop;
  end loop;
end;
$$;
