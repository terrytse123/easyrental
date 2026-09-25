-- Email verification and authenticator MFA. Existing accounts stay verified
-- so the current sign-in keeps working. New accounts are unverified until
-- the emailed code is entered.

alter table app_users add column if not exists email_verified boolean not null default true;
alter table app_users alter column email_verified set default false;
alter table app_users add column if not exists totp_secret text;
alter table app_users add column if not exists mfa_enabled boolean not null default false;

create table if not exists app_email_codes (
  email text not null,
  purpose text not null,
  code_hash text not null,
  salt text not null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (email, purpose)
);

create table if not exists app_mfa_challenges (
  id text primary key,
  user_id text not null references app_users (id) on delete cascade,
  expires_at timestamptz not null
);
