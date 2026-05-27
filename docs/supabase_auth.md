# Supabase Auth Setup

Run `docs/supabase_auth.sql` once in the Supabase SQL Editor for the production project.

The hosted app reads these environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

When the app is running on Vercel, it hides the private model-training accuracy cards. Local runs keep the training stats visible.

The sign-in gate is parked behind a feature flag for now. To turn it back on later, set either `AUTH_GATE_ENABLED=1` or `REQUIRE_AUTH=1` in the deployment environment along with the Supabase URL and anon key.

User profile rows are stored in `public.user_profiles` with row-level security, so signed-in users can only read and update their own profile row.
