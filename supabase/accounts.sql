-- Yolkie accounts: profiles, badges and "delete my account".
-- Run this once in the Supabase SQL editor, after setup.sql and admin.sql. Running it again is safe.
--
-- What it adds:
--   * public.profiles     one row per account: a display name and the sign-in email.
--   * public.user_badges  Tester, Early adopter, Developer and Owner badges. Only admins can give or take them.
--     (The Admin badge isn't stored here: it shows for anyone on public.admin_users.)
--   * A trigger that makes the profile, and gives the Early adopter badge, the moment someone signs up.
--   * public.delete_my_account(), so a signed-in person can erase their own account and everything tied to it.
--
-- The website only ever uses the publishable key plus the person's own login token, so these rules
-- are what keeps one person from seeing or changing anyone else's account.

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "People can see their own profile" on public.profiles;
create policy "People can see their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "Admins can see every profile" on public.profiles;
create policy "Admins can see every profile" on public.profiles
  for select to authenticated using ((select public.is_yolkie_admin()));
drop policy if exists "People can rename themselves" on public.profiles;
create policy "People can rename themselves" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- Badges ----------
create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge text not null check (badge in ('tester', 'early_adopter', 'developer', 'owner')),
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;

revoke all on public.user_badges from anon, authenticated;
grant select, insert, delete on public.user_badges to authenticated;

drop policy if exists "People can see their own badges" on public.user_badges;
create policy "People can see their own badges" on public.user_badges
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admins can see every badge" on public.user_badges;
create policy "Admins can see every badge" on public.user_badges
  for select to authenticated using ((select public.is_yolkie_admin()));
drop policy if exists "Admins can give badges" on public.user_badges;
create policy "Admins can give badges" on public.user_badges
  for insert to authenticated with check ((select public.is_yolkie_admin()));
drop policy if exists "Admins can take badges away" on public.user_badges;
create policy "Admins can take badges away" on public.user_badges
  for delete to authenticated using ((select public.is_yolkie_admin()));

-- Admins see the whole admin list, so the People tab can show who has the Admin badge.
drop policy if exists "Admins can see the admin list" on public.admin_users;
create policy "Admins can see the admin list" on public.admin_users
  for select to authenticated using ((select public.is_yolkie_admin()));

-- ---------- New sign-ups ----------
-- Takes a name from the sign-up form, or from GitHub, Google or Apple, or else the start of the email.
-- Everyone who joins before launch is an early adopter. Remove the second insert after launch.
create or replace function public.handle_new_yolkie_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nice_name text := left(nullif(trim(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name',
    meta ->> 'user_name', split_part(coalesce(new.email, ''), '@', 1))), ''), 40);
begin
  insert into public.profiles (id, email, display_name) values (new.id, new.email, nice_name)
    on conflict (id) do nothing;
  insert into public.user_badges (user_id, badge) values (new.id, 'early_adopter')
    on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_yolkie_user_created on auth.users;
create trigger on_yolkie_user_created
  after insert on auth.users
  for each row execute function public.handle_new_yolkie_user();

-- Accounts that already exist (like yours) get a profile and the Early adopter badge too.
insert into public.profiles (id, email, display_name)
  select id, email, left(nullif(trim(coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name',
    split_part(coalesce(email, ''), '@', 1))), ''), 40)
  from auth.users
  on conflict (id) do nothing;
insert into public.user_badges (user_id, badge)
  select id, 'early_adopter' from auth.users
  on conflict do nothing;

-- ---------- Delete my account ----------
-- Removes the signed-in person's login. Their profile, badges and any admin access go with it,
-- because those tables point at auth.users with "on delete cascade". Waitlist and feedback rows
-- aren't tied to accounts, so they stay (the privacy page says how to ask for those to go).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_yolkie_user() from public, anon, authenticated;

-- ---------- Giving badges by hand ----------
-- The admin page's People tab does this with buttons. In SQL it's:
--   insert into public.user_badges (user_id, badge)
--     select id, 'owner' from auth.users where email = 'you@example.com' on conflict do nothing;
