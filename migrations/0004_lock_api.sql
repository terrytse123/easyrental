-- The app connects as the database owner, which bypasses row level security.
-- Supabase's public Data API (anon / authenticated) must not read accounts,
-- session tokens, or ledgers.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table if exists public.app_users enable row level security;
alter table if exists public.app_sessions enable row level security;
alter table if exists public.ledgers enable row level security;
alter table if exists public.account enable row level security;
alter table if exists public.session enable row level security;
alter table if exists public."user" enable row level security;
alter table if exists public.verification enable row level security;
alter table if exists public._migrations enable row level security;
