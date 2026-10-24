# Yolkie: pre-launch site

A two-page static site for Yolkie, a cooking app for every meal that gets you from hungry to fed. Plain HTML, CSS and JavaScript with no build step. Style: Modernist, in the brand kit's colours (see `design-prompt.md`). Yolkie was called Tonight until the rename; a trademark clearance check is still pending.

## Files

| File | What it is |
|---|---|
| `index.html` | Landing page: hero, the problem, how it works, features, the ad, FAQ, early access |
| `try.html` | The working demo: pick a meal, check, cook, done, plus Yolkie's picks (the house vote). Runs fully in the browser |
| `404.html` | Not-found page. Links are root-relative (`/`); change them to `/repo/` if hosted at `username.github.io/repo/` |
| `styles.css` | One stylesheet for every page. Section 1 is the design tokens, section 3b is the demo |
| `main.js` | One script for every page. The Yolkie section starts with `WAITLIST_URL`, then the demo recipes (`RECIPES`) |
| `assets/mascots/` | The brand kit's mascot SVGs, copied unchanged. `yolk-*.svg` is Yolkie |
| `assets/app-icon.svg` | The brand kit's app icon, used as the logo in the header |
| `assets/yolkie-ad.mp4`, `assets/yolkie-ad-poster.jpg` | The ad and its poster frame (taken from 0:10.5 of the ad, "Meet Yolkie") |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | Browser and home-screen icons, all made from `app-icon.svg`. The Apple icon has square corners because iOS rounds them itself |
| `og-image.png` | 1200×630 link-preview image of the hero |
| `design-prompt.md` | The design brief the site was built against |
| `yolkie-brand-kit/`, `tonight-brand-kit/` | The current and the original brand kits. The pages don't use them, so leave both out when publishing |

## Settings worth knowing

- **Early access:** the sign-up card at the bottom of the home page (email, optional mealtime energy, optional note) sends to `WAITLIST_URL` at the top of the Yolkie section in `main.js`:
  - a form-service endpoint (`https://…`) that accepts a POST: the form sends the fields `email`, `energy` and `note`, and shows "You're on the list!" when the service answers OK;
  - or a `mailto:` link: the visitor's email app opens with the sign-up written out, ready to send.

  **Right now it's set to `'preview'`:** the form runs end to end (checks, Yolkie, confetti) but sends nothing, and the success message says "Preview mode: sign-ups aren't saved yet." Replace it with a real endpoint or `mailto:` before launch. If it's empty instead, the form says the list isn't open yet. Every "Get early access" button scrolls to the card. A hidden `company` field catches simple spam bots; submissions that fill it are dropped.
- **Recipes:** edit `RECIPES` in `main.js`. Each recipe has a `meal` (`breakfast`, `lunch`, `dinner` or `snack`), a `time` in minutes and an `effort` from 1 to 3; the demo suggests recipes for the chosen meal that fit the time and energy. Keep at least one quick, effort-1 recipe per meal so every combination has an answer. Each ingredient's `step` is the smallest amount it can be rounded to when the servings change (`1` keeps eggs whole, `0.5` gives half cans). Calories and protein are rough per-serving estimates.
- **Stored on the device only:** the demo keeps the cooking log (`yolkie-log`), the calories-and-protein switch (`yolkie-nutrition`) and the theme (`theme`) in `localStorage`. Nothing is sent anywhere.

## Run it locally

```bash
python -m http.server 8781
```

Then open http://localhost:8781/. Add `?theme=dark` or `?theme=light` to force a theme.

## Publishing

Live at https://yolkie.isolatedideas.dev/, served by GitHub Pages from the `main` branch of `JaredKIso/yolkie-site`. Pushing to `main` republishes it in about a minute.

- **Domain:** a Cloudflare DNS record, CNAME `yolkie` → `jaredkiso.github.io`, set to DNS only (grey cloud). GitHub commits a `CNAME` file for the custom domain, so pull before you push.
- **Absolute URLs:** `og:url`, `og:image` and the canonical link on both pages, plus `sitemap.xml` and `robots.txt`, use the domain. If the domain changes, update them and re-run the skill's `make_sitemap.py`.
- **Not published:** `.gitignore` keeps both brand-kit folders out of the repo.
