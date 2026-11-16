-- PocketPulse schema. Run in Supabase > SQL Editor.
create table if not exists wallets(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  currency text not null check (currency in ('LKR','USD')),
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now());
create table if not exists transactions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  wallet_id uuid not null references wallets on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null, note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now());
create table if not exists targets(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, goal_amount numeric(14,2) not null check (goal_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  deadline date, created_at timestamptz not null default now());
create table if not exists user_settings(
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  usd_lkr_rate numeric(10,4) not null default 328.50 check (usd_lkr_rate > 0),
  theme text default 'light');
create index if not exists tx_user_time on transactions(user_id, occurred_at desc);
create index if not exists wallets_user on wallets(user_id);
create index if not exists targets_user on targets(user_id);

alter table wallets enable row level security;
alter table transactions enable row level security;
alter table targets enable row level security;
alter table user_settings enable row level security;
create policy own_wallets on wallets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_tx on transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_targets on targets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_settings on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Atomic: inserts the transaction and updates the balance in one statement block.
create or replace function add_transaction(p_wallet uuid, p_type text, p_amount numeric,
  p_category text, p_note text, p_occurred timestamptz)
returns transactions language plpgsql security invoker as $$
declare t transactions; w wallets;
begin
  select * into w from wallets where id = p_wallet and user_id = auth.uid() for update;
  if not found then raise exception 'Wallet not found'; end if;
  if p_type = 'expense' and w.balance < p_amount then raise exception 'Insufficient balance'; end if;
  insert into transactions(wallet_id,type,amount,category,note,occurred_at)
    values(p_wallet,p_type,p_amount,p_category,p_note,coalesce(p_occurred,now())) returning * into t;
  update wallets set balance = balance + case when p_type='income' then p_amount else -p_amount end where id = p_wallet;
  return t;
end $$;

create or replace function contribute_target(p_target uuid, p_amount numeric)
returns targets language plpgsql security invoker as $$
declare t targets;
begin
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  update targets set saved_amount = saved_amount + p_amount where id = p_target and user_id = auth.uid() returning * into t;
  if not found then raise exception 'Target not found'; end if;
  return t;
end $$;
