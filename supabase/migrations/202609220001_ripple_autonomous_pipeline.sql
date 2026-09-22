-- Durable, auditable stages for automated research. Automated checks are never
-- represented as a human review; drafts remain private under the existing RLS.
create table if not exists public.research_job_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  candidate_id uuid references public.research_candidates(id) on delete set null,
  stage text not null check (stage in ('discovery', 'fetch', 'draft', 'verify', 'publish')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  attempt_count integer not null default 1,
  model text,
  prompt_version text,
  source_count integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  details jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.research_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.research_candidates(id) on delete cascade,
  canonical_url text not null,
  title text not null,
  publisher text not null,
  domain text not null,
  source_class text not null check (source_class in ('government', 'university', 'museum', 'archive', 'peer_reviewed', 'other')),
  discovery_only boolean not null default false,
  excerpt text not null,
  content_hash text not null,
  fetched_at timestamptz not null default now(),
  unique(candidate_id, canonical_url)
);

create table if not exists public.automated_verifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.research_candidates(id) on delete set null,
  puzzle_id uuid references public.puzzles(id) on delete cascade,
  status text not null check (status in ('passed', 'failed', 'withdrawn')),
  policy_version text not null,
  model text not null,
  prompt_version text not null,
  findings jsonb not null default '{}'::jsonb,
  source_report jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  published_at timestamptz,
  withdrawn_at timestamptz,
  unique(puzzle_id)
);

create table if not exists public.research_ai_monthly_usage (
  month date primary key,
  budget_usd numeric(12,4) not null check (budget_usd >= 0),
  spent_usd numeric(12,6) not null default 0 check (spent_usd >= 0),
  reserved_usd numeric(12,6) not null default 0 check (reserved_usd >= 0),
  updated_at timestamptz not null default now()
);

alter table public.research_candidates
  add column if not exists pipeline_stage text not null default 'discovered',
  add column if not exists pipeline_attempts integer not null default 0,
  add column if not exists pipeline_lease_until timestamptz,
  add column if not exists pipeline_error text,
  add column if not exists draft_puzzle_id uuid references public.puzzles(id) on delete set null;
alter table public.sources
  add column if not exists domain text,
  add column if not exists source_class text,
  add column if not exists discovery_only boolean not null default false,
  add column if not exists content_hash text;
alter table public.puzzles
  add column if not exists automated boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists automated_verification_id uuid references public.automated_verifications(id) on delete set null;

create sequence if not exists public.ripple_puzzle_number_seq start with 1000;
select setval('public.ripple_puzzle_number_seq', greatest(coalesce((select max(puzzle_number) from public.puzzles), 999), 999), true);
alter table public.puzzles alter column puzzle_number set default nextval('public.ripple_puzzle_number_seq');
grant usage, select on sequence public.ripple_puzzle_number_seq to service_role;

create index if not exists research_candidates_pipeline_idx
  on public.research_candidates(pipeline_stage, pipeline_lease_until, created_at);
create index if not exists research_evidence_candidate_idx
  on public.research_evidence(candidate_id, source_class, discovery_only);

alter table public.research_job_runs enable row level security;
alter table public.research_evidence enable row level security;
alter table public.automated_verifications enable row level security;
alter table public.research_ai_monthly_usage enable row level security;
create policy research_jobs_editor_read on public.research_job_runs for select to authenticated using (public.is_editor());
create policy research_evidence_editor_read on public.research_evidence for select to authenticated using (public.is_editor());
create policy automated_verifications_editor_read on public.automated_verifications for select to authenticated using (public.is_editor());
create policy research_ai_usage_editor_read on public.research_ai_monthly_usage for select to authenticated using (public.is_editor());

-- Atomic monthly budget reservation prevents overlapping cron invocations from
-- spending past the configured cap. Missing/zero budget intentionally denies AI.
create or replace function public.reserve_research_ai_budget(p_month date, p_budget numeric, p_reservation numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_row public.research_ai_monthly_usage%rowtype;
begin
  if p_budget is null or p_budget <= 0 or p_reservation is null or p_reservation <= 0 then return false; end if;
  insert into public.research_ai_monthly_usage(month, budget_usd) values (p_month, p_budget)
  on conflict (month) do nothing;
  select * into current_row from public.research_ai_monthly_usage where month = p_month for update;
  if current_row.budget_usd <> p_budget then
    update public.research_ai_monthly_usage set budget_usd = p_budget, updated_at = now() where month = p_month;
    current_row.budget_usd := p_budget;
  end if;
  if current_row.spent_usd + current_row.reserved_usd + p_reservation > p_budget then return false; end if;
  update public.research_ai_monthly_usage set reserved_usd = reserved_usd + p_reservation, updated_at = now() where month = p_month;
  return true;
end $$;

create or replace function public.settle_research_ai_budget(p_month date, p_reservation numeric, p_actual numeric)
returns void language sql security definer set search_path = public as $$
  update public.research_ai_monthly_usage
  set reserved_usd = greatest(0, reserved_usd - greatest(0, p_reservation)),
      spent_usd = spent_usd + greatest(0, coalesce(p_actual, 0)), updated_at = now()
  where month = p_month;
$$;
revoke all on function public.reserve_research_ai_budget(date, numeric, numeric) from public, anon, authenticated;
revoke all on function public.settle_research_ai_budget(date, numeric, numeric) from public, anon, authenticated;
grant execute on function public.reserve_research_ai_budget(date, numeric, numeric) to service_role;
grant execute on function public.settle_research_ai_budget(date, numeric, numeric) to service_role;

-- Atomic lease claim prevents overlapping cron invocations processing the same row.
create or replace function public.claim_next_research_candidate(p_lease_seconds integer default 240)
returns table(candidate_id uuid, attempt integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with next_candidate as (
    select c.id from public.research_candidates c
    where c.status in ('new', 'researching')
      and c.pipeline_stage in ('discovered', 'evidence_failed')
      and (c.pipeline_lease_until is null or c.pipeline_lease_until < now())
    order by c.created_at for update skip locked limit 1
  ), claimed as (
    update public.research_candidates c
    set pipeline_stage = 'fetching', pipeline_lease_until = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 900))),
        pipeline_attempts = c.pipeline_attempts + 1, pipeline_error = null, status = 'researching'
    from next_candidate n where c.id = n.id
    returning c.id, c.pipeline_attempts
  ) select claimed.id, claimed.pipeline_attempts from claimed;
end $$;
revoke all on function public.claim_next_research_candidate(integer) from public, anon, authenticated;
grant execute on function public.claim_next_research_candidate(integer) to service_role;
