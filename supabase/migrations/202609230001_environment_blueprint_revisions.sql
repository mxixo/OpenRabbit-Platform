create schema if not exists private;

create table if not exists public.environment_blueprint_revisions (
  append_seq bigint generated always as identity,
  protocol text not null default 'environment_blueprint_revision_v1'
    check (protocol = 'environment_blueprint_revision_v1'),
  org_id text not null check (length(btrim(org_id)) > 0),
  revision text not null check (length(btrim(revision)) > 0),
  generated_at timestamptz not null,
  blueprint jsonb not null,
  previous_record_hash text,
  record_hash text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, revision),
  unique (org_id, record_hash),
  check (record_hash ~ '^[0-9a-f]{64}$'),
  check (previous_record_hash is null or previous_record_hash ~ '^[0-9a-f]{64}$'),
  check (blueprint ->> 'protocol' = 'environment_blueprint_v1'),
  check (blueprint ->> 'orgId' = org_id),
  check (blueprint ->> 'revision' = revision),
  check ((blueprint ->> 'generatedAt')::timestamptz = generated_at),
  foreign key (org_id, previous_record_hash)
    references public.environment_blueprint_revisions (org_id, record_hash)
    on update restrict
    on delete restrict
);

create unique index if not exists environment_blueprint_revisions_append_seq_idx
  on public.environment_blueprint_revisions (append_seq);
create index if not exists environment_blueprint_revisions_org_latest_idx
  on public.environment_blueprint_revisions (org_id, append_seq desc);

create or replace function private.enforce_environment_blueprint_revision_append()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  latest public.environment_blueprint_revisions%rowtype;
begin
  -- Serialize appends per org so two concurrent writers cannot both claim the
  -- same predecessor. hashtextextended yields a stable bigint advisory-lock key.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.org_id, 0));

  select *
    into latest
    from public.environment_blueprint_revisions
   where org_id = new.org_id
   order by append_seq desc
   limit 1
   for update;

  if latest.org_id is null then
    if new.previous_record_hash is not null then
      raise exception 'first environment blueprint revision cannot reference a predecessor';
    end if;
  else
    if new.previous_record_hash is distinct from latest.record_hash then
      raise exception 'environment blueprint revision predecessor does not match latest record';
    end if;
    if new.generated_at < latest.generated_at then
      raise exception 'environment blueprint revision generated_at cannot move backward';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.reject_environment_blueprint_revision_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'environment blueprint revisions are append-only';
end;
$$;

revoke all on function private.enforce_environment_blueprint_revision_append() from public, anon, authenticated;
revoke all on function private.reject_environment_blueprint_revision_mutation() from public, anon, authenticated;
grant execute on function private.enforce_environment_blueprint_revision_append() to service_role;
grant execute on function private.reject_environment_blueprint_revision_mutation() to service_role;

-- Recreate only these named triggers so this migration is idempotent without
-- altering unrelated table triggers.
drop trigger if exists environment_blueprint_revision_append_guard on public.environment_blueprint_revisions;
create trigger environment_blueprint_revision_append_guard
before insert on public.environment_blueprint_revisions
for each row execute function private.enforce_environment_blueprint_revision_append();

drop trigger if exists environment_blueprint_revision_update_guard on public.environment_blueprint_revisions;
create trigger environment_blueprint_revision_update_guard
before update or delete on public.environment_blueprint_revisions
for each row execute function private.reject_environment_blueprint_revision_mutation();

drop trigger if exists environment_blueprint_revision_truncate_guard on public.environment_blueprint_revisions;
create trigger environment_blueprint_revision_truncate_guard
before truncate on public.environment_blueprint_revisions
for each statement execute function private.reject_environment_blueprint_revision_mutation();

alter table public.environment_blueprint_revisions enable row level security;

-- This is server-only state. No direct client role can read or mutate it.
-- The service role receives append/read only; update/delete remain denied even
-- before the database-level append-only triggers are considered.
revoke all on public.environment_blueprint_revisions from anon, authenticated, service_role;
grant select, insert on public.environment_blueprint_revisions to service_role;

revoke all on sequence public.environment_blueprint_revisions_append_seq_seq from anon, authenticated, service_role;
grant usage, select on sequence public.environment_blueprint_revisions_append_seq_seq to service_role;

comment on table public.environment_blueprint_revisions is
  'Server-only append-only org-scoped Environment Blueprint revision chain.';
comment on column public.environment_blueprint_revisions.record_hash is
  'Domain-separated SHA-256 record hash produced by @openrabbit/runtime-core.';
comment on column public.environment_blueprint_revisions.previous_record_hash is
  'Exact predecessor record_hash for the same org; enforced against the latest append under an advisory lock.';
