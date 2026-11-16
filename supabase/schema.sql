-- POCKETPULSE DATABASE SCHEMA
-- Execute this SQL in your Supabase SQL Editor

-- 1. Wallets Table
create table if not exists public.wallets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    currency text check (currency in ('LKR', 'USD')) default 'LKR',
    balance numeric(12, 2) default 0.00 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Transactions Table
create table if not exists public.transactions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    wallet_id uuid references public.wallets(id) on delete cascade not null,
    type text check (type in ('income', 'expense')) not null,
    amount numeric(12, 2) not null,
    category text not null,
    note text,
    occurred_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Targets (Savings Goals) Table
create table if not exists public.targets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    goal_amount numeric(12, 2) not null,
    saved_amount numeric(12, 2) default 0.00 not null,
    deadline date not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. User Settings Table
create table if not exists public.user_settings (
    user_id uuid references auth.users(id) on delete cascade primary key,
    planning_rate numeric(8, 2) default 328.50 not null,
    preferences jsonb default '{}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on all tables
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.targets enable row level security;
alter table public.user_settings enable row level security;

-- RLS Security Policies
create policy "Users can manage their own wallets" on public.wallets
    for all using (auth.uid() = user_id);

create policy "Users can manage their own transactions" on public.transactions
    for all using (auth.uid() = user_id);

create policy "Users can manage their own targets" on public.targets
    for all using (auth.uid() = user_id);

create policy "Users can manage their own settings" on public.user_settings
    for all using (auth.uid() = user_id);
