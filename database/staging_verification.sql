-- Read-only post-migration checks for the isolated KelvJessia staging database.
-- Run only after 002_production_booking_schema.sql and
-- 003_booking_payments_operations.sql have completed successfully.
-- This script intentionally selects metadata only: it never reads passengers
-- and never changes application data.

begin read only;

select extname = 'pgcrypto' as pgcrypto_available
from pg_extension
where extname = 'pgcrypto';

select required_table,
       to_regclass(required_table) is not null as exists
from (values
  ('public.vehicles'), ('public.trips'), ('public.bookings'),
  ('public.booking_status_history'), ('public.payments'),
  ('public.customer_enquiries'), ('public.user_roles'),
  ('public.drivers'), ('public.pickup_records'), ('public.dropoff_records'),
  ('private.payment_webhook_events')
) as expected(required_table)
order by required_table;

select n.nspname || '.' || c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relname in (
    'vehicles', 'trips', 'bookings', 'booking_status_history', 'payments',
    'customer_enquiries', 'user_roles', 'drivers', 'pickup_records',
    'dropoff_records', 'payment_webhook_events'
  )
order by table_name;

select role_name,
       has_table_privilege(role_name, 'public.bookings', 'select') as can_read_bookings,
       has_table_privilege(role_name, 'public.payments', 'select') as can_read_payments,
       has_table_privilege(role_name, 'public.customer_enquiries', 'select') as can_read_enquiries
from (values ('anon'), ('authenticated')) as roles(role_name);

select function_name,
       coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%' as has_pinned_search_path,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral (values (n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')) f(function_name)
where n.nspname in ('public', 'private')
  and p.proname in (
    'create_server_booking', 'create_payment_attempt', 'record_verified_payment',
    'expire_unpaid_reservations', 'create_customer_enquiry',
    'record_passenger_event', 'list_server_trips', 'booking_hold_minutes'
  )
order by function_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'bookings_trip_active_idx', 'payments_one_active_attempt_per_booking_idx',
    'trips_driver_departure_idx'
  )
order by indexname;

rollback;
