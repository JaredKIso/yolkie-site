-- Yolkie: recipe removal requests, and the list of recipes the team has hidden.
-- Run after setup.sql and accounts.sql (it uses public.is_yolkie_admin()). Paste the whole file into
-- the Supabase SQL editor and press Run. It's safe to run again.
--
--   * removal_requests: a creator asks for a recipe to come out of the demo (request-removal.html).
--     Visitors may only add a request. Admins (with 2FA passed) can read them and set the status.
--   * hidden_recipes: recipe ids the demo skips. Anyone can read the list (the demo needs it, and it's
--     just ids); only admins can add or remove ids, from the admin page's "Removal requests" section.


-- 1. Removal requests ---------------------------------------------------------------------------------

create table if not exists public.removal_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  creator     text not null check (char_length(creator) between 1 and 120),
  recipes     text not null check (char_length(recipes) between 1 and 1000),
  -- The demo's ids for the recipes, when the form was opened from a recipe. Twenty at most.
  recipe_ids  text[] not null default '{}' check (cardinality(recipe_ids) <= 20),
  link        text not null check (char_length(link) between 8 and 500 and link ~* '^https?://'),
  email       text not null check (email = lower(email) and char_length(email) between 6 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  message     text check (char_length(message) <= 2000),
  status      text not null default 'new' check (status in ('new', 'removed', 'declined')),
  handled_at  timestamptz
);
alter table public.removal_requests enable row level security;

revoke all on public.removal_requests from anon, authenticated;
-- Visitors may only add a request, and only these columns (never the status).
grant insert (creator, recipes, recipe_ids, link, email, message) on public.removal_requests to anon, authenticated;
grant select, update (status, handled_at) on public.removal_requests to authenticated;

drop policy if exists "Anyone can ask for a recipe to be removed" on public.removal_requests;
create policy "Anyone can ask for a recipe to be removed" on public.removal_requests
  for insert to anon, authenticated with check (status = 'new');
drop policy if exists "Admins can read removal requests" on public.removal_requests;
create policy "Admins can read removal requests" on public.removal_requests
  for select to authenticated using ((select public.is_yolkie_admin()));
drop policy if exists "Admins can update removal requests" on public.removal_requests;
create policy "Admins can update removal requests" on public.removal_requests
  for update to authenticated using ((select public.is_yolkie_admin())) with check ((select public.is_yolkie_admin()));


-- 2. Hidden recipes -----------------------------------------------------------------------------------

create table if not exists public.hidden_recipes (
  recipe_id   text primary key check (char_length(recipe_id) between 1 and 80),
  hidden_at   timestamptz not null default now(),
  hidden_by   uuid default auth.uid(),
  request_id  uuid references public.removal_requests (id) on delete set null
);
alter table public.hidden_recipes enable row level security;

revoke all on public.hidden_recipes from anon, authenticated;
grant select (recipe_id) on public.hidden_recipes to anon, authenticated;
grant insert (recipe_id, request_id), delete on public.hidden_recipes to authenticated;

drop policy if exists "Anyone can see which recipes are hidden" on public.hidden_recipes;
create policy "Anyone can see which recipes are hidden" on public.hidden_recipes
  for select to anon, authenticated using (true);
drop policy if exists "Admins can hide recipes" on public.hidden_recipes;
create policy "Admins can hide recipes" on public.hidden_recipes
  for insert to authenticated with check ((select public.is_yolkie_admin()));
drop policy if exists "Admins can unhide recipes" on public.hidden_recipes;
create policy "Admins can unhide recipes" on public.hidden_recipes
  for delete to authenticated using ((select public.is_yolkie_admin()));
