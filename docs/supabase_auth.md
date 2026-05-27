# Supabase Auth Setup

Run `docs/supabase_auth.sql` once in the Supabase SQL Editor for the production project.

The hosted app reads these environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

When the app is running on Vercel, it requires sign-in before loading the prediction dashboard and hides the private model-training accuracy cards. Local runs keep the training stats visible.

User profile rows are stored in `public.user_profiles` with row-level security, so signed-in users can only read and update their own profile row.
