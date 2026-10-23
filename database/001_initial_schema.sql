-- KelvJessia Transport production data model for Supabase PostgreSQL.
-- Run only after business authorization and configure Supabase Auth before public launch.
create extension if not exists pgcrypto;

create type public.booking_status as enum ('pending','confirmed','cancelled','completed');
create type public.user_role as enum ('admin','staff','customer');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone_numbers text[] not null default '{}',
  whatsapp_number text,
  description text,
  booking_policy text,
  support_information text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  role public.user_role not null default 'customer',
  full_name text,
  created_at timestamptz not null default now()
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null check (category in ('passenger_bus','mini_bus','executive_van','group_vehicle')),
  capacity integer not null check (capacity > 0),
  amenities text[] not null default '{}',
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  origin text not null,
  destination text not null,
  is_student_route boolean not null default false,
  is_published boolean not null default false,
  unique (business_id, origin, destination)
);
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  departure_at timestamptz not null,
  fare_kobo integer check (fare_kobo >= 0),
  seat_capacity integer not null check (seat_capacity > 0),
  seats_reserved integer not null default 0 check (seats_reserved >= 0 and seats_reserved <= seat_capacity),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  trip_id uuid not null references public.trips(id) on delete restrict,
  customer_id uuid references public.users(id) on delete set null,
  passenger_name text not null,
  email text,
  phone text not null,
  passengers_count integer not null check (passengers_count > 0),
  special_requests text,
  status public.booking_status not null default 'pending',
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index trips_departure_published_idx on public.trips (departure_at) where is_published;
create index bookings_trip_status_idx on public.bookings (trip_id, status);
create index bookings_customer_created_idx on public.bookings (customer_id, created_at desc);
create index audit_business_created_idx on public.admin_audit_logs (business_id, created_at desc);

-- All final-seat decisions are made under a row lock, preventing concurrent overbooking.
create or replace function public.create_pending_booking(
  p_trip_id uuid, p_reference text, p_passenger_name text, p_email text, p_phone text,
  p_passengers_count integer, p_special_requests text, p_idempotency_key uuid
) returns public.bookings language plpgsql security definer set search_path = public as $$
declare v_trip public.trips; v_booking public.bookings;
begin
  select * into v_trip from public.trips where id = p_trip_id and is_published = true for update;
  if not found then raise exception 'Trip is unavailable'; end if;
  if p_passengers_count < 1 or v_trip.seats_reserved + p_passengers_count > v_trip.seat_capacity then
    raise exception 'Insufficient seats';
  end if;
  update public.trips set seats_reserved = seats_reserved + p_passengers_count where id = v_trip.id;
  insert into public.bookings (reference,trip_id,customer_id,passenger_name,email,phone,passengers_count,special_requests,idempotency_key)
  values (p_reference,p_trip_id,auth.uid(),p_passenger_name,p_email,p_phone,p_passengers_count,p_special_requests,p_idempotency_key)
  returning * into v_booking;
  return v_booking;
end; $$;

alter table public.businesses enable row level security;
alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.routes enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.passengers enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Add staff/admin policies only through reviewed migrations. Customers can see only their own bookings.
create policy "customers read their own bookings" on public.bookings for select using (customer_id = auth.uid());
create policy "customers read their own passengers" on public.passengers for select using (
  exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
);
