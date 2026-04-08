# OPEX Tracker and Approval System

A lightweight OPEX tracker for a multi-location retail business in Ireland.

## Features

- Location management
- Expense recording by store location
- Approval workflow with pending / approved / rejected states
- Approval summary dashboard
- Simple web UI and SQLite persistence

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the Next.js app:

```bash
npm run dev
```

3. Open `http://localhost:3000` in your browser.

## Authentication

This app now supports Google Workspace login for your company email accounts.

Create a `.env.local` file from `.env.example` and add your Google OAuth credentials:

- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET=` a secure random string
- `GOOGLE_CLIENT_ID=` your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET=` your Google OAuth client secret
- `GOOGLE_ALLOWED_DOMAIN=oakberry.ie`

If a signed-in Google user does not exist in the database yet, they will be created automatically as an `employee` role. Pre-create `manager` and `director` accounts if you want those roles to be mapped in advance.

## Project structure

- `app/` - Next.js UI pages and API routes
- `components/` - reusable UI and navigation components
- `lib/` - database, auth, and utility helpers
- `package.json` - build/runtime configuration
- `opex.db` - SQLite data storage

## Notes

- New expenses are created with `pending` status.
- Approve or reject expenses from the expenses table.
- The summary section shows current counts by status.
