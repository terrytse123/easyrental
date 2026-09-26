create table if not exists lease_files (
  id text primary key,
  user_id text not null references app_users (id) on delete cascade,
  tenancy_id text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  payload text not null
);

create index if not exists lease_files_owner on lease_files (user_id, tenancy_id);
