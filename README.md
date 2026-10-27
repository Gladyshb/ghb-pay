# GHB Pay

GHB Pay is a React/Vite application backed by Supabase Auth, Postgres, Storage, and Edge Functions.

## Local setup

1. Install Node.js and the Supabase CLI.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and set the project URL and public anon key.
4. Apply the database migration with `supabase db push`.
5. Deploy the Edge Functions with `supabase functions deploy sync-binance-rates` and `supabase functions deploy admin-users`.
6. Run the frontend with `npm run dev`.

The application requires these Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Set the same values in the Vercel project environment. Never expose a Supabase service-role key through a `VITE_` variable.

## Progressive Web App

The production frontend serves `public/manifest.webmanifest`, its install icons, and `public/sw.js`. The service worker provides an offline navigation message only; it does not cache authenticated pages, Supabase responses, or user data. Serve the app over HTTPS for browser installation. After deployment, open the site in Chrome on Android and use Chrome's **Install app** option when it becomes available; iOS uses **Add to Home Screen** in Safari.

## Supabase configuration

Enable email/password and Google providers in Supabase Auth. Set the site URL and redirect allow-list to include the local Vite URL and the deployed Vercel URL. The migrations create the `profiles` table and its Auth trigger, application tables, RLS policies, private file bucket, and the RPC functions used for referral and wallet operations. The multi-currency migration preserves each existing wallet balance as USD and creates separate currency balances for new deposits and transfers. The incremental private-file migration repairs a missing bucket and reapplies its owner/admin storage policies.

The initial administrator must be promoted directly in the Supabase SQL editor by setting `profiles.role` to `admin` for the intended user ID. Do not allow users to set their own role.

Both Edge Functions use Supabase's `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment values. `admin-users` verifies the caller's admin role before changing passwords, account access, account data, or creating an impersonation link. The service-role key must remain a server-side function secret and must never be exposed to the frontend. Admins can invoke `sync-binance-rates` from the currency screen. To run it on a schedule, configure a scheduled Edge Function invocation and set a non-empty `SCHEDULER_SECRET` plus the matching `x-scheduler-secret` request header.

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run build` creates the production frontend bundle.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs the configured TypeScript checks.
