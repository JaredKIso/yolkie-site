# Yolkie's waitlist, feedback and accounts (Supabase)

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

## Accounts (account.html)

Anyone can make a Yolkie account with **GitHub**, **Google**, **Apple** or an **email and password**.
The account page only shows the ways in that are switched on in Supabase, so you can turn them on one
at a time. An account holds a name and badges (Tester, Early adopter, Developer, Owner and Admin);
the demo itself still saves on the device. Signing in uses the same publishable key as the forms,
never the secret key.

1. **Run the accounts script.** In **SQL Editor → New query**, paste all of `accounts.sql` and press
   **Run** (after `setup.sql` and `admin.sql`). It adds profiles, badges, the "Delete my account"
   function, and a trigger that gives every new account a profile and the Early adopter badge.
   Accounts that already exist, like yours, get both too.
2. **Let people back in after signing in.** In **Authentication → URL Configuration**, set **Site URL**
   to `https://yolkie.isolatedideas.dev` and add these **Redirect URLs**:
   - `https://yolkie.isolatedideas.dev/account.html`
   - `http://127.0.0.1:8781/account.html` (only if you also test it on your computer)

   You can remove the old `admin.html` redirect URLs: the admin page now sends people to the account
   page to sign in.
3. **Allow sign-ups.** In **Authentication → Sign In / Providers**, turn **Allow new users to sign up**
   back on. That's safe for the admin page: only people on the admin list can see anything there.
4. **Switch on the ways in you want** (each is free unless it says otherwise). The callback URL each
   provider asks for is shown on its Supabase panel, and looks like
   `https://<project>.supabase.co/auth/v1/callback`.
   - **Email and password:** in **Sign In / Providers → Email**, keep it on and keep **Confirm email**
     on. Supabase's built-in email only sends a few emails an hour, so set up your own sender first:
     **Authentication → Emails → SMTP Settings** (Resend, Postmark or similar; Resend has a free tier).
   - **GitHub:** on GitHub, **Settings → Developer settings → OAuth Apps → New OAuth App**. Homepage URL
     `https://yolkie.isolatedideas.dev`, callback URL from Supabase. Paste its Client ID and a new
     client secret into **Providers → GitHub** and switch it on.
   - **Google:** in Google Cloud Console, make a project, set up the **OAuth consent screen** (app name
     Yolkie, your email, the privacy page `https://yolkie.isolatedideas.dev/privacy.html`), then
     **Credentials → Create credentials → OAuth client ID → Web application** with the Supabase
     callback URL as an authorised redirect URI. Paste the Client ID and secret into
     **Providers → Google**.
   - **Apple:** needs a paid Apple Developer account ($99 a year). Make a **Services ID** for Sign in
     with Apple, add the domain and the Supabase callback URL, and make a **key** for Sign in with
     Apple. Supabase's **Providers → Apple** panel walks through which values go where. Fine to leave
     until there's an iPhone app.
5. **Keep bots out (recommended before inviting people).** Make a free **Cloudflare Turnstile** widget
   for `yolkie.isolatedideas.dev` (and `127.0.0.1` for testing). It gives two keys:
   - the **site key** is public: send it to us and it goes in `TURNSTILE_SITE_KEY` near the top of the
     Yolkie section of `main.js`;
   - the **secret key** goes only in Supabase, under **Authentication → Attack Protection → Enable
     CAPTCHA protection** (provider: Turnstile). Never put it in the website.

   Put the site key in `main.js` and publish *before* switching CAPTCHA on in Supabase, or email
   sign-in will refuse everyone until the site catches up. GitHub, Google and Apple sign-ins don't
   need it.

**Badges.** Give or take Tester, Early adopter, Developer and Owner on the admin page's **People** tab.
The Admin badge shows by itself for anyone on the admin list. After launch, remove the Early adopter
line from `handle_new_yolkie_user()` in `accounts.sql` and run that function again, so new accounts
stop getting it.

**Deleting an account.** People do it themselves from the account page. It erases their login,
profile and badges (and admin access, if they had it). Waitlist and feedback rows aren't tied to an
account, so if someone asks for those to go, delete them in the Table Editor.

## The admin page (admin.html)

A private page for reading sign-ups and feedback, changing a note's status, adding private notes, and
giving badges. It isn't linked from the site, search engines are asked to skip it, and it only shows
data to people on your admin list. It never uses the secret key: admins sign in on the account page
like everyone else, and the page then checks the admin list.

1. **Run the admin script.** In **SQL Editor → New query**, paste all of `admin.sql` and press **Run**.
   It adds the admin list, the read-only-for-admins rules, the screenshot viewing rule, and the
   `status` and `notes` columns on feedback.
2. **Sign in once** on `account.html`, any way you like. Opening `admin.html` now says "This page is
   for the Yolkie team", because you're not on the list yet.

   **Optional lock check.** Right now you're signed in but not an admin, which is exactly what a
   stranger with an account would be. Open the browser console on that page (F12 → Console), paste
   this, and press Enter:

   ```js
   const s = JSON.parse(localStorage.getItem('yolkie-session'));
   const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
   for (const [name, path, opts] of [
     ['waitlist', '/rest/v1/waitlist?select=*'],
     ['feedback', '/rest/v1/feedback?select=*'],
     ['admin list', '/rest/v1/admin_users?select=*'],
     ['other profiles', `/rest/v1/profiles?select=*&id=neq.${JSON.parse(atob(s.access_token.split('.')[1])).sub}`],
     ['give myself a badge', '/rest/v1/user_badges', { method: 'POST', body: JSON.stringify({ user_id: JSON.parse(atob(s.access_token.split('.')[1])).sub, badge: 'owner' }) }],
     ['change a rating', '/rest/v1/feedback?id=not.is.null', { method: 'PATCH', body: '{"rating":1}' }],
     ['screenshots', '/storage/v1/object/list/feedback-screenshots', { method: 'POST', body: '{"prefix":"","limit":10}' }],
   ]) { const r = await fetch(SUPABASE_URL + path, { ...opts, headers: h }); console.log(name, r.status, await r.text()); }
   ```

   Every line should come back empty (`[]`), or as "permission denied" or "row-level security".
   If any line shows real emails, feedback, other people's names or file names, stop and tell us.
   Only run this before step 3: once you're an admin, most lines will (correctly) show everything.
3. **Make yourself an admin.** Back in the SQL editor, run this line with your own email:

   ```sql
   insert into public.admin_users (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
   ```

   Reload `admin.html` and the dashboard appears. To add another admin, have them make an account,
   then run the same line with their email.

Signing in on a shared computer? Use **Sign out** when you're done.

## What the website sends

| Form | Table | Fields |
|---|---|---|
| Waitlist | `waitlist` | `email` (lowercased), `must_have`, `source` (`landing` or `help`) |
| Feedback | `feedback` | `rating`, `tried`, `kind`, `what_happened`, `device`, `idea`, `anything_else`, `email`, `screenshot_paths`, `page`, `app_version` |
| Account page | `profiles` | `display_name` (people can change their own name, nothing else) |

Both forms also have a hidden spam trap and send at most once every 30 seconds per browser.
Nothing typed into them is written to the browser console.
