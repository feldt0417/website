-- Revenant store: plans, orders, license keys.
-- Run AFTER setup.sql: Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to run again (it re-applies the prices below).

-- ---------------------------------------------------------------------------
-- Plans. The checkout reads prices from here, never from the website, so a
-- customer can't change what they pay. days = null means lifetime.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id        text primary key,
  name      text not null,
  price_usd numeric(10, 2) not null check (price_usd > 0),
  days      integer check (days is null or days > 0),
  sort      integer not null default 0,
  active    boolean not null default true
);

insert into public.plans (id, name, price_usd, days, sort) values
  ('week',     'Week',     6.99,  7,    1),
  ('month',    'Month',    14.99, 30,   2),
  ('lifetime', 'Lifetime', 49.99, null, 3)
on conflict (id) do update
  set name = excluded.name, price_usd = excluded.price_usd, days = excluded.days, sort = excluded.sort;

alter table public.plans enable row level security;
drop policy if exists "Anyone reads active plans" on public.plans;
create policy "Anyone reads active plans"
  on public.plans for select
  to anon, authenticated
  using (active);

-- ---------------------------------------------------------------------------
-- Orders: one row per checkout. Written only by the Edge Functions.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  plan_id           text not null references public.plans (id),
  price_usd         numeric(10, 2) not null,
  days              integer,
  status            text not null default 'pending'
                    check (status in ('pending', 'waiting', 'confirming', 'confirmed', 'sending',
                                      'partially_paid', 'paid', 'failed', 'refunded', 'expired', 'review')),
  invoice_id        text,
  payment_id        text,
  license_key_id    uuid,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- License keys. Bought keys are activated on the buyer's account straight
-- away; keys you make by hand (create_keys below) wait to be redeemed.
-- ---------------------------------------------------------------------------
create table if not exists public.license_keys (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  plan_id      text not null references public.plans (id),
  days         integer,
  order_id     uuid unique references public.orders (id) on delete set null,
  created_at   timestamptz not null default now(),
  redeemed_by  uuid references auth.users (id) on delete set null,
  redeemed_at  timestamptz
);
create index if not exists license_keys_user_idx on public.license_keys (redeemed_by, redeemed_at desc);

alter table public.license_keys enable row level security;
drop policy if exists "Users read own keys" on public.license_keys;
create policy "Users read own keys"
  on public.license_keys for select
  to authenticated
  using ((select auth.uid()) = redeemed_by);

-- Every payment notification we accepted, for your records and to spot repeats.
create table if not exists public.payment_events (
  id          bigint generated always as identity primary key,
  order_id    uuid references public.orders (id) on delete set null,
  payment_id  text,
  status      text,
  payload     jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;  -- no policies: only the service role can read it

-- Customers can only read (RLS limits which rows); only the service role can write.
-- Supabase grants everything on new tables by default, so take it all back first.
revoke all on public.plans, public.orders, public.license_keys, public.payment_events, public.subscriptions
  from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.orders, public.license_keys, public.subscriptions to authenticated;
grant all on public.plans, public.orders, public.license_keys, public.payment_events, public.subscriptions
  to service_role;

-- ---------------------------------------------------------------------------
-- Helpers (not callable by customers)
-- ---------------------------------------------------------------------------

-- RVNT-XXXX-XXXX-XXXX-XXXX from the secure random source behind gen_random_uuid().
-- 16 symbols from a 32-letter alphabet = 80 random bits; avoids 0/O and 1/I.
create or replace function public.new_license_key()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- the version/variant bits of a v4 uuid live in bytes 6 and 8; skip them
  idx constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15];
  a bytea := uuid_send(gen_random_uuid());
  b bytea := uuid_send(gen_random_uuid());
  bytes int[] := '{}';
  out text := 'RVNT';
  i int;
begin
  foreach i in array idx loop
    bytes := bytes || get_byte(a, i);
  end loop;
  bytes := bytes || get_byte(b, 0) || get_byte(b, 1);
  for i in 1..16 loop
    if (i - 1) % 4 = 0 then out := out || '-'; end if;
    out := out || substr(alphabet, (bytes[i] % 32) + 1, 1);
  end loop;
  return out;
end;
$$;

-- Adds a plan to a user's subscription. Time stacks on top of what's left;
-- lifetime always wins and is never downgraded.
create or replace function public.apply_plan(p_user uuid, p_plan text, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_exp  timestamptz;
begin
  select name into v_name from public.plans where id = p_plan;
  if v_name is null then
    raise exception 'unknown plan %', p_plan;
  end if;

  insert into public.subscriptions as s (user_id, plan, expires_at)
  values (p_user, v_name, case when p_days is null then null else now() + make_interval(days => p_days) end)
  on conflict (user_id) do update set
    plan = case
             when s.expires_at is null then s.plan
             else excluded.plan
           end,
    expires_at = case
                   when s.expires_at is null then null
                   when p_days is null then null
                   else greatest(s.expires_at, now()) + make_interval(days => p_days)
                 end
  returning expires_at into v_exp;

  return v_exp;
end;
$$;

-- Called by the payment webhook once a payment is confirmed. Runs once per
-- order no matter how many times the webhook fires; returns the order's key.
create or replace function public.fulfill_order(p_order uuid, p_payment_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o       public.orders;
  v_key   text;
  v_id    uuid;
  v_con   text;
  v_try   int := 0;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'order % not found', p_order;
  end if;

  if o.status = 'paid' then
    select key into v_key from public.license_keys where id = o.license_key_id;
    return v_key;
  end if;

  -- An order only ever gets one key, even if its status was changed by hand.
  select id, key into v_id, v_key from public.license_keys where order_id = o.id;
  if found then
    update public.orders
       set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now(),
           payment_id = coalesce(p_payment_id, payment_id), license_key_id = v_id
     where id = o.id;
    return v_key;
  end if;

  loop
    begin
      v_key := public.new_license_key();
      insert into public.license_keys (key, plan_id, days, order_id, redeemed_by, redeemed_at)
      values (v_key, o.plan_id, o.days, o.id, o.user_id, now())
      returning id into v_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_con = constraint_name;
      v_try := v_try + 1;
      if v_con <> 'license_keys_key_key' or v_try >= 10 then
        raise;
      end if;
    end;
  end loop;

  perform public.apply_plan(o.user_id, o.plan_id, o.days);

  update public.orders
     set status = 'paid', paid_at = now(), updated_at = now(),
         payment_id = coalesce(p_payment_id, payment_id), license_key_id = v_id
   where id = o.id;

  return v_key;
end;
$$;

-- Called by the checkout function. One statement per user at a time (advisory
-- lock), so the hourly limit can't be dodged with parallel requests.
create or replace function public.create_order(p_user uuid, p_plan text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p  public.plans;
  o  public.orders;
  n  integer;
begin
  select * into p from public.plans where id = p_plan and active;
  if not found then
    raise exception 'unknown_plan' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rvnt-order:' || p_user::text, 0));

  if exists (select 1 from public.subscriptions where user_id = p_user and expires_at is null) then
    raise exception 'lifetime_owned' using errcode = 'P0001';
  end if;

  select count(*) into n from public.orders
   where user_id = p_user and created_at > now() - interval '1 hour';
  if n >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, plan_id, price_usd, days)
  values (p_user, p.id, p.price_usd, p.days)
  returning * into o;

  return json_build_object('id', o.id, 'price_usd', o.price_usd, 'name', p.name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer-callable: redeem a key from the panel.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_key(p_key text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_plan text;
  v_days integer;
  v_exp  timestamptz;
begin
  if v_uid is null then
    raise exception 'Log in first.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.subscriptions where user_id = v_uid and expires_at is null) then
    raise exception 'You already have lifetime access, so the key was not used.' using errcode = 'P0001';
  end if;

  -- redeemed_at (not redeemed_by) marks a key as used: deleting an account
  -- nulls redeemed_by but must not make its keys redeemable again.
  update public.license_keys
     set redeemed_by = v_uid, redeemed_at = now()
   where key = upper(btrim(coalesce(p_key, '')))
     and redeemed_at is null
  returning plan_id, days into v_plan, v_days;

  if v_plan is null then
    raise exception 'That key is invalid or already used.' using errcode = 'P0001';
  end if;

  v_exp := public.apply_plan(v_uid, v_plan, v_days);
  return json_build_object('plan', (select name from public.plans where id = v_plan), 'expires_at', v_exp);
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner-only: make keys to give away or sell elsewhere. In the SQL Editor:
--   select * from public.create_keys('month', 5);
-- ---------------------------------------------------------------------------
create or replace function public.create_keys(p_plan text, p_count integer default 1)
returns table (key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_key  text;
  i      integer;
begin
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'unknown plan %, use week, month or lifetime', p_plan;
  end if;
  select days into v_days from public.plans where id = p_plan;
  for i in 1..greatest(1, least(coalesce(p_count, 1), 500)) loop
    loop
      begin
        v_key := public.new_license_key();
        insert into public.license_keys (key, plan_id, days) values (v_key, p_plan, v_days);
        exit;
      exception when unique_violation then
        -- key collision: draw another
      end;
    end loop;
    key := v_key;
    return next;
  end loop;
end;
$$;

-- Lock the functions down: only redeem_key is open to logged-in customers.
revoke execute on function public.new_license_key()                 from public, anon, authenticated;
revoke execute on function public.apply_plan(uuid, text, integer)   from public, anon, authenticated;
revoke execute on function public.fulfill_order(uuid, text)         from public, anon, authenticated;
revoke execute on function public.create_keys(text, integer)        from public, anon, authenticated;
revoke execute on function public.create_order(uuid, text)          from public, anon, authenticated;
grant  execute on function public.create_order(uuid, text)          to service_role;
revoke execute on function public.redeem_key(text)                  from public, anon;
grant  execute on function public.redeem_key(text)                  to authenticated;
grant  execute on function public.fulfill_order(uuid, text)         to service_role;
grant  execute on function public.apply_plan(uuid, text, integer)   to service_role;
grant  execute on function public.new_license_key()                 to service_role;
grant  execute on function public.create_keys(text, integer)        to service_role;
