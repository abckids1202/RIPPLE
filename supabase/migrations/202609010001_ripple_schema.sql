-- RIPPLE Evidence Atlas: reviewed content, media provenance, attempts, and publishing.
create extension if not exists pgcrypto;

do $$ begin create type public.puzzle_status as enum ('draft', 'review', 'approved', 'published', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.review_status as enum ('draft', 'approved', 'changes_requested', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.publication_status as enum ('scheduled', 'published', 'fallback', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.confidence_level as enum ('high', 'medium', 'debated', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.relationship_type as enum ('caused', 'enabled', 'contributed', 'accelerated', 'inspired', 'popularized', 'responded'); exception when duplicate_object then null; end $$;

create table if not exists public.editor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'editor' check (role in ('editor', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo', 'scan', 'map', 'audio', 'web')),
  image_url text,
  source_url text not null,
  license text not null,
  credit text not null,
  alt_text text not null,
  focal_x numeric check (focal_x is null or focal_x between 0 and 100),
  focal_y numeric check (focal_y is null or focal_y between 0 and 100),
  annotations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  puzzle_number integer unique,
  category text not null,
  difficulty text not null check (difficulty in ('Easy', 'Standard', 'Hard')),
  duration text not null,
  hook text not null,
  question text not null,
  takeaway text not null,
  accent text not null default '#df6f5d',
  status public.puzzle_status not null default 'draft',
  is_fallback boolean not null default false,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_nodes (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  node_key text not null,
  kind text not null check (kind in ('start', 'step', 'ending', 'decoy')),
  title text not null,
  detail text not null,
  year_label text not null,
  icon text,
  tone text not null default 'ink',
  media_asset_id uuid references public.media_assets(id),
  sort_order integer not null default 0,
  unique (puzzle_id, node_key)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  url text not null unique,
  accessed_at timestamptz not null default now(),
  excerpt text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.causal_edges (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  from_event_id uuid not null references public.event_nodes(id) on delete cascade,
  to_event_id uuid not null references public.event_nodes(id) on delete cascade,
  step_index integer not null,
  question text not null default 'Which event happened next?',
  relationship_type public.relationship_type not null,
  confidence public.confidence_level not null,
  explanation text not null,
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  unique (puzzle_id, step_index)
);

create table if not exists public.edge_sources (
  edge_id uuid not null references public.causal_edges(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  primary key (edge_id, source_id)
);

create table if not exists public.choice_options (
  id uuid primary key default gen_random_uuid(),
  edge_id uuid not null references public.causal_edges(id) on delete cascade,
  event_id uuid references public.event_nodes(id) on delete set null,
  title text not null,
  detail text not null,
  year_label text not null,
  icon text,
  tone text not null default 'ink',
  is_correct boolean not null default false,
  rejection_copy text,
  sort_order integer not null default 0
);

create table if not exists public.hints (
  id uuid primary key default gen_random_uuid(),
  edge_id uuid not null unique references public.causal_edges(id) on delete cascade,
  hint_text text not null,
  penalty integer not null default 40 check (penalty >= 0)
);

create table if not exists public.research_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  query text not null,
  category text not null,
  source_domains jsonb not null default '[]'::jsonb,
  seed_urls jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.research_candidates (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.research_topics(id) on delete set null,
  title text not null,
  hook text,
  category text not null,
  seed_question text,
  canonical_url text not null unique,
  source_title text,
  source_publisher text,
  snippet text,
  raw_result jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'researching', 'needs_review', 'approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.research_candidates(id) on delete cascade,
  puzzle_id uuid references public.puzzles(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  status public.review_status not null default 'draft',
  checklist jsonb not null default '{}'::jsonb,
  note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (candidate_id is not null or puzzle_id is not null)
);

create table if not exists public.publication_slots (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  publish_date date not null unique,
  timezone text not null default 'UTC',
  status public.publication_status not null default 'scheduled',
  fallback_reason text,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id),
  user_id uuid references auth.users(id),
  session_key text,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_step integer not null default 0,
  mistakes integer not null default 0,
  hints_used integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  edge_id uuid not null references public.causal_edges(id),
  choice_id uuid not null references public.choice_options(id),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  editor_id uuid references auth.users(id),
  action text not null,
  snapshot jsonb not null default '{}'::jsonb,
  correction_note text,
  created_at timestamptz not null default now()
);

create index if not exists event_nodes_puzzle_sort_idx on public.event_nodes (puzzle_id, sort_order);
create index if not exists causal_edges_puzzle_step_idx on public.causal_edges (puzzle_id, step_index);
create index if not exists candidates_status_created_idx on public.research_candidates (status, created_at desc);
create index if not exists attempts_puzzle_status_idx on public.attempts (puzzle_id, status);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists media_assets_updated_at on public.media_assets;
create trigger media_assets_updated_at before update on public.media_assets for each row execute function public.set_updated_at();
drop trigger if exists puzzles_updated_at on public.puzzles;
create trigger puzzles_updated_at before update on public.puzzles for each row execute function public.set_updated_at();
drop trigger if exists research_candidates_updated_at on public.research_candidates;
create trigger research_candidates_updated_at before update on public.research_candidates for each row execute function public.set_updated_at();

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.editor_profiles where user_id = auth.uid() and role in ('editor', 'admin')); $$;

alter table public.editor_profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.puzzles enable row level security;
alter table public.event_nodes enable row level security;
alter table public.sources enable row level security;
alter table public.causal_edges enable row level security;
alter table public.edge_sources enable row level security;
alter table public.choice_options enable row level security;
alter table public.hints enable row level security;
alter table public.research_topics enable row level security;
alter table public.research_candidates enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.publication_slots enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.revisions enable row level security;

drop policy if exists editor_profiles_self on public.editor_profiles;
create policy editor_profiles_self on public.editor_profiles for select to authenticated using (user_id = auth.uid() or public.is_editor());
drop policy if exists editor_profiles_manage on public.editor_profiles;
create policy editor_profiles_manage on public.editor_profiles for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists published_puzzles_read on public.puzzles;
create policy published_puzzles_read on public.puzzles for select to anon, authenticated using (status = 'published');
drop policy if exists editor_puzzles_all on public.puzzles;
create policy editor_puzzles_all on public.puzzles for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists published_events_read on public.event_nodes;
create policy published_events_read on public.event_nodes for select to anon, authenticated using (exists (select 1 from public.puzzles p where p.id = puzzle_id and p.status = 'published'));
drop policy if exists editor_events_all on public.event_nodes;
create policy editor_events_all on public.event_nodes for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists published_media_read on public.media_assets;
create policy published_media_read on public.media_assets for select to anon, authenticated using (exists (select 1 from public.event_nodes e join public.puzzles p on p.id = e.puzzle_id where e.media_asset_id = media_assets.id and p.status = 'published'));
drop policy if exists editor_media_all on public.media_assets;
create policy editor_media_all on public.media_assets for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists published_edges_read on public.causal_edges;
create policy published_edges_read on public.causal_edges for select to anon, authenticated using (exists (select 1 from public.puzzles p where p.id = puzzle_id and p.status = 'published'));
drop policy if exists editor_edges_all on public.causal_edges;
create policy editor_edges_all on public.causal_edges for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists published_sources_read on public.sources;
create policy published_sources_read on public.sources for select to anon, authenticated using (exists (select 1 from public.edge_sources es join public.causal_edges e on e.id = es.edge_id join public.puzzles p on p.id = e.puzzle_id where es.source_id = sources.id and p.status = 'published'));
drop policy if exists editor_sources_all on public.sources;
create policy editor_sources_all on public.sources for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists published_edge_sources_read on public.edge_sources;
create policy published_edge_sources_read on public.edge_sources for select to anon, authenticated using (exists (select 1 from public.causal_edges e join public.puzzles p on p.id = e.puzzle_id where e.id = edge_id and p.status = 'published'));
drop policy if exists editor_edge_sources_all on public.edge_sources;
create policy editor_edge_sources_all on public.edge_sources for all to authenticated using (public.is_editor()) with check (public.is_editor());

-- Choice rows are intentionally private. The API function strips is_correct before public responses.
drop policy if exists editor_choices_all on public.choice_options;
create policy editor_choices_all on public.choice_options for all to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists editor_hints_all on public.hints;
create policy editor_hints_all on public.hints for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists editor_topics_all on public.research_topics;
create policy editor_topics_all on public.research_topics for all to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists editor_candidates_all on public.research_candidates;
create policy editor_candidates_all on public.research_candidates for all to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists editor_reviews_all on public.editorial_reviews;
create policy editor_reviews_all on public.editorial_reviews for all to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists published_slots_read on public.publication_slots;
create policy published_slots_read on public.publication_slots for select to anon, authenticated using (status in ('published', 'fallback'));
drop policy if exists editor_slots_all on public.publication_slots;
create policy editor_slots_all on public.publication_slots for all to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists editor_revisions_read on public.revisions;
create policy editor_revisions_read on public.revisions for select to authenticated using (public.is_editor());
drop policy if exists editor_revisions_write on public.revisions;
create policy editor_revisions_write on public.revisions for insert to authenticated with check (public.is_editor());

-- Attempts are written/read through the Edge Function service role so answer correctness never leaks through RLS.
drop policy if exists own_attempts_read on public.attempts;
create policy own_attempts_read on public.attempts for select to authenticated using (user_id = auth.uid());
drop policy if exists own_attempt_answers_read on public.attempt_answers;
create policy own_attempt_answers_read on public.attempt_answers for select to authenticated using (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));

insert into public.research_topics (name, query, category, source_domains, seed_urls)
values
  ('Volcanoes and unintended inventions', 'volcanic eruption unexpected invention climate history', 'History & inventions', '["si.edu", "nasa.gov", "loc.gov"]'::jsonb, '["https://volcano.si.edu/", "https://earthobservatory.nasa.gov/"]'::jsonb),
  ('Accidents that changed medicine', 'accidental discovery changed medicine archival source', 'Science & accidents', '["nih.gov", "si.edu", "who.int"]'::jsonb, '["https://www.ncbi.nlm.nih.gov/", "https://www.si.edu/"]'::jsonb),
  ('Unexpected media ripples', 'music technology culture unexpected influence history source', 'Culture & media', '["si.edu", "loc.gov", "npr.org"]'::jsonb, '["https://www.loc.gov/", "https://americanhistory.si.edu/"]'::jsonb)
on conflict (name) do nothing;
