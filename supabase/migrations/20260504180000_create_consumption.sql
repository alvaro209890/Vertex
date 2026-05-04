create extension if not exists pgcrypto;

create table if not exists public.consumption (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  email text,
  request_id text,
  model text not null,
  prompt_cache_hit_tokens bigint not null default 0,
  prompt_cache_miss_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  total_tokens bigint generated always as (
    prompt_cache_hit_tokens + prompt_cache_miss_tokens + completion_tokens
  ) stored,
  cost_usd numeric(18, 8) not null default 0,
  cost_brl numeric(18, 4) not null default 0,
  usd_to_brl numeric(10, 4) not null default 5.0000,
  source text not null default 'vertex-proxy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists consumption_user_request_idx
  on public.consumption (user_id, request_id)
  where request_id is not null;

create index if not exists consumption_user_created_idx
  on public.consumption (user_id, created_at desc);

alter table public.consumption enable row level security;

drop policy if exists "consumption_select_own_firebase_uid" on public.consumption;
create policy "consumption_select_own_firebase_uid"
  on public.consumption
  for select
  using (
    user_id = coalesce(
      auth.jwt() ->> 'firebase_uid',
      auth.jwt() ->> 'user_id',
      auth.uid()::text
    )
  );

drop policy if exists "consumption_service_role_all" on public.consumption;
create policy "consumption_service_role_all"
  on public.consumption
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

do $$
begin
  alter publication supabase_realtime add table public.consumption;
exception
  when duplicate_object then null;
end $$;
