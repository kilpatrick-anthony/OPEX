# OPEX Tracker and Approval System

A lightweight OPEX tracker for a multi-location retail business in Ireland.

## Features

- Next.js App Router frontend
- NextAuth authentication (Google Workspace + credentials)
- Neon Postgres persistence
- Request and approval workflow
- Director-level dashboard and reporting views

## Environment setup

Create `.env.local` from `.env.example` and configure:

- `DATABASE_URL` (Neon Postgres connection string)
- `NEXTAUTH_URL` (local or production app URL)
- `NEXTAUTH_SECRET` (strong random secret)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_ALLOWED_DOMAIN` (for example `oakberry.ie`)

## Local run

1. Install dependencies:

```bash
npm install
```

2. Initialize database schema:

```bash
npm run db:init
```

3. Optional clean reset before a fresh load:

```bash
npm run db:reset
```

4. Seed stores and users:

```bash
npm run db:seed
```

5. Run development server:

```bash
npm run dev
```

## Live deployment (Vercel)

1. Import this repository into Vercel.
2. Add all required environment variables in the Vercel project.
3. Set `NEXTAUTH_URL` to your production domain.
4. In Google Cloud OAuth settings, add redirect URI:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

5. Deploy and test sign-in, request submission, and approval actions.

## Data operations

- `npm run db:init`: creates required tables.
- `npm run db:reset`: truncates users, stores, requests, approvals.
- `npm run db:seed`: inserts baseline stores and user accounts.

Seeded credential users are created with default password `ChangeMe123!`.
Rotate these passwords immediately after first login.

## Seeded login accounts

After `npm run db:seed`, use `/login` and sign in with:

- Directors:
	- `anthony.kilpatrick@oakberry.ie`
	- `alvin.galligan@oakberry.ie`
	- `nick.twomey@oakberry.ie`
	- `cian.odonoghue@oakberry.ie`
- Field team: first-name.last-name pattern, for example `emma.barrett@oakberry.ie`
- Store managers: `manager.<store-slug>@oakberry.ie`
	- Example: `manager.anne-street@oakberry.ie`
	- Example: `manager.swords-pavilions@oakberry.ie`

## Notes

- Google users are restricted by `GOOGLE_ALLOWED_DOMAIN`.
- If a Google user does not exist yet, the app auto-creates them as an employee.
- New requests are created with `pending` status.
