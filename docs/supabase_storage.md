# Supabase JSON Storage

The app can persist its mutable JSON stores to Supabase through the server only.

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `SUPABASE_JSON_TABLE` defaults to `app_kv`
- `SUPABASE_HYDRATE_TTL_SECONDS` defaults to `60`

## Setup

1. Open the Supabase SQL editor.
2. Run `docs/supabase_storage.sql`.
3. Add the environment variables above in Vercel.
4. Redeploy.
5. Check `/api/storage/status`.

## Persisted Stores

- backtest ledger
- parlay ledger
- player profile manual training entries
- team profile manual training entries
- live ESPN fixtures
- live ESPN results
- live league context
- live odds snapshot
- API-Football player-stat cache

