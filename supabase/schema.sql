-- Run in Supabase SQL Editor. Enable RLS: all rows are scoped to auth.uid().
create extension if not exists pgcrypto;
create table if not exists public.wallets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 80), currency text not null check(currency in ('LKR','USD')),
 balance numeric(14,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 wallet_id uuid references public.wallets(id) on delete set null, type text not null check(type in ('income','expense')),
 amount numeric(14,2) not null check(amount > 0), category text, note text, occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table if not exists public.targets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, goal_amount numeric(14,2) not null check(goal_amount > 0), saved_amount numeric(14,2) not null default 0 check(saved_amount >= 0),
 deadline date not null, created_at timestamptz not null default now()
);
create table if not exists public.user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade, usd_lkr_rate numeric(10,4) not null default 328.50,
 updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.targets enable row level security;
alter table public.user_settings enable row level security;
create policy "wallets own rows" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions own rows" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "targets own rows" on public.targets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings own row" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Recommended: prevent client-supplied user_id spoofing with RLS (policies above do this).
-- Production hardening: use a database function/trigger to update wallet balances atomically
-- when transactions are inserted/deleted/edited. The starter UI updates balances after inserts.
