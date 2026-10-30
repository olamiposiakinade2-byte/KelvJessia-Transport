-- KelvJessia Transport production booking schema.
--
-- Apply only to an isolated Supabase staging branch first. This migration
-- deliberately contains no sample trips and does not enable public intake.
-- Configure the Vercel environment gate before enabling a staging test.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.transport_booking_status as enum (
  'pending', 'confirmed', 'cancelled', 'completed', 'expired'
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  registration_reference text unique,
  capacity integer not null check (capacity between 1 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  origin text not null check (char_length(origin) between 2 and 160),
  destination text not null check (char_length(destination) between 2 and 160),
  departure_at timestamptz not null,
  seat_capacity integer not null check (seat_capacity between 1 and 200),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> destination)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^KJ-[0-9]{4}-[A-Z0-9]{10}$'),
  trip_id uuid not null references public.trips(id) on delete restrict,
  passenger_name text not null check (char_length(passenger_name) between 2 and 120),
  passenger_email text check (passenger_email is null or char_length(passenger_email) <= 254),
  passenger_phone text not null check (char_length(passenger_phone) between 7 and 30),
  seat_count integer not null check (seat_count between 1 and 20),
  special_requirements text check (special_requirements is null or char_length(special_requirements) <= 1000),
  status public.transport_booking_status not null default 'pending',
  hold_expires_at timestamptz,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending' and hold_expires_at is not null) or status <> 'pending')
);

create table public.booking_status_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  old_status public.transport_booking_status,
  new_status public.transport_booking_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

-- IP addresses are never stored; the API supplies a server-side salted hash.
create table private.booking_submission_attempts (
  id bigint generated always as identity primary key,
  request_fingerprint text not null check (char_length(request_fingerprint) = 64),
  created_at timestamptz not null default now()
);

create index trips_public_departure_idx on public.trips (departure_at) where is_published;
create index bookings_trip_active_idx on public.bookings (trip_id, status, hold_expires_at);
create index bookings_created_at_idx on public.bookings (created_at desc);
create index booking_history_booking_created_idx on public.booking_status_history (booking_id, created_at desc);
create index booking_attempts_fingerprint_created_idx on private.booking_submission_attempts (request_fingerprint, created_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vehicles_touch_updated_at before update on public.vehicles
for each row execute function private.touch_updated_at();
create trigger trips_touch_updated_at before update on public.trips
for each row execute function private.touch_updated_at();
create trigger bookings_touch_updated_at before update on public.bookings
for each row execute function private.touch_updated_at();

create or replace function private.record_booking_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_note text;
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (booking_id, old_status, new_status, note)
    values (new.id, null, new.status, 'Booking created');
  elsif old.status is distinct from new.status then
    v_actor := nullif(current_setting('app.kj_actor_id', true), '')::uuid;
    v_note := nullif(current_setting('app.kj_status_note', true), '');
    insert into public.booking_status_history (booking_id, old_status, new_status, changed_by, note)
    values (new.id, old.status, new.status, v_actor, v_note);
  end if;
  return new;
end;
$$;

create trigger bookings_record_status_history after insert or update of status on public.bookings
for each row execute function private.record_booking_status_change();

-- This is the only reservation entrypoint. It locks the relevant trip row so
-- two requests cannot consume the same final seat. Pending holds expire after
-- 15 minutes and are excluded from later capacity checks once expired.
create or replace function public.create_server_booking(
  p_trip_id uuid,
  p_passenger_name text,
  p_passenger_email text,
  p_passenger_phone text,
  p_seat_count integer,
  p_special_requirements text,
  p_idempotency_key uuid,
  p_request_fingerprint text
) returns table (reference text, status public.transport_booking_status, hold_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
  v_existing public.bookings;
  v_used integer;
  v_reference text;
  v_hold timestamptz := now() + interval '15 minutes';
begin
  if p_seat_count is null or p_seat_count < 1 or p_seat_count > 20 then
    raise exception 'Invalid seat count' using errcode = '22023';
  end if;
  if p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid request fingerprint' using errcode = '22023';
  end if;

  select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.reference, v_existing.status, v_existing.hold_expires_at;
    return;
  end if;

  -- Serialise checks per anonymous request fingerprint for a durable rate limit.
  perform pg_advisory_xact_lock(hashtextextended(p_request_fingerprint, 0));
  if (select count(*) from private.booking_submission_attempts
      where request_fingerprint = p_request_fingerprint
        and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many booking attempts. Please try again later.' using errcode = '22023';
  end if;

  -- Re-check after the request-fingerprint lock: this makes an interrupted
  -- client retry idempotent without allowing two inserts for the same key.
  select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.reference, v_existing.status, v_existing.hold_expires_at;
    return;
  end if;

  insert into private.booking_submission_attempts (request_fingerprint) values (p_request_fingerprint);

  select * into v_trip from public.trips
  where id = p_trip_id and is_published and departure_at > now()
  for update;
  if not found then
    raise exception 'Trip is unavailable' using errcode = '22023';
  end if;

  update public.bookings
    set status = 'expired', hold_expires_at = null
    where trip_id = v_trip.id and status = 'pending' and hold_expires_at <= now();

  select coalesce(sum(seat_count), 0) into v_used
  from public.bookings
  where trip_id = v_trip.id
    and (status = 'confirmed' or (status = 'pending' and hold_expires_at > now()));
  if v_used + p_seat_count > v_trip.seat_capacity then
    raise exception 'Insufficient seats' using errcode = '22023';
  end if;

  v_reference := 'KJ-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.bookings (
    reference, trip_id, passenger_name, passenger_email, passenger_phone,
    seat_count, special_requirements, status, hold_expires_at, idempotency_key
  ) values (
    v_reference, p_trip_id, btrim(p_passenger_name), nullif(btrim(p_passenger_email), ''),
    btrim(p_passenger_phone), p_seat_count, nullif(btrim(p_special_requirements), ''),
    'pending', v_hold, p_idempotency_key
  );
  return query select v_reference, 'pending'::public.transport_booking_status, v_hold;
end;
$$;

create or replace function public.list_server_trips()
returns table (
  id uuid, origin text, destination text, departure_at timestamptz,
  vehicle_name text, seat_capacity integer, available_seats integer
)
language sql security definer set search_path = '' as $$
  select t.id, t.origin, t.destination, t.departure_at, v.name, t.seat_capacity,
    greatest(0, t.seat_capacity - coalesce(sum(b.seat_count) filter (
      where b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > now())
    ), 0)::integer) as available_seats
  from public.trips t join public.vehicles v on v.id = t.vehicle_id
  left join public.bookings b on b.trip_id = t.id
  where t.is_published and t.departure_at > now() and v.is_active
  group by t.id, v.name
  order by t.departure_at;
$$;

create or replace function public.admin_update_server_booking(
  p_booking_id uuid,
  p_new_status public.transport_booking_status,
  p_actor_id uuid,
  p_note text default null
) returns table (reference text, status public.transport_booking_status)
language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = '22023'; end if;
  if not (
    (v_booking.status = 'pending' and p_new_status in ('confirmed', 'cancelled', 'expired')) or
    (v_booking.status = 'confirmed' and p_new_status in ('cancelled', 'completed'))
  ) then raise exception 'Invalid booking status transition' using errcode = '22023'; end if;
  perform set_config('app.kj_actor_id', p_actor_id::text, true);
  perform set_config('app.kj_status_note', coalesce(left(p_note, 1000), ''), true);
  update public.bookings set status = p_new_status,
    hold_expires_at = case when p_new_status = 'pending' then hold_expires_at else null end
  where id = p_booking_id;
  return query select v_booking.reference, p_new_status;
end;
$$;

alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table private.booking_submission_attempts enable row level security;

-- No browser role can query passenger records, attempts, or history. The API
-- authenticates company admins server-side and uses the service role.
revoke all on table public.vehicles, public.trips, public.bookings, public.booking_status_history from anon, authenticated;
revoke all on table private.booking_submission_attempts from public;
revoke all on function public.create_server_booking(uuid, text, text, text, integer, text, uuid, text) from public;
revoke all on function public.list_server_trips() from public;
revoke all on function public.admin_update_server_booking(uuid, public.transport_booking_status, uuid, text) from public;
grant execute on function public.create_server_booking(uuid, text, text, text, integer, text, uuid, text) to service_role;
grant execute on function public.list_server_trips() to service_role;
grant execute on function public.admin_update_server_booking(uuid, public.transport_booking_status, uuid, text) to service_role;
revoke all on all functions in schema private from public;

comment on table public.bookings is 'Passenger data. Server-only access; never expose through public Data API queries.';
comment on table private.booking_submission_attempts is 'Salted request-fingerprint rate-limit data; no raw IP addresses.';
