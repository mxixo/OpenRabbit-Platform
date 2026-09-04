create table if not exists public.execution_telemetry (
  tenant_id text not null,
  execution_id text not null,
  attempt integer not null check (attempt >= 1),
  workflow_id text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  agent_id text,
  provider text,
  model text,
  started_at timestamptz not null,
  completed_at timestamptz,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  tool_calls bigint not null default 0 check (tool_calls >= 0),
  image_generations bigint not null default 0 check (image_generations >= 0),
  video_seconds numeric not null default 0 check (video_seconds >= 0),
  model_usd numeric(18,8) not null default 0 check (model_usd >= 0),
  external_api_usd numeric(18,8) not null default 0 check (external_api_usd >= 0),
  compute_usd numeric(18,8) not null default 0 check (compute_usd >= 0),
  total_usd numeric(18,8) generated always as (model_usd + external_api_usd + compute_usd) stored,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, execution_id, attempt),
  check (completed_at is null or completed_at >= started_at)
);

create index if not exists execution_telemetry_workflow_created_idx
  on public.execution_telemetry (tenant_id, workflow_id, created_at desc);
create index if not exists execution_telemetry_status_created_idx
  on public.execution_telemetry (tenant_id, status, created_at desc);

alter table public.execution_telemetry enable row level security;
revoke all on public.execution_telemetry from anon, authenticated;

comment on table public.execution_telemetry is
  'Server-only, tenant-scoped execution attempt telemetry for OpenRabbit workflows and agents.';
comment on column public.execution_telemetry.total_usd is
  'Database-computed variable execution cost; excludes subscription allocation and margin.';
