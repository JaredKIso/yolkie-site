-- Yolkie admin emails: a record of every email sent from the admin page.
-- Run this once in the Supabase SQL editor, after setup.sql, admin.sql and accounts.sql. Running it
-- again is safe.
--
-- The email itself is sent by the send-email Edge Function (supabase/functions/send-email), which holds
-- the Resend key. It writes one row here per email, as the admin who sent it, so the admin page can show
-- "Emailed on …" and the replies sent to a feedback note. Only admins (with 2FA passed) can read or add rows.

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users (id) on delete set null,
  to_email text not null check (char_length(to_email) <= 254),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  kind text not null check (kind in ('invite', 'reply')),
  ref_id text check (char_length(ref_id) <= 100),
  resend_id text
);
create index if not exists email_log_sent_at on public.email_log (sent_at desc);
alter table public.email_log enable row level security;

revoke all on public.email_log from anon, authenticated;
grant select, insert on public.email_log to authenticated;

drop policy if exists "Admins can see sent emails" on public.email_log;
create policy "Admins can see sent emails" on public.email_log
  for select to authenticated using ((select public.is_yolkie_admin()));
drop policy if exists "Admins can log emails they send" on public.email_log;
create policy "Admins can log emails they send" on public.email_log
  for insert to authenticated with check ((select public.is_yolkie_admin()) and sent_by = (select auth.uid()));
