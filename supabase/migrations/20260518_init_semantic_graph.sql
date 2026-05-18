-- Semantic graph baseline schema for Art as Stance
-- Run in Supabase SQL editor or via Supabase CLI migrations.

create extension if not exists pgcrypto;

create table if not exists public.entries (
  id text primary key,
  text text not null,
  category text[] not null default '{}',
  relations text[] not null default '{}',
  source text not null default 'user',
  timestamp bigint not null,
  moderation_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.entries
  add column if not exists timestamp bigint not null default extract(epoch from now())::bigint;

create table if not exists public.categories (
  category_key text primary key,
  label text not null,
  description text,
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nodes (
  node_id text primary key,
  label text not null,
  node_type text not null,
  source_entry_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  source_node_id text not null,
  target_node_id text not null,
  relation_type text not null,
  weight double precision not null default 0,
  context_entry_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint links_no_self_loop check (source_node_id <> target_node_id)
);

create unique index if not exists links_source_target_relation_uidx
  on public.links (source_node_id, target_node_id, relation_type);

create index if not exists entries_timestamp_idx on public.entries (timestamp);
create index if not exists nodes_node_type_idx on public.nodes (node_type);
create index if not exists links_relation_type_idx on public.links (relation_type);
create index if not exists links_weight_idx on public.links (weight);
create index if not exists categories_usage_count_idx on public.categories (usage_count desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists nodes_set_updated_at on public.nodes;
create trigger nodes_set_updated_at
before update on public.nodes
for each row execute function public.set_updated_at();

drop trigger if exists links_set_updated_at on public.links;
create trigger links_set_updated_at
before update on public.links
for each row execute function public.set_updated_at();
