-- The app connects as the database owner, which bypasses row level security.
-- Supabase's public Data API (anon / authenticated) must not read accounts,
-- session tokens, or ledgers. Those roles exist only on Supabase, not on the
-- local preview database, so skip the revoke when the role is absent.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end $$;

alter table if exists public.app_users enable row level security;
alter table if exists public.app_sessions enable row level security;
alter table if exists public.ledgers enable row level security;
alter table if exists public.account enable row level security;
alter table if exists public.session enable row level security;
alter table if exists public."user" enable row level security;
alter table if exists public.verification enable row level security;
alter table if exists public._migrations enable row level security;
