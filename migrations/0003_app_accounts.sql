-- Email accounts for 香港租租. Lives in the same Postgres as the ledger
-- (Supabase when DATABASE_URL points there, otherwise the preview database).

create table if not exists app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_sessions (
  token text primary key,
  user_id text not null references app_users (id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists app_sessions_user_id_idx on app_sessions (user_id);
