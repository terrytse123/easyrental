create table if not exists renewal_mails (
  user_id text not null references app_users (id) on delete cascade,
  tenancy_id text not null,
  lease_end text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, tenancy_id, lease_end)
);
