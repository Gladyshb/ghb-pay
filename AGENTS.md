# AGENTS.md

## Project context

GHB Pay is a React/Vite application backed by Supabase. Read `README.md` for local setup and deployment requirements.

## Key files

- `src/`: frontend application.
- `src/lib/supabase.js`: central browser Supabase client.
- `src/lib/supabaseData.js`: shared Postgres query helpers.
- `supabase/migrations/`: schema, RLS policies, and database functions.
- `supabase/functions/`: Supabase Edge Functions.
- `.env.local`: local-only public Supabase URL and anon key; never commit secrets.

Use the existing project patterns and run relevant `package.json` checks before finishing code changes. Never expose a Supabase service-role key in frontend code or a `VITE_` variable.
