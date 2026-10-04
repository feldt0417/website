-- Revenant user panel. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Safe to run again.

-- One row per customer. expires_at = null means lifetime.
create table if not exists public.subscriptions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null default 'Month',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Customers can read only their own row and can never write to the table.
drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.has_active_subscription()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid()
      and (expires_at is null or expires_at > now())
  );
$$;

-- Private bucket for the download. Only active subscribers can get a link.
insert into storage.buckets (id, name, public)
values ('downloads', 'downloads', false)
on conflict (id) do nothing;

drop policy if exists "Active subscribers download" on storage.objects;
create policy "Active subscribers download"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'downloads' and public.has_active_subscription());


-- ---------------------------------------------------------------------------
-- Giving a customer a plan (run in the SQL Editor, change the email/plan/days):
--
-- insert into public.subscriptions (user_id, plan, expires_at)
-- select id, 'Month', now() + interval '30 days' from auth.users where email = 'customer@example.com'
-- on conflict (user_id) do update set plan = excluded.plan, expires_at = excluded.expires_at;
--
-- Lifetime: use  'Lifetime', null  instead of  'Month', now() + interval '30 days'
-- Remove access:  delete from public.subscriptions where user_id = (select id from auth.users where email = 'customer@example.com');
-- ---------------------------------------------------------------------------
