-- Yolkie: let the waitlist record sign-ups made from the demo's Done screen as source "demo".
-- Run after setup.sql. Paste the whole file into the Supabase SQL editor and press Run. It's safe to run again.
-- Until it runs, the site saves those sign-ups as "landing" instead, so nobody's sign-up is lost.

alter table public.waitlist drop constraint if exists waitlist_source_check;
alter table public.waitlist add constraint waitlist_source_check check (source in ('landing', 'help', 'demo'));
