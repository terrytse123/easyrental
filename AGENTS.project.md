# EasyRentalHK — product truth for agents

Platform sandbox contract stays in `AGENTS.md` (Grok App Builder). **Product and deploy truth is this file.**

## Intent

Hong Kong landlord ledger (繁中 primary): properties, tenancies, rent collection, repairs, lease/stamp/deposit files, bilingual UI, desk. Not legal advice.

## Data

- Cloud ledger: Postgres/Supabase via server `DATABASE_URL` (not browser-only).
- Supabase anon Data API locked; app uses server DB connection.
- Multi-device: optimistic `updated_at`; conflict → user must reload.
- `/guide` JSON export/import = secondary backup only.

## Auth & mail

- Email register + OTP verify/reset; optional TOTP MFA; session cookie.
- Mail: `RESEND_API_KEY` (+ optional `MAIL_FROM`) or SMTP_* fallback.
- Renewal cron: `GET/POST /api/renewal` with `CRON_SECRET` (Vercel cron daily). Only renewal reminders (~90 days before lease end)—not overdue rent or stamp-duty alerts.

## Live

https://easyrentalhk.vercel.app — repo: https://github.com/terrytse123/easyrental

## Deploy checklist (Vercel + Supabase)

1. Supabase project (prefer Singapore pooler URI) → set `DATABASE_URL` on Vercel.
2. Run SQL in `migrations/` against that DB.
3. Set `BETTER_AUTH_SECRET` (long random), `CRON_SECRET`, and mail (`RESEND_API_KEY` or SMTP_*).
4. Deploy to Vercel; confirm cron in `vercel.json` hits `/api/renewal`.
5. Smoke: register → verify email → create property/tenancy → save ledger → second tab conflict/reload.
6. Optional Android: keep one APK under `public/` (currently `EasyRentalHK-122.apk`) or publish via GitHub Releases; update `vercel.json` headers + home download link together.

Do not commit real secrets. Do not unlock Supabase anon for ledger tables.
