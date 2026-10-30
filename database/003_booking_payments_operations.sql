-- KelvJessia Transport booking, payment and operations upgrade.
--
-- Prerequisite: 002_production_booking_schema.sql only. Apply to an isolated
-- protected staging project before considering production. This migration does
-- not publish trips, enable public intake, or create real customer records.

create extension if not exists pgcrypto;

do $$ begin
  create type public.payment_status as enum ('pending','processing','successful','failed','expired','refunded','recovery_required');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.enquiry_category as enum ('booking_assistance','payment_issues','pickup_information','dropoff_information','refund_requests','general_enquiries','complaints');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.enquiry_status as enum ('new','in_progress','awaiting_customer','resolved','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.trip_operational_status as enum ('scheduled','boarding','departed','in_transit','completed','cancelled');
exception when duplicate_object then null; end $$;

-- The existing API uses this relation for authorization. Keeping it separate
-- from passenger data lets a company account have one or more audited roles.
-- The first deployed auth-only schema used one row per user with a
-- customer/admin check. Preserve existing customer rows while expanding this
-- staging schema to the staff and driver roles required by this upgrade.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('customer','admin','staff','driver')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles alter column role drop default;
alter table public.user_roles
  add constraint user_roles_role_check check (role in ('customer','admin','staff','driver'));
alter table public.user_roles add primary key (user_id, role);

create table if not exists public.booking_settings (
  singleton boolean primary key default true check (singleton),
  hold_minutes integer not null default 15 check (hold_minutes between 5 and 60),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.booking_settings (singleton, hold_minutes) values (true, 15)
on conflict (singleton) do nothing;

create table if not exists public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  address text check (address is null or char_length(address) <= 500),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (phone is null or char_length(phone) between 7 and 30),
  licence_reference text unique check (licence_reference is null or char_length(licence_reference) <= 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trips
  add column if not exists fare_kobo integer check (fare_kobo is null or fare_kobo >= 0),
  add column if not exists pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  add column if not exists pickup_time time,
  add column if not exists estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes between 1 and 1440),
  add column if not exists estimated_arrival_at timestamptz,
  add column if not exists driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists operational_status public.trip_operational_status not null default 'scheduled';

alter table public.bookings
  add column if not exists pickup_location_text text check (pickup_location_text is null or char_length(pickup_location_text) <= 500),
  add column if not exists scheduled_pickup_at timestamptz,
  add column if not exists estimated_dropoff_at timestamptz,
  add column if not exists amount_kobo integer check (amount_kobo is null or amount_kobo >= 0),
  add column if not exists payment_reference text unique;

create table if not exists public.booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  provider text not null check (provider in ('paystack')),
  provider_reference text not null unique check (provider_reference ~ '^KJP-[A-Z0-9-]{12,80}$'),
  initialization_key uuid not null unique,
  amount_kobo integer not null check (amount_kobo >= 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  status public.payment_status not null default 'pending',
  provider_transaction_id text unique,
  provider_payload jsonb,
  verified_at timestamptz,
  refund_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider = 'paystack'),
  event_hash text not null unique check (event_hash ~ '^[a-f0-9]{64}$'),
  provider_reference text,
  event_type text not null check (char_length(event_type) between 1 and 120),
  received_at timestamptz not null default now()
);

create table if not exists private.enquiry_submission_attempts (
  id bigint generated always as identity primary key,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^KJE-[0-9]{4}-[A-Z0-9]{8}$'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 7 and 30),
  category public.enquiry_category not null,
  subject text not null check (char_length(subject) between 3 and 180),
  message text not null check (char_length(message) between 10 and 4000),
  status public.enquiry_status not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.enquiry_responses (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.customer_enquiries(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pickup_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  marked_by uuid not null references auth.users(id) on delete restrict,
  actual_pickup_at timestamptz not null default now(),
  correction_reason text check (correction_reason is null or char_length(correction_reason) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.dropoff_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  marked_by uuid not null references auth.users(id) on delete restrict,
  actual_dropoff_at timestamptz not null default now(),
  correction_reason text check (correction_reason is null or char_length(correction_reason) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 160),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payments_booking_created_idx on public.payments (booking_id, created_at desc);
create index if not exists payments_status_created_idx on public.payments (status, created_at desc);
create unique index if not exists payments_one_active_attempt_per_booking_idx on public.payments (booking_id) where status in ('pending','processing');
create index if not exists enquiries_status_created_idx on public.customer_enquiries (status, created_at desc);
create index if not exists enquiries_category_created_idx on public.customer_enquiries (category, created_at desc);
create index if not exists enquiry_attempts_fingerprint_created_idx on private.enquiry_submission_attempts (request_fingerprint, created_at desc);
create index if not exists pickup_records_booking_idx on public.pickup_records (booking_id);
create index if not exists dropoff_records_booking_idx on public.dropoff_records (booking_id);
create index if not exists trips_driver_departure_idx on public.trips (driver_id, departure_at) where driver_id is not null;
create index if not exists audit_logs_entity_created_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create or replace function private.booking_hold_minutes()
returns integer language sql security definer set search_path = '' as $$
  select hold_minutes from public.booking_settings where singleton = true
$$;

-- Replace the staging baseline function only to source its hold from the
-- administrator-controlled setting. Locking, rate limiting and idempotency
-- remain server-side and database-transactional.
create or replace function public.create_server_booking(
  p_trip_id uuid, p_passenger_name text, p_passenger_email text,
  p_passenger_phone text, p_seat_count integer, p_special_requirements text,
  p_idempotency_key uuid, p_request_fingerprint text
) returns table (reference text, status public.transport_booking_status, hold_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
  v_existing public.bookings;
  v_used integer;
  v_reference text;
  v_hold timestamptz := now() + make_interval(mins => private.booking_hold_minutes());
begin
  if p_seat_count is null or p_seat_count < 1 or p_seat_count > 20 then raise exception 'Invalid seat count' using errcode = '22023'; end if;
  if p_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint' using errcode = '22023'; end if;
  select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
  if found then return query select v_existing.reference, v_existing.status, v_existing.hold_expires_at; return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_fingerprint, 0));
  if (select count(*) from private.booking_submission_attempts where request_fingerprint = p_request_fingerprint and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many booking attempts. Please try again later.' using errcode = '22023';
  end if;
  select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
  if found then return query select v_existing.reference, v_existing.status, v_existing.hold_expires_at; return; end if;
  insert into private.booking_submission_attempts (request_fingerprint) values (p_request_fingerprint);
  select * into v_trip from public.trips where id = p_trip_id and is_published and departure_at > now() for update;
  if not found then raise exception 'Trip is unavailable' using errcode = '22023'; end if;
  update public.bookings set status = 'expired', hold_expires_at = null where trip_id = v_trip.id and status = 'pending' and hold_expires_at <= now();
  select coalesce(sum(seat_count), 0) into v_used from public.bookings where trip_id = v_trip.id and (status = 'confirmed' or (status = 'pending' and hold_expires_at > now()));
  if v_used + p_seat_count > v_trip.seat_capacity then raise exception 'Insufficient seats' using errcode = '22023'; end if;
  v_reference := 'KJ-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.bookings (reference, trip_id, passenger_name, passenger_email, passenger_phone, seat_count, special_requirements, status, hold_expires_at, idempotency_key, amount_kobo)
  values (v_reference, p_trip_id, btrim(p_passenger_name), nullif(btrim(p_passenger_email), ''), btrim(p_passenger_phone), p_seat_count, nullif(btrim(p_special_requirements), ''), 'pending', v_hold, p_idempotency_key, v_trip.fare_kobo * p_seat_count);
  return query select v_reference, 'pending'::public.transport_booking_status, v_hold;
end;
$$;

create or replace function public.expire_unpaid_reservations()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with expired as (
    update public.bookings set status = 'expired', hold_expires_at = null
    where status = 'pending' and hold_expires_at <= now()
    returning id
  ), payment_updates as (
    update public.payments p set status = 'expired', updated_at = now()
    where p.booking_id in (select id from expired) and p.status in ('pending','processing')
    returning p.id
  ) select count(*) into v_count from expired;
  return v_count;
end;
$$;

create or replace function public.create_payment_attempt(
  p_booking_reference text, p_provider_reference text, p_initialization_key uuid
) returns table (provider_reference text, booking_reference text, email text, amount_kobo integer, hold_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings; v_payment public.payments;
begin
  select * into v_payment from public.payments where initialization_key = p_initialization_key;
  if found then
    select b.reference, b.passenger_email, p.amount_kobo, b.hold_expires_at into booking_reference, email, amount_kobo, hold_expires_at
    from public.bookings b join public.payments p on p.booking_id = b.id where p.id = v_payment.id;
    provider_reference := v_payment.provider_reference; return next; return;
  end if;
  select b.* into v_booking from public.bookings b where b.reference = p_booking_reference for update;
  if not found then raise exception 'Booking was not found' using errcode = '22023'; end if;
  if v_booking.status = 'pending' and v_booking.hold_expires_at <= now() then
    update public.bookings set status = 'expired', hold_expires_at = null where id = v_booking.id;
    raise exception 'This reservation has expired' using errcode = '22023';
  end if;
  if v_booking.status <> 'pending' then raise exception 'This booking cannot be paid' using errcode = '22023'; end if;
  if v_booking.passenger_email is null then raise exception 'An email address is required for payment' using errcode = '22023'; end if;
  if v_booking.amount_kobo is null or v_booking.amount_kobo < 100 then raise exception 'This trip has no valid payment amount' using errcode = '22023'; end if;
  select * into v_payment from public.payments where booking_id = v_booking.id and status in ('pending','processing') order by created_at desc limit 1;
  if found then
    provider_reference := v_payment.provider_reference; booking_reference := v_booking.reference; email := v_booking.passenger_email; amount_kobo := v_payment.amount_kobo; hold_expires_at := v_booking.hold_expires_at;
    return next; return;
  end if;
  insert into public.payments (booking_id, provider, provider_reference, initialization_key, amount_kobo, status)
  values (v_booking.id, 'paystack', p_provider_reference, p_initialization_key, v_booking.amount_kobo, 'processing');
  update public.bookings set payment_reference = p_provider_reference where id = v_booking.id;
  provider_reference := p_provider_reference; booking_reference := v_booking.reference; email := v_booking.passenger_email; amount_kobo := v_booking.amount_kobo; hold_expires_at := v_booking.hold_expires_at;
  return next;
end;
$$;

create or replace function public.record_verified_payment(
  p_provider_reference text, p_event_hash text, p_provider_transaction_id text,
  p_gateway_status text, p_gateway_amount_kobo integer, p_gateway_currency text, p_payload jsonb
) returns table (booking_reference text, booking_status public.transport_booking_status, payment_status public.payment_status)
language plpgsql security definer set search_path = '' as $$
declare v_payment public.payments; v_booking public.bookings; v_duplicate boolean; v_event_rows integer;
begin
  insert into private.payment_webhook_events (provider, event_hash, provider_reference, event_type)
  values ('paystack', p_event_hash, p_provider_reference, 'charge.success') on conflict (event_hash) do nothing;
  get diagnostics v_event_rows = row_count;
  v_duplicate := v_event_rows = 0;
  select * into v_payment from public.payments where provider_reference = p_provider_reference for update;
  if not found then raise exception 'Payment reference was not found' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = v_payment.booking_id for update;
  if v_duplicate then booking_reference := v_booking.reference; booking_status := v_booking.status; payment_status := v_payment.status; return next; return; end if;
  -- Verification redirects and provider webhooks may arrive independently.
  -- Once the authoritative state has been recorded, subsequent signed events
  -- must be harmless and must never downgrade a confirmed booking.
  if v_payment.status in ('successful', 'recovery_required', 'refunded') then
    booking_reference := v_booking.reference; booking_status := v_booking.status; payment_status := v_payment.status; return next; return;
  end if;
  if p_gateway_amount_kobo <> v_payment.amount_kobo or p_gateway_currency <> 'NGN' then
    update public.payments set status = 'recovery_required', provider_payload = p_payload, updated_at = now() where id = v_payment.id;
    raise exception 'Payment amount or currency mismatch' using errcode = '22023';
  end if;
  if p_gateway_status <> 'success' then
    update public.payments set status = 'failed', provider_transaction_id = nullif(p_provider_transaction_id, ''), provider_payload = p_payload, verified_at = now(), updated_at = now() where id = v_payment.id;
    booking_reference := v_booking.reference; booking_status := v_booking.status; payment_status := 'failed'; return next; return;
  end if;
  if v_booking.status = 'pending' and v_booking.hold_expires_at > now() then
    update public.payments set status = 'successful', provider_transaction_id = nullif(p_provider_transaction_id, ''), provider_payload = p_payload, verified_at = now(), updated_at = now() where id = v_payment.id;
    update public.bookings set status = 'confirmed', hold_expires_at = null where id = v_booking.id;
    booking_reference := v_booking.reference; booking_status := 'confirmed'; payment_status := 'successful'; return next; return;
  end if;
  if v_booking.status = 'pending' then update public.bookings set status = 'expired', hold_expires_at = null where id = v_booking.id; end if;
  -- A late payment never silently consumes a released seat. Staff must decide
  -- whether to recover an equivalent reservation or issue a refund.
  update public.payments set status = 'recovery_required', provider_transaction_id = nullif(p_provider_transaction_id, ''), provider_payload = p_payload, verified_at = now(), updated_at = now() where id = v_payment.id;
  booking_reference := v_booking.reference; booking_status := v_booking.status; payment_status := 'recovery_required'; return next;
end;
$$;

-- The staging baseline exposes only availability. Recreate the read function
-- with server-calculated price and pickup timing metadata; no passenger data
-- is returned to the browser.
drop function if exists public.list_server_trips();
create function public.list_server_trips()
returns table (
  id uuid, origin text, destination text, departure_at timestamptz,
  vehicle_name text, seat_capacity integer, available_seats integer,
  fare_kobo integer, pickup_time time, estimated_duration_minutes integer,
  estimated_arrival_at timestamptz
)
language sql security definer set search_path = '' as $$
  select t.id, coalesce(p.name, t.origin), t.destination, t.departure_at, v.name,
    t.seat_capacity,
    greatest(0, t.seat_capacity - coalesce(sum(b.seat_count) filter (
      where b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > now())
    ), 0)::integer),
    t.fare_kobo, t.pickup_time, t.estimated_duration_minutes, t.estimated_arrival_at
  from public.trips t join public.vehicles v on v.id = t.vehicle_id
  left join public.pickup_locations p on p.id = t.pickup_location_id
  left join public.bookings b on b.trip_id = t.id
  where t.is_published and t.departure_at > now() and v.is_active
  group by t.id, v.name, p.name
  order by t.departure_at;
$$;

create or replace function public.create_customer_enquiry(
  p_full_name text, p_email text, p_phone text, p_category public.enquiry_category,
  p_subject text, p_message text, p_request_fingerprint text
) returns text language plpgsql security definer set search_path = '' as $$
declare v_reference text;
begin
  if p_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_fingerprint, 1));
  if (select count(*) from private.enquiry_submission_attempts where request_fingerprint = p_request_fingerprint and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many enquiries. Please try again later.' using errcode = '22023';
  end if;
  insert into private.enquiry_submission_attempts (request_fingerprint) values (p_request_fingerprint);
  v_reference := 'KJE-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.customer_enquiries (reference, full_name, email, phone, category, subject, message)
  values (v_reference, btrim(p_full_name), lower(btrim(p_email)), btrim(p_phone), p_category, btrim(p_subject), btrim(p_message));
  return v_reference;
end;
$$;

create or replace function public.record_passenger_event(
  p_booking_id uuid, p_event text, p_actor_id uuid, p_correction_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings;
begin
  if p_event not in ('pickup','dropoff') then raise exception 'Invalid event' using errcode = '22023'; end if;
  select b.* into v_booking from public.bookings b join public.trips t on t.id = b.trip_id where b.id = p_booking_id for update;
  if not found or v_booking.status <> 'confirmed' then raise exception 'Confirmed booking required' using errcode = '22023'; end if;
  if p_event = 'pickup' then
    insert into public.pickup_records (booking_id, marked_by, correction_reason) values (p_booking_id, p_actor_id, nullif(left(p_correction_reason, 1000), ''))
    on conflict (booking_id) do update set actual_pickup_at = now(), marked_by = excluded.marked_by, correction_reason = excluded.correction_reason;
  else
    insert into public.dropoff_records (booking_id, marked_by, correction_reason) values (p_booking_id, p_actor_id, nullif(left(p_correction_reason, 1000), ''))
    on conflict (booking_id) do update set actual_dropoff_at = now(), marked_by = excluded.marked_by, correction_reason = excluded.correction_reason;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_state) values (p_actor_id, p_event || '_recorded', 'booking', p_booking_id, jsonb_build_object('server_time', now()));
end;
$$;

alter table public.user_roles enable row level security;
alter table public.booking_settings enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.drivers enable row level security;
alter table public.booking_passengers enable row level security;
alter table public.payments enable row level security;
alter table private.payment_webhook_events enable row level security;
alter table private.enquiry_submission_attempts enable row level security;
alter table public.customer_enquiries enable row level security;
alter table public.enquiry_responses enable row level security;
alter table public.pickup_records enable row level security;
alter table public.dropoff_records enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.user_roles, public.booking_settings, public.pickup_locations, public.drivers, public.booking_passengers, public.payments, public.customer_enquiries, public.enquiry_responses, public.pickup_records, public.dropoff_records, public.audit_logs from anon, authenticated;
revoke all on table private.payment_webhook_events, private.enquiry_submission_attempts from public;
revoke all on function public.create_payment_attempt(text, text, uuid), public.record_verified_payment(text, text, text, text, integer, text, jsonb), public.create_customer_enquiry(text, text, text, public.enquiry_category, text, text, text), public.expire_unpaid_reservations(), public.record_passenger_event(uuid, text, uuid, text) from public;
grant execute on function public.create_payment_attempt(text, text, uuid), public.record_verified_payment(text, text, text, text, integer, text, jsonb), public.create_customer_enquiry(text, text, text, public.enquiry_category, text, text, text), public.expire_unpaid_reservations(), public.record_passenger_event(uuid, text, uuid, text) to service_role;
grant execute on function private.booking_hold_minutes() to service_role;
revoke all on function public.list_server_trips() from public;
grant execute on function public.list_server_trips() to service_role;

comment on table public.payments is 'Server-managed payment metadata only. Card details are never stored.';
comment on table private.payment_webhook_events is 'HMAC-verified webhook replay protection; never expose to browser roles.';
comment on table public.customer_enquiries is 'Customer support records; server-only access.';
