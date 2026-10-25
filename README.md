# Yolkie: pre-launch site

A two-page static site for Yolkie, a cooking app for every meal that gets you from hungry to fed. Plain HTML, CSS and JavaScript with no build step. Style: Modernist, in the brand kit's colours (see `design-prompt.md`). Yolkie was called Tonight until the rename; a trademark clearance check is still pending.

## Files

| File | What it is |
|---|---|
| `index.html` | Landing page: hero, the problem, how it works, features, the ad, FAQ, early access |
| `try.html` | The working demo, in four tabs. **Cook:** water, diet chip, check-in preview, "still got them?", pick a meal, who's eating, a cold-day switch, "what do you already have?", check, cook, done (card drop, stickers, ratings, kudos), plus Yolkie's picks (the house vote). **Me:** water, weekly goal, takeout dodged, fridge rescues, dishes dodged, passport, challenges, Yolkie's closet, Yolkie Wrapped and Yolkie's Kitchen. **House:** members and guests, linking (simulated), what's shared, house goal, recent meals and favorites. **Collection:** binder, sticker book and fridge door, friends, Pantry-dex, duplicates and crumbs. The gear opens Preferences (diets, never-show-me, allergies, household restrictions, hide nutrition, water, reminders, what Yolkie remembers, hidden meals, takeout cost, sample data). Runs fully in the browser |
| `404.html` | Not-found page. Links are root-relative (`/`); change them to `/repo/` if hosted at `username.github.io/repo/` |
| `styles.css` | One stylesheet for every page. Section 1 is the design tokens, 3b is the demo, 3c its extras, 3d the collection and household |
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
- **Recipes:** edit `RECIPES` in `main.js` (30 of them). `tags` says which friend a recipe unlocks (`avocado`, `bread`, `brunch`, `noodles`, `berries`) and marks soups (`soup`); each recipe also needs an entry in `CARDS` (food art, fun fact, silhouette hint). Each recipe has a `meal` (`breakfast`, `lunch`, `dinner` or `snack`), a `cuisine` (the passport stamps), `diet` tags (`vegetarian`, `vegan`, `pescatarian`, `gluten-free`, `dairy-free`; vegan implies vegetarian and dairy-free), `allergens`, and `nut` (carbs, fiber, fat, sugar in grams, sodium in mg). Keto (≤10 g net carbs), low-carb (≤25 g carbs) and high-protein (≥25 g protein) are worked out from the numbers. Keep at least two recipes per meal under each single diet. Each recipe also has a `time` in minutes and an `effort` from 1 to 3; the demo suggests recipes for the chosen meal that fit the time and energy. Keep at least one quick, effort-1 recipe per meal so every combination has an answer. Each ingredient's `step` is the smallest amount it can be rounded to when the servings change (`1` keeps eggs whole, `0.5` gives half cans). Calories and protein are rough per-serving estimates.
- **Stored on the device only** (`localStorage`, nothing is sent anywhere):
  - `yolkie-prefs`: every choice (your diets, dislikes, allergies and keep-out allergies, the household members and their restrictions, the invite code, hidden meals, goals, takeout cost, outfit, reminders, kitchen options, the open tab and the last pick);
  - `yolkie-activity`: real activity, meaning each meal finished in cook mode (with who ate, ratings and kudos), plus badges, the current challenge, stickers, crumbs, gifts, fridge placements and remembered ingredients. Every stat, card, friend and Pantry-dex entry is worked out from the meals;
  - `yolkie-sample`: the tester's sample weeks from Preferences → "Load sample week", including cards, stickers, friends, ratings, member profiles and remembered ingredients. While it exists, every stat reads and writes it instead, with a banner on screen; "Clear sample data" removes it and the real stats come back untouched;
  - `yolkie-nutrition` (the hide-nutrition switch, shared with the home page) and `theme`.
  - "Clear all demo data" at the bottom of Preferences removes all of these.
- **Ground rules the demo follows:** it rewards cooking and never punishes skipping (no streaks, no sad Yolkie; a missed week just starts fresh). Nutrition is information only, never a goal, and "Hide nutrition" removes every number. Takeout dodged is an estimate: meals × your usual takeout cost. Collectibles are earned only by cooking and trying things: nothing is sold, there are no random packs, rarity comes from effort and odds are never shown. Remembered ingredients are always a guess to confirm. Personal stats, nutrition, check-in times and sticker books are private by default. There's no "worst meals" list.
- **Who's eating and restrictions:** the house can have up to 12 people in this demo, you first; past Boyd and Scramble, people are drawn as boiled or scrambled eggs in turn and told apart by their name tags. A suggestion or house vote has to work for every diet and allergy of the people eating, plus any allergy someone keeps out of the house; other people's dislikes only move a recipe down, and the card says why. Your own "never show me" list still hides recipes. Each person edits their own restrictions (on one phone: "Pass the phone to…"); you edit guests'.
- **Collection:** cards are Common (quick), Rare (25+ minutes, or your first of a cuisine) or Special (the whole house ate), and turn foil after 5 cooks. Sets (`SETS`) are Breakfast Club, Midnight Snacks, Taco Tuesday and one per cuisine; finishing one adds a toaster, cookie jar, cactus or postcard to the kitchen. Stickers (`STICKERS`, `SEASONS`) come from moments, at most once a day or week; spares can be gifted inside the house or turned into crumbs, and 3 crumbs pick any missing sticker. Friends (`FRIENDS`, drawn in `BODIES` in the mascots' style) unlock from recipe tags. `PANTRY` lists the Pantry-dex in order; four entries are rare finds.
- **Water:** a card on the Cook screen and in Me. Taps are stored in ml per day in `yolkie-activity` (so changing the unit never changes the total) and settings live in `yolkie-prefs` (`water`): unit, what one tap is (a 250 ml glass or a refill of your bottle), bottle size, daily goal (8 glasses by default) and an off switch. Each tap waters the kitchen plant, or fills a bottle on the counter before the plant unlocks; the goal makes the plant bloom for the rest of the day. It resets daily, never wilts, has no streaks and is never shared with the house. Reminders are off by default; the preview fires at most every 3 hours between your waking hours, with "Not today". The first day you reach the goal earns the Hydration station sticker.
- **Linking a household** is simulated: codes are `YOLK-` plus four characters without 0/O or 1/I/L, expire after 7 days, and the QR code is drawn on the page (`qrMatrix` in `main.js`). Joining with your code or `YOLK-EGGS` adds a member waiting for approval. An invite link (`try.html#join=YOLK-XXXX`) opens the join screen.
- **Yolkie's Kitchen** (Me tab → Kitchen): ported from the `Yolkies-Kitchen.html` prototype, which stays in the folder but isn't published. You steer Yolkie (tap the floor); the other house members cook, wash up, use the fridge, eat at the table, chat, make coffee, water the plant and dance at night on their own. The people and name tags are the House tab's (you're always Yolkie), with a chip per person to send them out or bring them home: just you is the 6×6 kitchen, and with roommates it's 8×8 with a bigger table and four stools. Friends you've met sit on a shelf (tap one for its bio) and drop by now and then, or when you tap "Invite a friend over". Your stickers go on the fridge door, dragged from the tray or the Collection tab. Decor unlocks at 1, 3, 5, 7, 10, 13, 16 and 20 meals cooked, from the real count; the preview slider only shows while the sample week is loaded. Yolkie wears the closet outfit. Night mode and "everyone does their own thing" are saved in `yolkie-prefs`. The animation only runs while the kitchen is on screen.
- **Yolkie's closet:** the accessories are drawn in `CLOSET` in `main.js`, in the mascot's own viewBox, and laid over the unchanged mascot SVGs. They unlock at 1, 3, 5, 8, 12 and 20 meals.

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
