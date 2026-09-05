-- Payment methods and receiving accounts assigned to each master/sub-merchant.
create table if not exists public.merchant_payment_setup (
  id uuid primary key default gen_random_uuid(),
  master_merchant text not null,
  sub_merchant text not null,
  payment_method text not null,
  account_number text not null,
  account_name text,
  provider text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (master_merchant, sub_merchant, payment_method, account_number)
);

create index if not exists merchant_payment_setup_lookup_idx
  on public.merchant_payment_setup (master_merchant, sub_merchant, active);

alter table public.merchant_payment_setup enable row level security;

drop policy if exists merchant_payment_setup_staff_select on public.merchant_payment_setup;
create policy merchant_payment_setup_staff_select
  on public.merchant_payment_setup for select
  to authenticated
  using ((select public.is_staff()));

drop policy if exists merchant_payment_setup_staff_insert on public.merchant_payment_setup;
create policy merchant_payment_setup_staff_insert
  on public.merchant_payment_setup for insert
  to authenticated
  with check ((select public.is_staff()));

drop policy if exists merchant_payment_setup_staff_update on public.merchant_payment_setup;
create policy merchant_payment_setup_staff_update
  on public.merchant_payment_setup for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

grant select, insert, update on public.merchant_payment_setup to authenticated;
revoke all on public.merchant_payment_setup from anon;
