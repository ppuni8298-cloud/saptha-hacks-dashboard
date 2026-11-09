
create table public.admin_users (user_id uuid primary key, email text, created_at timestamptz not null default now());
grant select on public.admin_users to authenticated; grant all on public.admin_users to service_role;
alter table public.admin_users enable row level security;

create or replace function public.is_admin(_uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=_uid) $$;
create or replace function public.claim_first_admin() returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists(select 1 from public.admin_users) then return public.is_admin(auth.uid()); end if;
  insert into public.admin_users(user_id,email) values (auth.uid(), (select email from auth.users where id=auth.uid()));
  return true;
end $$;
create or replace function public.admin_exists() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users) $$;
grant execute on function public.is_admin(uuid), public.claim_first_admin(), public.admin_exists() to authenticated;
create policy "admins read admins" on public.admin_users for select to authenticated using (public.is_admin(auth.uid()));

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, project_title text, project_description text,
  pdf_path text, pdf_text text, github_url text, website_url text,
  final_status text not null default 'pending', final_override numeric, override_reason text, remarks text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index teams_name_uq on public.teams (lower(name));
create table public.team_members (id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade, name text not null, email text, position int not null default 0);
create index on public.team_members(team_id);

create table public.evaluation_components (key text primary key, name text not null, weight numeric not null);
insert into public.evaluation_components values ('pdf','Project PDF',30),('github','GitHub Code',40),('website','Deployed Website',30);

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(), component text not null references public.evaluation_components(key),
  name text not null, description text, instructions text, max_marks numeric not null default 10, weight numeric not null default 1,
  enabled boolean not null default true, position int not null default 0, updated_at timestamptz not null default now()
);
create index on public.evaluation_criteria(component, position);
insert into public.evaluation_criteria(component,name,max_marks,position) values
('pdf','Problem Statement Clarity',10,1),('pdf','Proposed Solution',15,2),('pdf','Innovation and Uniqueness',15,3),('pdf','Technical Architecture',15,4),('pdf','Methodology and Implementation',15,5),('pdf','Feasibility and Practicality',10,6),('pdf','Documentation Quality',10,7),('pdf','Expected Impact',10,8),
('github','Code Quality and Readability',15,1),('github','Project Architecture',15,2),('github','Functionality and Implementation',20,3),('github','Code Organisation and Modularity',10,4),('github','Error Handling',10,5),('github','Security Practices',10,6),('github','Technical Complexity',10,7),('github','Documentation and README',10,8),
('website','UI and Visual Design',15,1),('website','User Experience',15,2),('website','Functional Features',20,3),('website','Responsiveness',10,4),('website','Navigation',10,5),('website','Backend and API Integration Evidence',10,6),('website','Performance and Reliability',10,7),('website','Innovation and Overall Experience',10,8);

create table public.evaluation_templates (id uuid primary key default gen_random_uuid(), component text not null, name text not null, criteria jsonb not null, created_at timestamptz not null default now());

create table public.evaluations (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade, component text not null references public.evaluation_components(key),
  status text not null default 'pending', stale boolean not null default false,
  ai_score numeric, final_score numeric, max_score numeric, confidence numeric, summary text, model text, error text,
  approved_by uuid, approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(team_id, component)
);
create table public.criterion_scores (
  id uuid primary key default gen_random_uuid(), evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  criterion_id uuid, criterion_name text not null, max_marks numeric not null, position int not null default 0,
  ai_marks numeric, ai_explanation text, ai_evidence text, confidence numeric, needs_review boolean not null default false,
  admin_marks numeric, admin_reason text, edited_by uuid, edited_at timestamptz
);
create index on public.criterion_scores(evaluation_id);
create table public.admin_score_overrides (id uuid primary key default gen_random_uuid(), evaluation_id uuid references public.evaluations(id) on delete cascade, criterion_score_id uuid, team_id uuid, field text, previous_value numeric, new_value numeric, reason text, edited_by uuid, created_at timestamptz not null default now());
create table public.evaluation_jobs (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade, component text not null,
  status text not null default 'queued', attempts int not null default 0, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index jobs_active_uq on public.evaluation_jobs(team_id, component) where status in ('queued','processing');
create index on public.evaluation_jobs(status, created_at);
create table public.evaluation_history (id uuid primary key default gen_random_uuid(), team_id uuid references public.teams(id) on delete cascade, component text, action text not null, details jsonb, actor uuid, created_at timestamptz not null default now());
create index on public.evaluation_history(team_id, created_at desc);
create table public.activity_logs (id uuid primary key default gen_random_uuid(), actor uuid, actor_email text, action text not null, details text, created_at timestamptz not null default now());
create table public.api_usage_logs (id uuid primary key default gen_random_uuid(), model text, component text, team_id uuid, status text, http_status int, prompt_tokens int, completion_tokens int, duration_ms int, error text, created_at timestamptz not null default now());
create index on public.api_usage_logs(created_at desc);
create table public.system_settings (
  id int primary key default 1 check (id=1), model text not null default 'google/gemini-3.1-flash-lite',
  rpm int not null default 15, concurrency int not null default 2, batch_size int not null default 10, max_retries int not null default 3,
  max_pdf_mb numeric not null default 5, daily_request_limit int not null default 1000, scoring_instructions text default 'Be strict and fair. Only award marks supported by evidence.',
  queue_paused boolean not null default true, quota_exhausted boolean not null default false, quota_message text, updated_at timestamptz not null default now()
);
insert into public.system_settings(id) values (1);

-- grants + RLS
do $$ declare t text; begin
  foreach t in array array['teams','team_members','evaluation_components','evaluation_criteria','evaluation_templates','evaluations','criterion_scores','admin_score_overrides','evaluation_jobs','evaluation_history','activity_logs','api_usage_logs','system_settings'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))', t);
  end loop; end $$;

-- criteria change marks evaluations stale
create or replace function public.mark_stale() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.evaluations set stale=true where component = coalesce(new.component, old.component) and status in ('completed','approved');
  return coalesce(new, old);
end $$;
create trigger criteria_stale after insert or update or delete on public.evaluation_criteria for each row execute function public.mark_stale();

alter publication supabase_realtime add table public.evaluation_jobs;
alter publication supabase_realtime add table public.evaluations;

-- storage policies for project-pdfs bucket
create policy "admin pdf read" on storage.objects for select to authenticated using (bucket_id='project-pdfs' and public.is_admin(auth.uid()));
create policy "admin pdf write" on storage.objects for insert to authenticated with check (bucket_id='project-pdfs' and public.is_admin(auth.uid()));
create policy "admin pdf update" on storage.objects for update to authenticated using (bucket_id='project-pdfs' and public.is_admin(auth.uid()));
create policy "admin pdf delete" on storage.objects for delete to authenticated using (bucket_id='project-pdfs' and public.is_admin(auth.uid()));
