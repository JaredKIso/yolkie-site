-- Yolkie: waitlist and feedback storage.
-- Paste this whole file into the Supabase SQL editor (Dashboard → SQL Editor → New query) and press Run.
-- It's safe to run again: everything is created only if it doesn't exist yet, and policies are replaced.
--
-- The website only ever uses the public "anon" key. With the rules below, that key can ADD rows and
-- upload screenshots, but it can't read, change or delete anything. You read submissions in the
-- dashboard, which uses your own login and isn't limited by these rules.


-- 1. The waitlist -----------------------------------------------------------------------------------

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- Stored in lowercase, so "Sam@Example.com" and "sam@example.com" count as the same person.
  email       text not null unique
              check (email = lower(email) and char_length(email) between 6 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  -- "What would make Yolkie a must-have for you?" (optional)
  must_have   text check (char_length(must_have) <= 2000),
  -- Where the sign-up came from: the landing page form, or the landing page reached from the help page.
  source      text not null default 'landing' check (source in ('landing', 'help'))
);


-- 2. Feedback ---------------------------------------------------------------------------------------

create table if not exists public.feedback (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  -- The only required answer: 1 to 5 stars.
  rating            smallint not null check (rating between 1 and 5),
  -- "What did you try?" Only these answers are allowed.
  tried             text[] not null default '{}'
                    check (tried <@ array['Picking a meal', 'What do you already have?', 'Diet and restrictions',
                      'Shopping list', 'Cook mode', 'Nutrition or water tracker', 'Progress and weekly goals',
                      'Yolkie''s Closet', 'Yolkie''s Kitchen', 'Collection', 'Household and house vote', 'Help page']::text[]),
  kind              text check (kind in ('bug', 'idea', 'both', 'neither')),
  what_happened     text check (char_length(what_happened) <= 2000),
  device            text check (device in ('iPhone', 'Android phone', 'Tablet', 'Computer')),
  idea              text check (char_length(idea) <= 2000),
  anything_else     text check (char_length(anything_else) <= 2000),
  email             text check (email = lower(email) and char_length(email) <= 254),
  -- Paths of uploaded files inside the "feedback-screenshots" bucket. Three at most.
  screenshot_paths  text[] not null default '{}' check (cardinality(screenshot_paths) <= 3),
  -- Which page the form was opened from (for example "try" or "help"), and the site version.
  page              text check (char_length(page) <= 200),
  app_version       text check (char_length(app_version) <= 40),
  -- A bug report needs "What happened?", and an idea needs "What's your idea?".
  constraint feedback_bug_has_text  check (kind not in ('bug', 'both') or char_length(coalesce(what_happened, '')) > 0),
  constraint feedback_idea_has_text check (kind not in ('idea', 'both') or char_length(coalesce(idea, '')) > 0)
);


-- 3. Who may do what --------------------------------------------------------------------------------
-- Row Level Security: with it on, nobody using the public key can do anything a policy doesn't allow.

alter table public.waitlist enable row level security;
alter table public.feedback enable row level security;

-- Visitors (the "anon" role) may add rows. There are no select, update or delete policies, so they
-- can't read the list, change it or remove anything.
drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist" on public.waitlist
  for insert to anon with check (true);

drop policy if exists "Anyone can send feedback" on public.feedback;
create policy "Anyone can send feedback" on public.feedback
  for insert to anon with check (true);

-- Belt and braces: the table permissions match the policies.
revoke all on public.waitlist, public.feedback from anon;
grant insert on public.waitlist, public.feedback to anon;


-- 4. Screenshots ------------------------------------------------------------------------------------
-- A private bucket (not public, so files have no public link). Images and videos only, 10 MB each.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 10485760, array['image/*', 'video/*'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/*', 'video/*'];

-- Visitors may upload into this bucket and nothing else: no reading, listing, replacing or deleting.
drop policy if exists "Anyone can upload feedback screenshots" on storage.objects;
create policy "Anyone can upload feedback screenshots" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'feedback-screenshots'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'mp4', 'mov', 'webm')
  );
