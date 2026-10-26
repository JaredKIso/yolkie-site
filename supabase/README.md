# Yolkie's waitlist and feedback (Supabase)

The waitlist form on the landing page and the feedback page (`feedback.html`) save straight into a
Supabase project. This folder holds the one-time setup.

## What you need

- A free Supabase account and a project (any region).
- Two values from that project, which go at the top of the Yolkie section of `main.js`:
  - `SUPABASE_URL`: the Project URL, like `https://abcdefgh.supabase.co`.
  - `SUPABASE_ANON_KEY`: the **anon / public** key (or the newer **publishable** key, which starts `sb_publishable_`).

Never put the **service_role** (or **secret**) key in the website. It skips every safety rule below,
and anything in `main.js` can be read by anyone.

## Setup, step by step

1. **Create the project.** In the Supabase dashboard, choose **New project**, give it a name and a
   database password (keep that somewhere safe; the website doesn't need it), and wait a minute
   for it to start.
2. **Run the setup script.** Open **SQL Editor → New query**, paste in all of `setup.sql`, and press
   **Run**. It creates:
   - a `waitlist` table and a `feedback` table,
   - rules so the website can only *add* rows (never read, change or delete them),
   - limits on answer lengths and the star rating,
   - a private `feedback-screenshots` storage bucket that takes images and videos up to 10 MB.

   Running it again later is safe.
3. **Copy the two values.** Go to **Project Settings → Data API** for the Project URL, and
   **Project Settings → API Keys** for the anon (or publishable) key.
4. **Paste them into `main.js`.** Near the top of the Yolkie section:

   ```js
   const SUPABASE_URL = 'https://abcdefgh.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ…';
   ```

5. **Try it.** Join the waitlist on the landing page and send a test feedback note, then check they
   arrived (see below). While the two values are empty, both forms show a friendly
   "can't send right now" message and keep what was typed.

## Reading what people sent

- **Sign-ups and feedback:** **Table Editor** → `waitlist` or `feedback`. Newest rows are at the
  bottom; click **created_at** to sort. **Export → CSV** downloads a copy.
- **Screenshots:** **Storage** → `feedback-screenshots`. A feedback row's `screenshot_paths` column
  names its files, for example `2026-10-25/3f2c….png`. Click a file to preview or download it. The
  bucket is private, so files have no public link.
- **Removing a row:** select it in the Table Editor and delete it. If someone asks to be taken off
  the waitlist, this is how.

## The admin page (admin.html)

A private page for reading sign-ups and feedback, changing a note's status and adding private notes.
It isn't linked from the site, search engines are asked to skip it, and it only shows data to people
on your admin list. It never uses the secret key: you sign in with a magic link sent to your email.

1. **Allow the sign-in link to come back to the page.** In **Authentication → URL Configuration**, set
   **Site URL** to `https://yolkie.isolatedideas.dev` and add these to **Redirect URLs**:
   - `https://yolkie.isolatedideas.dev/admin.html`
   - `http://127.0.0.1:8781/admin.html` (only if you also test it on your computer)
2. **Run the admin script.** In **SQL Editor → New query**, paste all of `admin.sql` and press **Run**.
   It adds the admin list, the read-only-for-admins rules, the screenshot viewing rule, and the
   `status` and `notes` columns on feedback.
3. **Sign in once.** Open `admin.html`, enter your email and tap the link in the email. The page will
   say "This page is for the Yolkie team", because you're not on the list yet.

   **Optional lock check.** Right now you're signed in but not an admin, which is exactly what a
   stranger with an account would be. Open the browser console on that page (F12 → Console), paste
   this, and press Enter:

   ```js
   const s = JSON.parse(localStorage.getItem('yolkie-admin-session'));
   const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
   for (const [name, path, opts] of [
     ['waitlist', '/rest/v1/waitlist?select=*'],
     ['feedback', '/rest/v1/feedback?select=*'],
     ['admin list', '/rest/v1/admin_users?select=*'],
     ['change a rating', '/rest/v1/feedback?id=not.is.null', { method: 'PATCH', body: '{"rating":1}' }],
     ['screenshots', '/storage/v1/object/list/feedback-screenshots', { method: 'POST', body: '{"prefix":"","limit":10}' }],
   ]) { const r = await fetch(SUPABASE_URL + path, { ...opts, headers: h }); console.log(name, r.status, await r.text()); }
   ```

   Every line should come back empty (`[]`) or as "permission denied". If any line shows real
   emails, feedback or file names, stop and tell us. Only run this before step 4: once you're an
   admin, the first two lines will (correctly) show everything.
4. **Make yourself an admin.** Back in the SQL editor, run this line with your own email:

   ```sql
   insert into public.admin_users (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
   ```

   Reload `admin.html` and the dashboard appears.
5. **Close the door.** In **Authentication → Sign In / Providers** (on older dashboards,
   **Authentication → Settings**), turn off **Allow new users to sign up**. From then on, only people
   who already have an account can get a sign-in link. To add another admin later, turn it back on
   briefly, have them sign in once, run step 4 with their email, then turn it off again.

Signing in on a shared computer? Use **Sign out** when you're done.

## What the website sends

| Form | Table | Fields |
|---|---|---|
| Waitlist | `waitlist` | `email` (lowercased), `must_have`, `source` (`landing` or `help`) |
| Feedback | `feedback` | `rating`, `tried`, `kind`, `what_happened`, `device`, `idea`, `anything_else`, `email`, `screenshot_paths`, `page`, `app_version` |

Both forms also have a hidden spam trap and send at most once every 30 seconds per browser.
Nothing typed into them is written to the browser console.
