create table if not exists public.real_estate_deals (
  org_id text not null,
  id text not null,
  address text not null,
  property_type text not null default 'commercial',
  status text not null default 'screening' check (status in ('screening', 'diligence', 'approved', 'rejected', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.real_estate_underwriting_runs (
  id bigint generated always as identity primary key,
  org_id text not null,
  deal_id text not null,
  task_id text not null,
  version integer not null check (version > 0),
  input jsonb not null,
  report jsonb not null,
  status text not null check (status in ('completed', 'failed')),
  created_at timestamptz not null default now(),
  foreign key (org_id, deal_id) references public.real_estate_deals (org_id, id) on delete restrict,
  unique (org_id, task_id),
  unique (org_id, deal_id, version)
);

create table if not exists public.real_estate_task_results (
  org_id text not null,
  task_id text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (org_id, task_id)
);

create table if not exists public.real_estate_approval_requests (
  org_id text not null,
  id text not null,
  worker_id text not null,
  task_id text not null,
  task_type text not null,
  input jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  policy_id text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (org_id, id),
  unique (org_id, task_id),
  check ((status = 'pending' and decided_at is null and decided_by is null) or
         (status in ('approved', 'denied') and decided_at is not null and decided_by is not null))
);

create table if not exists public.real_estate_audit_records (
  org_id text not null,
  id text not null,
  kind text not null check (kind in ('task_requested', 'task_blocked', 'task_completed', 'task_failed', 'task_cancelled', 'approval_requested', 'approval_approved', 'approval_denied')),
  timestamp timestamptz not null default now(),
  actor_id text,
  worker_id text,
  task_id text,
  approval_id text,
  action text,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (org_id, id)
);

create index if not exists real_estate_runs_deal_created_idx
  on public.real_estate_underwriting_runs (org_id, deal_id, created_at desc);
create index if not exists real_estate_approvals_status_requested_idx
  on public.real_estate_approval_requests (org_id, status, requested_at);
create index if not exists real_estate_audit_org_timestamp_idx
  on public.real_estate_audit_records (org_id, timestamp);

alter table public.real_estate_deals enable row level security;
alter table public.real_estate_underwriting_runs enable row level security;
alter table public.real_estate_task_results enable row level security;
alter table public.real_estate_approval_requests enable row level security;
alter table public.real_estate_audit_records enable row level security;

revoke all on public.real_estate_deals from anon, authenticated;
revoke all on public.real_estate_underwriting_runs from anon, authenticated;
revoke all on public.real_estate_task_results from anon, authenticated;
revoke all on public.real_estate_approval_requests from anon, authenticated;
revoke all on public.real_estate_audit_records from anon, authenticated;

comment on table public.real_estate_deals is 'Server-only tenant-scoped real-estate deal records.';
comment on table public.real_estate_underwriting_runs is 'Immutable version history for completed underwriting reports.';
comment on table public.real_estate_task_results is 'Idempotency records for real-estate worker tasks.';
comment on table public.real_estate_approval_requests is 'Durable approval requests using canonical OpenRabbit approval semantics.';
comment on table public.real_estate_audit_records is 'Append-only audit records for the real-estate vertical slice.';
