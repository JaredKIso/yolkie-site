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

## What the website sends

| Form | Table | Fields |
|---|---|---|
| Waitlist | `waitlist` | `email` (lowercased), `must_have`, `source` (`landing` or `help`) |
| Feedback | `feedback` | `rating`, `tried`, `kind`, `what_happened`, `device`, `idea`, `anything_else`, `email`, `screenshot_paths`, `page`, `app_version` |

Both forms also have a hidden spam trap and send at most once every 30 seconds per browser.
Nothing typed into them is written to the browser console.
