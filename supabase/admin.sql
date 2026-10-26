-- Yolkie: the private admin page (admin.html).
-- Run this once in the Supabase SQL editor, after setup.sql. It's safe to run again.
--
-- What it does: makes a list of admins, lets ONLY those admins read the waitlist, the feedback and the
-- screenshots, and lets them change a feedback note's status and private notes (nothing else).
-- Visitors (the public key) still can only add rows, exactly as before. The admin page never uses the
-- secret / service_role key: admins sign in with a magic link and use their own login.


-- 1. Who counts as an admin -------------------------------------------------------------------------

create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Nobody using the public key may touch this table at all. Signed-in users may only check their own
-- row (so the page can tell whether you're an admin); nobody can add, change or remove rows from the
-- website. You add admins in the SQL editor (step 5).
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
drop policy if exists "Users can see their own admin row" on public.admin_users;
create policy "Users can see their own admin row" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

-- One yes/no check the policies below share. It runs with the table owner's rights so policies can use
-- it without looping, and it only ever answers about the person asking.
create or replace function public.is_yolkie_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_yolkie_admin() from public, anon;
grant execute on function public.is_yolkie_admin() to authenticated;


-- 2. Status and private notes on feedback ------------------------------------------------------------

alter table public.feedback add column if not exists status text not null default 'new';
alter table public.feedback add column if not exists notes text;
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check check (status in ('new', 'reviewing', 'done'));
alter table public.feedback drop constraint if exists feedback_notes_length;
alter table public.feedback add constraint feedback_notes_length check (char_length(notes) <= 4000);

-- Visitors can't set these when they send feedback: their insert permission covers the original columns
-- only, so every new note starts as "new" with no notes.
revoke insert on public.feedback from anon;
grant insert (rating, tried, kind, what_happened, device, idea, anything_else, email, screenshot_paths, page, app_version)
  on public.feedback to anon;


-- 3. Reading and updating, admins only ---------------------------------------------------------------

-- Table permissions for signed-in users: read both tables, and update only status and notes on feedback.
-- Row Level Security then narrows that to admins.
revoke all on public.waitlist, public.feedback from authenticated;
grant select on public.waitlist, public.feedback to authenticated;
grant update (status, notes) on public.feedback to authenticated;

drop policy if exists "Admins can read the waitlist" on public.waitlist;
create policy "Admins can read the waitlist" on public.waitlist
  for select to authenticated using ((select public.is_yolkie_admin()));

drop policy if exists "Admins can read feedback" on public.feedback;
create policy "Admins can read feedback" on public.feedback
  for select to authenticated using ((select public.is_yolkie_admin()));

-- The column permissions above limit this to status and notes.
drop policy if exists "Admins can update feedback status and notes" on public.feedback;
create policy "Admins can update feedback status and notes" on public.feedback
  for update to authenticated
  using ((select public.is_yolkie_admin()))
  with check ((select public.is_yolkie_admin()));


-- 4. Screenshots, admins only ------------------------------------------------------------------------
-- Admins may view files in the private bucket (the page makes links that expire after a few minutes).
-- Nobody else can read or list them. Visitors keep their upload-only rule from setup.sql.

drop policy if exists "Admins can view feedback screenshots" on storage.objects;
create policy "Admins can view feedback screenshots" on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback-screenshots' and (select public.is_yolkie_admin()));


-- 5. Make yourself an admin --------------------------------------------------------------------------
-- First sign in once on admin.html with your email (it will say the page is for the Yolkie team).
-- Then run this one line, with your own email in place of you@example.com:
--
--   insert into public.admin_users (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
--
-- Reload admin.html and you're in. To remove someone later:
--
--   delete from public.admin_users where user_id = (select id from auth.users where email = 'them@example.com');
