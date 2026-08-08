create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  subscription_status text not null default 'active',
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);
create index on memberships(organization_id);
create index on memberships(user_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','staff')),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (organization_id, email, status)
);
create index on invitations(token);
create index on invitations(email);

create table work_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  description text not null,
  rate numeric(12,2) not null check (rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index on work_codes(organization_id);

create table workers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  worker_code text not null,
  name text not null,
  father_name text,
  contact_no text,
  designation text,
  address text,
  photo_url text,
  advance_balance numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, worker_code)
);
create index on workers(organization_id);

create table work_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  entry_date date not null,
  work_code_id uuid not null references work_codes(id),
  quantity numeric(12,2) not null check (quantity > 0),
  rate_snapshot numeric(12,2) not null,
  amount numeric(12,2) not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on work_entries(organization_id, worker_id, entry_date);

create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on payments(organization_id, worker_id, payment_date);

create table weekly_slips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  work_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  advance_delta numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  payable_balance numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','finalized')),
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, worker_id, week_start)
);
create index on weekly_slips(organization_id, worker_id);
