create schema if not exists private;

create table if not exists public.action_receipt_records (
  append_seq bigint generated always as identity,
  protocol text not null default 'action_receipt_record_v1'
    check (protocol = 'action_receipt_record_v1'),
  org_id text not null check (length(btrim(org_id)) > 0),
  receipt_id text not null check (length(btrim(receipt_id)) > 0),
  created_at timestamptz not null,
  receipt jsonb not null,
  previous_receipt_hash text,
  receipt_hash text not null,
  persisted_at timestamptz not null default now(),
  primary key (org_id, receipt_id),
  unique (org_id, receipt_hash),
  check (receipt_hash ~ '^[0-9a-f]{64}$'),
  check (previous_receipt_hash is null or previous_receipt_hash ~ '^[0-9a-f]{64}$'),
  check (receipt ->> 'id' = receipt_id),
  check (receipt ->> 'orgId' = org_id),
  check ((receipt ->> 'createdAt')::timestamptz = created_at),
  foreign key (org_id, previous_receipt_hash)
    references public.action_receipt_records (org_id, receipt_hash)
    on update restrict
    on delete restrict
);

create unique index if not exists action_receipt_records_append_seq_idx
  on public.action_receipt_records (append_seq);
create index if not exists action_receipt_records_org_latest_idx
  on public.action_receipt_records (org_id, append_seq desc);
create index if not exists action_receipt_records_org_task_idx
  on public.action_receipt_records (org_id, ((receipt ->> 'taskId')), append_seq desc);

create or replace function private.enforce_action_receipt_append()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  latest public.action_receipt_records%rowtype;
begin
  -- Serialize append decisions per organization so two writers cannot both
  -- claim the same predecessor. A racing writer must re-read and re-seal.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('action_receipt:' || new.org_id, 0));

  select *
    into latest
    from public.action_receipt_records
   where org_id = new.org_id
   order by append_seq desc
   limit 1
   for update;

  if latest.org_id is null then
    if new.previous_receipt_hash is not null then
      raise exception 'first action receipt cannot reference a predecessor';
    end if;
  else
    if new.previous_receipt_hash is distinct from latest.receipt_hash then
      raise exception 'action receipt predecessor does not match latest record';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.reject_action_receipt_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'action receipt records are append-only';
end;
$$;

revoke all on function private.enforce_action_receipt_append() from public, anon, authenticated;
revoke all on function private.reject_action_receipt_mutation() from public, anon, authenticated;
grant execute on function private.enforce_action_receipt_append() to service_role;
grant execute on function private.reject_action_receipt_mutation() to service_role;

drop trigger if exists action_receipt_append_guard on public.action_receipt_records;
create trigger action_receipt_append_guard
before insert on public.action_receipt_records
for each row execute function private.enforce_action_receipt_append();

drop trigger if exists action_receipt_update_guard on public.action_receipt_records;
create trigger action_receipt_update_guard
before update or delete on public.action_receipt_records
for each row execute function private.reject_action_receipt_mutation();

drop trigger if exists action_receipt_truncate_guard on public.action_receipt_records;
create trigger action_receipt_truncate_guard
before truncate on public.action_receipt_records
for each statement execute function private.reject_action_receipt_mutation();

alter table public.action_receipt_records enable row level security;

-- Receipts are control-plane evidence. Browser/mobile clients never receive
-- direct table authority. The server role can append/read, but cannot mutate.
revoke all on public.action_receipt_records from anon, authenticated, service_role;
grant select, insert on public.action_receipt_records to service_role;

revoke all on sequence public.action_receipt_records_append_seq_seq from anon, authenticated, service_role;
grant usage, select on sequence public.action_receipt_records_append_seq_seq to service_role;

comment on table public.action_receipt_records is
  'Server-only append-only org-scoped Action Receipt hash chain.';
comment on column public.action_receipt_records.receipt_hash is
  'Domain-separated SHA-256 Action Receipt hash produced by @openrabbit/runtime-core.';
comment on column public.action_receipt_records.previous_receipt_hash is
  'Exact predecessor receipt_hash for the same org; enforced against latest append under an advisory lock.';
