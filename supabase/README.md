# RIPPLE Supabase setup

The Supabase layer is optional for local development. Without Vite Supabase variables, RIPPLE falls back to the local TypeScript catalog: five original cases plus the 119-case expansion pack.

## Database

Install the Supabase CLI, link the project, then apply the schema:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates the content model, research/editor tables, attempts, publication slots, revision history, and RLS policies. Public roles can read published content only. Choice rows remain private so `is_correct` cannot leak through the data API; the Edge Function strips answer keys from public payloads.

Create an editor by inserting the authenticated user id into `editor_profiles` (as an admin/service-role operation):

```sql
insert into public.editor_profiles (user_id, display_name, role)
values ('AUTH_USER_UUID', 'Evidence editor', 'editor');
```

## Edge Functions and secrets

```powershell
supabase secrets set BRAVE_SEARCH_API_KEY=YOUR_BRAVE_KEY RIPPLE_CRON_SECRET=LONG_RANDOM_SECRET
supabase functions deploy api
supabase functions deploy research-daily
supabase functions deploy publish-daily
```

The `api` function exposes the public and editor routes described in the product plan. `research-daily` calls Brave when configured and otherwise uses curated topic seed URLs. It is idempotent on canonical source URL and never publishes a candidate. `publish-daily` validates sources, causal labels, confidence, explanations, rejection copy, reviewer approval, and media provenance before publishing; it selects a reviewed fallback when the scheduled puzzle is unavailable.

## Scheduling

Schedule `research-daily` once per day before editorial review and `publish-daily` at `00:00 UTC`. Supabase Cron, GitHub Actions, or another scheduler can call the functions with the secret header:

```text
x-ripple-cron: LONG_RANDOM_SECRET
```

Example request URLs:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/research-daily
https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-daily
```

Keep `BRAVE_SEARCH_API_KEY`, `RIPPLE_CRON_SECRET`, and the Supabase service role key out of the browser bundle and out of git.
