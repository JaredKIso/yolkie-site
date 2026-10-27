-- Yolkie accounts: profiles, badges and "delete my account".
-- Run this once in the Supabase SQL editor, after setup.sql and admin.sql. Running it again is safe.
--
-- What it adds:
--   * public.profiles     one row per account: a display name and the sign-in email.
--   * public.user_badges  Tester, Early adopter, Developer and Owner badges. Only admins can give or take them.
--     (The Admin badge isn't stored here: it shows for anyone on public.admin_users.)
--   * public.badge_invites  badges waiting for an email address: accepting someone from the waitlist or
--     from a feedback note puts "tester" here, and they get it the moment they sign up with that email.
--   * A trigger that makes the profile, and gives the Early adopter badge (plus any waiting badges), the
--     moment someone signs up.
--   * public.delete_my_account(), so a signed-in person can erase their own account and everything tied to it.
--   * Two-step sign-in (2FA): backup codes, remembered browsers, and admins needing 2FA.
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

-- ---------- Badges waiting for someone to sign up ----------
create table if not exists public.badge_invites (
  email text not null check (email = lower(email) and char_length(email) <= 254),
  badge text not null check (badge in ('tester', 'early_adopter', 'developer', 'owner')),
  created_at timestamptz not null default now(),
  primary key (email, badge)
);
alter table public.badge_invites enable row level security;

revoke all on public.badge_invites from anon, authenticated;
grant select, insert, delete on public.badge_invites to authenticated;

drop policy if exists "Admins can see waiting badges" on public.badge_invites;
create policy "Admins can see waiting badges" on public.badge_invites
  for select to authenticated using ((select public.is_yolkie_admin()));
drop policy if exists "Admins can add waiting badges" on public.badge_invites;
create policy "Admins can add waiting badges" on public.badge_invites
  for insert to authenticated with check ((select public.is_yolkie_admin()));
drop policy if exists "Admins can remove waiting badges" on public.badge_invites;
create policy "Admins can remove waiting badges" on public.badge_invites
  for delete to authenticated using ((select public.is_yolkie_admin()));

-- Admins see the whole admin list, so the People tab can show who has the Admin badge.
drop policy if exists "Admins can see the admin list" on public.admin_users;
create policy "Admins can see the admin list" on public.admin_users
  for select to authenticated using ((select public.is_yolkie_admin()));

-- ---------- New sign-ups ----------
-- Takes a name from the sign-up form, or from GitHub, Google or Apple, or else the start of the email.
-- Everyone who joins before launch is an early adopter: remove the second insert after launch.
-- The third hands over any badges waiting for their email (a waitlist or feedback "make tester").
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
  insert into public.user_badges (user_id, badge)
    select new.id, i.badge from public.badge_invites i where i.email = lower(new.email)
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

-- ---------- Two-step sign-in (2FA) ----------
-- The authenticator app itself is Supabase's own (auth.mfa_factors): a code from the app raises the
-- login to "aal2". Supabase has no backup codes or remembered devices, so those live here:
--   * public.mfa_backup_codes  ten one-time codes per person, stored scrambled (bcrypt), never readable.
--   * public.trusted_devices   a 30-day pass for one browser, stored as a SHA-256 of a random token.
--     The browser sends the token in an "x-yolkie-device" header with each request.
--   * public.mfa_attempts      wrong backup codes, so guessing is cut off after 5 tries in 15 minutes.
-- None of these tables can be read or changed from the website; only the functions below touch them.
create table if not exists public.mfa_backup_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.trusted_devices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.mfa_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
alter table public.mfa_backup_codes enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.mfa_attempts enable row level security;
revoke all on public.mfa_backup_codes, public.trusted_devices, public.mfa_attempts from anon, authenticated;

-- Has this person turned 2FA on (a verified authenticator)?
create or replace function public.yolkie_has_2fa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified');
$$;

-- Is this browser remembered (a pass that hasn't run out)?
create or replace function public.yolkie_device_trusted()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trusted_devices
    where user_id = (select auth.uid()) and expires_at > now()
      and token_hash = encode(extensions.digest(
        coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-yolkie-device', ''), 'sha256'), 'hex'));
$$;

-- Has this login passed 2FA? True with an app code this session, on a remembered browser, or for
-- anyone who hasn't turned 2FA on.
create or replace function public.yolkie_mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
      or not public.yolkie_has_2fa()
      or public.yolkie_device_trusted();
$$;

-- Admins must have 2FA on and have passed it. This replaces the simpler check from admin.sql, so
-- every admin-only rule (feedback, waitlist, people, screenshots) now needs it too. If you ever run
-- admin.sql again, run this file again afterwards.
create or replace function public.is_yolkie_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()))
     and public.yolkie_has_2fa()
     and public.yolkie_mfa_ok();
$$;

-- For the pages: 'admin', 'needs_2fa' (on the list, but 2FA is off or not passed yet), or 'no'.
create or replace function public.yolkie_admin_status()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then 'no'
    when public.is_yolkie_admin() then 'admin'
    else 'needs_2fa' end;
$$;

-- A new pass for this browser. Needs an app code this session.
create or replace function public.trust_this_device()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then raise exception 'Enter a code from your app first'; end if;
  delete from public.trusted_devices where user_id = auth.uid() and expires_at < now();
  insert into public.trusted_devices (user_id, token_hash, expires_at)
    values (auth.uid(), encode(extensions.digest(token, 'sha256'), 'hex'), now() + interval '30 days');
  return token;
end;
$$;

-- Forget every remembered browser (for example after losing a laptop).
create or replace function public.forget_my_devices()
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.trusted_devices where user_id = (select auth.uid());
$$;

-- A fresh set of ten backup codes, shown once. Replaces any old ones. Needs 2FA on and passed.
create or replace function public.create_backup_codes()
returns text[] language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  codes text[] := '{}';
  raw bytea;
  code text;
begin
  if not public.yolkie_has_2fa() or not public.yolkie_mfa_ok() then raise exception 'Turn on 2FA first'; end if;
  delete from public.mfa_backup_codes where user_id = auth.uid();
  for n in 1..10 loop
    raw := extensions.gen_random_bytes(10);
    code := '';
    for i in 0..9 loop
      code := code || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
    end loop;
    code := substr(code, 1, 5) || '-' || substr(code, 6, 5);
    codes := codes || code;
    insert into public.mfa_backup_codes (user_id, code_hash) values (auth.uid(), extensions.crypt(code, extensions.gen_salt('bf', 8)));
  end loop;
  return codes;
end;
$$;

create or replace function public.backup_codes_left()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.mfa_backup_codes where user_id = (select auth.uid()) and used_at is null;
$$;

-- Use a backup code in place of an app code. Returns a pass for this browser: 30 days when they ask
-- to be remembered, otherwise 12 hours. Wrong codes count towards the 5-in-15-minutes limit.
create or replace function public.use_backup_code(code text, remember boolean default false)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  clean text := lower(regexp_replace(coalesce(code, ''), '[^a-zA-Z0-9]', '', 'g'));
  hit bigint;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if (select count(*) from public.mfa_attempts where user_id = auth.uid() and at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_tries';
  end if;
  clean := substr(clean, 1, 5) || '-' || substr(clean, 6, 5);
  select id into hit from public.mfa_backup_codes
    where user_id = auth.uid() and used_at is null and code_hash = extensions.crypt(clean, code_hash)
    limit 1;
  if hit is null then
    -- Return instead of raising: an exception would roll back this insert, and the 5-tries limit
    -- would never count. The page reads a null result as a wrong code.
    insert into public.mfa_attempts (user_id) values (auth.uid());
    return null;
  end if;
  update public.mfa_backup_codes set used_at = now() where id = hit;
  delete from public.mfa_attempts where user_id = auth.uid();
  insert into public.trusted_devices (user_id, token_hash, expires_at)
    values (auth.uid(), encode(extensions.digest(token, 'sha256'), 'hex'),
            now() + case when remember then interval '30 days' else interval '12 hours' end);
  return token;
end;
$$;

-- Turn 2FA off: removes the authenticator, the backup codes and the remembered browsers. Needs 2FA
-- passed first (an app code, a backup code, or a remembered browser), so a stolen password can't do it.
create or replace function public.turn_off_my_2fa()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.yolkie_has_2fa() and not public.yolkie_mfa_ok() then raise exception 'Pass 2FA first'; end if;
  delete from auth.mfa_factors where user_id = auth.uid();
  delete from public.mfa_backup_codes where user_id = auth.uid();
  delete from public.trusted_devices where user_id = auth.uid();
end;
$$;

revoke all on function public.yolkie_has_2fa(), public.yolkie_device_trusted(), public.yolkie_mfa_ok(),
  public.yolkie_admin_status(), public.trust_this_device(), public.forget_my_devices(), public.create_backup_codes(),
  public.backup_codes_left(), public.use_backup_code(text, boolean), public.turn_off_my_2fa() from public, anon;
grant execute on function public.yolkie_has_2fa(), public.yolkie_device_trusted(), public.yolkie_mfa_ok(),
  public.yolkie_admin_status(), public.trust_this_device(), public.forget_my_devices(), public.create_backup_codes(),
  public.backup_codes_left(), public.use_backup_code(text, boolean), public.turn_off_my_2fa() to authenticated;

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
declare
  who text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not public.yolkie_mfa_ok() then
    raise exception 'Pass 2FA first';
  end if;
  -- Things kept by email address rather than by account go too: a waiting tester invite, and the
  -- team's copies of emails sent to this address (supabase/email.sql, if it's been run).
  select lower(email) into who from auth.users where id = auth.uid();
  if who is not null then
    delete from public.badge_invites where lower(email) = who;
    if to_regclass('public.email_log') is not null then
      execute 'delete from public.email_log where lower(to_email) = $1' using who;
    end if;
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
