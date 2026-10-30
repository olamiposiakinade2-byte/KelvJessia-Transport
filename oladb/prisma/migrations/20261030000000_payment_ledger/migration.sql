-- OlaDB transport payment ledger. Apply only after the Phase 1 Prisma schema
-- exists in a private PostgreSQL database. This is standard PostgreSQL; it has
-- no Supabase extensions, roles, RLS policies, REST functions, or Auth tables.

do $$ begin
  create type "PaymentStatus" as enum ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'EXPIRED', 'REFUNDED', 'RECOVERY_REQUIRED');
exception when duplicate_object then null; end $$;

alter type "BookingStatus" add value if not exists 'EXPIRED';

alter table "Booking"
  add column if not exists "holdExpiresAt" timestamp(3),
  add column if not exists "idempotencyKey" text,
  add column if not exists "amountKobo" integer,
  add column if not exists "paymentReference" text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'Booking_amountKobo_nonnegative') then
    alter table "Booking" add constraint "Booking_amountKobo_nonnegative" check ("amountKobo" is null or "amountKobo" >= 0);
  end if;
end $$;

create unique index if not exists "Booking_idempotencyKey_key" on "Booking" ("idempotencyKey") where "idempotencyKey" is not null;
create unique index if not exists "Booking_paymentReference_key" on "Booking" ("paymentReference") where "paymentReference" is not null;
create index if not exists "Booking_tripId_holdExpiresAt_idx" on "Booking" ("tripId", "holdExpiresAt");

alter table "Trip" add column if not exists "fareKobo" integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'Trip_fareKobo_nonnegative') then
    alter table "Trip" add constraint "Trip_fareKobo_nonnegative" check ("fareKobo" is null or "fareKobo" >= 0);
  end if;
end $$;

create table if not exists "Payment" (
  "id" text primary key,
  "projectId" text not null references "Project"("id") on delete cascade,
  "bookingId" text not null references "Booking"("id") on delete restrict,
  "provider" text not null default 'paystack' check ("provider" = 'paystack'),
  "providerReference" text not null unique,
  "initializationKey" text not null unique,
  "amountKobo" integer not null check ("amountKobo" >= 0),
  "currency" char(3) not null default 'NGN' check ("currency" = 'NGN'),
  "status" "PaymentStatus" not null default 'PENDING',
  "providerTransactionId" text unique,
  "providerPayload" jsonb,
  "verifiedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create unique index if not exists "Payment_one_active_attempt_per_booking" on "Payment" ("bookingId") where "status" in ('PENDING', 'PROCESSING');
create index if not exists "Payment_project_status_created_idx" on "Payment" ("projectId", "status", "createdAt" desc);
create index if not exists "Payment_booking_created_idx" on "Payment" ("bookingId", "createdAt" desc);

create table if not exists "PaymentWebhookEvent" (
  "id" text primary key,
  "provider" text not null check ("provider" = 'paystack'),
  "eventHash" text not null unique,
  "providerReference" text,
  "eventType" text not null,
  "receivedAt" timestamp(3) not null default current_timestamp
);
create index if not exists "PaymentWebhookEvent_reference_received_idx" on "PaymentWebhookEvent" ("providerReference", "receivedAt" desc);
