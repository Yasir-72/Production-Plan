-- Run this entire script in your Supabase SQL Editor

-- 1. Create the orders table
create table if not exists public.orders (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  order_id       text not null,
  customer       text not null,
  product        text not null,
  qty            numeric not null default 1,
  due_date       date not null,
  time_per_unit  numeric not null default 1,
  status         text not null default 'Not Started'
                 check (status in ('Not Started','In Progress','Completed')),
  created_at     timestamptz default now()
);

-- 2. Enable Row Level Security (users can only see their own orders)
alter table public.orders enable row level security;

-- 3. Policies
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own orders"
  on public.orders for update
  using (auth.uid() = user_id);

create policy "Users can delete own orders"
  on public.orders for delete
  using (auth.uid() = user_id);
