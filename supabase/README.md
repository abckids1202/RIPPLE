# RIPPLE Supabase and always-on research setup

The browser keeps its bundled 124-case catalog as an offline fallback. Research runs on Supabase infrastructure, so your PC can be off. NLP drafts and cross-checks candidate cases; it does not train a new model. Automated approval is recorded separately and is never represented as human editorial review.

## Database and Edge Functions

Install the Supabase CLI, link your hosted project, and apply both migrations:

~~~powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
~~~

Deploy the functions:

~~~powershell
supabase functions deploy api
supabase functions deploy research-daily
supabase functions deploy research-worker
supabase functions deploy publish-daily
~~~

Set server-only credentials and spending controls. Leave the AI budget at zero or omit it to pause NLP work safely. Set the per-token rates to the selected model's current API pricing:

~~~powershell
supabase secrets set BRAVE_SEARCH_API_KEY=YOUR_BRAVE_KEY RIPPLE_CRON_SECRET=LONG_RANDOM_SECRET OPENAI_API_KEY=YOUR_OPENAI_KEY RIPPLE_RESEARCH_MODEL=gpt-5-mini RIPPLE_AI_MONTHLY_BUDGET_USD=YOUR_MONTHLY_LIMIT RIPPLE_AI_MAX_CASE_RESERVATION_USD=YOUR_PER_CASE_LIMIT RIPPLE_AI_INPUT_USD_PER_MILLION=YOUR_MODEL_INPUT_RATE RIPPLE_AI_OUTPUT_USD_PER_MILLION=YOUR_MODEL_OUTPUT_RATE
~~~

Missing/zero budget, rates, reservation, or AI key means no NLP work. Provider keys and the cron secret are never Vite variables.

## Scheduled operation

Create the Vault values shown at the top of supabase/schedule.sql, then run that SQL in the hosted Supabase SQL editor. It schedules discovery and one research-worker invocation every 15 minutes, plus publication at 00:05 UTC. The hosted scheduler invokes the Edge Functions; your computer does not need to stay online.

Discovery stores search leads only. The worker fetches pages only from each topic's curated HTTPS domain allowlist; Wikipedia and unlisted sites cannot count as publication evidence. It requires two different allowlisted domains for each edge, creates a structured case, and asks a second model pass to reject unsupported or disputed links. Failures stay private and are written to job/candidate records. Publishing selects one daily case and up to four archive additions (five maximum), with the existing fallback used when no case passes.

Automated checks do not guarantee truth; models can miss errors. Cases are marked AI-drafted/auto-checked. Authenticated editors can withdraw a case through POST /editor/puzzles/:id/unpublish with a required correction note; this archives the puzzle, cancels its slots, withdraws its verification, and writes a revision. The current browser editor remains a local/mock workspace; this protected API route is ready for a real editor control. Review automated cases before broad launch.

## Security and operations

- Public reads are limited by RLS to published puzzle content; drafts, evidence, verification reports, and correct-choice rows remain private.
- Scheduler requests use the x-ripple-cron header. Keep it and all service-role/provider keys server-side.
- The worker handles one candidate per invocation and bounds fetch size/time, HTTPS, allowlisted hosts, and redirects.
- Inspect research_job_runs, research_candidates.pipeline_error, and Supabase Cron run history to diagnose failures.
- The software budget is only a guardrail. Configure a provider-side hard spending limit too.
- Repository changes do not deploy or activate the hosted scheduler; project setup and credentials are still required.

## Local app

Run npm install and npm run dev. Without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, the local catalog remains available without cloud credentials.
