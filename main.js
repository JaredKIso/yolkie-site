// Shared behaviour for every page of the site. Each feature looks up its own elements and
// does nothing when they aren't on the current page, so one script serves all pages.
const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Theme toggle: follows the system until the visitor picks one; the choice is shared by all pages.
const toggle = document.querySelector('.theme-toggle');
if (toggle) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches);
  const sync = () => {
    const icon = toggle.querySelector('.icon');
    if (icon) icon.textContent = isDark() ? 'light_mode' : 'dark_mode';
    toggle.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  };
  toggle.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    sync();
  });
  systemDark.addEventListener('change', sync);
  sync();
}

// Arriving at ./#section from another page: jump straight there, then turn smooth scrolling on
// for in-page links. setTimeout, not requestAnimationFrame, which background tabs pause.
window.addEventListener('load', () => {
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView({ behavior: 'instant' });
  if (!reduceMotion) setTimeout(() => root.classList.add('smooth'), 0);
});

// Header picks up its scrolled state once the page moves.
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Highlight the nav link for the section in view. Links are ./#id on every page, so only
// watch the ones that point at a section on this page.
const samePage = (url) => url.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '');
const sectionLinks = [...document.querySelectorAll('.site-nav a')]
  .map((a) => ({ a, url: new URL(a.href) }))
  .filter(({ url }) => url.hash && samePage(url) && document.getElementById(url.hash.slice(1)));
if (sectionLinks.length && 'IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      sectionLinks.forEach(({ a, url }) => a.classList.toggle('is-active', url.hash === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sectionLinks.forEach(({ url }) => navObserver.observe(document.getElementById(url.hash.slice(1))));
}

// Elements with .reveal ease in as they arrive, staggered within their row.
const reveals = document.querySelectorAll('.reveal');
if (reduceMotion || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const siblings = [...e.target.parentElement.children].filter((c) => c.classList.contains('reveal'));
      e.target.style.transitionDelay = `${Math.max(0, siblings.indexOf(e.target)) * 70}ms`;
      e.target.classList.add('is-in');
      e.target.addEventListener('transitionend', () => { e.target.style.transitionDelay = ''; }, { once: true });
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach((el) => io.observe(el));
}

// Email links: the address is stored reversed in two parts so it never appears in the HTML.
// .js-email-text, if present, shows the address; data-subject pre-fills the subject line.
document.querySelectorAll('.js-email').forEach((el) => {
  if (!el.dataset.u || !el.dataset.d) return;
  const flip = (s) => s.split('').reverse().join('');
  const address = `${flip(el.dataset.u)}@${flip(el.dataset.d)}`;
  const subject = el.dataset.subject ? `?subject=${encodeURIComponent(el.dataset.subject)}` : '';
  el.href = `mailto:${address}${subject}`;
  el.removeAttribute('target');
  el.removeAttribute('rel');
  const text = el.querySelector('.js-email-text');
  if (text && el.hasAttribute('data-show-address')) text.textContent = address;
});

// Site-specific behaviour goes below this line, each piece guarded the same way.

/* ==========================================================================
   Yolkie
   ========================================================================== */

// Where the early-access form sends sign-ups. Either:
//   - a form endpoint that accepts a POST (https://…), from a form service, or
//   - a mailto: link, which opens the visitor's email app with the sign-up written out.
// 'preview' runs the whole form (checks, Yolkie, confetti) but sends nothing; replace it before launch.
// While it's empty, the form says the list isn't open yet.
const WAITLIST_URL = 'preview';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// Restart a one-shot CSS animation (Yolkie's wobble or hop, a ringing timer). Skipped under reduced motion.
function replay(el, cls = 'is-wobbling') {
  if (!el || reduceMotion) return;
  el.classList.remove('is-wobbling', 'is-celebrating', 'is-ringing');
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// Flat confetti in brand colours, dropped into an absolutely positioned .confetti box.
function confetti(box) {
  if (!box || reduceMotion) return;
  const colors = ['var(--yolk)', '#ffffff', 'var(--plum)', 'var(--ink)'];
  const shapes = ['50%', '2px', '999px 999px 0 0'];
  box.innerHTML = Array.from({ length: 40 }, (_, k) => {
    const size = 8 + Math.random() * 12;
    return `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--s:${size.toFixed(0)}px;--c:${colors[k % 4]};--r:${shapes[k % 3]};--d:${(1.3 + Math.random() * 1.2).toFixed(2)}s;--delay:${(Math.random() * 0.4).toFixed(2)}s;--rot:${Math.round(Math.random() * 720 - 360)}deg;--fall:${Math.round(260 + Math.random() * 220)}px"></i>`;
  }).join('');
  setTimeout(() => { box.innerHTML = ''; }, 3200);
}

// Early-access form: Yolkie watches you fill it in, then it sends to WAITLIST_URL.
const signup = document.querySelector('.js-signup');
if (signup) {
  const face = signup.querySelector('.js-signup-yolk');
  const dir = face.getAttribute('src').replace(/[^/]+$/, '');
  const email = signup.querySelector('input[type="email"]');
  const status = signup.querySelector('.js-signup-status');
  const submit = signup.querySelector('[type="submit"]');
  ['happy', 'meh', 'sleepy', 'surprised'].forEach((m) => { new Image().src = `${dir}yolk-${m}.svg`; });
  const setFace = (m, cls) => {
    if (!face.getAttribute('src').endsWith(`yolk-${m}.svg`)) face.src = `${dir}yolk-${m}.svg`;
    replay(face, cls);
  };
  const say = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };
  // Stricter than type="email", which accepts "name@host" with no dot in the domain.
  const looksValid = () => email.validity.valid && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());

  email.addEventListener('focus', () => { if (!looksValid() && !email.getAttribute('aria-invalid')) setFace('surprised'); });
  email.addEventListener('input', () => {
    if (email.getAttribute('aria-invalid')) { email.removeAttribute('aria-invalid'); say(''); }
    const mood = looksValid() ? 'happy' : 'surprised';
    if (!face.getAttribute('src').endsWith(`yolk-${mood}.svg`)) setFace(mood);
  });
  email.addEventListener('blur', () => { if (!email.value) setFace('default'); });
  signup.addEventListener('change', (e) => {
    if (e.target.name === 'energy') setFace({ Wiped: 'sleepy', Okay: 'default', Good: 'happy' }[e.target.value]);
  });

  const finish = (title, text) => {
    signup.querySelector('.signup__fields').hidden = true;
    const done = signup.querySelector('.js-signup-done');
    done.hidden = false;
    if (title) done.querySelector('.js-signup-done-title').textContent = title;
    if (text) done.querySelector('.js-signup-done-text').textContent = text;
    done.querySelector('.js-signup-done-title').focus({ preventScroll: true });
    setFace('happy', 'is-celebrating');
    confetti(signup.querySelector('.js-signup-confetti'));
  };

  signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!looksValid()) {
      email.setAttribute('aria-invalid', 'true');
      setFace('meh');
      say(email.value.trim() ? 'Hmm, that email looks a little scrambled. Mind checking it?' : 'Pop your email in first, and Yolkie will save you a seat.', true);
      email.focus();
      return;
    }
    const data = new FormData(signup);
    if (data.get('company')) { finish(); return; } // filled spam trap: look successful, send nothing
    data.delete('company');
    if (WAITLIST_URL === 'preview') {
      finish(null, 'We’ll email you when Yolkie has something to tap. (Preview mode: sign-ups aren’t saved yet.)');
      return;
    }
    if (!WAITLIST_URL) {
      setFace('meh');
      say('The list isn’t open just yet. Check back soon!', true);
      return;
    }
    if (/^mailto:/i.test(WAITLIST_URL)) {
      const body = [`Email: ${data.get('email')}`, data.get('energy') && `Usual mealtime energy: ${data.get('energy')}`, data.get('note') && `Note: ${data.get('note')}`]
        .filter(Boolean).join('\n');
      const sep = WAITLIST_URL.includes('?') ? '&' : '?';
      location.href = `${WAITLIST_URL}${sep}subject=${encodeURIComponent('Yolkie early access')}&body=${encodeURIComponent(body)}`;
      finish('Almost there!', 'Your email app should open with a note ready to go. Hit send and you’re on the list.');
      return;
    }
    submit.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(WAITLIST_URL, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      say('');
      finish();
    } catch (err) {
      setFace('meh');
      say('That didn’t go through. Try again in a minute?', true);
    } finally {
      submit.disabled = false;
    }
  });

  // "Get early access" links on this page: scroll to the card, then put the cursor in the email field.
  document.querySelectorAll('a[href="#early-access"]').forEach((a) => a.addEventListener('click', () => {
    setTimeout(() => { if (!email.closest('[hidden]')) email.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
  }));
}

// Calories and protein: one switch, shared by both pages, remembered on this device.
const nutritionOn = () => !root.classList.contains('hide-nutrition');
function setNutrition(on) {
  root.classList.toggle('hide-nutrition', !on);
  try { localStorage.setItem('yolkie-nutrition', on ? 'on' : 'off'); } catch (e) {}
  document.querySelectorAll('.js-nutri-toggle').forEach((t) => { t.checked = on; });
  document.querySelectorAll('.js-nutri-hide').forEach((t) => { t.checked = !on; });
}
document.querySelectorAll('.js-nutri-toggle').forEach((t) => { t.checked = nutritionOn(); });
document.addEventListener('change', (e) => {
  if (e.target.matches && e.target.matches('.js-nutri-toggle')) setNutrition(e.target.checked);
  if (e.target.matches && e.target.matches('.js-nutri-hide')) setNutrition(!e.target.checked);
});

// Hero Yolkie: dozes on the couch, perks up when you point at a button, changes face when poked.
const heroYolk = document.querySelector('.js-hero-yolk');
if (heroYolk) {
  const dir = heroYolk.getAttribute('src').replace(/[^/]+$/, '');
  const moods = ['sleepy', 'default', 'happy', 'surprised', 'meh'];
  moods.forEach((m) => { new Image().src = `${dir}yolk-${m}.svg`; });
  let resting = 'sleepy';
  const show = (m) => {
    if (heroYolk.getAttribute('src').endsWith(`yolk-${m}.svg`)) return;
    heroYolk.src = `${dir}yolk-${m}.svg`;
    replay(heroYolk.parentElement);
  };
  document.querySelectorAll('[data-yolk]').forEach((el) => {
    const m = el.dataset.yolk;
    el.addEventListener('pointerenter', () => show(m));
    el.addEventListener('focus', () => show(m));
    el.addEventListener('pointerleave', () => show(resting));
    el.addEventListener('blur', () => show(resting));
  });
  heroYolk.parentElement.addEventListener('click', () => {
    resting = moods[(moods.indexOf(resting) + 1) % moods.length];
    show(resting);
  });
}

/* ---------- The demo (try.html) ---------- */

// Thirty everyday recipes, six to ten for each meal (`meal`), each tagged with a cuisine, the diets
// it fits (`diet`; keto, low-carb and high-protein come from the numbers) and its allergens. `tags` says
// which friend a recipe unlocks (avocado, bread, brunch, noodles, berries) and marks soups.
// Amounts are for `base` servings; `step` is the smallest sensible increment when scaling, so eggs stay whole and cans go in halves. Nutrition is per serving
// and a rough estimate. Steps: { do } is a task you tick off, { timer } also starts a timer when
// you tick it, { wait } pauses until a timer ends (or has `until` minutes left).
const RECIPES = [
  /* Breakfast */
  {
    id: 'scrambled', meal: 'breakfast', name: 'Soft scrambled eggs on toast', time: 10, effort: 1, base: 2, kcal: 400, protein: 20,
    cuisine: 'British', diet: ['vegetarian'], allergens: ['egg', 'dairy', 'gluten'], tags: ['bread', 'brunch'],
    nut: { carbs: 32, fiber: 3, fat: 21, sugar: 6, sodium: 560 },
    egg: 'Scrambled eggs? Don’t tell Scramble.',
    blurb: 'Low heat, slow stir, done before the toast pops. Tomatoes on the side so it counts as balanced.',
    dishes: ['non-stick pan', 'bowl'],
    ingredients: [
      { q: 4, n: 'egg', p: 'eggs', s: 'Dairy', step: 1 },
      { q: 4, u: 'slice', n: 'sandwich bread', s: 'Pantry', step: 1 },
      { q: 2, u: 'tbsp', n: 'milk', s: 'Dairy', step: 1 },
      { q: 2, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 1, u: 'cup', n: 'cherry tomatoes', s: 'Produce', step: 0.25 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it, or add a pinch of paprika on top.' }],
    zero: 'Put the bread in the toaster. Don’t press it down yet.',
    steps: [
      { do: 'Crack the eggs into the bowl. Add the milk, pepper and a pinch of salt, and beat with a fork.', mins: 2 },
      { do: 'Press the toaster down.', timer: { id: 'toast', label: 'Toast', mins: 4 } },
      { do: 'Half the butter in the pan, low heat. Pour in the eggs and stir slowly with a spatula until they’re just set and still a little glossy.', mins: 3 },
      { wait: 'toast', clean: { text: 'Rinse the egg bowl now, before it dries like glue.', dish: 'bowl' } },
      { do: 'Butter the toast, pile the eggs on top, and add the tomatoes on the side.', mins: 1 },
    ],
  },
  {
    id: 'oatmeal', meal: 'breakfast', name: 'Peanut butter banana oatmeal', time: 10, effort: 1, base: 2, kcal: 440, protein: 16,
    cuisine: 'American', diet: ['vegan'], allergens: ['peanut', 'soy', 'gluten'],
    nut: { carbs: 58, fiber: 8, fat: 15, sugar: 22, sodium: 190 },
    blurb: 'One pot, five minutes of stirring now and then, and it keeps you going till lunch.',
    dishes: ['saucepan'],
    ingredients: [
      { q: 1, u: 'cup', n: 'rolled oats', s: 'Pantry', step: 0.25 },
      { q: 2, u: 'cup', n: 'soy milk (or any plant milk)', s: 'Dairy', step: 0.5 },
      { q: 1, n: 'banana', p: 'bananas', s: 'Produce', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'peanut butter', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'tsp', n: 'maple syrup', s: 'Pantry', step: 1 },
    ],
    spices: [{ q: 0.5, u: 'tsp', n: 'Ground cinnamon', step: 0.25, swap: 'A pinch of pumpkin pie spice or nutmeg. Or skip it.' }],
    zero: 'Put the saucepan on the stove.',
    steps: [
      { do: 'Oats, milk, cinnamon and a pinch of salt into the saucepan. Medium heat.', timer: { id: 'oats', label: 'Oats', mins: 5 } },
      { do: 'Peel the banana and slice it. A butter knife is fine.', mins: 1 },
      { wait: 'oats', note: 'Give it a stir now and then so it doesn’t catch. This moves on by itself.', clean: { text: 'Milk back in the fridge, oats back in the cupboard.' } },
      { do: 'Heat off. Spoon into bowls and top with banana, peanut butter and a drizzle of maple syrup.', mins: 1 },
    ],
  },
  {
    id: 'pancakes', meal: 'breakfast', name: 'Weekend pancakes with berries', time: 30, effort: 2, base: 2, kcal: 570, protein: 14,
    cuisine: 'American', diet: ['vegetarian'], allergens: ['egg', 'dairy', 'gluten'], tags: ['brunch', 'berries'],
    nut: { carbs: 86, fiber: 3, fat: 19, sugar: 34, sodium: 720 },
    blurb: 'Small, fluffy pancakes in two batches. Lumpy batter is correct batter.',
    dishes: ['mixing bowl', 'frying pan'],
    ingredients: [
      { q: 1, u: 'cup', n: 'all-purpose flour', s: 'Pantry', step: 0.25 },
      { q: 2, u: 'tsp', n: 'baking powder', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'sugar', s: 'Pantry', step: 0.5 },
      { q: 1, n: 'egg', p: 'eggs', s: 'Dairy', step: 1 },
      { q: 1, u: 'cup', n: 'milk', s: 'Dairy', step: 0.25 },
      { q: 2, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 1, u: 'cup', n: 'berries, fresh or frozen', s: 'Produce', step: 0.25 },
      { q: 0.25, u: 'cup', n: 'maple syrup', s: 'Pantry', step: 0.25 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Ground cinnamon', step: 0.25, swap: 'Skip it. Nobody will know.' },
      { q: 0.5, u: 'tsp', n: 'Vanilla extract', step: 0.25, swap: 'A little extra maple syrup in the batter.' },
    ],
    zero: 'Get the mixing bowl out and put it on the counter.',
    steps: [
      { do: 'Melt the butter in the frying pan on low, then turn the heat off.', mins: 2 },
      { do: 'In the bowl, whisk the flour, baking powder, sugar, cinnamon and a pinch of salt.', mins: 2 },
      { do: 'Add the milk, egg, vanilla and the melted butter. Stir until just combined. Lumps are good.', mins: 2 },
      { do: 'Leave the batter to rest. Pan back on, medium heat.', timer: { id: 'rest', label: 'Batter rest', mins: 5 } },
      { wait: 'rest', clean: { text: 'Milk and eggs back in the fridge. Wipe the flour off the counter.' } },
      { do: 'Pour in a few small pancakes. Flip them when bubbles pop on top.', timer: { id: 'batch1', label: 'Batch 1', mins: 4 } },
      { wait: 'batch1', note: 'Flip them halfway, once the bubbles pop.', clean: { text: 'Put the plates and the syrup out.' } },
      { do: 'Batch two: same again with the rest of the batter.', timer: { id: 'batch2', label: 'Batch 2', mins: 4 } },
      { wait: 'batch2', note: 'Flip them halfway, once the bubbles pop.', clean: { text: 'Rinse the batter bowl while it’s still soft.', dish: 'mixing bowl' } },
      { do: 'Stack them up. Berries and syrup on top.', mins: 1 },
    ],
  },

  /* Lunch and dinner */
  {
    id: 'quesadillas', meal: 'lunch', name: 'Black bean quesadillas', time: 15, effort: 1, base: 2, kcal: 540, protein: 24,
    cuisine: 'Mexican', diet: ['vegetarian'], allergens: ['gluten', 'dairy'],
    nut: { carbs: 58, fiber: 12, fat: 23, sugar: 4, sodium: 980 },
    blurb: 'Crispy, melty and mostly assembly. The pan does the rest.',
    dishes: ['frying pan', 'bowl', 'cutting board'],
    ingredients: [
      { q: 4, n: 'flour tortilla', p: 'flour tortillas', s: 'Pantry', step: 1 },
      { q: 1, u: 'can', n: 'black beans', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'cup', n: 'shredded cheddar', s: 'Dairy', step: 0.25 },
      { q: 2, n: 'green onion', p: 'green onions', s: 'Produce', step: 1 },
      { q: 0.25, u: 'cup', n: 'salsa', s: 'Pantry', step: 0.25 },
      { q: 0.25, u: 'cup', n: 'sour cream', s: 'Dairy', step: 0.25 },
    ],
    spices: [{ q: 1, u: 'tsp', n: 'Ground cumin', step: 0.25, swap: 'Use half as much chili powder, or skip it. Still good.' }],
    zero: 'Put the frying pan on the stove. Don’t turn it on yet. That’s the whole step.',
    steps: [
      { do: 'Drain and rinse the beans. Mash them roughly in the bowl with the cumin and a pinch of salt.', mins: 3 },
      { do: 'Slice the green onions on the cutting board.', mins: 1 },
      { do: 'Spread the beans over half of each tortilla. Add cheese and green onion, then fold them shut.', mins: 3 },
      { do: 'Heat the pan to medium. Two quesadillas in, no oil needed.', timer: { id: 'side1', label: 'Side one', mins: 3 } },
      { wait: 'side1', clean: { text: 'Rinse the bean bowl now, while it’s easy.', dish: 'bowl' } },
      { do: 'Flip them and press down gently with a spatula.', timer: { id: 'side2', label: 'Side two', mins: 3 } },
      { wait: 'side2', clean: { text: 'Cheese and sour cream back in the fridge.' } },
      { do: 'Cut into wedges. Serve with salsa and sour cream. Repeat for any extras.', mins: 1 },
    ],
  },
  {
    id: 'fried-rice', meal: 'dinner', name: 'Egg fried rice', time: 15, effort: 1, base: 2, kcal: 470, protein: 17,
    cuisine: 'Chinese', diet: ['vegetarian', 'dairy-free'], allergens: ['egg', 'soy', 'gluten', 'sesame'],
    nut: { carbs: 66, fiber: 5, fat: 15, sugar: 4, sodium: 1050 },
    egg: 'Egg fried rice? Eggs? …Fine. I respect it.',
    blurb: 'Ready-cooked rice, a hot pan and four minutes of leaving it alone.',
    dishes: ['large frying pan', 'bowl'],
    ingredients: [
      { q: 2, u: 'pouch', n: 'ready-cooked rice', size: 'about 8.5 oz', s: 'Pantry', step: 1 },
      { q: 3, n: 'egg', p: 'eggs', s: 'Dairy', step: 1 },
      { q: 1, u: 'cup', n: 'frozen peas', s: 'Produce', step: 0.25 },
      { q: 3, n: 'green onion', p: 'green onions', s: 'Produce', step: 1 },
      { q: 2, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 2, u: 'tbsp', n: 'soy sauce', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tsp', n: 'sesame oil', s: 'Pantry', step: 0.25 },
      { q: 1, u: 'tbsp', n: 'vegetable oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'White pepper', step: 0.25, swap: 'Black pepper works fine.' }],
    zero: 'Take the rice pouches out of the cupboard and put them next to the stove.',
    steps: [
      { do: 'Squeeze the rice pouches to break up the grains. Crack the eggs into the bowl and beat them with a fork.', mins: 2 },
      { do: 'Crush the garlic.', mins: 1 },
      { do: 'Oil in the pan, high heat. Pour in the eggs, stir until just set, then tip them back into the bowl.', mins: 2 },
      { do: 'Garlic, rice and peas into the pan. Spread it out and leave it alone.', timer: { id: 'fry', label: 'Rice', mins: 4 } },
      { wait: 'fry', clean: { text: 'Peas back in the freezer. Soy sauce and sesame oil next to the stove.' } },
      { do: 'Eggs back in with the soy sauce and sesame oil. Snip in the green onions with scissors and toss for a minute.', mins: 1 },
    ],
  },
  {
    id: 'lemon-chicken', meal: 'dinner', name: 'Lemon garlic chicken & rice', time: 30, effort: 2, base: 2, kcal: 610, protein: 42,
    cuisine: 'Mediterranean', diet: [], allergens: ['dairy', 'gluten'],
    nut: { carbs: 62, fiber: 4, fat: 21, sugar: 3, sodium: 820 },
    blurb: 'Golden chicken, buttery lemon green beans, and rice that finishes at the same time.',
    dishes: ['saucepan', 'frying pan', 'cutting board'],
    ingredients: [
      { q: 1, u: 'lb', n: 'boneless chicken thighs', s: 'Meat', step: 0.25 },
      { q: 0.75, u: 'cup', n: 'long-grain rice', s: 'Pantry', step: 0.25 },
      { q: 1, n: 'chicken bouillon cube', p: 'chicken bouillon cubes', s: 'Pantry', step: 0.5 },
      { q: 0.5, u: 'lb', n: 'green beans', s: 'Produce', step: 0.25 },
      { q: 3, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 1, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Dried oregano', step: 0.25, swap: 'Dried thyme or Italian seasoning.' },
      { q: 0.5, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it, or add a pinch of red pepper flakes.' },
    ],
    zero: 'Fill the kettle and switch it on.',
    steps: [
      { do: 'Rinse the rice. Put it in the saucepan with the bouillon cube and twice its volume of boiling water. Lid on, lowest heat.', timer: { id: 'rice', label: 'Rice', mins: 15 } },
      { do: 'Pat the chicken dry. Season with oregano, pepper and a good pinch of salt.', mins: 2 },
      { do: 'Trim the green beans. Crush the garlic. Halve the lemon.', mins: 3 },
      { wait: 'rice', until: 11, note: 'The chicken goes in when the rice has 11 minutes left, so they finish together.', clean: { text: 'Rinse the cutting board and knife. You’re done with them.', dish: 'cutting board' } },
      { do: 'Oil in the frying pan, medium-high heat. Chicken in, smooth side down.', timer: { id: 'c1', label: 'Chicken, side 1', mins: 6 } },
      { wait: 'c1', clean: { text: 'Oregano and bouillon back in the cupboard.' } },
      { do: 'Flip the chicken. Add the green beans around it.', timer: { id: 'c2', label: 'Chicken + beans', mins: 5 } },
      { wait: 'c2', clean: { text: 'Wipe the counter next to the stove.' } },
      { do: 'Heat off. Add the butter, garlic and a squeeze of lemon, and swirl for a minute.', mins: 1 },
      { wait: 'rice', clean: { text: 'Get the plates out.' } },
      { do: 'Fluff the rice with a fork. Plate up and squeeze over the rest of the lemon.', mins: 1 },
    ],
  },
  {
    id: 'peanut-noodles', meal: 'lunch', name: 'Peanut noodles with crunchy veg', time: 20, effort: 2, base: 2, kcal: 560, protein: 21,
    cuisine: 'Thai', diet: ['vegan'], allergens: ['peanut', 'soy', 'gluten'], has: ['spicy'], tags: ['noodles'],
    nut: { carbs: 72, fiber: 8, fat: 20, sugar: 10, sodium: 900 },
    blurb: 'A quick peanut sauce, cold crunchy veg and hot noodles. Weirdly great.',
    dishes: ['big pot', 'bowl', 'cutting board'],
    ingredients: [
      { q: 8, u: 'oz', n: 'dried noodles (any kind)', s: 'Pantry', step: 2 },
      { q: 1, u: 'cup', n: 'frozen shelled edamame', s: 'Produce', step: 0.25 },
      { q: 1, n: 'carrot', p: 'carrots', s: 'Produce', step: 0.5 },
      { q: 0.5, n: 'cucumber', p: 'cucumbers', s: 'Produce', step: 0.5 },
      { q: 2, n: 'green onion', p: 'green onions', s: 'Produce', step: 1 },
      { q: 1, n: 'lime', p: 'limes', s: 'Produce', step: 0.5 },
      { q: 3, u: 'tbsp', n: 'peanut butter', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'soy sauce', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tsp', n: 'maple syrup', s: 'Pantry', step: 0.25 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Red pepper flakes', step: 0.25, swap: 'A squeeze of hot sauce, or leave it out.' },
      { q: 0.25, u: 'tsp', n: 'Ground ginger', step: 0.25, swap: 'Skip it. The lime does the heavy lifting.' },
    ],
    zero: 'Fill the big pot with water and put it on the stove.',
    steps: [
      { do: 'Lid on, high heat, pinch of salt.', timer: { id: 'boil', label: 'Water', mins: 6 } },
      { do: 'In the bowl, whisk the peanut butter, soy sauce, maple syrup, spices, lime juice and 3 tbsp of hot tap water.', mins: 3 },
      { do: 'Cut the carrot and cucumber into thin sticks. Slice the green onions.', mins: 4 },
      { wait: 'boil', clean: { text: 'Rinse the knife and cutting board and put them on the rack.', dish: 'cutting board' } },
      { do: 'Noodles and edamame into the boiling water.', timer: { id: 'noodles', label: 'Noodles', mins: 4 } },
      { wait: 'noodles', clean: { text: 'Peanut butter and soy sauce back in the cupboard.' } },
      { do: 'Drain. Tip the noodles into the sauce bowl with the veg and toss well.', mins: 1 },
    ],
  },
  {
    id: 'soup', meal: 'lunch', name: 'Tomato soup & grilled cheese', time: 25, effort: 2, base: 2, kcal: 740, protein: 23,
    cuisine: 'American', diet: ['vegetarian'], allergens: ['dairy', 'gluten'], tags: ['bread', 'soup'],
    nut: { carbs: 76, fiber: 7, fat: 38, sugar: 18, sodium: 1450 },
    blurb: 'The classic pair, timed so the sandwiches come out of the pan just as the soup is ready.',
    dishes: ['saucepan', 'frying pan', 'cutting board'],
    ingredients: [
      { q: 1, u: 'can', n: 'crushed tomatoes', size: '28 oz', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'cup', n: 'vegetable broth', s: 'Pantry', step: 0.25 },
      { q: 0.5, n: 'onion', p: 'onions', s: 'Produce', step: 0.5 },
      { q: 2, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 3, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 0.25, u: 'cup', n: 'cream or milk', s: 'Dairy', step: 0.25 },
      { q: 4, u: 'slice', n: 'sandwich bread', s: 'Pantry', step: 1 },
      { q: 4, u: 'slice', n: 'cheddar', s: 'Dairy', step: 1 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Dried basil', step: 0.25, swap: 'Dried oregano or Italian seasoning.' },
      { q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it, or add a pinch of red pepper flakes.' },
    ],
    zero: 'Put the saucepan on the stove and the butter on the counter to soften.',
    steps: [
      { do: 'Chop the onion. Crush the garlic.', mins: 3 },
      { do: 'One tablespoon of butter in the saucepan, medium heat. Add the onion and a pinch of salt.', timer: { id: 'onion', label: 'Onion', mins: 5 } },
      { do: 'Butter one side of each slice of bread. Make sandwiches with the cheese inside and the butter facing out.', mins: 3 },
      { wait: 'onion', clean: { text: 'Rinse the cutting board and knife. The chopping is done.', dish: 'cutting board' } },
      { do: 'Stir in the garlic and basil for a minute, then the tomatoes and broth. Lid half on.', timer: { id: 'soup', label: 'Soup', mins: 12 } },
      { wait: 'soup', until: 8, note: 'The sandwiches go on when the soup has 8 minutes left, so they finish together.', clean: { text: 'Bread and broth back in the cupboard.' } },
      { do: 'Frying pan on medium-low. Sandwiches in.', timer: { id: 'g1', label: 'Side one', mins: 4 } },
      { wait: 'g1', clean: { text: 'Cheese back in the fridge.' } },
      { do: 'Flip the sandwiches and press them down gently.', timer: { id: 'g2', label: 'Side two', mins: 3 } },
      { wait: 'g2', clean: { text: 'Get the bowls and spoons out.' } },
      { wait: 'soup', clean: { text: 'Wipe the counter next to the stove.' } },
      { do: 'Heat off. Stir the cream into the soup, and mash it with a fork if you like it smoother. Cut the sandwiches in half.', mins: 2 },
    ],
  },
  {
    id: 'sheet-pan', meal: 'dinner', name: 'Sausage & potato sheet-pan dinner', time: 45, effort: 1, base: 2, kcal: 690, protein: 29,
    cuisine: 'Italian', diet: ['dairy-free'], allergens: ['gluten'],
    nut: { carbs: 42, fiber: 6, fat: 45, sugar: 9, sodium: 1180 },
    blurb: 'The oven does almost all of it. You chop for about eight minutes, total.',
    dishes: ['sheet pan', 'cutting board'],
    ingredients: [
      { q: 4, n: 'Italian sausage', p: 'Italian sausages', s: 'Meat', step: 1 },
      { q: 1, u: 'lb', n: 'baby potatoes', s: 'Produce', step: 0.25 },
      { q: 1, n: 'red onion', p: 'red onions', s: 'Produce', step: 0.5 },
      { q: 2, n: 'bell pepper', p: 'bell peppers', s: 'Produce', step: 1 },
      { q: 2, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'whole-grain mustard', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Smoked paprika', step: 0.25, swap: 'Regular paprika, or a pinch of chili powder.' },
      { q: 1, u: 'tsp', n: 'Dried rosemary', step: 0.25, swap: 'Dried thyme or Italian seasoning.' },
    ],
    zero: 'Turn the oven on to 400°F (200°C).',
    steps: [
      { do: 'Halve the potatoes. Toss them on the sheet pan with the oil, paprika, rosemary and a pinch of salt.', mins: 4 },
      { do: 'Pan in the oven. The potatoes get a head start.', timer: { id: 'potatoes', label: 'Potatoes', mins: 15 } },
      { do: 'Cut the onion into wedges and the peppers into strips.', mins: 4 },
      { wait: 'potatoes', clean: { text: 'Wash the cutting board and knife. That’s all the chopping tonight.', dish: 'cutting board' } },
      { do: 'Add the sausages, onion and peppers to the pan and toss everything together.', timer: { id: 'pan1', label: 'Sheet pan', mins: 12 } },
      { wait: 'pan1', clean: { text: 'Oil and spices back in the cupboard. Wipe the counter.' } },
      { do: 'Turn the sausages and give the pan a shake.', timer: { id: 'pan2', label: 'Sheet pan, round 2', mins: 13 } },
      { wait: 'pan2', clean: { text: 'Set the table. Or at least find a fork.' } },
      { do: 'Out of the oven. Dot with mustard and serve straight from the pan.', mins: 1 },
    ],
  },
  {
    id: 'turkey-chili', meal: 'dinner', name: 'Turkey chili with rice', time: 50, effort: 3, base: 4, kcal: 560, protein: 40,
    cuisine: 'Tex-Mex', diet: ['gluten-free'], allergens: ['dairy'], has: ['spicy'],
    nut: { carbs: 62, fiber: 11, fat: 16, sugar: 9, sodium: 760 },
    blurb: 'A proper pot of chili, with the rice timed to land when the chili does.',
    dishes: ['big pot', 'saucepan', 'cutting board'],
    ingredients: [
      { q: 1, u: 'lb', n: 'ground turkey', s: 'Meat', step: 0.25 },
      { q: 1, n: 'onion', p: 'onions', s: 'Produce', step: 0.5 },
      { q: 1, n: 'red bell pepper', p: 'red bell peppers', s: 'Produce', step: 0.5 },
      { q: 2, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 1, u: 'can', n: 'diced tomatoes', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'can', n: 'kidney beans', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'tomato paste', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'cup', n: 'long-grain rice', s: 'Pantry', step: 0.25 },
      { q: 0.5, u: 'cup', n: 'shredded cheddar', s: 'Dairy', step: 0.25 },
      { q: 0.5, u: 'cup', n: 'Greek yogurt or sour cream', s: 'Dairy', step: 0.25 },
    ],
    spices: [
      { q: 2, u: 'tsp', n: 'Chili powder', step: 0.25, swap: 'Smoked paprika plus a pinch of red pepper flakes.' },
      { q: 1, u: 'tsp', n: 'Ground cumin', step: 0.25, swap: 'A little extra chili powder.' },
      { q: 1, u: 'tsp', n: 'Dried oregano', step: 0.25, swap: 'Dried thyme or Italian seasoning.' },
    ],
    zero: 'Put the big pot on the stove. Just put it there.',
    steps: [
      { do: 'Chop the onion and pepper. Crush the garlic.', mins: 6 },
      { do: 'Oil in the pot, medium heat. Add the onion and pepper with a pinch of salt.', timer: { id: 'soften', label: 'Softening', mins: 5 } },
      { wait: 'soften', clean: { text: 'Rinse the cutting board and knife. The chopping is done.', dish: 'cutting board' } },
      { do: 'Add the turkey. Break it up with a spoon and cook until it’s no longer pink.', mins: 6 },
      { do: 'Stir in the garlic, spices and tomato paste for a minute. Then add the tomatoes, beans and half a can of water.', timer: { id: 'simmer', label: 'Chili simmer', mins: 25 } },
      { do: 'Rinse the rice.', mins: 1 },
      { wait: 'simmer', until: 15, note: 'The rice goes on when the chili has 15 minutes left, so they finish together.', clean: { text: 'Spices back in the cupboard. Cans in the recycling.' } },
      { do: 'Rice in the saucepan with twice its volume of water. Lid on, low heat.', timer: { id: 'rice', label: 'Rice', mins: 15 } },
      { do: 'Stir the chili and taste it. Add salt if it needs it.', mins: 1 },
      { wait: 'rice', clean: { text: 'Get the bowls and spoons out.' } },
      { do: 'Fluff the rice. Serve the chili over it with cheese and a spoonful of yogurt.', mins: 1 },
    ],
  },

  /* Snacks */
  {
    id: 'hummus-plate', meal: 'snack', name: 'Hummus & crunchy veg plate', time: 10, effort: 1, base: 2, kcal: 290, protein: 9,
    cuisine: 'Middle Eastern', diet: ['vegan'], allergens: ['sesame', 'gluten'], tags: ['bread'],
    nut: { carbs: 34, fiber: 7, fat: 14, sugar: 5, sodium: 480 },
    blurb: 'Warm pita, cold crunchy veg and a swoosh of hummus. Looks fancy, takes ten minutes.',
    dishes: ['cutting board', 'small bowl'],
    ingredients: [
      { q: 0.5, u: 'cup', n: 'hummus', s: 'Produce', step: 0.25 },
      { q: 1, n: 'pita bread', p: 'pita breads', s: 'Pantry', step: 0.5 },
      { q: 1, n: 'carrot', p: 'carrots', s: 'Produce', step: 0.5 },
      { q: 0.5, n: 'cucumber', p: 'cucumbers', s: 'Produce', step: 0.5 },
      { q: 1, u: 'cup', n: 'cherry tomatoes', s: 'Produce', step: 0.25 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Paprika', step: 0.25, swap: 'Skip it. It’s mostly there to look nice.' }],
    zero: 'Get the cutting board out and put it on the counter.',
    steps: [
      { do: 'Pop the pita in the toaster.', timer: { id: 'pita', label: 'Pita', mins: 3 } },
      { do: 'Cut the carrot and cucumber into sticks. Halve the tomatoes.', mins: 4 },
      { wait: 'pita', clean: { text: 'Rinse the knife and cutting board.', dish: 'cutting board' } },
      { do: 'Hummus into the small bowl, with olive oil and paprika on top. Cut the pita into wedges and pile everything around it.', mins: 1 },
    ],
  },
  {
    id: 'popcorn', meal: 'snack', name: 'Parmesan stovetop popcorn', time: 10, effort: 2, base: 2, kcal: 370, protein: 8,
    cuisine: 'American', diet: ['vegetarian', 'gluten-free'], allergens: ['dairy'],
    nut: { carbs: 32, fiber: 6, fat: 24, sugar: 0, sodium: 420 },
    blurb: 'Real popcorn in one pot, with butter, parmesan and a little garlic. Movie optional.',
    dishes: ['big pot with a lid', 'big bowl'],
    ingredients: [
      { q: 0.25, u: 'cup', n: 'popcorn kernels', s: 'Pantry', step: 0.25 },
      { q: 1.5, u: 'tbsp', n: 'vegetable oil', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 0.25, u: 'cup', n: 'grated parmesan', s: 'Dairy', step: 0.25 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Garlic powder', step: 0.25, swap: 'Skip it. Butter and salt is a classic for a reason.' },
      { q: 0.25, u: 'tsp', n: 'Smoked paprika', step: 0.25, swap: 'Regular paprika, or a pinch of chili powder.' },
    ],
    zero: 'Put the big pot on the stove and find its lid.',
    steps: [
      { do: 'Oil and three kernels in the pot. Lid on, medium-high heat.', timer: { id: 'test', label: 'Test kernels', mins: 3 } },
      { wait: 'test', note: 'When the test kernels pop, the oil is hot enough. This moves on by itself.', clean: { text: 'Get the big bowl out and the butter ready.' } },
      { do: 'Add the rest of the kernels. Lid back on, and shake the pot every so often.', timer: { id: 'pop', label: 'Popping', mins: 3 } },
      { wait: 'pop', note: 'Off the heat as soon as the pops are a few seconds apart.', clean: { text: 'Kernels back in the cupboard.' } },
      { do: 'Tip the popcorn into the bowl. Melt the butter in the hot pot, off the heat.', mins: 1 },
      { do: 'Pour the butter over. Add the parmesan, spices and a pinch of salt, and toss.', mins: 1 },
    ],
  },
  {
    id: 'chickpeas', meal: 'snack', name: 'Crispy roasted chickpeas', time: 40, effort: 1, base: 2, kcal: 240, protein: 10,
    cuisine: 'Spanish', diet: ['vegan', 'gluten-free'], allergens: [],
    nut: { carbs: 30, fiber: 9, fat: 9, sugar: 1, sodium: 380 },
    blurb: 'A can of chickpeas, a hot oven and almost no effort. They crisp up more as they cool.',
    dishes: ['sheet pan', 'bowl'],
    ingredients: [
      { q: 1, u: 'can', n: 'chickpeas', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Smoked paprika', step: 0.25, swap: 'Regular paprika, or a pinch of chili powder.' },
      { q: 0.5, u: 'tsp', n: 'Garlic powder', step: 0.25, swap: 'Skip it, or use onion powder.' },
      { q: 0.5, u: 'tsp', n: 'Ground cumin', step: 0.25, swap: 'A little extra paprika.' },
    ],
    zero: 'Turn the oven on to 425°F (220°C).',
    steps: [
      { do: 'Drain and rinse the chickpeas. Pat them really dry with a clean towel. Dry means crunchy.', mins: 5 },
      { do: 'Toss them in the bowl with the oil and a pinch of salt.', mins: 1 },
      { do: 'Spread them on the sheet pan and into the oven.', timer: { id: 'roast1', label: 'Roast', mins: 15 } },
      { wait: 'roast1', clean: { text: 'Can in the recycling. Wipe out the bowl and mix the spices in it.' } },
      { do: 'Shake the pan so they roll over.', timer: { id: 'roast2', label: 'Roast, round 2', mins: 10 } },
      { wait: 'roast2', clean: { text: 'Towel in the laundry. Wipe the counter by the sink.' } },
      { do: 'Tip them into the bowl with the spices and toss while they’re hot.', mins: 1 },
    ],
  },
  /* Added for the diet filters: every meal keeps at least two options under each single diet */
  {
    id: 'omelette', meal: 'breakfast', name: 'Spinach & feta omelette', time: 10, effort: 1, base: 2, kcal: 410, protein: 26,
    cuisine: 'Greek', diet: ['vegetarian', 'gluten-free'], allergens: ['egg', 'dairy'], tags: ['brunch'],
    nut: { carbs: 4, fiber: 1, fat: 32, sugar: 2, sodium: 720 },
    egg: 'An omelette? Right in front of me? Bold.',
    blurb: 'One big folded omelette, cut in two. Wilted spinach, salty feta, ten minutes.',
    dishes: ['non-stick pan', 'bowl'],
    ingredients: [
      { q: 6, n: 'egg', p: 'eggs', s: 'Dairy', step: 1 },
      { q: 2, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 0.5, u: 'cup', n: 'crumbled feta', s: 'Dairy', step: 0.25 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Dried oregano', step: 0.25, swap: 'Dried dill, or skip it.' },
      { q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it. The feta brings the salt.' },
    ],
    zero: 'Put the pan on the stove and get the eggs out of the fridge.',
    steps: [
      { do: 'Crack the eggs into the bowl with the oregano, pepper and a pinch of salt. Beat with a fork.', mins: 2 },
      { do: 'Oil in the pan, medium heat. Add the spinach and stir until it wilts.', mins: 2 },
      { do: 'Pour in the eggs and swirl so they cover the pan. Lid on.', timer: { id: 'set', label: 'Omelette', mins: 3 } },
      { wait: 'set', note: 'Lift an edge now and then so the runny egg flows underneath.', clean: { text: 'Rinse the egg bowl before it dries.', dish: 'bowl' } },
      { do: 'Scatter the feta over one half, fold it over and slide it out. Cut it in two.', mins: 1 },
    ],
  },
  {
    id: 'salmon-eggs', meal: 'breakfast', name: 'Smoked salmon eggs with avocado', time: 10, effort: 1, base: 2, kcal: 400, protein: 25,
    cuisine: 'Nordic', diet: ['pescatarian', 'gluten-free', 'dairy-free'], allergens: ['egg', 'fish'], tags: ['avocado', 'brunch'],
    nut: { carbs: 7, fiber: 5, fat: 30, sugar: 1, sodium: 820 },
    blurb: 'Soft eggs cooked in olive oil, cold smoked salmon and buttery avocado. Brunch energy, weekday effort.',
    dishes: ['non-stick pan', 'bowl'],
    ingredients: [
      { q: 4, n: 'egg', p: 'eggs', s: 'Dairy', step: 1 },
      { q: 4, u: 'oz', n: 'smoked salmon', s: 'Meat', step: 1 },
      { q: 1, n: 'avocado', p: 'avocados', s: 'Produce', step: 0.5 },
      { q: 0.5, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'fresh chives', s: 'Produce', step: 1 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it, or a pinch of paprika.' }],
    zero: 'Get the bowl out and crack the eggs into it.',
    steps: [
      { do: 'Beat the eggs with the pepper and a pinch of salt.', mins: 1 },
      { do: 'Halve the avocado, scoop it out and slice it. Squeeze a little lemon over.', mins: 2 },
      { do: 'Oil in the pan, low heat. Pour in the eggs and stir slowly.', timer: { id: 'eggs', label: 'Eggs', mins: 3 } },
      { wait: 'eggs', note: 'Keep stirring gently. Take them off while they still look a little wet.', clean: { text: 'Rinse the egg bowl now.', dish: 'bowl' } },
      { do: 'Plate the eggs with the salmon and avocado. Snip the chives over the top.', mins: 1 },
    ],
  },
  {
    id: 'tofu-tacos', meal: 'breakfast', name: 'Tofu scramble breakfast tacos', time: 20, effort: 2, base: 2, kcal: 540, protein: 28,
    cuisine: 'Mexican', diet: ['vegan', 'gluten-free'], allergens: ['soy'],
    nut: { carbs: 48, fiber: 11, fat: 26, sugar: 3, sodium: 640 },
    blurb: 'Golden crumbled tofu with black beans and spinach, in warm corn tortillas. Salsa on everything.',
    dishes: ['frying pan'],
    ingredients: [
      { q: 1, n: 'block extra-firm tofu', p: 'blocks extra-firm tofu', size: '14 oz', s: 'Produce', step: 0.5 },
      { q: 6, n: 'corn tortilla', p: 'corn tortillas', s: 'Pantry', step: 1 },
      { q: 0.5, u: 'can', n: 'black beans', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 0.5, u: 'cup', n: 'salsa', s: 'Pantry', step: 0.25 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Ground turmeric', step: 0.25, swap: 'Skip it. It’s mostly there for the sunny colour.' },
      { q: 0.5, u: 'tsp', n: 'Ground cumin', step: 0.25, swap: 'A pinch of chili powder, or skip it.' },
      { q: 0.5, u: 'tsp', n: 'Garlic powder', step: 0.25, swap: 'Skip it. The salsa has your back.' },
    ],
    zero: 'Put the frying pan on the stove.',
    steps: [
      { do: 'Drain the tofu and pat it dry. Crumble it into rough bits with your hands.', mins: 2 },
      { do: 'Oil in the pan, medium-high heat. Tofu in with the spices and a pinch of salt.', timer: { id: 'tofu', label: 'Tofu', mins: 6 } },
      { do: 'Drain and rinse the beans.', mins: 1 },
      { wait: 'tofu', note: 'Stir every couple of minutes so it browns in spots.', clean: { text: 'Can in the recycling. Wipe the counter.' } },
      { do: 'Stir in the beans and spinach until the spinach wilts.', mins: 2 },
      { do: 'Warm the tortillas in the microwave under a damp paper towel.', mins: 1 },
      { do: 'Fill the tortillas and top with salsa.', mins: 1 },
    ],
  },
  {
    id: 'greek-chicken', meal: 'lunch', name: 'Greek chicken salad with feta', time: 20, effort: 2, base: 2, kcal: 510, protein: 40,
    cuisine: 'Greek', diet: ['gluten-free'], allergens: ['dairy'],
    nut: { carbs: 12, fiber: 3, fat: 33, sugar: 6, sodium: 980 },
    blurb: 'Hot oregano chicken over a cold, crunchy salad with olives, feta and a lemony dressing.',
    dishes: ['frying pan', 'big bowl', 'cutting board'],
    ingredients: [
      { q: 0.75, u: 'lb', n: 'boneless chicken breast', s: 'Meat', step: 0.25 },
      { q: 0.5, n: 'cucumber', p: 'cucumbers', s: 'Produce', step: 0.5 },
      { q: 1, u: 'cup', n: 'cherry tomatoes', s: 'Produce', step: 0.25 },
      { q: 0.25, n: 'red onion', p: 'red onions', s: 'Produce', step: 0.25 },
      { q: 0.25, u: 'cup', n: 'kalamata olives', s: 'Pantry', step: 0.25 },
      { q: 0.5, u: 'cup', n: 'crumbled feta', s: 'Dairy', step: 0.25 },
      { q: 1, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 3, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Dried oregano', step: 0.25, swap: 'Dried thyme or Italian seasoning.' },
      { q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it.' },
    ],
    zero: 'Put the frying pan on the stove and the big bowl on the counter.',
    steps: [
      { do: 'Slice the chicken into strips. Toss with 1 tbsp of the oil, half the oregano and a pinch of salt.', mins: 3 },
      { do: 'Medium-high heat. Chicken into the pan in one layer.', timer: { id: 'c1', label: 'Chicken, side 1', mins: 4 } },
      { do: 'Chop the cucumber, halve the tomatoes and slice the onion thinly. All into the big bowl.', mins: 4 },
      { wait: 'c1', clean: { text: 'Rinse the cutting board and knife.', dish: 'cutting board' } },
      { do: 'Turn the chicken strips over.', timer: { id: 'c2', label: 'Chicken, side 2', mins: 4 } },
      { do: 'Whisk the rest of the oil with the lemon juice, oregano and pepper. Pour it over the veg.', mins: 2 },
      { wait: 'c2', clean: { text: 'Olive oil and oregano back in the cupboard.' } },
      { do: 'Add the olives, feta and chicken to the bowl and toss.', mins: 1 },
    ],
  },
  {
    id: 'tuna-cups', meal: 'lunch', name: 'Lemony tuna lettuce cups', time: 10, effort: 1, base: 2, kcal: 390, protein: 32,
    cuisine: 'American', diet: ['pescatarian', 'gluten-free', 'dairy-free'], allergens: ['fish'], tags: ['avocado'],
    nut: { carbs: 9, fiber: 6, fat: 25, sugar: 2, sodium: 560 },
    blurb: 'Tuna salad without the mayo: lemon, olive oil, crunchy celery and avocado, scooped into lettuce.',
    dishes: ['bowl', 'cutting board'],
    ingredients: [
      { q: 2, u: 'can', n: 'tuna in water', size: '5 oz', s: 'Pantry', step: 1 },
      { q: 1, n: 'avocado', p: 'avocados', s: 'Produce', step: 0.5 },
      { q: 1, n: 'celery stalk', p: 'celery stalks', s: 'Produce', step: 1 },
      { q: 0.25, n: 'red onion', p: 'red onions', s: 'Produce', step: 0.25 },
      { q: 1, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tsp', n: 'Dijon mustard', s: 'Pantry', step: 0.5 },
      { q: 1, n: 'head butter lettuce', p: 'heads butter lettuce', s: 'Produce', step: 0.5 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it, or a pinch of red pepper flakes.' }],
    zero: 'Get the bowl and the can opener out.',
    steps: [
      { do: 'Drain the tuna and flake it into the bowl.', mins: 2 },
      { do: 'Finely chop the celery and onion. Dice the avocado.', mins: 4 },
      { do: 'Mix it all with the lemon juice, oil, mustard, pepper and a pinch of salt.', mins: 2 },
      { do: 'Separate the lettuce leaves, rinse and shake them dry. Spoon the tuna in.', mins: 2 },
    ],
  },
  {
    id: 'quinoa-bowl', meal: 'lunch', name: 'Chickpea quinoa bowl with lemon tahini', time: 25, effort: 2, base: 2, kcal: 590, protein: 19,
    cuisine: 'Middle Eastern', diet: ['vegan', 'gluten-free'], allergens: ['sesame'],
    nut: { carbs: 76, fiber: 16, fat: 22, sugar: 6, sodium: 520 },
    blurb: 'Fluffy quinoa, spiced chickpeas and crunchy veg under a creamy lemon tahini sauce.',
    dishes: ['saucepan', 'bowl', 'cutting board'],
    ingredients: [
      { q: 0.75, u: 'cup', n: 'quinoa', s: 'Pantry', step: 0.25 },
      { q: 1, u: 'can', n: 'chickpeas', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 0.5, n: 'cucumber', p: 'cucumbers', s: 'Produce', step: 0.5 },
      { q: 1, u: 'cup', n: 'cherry tomatoes', s: 'Produce', step: 0.25 },
      { q: 3, u: 'tbsp', n: 'tahini', s: 'Pantry', step: 0.5 },
      { q: 1, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 1, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Ground cumin', step: 0.25, swap: 'A little extra paprika.' },
      { q: 0.5, u: 'tsp', n: 'Smoked paprika', step: 0.25, swap: 'Regular paprika, or skip it.' },
    ],
    zero: 'Fill the kettle and switch it on.',
    steps: [
      { do: 'Rinse the quinoa. Into the saucepan with 1½ cups of boiling water and a pinch of salt. Lid on, low heat.', timer: { id: 'q', label: 'Quinoa', mins: 15 } },
      { do: 'Drain and rinse the chickpeas. Toss them with the spices.', mins: 2 },
      { do: 'Chop the cucumber and halve the tomatoes.', mins: 3 },
      { do: 'Whisk the tahini with the lemon juice, crushed garlic and 3 tbsp of water until smooth.', mins: 3 },
      { wait: 'q', clean: { text: 'Rinse the cutting board and knife.', dish: 'cutting board' } },
      { do: 'Fluff the quinoa. Build the bowls: spinach, quinoa, chickpeas and veg, with the sauce on top.', mins: 2 },
    ],
  },
  {
    id: 'salmon', meal: 'dinner', name: 'Garlic butter salmon & green beans', time: 20, effort: 2, base: 2, kcal: 480, protein: 36,
    cuisine: 'French', diet: ['pescatarian', 'gluten-free'], allergens: ['fish', 'dairy'],
    nut: { carbs: 10, fiber: 4, fat: 32, sugar: 4, sodium: 420 },
    blurb: 'Crispy-skinned salmon basted in garlic butter, with snappy green beans tossed in the pan.',
    dishes: ['frying pan', 'saucepan'],
    ingredients: [
      { q: 2, n: 'salmon fillet', p: 'salmon fillets', size: '6 oz', s: 'Meat', step: 1 },
      { q: 0.5, u: 'lb', n: 'green beans', s: 'Produce', step: 0.25 },
      { q: 2, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 3, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 1, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Dried dill', step: 0.25, swap: 'Dried parsley, or skip it.' },
      { q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it.' },
    ],
    zero: 'Fill the saucepan with water and put it on to boil.',
    steps: [
      { do: 'Pat the salmon dry. Season with the dill, pepper and a pinch of salt.', mins: 2 },
      { do: 'Trim the green beans. Crush the garlic.', mins: 3 },
      { do: 'Beans into the boiling water.', timer: { id: 'beans', label: 'Green beans', mins: 4 } },
      { do: 'Oil in the frying pan, medium-high heat. Salmon in, skin side down.', timer: { id: 's1', label: 'Salmon, side 1', mins: 5 } },
      { wait: 'beans', clean: { text: 'Drain the beans and set them aside. Leave the saucepan to soak.' } },
      { wait: 's1', clean: { text: 'Dill and pepper back in the cupboard.' } },
      { do: 'Flip the salmon. Add the butter and garlic around it.', timer: { id: 's2', label: 'Salmon, side 2', mins: 3 } },
      { wait: 's2', note: 'Spoon the garlic butter over the salmon while it finishes.', clean: { text: 'Get the plates out.' } },
      { do: 'Toss the beans in the pan butter. Plate up with lemon squeezed over.', mins: 1 },
    ],
  },
  {
    id: 'tuscan-chicken', meal: 'dinner', name: 'Creamy Tuscan chicken & mushrooms', time: 30, effort: 2, base: 2, kcal: 620, protein: 44,
    cuisine: 'Italian', diet: ['gluten-free'], allergens: ['dairy'],
    nut: { carbs: 12, fiber: 3, fat: 44, sugar: 6, sodium: 860 },
    blurb: 'Golden chicken thighs in a garlicky parmesan cream with mushrooms, spinach and sun-dried tomatoes.',
    dishes: ['large frying pan', 'cutting board'],
    ingredients: [
      { q: 1, u: 'lb', n: 'boneless chicken thighs', s: 'Meat', step: 0.25 },
      { q: 8, u: 'oz', n: 'mushrooms', s: 'Produce', step: 4 },
      { q: 3, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 0.25, u: 'cup', n: 'sun-dried tomatoes', s: 'Pantry', step: 0.25 },
      { q: 0.5, u: 'cup', n: 'heavy cream', s: 'Dairy', step: 0.25 },
      { q: 0.25, u: 'cup', n: 'grated parmesan', s: 'Dairy', step: 0.25 },
      { q: 3, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Italian seasoning', step: 0.25, swap: 'Dried oregano or basil.' },
      { q: 0.25, u: 'tsp', n: 'Red pepper flakes', step: 0.25, swap: 'Leave it out. It’s just a little warmth.' },
    ],
    zero: 'Put the large frying pan on the stove.',
    steps: [
      { do: 'Pat the chicken dry. Season with the Italian seasoning and a pinch of salt.', mins: 2 },
      { do: 'Oil in the pan, medium-high heat. Chicken in.', timer: { id: 'c1', label: 'Chicken, side 1', mins: 6 } },
      { do: 'Slice the mushrooms, crush the garlic and chop the sun-dried tomatoes.', mins: 4 },
      { wait: 'c1', clean: { text: 'Rinse the cutting board and knife.', dish: 'cutting board' } },
      { do: 'Flip the chicken.', timer: { id: 'c2', label: 'Chicken, side 2', mins: 5 } },
      { wait: 'c2', clean: { text: 'Wipe the counter next to the stove.' } },
      { do: 'Chicken onto a plate. Mushrooms into the pan.', timer: { id: 'mush', label: 'Mushrooms', mins: 5 } },
      { wait: 'mush', clean: { text: 'Spices back in the cupboard.' } },
      { do: 'Add the garlic, tomatoes, cream and parmesan. Stir in the spinach until it wilts, then put the chicken back in.', mins: 3 },
    ],
  },
  {
    id: 'curry', meal: 'dinner', name: 'Coconut chickpea curry with rice', time: 35, effort: 2, base: 2, kcal: 640, protein: 17,
    cuisine: 'Indian', diet: ['vegan', 'gluten-free'], allergens: [],
    nut: { carbs: 92, fiber: 14, fat: 22, sugar: 10, sodium: 780 },
    blurb: 'A mild, creamy curry from the cupboard, with spinach stirred in at the end and fluffy rice.',
    dishes: ['big pot', 'saucepan', 'cutting board'],
    ingredients: [
      { q: 0.75, u: 'cup', n: 'basmati rice', s: 'Pantry', step: 0.25 },
      { q: 1, u: 'can', n: 'chickpeas', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'can', n: 'light coconut milk', size: '13.5 oz', s: 'Pantry', step: 0.5 },
      { q: 0.5, u: 'can', n: 'diced tomatoes', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 1, n: 'onion', p: 'onions', s: 'Produce', step: 0.5 },
      { q: 2, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 2, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 0.25, u: 'cup', n: 'fresh cilantro', s: 'Produce', step: 0.25 },
      { q: 1, u: 'tbsp', n: 'vegetable oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tbsp', n: 'Curry powder', step: 0.5, swap: 'Garam masala, or cumin and paprika together.' },
      { q: 0.5, u: 'tsp', n: 'Ground turmeric', step: 0.25, swap: 'Skip it.' },
      { q: 0.5, u: 'tsp', n: 'Ground ginger', step: 0.25, swap: 'Skip it, or grate in a little fresh ginger.' },
    ],
    zero: 'Fill the kettle and switch it on.',
    steps: [
      { do: 'Rinse the rice. Into the saucepan with 1½ cups of boiling water. Lid on, lowest heat.', timer: { id: 'rice', label: 'Rice', mins: 15 } },
      { do: 'Chop the onion. Crush the garlic.', mins: 3 },
      { do: 'Oil in the big pot, medium heat. Onion in with a pinch of salt.', timer: { id: 'onion', label: 'Onion', mins: 5 } },
      { do: 'Drain and rinse the chickpeas.', mins: 1 },
      { wait: 'onion', clean: { text: 'Rinse the cutting board and knife.', dish: 'cutting board' } },
      { do: 'Stir in the garlic and spices for a minute. Add the chickpeas, coconut milk and tomatoes.', timer: { id: 'simmer', label: 'Curry', mins: 10 } },
      { wait: 'simmer', clean: { text: 'Cans in the recycling. Spices back in the cupboard.' } },
      { do: 'Stir in the spinach until it wilts. Taste, and add salt if it needs it.', mins: 1 },
      { wait: 'rice', clean: { text: 'Get the bowls out.' } },
      { do: 'Fluff the rice. Curry on top, cilantro over.', mins: 1 },
    ],
  },
  {
    id: 'sweet-potato-tacos', meal: 'dinner', name: 'Sweet potato & black bean tacos', time: 40, effort: 1, base: 2, kcal: 520, protein: 15,
    cuisine: 'Mexican', diet: ['vegan', 'gluten-free'], allergens: [], has: ['spicy'],
    nut: { carbs: 92, fiber: 19, fat: 11, sugar: 12, sodium: 620 },
    blurb: 'Smoky roasted sweet potato, warm beans and quick-pickled onion. The oven does the hard part.',
    dishes: ['sheet pan', 'saucepan'],
    ingredients: [
      { q: 2, n: 'sweet potato', p: 'sweet potatoes', s: 'Produce', step: 1 },
      { q: 1, u: 'can', n: 'black beans', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 6, n: 'corn tortilla', p: 'corn tortillas', s: 'Pantry', step: 1 },
      { q: 0.5, n: 'red onion', p: 'red onions', s: 'Produce', step: 0.5 },
      { q: 1, n: 'lime', p: 'limes', s: 'Produce', step: 0.5 },
      { q: 0.25, u: 'cup', n: 'fresh cilantro', s: 'Produce', step: 0.25 },
      { q: 0.5, u: 'cup', n: 'salsa', s: 'Pantry', step: 0.25 },
      { q: 1, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [
      { q: 1, u: 'tsp', n: 'Chili powder', step: 0.25, swap: 'Smoked paprika, for smoky without the heat.' },
      { q: 0.5, u: 'tsp', n: 'Ground cumin', step: 0.25, swap: 'Skip it.' },
    ],
    zero: 'Turn the oven on to 425°F (220°C).',
    steps: [
      { do: 'Cut the sweet potatoes into small cubes, skin on. Toss them on the sheet pan with the oil, spices and salt.', mins: 6 },
      { do: 'Into the oven.', timer: { id: 'roast', label: 'Sweet potatoes', mins: 25 } },
      { do: 'Slice the onion thinly and squeeze half the lime over it. Leave it to quick-pickle.', mins: 2 },
      { do: 'Beans into the saucepan with a splash of water and a pinch of salt. Low heat.', mins: 1 },
      { wait: 'roast', note: 'Give the pan a shake halfway if you think of it.', clean: { text: 'Wipe the counter and put the spices away.' } },
      { do: 'Warm the tortillas in the microwave under a damp paper towel.', mins: 1 },
      { do: 'Fill with beans, sweet potato, pickled onion, salsa and cilantro. Lime on the side.', mins: 2 },
    ],
  },
  {
    id: 'lemon-pasta', meal: 'dinner', name: 'Lemon spinach pasta with parmesan', time: 20, effort: 1, base: 2, kcal: 640, protein: 22,
    cuisine: 'Italian', diet: ['vegetarian'], allergens: ['gluten', 'dairy'], tags: ['noodles'],
    nut: { carbs: 92, fiber: 6, fat: 20, sugar: 4, sodium: 520 },
    blurb: 'Spaghetti tossed with butter, lemon, garlic and parmesan until glossy. Spinach wilts right in.',
    dishes: ['big pot', 'colander'],
    ingredients: [
      { q: 8, u: 'oz', n: 'spaghetti', s: 'Pantry', step: 2 },
      { q: 4, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 1, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 2, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 2, u: 'tbsp', n: 'butter', s: 'Dairy', step: 0.5 },
      { q: 0.5, u: 'cup', n: 'grated parmesan', s: 'Dairy', step: 0.25 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it.' },
      { q: 0.25, u: 'tsp', n: 'Red pepper flakes', step: 0.25, swap: 'Leave it out.' },
    ],
    zero: 'Fill the big pot with water and put it on high heat.',
    steps: [
      { do: 'Lid on, pinch of salt.', timer: { id: 'boil', label: 'Water', mins: 6 } },
      { do: 'Zest the lemon, then juice it. Crush the garlic.', mins: 3 },
      { wait: 'boil', clean: { text: 'Put the colander in the sink.' } },
      { do: 'Spaghetti in. Stir so it doesn’t stick.', timer: { id: 'pasta', label: 'Spaghetti', mins: 9 } },
      { wait: 'pasta', note: 'Scoop out a mug of the pasta water before you drain it.', clean: { text: 'Lemon peel in the compost. Wipe the counter.' } },
      { do: 'Drain, then back into the pot off the heat with the butter, garlic, spinach and a splash of pasta water.', mins: 2 },
      { do: 'Toss in the lemon juice, zest, parmesan and pepper until glossy.', mins: 1 },
    ],
  },
  {
    id: 'yogurt-bowl', meal: 'snack', name: 'Greek yogurt berry crunch', time: 5, effort: 1, base: 2, kcal: 340, protein: 26,
    cuisine: 'Greek', diet: ['vegetarian', 'gluten-free'], allergens: ['dairy', 'treenut'], tags: ['berries'],
    nut: { carbs: 26, fiber: 4, fat: 14, sugar: 20, sodium: 85 },
    blurb: 'Thick yogurt, berries and toasted almonds. Feels like dessert, holds you till dinner.',
    dishes: ['small pan'],
    ingredients: [
      { q: 2, u: 'cup', n: 'Greek yogurt', s: 'Dairy', step: 0.5 },
      { q: 1, u: 'cup', n: 'berries, fresh or frozen', s: 'Produce', step: 0.25 },
      { q: 0.25, u: 'cup', n: 'sliced almonds', s: 'Pantry', step: 0.25 },
      { q: 2, u: 'tsp', n: 'honey', s: 'Pantry', step: 1 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Ground cinnamon', step: 0.25, swap: 'Skip it.' }],
    zero: 'Put the small pan on the stove.',
    steps: [
      { do: 'Almonds into the dry pan, medium heat.', timer: { id: 'nuts', label: 'Almonds', mins: 3 } },
      { do: 'Spoon the yogurt into two bowls.', mins: 1 },
      { wait: 'nuts', note: 'Shake the pan now and then. They go from golden to burnt fast.', clean: { text: 'Yogurt back in the fridge.' } },
      { do: 'Top with the berries, almonds, honey and a pinch of cinnamon.', mins: 1 },
    ],
  },
  {
    id: 'deviled-eggs', meal: 'snack', name: 'Smoky deviled eggs', time: 20, effort: 1, base: 2, kcal: 250, protein: 13,
    cuisine: 'American', diet: ['vegetarian', 'gluten-free', 'dairy-free'], allergens: ['egg'],
    nut: { carbs: 1, fiber: 0, fat: 21, sugar: 1, sodium: 290 },
    egg: 'Deviled eggs. I’m going to pretend I didn’t see this.',
    blurb: 'Creamy, tangy and a little smoky. The party snack you can make for just yourself.',
    dishes: ['saucepan', 'bowl'],
    ingredients: [
      { q: 4, n: 'egg', p: 'eggs', s: 'Dairy', step: 1 },
      { q: 2, u: 'tbsp', n: 'mayonnaise', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tsp', n: 'Dijon mustard', s: 'Pantry', step: 0.5 },
      { q: 1, u: 'tbsp', n: 'fresh chives', s: 'Produce', step: 0.5 },
    ],
    spices: [
      { q: 0.25, u: 'tsp', n: 'Smoked paprika', step: 0.25, swap: 'Regular paprika.' },
      { q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it.' },
    ],
    zero: 'Put the saucepan on the stove with a few inches of water.',
    steps: [
      { do: 'Bring the water to a boil, then lower the eggs in gently.', timer: { id: 'boil', label: 'Eggs', mins: 10 } },
      { do: 'Fill the bowl with cold water, and ice if you have it.', mins: 1 },
      { wait: 'boil', clean: { text: 'Get the mayo and mustard out.' } },
      { do: 'Eggs into the cold water.', timer: { id: 'cool', label: 'Cooling', mins: 5 } },
      { wait: 'cool', clean: { text: 'Pour out the saucepan and leave it to dry.', dish: 'saucepan' } },
      { do: 'Peel and halve the eggs. Mash the yolks with the mayo, mustard and pepper. Yes, the yolks. Sorry.', mins: 4 },
      { do: 'Spoon it back in. Paprika and chives on top.', mins: 1 },
    ],
  },
  {
    id: 'rollups', meal: 'snack', name: 'Turkey, cheese & pickle roll-ups', time: 5, effort: 1, base: 2, kcal: 310, protein: 28,
    cuisine: 'American', diet: ['gluten-free'], allergens: ['dairy'],
    nut: { carbs: 4, fiber: 1, fat: 20, sugar: 2, sodium: 1150 },
    blurb: 'Deli turkey and Swiss rolled around a crunchy pickle spear. No cooking, all crunch.',
    dishes: ['cutting board'],
    ingredients: [
      { q: 6, u: 'oz', n: 'sliced deli turkey', s: 'Meat', step: 2 },
      { q: 4, u: 'slice', n: 'Swiss cheese', s: 'Dairy', step: 1 },
      { q: 2, n: 'dill pickle', p: 'dill pickles', s: 'Pantry', step: 1 },
      { q: 1, u: 'tbsp', n: 'yellow mustard', s: 'Pantry', step: 0.5 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Black pepper', step: 0.25, swap: 'Skip it.' }],
    zero: 'Get the cutting board out.',
    steps: [
      { do: 'Cut each pickle lengthwise into four spears.', mins: 1 },
      { do: 'Lay out the turkey slices, a piece of cheese on each, and a stripe of mustard.', mins: 2 },
      { do: 'Roll each one around a pickle spear. Cut them in half if you like.', mins: 2 },
    ],
  },
  {
    id: 'pitaya-bowl', meal: 'breakfast', name: 'Pink dragon fruit smoothie bowl', time: 5, effort: 1, base: 2, kcal: 360, protein: 8,
    cuisine: 'Hawaiian', diet: ['vegan', 'gluten-free'], allergens: [], tags: ['berries'],
    nut: { carbs: 66, fiber: 10, fat: 9, sugar: 40, sodium: 120 },
    blurb: 'Blend, pour, top. It’s bright pink, it takes five minutes, and it counts as breakfast.',
    dishes: ['blender', 'bowl'],
    ingredients: [
      { q: 2, u: 'pack', n: 'frozen dragon fruit', size: '3.5 oz', s: 'Produce', step: 1 },
      { q: 1, n: 'frozen banana', p: 'frozen bananas', s: 'Produce', step: 0.5 },
      { q: 1, u: 'cup', n: 'berries, fresh or frozen', s: 'Produce', step: 0.25 },
      { q: 0.75, u: 'cup', n: 'coconut water', s: 'Pantry', step: 0.25 },
      { q: 2, u: 'tbsp', n: 'pumpkin seeds', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'tsp', n: 'maple syrup', s: 'Pantry', step: 1 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'Ground cinnamon', step: 0.25, swap: 'Skip it. The fruit does the work.' }],
    zero: 'Take the frozen fruit out of the freezer and put the blender on the counter.',
    steps: [
      { do: 'Dragon fruit, banana, half the berries, the coconut water and the cinnamon into the blender.', mins: 1 },
      { do: 'Blend until thick and smooth. Add a splash more coconut water if it gets stuck.', mins: 2 },
      { do: 'Spoon into bowls. Top with the rest of the berries, the pumpkin seeds and a drizzle of maple syrup.', mins: 1 },
    ],
  },
  {
    id: 'miso-soup', meal: 'lunch', name: 'Miso noodle soup with tofu', time: 15, effort: 1, base: 2, kcal: 420, protein: 21,
    cuisine: 'Japanese', diet: ['vegan'], allergens: ['soy', 'gluten'], tags: ['noodles', 'soup'],
    nut: { carbs: 58, fiber: 6, fat: 11, sugar: 5, sodium: 1350 },
    blurb: 'Hot broth, soft tofu and noodles in one pot. The miso goes in last, off the heat, so it stays tasty.',
    dishes: ['saucepan', 'cutting board'],
    ingredients: [
      { q: 3, u: 'cup', n: 'vegetable broth', s: 'Pantry', step: 0.5 },
      { q: 3, u: 'tbsp', n: 'white miso paste', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'bundle', n: 'dried noodles (any kind)', s: 'Pantry', step: 1 },
      { q: 0.5, u: 'block', n: 'firm tofu', size: '14 oz', s: 'Produce', step: 0.5 },
      { q: 2, u: 'cup', n: 'baby spinach', s: 'Produce', step: 0.5 },
      { q: 2, n: 'green onion', p: 'green onions', s: 'Produce', step: 1 },
    ],
    spices: [{ q: 0.25, u: 'tsp', n: 'White pepper', step: 0.25, swap: 'Black pepper works fine.' }],
    zero: 'Put the saucepan on the stove.',
    steps: [
      { do: 'Broth into the saucepan, high heat.', timer: { id: 'boil', label: 'Broth', mins: 5 } },
      { do: 'Cut the tofu into cubes and slice the green onions.', mins: 2 },
      { wait: 'boil', clean: { text: 'Rinse the cutting board and knife.', dish: 'cutting board' } },
      { do: 'Noodles into the broth.', timer: { id: 'noodles', label: 'Noodles', mins: 4 } },
      { wait: 'noodles', clean: { text: 'Get the bowls and a mug out.' } },
      { do: 'Heat off. Stir in the tofu and spinach. Mix the miso with a ladle of broth in the mug, then stir it back in. Green onions on top.', mins: 2 },
    ],
  },
  {
    id: 'saffron-rice', meal: 'dinner', name: 'Saffron chickpea rice', time: 35, effort: 2, base: 2, kcal: 560, protein: 17,
    cuisine: 'Spanish', diet: ['vegan', 'gluten-free'], allergens: [],
    nut: { carbs: 98, fiber: 13, fat: 11, sugar: 8, sodium: 820 },
    blurb: 'A pinch of saffron turns plain rice golden. One pan, peppers and peas, and a squeeze of lemon at the end.',
    dishes: ['large frying pan', 'cutting board', 'mug'],
    ingredients: [
      { q: 1, u: 'pinch', n: 'saffron threads', s: 'Pantry', step: 1 },
      { q: 0.75, u: 'cup', n: 'long-grain rice', s: 'Pantry', step: 0.25 },
      { q: 1, u: 'can', n: 'chickpeas', size: '15 oz', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'cup', n: 'vegetable broth', s: 'Pantry', step: 0.5 },
      { q: 1, n: 'red bell pepper', p: 'red bell peppers', s: 'Produce', step: 0.5 },
      { q: 0.5, u: 'cup', n: 'frozen peas', s: 'Produce', step: 0.25 },
      { q: 1, n: 'onion', p: 'onions', s: 'Produce', step: 0.5 },
      { q: 2, u: 'clove', n: 'garlic', s: 'Produce', step: 1 },
      { q: 0.25, u: 'cup', n: 'fresh parsley', s: 'Produce', step: 0.25 },
      { q: 0.5, n: 'lemon', p: 'lemons', s: 'Produce', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'olive oil', s: 'Pantry', step: 0.5 },
    ],
    spices: [{ q: 1, u: 'tsp', n: 'Smoked paprika', step: 0.25, swap: 'Regular paprika, or skip it.' }],
    zero: 'Fill the kettle and switch it on.',
    steps: [
      { do: 'Crumble the saffron into the mug with a splash of boiling water. Leave it to steep.', mins: 1 },
      { do: 'Chop the onion and pepper. Crush the garlic.', mins: 4 },
      { do: 'Oil in the pan, medium heat. Onion and pepper in.', timer: { id: 'veg', label: 'Veg', mins: 5 } },
      { do: 'Drain and rinse the chickpeas.', mins: 1 },
      { wait: 'veg', clean: { text: 'Rinse the cutting board and knife.', dish: 'cutting board' } },
      { do: 'Stir in the garlic, paprika and rice for a minute. Add the broth, the saffron water and the chickpeas. Lid on, low heat.', timer: { id: 'rice', label: 'Rice', mins: 18 } },
      { wait: 'rice', until: 3, clean: { text: 'Spices back in the cupboard. Can in the recycling.' } },
      { do: 'Scatter the peas over the top and put the lid back on.', mins: 1 },
      { wait: 'rice', clean: { text: 'Chop the parsley and cut the lemon into wedges.' } },
      { do: 'Fluff it up. Parsley over, lemon on the side.', mins: 1 },
    ],
  },
];

const SECTIONS = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Spices'];
const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const fmtQty = (v) => {
  const whole = Math.floor(v + 1e-9);
  const frac = FRACTIONS[Math.round((v - whole) * 100) / 100] || '';
  return whole ? `${whole}${frac}` : frac || '0';
};
// Scale to the servings, round to the ingredient's step, and never drop below one step.
const scaleQty = (item, servings, base) => Math.max(item.step, Math.round((item.q * servings) / base / item.step) * item.step);
const UNIT_PLURALS = { can: 'cans', cup: 'cups', pouch: 'pouches', clove: 'cloves', slice: 'slices', pack: 'packs', bundle: 'bundles', block: 'blocks', pinch: 'pinches' };
function describe(item, qty) {
  const many = qty > 1;
  let unit = item.u || '';
  if (unit && many && UNIT_PLURALS[unit]) unit = UNIT_PLURALS[unit];
  const name = !item.u && many && item.p ? item.p : item.n;
  const size = item.size ? ` (${item.size}${many ? ' each' : ''})` : '';
  return { qty: `${fmtQty(qty)}${unit ? ' ' + unit : ''}`, name: `${name}${size}` };
}

// Diets, allergies, dislikes and the "already have" chips. Keto, low-carb and high-protein
// come from each recipe's numbers; the rest are tagged by hand on the recipe (`diet`).
const DIETS = [
  { id: 'keto', label: 'Keto' }, { id: 'vegetarian', label: 'Vegetarian' }, { id: 'vegan', label: 'Vegan' },
  { id: 'pescatarian', label: 'Pescatarian' }, { id: 'gluten-free', label: 'Gluten-free' }, { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'high-protein', label: 'High-protein' }, { id: 'low-carb', label: 'Low-carb' },
];
const ALLERGENS = [
  { id: 'peanut', label: 'Peanuts' }, { id: 'treenut', label: 'Tree nuts' }, { id: 'dairy', label: 'Milk' },
  { id: 'egg', label: 'Eggs' }, { id: 'gluten', label: 'Wheat / gluten' }, { id: 'soy', label: 'Soy' },
  { id: 'sesame', label: 'Sesame' }, { id: 'fish', label: 'Fish' }, { id: 'shellfish', label: 'Shellfish' },
];
const DISLIKE_IDEAS = ['cilantro', 'mushrooms', 'olives', 'onion', 'tomatoes', 'avocado', 'coconut', 'spicy food'];
const HAVE = [
  { id: 'chicken', label: 'Chicken', test: (n) => /chicken/.test(n) && !/bouillon|broth/.test(n) },
  { id: 'eggs', label: 'Eggs', test: (n) => /^eggs?$/.test(n) },
  { id: 'rice', label: 'Rice', test: (n) => /\brice\b/.test(n) },
  { id: 'pasta', label: 'Pasta', test: (n) => /pasta|spaghetti|noodle/.test(n) },
  { id: 'tortillas', label: 'Tortillas', test: (n) => /tortilla/.test(n) },
  { id: 'potatoes', label: 'Potatoes', test: (n) => /potato/.test(n) },
  { id: 'beans', label: 'Beans', test: (n) => /black beans|kidney beans|chickpea/.test(n) },
  { id: 'cheese', label: 'Cheese', test: (n) => /cheese|cheddar|parmesan|feta/.test(n) },
  { id: 'spinach', label: 'Spinach', test: (n) => /spinach/.test(n) },
  { id: 'lemon', label: 'Lemon', test: (n) => /\blemons?\b/.test(n) },
];
// The house: you (Yolkie, in the kitchen) and up to two more people, because the kitchen fits three.
// Each member is drawn as one of the three kitchen characters; Boyd and Scramble are the defaults.
const MAX_HOUSE = 3;
const CHARS = ['yolk', 'boiled', 'scramble'];
const CHAR_FACES = { boiled: { idle: 'boyd-default', win: 'boyd-happy', lose: 'boyd-default' }, scramble: { idle: 'scramble-default', win: 'scramble-default', lose: 'scramble-pout' } };
const DEFAULT_MEMBERS = [
  { id: 'you', name: 'You', char: 'yolk', role: 'owner', status: 'active' },
  { id: 'boyd', name: 'Boyd', char: 'boiled', role: 'member', status: 'active' },
  { id: 'scramble', name: 'Scramble', char: 'scramble', role: 'member', status: 'active' },
];
const noRestr = () => ({ diets: [], allergies: [], dislikes: [], keepOut: [] });
const CHALLENGES = [
  { id: 'rescue', name: 'Use-it-up week', goal: 2, unit: 'fridge rescues', icon: 'kitchen', blurb: 'Cook 2 meals with something you already have.', badge: 'Fridge hero' },
  { id: 'speed', name: 'Speed round', goal: 3, unit: 'meals under 20 minutes', icon: 'bolt', blurb: 'Cook 3 meals that take under 20 minutes.', badge: 'Quick draw' },
  { id: 'explorer', name: 'Explorer', goal: 2, unit: 'new cuisines', icon: 'travel_explore', blurb: 'Cook 2 cuisines you haven’t cooked here yet.', badge: 'Globetrotter' },
];

// Yolkie's closet: accessory layers drawn in the mascot's own viewBox (-110 -200 220 220), laid
// over the untouched mascot SVG. `box` crops each one for its closet thumbnail.
const INK = '#2A1E3F';
const CLOSET = [
  { id: 'chef', name: 'Chef hat', slot: 'head', at: 1, box: '-62 -206 124 80', svg: `<g>
    <path d="M-44,-146 C-48,-160 -42,-166 -36,-168 C-46,-186 -24,-200 -10,-190 C-4,-204 22,-204 26,-188 C42,-196 58,-180 44,-166 C50,-160 48,-150 44,-146 Z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-16,-178 Q-14,-166 -12,-158 M14,-180 Q12,-168 12,-158" stroke="#DAD4EA" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M-46,-150 Q0,-162 46,-150 L46,-132 Q0,-144 -46,-132 Z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></g>` },
  { id: 'beanie', name: 'Beanie', slot: 'head', at: 3, box: '-80 -190 160 94', svg: `<g>
    <path d="M-66,-114 C-70,-176 70,-176 66,-114 Z" fill="#6B4DE6" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-30,-156 L-36,-120 M0,-160 L0,-120 M30,-156 L36,-120" stroke="#4E35BE" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="-70" y="-126" width="140" height="22" rx="11" fill="#4E35BE" stroke="${INK}" stroke-width="4"/>
    <circle cx="0" cy="-168" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/></g>` },
  { id: 'apron', name: 'Apron', slot: 'body', at: 5, box: '-62 -66 124 60', svg: `<g>
    <path d="M-56,-46 Q-42,-60 -26,-50 M56,-46 Q42,-60 26,-50" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M-26,-50 L26,-50 L34,-20 Q0,-8 -34,-20 Z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-12,-34 L12,-34 L12,-24 Q0,-20 -12,-24 Z" fill="none" stroke="#B9AFD6" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="0" cy="-43" r="3.5" fill="#FFC83D"/></g>` },
  { id: 'shades', name: 'Sunglasses', slot: 'face', at: 8, box: '-72 -112 144 42', svg: `<g>
    <path d="M-66,-98 L-42,-95 M66,-98 L42,-95" stroke="#1E1A2E" stroke-width="5" stroke-linecap="round"/>
    <rect x="-44" y="-104" width="38" height="26" rx="11" fill="#1E1A2E"/>
    <rect x="6" y="-104" width="38" height="26" rx="11" fill="#1E1A2E"/>
    <path d="M-7,-95 Q0,-101 7,-95" stroke="#1E1A2E" stroke-width="5" fill="none"/>
    <path d="M-36,-97 L-26,-97 M14,-97 L24,-97" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/></g>` },
  { id: 'scarf', name: 'Scarf', slot: 'neck', at: 12, box: '-66 -54 132 70', svg: `<g>
    <path d="M26,-26 L40,6 L24,10 L14,-22 Z" fill="#FF7D6B" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-60,-46 Q0,-20 60,-46 L58,-28 Q0,-2 -58,-28 Z" fill="#FF7D6B" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-30,-34 L-28,-19 M0,-30 L0,-15 M30,-34 L28,-19" stroke="#FFC83D" stroke-width="4" stroke-linecap="round"/></g>` },
  { id: 'party', name: 'Party hat', slot: 'head', at: 20, box: '-44 -206 96 72', svg: `<g transform="rotate(14 0 -150)">
    <path d="M-26,-148 L0,-194 L26,-148 Q0,-140 -26,-148 Z" fill="#2E9E6A" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="-7" cy="-160" r="4" fill="#FFC83D"/><circle cx="7" cy="-170" r="4" fill="#FFC83D"/><circle cx="8" cy="-154" r="4" fill="#fff"/>
    <circle cx="0" cy="-194" r="7" fill="#FF7D6B" stroke="${INK}" stroke-width="3"/></g>` },
];
const SLOT_ORDER = ['body', 'neck', 'face', 'head'];
const accLayers = (outfit) => SLOT_ORDER.map((s) => (outfit[s] ? CLOSET.find((c) => c.id === outfit[s]).svg : '')).join('');

const lower = (s) => String(s).toLowerCase();
const stem = (s) => lower(s).trim().replace(/ food$/, '').replace(/(es|s)$/, '');
const labelOf = (list, id) => (list.find((x) => x.id === id) || { label: id }).label;
const listText = (arr) => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
const byId = (id) => RECIPES.find((r) => r.id === id);
const itemNames = (r) => [...r.ingredients, ...r.spices].map((i) => lower(i.n));
const mentions = (r, term) => (stem(term) === 'spicy' ? (r.has || []).includes('spicy') : itemNames(r).some((n) => n.includes(stem(term))));
function dietsOf(r) {
  if (!r.dietSet) {
    const d = new Set(r.diet);
    if (d.has('vegan')) { d.add('vegetarian'); d.add('dairy-free'); }
    if (d.has('vegetarian')) d.add('pescatarian');
    if (r.protein >= 25) d.add('high-protein');
    if (r.nut.carbs <= 25) d.add('low-carb');
    if (r.nut.carbs - r.nut.fiber <= 10) d.add('keto');
    r.dietSet = d;
  }
  return r.dietSet;
}
const allergic = (r, list) => list.some((a) => (ALLERGENS.some((x) => x.id === a) ? r.allergens.includes(a) : mentions(r, a)));
const haveTest = (key) => { const p = HAVE.find((h) => h.id === key); return p ? p.test : (n) => n.includes(stem(key)); };
const hasItem = (item, have) => have.some((k) => haveTest(k)(lower(item.n)));
const usesHave = (r, have) => have.filter((k) => r.ingredients.some((i) => haveTest(k)(lower(i.n))));
const haveLabel = (key) => lower(labelOf(HAVE, key));
const CUISINES = [...new Set(RECIPES.map((r) => r.cuisine))].sort();
const ALL_ITEMS = [...new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => lower(i.n))))].sort();
const tagged = (r, t) => (r.tags || []).includes(t);

/* ---------- Characters: the house and the friends ---------- */

// Bodies in the mascots' own coordinates (viewBox -110 -200 220 220), with the mascots' eyes, cheeks,
// mouth and arms on top, so every character matches. The provided mascot files are never touched.
// `top` is where a name tag sits above the head.
const GRAD = (id, stops, cx = '35%', cy = '28%', r = '78%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => `<stop offset="${[0, 0.55, 1][i]}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const BODIES = {
  yolk: (id) => ({ top: -160, arm: '#EE9D1C', defs: GRAD(`yg_${id}`, ['#FFE68A', '#FFC531', '#F09A12']),
    base: '<path d="M-104,-6 C-112,-30 -74,-38 -42,-32 C-22,-48 30,-46 52,-32 C84,-40 114,-24 100,-6 C92,12 50,14 0,12 C-52,14 -96,12 -104,-6Z" fill="#fff"/>',
    body: `<circle cx="0" cy="-84" r="70" fill="url(#yg_${id})"/><ellipse cx="-26" cy="-120" rx="22" ry="12" fill="#fff" opacity=".6" transform="rotate(-25 -26 -120)"/>` }),
  boiled: (id) => ({ top: -200, arm: '#CFC6E2', defs: GRAD(`wg_${id}`, ['#FFFFFF', '#F6F3FB', '#DCD5EA'], '35%', '25%', '85%'),
    body: `<path d="M0,-188 C52,-188 80,-112 80,-62 C80,-14 44,8 0,8 C-44,8 -80,-14 -80,-62 C-80,-112 -52,-188 0,-188Z" fill="url(#wg_${id})"/><ellipse cx="-28" cy="-138" rx="16" ry="26" fill="#fff" opacity=".9" transform="rotate(20 -28 -138)"/>` }),
  scramble: () => {
    const C = [[-50, -66, 40], [0, -104, 50], [50, -70, 42], [-22, -36, 40], [28, -34, 40], [-64, -26, 28], [64, -26, 28], [-30, -108, 34], [34, -112, 32]];
    return { top: -170, arm: '#EDB22A', defs: '',
      body: C.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFDD6E"/>`).join('') + C.map(([x, y, r]) => `<circle cx="${x + r * 0.3}" cy="${y + r * 0.35}" r="${r * 0.5}" fill="#F7C94B" opacity=".55"/>`).join('') + '<circle cx="-52" cy="-128" r="5" fill="#3E9B5C"/><circle cx="40" cy="-140" r="4" fill="#3E9B5C"/><circle cx="66" cy="-60" r="4.5" fill="#3E9B5C"/><ellipse cx="-24" cy="-136" rx="16" ry="9" fill="#fff" opacity=".55"/>' };
  },
  avo: (id) => ({ top: -196, arm: '#3F7D32',
    defs: GRAD(`as_${id}`, ['#86BF5E', '#4E8E3A', '#2E6224']) + GRAD(`af_${id}`, ['#F7F9C4', '#DDEB98', '#B4D46C'], '40%', '35%', '80%') + GRAD(`ap_${id}`, ['#D9A174', '#A8673E', '#7A4526']),
    body: `<path d="M0,-192 C34,-192 54,-158 62,-126 C70,-96 88,-70 84,-40 C80,-6 46,10 0,10 C-46,10 -80,-6 -84,-40 C-88,-70 -70,-96 -62,-126 C-54,-158 -34,-192 0,-192Z" fill="url(#as_${id})"/>
      <path d="M0,-178 C26,-178 42,-152 49,-124 C56,-98 72,-74 69,-44 C66,-14 38,-4 0,-4 C-38,-4 -66,-14 -69,-44 C-72,-74 -56,-98 -49,-124 C-42,-152 -26,-178 0,-178Z" fill="url(#af_${id})"/>
      <circle cx="0" cy="-24" r="20" fill="url(#ap_${id})"/><ellipse cx="-7" cy="-31" rx="7" ry="4.5" fill="#fff" opacity=".4"/>
      <ellipse cx="-22" cy="-142" rx="11" ry="20" fill="#fff" opacity=".5" transform="rotate(20 -22 -142)"/>` }),
  toast: (id) => ({ top: -204, arm: '#B8732F',
    defs: GRAD(`tc_${id}`, ['#EDB46A', '#C9843C', '#A0612A']) + GRAD(`tb_${id}`, ['#FFF4D6', '#F8DFA8', '#EECB86'], '40%', '30%', '85%'),
    body: `<path d="M-72,-6 Q-72,6 -60,6 L60,6 Q72,6 72,-6 L72,-118 C100,-124 104,-178 62,-186 C30,-198 -30,-198 -62,-186 C-104,-178 -100,-124 -72,-118 Z" fill="url(#tc_${id})"/>
      <path d="M-60,-8 L60,-8 L60,-128 C84,-134 86,-170 54,-174 C26,-184 -26,-184 -54,-174 C-86,-170 -84,-134 -60,-128 Z" fill="url(#tb_${id})"/>
      <rect x="12" y="-172" width="36" height="24" rx="7" fill="#FFE27A" transform="rotate(-8 30 -160)"/><rect x="17" y="-169" width="16" height="6" rx="3" fill="#fff" opacity=".7" transform="rotate(-8 30 -160)"/>
      <ellipse cx="-34" cy="-150" rx="14" ry="8" fill="#fff" opacity=".55" transform="rotate(-20 -34 -150)"/>` }),
  benny: (id) => ({ top: -194, arm: '#E2A93A',
    defs: GRAD(`bw_${id}`, ['#FFFFFF', '#F7F3FC', '#E1DAEE'], '35%', '25%', '85%') + GRAD(`bh_${id}`, ['#FFF0A8', '#FFD45C', '#F2AE2A']) + GRAD(`bm_${id}`, ['#F2D3A0', '#DDB173', '#BE8E52']),
    body: `<path d="M-84,-30 C-84,-48 -50,-56 0,-56 C50,-56 84,-48 84,-30 L84,-10 C84,8 50,14 0,14 C-50,14 -84,8 -84,-10 Z" fill="url(#bm_${id})"/>
      <circle cx="-40" cy="-16" r="3" fill="#A87A44"/><circle cx="-10" cy="-6" r="3" fill="#A87A44"/><circle cx="26" cy="-14" r="3" fill="#A87A44"/><circle cx="52" cy="-6" r="3" fill="#A87A44"/>
      <ellipse cx="0" cy="-54" rx="90" ry="15" fill="#F3949B"/><ellipse cx="0" cy="-57" rx="84" ry="11" fill="#F8B2B6"/>
      <path d="M-74,-58 C-78,-140 -40,-186 0,-186 C40,-186 78,-140 74,-58 Z" fill="url(#bw_${id})"/>
      <path d="M-64,-148 C-42,-186 42,-186 64,-148 C72,-134 66,-118 58,-122 C52,-108 42,-126 32,-116 C24,-102 12,-118 0,-112 C-12,-102 -22,-122 -32,-114 C-44,-106 -50,-126 -58,-120 C-68,-118 -72,-136 -64,-148 Z" fill="url(#bh_${id})"/>
      <path d="M-20,-170 l6,-8 M2,-174 l2,-9 M22,-168 l7,-7" stroke="#3E9B5C" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="-30" cy="-160" rx="14" ry="7" fill="#fff" opacity=".6" transform="rotate(-20 -30 -160)"/>` }),
  noodle: (id) => ({ top: -210, arm: '#CFC6E2',
    defs: GRAD(`nc_${id}`, ['#FFFFFF', '#F5F1FB', '#DCD4EC'], '35%', '30%', '85%'),
    body: `<path d="M-64,-150 C-62,-178 -42,-170 -36,-186 C-28,-202 -12,-180 0,-192 C12,-204 28,-184 36,-190 C48,-198 60,-174 64,-150 Z" fill="#FFD86B"/>
      <path d="M-46,-160 q8,-10 16,0 t16,0 t16,0 t16,0 t16,0" stroke="#F2B93A" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M-76,-154 L76,-154 L60,0 Q58,10 48,10 L-48,10 Q-58,10 -60,0 Z" fill="url(#nc_${id})"/>
      <rect x="-80" y="-160" width="160" height="12" rx="6" fill="#EFE8FA"/>
      <path d="M-72,-136 L72,-136 L70,-114 L-70,-114 Z" fill="#6B4DE6"/><circle cx="0" cy="-125" r="6" fill="#FFC83D"/>
      <ellipse cx="-38" cy="-30" rx="10" ry="22" fill="#fff" opacity=".8" transform="rotate(8 -38 -30)"/>` }),
  berry: (id) => ({ top: -196, arm: '#D33A4C',
    defs: GRAD(`rb_${id}`, ['#FFA3AB', '#F24E60', '#C72E43']),
    body: `<path d="M0,-150 C40,-176 92,-150 82,-96 C74,-48 34,-6 0,8 C-34,-6 -74,-48 -82,-96 C-92,-150 -40,-176 0,-150 Z" fill="url(#rb_${id})"/>
      ${[[-56, -124], [54, -126], [-66, -96], [66, -96], [-40, -36], [38, -34], [0, -18], [-62, -60], [62, -60], [-20, -44], [20, -44]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="4.5" fill="#FFE27A"/>`).join('')}
      <path d="M0,-150 C-20,-176 -56,-168 -62,-150 C-44,-152 -30,-146 -22,-140 C-30,-130 -36,-118 -34,-110 C-20,-118 -8,-130 0,-140 C8,-130 20,-118 34,-110 C36,-118 30,-130 22,-140 C30,-146 44,-152 62,-150 C56,-168 20,-176 0,-150 Z" fill="#4CAF6B"/>
      <path d="M0,-152 C-2,-170 4,-184 12,-190" stroke="#2E8A52" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="-40" cy="-128" rx="12" ry="7" fill="#fff" opacity=".55" transform="rotate(-30 -40 -128)"/>` }),
};
// The whole character: body, arms, cheeks, eyes (open and happy) and mouths (smile, beam, talking).
// Ids are prefixed with `id` so the kitchen can animate the parts.
function charSVG(id, type, acc = '') {
  const B = BODIES[type](id);
  return `<defs>${B.defs}</defs>
    <ellipse cx="0" cy="8" rx="80" ry="12" fill="rgba(30,20,60,.18)"/>
    <g id="${id}_all">${B.base || ''}
    <g id="${id}_aL"><path d="M-60,-72 Q-80,-66 -86,-50" stroke="${B.arm}" stroke-width="11" fill="none" stroke-linecap="round"/></g>
    <g id="${id}_aR"><path d="M60,-72 Q80,-66 86,-50" stroke="${B.arm}" stroke-width="11" fill="none" stroke-linecap="round"/></g>
    ${B.body}
    <ellipse cx="-44" cy="-66" rx="11" ry="6" fill="#FF7D6B" opacity=".5"/><ellipse cx="44" cy="-66" rx="11" ry="6" fill="#FF7D6B" opacity=".5"/>
    <g id="${id}_eO"><ellipse cx="-24" cy="-90" rx="8" ry="11" fill="${INK}"/><ellipse cx="24" cy="-90" rx="8" ry="11" fill="${INK}"/><circle cx="-21" cy="-94" r="3" fill="#fff"/><circle cx="27" cy="-94" r="3" fill="#fff"/></g>
    <g id="${id}_eH" stroke="${INK}" stroke-width="5.5" fill="none" stroke-linecap="round" style="display:none"><path d="M-35,-86 Q-24,-100 -13,-86"/><path d="M13,-86 Q24,-100 35,-86"/></g>
    <path id="${id}_mS" d="M-12,-64 Q0,-52 12,-64" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path id="${id}_mB" d="M-19,-67 Q0,-36 19,-67 Z" fill="#7A2E2E" style="display:none"/>
    <ellipse id="${id}_mO" cx="0" cy="-60" rx="8" ry="10" fill="#7A2E2E" style="display:none"/>
    ${acc}</g>`;
}
// A standalone picture of a character, for cards, the shelf and Wrapped.
let artSeq = 0;
const charArt = (type, cls = '') => `<svg class="${cls}" viewBox="-110 -200 220 220" aria-hidden="true" focusable="false">${charSVG(`ca${++artSeq}`, type)}</svg>`;

// Friends: unlocked the first time you cook a recipe tagged with their ingredient.
const FRIENDS = [
  { id: 'avo', name: 'Avo', tag: 'avocado', what: 'a recipe with avocado', bio: 'Soft on the inside, a little nutty about brunch. Has never once been ripe on time.' },
  { id: 'toast', name: 'Toast', tag: 'bread', what: 'a recipe with bread', bio: 'Warm, golden and always up first. Pops up when you least expect it.' },
  { id: 'benny', name: 'Benny', tag: 'brunch', what: 'an egg brunch', bio: 'Fancy, but only on weekends. Thinks hollandaise is a personality.' },
  { id: 'noodle', name: 'Noodle', tag: 'noodles', what: 'a noodle recipe', bio: 'Ready in three minutes, then thinks about life for thirty. Slurps loudly.' },
  { id: 'berry', name: 'Berry', tag: 'berries', what: 'a recipe with berries', bio: 'Small, sweet and a little seedy. Turns up to every breakfast in red.' },
];

/* ---------- Recipe cards ---------- */

// Each recipe's card: food art (`art`: a dish shape, its main colour, then the colours of the bits on top),
// a fun fact, and the hint shown on its silhouette until you cook it.
const CARDS = {
  scrambled: { art: ['toast', '#FFD86B', ['#E8553E']], hint: 'Soft and golden, on toast…', fact: 'Low heat is the secret: the eggs set gently and stay soft instead of rubbery.' },
  oatmeal: { art: ['bowl', '#E9D3A8', ['#F7E07A', '#8A5A3C']], hint: 'A warm bowl that keeps you going…', fact: 'Rolled oats are a whole grain: steamed, then pressed flat between rollers.' },
  pancakes: { art: ['stack', '#E8B060', ['#D93A4A', '#6B4DE6']], hint: 'A fluffy stack…', fact: 'The bubbles are gas from the baking powder. When they pop, it’s time to flip.' },
  quesadillas: { art: ['wedges', '#F2D49B', ['#2A1E3F', '#FFC83D']], hint: 'Crispy, melty and folded…', fact: 'Quesadilla comes from queso, the Spanish word for cheese.' },
  'fried-rice': { art: ['bowl', '#F6E7B4', ['#7CC36A', '#FFC83D']], hint: 'A hot pan and a quick toss…', fact: 'Day-old rice fries best. It’s drier, so the grains stay separate.' },
  'lemon-chicken': { art: ['plate', '#E8A85A', ['#FFE27A', '#7CC36A', '#F6F1E4']], hint: 'Bright, zesty and golden…', fact: 'Chicken thighs stay juicier than breasts because they have a little more fat.' },
  'peanut-noodles': { art: ['noodles', '#E9C27A', ['#7CC36A', '#FF8A3D']], hint: 'Slurpy and a little nutty…', fact: 'Peanuts aren’t nuts at all. They’re legumes, like beans and lentils.' },
  soup: { art: ['bowl', '#E8553E', ['#F2C46B']], hint: 'A cozy soup…', fact: 'Botanically, a tomato is a fruit, and more precisely a berry.' },
  'sheet-pan': { art: ['pan', '#C9603A', ['#E9B04C', '#D93A4A', '#7CC36A']], hint: 'One pan, all roasted…', fact: 'Roasting browns food through the Maillard reaction, the same one that toasts bread.' },
  'turkey-chili': { art: ['bowl', '#A8402C', ['#F2D49B', '#FFFFFF']], hint: 'A big pot with a kick…', fact: 'The heat in chili peppers comes from capsaicin, which birds can’t even taste.' },
  'hummus-plate': { art: ['plate', '#E8CFA0', ['#FF8A3D', '#7CC36A', '#E9C27A']], hint: 'A plate made for dipping…', fact: 'Hummus is the Arabic word for chickpea.' },
  popcorn: { art: ['bucket', '#FFF6DA', ['#FFE27A']], hint: 'Pops when it’s ready…', fact: 'Each kernel holds a drop of water. Heat turns it to steam until the kernel bursts.' },
  chickpeas: { art: ['bowl', '#D9A05B', ['#C9822F']], hint: 'Roasted until crunchy…', fact: 'People have been growing chickpeas for thousands of years.' },
  omelette: { art: ['plate', '#FFD86B', ['#3E9B5C', '#FFFFFF']], hint: 'Folded, with greens inside…', fact: 'Spinach shrinks a lot in the pan because it’s mostly water.' },
  'salmon-eggs': { art: ['plate', '#FFE27A', ['#FF8F6B', '#7CC36A']], hint: 'Smoky, creamy and a bit fancy…', fact: 'Smoked salmon is cured with salt before it ever meets the smoke.' },
  'tofu-tacos': { art: ['taco', '#F2D49B', ['#FFF3C4', '#3E9B5C', '#2A1E3F']], hint: 'A taco for the morning…', fact: 'Tofu is made a lot like cheese: soy milk is curdled, then pressed into blocks.' },
  'greek-chicken': { art: ['bowl', '#7CC36A', ['#E8553E', '#FFFFFF', '#3B2A3F']], hint: 'A sunny salad bowl…', fact: 'Feta is traditionally made from sheep’s milk, sometimes with a little goat’s milk.' },
  'tuna-cups': { art: ['cups', '#9FD47A', ['#F6E7C8']], hint: 'Crunchy little lettuce cups…', fact: 'Butter lettuce is named for its soft, buttery leaves. No butter involved.' },
  'quinoa-bowl': { art: ['bowl', '#EADBB0', ['#3E9B5C', '#E8553E', '#D9A05B']], hint: 'A bowl full of tiny seeds…', fact: 'Quinoa has been grown in the Andes for thousands of years.' },
  salmon: { art: ['plate', '#FF8F6B', ['#3E9B5C', '#FFE27A']], hint: 'Pink, flaky and lemony…', fact: 'Salmon gets its pink colour from the krill and shrimp it eats.' },
  'tuscan-chicken': { art: ['plate', '#F6E7C8', ['#E8A85A', '#3E9B5C', '#B23A2A']], hint: 'Creamy, garlicky and green…', fact: 'Garlic turns milder and sweeter the longer it cooks.' },
  curry: { art: ['bowl', '#F2B14A', ['#D9A05B', '#3E9B5C']], hint: 'Warm spices and coconut…', fact: 'Coconut milk is made from grated coconut flesh, not the water inside.' },
  'sweet-potato-tacos': { art: ['taco', '#F2D49B', ['#F08A3C', '#2A1E3F', '#7CC36A']], hint: 'Roasted, orange and a bit spicy…', fact: 'Sweet potatoes and regular potatoes aren’t close relatives.' },
  'lemon-pasta': { art: ['noodles', '#FFE7A0', ['#3E9B5C', '#FFF6DA']], hint: 'Long noodles, bright and lemony…', fact: 'Spaghetti means “little strings” in Italian.' },
  'yogurt-bowl': { art: ['cup', '#FFFFFF', ['#D93A4A', '#6B4DE6', '#E9C27A']], hint: 'A cool cup with berries…', fact: 'Honey stored properly basically never spoils.' },
  'deviled-eggs': { art: ['eggs', '#FFFFFF', ['#FFC83D']], hint: 'Little halves with a zesty middle…', fact: 'In old recipes, “deviled” meant spicy or zesty.' },
  rollups: { art: ['rolls', '#F5B5A8', ['#7CC36A', '#FFE7A0']], hint: 'Rolled up around a pickle…', fact: 'People have been pickling cucumbers in brine for thousands of years.' },
  'pitaya-bowl': { art: ['bowl', '#F25CA2', ['#D93A4A', '#6B4DE6', '#7CC36A']], hint: 'A bright pink bowl…', fact: 'Dragon fruit grows on a climbing cactus.' },
  'miso-soup': { art: ['noodles', '#E8C98A', ['#FFFFFF', '#3E9B5C']], hint: 'A savoury bowl with noodles…', fact: 'Miso goes in off the heat. Boiling it dulls the flavour.' },
  'saffron-rice': { art: ['pan', '#F2C230', ['#E8553E', '#7CC36A', '#E9D3A8']], hint: 'Golden rice with a precious spice…', fact: 'Saffron threads are picked by hand from crocus flowers, which is why it costs so much.' },
};
// Rarity comes from effort, never luck: quick recipes are Common; longer ones, or your first of a
// cuisine, are Rare; anything the whole household sat down to is Special. Five cooks: Mastered.
const RARITY = [null, { id: 'common', name: 'Common' }, { id: 'rare', name: 'Rare' }, { id: 'special', name: 'Special' }];
const MASTER_AT = 5;
const gemSvg = (rar) => `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 1.5 L18.5 7.5 L10 18.5 L1.5 7.5 Z" fill="${['', '#D7DCE8', '#8E74F2', '#FFC83D'][rar]}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M1.5 7.5 H18.5 M7 7.5 L10 18.5 L13 7.5 M6 2.8 L7 7.5 M14 2.8 L13 7.5" stroke="${INK}" stroke-width="1" fill="none" opacity=".45"/>${rar === 3 ? '<path d="M16 1 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z" fill="#fff" stroke="#2A1E3F" stroke-width=".8"/>' : ''}</svg>`;

// Food art in a 120 × 84 box: a plate, bowl or tray, the dish, and a few bits on top.
function dishArt(r) {
  const [kind, main, bits] = CARDS[r.id].art;
  const S = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  const dots = (pts, rr = 4.5) => pts.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${bits[k % bits.length]}" ${S}/>`).join('');
  const plate = `<ellipse cx="60" cy="60" rx="54" ry="18" fill="#fff" ${S}/><ellipse cx="60" cy="58" rx="40" ry="11" fill="#F1ECF9"/>`;
  const bowl = (fill) => `<path d="M12,40 Q14,78 60,78 Q106,78 108,40 Z" fill="#fff" ${S}/><path d="M22,58 Q60,68 98,58" stroke="#B9A8FF" stroke-width="5" fill="none"/><ellipse cx="60" cy="40" rx="48" ry="11" fill="${fill}" ${S}/>`;
  const art = {
    bowl: () => bowl(main) + dots([[40, 38], [58, 42], [78, 37], [50, 34], [70, 42]]),
    noodles: () => bowl(main) + `<path d="M24,40 q8,-8 16,0 t16,0 t16,0 t16,0 t16,0 M30,44 q8,-6 15,0 t15,0 t15,0 t15,0" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".45"/>` + dots([[44, 36], [74, 38], [60, 33]], 4),
    plate: () => plate + `<path d="M34,54 C34,40 54,38 66,42 C82,40 90,50 84,58 C78,66 44,66 34,54 Z" fill="${main}" ${S}/>` + dots([[48, 50], [64, 46], [76, 54], [56, 57]], 4),
    stack: () => plate + [56, 47, 38].map((y) => `<ellipse cx="60" cy="${y}" rx="34" ry="9" fill="${main}" ${S}/>`).join('') + `<path d="M40,36 Q60,26 80,36 L80,40 Q76,48 72,40 Q66,46 62,40 Q54,48 48,40 Q44,44 40,40 Z" fill="#B5651D" ${S}/>` + dots([[52, 30], [64, 28], [72, 32]], 4),
    toast: () => plate + `<path d="M34,58 L34,30 Q34,20 46,20 L74,20 Q86,20 86,30 L86,58 Z" fill="#E9B067" ${S}/><path d="M40,54 L40,32 Q40,26 48,26 L72,26 Q80,26 80,32 L80,54 Z" fill="#F6D9A0"/>` + `<path d="M42,44 C40,34 54,30 60,34 C68,30 80,36 76,44 C74,52 46,54 42,44 Z" fill="${main}" ${S}/>` + dots([[92, 52], [98, 46]], 5),
    taco: () => plate + [[42, 52], [78, 52]].map(([x, y]) => `<path d="M${x - 22},${y} A22 22 0 0 1 ${x + 22},${y} Z" fill="${main}" ${S}/>` + `<path d="M${x - 16},${y - 6} q8,-8 16,0 t16,0" stroke="${bits[1 % bits.length]}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('') + dots([[38, 44], [50, 42], [74, 44], [86, 42]], 3.5),
    wedges: () => plate + [[34, 58, 56, 30, 64, 56], [58, 58, 76, 30, 92, 56]].map(([a, b, c, d, e, f]) => `<path d="M${a},${b} L${c},${d} L${e},${f} Z" fill="${main}" ${S}/><path d="M${a + 6},${b - 4} L${e - 4},${f - 2}" stroke="${bits[1]}" stroke-width="4" stroke-linecap="round"/>`).join('') + dots([[52, 50], [76, 48]], 3),
    bucket: () => `<path d="M30,34 L40,80 L80,80 L90,34 Z" fill="#fff" ${S}/><path d="M38,34 L45,80 M54,34 L56,80 M66,34 L64,80 M82,34 L75,80" stroke="#E8553E" stroke-width="6"/><path d="M30,34 L40,80 L80,80 L90,34 Z" fill="none" ${S}/>` + [[36, 30], [48, 24], [60, 28], [72, 22], [84, 30], [54, 18], [66, 16], [42, 18], [78, 14]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${main}" ${S}/>`).join('') + dots([[50, 26], [70, 20]], 3),
    pan: () => `<path d="M10,56 L26,30 L110,30 L94,56 Z" fill="#C9CCD8" ${S}/><path d="M18,52 L30,34 L102,34 L90,52 Z" fill="${main}"/>` + dots([[36, 40], [50, 46], [64, 38], [78, 46], [88, 40], [44, 50], [70, 50]], 5),
    cups: () => plate + [[36, 50], [60, 44], [84, 50]].map(([x, y]) => `<path d="M${x - 16},${y} Q${x},${y + 18} ${x + 16},${y} Q${x + 8},${y - 12} ${x},${y - 6} Q${x - 8},${y - 12} ${x - 16},${y} Z" fill="${main}" ${S}/><ellipse cx="${x}" cy="${y - 1}" rx="9" ry="5" fill="${bits[0]}" ${S}/>`).join(''),
    cup: () => `<path d="M38,22 L44,78 L76,78 L82,22 Z" fill="${main}" ${S}/><path d="M40,40 L80,40" stroke="#F2E2C2" stroke-width="7"/><path d="M42,58 L78,58" stroke="#F7C3CC" stroke-width="7"/><path d="M38,22 L44,78 L76,78 L82,22 Z" fill="none" ${S}/>` + dots([[48, 18], [60, 14], [72, 18], [54, 22], [66, 22]], 5),
    eggs: () => plate + [[34, 52], [60, 46], [86, 52]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="10" fill="${main}" ${S}/><circle cx="${x}" cy="${y - 2}" r="6" fill="${bits[0]}" ${S}/>`).join('') + dots([[40, 46], [66, 40]], 1.5),
    rolls: () => plate + [[36, 52], [60, 46], [84, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="${main}" ${S}/><circle cx="${x}" cy="${y}" r="7" fill="${bits[1]}" ${S}/><circle cx="${x}" cy="${y}" r="3.5" fill="${bits[0]}"/>`).join(''),
  }[kind];
  const steam = ['bowl', 'noodles', 'plate', 'stack', 'pan'].includes(kind) && r.meal !== 'snack' && r.id !== 'pitaya-bowl' && r.id !== 'greek-chicken' && r.id !== 'quinoa-bowl'
    ? '<path class="dish-steam" d="M48,14 q-6,-6 0,-12 M60,12 q-6,-6 0,-12 M72,14 q-6,-6 0,-12" stroke="#B9A8FF" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>' : '';
  return `<svg class="dish" viewBox="0 0 120 84" aria-hidden="true" focusable="false">${steam}${art()}</svg>`;
}

// Sets in the binder. Finishing one unlocks a small bonus for the kitchen.
const slug = (s) => lower(s).replace(/[^a-z]+/g, '-');
const SETS = [
  { id: 'breakfast', name: 'Breakfast Club', ids: RECIPES.filter((r) => r.meal === 'breakfast').map((r) => r.id), bonus: 'toaster', bonusName: 'Toaster' },
  { id: 'midnight', name: 'Midnight Snacks', ids: RECIPES.filter((r) => r.meal === 'snack').map((r) => r.id), bonus: 'cookies', bonusName: 'Cookie jar' },
  { id: 'taco', name: 'Taco Tuesday', ids: ['quesadillas', 'tofu-tacos', 'sweet-potato-tacos'], bonus: 'cactus', bonusName: 'Tiny cactus' },
  ...CUISINES.map((cu) => ({ id: `c-${slug(cu)}`, name: cu, cuisine: true, ids: RECIPES.filter((r) => r.cuisine === cu).map((r) => r.id), bonus: `post-${slug(cu)}`, bonusName: `${cu} postcard` })),
];

/* ---------- Fridge stickers ---------- */

// Earned from moments, never bought. The same moment again gives a duplicate, to gift or turn into crumbs.
// Seasonal sets come back every year, and crumbs can pick any sticker, so nobody misses out for good.
const STICKER_BASE = '<circle cx="50" cy="50" r="46" fill="#fff"/>';
const STICKERS = [
  { id: 'early', name: 'Early bird', how: 'Cook a breakfast', art: `<path d="M16,64 H84" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M28,64 A22 22 0 0 1 72,64 Z" fill="#FFC83D" stroke="${INK}" stroke-width="4"/><path d="M50,30 V22 M30,40 L24,34 M70,40 L76,34 M20,56 H12 M80,56 H88" stroke="#F09A12" stroke-width="5" stroke-linecap="round"/><circle cx="43" cy="54" r="3" fill="${INK}"/><circle cx="57" cy="54" r="3" fill="${INK}"/><path d="M44,74 H56 M38,80 H62" stroke="#B9A8FF" stroke-width="4" stroke-linecap="round"/>` },
  { id: 'rescue', name: 'Fridge hero', how: 'Cook with something you already had', art: `<rect x="31" y="14" width="38" height="70" rx="8" fill="#EEF0F8" stroke="${INK}" stroke-width="4"/><path d="M31,40 H69" stroke="${INK}" stroke-width="4"/><path d="M60,22 V32 M60,48 V62" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M50,74 C40,66 38,58 44,55 C48,53 50,57 50,58 C50,57 52,53 56,55 C62,58 60,66 50,74 Z" fill="#FF7D6B" stroke="${INK}" stroke-width="3"/>` },
  { id: 'owl', name: 'Night owl', how: 'Cook after 11 PM', art: `<circle cx="50" cy="50" r="38" fill="#1E1740"/><path d="M58,26 A24 24 0 1 0 74,62 A19 19 0 1 1 58,26 Z" fill="#FFE27A"/><path d="M28,30 l2,5 5,2 -5,2 -2,5 -2,-5 -5,-2 5,-2z M72,74 l1.5,4 4,1.5 -4,1.5 -1.5,4 -1.5,-4 -4,-1.5 4,-1.5z" fill="#fff"/><text x="66" y="40" font-family="DM Sans, sans-serif" font-weight="800" font-size="14" fill="#B9A8FF">z</text>` },
  { id: 'cozy', name: 'Cozy bowl', how: 'Make a soup on a cold day', art: `<path d="M18,48 Q20,82 50,82 Q80,82 82,48 Z" fill="#6B4DE6" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="50" cy="48" rx="32" ry="8" fill="#E8553E" stroke="${INK}" stroke-width="4"/><path d="M38,36 q-6,-7 0,-14 q6,-7 0,-14 M50,36 q-6,-7 0,-14 M62,36 q-6,-7 0,-14 q6,-7 0,-14" stroke="#B9A8FF" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { id: 'goal', name: 'Goal getter', how: 'Hit your weekly goal', art: `<circle cx="50" cy="50" r="32" fill="none" stroke="#E6E0FB" stroke-width="12"/><path d="M50,18 A32 32 0 1 1 18,50" fill="none" stroke="#2E9E6A" stroke-width="12" stroke-linecap="round"/><path d="M36,50 L46,60 L66,40" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` },
  { id: 'team', name: 'Team kitchen', how: 'Everyone in the house cooks in one week', art: `<path d="M18,48 L50,20 L82,48 V82 H18 Z" fill="#6B4DE6" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="34" cy="62" r="9" fill="#FFC83D" stroke="${INK}" stroke-width="3"/><ellipse cx="50" cy="60" rx="8" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="66" cy="62" r="9" fill="#FFDD6E" stroke="${INK}" stroke-width="3"/>` },
  { id: 'foil', name: 'Shiny!', how: 'Master your first card', art: `<defs><linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB3D9"/><stop offset=".5" stop-color="#B9A8FF"/><stop offset="1" stop-color="#9FE0BC"/></linearGradient></defs><path d="M50,14 L60,38 L86,40 L66,57 L72,83 L50,69 L28,83 L34,57 L14,40 L40,38 Z" fill="url(#holo)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M78,16 l2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 6,-2z" fill="#FFC83D"/>` },
];
const SEASONS = [
  { id: 'soup', name: 'Soup Season', months: [9, 10, 11, 0, 1], back: 'Back every October', stickers: [
    { id: 'leaf', name: 'Falling leaf', how: 'Cook anything in Soup Season', art: `<path d="M50,16 C72,26 84,46 76,70 C66,82 40,84 26,74 C16,52 26,28 50,16 Z" fill="#F08A3C" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M30,80 L66,30 M44,62 L36,46 M54,48 L66,48 M40,70 L56,68" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/>` },
    { id: 'mug', name: 'Warm mug', how: 'Cook three times in one week of Soup Season', art: `<rect x="24" y="36" width="42" height="44" rx="8" fill="#6B4DE6" stroke="${INK}" stroke-width="4"/><path d="M66,46 Q82,46 80,58 Q78,70 66,68" fill="none" stroke="${INK}" stroke-width="4"/><path d="M36,28 q-5,-6 0,-12 M48,28 q-5,-6 0,-12" stroke="#B9A8FF" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="45" cy="58" r="7" fill="#FFC83D"/>` },
    { id: 'mitten', name: 'Mittens', how: 'Cook on a cold day', art: `<path d="M34,70 L32,40 C32,24 56,20 60,36 L62,44 L70,38 C76,34 82,40 78,46 L66,64 L66,70 Z" fill="#5BB3F0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="30" y="68" width="40" height="14" rx="5" fill="#fff" stroke="${INK}" stroke-width="4"/><path d="M40,50 h14 M40,58 h14" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` },
  ] },
  { id: 'summer', name: 'Summer Snacks', months: [5, 6, 7], back: 'Back every June', stickers: [
    { id: 'pop', name: 'Ice pop', how: 'Make a snack in summer', art: `<rect x="34" y="14" width="32" height="54" rx="14" fill="#FF8FB1" stroke="${INK}" stroke-width="4"/><path d="M34,40 H66" stroke="#FFC83D" stroke-width="10"/><rect x="45" y="66" width="10" height="20" rx="4" fill="#E9C27A" stroke="${INK}" stroke-width="3"/>` },
    { id: 'melon', name: 'Watermelon', how: 'Cook three times in one summer week', art: `<path d="M14,40 A36 36 0 0 0 86,40 Z" fill="#2E9E6A" stroke="${INK}" stroke-width="4"/><path d="M20,40 A30 30 0 0 0 80,40 Z" fill="#FF6B7D"/><circle cx="38" cy="52" r="2.5" fill="${INK}"/><circle cx="50" cy="58" r="2.5" fill="${INK}"/><circle cx="62" cy="52" r="2.5" fill="${INK}"/>` },
    { id: 'sun', name: 'Sunny side', how: 'Cook breakfast in summer', art: `<circle cx="50" cy="50" r="20" fill="#FFC83D" stroke="${INK}" stroke-width="4"/><path d="M50,14 V22 M50,78 V86 M14,50 H22 M78,50 H86 M25,25 L31,31 M69,69 L75,75 M75,25 L69,31 M31,69 L25,75" stroke="#F09A12" stroke-width="5" stroke-linecap="round"/><rect x="36" y="44" width="12" height="8" rx="3" fill="${INK}"/><rect x="52" y="44" width="12" height="8" rx="3" fill="${INK}"/><path d="M48,47 H52" stroke="${INK}" stroke-width="2"/>` },
  ] },
];
const ALL_STICKERS = [...STICKERS, ...SEASONS.flatMap((s) => s.stickers.map((st) => ({ ...st, season: s.id })))];
const stickerById = (id) => ALL_STICKERS.find((s) => s.id === id);
const stickerSvg = (id, cls = 'sticker-art') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${STICKER_BASE}${stickerById(id).art}</svg>`;
const seasonOf = (t) => SEASONS.find((s) => s.months.includes(new Date(t).getMonth()));
const CRUMBS_PER_DUP = 1;
const CRUMBS_TO_PICK = 3;

/* ---------- Pantry-dex ---------- */

// Every ingredient you cook with fills an entry. The order is the numbering; the first test that matches
// an ingredient wins, so the specific ones come first. `kind` picks the drawing; rare finds sparkle.
const PANTRY = [
  { id: 'egg', name: 'Eggs', kind: 'egg', c: '#FFFFFF', t: /^eggs?$/, fact: 'An eggshell has thousands of tiny pores, so the chick inside could breathe.' },
  { id: 'bread', name: 'Bread', kind: 'loaf', c: '#E9B067', t: /bread/, fact: 'Bread rises because yeast makes little bubbles of gas in the dough.' },
  { id: 'pb', name: 'Peanut butter', kind: 'jar', c: '#C98A4B', t: /peanut butter/, fact: 'It takes around 540 peanuts to make a 12-ounce jar.' },
  { id: 'greens', name: 'Spinach & greens', kind: 'leaf', c: '#3E9B5C', t: /spinach|lettuce/, fact: 'A big pile of spinach shrinks to a handful in a hot pan.' },
  { id: 'butter', name: 'Butter', kind: 'block', c: '#FFE68A', t: /^butter$/, fact: 'It takes about 21 pounds of milk to make one pound of butter.' },
  { id: 'coconut', name: 'Coconut', kind: 'round', c: '#8A5A3C', t: /coconut/, fact: 'Coconut water is the clear liquid inside young, green coconuts.' },
  { id: 'milk', name: 'Milk', kind: 'carton', c: '#FFFFFF', t: /^milk$|soy milk/, fact: 'Milk is about 87% water.' },
  { id: 'cream', name: 'Cream', kind: 'carton', c: '#FFF6DA', t: /cream or milk|heavy cream/, fact: 'Cream rises to the top of fresh milk because fat is lighter than water.' },
  { id: 'yogurt', name: 'Yogurt & sour cream', kind: 'tub', c: '#FFFFFF', t: /yogurt|sour cream/, fact: 'Yogurt is milk thickened by friendly bacteria.' },
  { id: 'cheese', name: 'Cheese', kind: 'wedge', c: '#FFD45C', t: /cheddar|parmesan|feta|swiss/, fact: 'Parmigiano Reggiano is aged for at least a year, often much longer.' },
  { id: 'tomato', name: 'Tomatoes', kind: 'round', c: '#E8553E', t: /tomato/, fact: 'Botanically, tomatoes are berries.' },
  { id: 'oats', name: 'Oats', kind: 'pile', c: '#E9D3A8', t: /oats/, fact: 'Rolled oats are steamed, then pressed flat between rollers.' },
  { id: 'dragon', name: 'Dragon fruit', kind: 'dragon', c: '#F25CA2', t: /dragon fruit/, rare: true, fact: 'Dragon fruit flowers open at night and last just one night.' },
  { id: 'banana', name: 'Bananas', kind: 'long', c: '#FFD84D', t: /banana/, fact: 'Botanically, bananas are berries, and strawberries aren’t.' },
  { id: 'sweet', name: 'Maple syrup & honey', kind: 'bottle', c: '#C9822F', t: /maple|honey/, fact: 'It takes about 40 litres of maple sap to make one litre of syrup.' },
  { id: 'baking', name: 'Baking basics', kind: 'bag', c: '#F6F1E4', t: /flour|baking powder|^sugar$/, fact: 'Baking powder is baking soda with an acid already mixed in.' },
  { id: 'berries', name: 'Berries', kind: 'berry', c: '#D93A4A', t: /berries/, fact: 'A strawberry carries its seeds on the outside, around 200 of them.' },
  { id: 'tortilla', name: 'Tortillas', kind: 'flat', c: '#F2D49B', t: /tortilla/, fact: 'Corn for tortillas is soaked in limewater first, which makes the dough hold together.' },
  { id: 'greenbeans', name: 'Green beans', kind: 'pod', c: '#5FB35A', t: /green beans/, fact: 'Green beans are picked young, before the beans inside get big.' },
  { id: 'chickpeas', name: 'Chickpeas', kind: 'pile', c: '#E2B66E', t: /chickpea/, fact: 'Chickpeas are also called garbanzo beans.' },
  { id: 'beans', name: 'Beans', kind: 'pod', c: '#7CC36A', t: /black beans|kidney beans|edamame/, fact: 'Edamame are soybeans, picked young while they’re still green.' },
  { id: 'onion', name: 'Onions', kind: 'bulb', c: '#C98AC9', t: /onion/, fact: 'Cutting an onion releases a gas that makes your eyes sting.' },
  { id: 'salsa', name: 'Salsa', kind: 'jar', c: '#E8553E', t: /salsa/, fact: 'Salsa simply means sauce in Spanish.' },
  { id: 'rice', name: 'Rice', kind: 'pile', c: '#FFFFFF', t: /\brice\b/, fact: 'Rice is a staple food for more than half the people on Earth.' },
  { id: 'peas', name: 'Peas', kind: 'pod', c: '#7CC36A', t: /peas/, fact: 'Frozen peas are often frozen within hours of picking, so they stay sweet.' },
  { id: 'garlic', name: 'Garlic', kind: 'bulb', c: '#F6F1E4', t: /garlic/, fact: 'One head of garlic is made of many cloves, often ten or more.' },
  { id: 'soy', name: 'Soy sauce', kind: 'bottle', c: '#3B2A2A', t: /soy sauce/, fact: 'Traditional soy sauce is brewed from soybeans, wheat and salt, sometimes for months.' },
  { id: 'oil', name: 'Oils', kind: 'bottle', c: '#C9C24A', t: /oil$/, fact: 'Olive oil is pressed from olives, which are fruits.' },
  { id: 'broth', name: 'Broth', kind: 'carton', c: '#E9C27A', t: /broth|bouillon/, fact: 'Broth is water that’s simmered with vegetables or bones for a while.' },
  { id: 'chicken', name: 'Chicken', kind: 'drumstick', c: '#E8A85A', t: /chicken/, fact: 'Thighs are dark meat because those muscles work harder.' },
  { id: 'citrus', name: 'Lemons & limes', kind: 'round', c: '#FFE04D', t: /lemon|lime/, fact: 'Limes are usually picked green, before they ripen and turn yellow.' },
  { id: 'noodles', name: 'Noodles & pasta', kind: 'pile', c: '#FFD86B', t: /noodle|spaghetti/, fact: 'Dried pasta can keep in the cupboard for a year or more.' },
  { id: 'carrot', name: 'Carrots', kind: 'carrot', c: '#F08A3C', t: /carrot/, fact: 'Carrots used to be mostly purple or yellow. Orange ones caught on later.' },
  { id: 'cucumber', name: 'Cucumbers', kind: 'long', c: '#5FB35A', t: /cucumber/, fact: 'Cucumbers are about 95% water.' },
  { id: 'sausage', name: 'Sausage', kind: 'long', c: '#B5533A', t: /sausage/, fact: 'Sausage comes from the Latin salsus, meaning salted.' },
  { id: 'potato', name: 'Potatoes', kind: 'round', c: '#C99A5B', t: /potato/, fact: 'Potatoes were first grown in the Andes, in South America.' },
  { id: 'pepper', name: 'Bell peppers', kind: 'round', c: '#E8402C', t: /bell pepper/, fact: 'Green, yellow and red peppers can come from the same plant, at different ripeness.' },
  { id: 'mustard', name: 'Mustard', kind: 'bottle', c: '#FFC83D', t: /mustard/, fact: 'Mustard seeds come from a plant in the same family as cabbage.' },
  { id: 'turkey', name: 'Turkey', kind: 'drumstick', c: '#D99A6C', t: /turkey/, fact: 'Turkeys were first domesticated in what is now Mexico.' },
  { id: 'hummus', name: 'Hummus & tahini', kind: 'tub', c: '#E8CFA0', t: /hummus|tahini/, fact: 'Tahini is toasted sesame seeds, ground into a paste.' },
  { id: 'popcorn', name: 'Popcorn', kind: 'pile', c: '#FFF6DA', t: /popcorn/, fact: 'Popcorn has a hard shell that traps steam until it bursts.' },
  { id: 'fish', name: 'Salmon & tuna', kind: 'fish', c: '#FF8F6B', t: /salmon|tuna/, fact: 'Some salmon swim thousands of kilometres back to the river where they hatched.' },
  { id: 'avocado', name: 'Avocado', kind: 'avocado', c: '#5FA04A', t: /avocado/, fact: 'Avocados only start to ripen once they’re picked.' },
  { id: 'tofu', name: 'Tofu', kind: 'block', c: '#F7F3EA', t: /tofu/, fact: 'Tofu has been made in China for well over a thousand years.' },
  { id: 'olives', name: 'Olives', kind: 'round', c: '#4A2E4A', t: /olives/, fact: 'Fresh olives are very bitter. They’re cured before anyone eats them.' },
  { id: 'quinoa', name: 'Quinoa', kind: 'pile', c: '#EADBB0', t: /quinoa/, fact: 'Quinoa is related to spinach and beets, not to wheat.' },
  { id: 'mushroom', name: 'Mushrooms', kind: 'mushroom', c: '#C99A6C', t: /mushroom/, fact: 'Mushrooms are more closely related to animals than to plants.' },
  { id: 'nuts', name: 'Nuts & seeds', kind: 'pile', c: '#C98A4B', t: /almond|seeds/, fact: 'Almonds are the seeds of a fruit related to peaches.' },
  { id: 'mayo', name: 'Mayonnaise', kind: 'jar', c: '#FFF6DA', t: /mayonnaise/, fact: 'Mayonnaise is mostly oil, whisked with egg yolk until it turns thick.' },
  { id: 'celery', name: 'Celery', kind: 'long', c: '#9FD47A', t: /celery/, fact: 'Celery seed is a spice too, from the same plant.' },
  { id: 'pickles', name: 'Pickles', kind: 'long', c: '#7FA83A', t: /pickle/, fact: 'Dill pickles are named for the dill in their brine.' },
  { id: 'herbs', name: 'Fresh herbs', kind: 'leaf', c: '#2E8A52', t: /^fresh /, rare: true, fact: 'Cilantro and coriander are the same plant: one name for the leaves, one for the seeds.' },
  { id: 'saffron', name: 'Saffron', kind: 'threads', c: '#D9302C', t: /saffron/, rare: true, fact: 'Each saffron crocus flower has just three threads.' },
  { id: 'miso', name: 'Miso', kind: 'tub', c: '#D9A05B', t: /miso/, rare: true, fact: 'Miso is fermented soybean paste, and some kinds are aged for years.' },
];
const pantryOf = (name) => PANTRY.find((p) => p.t.test(lower(name)));
// A small drawing in a 64 × 64 box, with a tiny face so every entry is a little character.
function pantryArt(p) {
  const S = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  const c = p.c;
  const shape = {
    egg: `<ellipse cx="32" cy="36" rx="17" ry="21" fill="${c}" ${S}/>`,
    loaf: `<path d="M14,52 L14,28 C6,24 8,12 20,12 L44,12 C56,12 58,24 50,28 L50,52 Z" fill="${c}" ${S}/><path d="M19,48 L19,30 C14,27 15,17 22,17 L42,17 C49,17 50,27 45,30 L45,48 Z" fill="#F6D9A0"/>`,
    jar: `<rect x="16" y="20" width="32" height="34" rx="7" fill="${c}" ${S}/><rect x="14" y="12" width="36" height="10" rx="4" fill="#6B4DE6" ${S}/><rect x="20" y="30" width="24" height="14" rx="3" fill="#fff" opacity=".85"/>`,
    leaf: `<path d="M32,56 C12,48 10,22 30,10 C52,20 54,46 32,56 Z" fill="${c}" ${S}/><path d="M32,54 L31,20" stroke="#fff" stroke-width="2" opacity=".6"/>`,
    block: `<path d="M12,30 L32,22 L52,30 L52,48 L32,56 L12,48 Z" fill="${c}" ${S}/><path d="M12,30 L32,38 L52,30 M32,38 L32,56" stroke="${INK}" stroke-width="2" fill="none" opacity=".5"/>`,
    round: `<circle cx="32" cy="36" r="18" fill="${c}" ${S}/><path d="M32,18 C34,12 40,10 44,12 C42,16 38,18 32,18 Z" fill="#3E9B5C" ${S}/>`,
    carton: `<path d="M18,22 L32,12 L46,22 L46,56 L18,56 Z" fill="${c}" ${S}/><path d="M18,22 L46,22" stroke="${INK}" stroke-width="2.5"/><rect x="22" y="40" width="20" height="10" rx="2" fill="#B9A8FF"/>`,
    tub: `<path d="M12,26 L16,54 L48,54 L52,26 Z" fill="${c}" ${S}/><rect x="10" y="20" width="44" height="8" rx="4" fill="#6B4DE6" ${S}/>`,
    wedge: `<path d="M10,48 L54,48 L54,30 L10,40 Z" fill="${c}" ${S}/><path d="M10,40 L54,30 L44,22 Z" fill="#FFE68A" ${S}/><circle cx="40" cy="40" r="3" fill="#F2B93A"/><circle cx="22" cy="44" r="2.5" fill="#F2B93A"/>`,
    pile: `<path d="M8,52 Q32,14 56,52 Z" fill="${c}" ${S}/>${[[22, 44], [32, 36], [42, 44], [28, 48], [38, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="${INK}" opacity=".25"/>`).join('')}`,
    long: `<rect x="10" y="26" width="44" height="20" rx="10" fill="${c}" ${S} transform="rotate(-18 32 36)"/>`,
    bottle: `<path d="M26,10 L38,10 L38,20 C46,24 48,30 48,36 L48,54 L16,54 L16,36 C16,30 18,24 26,20 Z" fill="${c}" ${S}/><rect x="20" y="34" width="24" height="12" rx="3" fill="#fff" opacity=".85"/>`,
    bag: `<path d="M16,18 L48,18 L52,56 L12,56 Z" fill="${c}" ${S}/><path d="M16,18 Q32,26 48,18" stroke="${INK}" stroke-width="2" fill="none"/>`,
    berry: `<path d="M32,22 C44,16 56,24 52,36 C48,48 38,56 32,58 C26,56 16,48 12,36 C8,24 20,16 32,22 Z" fill="${c}" ${S}/><path d="M24,20 L32,14 L40,20 L32,24 Z" fill="#3E9B5C" ${S}/>`,
    flat: `<ellipse cx="32" cy="40" rx="24" ry="14" fill="${c}" ${S}/><circle cx="22" cy="40" r="2" fill="#C9822F"/><circle cx="42" cy="44" r="2" fill="#C9822F"/>`,
    pod: `<path d="M8,40 C16,22 48,22 56,34 C48,48 18,52 8,40 Z" fill="${c}" ${S}/>`,
    bulb: `<path d="M32,12 C34,20 50,26 50,40 C50,52 40,56 32,56 C24,56 14,52 14,40 C14,26 30,20 32,12 Z" fill="${c}" ${S}/>`,
    drumstick: `<path d="M14,30 C14,16 34,10 42,22 C48,30 42,40 36,42 L44,52 C48,52 50,56 46,58 C44,60 40,58 40,56 L32,46 C22,46 14,40 14,30 Z" fill="${c}" ${S}/>`,
    carrot: `<path d="M20,22 L44,22 L32,58 Z" fill="${c}" ${S}/><path d="M28,22 L24,10 M32,22 L32,8 M36,22 L40,10" stroke="#3E9B5C" stroke-width="4" stroke-linecap="round"/>`,
    fish: `<path d="M10,36 C18,22 40,22 48,36 C40,50 18,50 10,36 Z M48,36 L58,26 L58,46 Z" fill="${c}" ${S}/>`,
    avocado: `<path d="M32,10 C42,10 46,24 48,32 C52,46 44,58 32,58 C20,58 12,46 16,32 C18,24 22,10 32,10 Z" fill="#4E8E3A" ${S}/><path d="M32,16 C39,16 42,27 43,33 C46,44 40,53 32,53 C24,53 18,44 21,33 C22,27 25,16 32,16 Z" fill="#DDEB98"/><circle cx="32" cy="44" r="7" fill="#A8673E"/>`,
    mushroom: `<path d="M10,34 C10,16 54,16 54,34 Z" fill="${c}" ${S}/><rect x="24" y="34" width="16" height="20" rx="6" fill="#F6F1E4" ${S}/>`,
    dragon: `<ellipse cx="32" cy="36" rx="18" ry="20" fill="${c}" ${S}/><path d="M18,24 L10,18 M46,24 L54,18 M16,40 L8,40 M48,40 L56,40 M32,16 L32,8" stroke="#3E9B5C" stroke-width="4" stroke-linecap="round"/>`,
    threads: `<ellipse cx="32" cy="48" rx="22" ry="8" fill="#fff" ${S}/><path d="M22,46 C24,30 30,24 34,18 M30,46 C30,32 36,26 42,22 M38,46 C40,36 44,30 48,28" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  }[p.kind];
  const dark = ['#3B2A2A', '#4A2E4A', '#8A5A3C', '#B5533A'].includes(c);
  const eye = dark ? '#fff' : INK;
  const face = ['threads', 'pile', 'leaf', 'carrot'].includes(p.kind) ? '' : `<circle cx="27" cy="38" r="2.4" fill="${eye}"/><circle cx="37" cy="38" r="2.4" fill="${eye}"/><path d="M29,43 Q32,46 35,43" stroke="${eye}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return `<svg class="pantry-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${shape}${face}</svg>`;
}

/* ---------- QR codes, drawn on the page with no outside service ---------- */

// Byte mode, error correction level M, versions 1 to 6 (up to 106 bytes): plenty for an invite link.
// Returns the module grid (true = dark), or null if the text is too long.
const qrMatrix = (() => {
  const ECC = [0, 10, 16, 26, 18, 24, 16];
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4];
  const ALIGN = [0, 0, 18, 22, 26, 30, 34];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
  function divisor(deg) {
    const r = new Array(deg).fill(0);
    r[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function remainder(data, div) {
    const r = new Array(div.length).fill(0);
    data.forEach((b) => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); });
    return r;
  }
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; } return r; };
  const dataCap = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  return function encode(text) {
    const bytes = [...new TextEncoder().encode(text)];
    let v = 1;
    while (v <= 6 && 12 + bytes.length * 8 > dataCap(v) * 8) v++;
    if (v > 6) return null;
    // The data: mode, length, bytes, terminator, then padding to fill the version.
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4);
    put(bytes.length, 8);
    bytes.forEach((b) => put(b, 8));
    const capBits = dataCap(v) * 8;
    put(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // Split into blocks, add error correction to each, and interleave.
    const nb = BLOCKS[v];
    const ecLen = ECC[v];
    const raw = Math.floor(rawModules(v) / 8);
    const shortLen = Math.floor(raw / nb);
    const numShort = nb - (raw % nb);
    const div = divisor(ecLen);
    const blocks = [];
    let k = 0;
    for (let i = 0; i < nb; i++) {
      const len = shortLen - ecLen + (i < numShort ? 0 : 1);
      const d = data.slice(k, k + len);
      k += len;
      blocks.push({ d, e: remainder(d, div) });
    }
    const out = [];
    for (let i = 0; i < Math.max(...blocks.map((b) => b.d.length)); i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
    for (let i = 0; i < ecLen; i++) blocks.forEach((b) => out.push(b.e[i]));
    // The grid: timing lines, finders, the alignment square, format bits, then the data in a zigzag.
    const size = 17 + 4 * v;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < size && y < size) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    if (v >= 2) { const a = ALIGN[v]; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, a + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const drawFormat = (mask) => {
      const f = mask; // level M is 00
      let rem = f;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((f << 10) | rem) ^ 0x5412;
      const g = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, g(i));
      set(8, 7, g(6));
      set(8, 8, g(7));
      set(7, 8, g(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    let bit = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && bit < out.length * 8) { m[y][x] = ((out[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1; bit++; }
      }
    }
    // Try every mask and keep the one with the fewest long runs and solid blocks.
    const apply = (mk) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mk](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => {
      let p = 0;
      let dark = 0;
      for (let a = 0; a < size; a++) {
        let rowRun = 1;
        let colRun = 1;
        for (let b = 1; b <= size; b++) {
          if (b < size && m[a][b] === m[a][b - 1]) rowRun++; else { if (rowRun >= 5) p += rowRun - 2; rowRun = 1; }
          if (b < size && m[b][a] === m[b - 1][a]) colRun++; else { if (colRun >= 5) p += colRun - 2; colRun = 1; }
        }
        for (let b = 0; b < size; b++) {
          if (m[a][b]) dark++;
          if (a < size - 1 && b < size - 1 && m[a][b] === m[a][b + 1] && m[a][b] === m[a + 1][b] && m[a][b] === m[a + 1][b + 1]) p += 3;
        }
      }
      return p + Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    };
    let best = 0;
    let bestP = Infinity;
    for (let mk = 0; mk < 8; mk++) {
      apply(mk);
      drawFormat(mk);
      const p = penalty();
      if (p < bestP) { bestP = p; best = mk; }
      apply(mk);
    }
    apply(best);
    drawFormat(best);
    return m;
  };
})();
function qrSvg(text, label) {
  const m = qrMatrix(text);
  if (!m) return '';
  const q = 4;
  const n = m.length + q * 2;
  let d = '';
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q},${y + q}h1v1h-1z`; }));
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#1E1A2E"/></svg>`;
}

// localStorage, wrapped so a blocked or full store never breaks the demo.
const store = {
  get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} },
  del(key) { try { localStorage.removeItem(key); } catch (e) {} },
};
const PREFS_KEY = 'yolkie-prefs';     // choices: diets, allergies, goals, outfit, reminders, the last pick
const ACTIVITY_KEY = 'yolkie-activity'; // real activity: meals finished in cook mode, badges, the challenge
const SAMPLE_KEY = 'yolkie-sample';   // the tester's sample week; while it exists, every stat reads and writes it instead
const DAY = 864e5;
const weekStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const clock12 = (mins) => { const h = Math.floor(mins / 60) % 24; return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

const demo = document.getElementById('demo');
if (demo) {
  const $ = (sel, el = demo) => el.querySelector(sel);
  const $$ = (sel, el = demo) => [...el.querySelectorAll(sel)];

  /* Saved choices and activity */
  // Your own diet, dislikes and allergies live at the top level; everyone else's are in `restr`, by member id.
  const freshPrefs = () => ({
    diets: [], dislikes: [], allergies: [], keepOut: [], members: DEFAULT_MEMBERS.map((m) => ({ ...m })), restr: {}, names: {},
    houseGoal: 10, goal: 3, takeout: 15, takeoutAsked: false, outfit: {}, tab: 'cook', hidden: [], link: null,
    reminders: { breakfast: { on: false, time: '07:30' }, lunch: { on: false, time: '11:30' }, dinner: { on: true, time: '17:30' } },
    notToday: '', quiet: { on: true, from: '21:30', to: '07:00' }, dietAsk: { key: '', count: 0, never: false }, last: {},
  });
  const saved = store.get(PREFS_KEY, {});
  const prefs = Object.assign(freshPrefs(), saved);
  prefs.reminders = Object.assign(freshPrefs().reminders, prefs.reminders);
  // Earlier versions had four fixed members (You, Yolkie, Boyd, Scramble) by number. You are Yolkie now,
  // so the house becomes you plus Boyd and Scramble, keeping their names and allergies.
  if (!saved.members && Array.isArray(saved.names)) {
    const old = saved.names;
    const count = Math.min(MAX_HOUSE, Math.max(1, (Number(saved.houseSize) || 4) - 1));
    prefs.members = DEFAULT_MEMBERS.slice(0, count).map((m, k) => ({ ...m, name: (old[[0, 2, 3][k]] || '').trim() || m.name }));
    prefs.restr = {};
    [['boyd', 2], ['scramble', 3]].forEach(([id, k]) => { prefs.restr[id] = { ...noRestr(), allergies: (saved.houseAllergies || [])[k] || [] }; });
    prefs.names = {};
    delete prefs.houseSize;
    delete prefs.houseAllergies;
  }
  if (Array.isArray(prefs.names)) prefs.names = {};
  const savePrefs = () => store.set(PREFS_KEY, prefs);
  const sampleOn = () => !!store.get(SAMPLE_KEY, null);
  // Meals used to say who cooked by number; now it's by member id.
  const OLD_IDS = ['you', 'you', 'boyd', 'scramble'];
  const toId = (x) => (typeof x === 'number' ? OLD_IDS[x] || 'you' : x || 'you');
  function activity() {
    const a = Object.assign({ meals: [], badges: [], challenge: null, stickers: {}, stickerFrom: {}, crumbs: 0, fridge: [], gifts: [], remembered: [] }, store.get(sampleOn() ? SAMPLE_KEY : ACTIVITY_KEY, {}));
    a.meals.forEach((m) => {
      m.cook = toId(m.cook);
      m.kudos = [...new Set((m.kudos || []).map(toId))].filter((x) => x !== m.cook);
      if (!m.eaters) m.eaters = [m.cook, ...m.kudos];
      if (!m.ratings) m.ratings = {};
    });
    return a;
  }
  const saveActivity = (a) => store.set(sampleOn() ? SAMPLE_KEY : ACTIVITY_KEY, a);

  const state = {
    meal: '', energy: 0, time: 0, have: [], haveDone: false, fromCheckin: false, temp: null, shown: false, cold: false,
    fits: [], pool: [], fallback: false, idx: 0, another: 0, recipe: null, servings: Number(prefs.last.servings) || 2,
    marks: {}, out: {}, buy: {}, bought: {}, cook: null, vote: null, done: null, askDiet: null,
    eaters: ['you'], memAsked: false, memEdit: false, editing: null,
  };
  // Your own filters for this meal ("just this meal" changes only these).
  const eff = () => ({ diets: state.temp ? state.temp.diets : prefs.diets, dislikes: state.temp ? state.temp.dislikes : prefs.dislikes, allergies: prefs.allergies });
  const savePick = () => {
    prefs.last = { meal: state.meal, energy: state.energy, time: state.time, have: state.have, haveDone: state.haveDone, servings: state.servings };
    savePrefs();
  };

  // Everything shown on Me, House and Wrapped is worked out from the meals list.
  // "Mine" are the meals tagged as cooked by you, which is the default.
  function statsFor(a) {
    const meals = a.meals.filter((m) => byId(m.r)).sort((x, y) => x.at - y.at);
    const mine = meals.filter((m) => m.cook === 'you');
    const ws = weekStart();
    const cuisines = [];
    const recipes = [];
    mine.forEach((m) => {
      const r = byId(m.r);
      if (!cuisines.includes(r.cuisine)) cuisines.push(r.cuisine);
      if (!recipes.includes(r.id)) recipes.push(r.id);
    });
    return {
      meals, mine, cooked: mine.length, cuisines, recipes,
      week: mine.filter((m) => m.at >= ws).length,
      houseWeek: meals.filter((m) => m.at >= ws).length,
      kept: mine.length * prefs.takeout,
      houseKept: meals.length * prefs.takeout,
      rescues: mine.filter((m) => m.have && m.have.length).length,
      dodged: mine.reduce((n, m) => n + (m.rinsed || 0), 0),
      tidies: mine.reduce((n, m) => n + (m.tidies || 0), 0),
    };
  }
  function challengeProgress(a, s) {
    if (!a.challenge) return 0;
    const since = s.mine.filter((m) => m.at >= a.challenge.start);
    if (a.challenge.id === 'rescue') return since.filter((m) => m.have && m.have.length).length;
    if (a.challenge.id === 'speed') return since.filter((m) => byId(m.r).time < 20).length;
    const before = new Set(s.mine.filter((m) => m.at < a.challenge.start).map((m) => byId(m.r).cuisine));
    return new Set(since.map((m) => byId(m.r).cuisine).filter((c) => !before.has(c))).size;
  }
  // A finished challenge turns into a badge and frees the slot for the next one.
  function settleChallenge(a) {
    const ch = a.challenge && CHALLENGES.find((c) => c.id === a.challenge.id);
    if (!ch || challengeProgress(a, statsFor(a)) < ch.goal) return null;
    a.badges.push({ id: ch.id, at: Date.now() });
    a.challenge = null;
    return ch;
  }

  /* Yolkie, dressed */
  const face = $('.yolk-face');
  const wear = $('.js-yolk-wear');
  const says = $('.yolk-says');
  const mascotDir = face.getAttribute('src').replace(/[^/]+$/, '');
  ['default', 'happy', 'meh', 'sleepy', 'surprised'].forEach((m) => { new Image().src = `${mascotDir}yolk-${m}.svg`; });
  // Only accessories that are unlocked in the current data (real or sample) are worn.
  function worn() {
    const n = statsFor(activity()).cooked;
    const out = {};
    Object.entries(prefs.outfit).forEach(([slot, id]) => { const it = CLOSET.find((c) => c.id === id); if (it && n >= it.at) out[slot] = id; });
    return out;
  }
  const accSvg = (outfit) => `<svg class="yolk-acc" viewBox="-110 -200 220 220" aria-hidden="true" focusable="false">${accLayers(outfit)}</svg>`;
  const yolkieArt = (mood = 'default', cls = '', outfit = worn()) => `<span class="yolk-wear ${cls}"><img src="${mascotDir}yolk-${mood}.svg" alt="" width="220" height="220">${accSvg(outfit)}</span>`;
  const dress = () => { $('.yolk-acc', wear).innerHTML = accLayers(worn()); };

  let yolkLater;
  function yolk(mood, line, opts = {}) {
    clearTimeout(yolkLater);
    if (!face.getAttribute('src').endsWith(`yolk-${mood}.svg`)) face.src = `${mascotDir}yolk-${mood}.svg`;
    if (line) says.textContent = line;
    replay(wear, opts.celebrate ? 'is-celebrating' : 'is-wobbling');
    if (opts.then) yolkLater = setTimeout(() => yolk(...opts.then), opts.after || 1600);
  }

  /* Members of the house (single device). You're always first, and always Yolkie. Someone who has
     asked to join but isn't approved yet is "pending": they hold a spot but don't eat, cook or vote. */
  const active = () => prefs.members.filter((m) => m.status === 'active');
  const member = (id) => prefs.members.find((m) => m.id === id);
  const others = () => active().filter((m) => m.id !== 'you');
  // Names stay readable after someone leaves, so old meals still say who cooked.
  const rawName = (id) => { const m = member(id) || DEFAULT_MEMBERS.find((x) => x.id === id); return ((member(id) && member(id).name) || prefs.names[id] || (m && m.name) || '').trim() || (id === 'you' ? 'You' : 'Someone'); };
  const memberName = (id) => esc(rawName(id));
  // Restrictions. Yours are always your real ones; everyone else's follow the sample week while it's loaded.
  const restrStore = () => (sampleOn() ? store.get(SAMPLE_KEY, {}).restr || {} : prefs.restr);
  function restrOf(id) {
    if (id === 'you') return { diets: prefs.diets, allergies: prefs.allergies, dislikes: prefs.dislikes, keepOut: prefs.keepOut };
    return { ...noRestr(), ...(restrStore()[id] || {}) };
  }
  function setRestr(id, fn) {
    const r = restrOf(id);
    fn(r);
    r.keepOut = r.keepOut.filter((a) => r.allergies.includes(a));
    if (id === 'you') { Object.assign(prefs, r); savePrefs(); return; }
    if (sampleOn()) { const s = store.get(SAMPLE_KEY, {}); s.restr = { ...(s.restr || {}), [id]: r }; store.set(SAMPLE_KEY, s); return; }
    prefs.restr[id] = r;
    savePrefs();
  }
  const charOf = (id) => { const m = member(id); return m ? m.char : id === 'you' ? 'yolk' : null; };
  const freeChar = () => CHARS.find((c) => !prefs.members.some((m) => m.char === c));
  function avatar(id, mood = 'idle', extra = '') {
    const c = charOf(id);
    if (c === 'yolk') return `<span class="avatar ${extra}">${yolkieArt({ idle: 'default', win: 'happy', lose: 'meh' }[mood])}</span>`;
    if (CHAR_FACES[c]) return `<span class="avatar ${extra}"><img src="${mascotDir}${CHAR_FACES[c][mood]}.svg" alt="" width="220" height="220"></span>`;
    return `<span class="avatar avatar--guest ${extra}"><span class="icon" aria-hidden="true">person</span></span>`;
  }

  // Small building blocks
  const tag = (group, id, label, on, disabled = false) => `<button type="button" class="tag${on ? ' is-on' : ''}" data-group="${group}" data-id="${esc(id)}" aria-pressed="${on}"${disabled ? ' disabled' : ''}>${on ? '<span class="icon" aria-hidden="true">check</span>' : ''}${esc(label)}</button>`;
  function ring(n, goal, label, cls = '') {
    const C = 2 * Math.PI * 52;
    const pct = Math.min(1, n / goal);
    return `<div class="ring ${cls}${n >= goal ? ' is-full' : ''}" role="img" aria-label="${label}: ${n} of ${goal}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring__track" cx="60" cy="60" r="52"/><circle class="ring__fill" cx="60" cy="60" r="52" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 60 60)"/></svg>
      <span class="ring__num" aria-hidden="true"><span>${n}<small>/${goal}</small></span></span></div>`;
  }
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  /* Tabs: Cook, Me, House, Collection */
  const tabs = $$('[role="tab"]');
  function showTab(name, focus = false) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    if (prefs.tab !== name) { prefs.tab = name; savePrefs(); }
    if (name === 'me') showMeView(prefs.meView === 'kitchen' ? 'kitchen' : 'progress');
    if (name === 'house') renderHouse();
    if (name === 'collection') renderCollection();
  }
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => {
      showTab(t.dataset.tab);
      if (t.dataset.tab === 'me') yolk('happy', 'Your progress. It only goes up from here.');
      if (t.dataset.tab === 'house') yolk('default', 'The whole house, on one phone. Pass it around.');
      if (t.dataset.tab === 'collection') yolk('happy', 'Everything you’ve earned. All by cooking, never by luck.');
      if (t.dataset.tab === 'cook') yolk('default', 'Back to the kitchen.');
    });
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      showTab(tabs[(k + d + tabs.length) % tabs.length].dataset.tab, true);
    });
  });

  // Stages: one visible at a time; the track shows how far along you are.
  const ORDER = ['pick', 'check', 'cook', 'done'];
  function go(name) {
    if (prefs.tab !== 'cook') showTab('cook');
    $$('[data-stage]').forEach((s) => { s.hidden = s.dataset.stage !== name; });
    const pos = ORDER.indexOf(name === 'vote' ? 'pick' : name);
    $$('[data-track]').forEach((li, i) => {
      li.classList.toggle('is-done', i < pos);
      if (i === pos) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    demo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    const title = $(`[data-stage="${name}"] .stage__title`);
    if (title) title.focus({ preventScroll: true });
  }
  $$('.js-go').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  /* Sheets (native <dialog>: focus stays inside, Escape closes) */
  const openSheet = (d) => { if (!d.open) d.showModal(); };
  const closeSheet = (d) => { if (d.open) d.close(); };
  $$('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('.js-close')) closeSheet(d);
  }));

  /* 1. Pick */
  const MEALS = {
    breakfast: { label: 'breakfast', plural: 'breakfasts', at: 'breakfast', say: ['sleepy', 'Breakfast. I’m up. Mostly.'] },
    lunch: { label: 'lunch', plural: 'lunches', at: 'lunch', say: ['default', 'Lunch. Let’s make the break count.'] },
    dinner: { label: 'dinner', plural: 'dinners', at: 'dinner', say: ['happy', 'Dinner. The main event.'] },
    snack: { label: 'snack', plural: 'snacks', at: 'snack time', say: ['happy', 'Snack time. A very serious meal.'] },
  };
  const mealOf = (r) => MEALS[(r || state.recipe).meal];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ENERGY = { 1: ['sleepy', 'Same. Let’s keep it lazy.'], 2: ['default', 'Okay is plenty.'], 3: ['happy', 'Ooh, energy. Look at you.'] };
  const PICKED = ['%s. Decided.', '%s. That’s %m sorted.', '%M: %s. You just have to show up.'];
  const pickedLine = (r) => (r.egg
    ? ['surprised', r.egg]
    : ['happy', PICKED[Math.floor(Math.random() * PICKED.length)].replace('%s', r.name).replace('%m', mealOf(r).label).replace('%M', cap(mealOf(r).label))]);
  const slot = $('.js-meal-slot');

  // The diet summary chip, the "just this meal" undo link and the one-time default question.
  function summarize(f) {
    const parts = f.diets.map((d) => labelOf(DIETS, d));
    if (f.dislikes.length) parts.push(`No ${f.dislikes[0]}${f.dislikes.length > 1 ? ` +${f.dislikes.length - 1}` : ''}`);
    if (f.allergies.length) parts.push(plural(f.allergies.length, 'allergy', 'allergies'));
    return parts.join(' · ') || 'No preferences';
  }
  const dietWords = (ids) => ids.map((d) => labelOf(DIETS, d)).join(' + ');
  function renderDietBar() {
    $('.js-diet-summary').textContent = summarize(eff());
    $('.js-diet-temp').innerHTML = state.temp
      ? `<span class="icon" aria-hidden="true">schedule</span><span>Just this meal.</span> <button type="button" class="link-btn js-diet-back">Back to ${prefs.diets.length ? esc(dietWords(prefs.diets)) : 'your usual'}</button>`
      : '';
    $('.js-diet-ask').innerHTML = state.askDiet
      ? `<div class="ask-card" role="group" aria-label="Make this diet your default?"><p>Want to make ${esc(dietWords(state.askDiet))} your default?</p>
          <button type="button" class="btn btn--primary btn--small js-ask-yes">Yes</button><button type="button" class="btn btn--ghost btn--small js-ask-no">No thanks</button></div>`
      : '';
  }
  // Re-pick after any filter change, if a suggestion is on screen.
  function refilter(line) {
    renderDietBar();
    renderExtras();
    if (state.shown) { rank(); const l = suggest(false); yolk(...(line || l)); }
    else if (line) yolk(...line);
  }
  $('.js-diet-bar').addEventListener('click', (e) => {
    if (e.target.closest('.js-diet-chip')) openQuick();
    if (e.target.closest('.js-diet-back')) { state.temp = null; refilter(['default', 'Back to your usual.']); $('.js-diet-chip').focus(); }
    if (e.target.closest('.js-ask-yes')) {
      prefs.diets = [...state.askDiet];
      state.temp = null;
      state.askDiet = null;
      prefs.dietAsk = { key: '', count: 0, never: prefs.dietAsk.never };
      savePrefs();
      refilter(['happy', `Done. ${dietWords(prefs.diets)} is your default now.`]);
      $('.js-diet-chip').focus();
    }
    if (e.target.closest('.js-ask-no')) {
      state.askDiet = null;
      prefs.dietAsk.never = true;
      savePrefs();
      renderDietBar();
      yolk('default', 'Got it. I won’t ask again.');
      $('.js-diet-chip').focus();
    }
  });

  // The quick sheet changes the diet only. Allergies stay put; they live in Preferences.
  const quickSheet = $('.js-quick-sheet');
  let quickDraft = [];
  function renderQuick() {
    const al = prefs.allergies.map((a) => labelOf(ALLERGENS, a));
    $('.js-quick-body').innerHTML = `
      <div class="tags">${DIETS.map((d) => tag('quick', d.id, d.label, quickDraft.includes(d.id))).join('')}</div>
      <p class="fine quick-note"><span class="icon" aria-hidden="true">lock</span>${al.length ? `Your allergies stay on: ${esc(listText(al))}.` : 'Allergies aren’t changed here.'} Change them in <button type="button" class="link-btn js-quick-prefs">Preferences</button>.</p>
      <p class="quick-q">Use this for…</p>
      <div class="sheet-actions">
        <button type="button" class="btn btn--primary js-quick-once">Just this meal</button>
        <button type="button" class="btn btn--secondary js-quick-default">Make it my default</button>
      </div>`;
  }
  function openQuick() { quickDraft = [...eff().diets]; renderQuick(); openSheet(quickSheet); }
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  quickSheet.addEventListener('click', (e) => {
    const t = e.target.closest('[data-group="quick"]');
    if (t) {
      const id = t.dataset.id;
      quickDraft = quickDraft.includes(id) ? quickDraft.filter((x) => x !== id) : [...quickDraft, id];
      renderQuick();
      $(`[data-group="quick"][data-id="${id}"]`, quickSheet).focus();
    }
    if (e.target.closest('.js-quick-prefs')) { closeSheet(quickSheet); openPrefs(); }
    if (e.target.closest('.js-quick-once')) {
      const dislikes = state.temp ? state.temp.dislikes : prefs.dislikes;
      state.temp = sameSet(quickDraft, prefs.diets) && dislikes === prefs.dislikes ? null : { diets: [...quickDraft], dislikes };
      closeSheet(quickSheet);
      // Same "just this meal" diet three times running: offer it as the default, once.
      const key = [...quickDraft].sort().join('+');
      if (state.temp && key) {
        prefs.dietAsk.count = prefs.dietAsk.key === key ? prefs.dietAsk.count + 1 : 1;
        prefs.dietAsk.key = key;
        if (prefs.dietAsk.count >= 3 && !prefs.dietAsk.never) { state.askDiet = [...quickDraft]; prefs.dietAsk.count = 0; }
        savePrefs();
      }
      refilter(state.askDiet
        ? ['happy', `${dietWords(state.askDiet)} three times running! Want it as your default?`]
        : ['default', state.temp ? `Just this meal: ${summarize(eff())}.` : 'Same as usual, then.']);
      $('.js-diet-chip').focus();
    }
    if (e.target.closest('.js-quick-default')) {
      prefs.diets = [...quickDraft];
      state.temp = null;
      state.askDiet = null;
      prefs.dietAsk.count = 0;
      savePrefs();
      closeSheet(quickSheet);
      refilter(['happy', `Saved. ${prefs.diets.length ? dietWords(prefs.diets) : 'No diet'} from now on.`]);
      $('.js-diet-chip').focus();
    }
  });

  /* Who's eating: the people this meal is for. It starts as just you, every meal. */
  const eaters = () => state.eaters.filter((id) => id === 'you' || active().some((m) => m.id === id));
  const ALLERGY_WORD = { peanut: 'peanut', treenut: 'tree nut', dairy: 'milk', egg: 'egg', gluten: 'gluten', soy: 'soy', sesame: 'sesame', fish: 'fish', shellfish: 'shellfish' };
  const allergyWord = (a) => ALLERGY_WORD[a] || a;
  // Everything a meal has to satisfy: the diets and allergies of everyone eating, your never-show list,
  // and any allergy someone keeps out of the house. Other people's dislikes only push a recipe down.
  function groupFilter(ids = eaters(), own = eff()) {
    const diets = new Set();
    const allergies = new Set();
    const rules = [];
    ids.forEach((id) => {
      const r = id === 'you' ? { ...restrOf('you'), diets: own.diets } : restrOf(id);
      r.diets.forEach((d) => { diets.add(d); rules.push({ kind: 'diet', who: id, id: d }); });
      r.allergies.forEach((a) => { allergies.add(a); rules.push({ kind: 'allergy', who: id, id: a }); });
    });
    active().forEach((m) => restrOf(m.id).keepOut.forEach((a) => {
      if (!allergies.has(a)) rules.push({ kind: 'keep', who: m.id, id: a });
      allergies.add(a);
    }));
    own.dislikes.forEach((t) => rules.push({ kind: 'never', who: 'you', id: t }));
    const soft = ids.filter((id) => id !== 'you').flatMap((id) => restrOf(id).dislikes.map((t) => ({ who: id, t })));
    return { diets: [...diets], allergies: [...allergies], never: own.dislikes, soft, rules };
  }
  const passesGroup = (r, g) => !prefs.hidden.includes(r.id) && g.diets.every((d) => dietsOf(r).has(d)) && !allergic(r, g.allergies) && !g.never.some((t) => mentions(r, t));
  const blocks = (r, rule) => (rule.kind === 'diet' ? !dietsOf(r).has(rule.id) : rule.kind === 'never' ? mentions(r, rule.id) : allergic(r, [rule.id]));
  const softHits = (r, g) => g.soft.filter((s) => mentions(r, s.t));
  const fanLine = (s) => (stem(s.t) === 'spicy' ? `${rawName(s.who)} isn’t into spicy food` : `${rawName(s.who)} isn’t a ${lower(s.t).replace(/ies$/, 'y').replace(/oes$/, 'o').replace(/s$/, '')} fan`);
  function ruleText(rule) {
    const who = rule.who === 'you' ? 'your' : `${rawName(rule.who)}’s`;
    if (rule.kind === 'diet') return `${who} ${lower(labelOf(DIETS, rule.id))} diet`;
    if (rule.kind === 'allergy') return `${who} ${allergyWord(rule.id)} allergy`;
    if (rule.kind === 'keep') return `${who} rule to keep ${allergyWord(rule.id)} out of the house`;
    return `your “never show me” for ${rule.id}`;
  }

  // Ratings: each person's latest face for each recipe (1 😕, 2 🙂, 3 😍).
  function ratingsByRecipe(a = activity()) {
    const out = {};
    [...a.meals].sort((x, y) => x.at - y.at).forEach((m) => Object.entries(m.ratings || {}).forEach(([id, v]) => { (out[m.r] = out[m.r] || {})[id] = v; }));
    return out;
  }

  // Recipes for the chosen meal that work for everyone eating and fit the time and energy. Order: fewer
  // dislikes and fewer 😕 first; on a Wiped day, favorites (a Comfort pick); on a cold day, soups; then the
  // most of what you already have; then effort close to your energy, using most of the time you have.
  // If nothing fits the time and energy, the quickest one that works.
  function rank() {
    const g = groupFilter();
    const rated = ratingsByRecipe();
    const ids = eaters();
    const faces = (r) => ids.map((id) => (rated[r.id] || {})[id]).filter(Boolean);
    const low = (r) => { const f = faces(r); return f.length > 0 && f.every((v) => v === 1); };
    state.group = g;
    state.comfort = (r) => state.energy === 1 && faces(r).includes(3);
    const key = (r) => [softHits(r, g).length, low(r) ? 1 : 0, state.comfort(r) ? 0 : 1, state.cold && tagged(r, 'soup') ? 0 : 1,
      -usesHave(r, state.have).length, (state.energy - r.effort) * 2 + (state.time - r.time) / 15];
    const cmp = (a, b) => { const ka = key(a), kb = key(b); const k = ka.findIndex((x, i) => x !== kb[i]); return k < 0 ? 0 : ka[k] - kb[k]; };
    state.pool = RECIPES.filter((r) => r.meal === state.meal && passesGroup(r, g));
    state.fits = state.pool.filter((r) => r.time <= state.time && r.effort <= state.energy).sort(cmp);
    state.fallback = !state.fits.length && state.pool.length > 0;
    if (state.fallback) state.fits = [...state.pool].sort((a, b) => a.time - b.time || a.effort - b.effort).slice(0, 1);
    state.idx = 0;
    state.another = 0;
  }

  function haveBadge(r) {
    const n = state.have.length;
    const used = usesHave(r, state.have);
    if (!n || !used.length) return '';
    const text = used.length === n ? (n === 1 ? `Uses your ${haveLabel(used[0])}` : `Uses all ${n}`) : `Uses ${used.length} of ${n}`;
    return `<span class="have-badge"><span class="icon" aria-hidden="true">kitchen</span>${text}</span>`;
  }
  const amountFor = (item, r, servings) => describe(item, scaleQty(item, servings, r.base));

  function renderMeal(note = '') {
    const r = state.recipe;
    const need = r.ingredients.filter((i) => !hasItem(i, state.have));
    const fans = [...new Set(softHits(r, state.group).map(fanLine))];
    state.shown = true;
    $('.js-pick-hint').hidden = true;
    slot.innerHTML = `
      <article class="meal-card${reduceMotion ? '' : ' is-new'}">
        <div class="meal-card__top"><p class="eyebrow">Yolkie's pick · ${cap(mealOf(r).label)} · ${r.cuisine}</p>
          ${state.comfort(r) ? '<span class="pick-badge"><span class="icon" aria-hidden="true">favorite</span>Comfort pick</span>' : ''}
          ${state.cold && tagged(r, 'soup') ? '<span class="pick-badge pick-badge--cold"><span class="icon" aria-hidden="true">ac_unit</span>Cold-day soup</span>' : ''}${haveBadge(r)}</div>
        <h3 class="meal-card__name">${r.name}</h3>
        <p class="meal-card__blurb">${r.blurb}</p>
        ${fans.length ? `<p class="fan-note"><span class="icon" aria-hidden="true">info</span><span>${esc(listText(fans))}, so this one sits lower in the picks.</span></p>` : ''}
        <div class="meal-stats">
          <span class="stat"><span class="icon" aria-hidden="true">schedule</span>${r.time} min</span>
          <span class="stat stat--dishes"><span class="icon" aria-hidden="true">skillet</span>Dishes: ${r.dishes.length}</span>
          <span class="stat nutri">~${r.kcal} kcal</span>
          <span class="stat nutri">~${r.protein} g protein</span>
          <button type="button" class="stat stat--btn nutri js-nutri-open"><span class="icon" aria-hidden="true">nutrition</span>Nutrition</button>
        </div>
        <p class="fine nutri">Per serving, estimated.</p>
        <p class="have-line">${state.have.length
          ? `You have ${esc(listText(state.have.map(haveLabel)))}. <button type="button" class="link-btn js-have-change">Change</button>`
          : '<button type="button" class="link-btn js-have-change">Add what you already have</button>'}</p>
        ${state.fromCheckin ? `<div class="ready-list"><p><span class="icon" aria-hidden="true">shopping_cart</span><strong>Shopping list ready</strong>· ${plural(need.length, 'item')}</p>
          <ul>${need.map((i) => { const a = amountFor(i, r, state.servings); return `<li>${a.qty} ${a.name}</li>`; }).join('')}</ul></div>` : ''}
        ${note ? `<p class="meal-note">${note}</p>` : ''}
        <div class="actions">
          <button type="button" class="btn btn--primary js-cook-this"><span class="btn__dot" aria-hidden="true"></span>Let's make this</button>
          <button type="button" class="btn btn--secondary js-another">Another one</button>
          ${active().length > 1 ? '<button type="button" class="btn btn--ghost js-vote-start"><span class="icon" aria-hidden="true">how_to_vote</span>Vote with the house</button>' : ''}
        </div>
      </article>`;
  }

  // Nothing works for everyone eating: name the tightest restriction, and offer the one change to your own
  // diet or never-show list that opens most up, just for this meal. Allergies are never offered.
  function loosenIdea() {
    const f = eff();
    const opts = [
      ...f.diets.map((d) => ({ label: labelOf(DIETS, d), own: { ...f, diets: f.diets.filter((x) => x !== d) } })),
      ...f.dislikes.map((t) => ({ label: `no ${t}`, own: { ...f, dislikes: f.dislikes.filter((x) => x !== t) } })),
    ];
    opts.forEach((o) => { const g = groupFilter(eaters(), o.own); o.n = RECIPES.filter((r) => r.meal === state.meal && passesGroup(r, g)).length; });
    return opts.filter((o) => o.n).sort((a, b) => b.n - a.n)[0];
  }
  function tightest() {
    const all = RECIPES.filter((r) => r.meal === state.meal);
    return groupFilter().rules.map((rule) => ({ rule, n: all.filter((r) => blocks(r, rule)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n)[0];
  }
  let loosen = null;
  function renderEmpty() {
    const meal = MEALS[state.meal].label;
    const total = RECIPES.filter((r) => r.meal === state.meal).length;
    const t = tightest();
    const group = eaters().length > 1;
    loosen = loosenIdea();
    state.shown = true;
    $('.js-pick-hint').hidden = true;
    slot.innerHTML = `
      <article class="meal-card meal-card--empty${reduceMotion ? '' : ' is-new'}">
        <p class="eyebrow">Hmm</p>
        <h3 class="meal-card__name">No ${meal} works for ${group ? 'everyone eating' : 'all of that'}.</h3>
        <p class="meal-card__blurb">${t ? `The tightest one is ${esc(ruleText(t.rule))}. On its own it rules out ${t.n} of the ${total} ${MEALS[state.meal].plural} here.` : `Right now it's ${esc(summarize(eff()))}.`}</p>
        ${loosen
          ? `<p class="meal-note">Without ${esc(loosen.label)}, there ${loosen.n === 1 ? 'is 1 option' : `are ${loosen.n} options`}. Allergies always stay on.</p>
             <div class="actions"><button type="button" class="btn btn--primary js-loosen">Try without ${esc(loosen.label)}, just this meal</button><button type="button" class="btn btn--ghost js-open-prefs">Open preferences</button></div>`
          : `<p class="meal-note">Allergies always stay on, so there’s nothing for Yolkie to loosen here. ${group ? 'Fewer people eating, or another meal, might work.' : 'Another meal might work.'}</p>
             <div class="actions"><button type="button" class="btn btn--ghost js-open-prefs">Open preferences</button></div>`}
      </article>`;
    return ['meh', loosen ? `No ${meal} fits all that. Want to loosen one thing?` : `Nothing for ${meal} here. Not your fault. Mine, really.`];
  }

  function suggest(isAnother) {
    if (!state.fits.length) return renderEmpty();
    let note = '';
    if (isAnother) {
      state.idx = (state.idx + 1) % state.fits.length;
      state.another += 1;
      if (state.idx === 0) {
        note = state.fits.length === 1
          ? `That’s the only ${MEALS[state.meal].label} that fits right now. More time or energy opens up more.`
          : `That’s all ${state.fits.length} ${MEALS[state.meal].plural} that fit. Back to the first one.`;
      }
    } else if (state.fallback) {
      note = `Nothing fits that time and energy, so here’s the quickest ${MEALS[state.meal].label} that works for everyone eating.`;
    }
    state.recipe = state.fits[state.idx];
    renderMeal(note);
    if (state.another >= 3) return ['meh', `Picky today. Valid. How about ${state.recipe.name}?`];
    if (state.comfort(state.recipe)) return ['sleepy', `Wiped? Here’s a comfort pick: ${state.recipe.name}.`];
    return pickedLine(state.recipe);
  }
  /* "What do you already have?": an optional step before the suggestion */
  function haveTags() {
    const full = state.have.length >= 3;
    const customs = state.have.filter((k) => !HAVE.some((h) => h.id === k));
    return [...HAVE.map((h) => tag('have', h.id, h.label, state.have.includes(h.id), full && !state.have.includes(h.id))),
      ...customs.map((k) => tag('have', k, k, true))].join('');
  }
  function renderHave(focus = true) {
    state.shown = false;
    $('.js-pick-hint').hidden = true;
    slot.innerHTML = `
      <section class="have-card${reduceMotion ? '' : ' is-new'}" aria-labelledby="have-title">
        <p class="eyebrow">Optional</p>
        <h3 id="have-title" tabindex="-1">What do you already have?</h3>
        <p class="fine js-have-count">Pick up to 3 and Yolkie leans toward meals that use them. ${state.have.length} of 3 picked.</p>
        <div class="tags js-have-tags" role="group" aria-label="Ingredients you have">${haveTags()}</div>
        <div class="have-search"><span class="icon" aria-hidden="true">search</span><label class="sr-only" for="have-search">Search ingredients</label>
          <input id="have-search" class="js-have-search" type="search" placeholder="Search, like tofu or salmon" autocomplete="off" maxlength="30"></div>
        <div class="tags js-have-results" aria-live="polite"></div>
        <div class="actions">
          <button type="button" class="btn btn--primary js-have-go"><span class="btn__dot" aria-hidden="true"></span>Suggest a meal</button>
          <button type="button" class="btn btn--ghost js-have-skip">Skip</button>
        </div>
      </section>`;
    if (focus) $('#have-title').focus({ preventScroll: true });
  }
  function toggleHave(key) {
    state.have = state.have.includes(key) ? state.have.filter((k) => k !== key) : state.have.length < 3 ? [...state.have, key] : state.have;
    $('.js-have-tags').innerHTML = haveTags();
    $('.js-have-count').textContent = `Pick up to 3 and Yolkie leans toward meals that use them. ${state.have.length} of 3 picked.`;
    const search = $('.js-have-search');
    if (search && search.value) showHaveResults(search.value);
    savePick();
  }
  function showHaveResults(term) {
    const t = lower(term).trim();
    const box = $('.js-have-results');
    if (!t) { box.innerHTML = ''; return; }
    const hits = ALL_ITEMS.filter((n) => n.includes(t) && !state.have.includes(n)).slice(0, 6);
    box.innerHTML = hits.length
      ? hits.map((n) => `<button type="button" class="tag tag--add" data-group="have-add" data-id="${esc(n)}"${state.have.length >= 3 ? ' disabled' : ''}><span class="icon" aria-hidden="true">add</span>${esc(n)}</button>`).join('')
      : '<span class="fine">None of the demo recipes use that.</span>';
  }
  function leaveHave(skip) {
    if (skip) state.have = [];
    state.haveDone = true;
    remember(state.have);
    savePick();
    rank();
    const line = suggest(false);
    yolk(...line);
    const btn = $('.js-cook-this') || $('.js-loosen') || $('.js-open-prefs', slot);
    if (btn) btn.focus({ preventScroll: true });
  }

  /* "You probably still have…": what you said you had and what you ticked off the shopping list, kept
     with a date. It's always a guess to confirm, never a fact, and it's forgotten after five days. */
  const MEM_DAYS = 5;
  function remember(keys) {
    if (!keys.length) return;
    const a = activity();
    keys.forEach((k) => {
      const key = lower(k).trim();
      a.remembered = a.remembered.filter((x) => x.k !== key);
      a.remembered.push({ k: key, at: Date.now(), used: false });
    });
    saveActivity(a);
  }
  function forget(key) {
    const a = activity();
    a.remembered = a.remembered.filter((x) => x.k !== key);
    saveActivity(a);
  }
  const freshMem = (a = activity()) => a.remembered.filter((x) => Date.now() - x.at < MEM_DAYS * DAY).sort((x, y) => y.at - x.at);
  const stillHave = (a) => freshMem(a).filter((x) => !x.used);
  // Cooking a recipe marks whatever it used as "probably used up".
  const useUp = (a, r) => a.remembered.forEach((x) => { if (!x.used && r.ingredients.some((i) => haveTest(x.k)(lower(i.n)))) { x.used = true; x.usedAt = Date.now(); } });
  const midnight = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function dayWord(t) {
    const days = Math.round((midnight(Date.now()) - midnight(t)) / DAY);
    if (days === 0) return 'Earlier today';
    if (days === 1) return 'Yesterday';
    return `On ${new Date(t).toLocaleDateString(undefined, { weekday: 'long' })}`;
  }
  function renderRemember() {
    const box = $('.js-remember');
    const items = stillHave().slice(0, 3);
    if (state.memAsked || !items.length || state.have.length) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <section class="remember-card${reduceMotion ? '' : ' is-new'}" aria-labelledby="mem-title">
        <span class="remember-card__icon" aria-hidden="true">${yolkieArt('surprised')}</span>
        <div class="remember-card__body">
          <h3 id="mem-title">${dayWord(items[0].at)} you had ${esc(listText(items.map((x) => haveLabel(x.k))))}. Still got ${items.length === 1 ? 'it' : 'them'}?</h3>
          <p class="fine">Just Yolkie’s guess, from what you said before. It forgets after ${MEM_DAYS} days.</p>
          ${state.memEdit ? `<p class="fine remember-card__tap">Tap anything that’s gone.</p><div class="tags">${items.map((x) => `<button type="button" class="tag is-on" data-forget="${esc(x.k)}"><span class="sr-only">Remove </span>${esc(haveLabel(x.k))}<span class="icon" aria-hidden="true">close</span></button>`).join('')}</div>` : ''}
          <div class="actions">
            <button type="button" class="btn btn--primary btn--small js-mem-yes">Yes, let’s cook</button>
            ${state.memEdit ? '' : '<button type="button" class="btn btn--secondary btn--small js-mem-some">Some are gone</button>'}
            <button type="button" class="btn btn--ghost btn--small js-mem-skip">Not now</button>
          </div>
        </div>
      </section>`;
  }
  $('.js-remember').addEventListener('click', (e) => {
    const t = e.target;
    const items = stillHave().slice(0, 3);
    if (t.closest('.js-mem-yes')) {
      state.have = items.map((x) => x.k);
      state.haveDone = true;
      state.memAsked = true;
      savePick();
      renderRemember();
      if (state.meal && state.energy && state.time) { rank(); yolk(...suggest(false)); }
      else yolk('happy', `Great, I’ll lean on the ${listText(state.have.map(haveLabel))}. ${nextQuestion()}`);
      const next = $('.js-cook-this') || $('input[name="meal"]');
      if (next) next.focus({ preventScroll: true });
    }
    if (t.closest('.js-mem-some')) { state.memEdit = true; renderRemember(); const first = $('[data-forget]'); if (first) first.focus(); }
    if (t.closest('.js-mem-skip')) { state.memAsked = true; renderRemember(); yolk('default', `No worries. ${nextQuestion()}`); $('input[name="meal"]').focus({ preventScroll: true }); }
    const f = t.closest('[data-forget]');
    if (f) {
      forget(f.dataset.forget);
      renderRemember();
      const again = $('[data-forget]') || $('.js-mem-yes');
      if (again) again.focus(); else $('input[name="meal"]').focus({ preventScroll: true });
      yolk('default', stillHave().length ? `Crossed off the ${haveLabel(f.dataset.forget)}.` : 'All gone? Fresh start, then.');
    }
  });

  /* Who's eating, and the cold-day switch: right above the suggestion. Selections never carry over. */
  function eatingNote() {
    const ids = eaters();
    const outside = active().filter((m) => !ids.includes(m.id) && m.status === 'active')
      .flatMap((m) => restrOf(m.id).keepOut.map((a) => `${m.id === 'you' ? 'You keep' : `${rawName(m.id)} keeps`} ${allergyWord(a)} out of the house`));
    const rules = ids.filter((id) => id !== 'you').map((id) => {
      const r = restrOf(id);
      const bits = [...r.diets.map((d) => lower(labelOf(DIETS, d))), ...r.allergies.map((a) => `no ${allergyWord(a)}`)];
      return bits.length ? `${rawName(id)}: ${bits.join(', ')}` : '';
    }).filter(Boolean);
    const who = ids.length === 1 && ids[0] === 'you' ? 'Just you this time. Everyone else is one tap away.' : `Picks work for ${listText(ids.map(rawName))}${rules.length ? ` (${rules.join('; ')})` : ''}.`;
    return [who, ...outside.map((x) => `${x}.`)].join(' ');
  }
  function renderExtras() {
    const box = $('.js-pick-extras');
    const people = active();
    const ids = eaters();
    box.innerHTML = `${people.length > 1 ? `<div class="eating">
        <p class="eating__label" id="eating-label">Who’s eating?</p>
        <div class="tags" role="group" aria-labelledby="eating-label">${people.map((m) => {
          const on = ids.includes(m.id);
          return `<button type="button" class="tag tag--person${on ? ' is-on' : ''}" data-eat="${m.id}" aria-pressed="${on}">${avatar(m.id, 'idle', 'avatar--xs')}${memberName(m.id)}</button>`;
        }).join('')}</div>
        <p class="fine eating__note">${esc(eatingNote())}</p></div>` : ''}
      <label class="switch cold-switch"><input type="checkbox" class="js-cold"${state.cold ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span><span class="icon" aria-hidden="true">ac_unit</span>It’s a cold day</label>`;
  }
  $('.js-pick-extras').addEventListener('click', (e) => {
    const b = e.target.closest('[data-eat]');
    if (!b) return;
    const id = b.dataset.eat;
    const ids = eaters();
    if (ids.includes(id) && ids.length === 1) { yolk('default', 'Someone has to eat it. That’s the rule.'); return; }
    state.eaters = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    refilter(['default', eaters().length === 1 ? `Just ${eaters()[0] === 'you' ? 'you' : rawName(eaters()[0])}. Got it.` : `Cooking for ${eaters().length}. I’ll keep everyone happy.`]);
    $(`[data-eat="${id}"]`).focus();
  });
  $('.js-pick-extras').addEventListener('change', (e) => {
    if (!e.target.matches('.js-cold')) return;
    state.cold = e.target.checked;
    refilter(state.cold ? ['sleepy', 'Brr. Soups go to the top of the pile.'] : ['default', 'Warmer already.']);
    $('.js-cold').focus();
  });

  const nextQuestion = () => (!state.meal ? 'Which meal is it?' : !state.energy ? 'And how’s your energy?' : 'And how much time have you got?');
  $$('input[name="meal"], input[name="energy"], input[name="time"]').forEach((input) => input.addEventListener('change', () => {
    state[input.name] = input.name === 'meal' ? input.value : Number(input.value);
    state.fromCheckin = false;
    savePick();
    let line = null;
    if (state.meal && state.energy && state.time) {
      if (state.haveDone) { rank(); line = suggest(false); }
      else { renderHave(false); line = ['default', 'Before I pick: anything already in the fridge?']; }
    }
    const first = input.name === 'meal' ? MEALS[state.meal].say : input.name === 'energy' ? ENERGY[state.energy] : null;
    if (first) yolk(...first, line ? { then: line, after: 1500 } : {});
    else if (line) yolk(...line);
    else yolk('default', `Got it. ${nextQuestion()}`);
  }));
  const checkRadios = () => {
    $$('input[name="meal"]').forEach((i) => { i.checked = i.value === state.meal; });
    $$('input[name="energy"]').forEach((i) => { i.checked = Number(i.value) === state.energy; });
    $$('input[name="time"]').forEach((i) => { i.checked = Number(i.value) === state.time; });
  };

  slot.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.js-another')) { yolk(...suggest(true)); $('.js-another').focus(); }
    if (t.closest('.js-cook-this')) startCheck(state.recipe);
    if (t.closest('.js-vote-start')) startVote();
    if (t.closest('.js-have-change')) { renderHave(); yolk('default', 'What’s in the fridge?'); }
    const h = t.closest('[data-group="have"]');
    if (h) { toggleHave(h.dataset.id); const again = $(`[data-group="have"][data-id="${CSS.escape(h.dataset.id)}"]`); if (again && !again.disabled) again.focus(); else $('.js-have-search').focus(); }
    const add = t.closest('[data-group="have-add"]');
    if (add) { toggleHave(add.dataset.id); $('.js-have-search').value = ''; showHaveResults(''); $('.js-have-search').focus(); yolk('happy', `${cap(add.dataset.id)}. Noted.`); }
    if (t.closest('.js-have-go')) leaveHave(false);
    if (t.closest('.js-have-skip')) leaveHave(true);
    if (t.closest('.js-loosen') && loosen) {
      state.temp = { diets: loosen.own.diets, dislikes: loosen.own.dislikes };
      refilter();
      const btn = $('.js-cook-this');
      if (btn) btn.focus({ preventScroll: true });
    }
  });
  slot.addEventListener('input', (e) => { if (e.target.matches('.js-have-search')) showHaveResults(e.target.value); });
  slot.addEventListener('keydown', (e) => {
    if (e.target.matches('.js-have-search') && e.key === 'Enter') {
      e.preventDefault();
      const first = $('[data-group="have-add"]:not([disabled])');
      if (first) first.click();
    }
  });

  /* 2. Check: servings, have/need, spice rack, shopping list */
  function startCheck(recipe) {
    state.recipe = recipe;
    state.marks = {};
    state.out = {};
    state.buy = {};
    state.bought = {};
    // What you said you have is ticked already; from the check-in, the rest is on the list.
    recipe.ingredients.forEach((item, i) => {
      if (hasItem(item, state.have)) state.marks[i] = 'have';
      else if (state.fromCheckin) state.marks[i] = 'need';
    });
    $('.js-check-meal').textContent = `${recipe.name} · ${recipe.time} min · Dishes: ${recipe.dishes.length}`;
    renderChecklist();
    renderShop();
    go('check');
    const had = Object.values(state.marks).filter((m) => m === 'have').length;
    yolk('default', had ? `I ticked the ${plural(had, 'thing')} you already have. Tap the rest.` : 'Tap what you’ve got. No judgment.');
  }

  const amount = (item) => amountFor(item, state.recipe, state.servings);

  function renderChecklist() {
    $('.js-serv-count').textContent = state.servings;
    $('.js-serv-minus').disabled = state.servings <= 1;
    $('.js-serv-plus').disabled = state.servings >= 6;
    $('.js-checklist').innerHTML = state.recipe.ingredients.map((item, i) => {
      const a = amount(item);
      const mark = state.marks[i];
      return `<li class="check-row${mark ? ' is-' + mark : ''}" data-i="${i}">
        <span class="check-row__item"><span class="check-row__section">${item.s}</span><span class="check-row__qty">${a.qty}</span> <span class="check-row__name">${a.name}</span></span>
        <span class="have-need" role="group" aria-label="${a.qty} ${a.name}">
          <button type="button" data-mark="have" aria-pressed="${mark === 'have'}">Got it</button>
          <button type="button" data-mark="need" aria-pressed="${mark === 'need'}">Need it</button>
        </span>
      </li>`;
    }).join('');
    renderSpices();
    updateCount();
  }

  function updateCount() {
    const marks = Object.values(state.marks);
    const have = marks.filter((m) => m === 'have').length;
    const need = marks.filter((m) => m === 'need').length;
    const left = state.recipe.ingredients.length - have - need;
    $('.js-check-count').textContent = `${have} got · ${need} needed${left ? ` · ${left} to check` : ''}`;
  }

  function setMark(i, mark) {
    state.marks[i] = state.marks[i] === mark ? undefined : mark;
    const row = $(`.check-row[data-i="${i}"]`);
    row.classList.remove('is-have', 'is-need');
    if (state.marks[i]) row.classList.add(`is-${state.marks[i]}`);
    $$('button', row).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mark === state.marks[i])));
    updateCount();
    renderShop();
  }

  $('.js-checklist').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mark]');
    if (b) setMark(Number(b.closest('.check-row').dataset.i), b.dataset.mark);
  });
  $('.js-have-all').addEventListener('click', () => {
    state.recipe.ingredients.forEach((_, i) => { state.marks[i] = 'have'; });
    renderChecklist();
    renderShop();
    yolk('happy', 'You have everything? Show-off.');
  });
  const changeServings = (d) => {
    state.servings = Math.min(6, Math.max(1, state.servings + d));
    savePick();
    if (state.recipe && !$('[data-stage="check"]').hidden) { renderChecklist(); renderShop(); }
    if (nutriSheet.open) renderNutri();
  };
  $('.js-serv-minus').addEventListener('click', () => changeServings(-1));
  $('.js-serv-plus').addEventListener('click', () => changeServings(1));

  function renderSpices() {
    const r = state.recipe;
    $('.js-spice-rack').innerHTML = r.spices.map((sp, i) => {
      const out = !!state.out[i];
      return `<button type="button" class="spice" data-s="${i}" aria-pressed="${out}"><span class="icon" aria-hidden="true">${out ? 'remove_circle' : 'check_circle'}</span>${sp.n} <span class="fine">${amount(sp).qty}</span></button>`;
    }).join('');
    $('.js-swaps').innerHTML = r.spices.map((sp, i) => (state.out[i] ? `
      <li class="swap"><strong>Out of ${sp.n.toLowerCase()}?</strong>${sp.swap}
        <label class="switch"><input type="checkbox" class="js-buy" data-s="${i}"${state.buy[i] ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Add it to the list instead</label>
      </li>` : '')).join('');
  }

  $('.js-spice-rack').addEventListener('click', (e) => {
    const b = e.target.closest('.spice');
    if (!b) return;
    const i = Number(b.dataset.s);
    state.out[i] = !state.out[i];
    if (!state.out[i]) delete state.buy[i];
    renderSpices();
    renderShop();
    $(`.spice[data-s="${i}"]`).focus();
    if (state.out[i]) yolk('default', `No ${state.recipe.spices[i].n.toLowerCase()}? No stress. Swap it.`);
  });
  $('.js-swaps').addEventListener('change', (e) => {
    if (!e.target.matches('.js-buy')) return;
    state.buy[e.target.dataset.s] = e.target.checked;
    renderShop();
  });

  function shopItems() {
    const r = state.recipe;
    const items = r.ingredients.map((item, i) => (state.marks[i] === 'need' ? { s: item.s, k: lower(item.n), ...amount(item) } : null)).filter(Boolean);
    r.spices.forEach((sp, i) => { if (state.out[i] && state.buy[i]) items.push({ s: 'Spices', k: lower(sp.n), qty: amount(sp).qty, name: sp.n.toLowerCase() }); });
    return items;
  }

  function renderShop() {
    const items = shopItems();
    const list = $('.js-shop-list');
    $('.js-copy-list').hidden = !items.length;
    if (!items.length) {
      const allHave = state.recipe.ingredients.every((_, i) => state.marks[i] === 'have');
      list.innerHTML = `<p class="shop-empty">${allHave ? 'Nothing to buy. You’re cooking with what you’ve got.' : 'Nothing on the list yet. Tap “Need it” on anything you’re missing.'}</p>`;
      return;
    }
    list.innerHTML = SECTIONS.map((sec) => {
      const inSec = items.filter((it) => it.s === sec);
      if (!inSec.length) return '';
      return `<div class="shop-section" data-section="${sec}"><h4>${sec}</h4><ul>${inSec.map((it) => `<li><label class="shop-check"><input type="checkbox" data-bought="${esc(it.k)}"${state.bought[it.k] ? ' checked' : ''}><span>${it.qty} ${it.name}</span></label></li>`).join('')}</ul></div>`;
    }).join('') + '<p class="fine shop-note">Tick things off as you shop. Yolkie remembers them for a few days, as a guess.</p>';
  }
  // Ticking an item off the list means you probably have it now.
  $('.js-shop-list').addEventListener('change', (e) => {
    const k = e.target.dataset.bought;
    if (!k) return;
    state.bought[k] = e.target.checked;
    if (e.target.checked) remember([k]); else forget(k);
  });

  $('.js-copy-list').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const items = shopItems();
    const lines = [`Shopping list: ${state.recipe.name} (for ${state.servings})`];
    SECTIONS.forEach((sec) => {
      const inSec = items.filter((it) => it.s === sec);
      if (inSec.length) lines.push('', sec.toUpperCase(), ...inSec.map((it) => `- ${it.qty} ${it.name}`));
    });
    try { await navigator.clipboard.writeText(lines.join('\n')); btn.textContent = 'Copied'; } catch (err) { btn.textContent = 'Couldn’t copy'; }
    setTimeout(() => { btn.textContent = 'Copy list'; }, 2000);
  });

  /* Nutrition: estimates per serving, with totals for the servings you're cooking */
  const nutriSheet = $('.js-nutri-sheet');
  const NUTRIENTS = [
    ['Calories', (r) => r.kcal, 'kcal'], ['Protein', (r) => r.protein, 'g'], ['Carbs', (r) => r.nut.carbs, 'g'],
    ['Fiber', (r) => r.nut.fiber, 'g'], ['Fat', (r) => r.nut.fat, 'g'], ['Sugar', (r) => r.nut.sugar, 'g'], ['Sodium', (r) => r.nut.sodium, 'mg'],
  ];
  function renderNutri() {
    const r = state.recipe;
    const s = state.servings;
    $('.js-nutri-body').innerHTML = `
      <p class="nutri-sheet__meal">${r.name}</p>
      <div class="servings">
        <span class="servings__label" id="nutri-serv-label">Servings</span>
        <div class="stepper" role="group" aria-labelledby="nutri-serv-label">
          <button type="button" data-nserv="-1" aria-label="Fewer servings"${s <= 1 ? ' disabled' : ''}><span class="icon" aria-hidden="true">remove</span></button>
          <output aria-live="polite">${s}</output>
          <button type="button" data-nserv="1" aria-label="More servings"${s >= 6 ? ' disabled' : ''}><span class="icon" aria-hidden="true">add</span></button>
        </div>
      </div>
      <table class="nutri-table">
        <caption class="sr-only">Estimated nutrition for ${r.name}</caption>
        <thead><tr><th scope="col">Nutrient</th><th scope="col">Per serving</th><th scope="col">For ${s}</th></tr></thead>
        <tbody>${NUTRIENTS.map(([name, get, unit]) => `<tr><th scope="row">${name}</th><td>~${get(r)} ${unit}</td><td>~${get(r) * s} ${unit}</td></tr>`).join('')}</tbody>
      </table>
      <p class="fine">Estimates per serving, from typical ingredients. The totals follow the servings. Brands and portions vary.</p>`;
  }
  function openNutrition() { if (!state.recipe) return; renderNutri(); openSheet(nutriSheet); }
  nutriSheet.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nserv]');
    if (b) { changeServings(Number(b.dataset.nserv)); const again = $(`[data-nserv="${b.dataset.nserv}"]`, nutriSheet); (again.disabled ? $('[data-nserv]:not([disabled])', nutriSheet) : again).focus(); }
  });

  /* 3. Cook mode */
  const speedToggle = $('.js-demo-speed');
  const MIN = 60000;
  let wakeLock = null;
  const keepAwake = async (on) => {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  };

  function beginCook() {
    stopCook();
    state.cook = { r: state.recipe, i: -1, timers: new Map(), rinsed: new Set(), tidies: 0, last: performance.now(), loop: setInterval(tick, 200) };
    $('.js-cook-title').textContent = state.recipe.name;
    $('.js-timers').innerHTML = '';
    renderNow();
    go('cook');
    keepAwake(true);
    yolk('default', 'One tiny thing first. That’s all.');
  }
  $('.js-start-cook').addEventListener('click', beginCook);
  // "Make again" from Recent meals: straight into cook mode with that recipe.
  function makeAgain(id) {
    state.recipe = byId(id);
    state.have = [];
    state.fromCheckin = false;
    beginCook();
    yolk('happy', `${state.recipe.name}, again. Good call. One tiny thing first.`);
  }

  function stopCook() {
    if (state.cook) clearInterval(state.cook.loop);
    keepAwake(false);
  }

  $('.js-quit-cook').addEventListener('click', () => {
    stopCook();
    state.cook = null;
    go('check');
    yolk('default', 'Paused. The kitchen will wait.');
  });

  const fmtClock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  // Time left before a wait step can move on: until its timer ends, or reaches `until` minutes.
  const waitLeft = (step, t) => (t ? t.remaining - (step.until || 0) * MIN : 0);
  const timerFor = (id) => state.cook.r.steps.find((s) => s.timer && s.timer.id === id).timer;

  function renderNow(focus = false) {
    const c = state.cook;
    const steps = c.r.steps;
    const card = $('.js-now');
    const step = steps[c.i];
    const next = steps[c.i + 1];
    card.className = `now-card js-now${reduceMotion ? '' : ' is-new'}`;
    let announce;
    if (c.i < 0) {
      card.classList.add('is-zero');
      card.innerHTML = `
        <span class="now-card__label">Step zero</span>
        <p class="now-card__text">${c.r.zero}</p>
        <p class="now-card__note">One tiny, physical thing. Momentum does the rest.</p>
        <div class="actions"><button type="button" class="btn btn--primary js-now-done">Done. I’m up.</button></div>`;
      announce = `Step zero: ${c.r.zero}`;
    } else if (step.wait) {
      const t = c.timers.get(step.wait);
      card.classList.add('is-waiting');
      card.innerHTML = `
        <span class="now-card__label"><span class="icon" aria-hidden="true">hourglass_top</span>Waiting on ${t.label.toLowerCase()}</span>
        <p class="now-card__wait js-wait-time">${fmtClock(waitLeft(step, t))}</p>
        <p class="now-card__note">${step.note || `Nothing to do until the ${t.label.toLowerCase()} timer ends. This moves on by itself.`}</p>
        ${step.clean ? `<div class="clean-prompt js-clean"><span class="icon" aria-hidden="true">cleaning_services</span><p class="clean-prompt__text"><small>Clean as you go</small>${step.clean.text}</p><button type="button" class="btn btn--small btn--primary js-cleaned">Did it</button></div>` : ''}
        <div class="actions"><button type="button" class="btn btn--secondary btn--small js-skip-wait">Skip the wait</button></div>`;
      announce = `Waiting on ${t.label}. ${step.clean ? 'Meanwhile: ' + step.clean.text : ''}`;
    } else {
      const last = c.i === steps.length - 1;
      const notes = [step.mins ? `About ${step.mins} min.` : '', step.timer ? `Tap done and the ${step.timer.label.toLowerCase()} timer starts (${step.timer.mins} min).` : ''].filter(Boolean).join(' ');
      card.innerHTML = `
        <span class="now-card__label">Now · ${c.i + 1} of ${steps.length}</span>
        <p class="now-card__text">${step.do}</p>
        ${notes ? `<p class="now-card__note">${notes}</p>` : ''}
        <div class="actions"><button type="button" class="btn btn--yolk js-now-done">${step.timer ? `Done. Start the ${step.timer.label.toLowerCase()} timer` : last ? 'Done. Time to eat' : 'Done. Next'}</button></div>`;
      announce = `Now: ${step.do}`;
    }
    let upNext;
    if (c.i < 0) upNext = steps[0].do;
    else if (!next) upNext = 'Eat. You earned it.';
    else if (next.wait) upNext = `Wait for the ${(c.timers.get(next.wait) || timerFor(next.wait)).label.toLowerCase()}${next.until ? ` (until it has ${next.until} min left)` : ''}, with one tiny tidy-up.`;
    else upNext = next.do;
    $('.js-up-next').innerHTML = `<strong>Up next:</strong> ${upNext}`;
    $('.js-step-announce').textContent = announce;
    if (focus) { const b = $('.js-now-done, .js-cleaned, .js-skip-wait', card); if (b) b.focus({ preventScroll: true }); }
  }

  function advance(manual) {
    const c = state.cook;
    const step = c.r.steps[c.i];
    if (manual) c.timers.forEach((t, id) => { if (t.done) c.timers.delete(id); });
    if (step && step.timer && !c.timers.has(step.timer.id)) {
      c.timers.set(step.timer.id, { label: step.timer.label, total: step.timer.mins * MIN, remaining: step.timer.mins * MIN, done: false });
    }
    c.i += 1;
    if (c.i >= c.r.steps.length) { finishCook(); return; }
    const next = c.r.steps[c.i];
    if (next.wait && waitLeft(next, c.timers.get(next.wait)) <= 0) { advance(false); return; }
    renderTimers();
    renderNow(true);
    if (next.wait) yolk('default', 'Nothing to do but wait. Tiny tidy?');
    else if (c.i > 0) yolk('default', 'One thing at a time.');
  }

  $('.js-now').addEventListener('click', (e) => {
    const c = state.cook;
    if (!c) return;
    if (e.target.closest('.js-now-done')) advance(true);
    if (e.target.closest('.js-cleaned')) {
      const step = c.r.steps[c.i];
      if (step.clean.dish) c.rinsed.add(step.clean.dish);
      c.tidies += 1;
      const box = $('.js-clean');
      box.classList.add('is-done');
      box.innerHTML = `<span class="icon" aria-hidden="true">check</span><p class="clean-prompt__text"><small>Clean as you go</small>Done. ${step.clean.dish ? 'One less dish later.' : 'Future you says thanks.'}</p>`;
      yolk('happy', 'Tidy! Future you says thanks.', { then: ['default', 'Now we wait.'], after: 2000 });
      const skip = $('.js-skip-wait');
      if (skip) skip.focus({ preventScroll: true });
    }
    if (e.target.closest('.js-skip-wait')) {
      const step = c.r.steps[c.i];
      const t = c.timers.get(step.wait);
      t.remaining = Math.min(t.remaining, (step.until || 0) * MIN);
      tick();
    }
  });

  function renderTimers() {
    const c = state.cook;
    const box = $('.js-timers');
    [...box.children].forEach((el) => { if (!c.timers.has(el.dataset.id)) el.remove(); });
    c.timers.forEach((t, id) => {
      let el = box.querySelector(`[data-id="${id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'timer';
        el.dataset.id = id;
        el.innerHTML = `<p class="timer__label">${t.label}</p><p class="timer__time"></p><div class="timer__bar" aria-hidden="true"><span></span></div>
          <button type="button" class="timer__skip" aria-label="End the ${t.label.toLowerCase()} timer now"><span class="icon" aria-hidden="true">skip_next</span></button>`;
        box.appendChild(el);
      }
      el.classList.toggle('is-done', t.done);
      el.querySelector('.timer__time').textContent = t.done ? 'Done' : fmtClock(t.remaining);
      el.querySelector('.timer__bar span').style.transform = `scaleX(${t.remaining / t.total})`;
      el.querySelector('.timer__skip').hidden = t.done;
    });
  }

  $('.js-timers').addEventListener('click', (e) => {
    const b = e.target.closest('.timer__skip');
    if (!b || !state.cook) return;
    const t = state.cook.timers.get(b.closest('.timer').dataset.id);
    if (t) { t.remaining = 0; tick(); }
  });

  function tick() {
    const c = state.cook;
    if (!c) return;
    const now = performance.now();
    const dt = now - c.last;
    c.last = now;
    const speed = speedToggle.checked ? 10 : 1;
    const rang = [];
    c.timers.forEach((t, id) => {
      if (t.done) return;
      t.remaining -= dt * speed;
      if (t.remaining <= 0) { t.remaining = 0; t.done = true; rang.push(id); }
    });
    renderTimers();
    rang.forEach((id) => {
      const t = c.timers.get(id);
      $('.js-timer-announce').textContent = `${t.label} timer is done.`;
      yolk('surprised', `Ding! ${t.label} is done.`, { then: ['default', 'On to the next thing.'], after: 1800 });
      if (navigator.vibrate) navigator.vibrate(200);
      replay($(`.timer[data-id="${id}"]`), 'is-ringing');
    });
    const step = c.r.steps[c.i];
    if (step && step.wait) {
      const left = waitLeft(step, c.timers.get(step.wait));
      if (left <= 0) advance(false);
      else { const w = $('.js-wait-time'); if (w) w.textContent = fmtClock(left); }
    }
  }

  /* Collection: everything is worked out from the meals you cooked, so removing a meal takes it back out.
     Cards, friends and Pantry-dex entries are private to you; nothing is ever sold or random. */
  function collectionFor(a) {
    const s = statsFor(a);
    const cards = {};
    const friends = {};
    const pantry = {};
    const seen = new Set();
    s.mine.forEach((m) => {
      const r = byId(m.r);
      const rar = m.everyone ? 3 : r.time >= 25 || !seen.has(r.cuisine) ? 2 : 1;
      seen.add(r.cuisine);
      const c = cards[r.id] || (cards[r.id] = { n: 0, rar: 0, at: m.at });
      c.n += 1;
      c.rar = Math.max(c.rar, rar);
      c.last = m.at;
      FRIENDS.forEach((f) => { if (!friends[f.id] && tagged(r, f.tag)) friends[f.id] = { at: m.at, r: r.id }; });
      new Set(r.ingredients.map((i) => pantryOf(i.n)).filter(Boolean).map((p) => p.id)).forEach((id) => {
        const e = pantry[id] || (pantry[id] = { n: 0, at: m.at });
        e.n += 1;
      });
    });
    const sets = SETS.map((set) => ({ ...set, got: set.ids.filter((id) => cards[id]).length }));
    return { cards, friends, pantry, sets, done: sets.filter((x) => x.got === x.ids.length) };
  }
  const CARD_MOOD = { breakfast: 'sleepy', lunch: 'default', dinner: 'happy', snack: 'surprised' };
  const rarityWhy = (r, c) => (c.rar === 3 ? 'Special: the whole house sat down to it.'
    : c.rar === 2 ? (r.time >= 25 ? 'Rare: a longer cook.' : `Rare: your first ${r.cuisine} recipe here.`)
      : 'Common: quick and easy. Cook it with the whole house eating for a Special.');
  // One card. Uncollected ones are a soft silhouette with a hint.
  function cardHtml(r, c) {
    const info = CARDS[r.id];
    const meal = cap(MEALS[r.meal].label);
    if (!c) {
      return `<article class="rcard is-locked" aria-label="Not collected yet: ${esc(info.hint)}"><div class="rcard__art">${dishArt(r)}</div>
        <h4 class="rcard__name" aria-hidden="true">???</h4><p class="rcard__meta">${r.cuisine} · ${meal}</p><p class="rcard__fact">${info.hint}</p></article>`;
    }
    const foil = c.n >= MASTER_AT;
    const rar = RARITY[c.rar];
    return `<article class="rcard rcard--${rar.id}${foil ? ' is-foil' : ''}">
      <span class="rcard__gem" role="img" aria-label="${rar.name}">${gemSvg(c.rar)}</span>
      <div class="rcard__art">${dishArt(r)}${yolkieArt(foil ? 'happy' : CARD_MOOD[r.meal], 'rcard__yolk', {})}</div>
      ${foil ? '<p class="rcard__ribbon">Mastered</p>' : ''}
      <h4 class="rcard__name">${r.name}</h4>
      <p class="rcard__meta">${r.cuisine} · ${meal} · ${rar.name}</p>
      <p class="rcard__fact">${info.fact}</p>
      <p class="rcard__count">Cooked ${c.n}×${foil ? '' : ` · ${MASTER_AT - c.n} more to master`}</p>
    </article>`;
  }
  const cardBack = () => `<div class="rcard rcard--back">${yolkieArt('happy', 'rcard__yolk', {})}<p>Yolkie</p></div>`;

  /* Stickers: each moment checks the meal that just finished. The first one is a new sticker; any
     more are duplicates. Each can only come once a day or once a week, so a sticker never turns into a chore. */
  function earnStickers(a, meal, ctx) {
    const r = byId(meal.r);
    const h = new Date(meal.at).getHours();
    const sameDay = a.meals.filter((m) => m !== meal && dayKey(m.at) === dayKey(meal.at)).flatMap((m) => m.stickers || []);
    const sameWeek = a.meals.filter((m) => m !== meal && m.at >= weekStart(meal.at)).flatMap((m) => m.stickers || []);
    const ws = weekStart(meal.at);
    const cooks = (list) => new Set(list.filter((m) => m.at >= ws).map((m) => m.cook));
    const team = active().length > 1 && active().every((m) => cooks(a.meals).has(m.id)) && !active().every((m) => cooks(a.meals.filter((x) => x !== meal)).has(m.id));
    const third = ctx.before.week < 3 && ctx.after.week >= 3;
    const season = seasonOf(meal.at);
    const got = [];
    const add = (id, once = 'day') => { if (!(once === 'day' ? sameDay : once === 'week' ? sameWeek : []).includes(id)) got.push(id); };
    if (r.meal === 'breakfast') add('early', 'week');
    if (meal.have.length) add('rescue', 'week');
    if (h >= 23 || h < 4) add('owl');
    if (tagged(r, 'soup') && meal.cold) add('cozy');
    if (ctx.goalHit) add('goal', 'never');
    if (team) add('team', 'never');
    if ((collectionFor(a).cards[r.id] || {}).n === MASTER_AT) add('foil', 'never');
    if (season && season.id === 'soup') { add('leaf', 'week'); if (third) add('mug', 'never'); if (meal.cold) add('mitten'); }
    if (season && season.id === 'summer') { if (r.meal === 'snack') add('pop'); if (third) add('melon', 'never'); if (r.meal === 'breakfast') add('sun'); }
    got.forEach((id) => { a.stickers[id] = (a.stickers[id] || 0) + 1; });
    return got;
  }
  // Taking a meal back takes back what it earned (and pulls a sticker off the fridge if it's the last one).
  function unearn(a, meal) {
    (meal.stickers || []).forEach((id) => {
      a.stickers[id] = Math.max(0, (a.stickers[id] || 0) - 1);
      if (!a.stickers[id]) { delete a.stickers[id]; delete a.stickerFrom[id]; a.fridge = a.fridge.filter((f) => f.s !== id); }
    });
  }

  /* 4. Done: the meal is saved, and everything it adds shows up here */
  function finishCook() {
    const c = state.cook;
    stopCook();
    const r = c.r;
    const a = activity();
    const before = statsFor(a);
    const ids = eaters();
    const meal = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, r: r.id, at: Date.now(), servings: state.servings,
      have: usesHave(r, state.have), rinsed: c.rinsed.size, tidies: c.tidies, cook: 'you', kudos: [],
      eaters: ids, ratings: {}, cold: state.cold, everyone: active().length > 1 && active().every((m) => ids.includes(m.id)), stickers: [],
    };
    a.meals.push(meal);
    useUp(a, r);
    const finished = settleChallenge(a);
    const after = statsFor(a);
    const goalHit = before.week < prefs.goal && after.week >= prefs.goal;
    meal.stickers = earnStickers(a, meal, { before, after, goalHit });
    saveActivity(a);
    state.done = {
      mealId: meal.id, finished, goalHit, flipped: false,
      unlocked: CLOSET.filter((it) => before.cooked < it.at && after.cooked >= it.at),
      newCuisine: !before.cuisines.includes(r.cuisine),
      newRecipe: !before.recipes.includes(r.id),
      askTakeout: !prefs.takeoutAsked,
    };
    if (!prefs.takeoutAsked) { prefs.takeoutAsked = true; savePrefs(); }
    // "Just this meal" ends with the meal; what you had is used up, and the next meal starts with just you.
    state.temp = null;
    state.have = [];
    state.haveDone = false;
    state.fromCheckin = false;
    state.eaters = ['you'];
    state.memAsked = false;
    state.memEdit = false;
    savePick();
    renderDietBar();
    renderExtras();
    renderRemember();

    $('.js-done-title').textContent = `${cap(mealOf(r).label)}. Done.`;
    $('.js-done-meal').textContent = `${r.name}, for ${state.servings}.`;
    $('.js-goal-hit').hidden = !state.done.goalHit;
    $('.js-done-stats').innerHTML = `
      <div class="done-stat"><dt>Dishes used</dt><dd>${r.dishes.length}<small>${r.dishes.join(', ')}</small></dd></div>
      <div class="done-stat"><dt>Already rinsed</dt><dd>${meal.rinsed}<small>${meal.rinsed ? 'Thanks to clean-as-you-go.' : 'They’ll keep till tomorrow.'}</small></dd></div>
      <div class="done-stat nutri"><dt>Calories</dt><dd>~${r.kcal}<small>per serving, estimate</small></dd></div>
      <div class="done-stat nutri"><dt>Protein</dt><dd>~${r.protein} g<small>per serving, estimate</small></dd></div>`;
    renderDone();
    state.cook = null;
    dress();
    go('done');
    confetti($('.js-confetti'));
    if (state.done.goalHit) {
      setTimeout(() => confetti($('.js-confetti')), 900);
      yolk('happy', `Weekly goal: hit! ${plural(prefs.goal, 'meal')} this week. I’m so proud I could scramble.`, { celebrate: true });
    } else if (state.done.unlocked.length) {
      yolk('happy', `${cap(mealOf(r).label)}. Done. And ooh, something new in my closet!`, { celebrate: true });
    } else {
      yolk('happy', `${cap(mealOf(r).label)}. Done. Look at you go!`, { celebrate: true });
    }
  }

  const gain = (icon, title, sub, cls = '') => `<li class="gain ${cls}"><span class="icon" aria-hidden="true">${icon}</span><p><strong>${title}</strong><small>${sub}</small></p></li>`;
  // The new card, flipping in the first time it's shown. A finished set gets confetti and a kitchen bonus.
  function renderDrop(a, meal) {
    const box = $('.js-card-drop');
    if (!meal || meal.cook !== 'you') { box.hidden = true; box.innerHTML = ''; return { before: null, after: null }; }
    const before = collectionFor({ ...a, meals: a.meals.filter((m) => m.id !== meal.id) });
    const after = collectionFor(a);
    const r = byId(meal.r);
    const c = after.cards[r.id];
    const was = before.cards[r.id];
    const mastered = c.n >= MASTER_AT && (!was || was.n < MASTER_AT);
    const up = was && c.rar > was.rar;
    const title = !was ? 'New card!' : mastered ? 'Mastered! It’s foil now.' : up ? `Upgraded to ${RARITY[c.rar].name}!` : `Card +1: ${MASTER_AT - c.n} more to master`;
    const sets = after.done.filter((x) => !before.done.some((y) => y.id === x.id));
    const flip = !state.done.flipped && (!was || mastered || up);
    state.done.flipped = true;
    box.hidden = false;
    box.innerHTML = `
      <h3>${title}</h3><p class="fine">${rarityWhy(r, c)}</p>
      <div class="card-drop__stage"><div class="flip${flip && !reduceMotion ? ' is-flipping' : ''}"><div class="flip__inner">
        <div class="flip__face flip__back" aria-hidden="true">${cardBack()}</div>
        <div class="flip__face flip__front">${cardHtml(r, c)}</div></div></div></div>
      ${sets.map((set) => `<div class="set-done"><span class="icon" aria-hidden="true">auto_awesome</span><p><strong>Set complete: ${esc(set.name)}!</strong><small>Bonus for the kitchen: ${esc(set.bonusName)}.</small></p></div>`).join('')}
      <p class="card-drop__more"><button type="button" class="link-btn js-see-binder">Open your binder</button></p>`;
    if (flip && sets.length) setTimeout(() => confetti($('.js-confetti')), reduceMotion ? 0 : 1000);
    return { before, after };
  }
  function renderDone() {
    const d = state.done;
    const a = activity();
    const meal = a.meals.find((m) => m.id === d.mealId);
    const gainsBox = $('.js-gains');
    const who = $('.js-who');
    const rate = $('.js-rate');
    const col = renderDrop(a, meal);
    if (!meal) {
      gainsBox.innerHTML = '<h3>Removed</h3><p class="fine">That one isn’t counted anymore. No harm done.</p>';
      who.hidden = true;
      rate.hidden = true;
      return;
    }
    const s = statsFor(a);
    const r = byId(meal.r);
    const mine = meal.cook === 'you';
    const items = [];
    items.push(gain('savings', mine ? `+$${prefs.takeout} kept in your pocket` : `+$${prefs.takeout} for the house`,
      `Estimate, from your usual takeout cost.${mine ? ` $${s.kept} so far.` : ` The house: $${s.houseKept}.`}`, 'gain--money'));
    if (meal.have.length) items.push(gain('kitchen', 'Fridge rescue!', `You used ${esc(listText(meal.have.map(haveLabel)))}.`));
    if (mine && d.newCuisine) items.push(gain('approval', `New passport stamp: ${r.cuisine}`, 'Your first one here.'));
    else if (mine && d.newRecipe) items.push(gain('approval', 'New recipe stamp', `${r.name}, first time.`));
    if (meal.rinsed) items.push(gain('wash', `${plural(meal.rinsed, 'dish', 'dishes')} dodged`, 'Rinsed while something cooked, so they never hit the sink.'));
    else if (meal.tidies) items.push(gain('wash', `${plural(meal.tidies, 'tidy-up')} done`, 'Clean as you go. Future you says thanks.'));
    (meal.stickers || []).forEach((id) => {
      const st = stickerById(id);
      const dup = (a.stickers[id] || 0) > 1;
      items.push(`<li class="gain gain--sticker">${stickerSvg(id, 'gain__sticker')}<p><strong>${dup ? 'Duplicate sticker' : 'New sticker'}: ${st.name}</strong><small>${dup ? 'Gift it to someone in the house, or turn it into crumbs.' : 'It’s in your sticker book. Stick it on the fridge!'}</small></p></li>`);
    });
    if (col.after) {
      FRIENDS.filter((f) => col.after.friends[f.id] && !col.before.friends[f.id]).forEach((f) => {
        items.push(`<li class="gain gain--friend">${charArt(f.id, 'gain__art')}<p><strong>New friend: ${f.name}!</strong><small>${f.name} is on the kitchen shelf now, and drops by for a visit now and then.</small></p></li>`);
      });
      const fresh = PANTRY.filter((p) => col.after.pantry[p.id] && !col.before.pantry[p.id]);
      if (fresh.length) items.push(gain('menu_book', `Pantry-dex: ${plural(fresh.length, 'new entry', 'new entries')}`, `${esc(listText(fresh.map((p) => p.name)))}.${fresh.some((p) => p.rare) ? ' Including a rare find!' : ''}`, fresh.some((p) => p.rare) ? 'gain--rare' : ''));
    }
    if (mine) {
      const hit = s.week >= prefs.goal;
      items.push(`<li class="gain gain--ring">${ring(s.week, prefs.goal, 'Weekly goal', 'ring--sm')}<p><strong>${hit ? 'Weekly goal hit!' : `${s.week} of ${prefs.goal} this week`}</strong><small>${hit ? 'Anything more is a bonus.' : 'Your weekly goal. No rush.'}</small></p></li>`);
    } else {
      items.push(gain('home', `The house: ${plural(s.houseWeek, 'meal')} this week`, `House goal: ${prefs.houseGoal}.`));
    }
    const active2 = a.challenge && CHALLENGES.find((c) => c.id === a.challenge.id);
    if (d.finished) items.push(gain('military_tech', `Badge earned: ${d.finished.badge}`, `${d.finished.name}, done.`, 'gain--badge'));
    else if (active2) items.push(gain(active2.icon, `${active2.name}: ${challengeProgress(a, s)} of ${active2.goal}`, active2.unit));
    const unlocks = mine ? d.unlocked.map((it) => {
      const on = prefs.outfit[it.slot] === it.id;
      return `<div class="unlock-card">${yolkieArt('happy', '', { ...worn(), [it.slot]: it.id })}<p><small>New in Yolkie’s closet</small><strong>${it.name}</strong></p>
        <button type="button" class="btn btn--yolk btn--small" data-wear-now="${it.id}" aria-pressed="${on}">${on ? 'Wearing it' : 'Put it on'}</button></div>`;
    }).join('') : '';
    const ask = d.askTakeout ? `<form class="takeout-ask js-takeout-ask"><label for="takeout-once"><strong>Quick one, just this once:</strong> what does takeout usually cost you?</label>
        <span class="takeout-ask__row"><span class="money"><span aria-hidden="true">$</span><input id="takeout-once" type="number" min="1" max="200" step="1" value="${prefs.takeout}" inputmode="decimal"></span>
        <button class="btn btn--primary btn--small">Save</button></span><span class="fine">Change it any time in Preferences.</span></form>` : '';
    gainsBox.innerHTML = `<h3>This meal counts</h3>${sampleOn() ? '<p class="fine">Saved to the sample week, not your real stats.</p>' : ''}
      <ul class="gains">${items.join('')}</ul>${ask}${unlocks}
      <p class="done-undo"><button type="button" class="link-btn js-unlog">Didn’t actually cook it? Remove it</button></p>`;
    rate.hidden = false;
    rate.innerHTML = rateHtml(meal);
    who.hidden = false;
    who.innerHTML = whoHtml(meal);
  }
  // Ratings: one tap per person who ate. Single device, so pass the phone.
  const FACES = [[1, '😕', 'Not for me'], [2, '🙂', 'Good'], [3, '😍', 'Loved it']];
  const faceOf = (v) => (FACES.find((f) => f[0] === v) || [])[1] || '';
  function rateHtml(meal) {
    const hidden = prefs.hidden.includes(meal.r);
    return `<h3>How was it?</h3><p class="fine">One tap each for everyone who ate. Pass the phone. ${active().length > 1 ? 'Favorites show up in Recent meals.' : ''}</p>
      <ul class="rate-list">${meal.eaters.map((id) => `<li class="rate-row">${avatar(id, 'idle', 'avatar--sm')}<span class="rate-row__name">${memberName(id)}</span>
        <span class="rate-faces" role="group" aria-label="${memberName(id)}’s rating">${FACES.map(([v, emo, label]) => `<button type="button" class="face-btn" data-rate="${id}" data-v="${v}" aria-pressed="${meal.ratings[id] === v}" aria-label="${label}" title="${label}">${emo}</button>`).join('')}</span></li>`).join('')}</ul>
      <p class="done-undo">${hidden
        ? '<span>Yolkie won’t suggest this again.</span> <button type="button" class="link-btn js-hide-recipe" aria-pressed="true">Undo</button>'
        : '<button type="button" class="link-btn js-hide-recipe" aria-pressed="false">Don’t suggest this again</button>'}</p>`;
  }
  function whoHtml(meal) {
    const people = [...new Set([...active().map((m) => m.id), meal.cook])];
    return `<h3>Who cooked?</h3><p class="fine">Demo: pass the phone.</p>
      <div class="tags" role="group" aria-label="Who cooked">${people.map((id) => tag('cook', id, rawName(id), meal.cook === id)).join('')}</div>
      ${active().length > 1 ? `<p class="kudos-label">Everyone else: was it good?</p>${kudosRow(meal)}` : ''}`;
  }
  function kudosRow(meal, small = false) {
    const others2 = active().map((m) => m.id).filter((id) => id !== meal.cook);
    return `<div class="kudos-row">${others2.map((id) => {
      const on = meal.kudos.includes(id);
      // Once tapped, the button turns into that member's sticker.
      return `<button type="button" class="kudos-btn${small ? ' kudos-btn--sm' : ''}" data-meal="${meal.id}" data-kudos="${id}" aria-pressed="${on}">${avatar(id, on ? 'win' : 'idle', 'avatar--sm')}<span>${memberName(id)}: That was good!</span>${on ? '<span class="icon" aria-hidden="true">favorite</span>' : ''}</button>`;
    }).join('')}</div>`;
  }
  function updateMeal(id, fn) {
    const a = activity();
    const meal = a.meals.find((m) => m.id === id);
    if (!meal) return;
    fn(meal, a);
    saveActivity(a);
  }
  const toggleKudos = (id, who) => updateMeal(id, (m) => { m.kudos = m.kudos.includes(who) ? m.kudos.filter((x) => x !== who) : [...m.kudos, who]; });
  const toggleHidden = (rid) => { prefs.hidden = prefs.hidden.includes(rid) ? prefs.hidden.filter((x) => x !== rid) : [...prefs.hidden, rid]; savePrefs(); };

  const doneStage = $('[data-stage="done"]');
  doneStage.addEventListener('click', (e) => {
    const t = e.target;
    const d = state.done;
    if (!d) return;
    const cook = t.closest('[data-group="cook"]');
    if (cook) {
      const id = cook.dataset.id;
      updateMeal(d.mealId, (m) => { m.cook = id; m.kudos = m.kudos.filter((x) => x !== id); if (!m.eaters.includes(id)) m.eaters.push(id); });
      renderDone();
      dress();
      $(`[data-group="cook"][data-id="${id}"]`).focus();
      yolk('happy', id === 'you' ? 'Chef: you. Obviously.' : `Chef: ${rawName(id)}. Nice one.`);
    }
    const k = t.closest('[data-kudos]');
    if (k) {
      const id = k.dataset.kudos;
      toggleKudos(d.mealId, id);
      renderDone();
      $(`[data-kudos="${id}"]`, doneStage).focus();
      const meal = activity().meals.find((m) => m.id === d.mealId);
      if (meal && meal.kudos.includes(id)) yolk('happy', `${rawName(id)} says that was good! Sticker earned.`);
    }
    const rt = t.closest('[data-rate]');
    if (rt) {
      const id = rt.dataset.rate;
      const v = Number(rt.dataset.v);
      updateMeal(d.mealId, (m) => { if (m.ratings[id] === v) delete m.ratings[id]; else m.ratings[id] = v; });
      renderDone();
      $(`[data-rate="${id}"][data-v="${v}"]`, doneStage).focus();
      const meal = activity().meals.find((m) => m.id === d.mealId);
      const set = meal && meal.ratings[id];
      if (set) yolk(set === 3 ? 'happy' : set === 2 ? 'default' : 'meh', set === 3 ? `${rawName(id)} loved it! That’s a favorite now.` : set === 2 ? `${rawName(id)}: good. Solid.` : `${rawName(id)} wasn’t a fan. Noted. I’ll suggest it less.`);
    }
    if (t.closest('.js-hide-recipe')) {
      const meal = activity().meals.find((m) => m.id === d.mealId);
      toggleHidden(meal.r);
      renderDone();
      $('.js-hide-recipe', doneStage).focus();
      yolk('default', prefs.hidden.includes(meal.r) ? 'Got it. I won’t suggest that one again. You can undo it in Preferences.' : 'Back on the menu.');
    }
    if (t.closest('.js-see-binder')) { showTab('collection'); showColView('binder', true); }
    const w = t.closest('[data-wear-now]');
    if (w) {
      const it = CLOSET.find((c) => c.id === w.dataset.wearNow);
      prefs.outfit[it.slot] = prefs.outfit[it.slot] === it.id ? undefined : it.id;
      savePrefs();
      dress();
      renderDone();
      $(`[data-wear-now="${it.id}"]`).focus();
      yolk('happy', prefs.outfit[it.slot] ? `${it.name}, on. How do I look?` : `${it.name}, off. Back to basics.`);
    }
    if (t.closest('.js-unlog')) {
      const a = activity();
      const meal = a.meals.find((m) => m.id === d.mealId);
      if (meal) unearn(a, meal);
      a.meals = a.meals.filter((m) => m.id !== d.mealId);
      saveActivity(a);
      renderDone();
      dress();
      $('.js-again').focus();
      yolk('default', 'Removed. No harm done.');
    }
    if (t.closest('.js-see-me')) { showTab('me'); demo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); $('.js-me .stage__title').focus({ preventScroll: true }); }
  });
  doneStage.addEventListener('submit', (e) => {
    if (!e.target.matches('.js-takeout-ask')) return;
    e.preventDefault();
    const v = Math.round(Number(e.target.querySelector('input').value));
    if (v > 0) prefs.takeout = Math.min(200, v);
    savePrefs();
    state.done.askTakeout = false;
    renderDone();
    yolk('happy', `$${prefs.takeout} it is. I’ll count every meal against that.`);
  });
  $('.js-again').addEventListener('click', () => {
    checkRadios();
    if (state.meal && state.energy && state.time) renderHave(false);
    go('pick');
    yolk('default', 'Round two? Same questions, new meal.');
  });

  /* Me: progress, goal, passport, challenges, closet, Wrapped */
  const meBox = $('.js-me');
  function renderMe() {
    const a = activity();
    const s = statsFor(a);
    const goal = prefs.goal;
    const hit = s.week >= goal;
    const line = hit ? 'Goal hit this week! Anything more is a bonus.'
      : s.week === 0 ? 'New week, fresh start. One meal gets the ring moving.'
        : `${s.week} down, ${goal - s.week} to go. No rush.`;
    const active = a.challenge && CHALLENGES.find((c) => c.id === a.challenge.id);
    const prog = active ? challengeProgress(a, s) : 0;
    meBox.innerHTML = `
      <div class="tab-head"><h2 class="stage__title" tabindex="-1">Me</h2>
        <p class="stage__sub">Everything here comes from meals finished in cook mode${sampleOn() ? ', and right now that’s the sample week' : ''}. Saved on this device only.</p></div>
      <section class="panel goal-panel" aria-labelledby="goal-title">
        ${ring(s.week, goal, 'Meals cooked this week')}
        <div><h3 id="goal-title">Weekly goal</h3><p class="goal-line">${s.week} of ${plural(goal, 'meal')} this week</p><p class="fine">${line}</p>
          <div class="count-choices" role="group" aria-label="Meals per week">${[2, 3, 4, 5].map((n) => `<button type="button" data-goal="${n}" aria-pressed="${n === goal}">${n}</button>`).join('')}</div></div>
      </section>
      <dl class="tiles">
        <div class="tile tile--money"><dt><span class="icon" aria-hidden="true">savings</span>Takeout dodged</dt><dd>$${s.kept}<small>${s.cooked ? `You’ve kept $${s.kept} in your pocket. Estimate: ${s.cooked} × your usual $${prefs.takeout}.` : 'Each meal you cook adds your usual takeout cost. An estimate.'}</small></dd></div>
        <div class="tile"><dt><span class="icon" aria-hidden="true">kitchen</span>Fridge rescues</dt><dd>${s.rescues}<small>Meals that used something you already had.</small></dd></div>
        <div class="tile"><dt><span class="icon" aria-hidden="true">wash</span>Dishes dodged</dt><dd>${s.dodged}<small>${s.tidies ? `Rinsed as you went, plus ${plural(s.tidies, 'tiny tidy-up')}.` : 'Dishes rinsed while something cooked.'}</small></dd></div>
        <div class="tile"><dt><span class="icon" aria-hidden="true">restaurant</span>Meals cooked</dt><dd>${s.cooked}<small>All time, on this device.</small></dd></div>
      </dl>
      <section class="panel" aria-labelledby="passport-title">
        <h3 id="passport-title">Passport</h3><p class="fine">A stamp for every new cuisine and every new recipe.</p>
        <h4 class="mini-head">Cuisines · ${s.cuisines.length} of ${CUISINES.length}</h4>
        <ul class="stamps">${CUISINES.map((cu) => `<li class="stamp${s.cuisines.includes(cu) ? ' is-stamped' : ''}">${s.cuisines.includes(cu) ? '<span class="icon" aria-hidden="true">approval</span>' : ''}${cu}<span class="sr-only">${s.cuisines.includes(cu) ? ', stamped' : ', not yet'}</span></li>`).join('')}</ul>
        <h4 class="mini-head">Recipes · ${s.recipes.length} of ${RECIPES.length}</h4>
        ${s.recipes.length ? `<ul class="stamps stamps--recipes">${s.recipes.map((id) => `<li class="stamp is-stamped">${byId(id).name}</li>`).join('')}</ul>` : '<p class="fine">No stamps yet. Your first meal gets one.</p>'}
      </section>
      <section class="panel" aria-labelledby="ch-title">
        <h3 id="ch-title">Challenges</h3><p class="fine">Optional, one at a time, no deadline. Stop whenever you like.</p>
        ${active ? `<div class="challenge is-active"><span class="icon" aria-hidden="true">${active.icon}</span><div class="challenge__body"><strong>${active.name}</strong><p class="fine">${active.blurb}</p>
            <div class="bar" role="img" aria-label="${prog} of ${active.goal}"><span style="width:${Math.min(100, (prog / active.goal) * 100)}%"></span></div><p class="fine">${prog} of ${active.goal} ${active.unit}</p></div>
            <button type="button" class="btn btn--ghost btn--small js-ch-stop">Stop</button></div>`
          : CHALLENGES.map((c) => `<div class="challenge"><span class="icon" aria-hidden="true">${c.icon}</span><div class="challenge__body"><strong>${c.name}</strong><p class="fine">${c.blurb}</p></div>
            <button type="button" class="btn btn--secondary btn--small" data-ch="${c.id}">Start</button></div>`).join('')}
        <h4 class="mini-head">Badges</h4>
        ${a.badges.length ? `<div class="badges">${a.badges.map((b) => { const c = CHALLENGES.find((x) => x.id === b.id); return `<span class="badge"><span class="icon" aria-hidden="true">military_tech</span>${c.badge}</span>`; }).join('')}</div>` : '<p class="fine">Finish a challenge to earn one.</p>'}
      </section>
      <section class="panel" id="closet" aria-labelledby="closet-title">
        <h3 id="closet-title">Yolkie’s closet</h3><p class="fine">New things unlock as you cook. ${plural(s.cooked, 'meal')} so far. Yolkie wears them all over the demo.</p>
        <div class="closet-stage">${yolkieArt('happy')}</div>
        <ul class="closet">${CLOSET.map((it) => {
          const open = s.cooked >= it.at;
          const on = open && prefs.outfit[it.slot] === it.id;
          const left = it.at - s.cooked;
          return `<li><button type="button" class="closet-item${open ? '' : ' is-locked'}${on ? ' is-on' : ''}" data-wear="${it.id}" aria-pressed="${on}"${open ? '' : ' aria-disabled="true"'}>
            <svg class="closet-item__art" viewBox="${it.box}" aria-hidden="true" focusable="false">${it.svg}</svg>
            <span class="closet-item__name">${it.name}</span>
            <span class="closet-item__state">${open ? (on ? 'Wearing' : 'Put on') : `Cook ${plural(left, 'more meal')}`}</span></button></li>`;
        }).join('')}</ul>
      </section>
      <section class="panel wrapped-teaser" aria-labelledby="wrapped-title">
        <div><h3 id="wrapped-title">Yolkie Wrapped</h3><p class="fine">Your cooking so far, as a seven-card story. Save any card as an image.</p></div>
        <button type="button" class="btn btn--primary js-open-wrapped"><span class="btn__dot" aria-hidden="true"></span>Preview Yolkie Wrapped</button>
      </section>`;
  }
  const refocus = (box, sel) => { const el = $(sel, box); if (el) el.focus(); return el; };
  meBox.addEventListener('click', (e) => {
    const t = e.target;
    const g = t.closest('[data-goal]');
    if (g) {
      prefs.goal = Number(g.dataset.goal);
      savePrefs();
      renderMe();
      refocus(meBox, `[data-goal="${prefs.goal}"]`);
      yolk('happy', `${plural(prefs.goal, 'meal')} a week. Sounds doable.`);
    }
    const ch = t.closest('[data-ch]');
    if (ch) {
      const a = activity();
      a.challenge = { id: ch.dataset.ch, start: Date.now() };
      saveActivity(a);
      renderMe();
      refocus(meBox, '.js-ch-stop');
      yolk('happy', `${CHALLENGES.find((c) => c.id === ch.dataset.ch).name}, starting now. No deadline.`);
    }
    if (t.closest('.js-ch-stop')) {
      const a = activity();
      a.challenge = null;
      saveActivity(a);
      renderMe();
      refocus(meBox, '[data-ch]');
      yolk('default', 'Stopped. Pick another whenever.');
    }
    const w = t.closest('[data-wear]');
    if (w) {
      const it = CLOSET.find((c) => c.id === w.dataset.wear);
      const left = it.at - statsFor(activity()).cooked;
      if (left > 0) { yolk('default', `Cook ${plural(left, 'more meal')} and the ${it.name.toLowerCase()} is mine.`); return; }
      prefs.outfit[it.slot] = prefs.outfit[it.slot] === it.id ? undefined : it.id;
      savePrefs();
      dress();
      renderMe();
      refocus(meBox, `[data-wear="${it.id}"]`);
      yolk('happy', prefs.outfit[it.slot] ? `${it.name}, on. How do I look?` : `${it.name}, off.`);
    }
  });

  /* A short toast at the bottom of the demo */
  let flashT;
  function flash(msg) {
    const t = $('.js-toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(flashT);
    flashT = setTimeout(() => t.classList.remove('is-on'), 2800);
  }

  /* House: who's in it, linking (simulated), the shared goal, kudos and favorites. No rankings, no "worst" list. */
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L
  const DEMO_CODE = 'YOLK-EGGS';
  const newCode = () => `YOLK-${Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')}`;
  const inviteLink = (code) => `${location.origin}${location.pathname}#join=${code}`;
  const liveLink = () => (prefs.link && prefs.link.exp > Date.now() ? prefs.link : null);
  const JOINERS = ['Sunny', 'Poppy', 'Basil', 'Clementine'];
  const ROLE = { owner: 'Owner', member: 'Member', guest: 'Guest · no app yet' };
  const SHARED = ['Who’s in the house', 'Restrictions needed for cooking', 'The shopping list', 'Votes', 'The house goal', 'The kitchen', 'Kudos', 'Gifts', 'House favorites'];
  const PRIVATE = ['Personal stats', 'Nutrition', 'Check-in times', 'Your sticker book'];
  const houseBox = $('.js-house');
  const house = { view: '', confirm: '', guest: false, joinCode: '', joinMsg: '', joinErr: false, recent: 'recent' };
  // Anything that changes who's in the house updates the chips, the kitchen and this tab.
  function membersChanged() {
    savePrefs();
    state.eaters = eaters().length ? eaters() : ['you'];
    renderExtras();
    if (kitchen.isOpen()) kitchen.show();
    if (state.shown) refilter();
  }

  function restrSummary(id) {
    const r = restrOf(id);
    const bits = [...r.diets.map((d) => labelOf(DIETS, d)),
      ...r.allergies.map((a) => `${cap(allergyWord(a))} allergy${r.keepOut.includes(a) ? ', kept out of the house' : ''}`),
      ...r.dislikes.map((t) => `not a fan of ${t}`)];
    return bits.length ? bits.join(' · ') : 'No restrictions yet';
  }
  function memberCard(m) {
    const me = m.id === 'you';
    const pending = m.status === 'pending';
    const confirm = house.confirm === m.id;
    return `<li class="member${pending ? ' is-pending' : ''}">
      ${avatar(m.id)}
      <div class="member__body">
        <p class="member__role">${pending ? '<span class="icon" aria-hidden="true">hourglass_top</span>Waiting for approval' : me ? 'You · owner' : ROLE[m.role]}</p>
        ${pending ? `<p class="member__name">${memberName(m.id)}</p><p class="member__allergy">Asked to join with an invite code.</p>`
          : `<label class="sr-only" for="member-${m.id}">${me ? 'Your name' : `Name for ${memberName(m.id)}`}</label><input id="member-${m.id}" class="text-input" type="text" value="${memberName(m.id)}" data-house-name="${m.id}" maxlength="16" autocomplete="off">
            <span class="member__allergy">${esc(restrSummary(m.id))}</span>`}
        <div class="member__actions">
          ${pending ? `<button type="button" class="btn btn--primary btn--small" data-approve="${m.id}">Approve</button><button type="button" class="btn btn--ghost btn--small" data-decline="${m.id}">Decline</button>`
            : `<button type="button" class="link-btn" data-edit-restr="${m.id}">Restrictions</button>
              ${m.role === 'guest' ? `<button type="button" class="btn btn--secondary btn--small" data-claim="${m.id}">This is me</button>` : ''}
              ${me ? (prefs.members.length > 1 ? '<button type="button" class="btn btn--ghost btn--small" data-leave="you">Leave household</button>' : '') : `<button type="button" class="btn btn--ghost btn--small" data-remove="${m.id}">Remove</button>`}`}
        </div>
        ${confirm ? `<div class="confirm" role="group" aria-label="${me ? 'Leave the household?' : `Remove ${memberName(m.id)}?`}">
          <p>${me ? 'Leave the household? Your personal stats and collections stay with you.' : `Remove ${memberName(m.id)} from the house? Their personal stats and collections stay with them.`}</p>
          <div class="actions"><button type="button" class="btn btn--primary btn--small js-confirm-yes" data-who="${m.id}">${me ? 'Leave' : 'Remove'}</button><button type="button" class="btn btn--ghost btn--small js-confirm-no">Cancel</button></div></div>` : ''}
      </div></li>`;
  }
  function linkPanel() {
    const l = liveLink();
    let body = '';
    if (house.view === 'create' && l) {
      const days = Math.max(1, Math.ceil((l.exp - Date.now()) / DAY));
      body = `<div class="invite">
        <div class="invite__code"><p class="mini-head">Invite code</p><p class="invite__big">${l.code}</p>
          <p class="fine"><span class="icon" aria-hidden="true">schedule</span>Expires in ${plural(days, 'day')}.</p>
          <div class="actions"><button type="button" class="btn btn--primary btn--small js-copy-invite"><span class="icon" aria-hidden="true">link</span>Copy invite link</button>
            <button type="button" class="btn btn--ghost btn--small js-new-code"><span class="icon" aria-hidden="true">refresh</span>New code</button></div>
          <p class="fine js-copy-status" aria-live="polite"></p></div>
        <figure class="invite__qr">${qrSvg(inviteLink(l.code), `QR code for an invite link with the code ${l.code}`)}<figcaption class="fine">Scan to join. Drawn right here, no outside service.</figcaption></figure></div>`;
    }
    if (house.view === 'join') {
      body = `<form class="join-form js-join-form" novalidate><label for="join-code"><strong>Enter an invite code</strong></label>
        <div class="add-row"><input id="join-code" class="text-input join-input" type="text" placeholder="YOLK-XXXX" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(house.joinCode)}">
          <button class="btn btn--primary btn--small">Join</button></div>
        <p class="fine">You’re playing someone new on their own phone. Try ${l ? `your code, ${l.code}, or ` : ''}the demo code ${DEMO_CODE}.</p>
        <p class="join-msg${house.joinErr ? ' is-error' : ''}" aria-live="polite">${esc(house.joinMsg)}</p></form>`;
    }
    return `<section class="panel" aria-labelledby="link-title">
      <h3 id="link-title">Link your household</h3>
      <p class="demo-note"><span class="icon" aria-hidden="true">science</span>Demo: real linking needs accounts. This shows how it will work.</p>
      <div class="tags" role="group" aria-label="Link your household">
        <button type="button" class="tag js-link-create" aria-pressed="${house.view === 'create'}"><span class="icon" aria-hidden="true">add_home</span>Create household</button>
        <button type="button" class="tag js-link-join" aria-pressed="${house.view === 'join'}"><span class="icon" aria-hidden="true">group_add</span>Join household</button>
      </div>${body}</section>`;
  }
  // Recent meals and the two favorites lists: ranked by ratings, then times cooked, then how recent.
  function favorites(a, mineOnly) {
    const rated = ratingsByRecipe(a);
    const counts = {};
    a.meals.forEach((m) => { const c = counts[m.r] || (counts[m.r] = { n: 0, last: 0 }); c.n += 1; c.last = Math.max(c.last, m.at); });
    return Object.entries(rated).map(([rid, faces]) => {
      const vals = mineOnly ? [faces.you].filter(Boolean) : Object.values(faces);
      if (!vals.length || !byId(rid)) return null;
      return { r: byId(rid), faces, avg: vals.reduce((x, y) => x + y, 0) / vals.length, ...counts[rid] };
    }).filter((x) => x && x.avg >= 2).sort((x, y) => y.avg - x.avg || y.n - x.n || y.last - x.last);
  }
  const facesRow = (faces) => {
    const list = Object.entries(faces || {});
    return list.length ? `<p class="faces">${list.map(([id, v]) => `<span class="face-chip">${avatar(id, 'idle', 'avatar--xs')}<span aria-hidden="true">${faceOf(v)}</span><span class="sr-only">${memberName(id)}: ${FACES.find((f) => f[0] === v)[2]}</span></span>`).join('')}</p>` : '';
  };
  const againBtns = (rid) => `<div class="recent__actions"><button type="button" class="btn btn--secondary btn--small" data-again="${rid}"><span class="icon" aria-hidden="true">replay</span>Make again</button>
    <button type="button" class="link-btn" data-hide="${rid}" aria-pressed="${prefs.hidden.includes(rid)}">${prefs.hidden.includes(rid) ? 'Hidden from suggestions. Undo' : 'Don’t suggest this again'}</button></div>`;
  function recentPanel(a, s) {
    const counts = {};
    s.meals.forEach((m) => { counts[m.r] = (counts[m.r] || 0) + 1; });
    const when = (t) => `<time datetime="${new Date(t).toISOString()}">${new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</time>`;
    let list;
    if (house.recent === 'recent') {
      const recent = [...s.meals].reverse().slice(0, 6);
      list = recent.length ? `<ul class="recent">${recent.map((m) => `<li><div class="recent__top"><strong>${byId(m.r).name}</strong>${when(m.at)}</div>
          <p class="fine">Cooked by ${memberName(m.cook)} · made ${counts[m.r]}× here</p>${facesRow(m.ratings)}${active().length > 1 ? kudosRow(m, true) : ''}${againBtns(m.r)}</li>`).join('')}</ul>`
        : '<p class="fine">Nothing cooked yet. The first meal lands here.</p>';
    } else {
      const favs = favorites(a, house.recent === 'mine');
      list = favs.length ? `<ol class="recent">${favs.map((f) => `<li><div class="recent__top"><strong>${f.r.name}</strong>${when(f.last)}</div>
          <p class="fine">Made ${f.n}× · ${house.recent === 'mine' ? `you said ${faceOf(f.faces.you)}` : `${plural(Object.keys(f.faces).length, 'rating')}`}</p>${facesRow(f.faces)}${againBtns(f.r.id)}</li>`).join('')}</ol>`
        : `<p class="fine">${house.recent === 'mine' ? 'Rate a meal 🙂 or 😍 after you cook it and it shows up here.' : 'When anyone in the house rates a meal 🙂 or 😍, it shows up here.'}</p>`;
    }
    return `<section class="panel" aria-labelledby="recent-title">
      <h3 id="recent-title">Recent meals</h3><p class="fine">No “worst meals” list. Anything rated 😕 just comes up less often.</p>
      <div class="seg seg--sm" role="group" aria-label="Show">${[['recent', 'Recent'], ['mine', 'My favorites'], ['house', 'House favorites']].map(([id, l]) => `<button type="button" data-recent="${id}" aria-pressed="${house.recent === id}">${l}</button>`).join('')}</div>
      ${list}</section>`;
  }
  function renderHouse() {
    const a = activity();
    const s = statsFor(a);
    const goal = prefs.houseGoal;
    const room = prefs.members.length < MAX_HOUSE;
    houseBox.innerHTML = `
      <div class="tab-head"><h2 class="stage__title" tabindex="-1">House</h2><p class="stage__sub">One goal for everyone, and a sticker when someone cooks something good.</p></div>
      <p class="vote-label"><span class="icon" aria-hidden="true">smartphone</span><span><strong>Demo: pass the phone.</strong> The whole house shares this one device here. In the app, everyone would join from their own phone.</span></p>
      <section class="panel" aria-labelledby="members-title">
        <div class="servings"><h3 id="members-title">Who’s in the house?</h3><span class="fine">${prefs.members.length} of ${MAX_HOUSE} spots</span></div>
        <ul class="members">${prefs.members.map(memberCard).join('')}</ul>
        ${room ? (house.guest ? `<form class="add-row js-guest-form"><label class="sr-only" for="guest-name">Their name</label><input id="guest-name" class="text-input" type="text" placeholder="Their name" maxlength="16" autocomplete="off" required><button class="btn btn--primary btn--small">Add</button><button type="button" class="btn btn--ghost btn--small js-guest-cancel">Cancel</button></form>`
          : '<button type="button" class="btn btn--secondary btn--small js-add-guest"><span class="icon" aria-hidden="true">person_add</span>Add someone without the app</button>')
          : `<p class="fine">The house is full. The kitchen fits ${MAX_HOUSE}, so the demo stops there.</p>`}
        <p class="fine members__note">Guests get a profile you look after. Members with the app edit their own.</p>
      </section>
      ${linkPanel()}
      <section class="panel share-card" aria-labelledby="share-title">
        <h3 id="share-title">What the house shares</h3>
        <div class="share-cols">
          <div><h4 class="mini-head"><span class="icon" aria-hidden="true">group</span>Shared</h4><ul>${SHARED.map((x) => `<li>${x}</li>`).join('')}</ul></div>
          <div><h4 class="mini-head"><span class="icon" aria-hidden="true">lock</span>Private by default</h4><ul>${PRIVATE.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        </div>
      </section>
      <section class="panel goal-panel" aria-labelledby="house-goal-title">
        ${ring(s.houseWeek, goal, 'House meals this week')}
        <div><h3 id="house-goal-title">House goal</h3><p class="goal-line">The house cooked ${plural(s.houseWeek, 'meal')} this week</p>
          <p class="fine">${s.houseWeek >= goal ? 'Goal hit! Everyone gets a gold star.' : s.houseWeek ? `${goal - s.houseWeek} more and the house hits ${goal}.` : 'New week, fresh start. Every meal counts, whoever cooks it.'}</p>
          <div class="count-choices" role="group" aria-label="House meals per week">${[5, 7, 10, 14].map((n) => `<button type="button" data-house-goal="${n}" aria-pressed="${n === goal}">${n}</button>`).join('')}</div></div>
      </section>
      <section class="panel house-kept" aria-labelledby="house-kept-title"><span class="icon" aria-hidden="true">savings</span>
        <div><h3 id="house-kept-title">House takeout dodged</h3><p class="house-kept__big">$${s.houseKept}</p><p class="fine">Estimate: ${plural(s.meals.length, 'meal')} × $${prefs.takeout}, everyone’s meals added together.</p></div></section>
      ${recentPanel(a, s)}`;
  }
  // Somebody new asks to join with a code: they wait until the owner approves.
  function joinWith(raw) {
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^YOLK/, 'YOLK-');
    house.joinCode = code;
    const l = liveLink();
    if (!/^YOLK-[A-Z2-9]{4}$/.test(code)) return { err: 'Codes look like YOLK- and four letters or numbers.' };
    if (code !== DEMO_CODE && !(l && l.code === code)) return { err: 'That code doesn’t match a house. Codes expire after 7 days.' };
    if (prefs.members.length >= MAX_HOUSE) return { err: `This house is full: the kitchen fits ${MAX_HOUSE}. Remove someone first.` };
    const name = JOINERS.find((n) => !prefs.members.some((m) => m.name === n)) || 'Someone';
    const m = { id: `j${Date.now().toString(36)}`, name, char: freeChar(), role: 'member', status: 'pending' };
    prefs.members.push(m);
    return { m };
  }
  houseBox.addEventListener('click', async (e) => {
    const t = e.target;
    const g = t.closest('[data-house-goal]');
    if (g) { prefs.houseGoal = Number(g.dataset.houseGoal); savePrefs(); renderHouse(); refocus(houseBox, `[data-house-goal="${prefs.houseGoal}"]`); }
    const k = t.closest('[data-kudos]');
    if (k) {
      const id = k.dataset.kudos;
      toggleKudos(k.dataset.meal, id);
      renderHouse();
      refocus(houseBox, `[data-meal="${k.dataset.meal}"][data-kudos="${id}"]`);
      yolk('happy', `${rawName(id)} left a sticker. Wholesome.`);
    }
    const rc = t.closest('[data-recent]');
    if (rc) { house.recent = rc.dataset.recent; renderHouse(); refocus(houseBox, `[data-recent="${house.recent}"]`); }
    const ag = t.closest('[data-again]');
    if (ag) makeAgain(ag.dataset.again);
    const hd = t.closest('[data-hide]');
    if (hd) {
      toggleHidden(hd.dataset.hide);
      renderHouse();
      refocus(houseBox, `[data-hide="${hd.dataset.hide}"]`);
      flash(prefs.hidden.includes(hd.dataset.hide) ? `${byId(hd.dataset.hide).name} won’t be suggested. Undo any time in Preferences.` : 'It’s back in the suggestions.');
    }
    const er = t.closest('[data-edit-restr]');
    if (er) openPrefs(`restr-${er.dataset.editRestr}`);
    // Members: approve, decline, claim a guest profile, remove, leave
    const ap = t.closest('[data-approve]');
    if (ap) { const m = member(ap.dataset.approve); m.status = 'active'; membersChanged(); renderHouse(); refocus(houseBox, `#member-${m.id}`); flash(`${m.name} joined the house!`); yolk('happy', `Welcome, ${m.name}! There’s a stool with your name on it.`); }
    const dc = t.closest('[data-decline]');
    if (dc) { const m = member(dc.dataset.decline); prefs.members = prefs.members.filter((x) => x !== m); membersChanged(); renderHouse(); refocus(houseBox, '.js-link-join'); flash(`Declined. ${m.name} isn’t added.`); }
    const cl = t.closest('[data-claim]');
    if (cl) { const m = member(cl.dataset.claim); m.role = 'member'; membersChanged(); renderHouse(); refocus(houseBox, `#member-${m.id}`); flash(`${m.name} joined with the app and claimed their profile. They edit it now.`); }
    const rm = t.closest('[data-remove], [data-leave]');
    if (rm) { house.confirm = rm.dataset.remove || 'you'; renderHouse(); refocus(houseBox, '.js-confirm-yes'); }
    if (t.closest('.js-confirm-no')) { const id = house.confirm; house.confirm = ''; renderHouse(); refocus(houseBox, id === 'you' ? '[data-leave]' : `[data-remove="${id}"]`); }
    const yes = t.closest('.js-confirm-yes');
    if (yes) {
      const id = yes.dataset.who;
      house.confirm = '';
      if (id === 'you') {
        prefs.members.filter((m) => m.id !== 'you').forEach((m) => { prefs.names[m.id] = m.name; });
        prefs.members = prefs.members.filter((m) => m.id === 'you');
        prefs.link = null;
        flash('You left the household. Your stats and collections came with you.');
      } else {
        const m = member(id);
        prefs.names[id] = m.name;
        prefs.members = prefs.members.filter((x) => x.id !== id);
        flash(`${m.name} was removed. Their stats and collections stay with them.`);
      }
      membersChanged();
      renderHouse();
      refocus(houseBox, '#members-title');
    }
    if (t.closest('.js-add-guest')) { house.guest = true; renderHouse(); refocus(houseBox, '#guest-name'); }
    if (t.closest('.js-guest-cancel')) { house.guest = false; renderHouse(); refocus(houseBox, '.js-add-guest'); }
    // Linking
    if (t.closest('.js-link-create')) {
      house.view = house.view === 'create' ? '' : 'create';
      if (house.view === 'create' && !liveLink()) { prefs.link = { code: newCode(), exp: Date.now() + 7 * DAY }; savePrefs(); }
      renderHouse();
      refocus(houseBox, house.view ? '.js-copy-invite' : '.js-link-create');
    }
    if (t.closest('.js-new-code')) { prefs.link = { code: newCode(), exp: Date.now() + 7 * DAY }; savePrefs(); renderHouse(); refocus(houseBox, '.js-new-code'); flash(`New code: ${prefs.link.code}. The old one stops working.`); }
    if (t.closest('.js-copy-invite')) {
      const status = $('.js-copy-status', houseBox);
      try { await navigator.clipboard.writeText(inviteLink(liveLink().code)); status.textContent = 'Copied. Send it to someone in your house.'; } catch (err) { status.textContent = `Couldn’t copy. The link is ${inviteLink(liveLink().code)}`; }
    }
    if (t.closest('.js-link-join')) { house.view = house.view === 'join' ? '' : 'join'; house.joinMsg = ''; renderHouse(); refocus(houseBox, house.view ? '#join-code' : '.js-link-join'); }
  });
  houseBox.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.matches('.js-guest-form')) {
      const name = e.target.querySelector('input').value.trim();
      if (!name) return;
      const m = { id: `g${Date.now().toString(36)}`, name, char: freeChar(), role: 'guest', status: 'active' };
      prefs.members.push(m);
      house.guest = false;
      membersChanged();
      renderHouse();
      refocus(houseBox, `[data-edit-restr="${m.id}"]`);
      flash(`${name} is in the house. You can set up their restrictions.`);
    }
    if (e.target.matches('.js-join-form')) {
      const res = joinWith(e.target.querySelector('input').value);
      house.joinErr = !!res.err;
      house.joinMsg = res.err || `${res.m.name} asked to join. The owner needs to approve.`;
      if (res.m) { savePrefs(); house.view = ''; house.joinMsg = ''; }
      renderHouse();
      if (res.m) { refocus(houseBox, `[data-approve="${res.m.id}"]`); flash(`${res.m.name} is waiting for approval.`); yolk('surprised', `Ooh, ${res.m.name} wants in. Approve them?`); } else refocus(houseBox, '#join-code');
    }
  });
  houseBox.addEventListener('input', (e) => {
    if (e.target.matches('[data-house-name]')) { const m = member(e.target.dataset.houseName); if (m) { m.name = e.target.value; savePrefs(); } }
  });
  houseBox.addEventListener('change', (e) => { if (e.target.matches('[data-house-name]')) { renderHouse(); renderExtras(); } });
  /* Yolkie's Kitchen: an isometric kitchen in the Me tab. You steer Yolkie; whoever else is home cooks,
     washes up, raids the fridge, eats, chats, makes coffee, waters the plant and dances at night on their own.
     Decor unlocks as you cook, finished binder sets add a bonus, friends you've met sit on the shelf and
     drop by, and your stickers go on the fridge. Ported from the Yolkies-Kitchen.html prototype. */
  const kitchen = (() => {
    const kBox = $('.js-kitchen');
    const NS = 'http://www.w3.org/2000/svg';
    const el = (id) => document.getElementById(`k-${id}`);
    const svg = el('scene');
    const RM = reduceMotion;
    const DECOR = [
      { id: 'plant', name: 'Plant', at: 1 }, { id: 'rug', name: 'Cozy rug', at: 3 }, { id: 'herbs', name: 'Herb pots', at: 5 },
      { id: 'magnets', name: 'Fridge magnets', at: 7 }, { id: 'lights', name: 'String lights', at: 10 }, { id: 'poster', name: 'Yolkie poster', at: 13 },
      { id: 'clock', name: 'Wall clock', at: 16 }, { id: 'lamp', name: 'Pendant lamp', at: 20 },
    ];
    const opts = Object.assign({ night: false, auto: true, seen: -1, home: 0, seenBonus: null }, prefs.kitchen);
    const saveOpts = () => { prefs.kitchen = opts; savePrefs(); };
    let people = [];    // the members at home, you first
    let size = 1;
    let meals = 0;      // meals cooked, or the slider's value while previewing
    let preview = null;
    let outfit = {};
    let col = collectionFor(activity());
    let fridge = [];    // stickers on the fridge door
    let picked = -1;    // the sticker last tapped on the fridge
    const has = (id) => meals >= DECOR.find((d) => d.id === id).at;
    const bonus = (id) => col.done.some((s) => s.bonus === id);
    const metFriends = () => FRIENDS.filter((f) => col.friends[f.id]);
    const CHAR_NAME = { yolk: 'Yolkie, that’s you', boiled: 'the boiled egg', scramble: 'the scrambled egg' };

    /* Geometry: tile (u, v) at height h, projected onto the SVG */
    const TW = 48, TH = 24, WALL = 200, ox = 400, oy = 236;
    let N = 6;
    const P = (u, v, h = 0) => [ox + (u - v) * TW, oy + (u + v) * TH - h];
    const pts = (a) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const poly = (a, f, x = '') => `<polygon points="${pts(a)}" fill="${f}" ${x}/>`;
    function box(u, v, w, d, h, c, z = 0) {
      const A = P(u, v, z), B = P(u + w, v, z), C = P(u + w, v + d, z), D = P(u, v + d, z);
      const At = P(u, v, z + h), Bt = P(u + w, v, z + h), Ct = P(u + w, v + d, z + h), Dt = P(u, v + d, z + h);
      return poly([B, C, Ct, Bt], c[2]) + poly([D, C, Ct, Dt], c[1]) + poly([At, Bt, Ct, Dt], c[0]);
    }
    const onRight = (u, z) => { const p = P(u, 0, z); return `matrix(0.894,0.447,0,1,${p[0]},${p[1]})`; };
    const onLeft = (v, z) => { const p = P(0, v, z); return `matrix(-0.894,0.447,0,1,${p[0]},${p[1]})`; };
    // The fridge's lower door, as a flat 48 × 100 surface: x along the door, y down from its top edge.
    const DOOR = { w: 48, h: 100 };
    const doorOrigin = () => P(0, 1, 100);
    const doorMatrix = () => { const o = doorOrigin(); return `matrix(1,0.5,0,1,${o[0]},${o[1]})`; };
    const toDoor = (p) => { const o = doorOrigin(); const x = p.x - o[0]; return { x, y: p.y - o[1] - x * 0.5 }; };
    const fridgeSticker = (f, k) => `<g class="k-sticker${k === picked ? ' is-picked' : ''}" data-fs="${k}" transform="translate(${f.x.toFixed(1)},${f.y.toFixed(1)}) rotate(${f.r})"><circle r="10" fill="transparent"/><g transform="scale(.16) translate(-50,-50)">${STICKER_BASE}${stickerById(f.s).art}</g>${k === picked ? '<circle r="9.5" fill="none" stroke="#6B4DE6" stroke-width="1.4" stroke-dasharray="3 2"/>' : ''}</g>`;
    const drawFridge = () => { const g = el('fridgeStickers'); if (g) g.innerHTML = fridge.map(fridgeSticker).join(''); };

    /* World */
    let objects = [], seats = [], spots = {}, agents = [], tablePos = null, fridgeDoor = null, lightsGlow = '';
    const blocked = new Set();
    const reserved = {};
    const tileKey = (i, j) => `${i},${j}`;
    function footprint(u, v, w, d) {
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const cu = i + 0.5, cv = j + 0.5; if (cu > u && cu < u + w && cv > v && cv < v + d) blocked.add(tileKey(i, j)); }
    }
    const addObj = (key, html, id) => objects.push({ key, html, el: null, id: id || null });

    function build() {
      N = size > 1 ? 8 : 6;
      svg.setAttribute('viewBox', `${ox - N * TW - 20} 18 ${N * TW * 2 + 40} ${oy + N * TH * 2}`);
      objects = []; blocked.clear(); seats = []; spots = {};
      Object.keys(reserved).forEach((k) => delete reserved[k]);
      // Walls, tiles, window, shelves
      let w = poly([P(0, 0), P(0, N), P(0, N, WALL), P(0, 0, WALL)], '#EEE8FA') + poly([P(0, 0), P(N, 0), P(N, 0, WALL), P(0, 0, WALL)], '#E2D9F5')
        + poly([P(0, 0), P(0, N), P(0, N, 12), P(0, 0, 12)], '#D9CFF0') + poly([P(0, 0), P(N, 0), P(N, 0, 12), P(0, 0, 12)], '#CBBFE8');
      const cEnd = N > 6 ? 6 : 5;
      for (let i = 1; i < cEnd; i++) for (let r = 0; r < 3; r++) { const z = 56 + r * 12; w += poly([P(i, 0, z), P(i + 1, 0, z), P(i + 1, 0, z + 12), P(i, 0, z + 12)], (i + r) % 2 ? '#F7F3FF' : '#EFE8FF', 'stroke="#E2D9F5" stroke-width=".8"'); }
      w += poly([P(2, 0, 96), P(4.4, 0, 96), P(4.4, 0, 178), P(2, 0, 178)], '#fff') + `<polygon id="k-sky" points="${pts([P(2.12, 0, 104), P(4.28, 0, 104), P(4.28, 0, 170), P(2.12, 0, 170)])}" fill="url(#k-skyDay)"/>`;
      w += `<g transform="${onRight(2.12, 104)}"><circle id="k-sun" cx="78" cy="-30" r="12" fill="#FFE27A"/><circle id="k-moonA" cx="78" cy="-30" r="11" fill="#FFF3C4" opacity="0"/><circle id="k-moonB" cx="84" cy="-35" r="10" fill="#2A2F66" opacity="0"/><g id="k-stars" opacity="0" fill="#fff"><circle cx="20" cy="-50" r="1.6"/><circle cx="44" cy="-20" r="1.2"/><circle cx="104" cy="-52" r="1.4"/><circle cx="96" cy="-12" r="1"/></g><path id="k-cloud" d="M14 -22 a8 8 0 0 1 14 -4 a7 7 0 0 1 12 4 z" fill="#fff" opacity=".9"/></g>`;
      const m1 = P(3.2, 0, 104), m2 = P(3.2, 0, 170);
      w += `<line x1="${m1[0]}" y1="${m1[1]}" x2="${m2[0]}" y2="${m2[1]}" stroke="#fff" stroke-width="4"/>` + poly([P(2, 0, 96), P(4.4, 0, 96), P(4.4, 0, 90), P(2, 0, 90)], '#F2ECFF');
      // Bonus from Taco Tuesday: a tiny cactus on the windowsill
      if (bonus('cactus')) { const c = P(3.9, 0.12, 100); w += box(3.78, 0.02, 0.24, 0.2, 9, ['#F2B08E', '#E09A76', '#CC8763'], 90) + `<g transform="translate(${c[0]},${c[1]})"><rect x="-5" y="-20" width="10" height="22" rx="5" fill="#4CAF6B"/><rect x="-11" y="-14" width="6" height="10" rx="3" fill="#3E9B5C"/><rect x="5" y="-17" width="6" height="9" rx="3" fill="#3E9B5C"/><circle cx="0" cy="-21" r="2.4" fill="#FF8FB1"/></g>`; }
      w += box(0, 1.6, 0.28, 1.7, 6, ['#E9C79A', '#D6B07F', '#C79E6C'], 118);
      [['#FF8A7A', 1.75, 24], ['#FFC83D', 2.15, 30], ['#9FE0BC', 2.55, 20], ['#B9A8FF', 2.9, 26]].forEach(([c, v, h]) => { w += box(0.04, v, 0.18, 0.25, h, [c, c, c], 124) + box(0.04, v, 0.18, 0.25, 4, ['#fff', '#eee', '#ddd'], 124 + h); });
      // The friends shelf: a figurine for every friend you've met. Tap one to say hi.
      const met = metFriends();
      if (met.length) {
        w += box(0, 1.5, 0.3, 1.9, 5, ['#E9C79A', '#D6B07F', '#C79E6C'], 70);
        met.forEach((f, k) => { const p = P(0.15, 1.72 + k * 0.36, 75); w += `<g class="k-fig" data-fig="${f.id}" transform="translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) scale(.085)"><rect x="-90" y="-210" width="180" height="220" fill="transparent"/>${charSVG(`kfig_${f.id}`, f.id)}</g>`; });
      }
      if (has('poster')) w += `<g transform="${onLeft(N - 2.25, 58)} scale(-1,1) translate(-58,0)"><rect x="0" y="-92" width="58" height="80" rx="4" fill="#6B4DE6"/><circle cx="29" cy="-58" r="17" fill="#FFC83D"/><circle cx="23" cy="-61" r="2.6" fill="${INK}"/><circle cx="35" cy="-61" r="2.6" fill="${INK}"/><path d="M23 -52 Q29 -46 35 -52" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/><text x="29" y="-22" text-anchor="middle" font-family="Bricolage Grotesque, DM Sans, sans-serif" font-weight="800" font-size="11" fill="#fff">YOLKIE</text></g>`;
      if (has('clock')) w += `<g transform="${onLeft(N - 0.85, 150)}"><circle r="17" fill="#fff" stroke="#6B4DE6" stroke-width="3"/><line id="k-hh" x2="0" y2="-9" stroke="#1E1A2E" stroke-width="2.6" stroke-linecap="round"/><line id="k-mh" x2="0" y2="-13" stroke="#FF8A7A" stroke-width="2" stroke-linecap="round"/></g>`;
      // Bonus from each finished cuisine set: a postcard on the corkboard
      const cards = col.done.filter((s) => s.cuisine);
      if (cards.length) {
        const CC = ['#6B4DE6', '#2E9E6A', '#FF8A7A', '#FFC83D', '#5BB3F0', '#C98AC9'];
        w += `<g transform="${onRight(4.62, 172)}"><rect width="66" height="54" rx="3" fill="#D9A86C" stroke="#B9874F" stroke-width="2"/>${cards.slice(0, 6).map((s, k) => {
          const x = 5 + (k % 3) * 20, y = 6 + Math.floor(k / 3) * 23;
          return `<g transform="translate(${x},${y}) rotate(${[-4, 3, -2, 5, -5, 2][k]} 9 8)"><rect width="18" height="16" rx="1.5" fill="#fff"/><rect x="2" y="2" width="9" height="12" fill="${CC[k % 6]}"/><rect x="12" y="2.5" width="4" height="4" fill="#FFC83D"/><circle cx="9" cy="-1" r="1.6" fill="#FF7D6B"/></g>`;
        }).join('')}</g>`;
      }
      el('walls').innerHTML = w;
      el('nightTint').setAttribute('points', pts([P(0, N, WALL), P(0, 0, WALL), P(N, 0, WALL), P(N, 0), P(N, N), P(0, N)]));
      let f = '';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) f += poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (i + j) % 2 ? '#E7E1F3' : '#F1ECF9', 'stroke="#DDD5EE" stroke-width=".6"');
      el('floor').innerHTML = f;

      // Fridge, with a door that opens while someone's at it, your stickers on it, and maybe a cookie jar on top
      footprint(0, 0, 1, 1);
      addObj(1, box(0, 0, 1, 1, 160, ['#FFFFFF', '#F1EEF8', '#E3DEEF']) + `<line x1="${P(0, 1, 100)[0]}" y1="${P(0, 1, 100)[1]}" x2="${P(1, 1, 100)[0]}" y2="${P(1, 1, 100)[1]}" stroke="#D5CFE4" stroke-width="2"/>`
        + [112, 60].map((z) => `<line x1="${P(0.82, 1, z)[0]}" y1="${P(0.82, 1, z)[1]}" x2="${P(0.82, 1, z + 28)[0]}" y2="${P(0.82, 1, z + 28)[1]}" stroke="#B8B0CC" stroke-width="4" stroke-linecap="round"/>`).join('')
        + (has('magnets') ? (() => { const a = P(0.25, 1, 118), b = P(0.55, 1, 132), c = P(0.4, 1, 74); return `<circle cx="${a[0]}" cy="${a[1]}" r="6" fill="#FF8A7A"/><rect x="${b[0] - 6}" y="${b[1] - 6}" width="12" height="12" fill="#1D5FC4" transform="rotate(-27 ${b[0]} ${b[1]})"/><path d="M${c[0]} ${c[1] - 8} L${c[0] + 7} ${c[1] + 4} L${c[0] - 7} ${c[1] + 4} Z" fill="#2E9E6A"/>`; })() : '')
        + `<g id="k-fridgeStickers" transform="${doorMatrix()}"></g>`
        + (bonus('cookies') ? box(0.28, 0.28, 0.44, 0.44, 24, ['#EAF4FF', '#D3E4F5', '#BED3EA'], 160) + box(0.25, 0.25, 0.5, 0.5, 5, ['#FF8A7A', '#E8705F', '#D45E4E'], 184) + (() => { const c = P(0.5, 0.72, 174); return `<circle cx="${c[0] - 5}" cy="${c[1]}" r="4" fill="#C98A4B"/><circle cx="${c[0] + 4}" cy="${c[1] - 3}" r="4" fill="#B5733A"/>`; })() : ''));
      addObj(1.9, poly([P(0.04, 1, 12), P(0.96, 1, 12), P(0.96, 1, 98), P(0.04, 1, 98)], '#FFF3C9') + poly([P(1, 1, 10), P(1, 1.85, 10), P(1, 1.85, 98), P(1, 1, 98)], '#F7F5FC', 'stroke="#DCD6EA" stroke-width="1.5"'), 'fridgeOpen');
      spots.fridge = { t: [0, 1], o: [0.5, 0.5], icon: '🥛' };
      // Counter: stove, sink, coffee machine (and a toaster, once Breakfast Club is done)
      const CAB = ['#FFF6E6', '#6B4DE6', '#5A3DD0'], TOP = ['#E9C79A', '#D9B585', '#C9A06E'];
      for (let i = 1; i < cEnd; i++) {
        footprint(i, 0, 1, 1);
        let h = box(i, 0, 1, 1, 50, CAB) + box(i, 0, 1, 1.06, 6, TOP, 50);
        const k = P(i + 0.5, 1, 30);
        h += `<rect x="${k[0] - 8}" y="${k[1] - 2}" width="16" height="4" rx="2" fill="#FFC83D"/>`;
        if (i === 1 && bonus('toaster')) {
          h += box(1.22, 0.28, 0.56, 0.4, 22, ['#FF9C8C', '#E8705F', '#D45E4E'], 56);
          [0.4, 0.55].forEach((v) => { const a = P(1.32, v, 78), b = P(1.68, v, 78); h += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7A3A30" stroke-width="2.4" stroke-linecap="round"/>`; });
          const t = P(1.5, 0.48, 82);
          h += `<path d="M${t[0] - 7} ${t[1]} q7 -10 14 0 z" fill="#E9B067" stroke="#C9843C" stroke-width="1"/>`;
        }
        if (i === 2) {
          h += poly([P(2.1, 0.1, 56), P(2.9, 0.1, 56), P(2.9, 0.9, 56), P(2.1, 0.9, 56)], '#2A2440');
          [[2.32, 0.32], [2.68, 0.32], [2.32, 0.68], [2.68, 0.68]].forEach(([u, v]) => { const c = P(u, v, 56); h += `<ellipse cx="${c[0]}" cy="${c[1]}" rx="11" ry="5.5" fill="none" stroke="#5B547A" stroke-width="2"/>`; });
          const pc = P(2.32, 0.68, 56);
          h += `<ellipse cx="${pc[0]}" cy="${pc[1] - 3}" rx="13" ry="6.5" fill="#3B3550"/><ellipse cx="${pc[0]}" cy="${pc[1] - 4}" rx="10" ry="4.5" fill="#FFE08A"/><circle cx="${pc[0]}" cy="${pc[1] - 4.5}" r="3" fill="#F5A623"/><line x1="${pc[0] + 12}" y1="${pc[1] - 3}" x2="${pc[0] + 30}" y2="${pc[1] + 5}" stroke="#3B3550" stroke-width="4" stroke-linecap="round"/><ellipse id="k-burner" cx="${pc[0]}" cy="${pc[1] + 1}" rx="14" ry="6" fill="#FF7A3D" opacity="0"/>`;
        }
        if (i === 4) {
          h += poly([P(4.18, 0.2, 56), P(4.82, 0.2, 56), P(4.82, 0.8, 56), P(4.18, 0.8, 56)], '#C7CCDA') + poly([P(4.25, 0.27, 56), P(4.75, 0.27, 56), P(4.75, 0.73, 56), P(4.25, 0.73, 56)], '#9EA5B8');
          const f1 = P(4.5, 0.12, 56), f2 = P(4.5, 0.12, 80), f3 = P(4.5, 0.38, 80);
          h += `<path d="M${f1[0]} ${f1[1]} L${f2[0]} ${f2[1]} L${f3[0]} ${f3[1]}" stroke="#AEB4C6" stroke-width="4" fill="none" stroke-linecap="round"/><line id="k-water" x1="${f3[0]}" y1="${f3[1]}" x2="${f3[0]}" y2="${f3[1] + 20}" stroke="#8FCBFF" stroke-width="3" opacity="0"/>`;
        }
        if (i === 5) { const c = P(5.5, 0.45, 56); h += box(5.3, 0.25, 0.4, 0.4, 30, ['#3B3550', '#2A2440', '#221D36'], 56) + `<rect x="${c[0] - 6}" y="${c[1] - 8}" width="12" height="10" rx="2" fill="#fff"/>`; }
        addObj(i + 1, h);
      }
      spots.stove = { t: [2, 1], o: [2.5, 0.5], icon: '🍳' };
      spots.sink = { t: [4, 1], o: [4.5, 0.5], icon: '🧽' };
      if (cEnd > 5) spots.coffee = { t: [5, 1], o: [5.5, 0.5], icon: '☕' };
      if (has('herbs')) {
        let hb = '';
        [[2.95, '#3E9B5C'], [3.35, '#4CAF6B'], [3.75, '#2E8A52']].forEach(([u, c]) => { hb += box(u, 0.2, 0.28, 0.28, 16, ['#F2B08E', '#E09A76', '#CC8763'], 56); const t = P(u + 0.14, 0.34, 80); hb += `<circle cx="${t[0] - 5}" cy="${t[1]}" r="7" fill="${c}"/><circle cx="${t[0] + 5}" cy="${t[1] - 2}" r="7" fill="${c}"/><circle cx="${t[0]}" cy="${t[1] - 8}" r="7" fill="${c}"/>`; });
        addObj(3.6, hb);
      }
      // Table and stools (the seats): a bigger table and four stools once there are roommates
      const T = size > 1 ? { u: 3.1, v: 3.1, w: 2.8, d: 1.8, seats: [[3, 2], [5, 2], [3, 5], [5, 5]] } : { u: 2.9, v: 2.9, w: 1.2, d: 1.2, seats: [[2, 3], [3, 4]] };
      tablePos = [T.u + T.w / 2, T.v + T.d / 2];
      footprint(T.u, T.v, T.w, T.d);
      const TBL = ['#F7F3FF', '#E3DAF7', '#D2C6F0'], LEG = ['#BFB2E6', '#AFA0DE', '#9C8CD3'];
      let th = '';
      const legs = size > 1 ? [[T.u + 0.25, T.v + 0.25], [T.u + T.w - 0.4, T.v + 0.25], [T.u + 0.25, T.v + T.d - 0.4], [T.u + T.w - 0.4, T.v + T.d - 0.4]] : [[T.u + 0.45, T.v + 0.45]];
      legs.forEach(([u, v]) => { th += box(u, v, size > 1 ? 0.15 : 0.3, size > 1 ? 0.15 : 0.3, 34, LEG); });
      th += box(T.u, T.v, T.w, T.d, 8, TBL, 34);
      const fc = P(tablePos[0], tablePos[1], 42);
      th += `<ellipse cx="${fc[0]}" cy="${fc[1]}" rx="18" ry="9" fill="#fff" stroke="#E3DAF7"/><circle cx="${fc[0] - 6}" cy="${fc[1] - 3}" r="6" fill="#FF8A7A"/><circle cx="${fc[0] + 5}" cy="${fc[1] - 4}" r="6" fill="#FFC83D"/><circle cx="${fc[0]}" cy="${fc[1] + 1}" r="5.5" fill="#9FE0BC"/>`;
      addObj(tablePos[0] + tablePos[1], th);
      const STL = ['#FFC83D', '#F2B520', '#E0A511'], SL = ['#9C8CD3', '#8A79C8', '#7766BD'];
      T.seats.forEach(([i, j]) => { seats.push([i, j]); addObj(i + j + 0.9, box(i + 0.44, j + 0.44, 0.12, 0.12, 22, SL) + box(i + 0.22, j + 0.22, 0.56, 0.56, 6, STL, 22)); });
      if (has('plant')) {
        footprint(N - 0.8, 1.2, 0.5, 0.5);
        const t = P(N - 0.55, 1.45, 30);
        addObj(N - 0.55 + 1.45, box(N - 0.8, 1.2, 0.5, 0.5, 30, ['#F2B08E', '#E09A76', '#CC8763']) + `<g transform="translate(${t[0]},${t[1]})"><ellipse cx="-14" cy="-22" rx="7" ry="20" fill="#3E9B5C" transform="rotate(-30 -14 -22)"/><ellipse cx="14" cy="-24" rx="7" ry="20" fill="#2E8A52" transform="rotate(28 14 -24)"/><ellipse cx="0" cy="-34" rx="7" ry="24" fill="#4CAF6B"/><ellipse cx="-6" cy="-14" rx="6" ry="14" fill="#2E8A52" transform="rotate(-60 -6 -14)"/></g>`);
        spots.plant = { t: [N - 1, 2], o: [N - 0.55, 1.45], icon: '💧' };
      }
      el('rug').innerHTML = has('rug') ? (() => {
        const e = 0.65;
        const a = [P(T.u - e, T.v - e), P(T.u + T.w + e, T.v - e), P(T.u + T.w + e, T.v + T.d + e), P(T.u - e, T.v + T.d + e)];
        const b = [P(T.u - e + 0.25, T.v - e + 0.25), P(T.u + T.w + e - 0.25, T.v - e + 0.25), P(T.u + T.w + e - 0.25, T.v + T.d + e - 0.25), P(T.u - e + 0.25, T.v + T.d + e - 0.25)];
        return poly(a, '#FF8A7A') + poly(b, '#FFE3D8');
      })() : '';
      // String lights and the pendant lamp
      let ov = '';
      lightsGlow = '';
      if (has('lights')) {
        const cols = ['#FFC83D', '#FF8A7A', '#9FE0BC', '#B9A8FF'], bulbs = [];
        const run = (fn) => {
          let d = '';
          const K = N * 4;
          for (let k = 0; k <= K; k++) { const t = k / K, seg = ((t * N) / 1.5) % 1, sag = Math.sin(Math.PI * seg) * 12, p = fn(t * N, WALL - 14 - sag); d += (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); if (k % 2) bulbs.push(p); }
          ov += `<path d="${d}" stroke="#7A6E99" stroke-width="1.4" fill="none"/>`;
        };
        run((x, z) => P(0, x, z));
        run((x, z) => P(x, 0, z));
        bulbs.forEach((p, i) => { ov += `<circle cx="${p[0]}" cy="${p[1] + 4}" r="4" fill="${cols[i % 4]}"/>`; });
        lightsGlow = bulbs.map((p) => `<circle cx="${p[0]}" cy="${p[1] + 4}" r="16" fill="url(#k-glow)"/>`).join('');
      }
      if (has('lamp')) { const c = P(tablePos[0], tablePos[1], 150); ov += `<line x1="${c[0]}" y1="${c[1] - 170}" x2="${c[0]}" y2="${c[1] - 26}" stroke="#7A6E99" stroke-width="2"/><path d="M${c[0] - 22} ${c[1]} L${c[0] - 10} ${c[1] - 26} L${c[0] + 10} ${c[1] - 26} L${c[0] + 22} ${c[1]} Z" fill="#FFC83D" stroke="#E0A511" stroke-width="1.5"/><ellipse cx="${c[0]}" cy="${c[1]}" rx="22" ry="5" fill="#FFF3C4"/>`; }
      el('over').innerHTML = ov;
      // The characters: whoever's home, as their kitchen character. You're always Yolkie, in the closet outfit.
      const og = el('objs');
      og.innerHTML = '';
      el('labels').innerHTML = '';
      fridgeDoor = null;
      objects.forEach((o) => { const g = document.createElementNS(NS, 'g'); g.innerHTML = o.html; o.el = g; if (o.id === 'fridgeOpen') { g.style.display = 'none'; fridgeDoor = g; } og.appendChild(g); });
      drawFridge();
      const start = size > 1 ? [[2, 2], [5, 6], [1, 4]] : [[2, 2]];
      agents = [];
      people.forEach((m, a) => addAgent({ who: m.id, type: m.char, at: start[a], acc: a === 0 ? accLayers(outfit) : '' }));
      if (visit) {
        const t = [Math.floor(visit.u), Math.floor(visit.v)];
        const okTile = t[0] < N && t[1] < N && !blocked.has(tileKey(t[0], t[1])) && !isSeat(t[0], t[1]);
        addAgent({ who: '', type: visit.f.id, name: visit.f.name, visitor: true, at: okTile ? t : door() });
      }
      applyNight();
      drawLabels();
    }
    function addAgent({ who, type, at, acc = '', name = '', visitor = false }) {
      const a = agents.length;
      const id = visitor ? 'kvis' : `kag${a}`;
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = charSVG(id, type, acc);
      g.dataset.agent = a;
      el('objs').appendChild(g);
      const lb = document.createElementNS(NS, 'g');
      lb.dataset.agent = a;
      el('labels').appendChild(lb);
      const ag = { i: a, who, name, visitor, id, type, top: BODIES[type](id).top, el: g, lb, u: at[0] + 0.5, v: at[1] + 0.5, path: [], step: null, face: 1, act: null, actT: 0, wait: 1 + a * 1.3, happy: 0, jump: 0, say: '', sayT: 0, seat: false, partner: null, manual: 0, fade: visitor ? 0 : 1 };
      agents.push(ag);
      return ag;
    }
    const nameOf = (a) => a.name || rawName(a.who);

    /* Paths: breadth-first over free tiles; seats only as a destination */
    const isSeat = (i, j) => seats.some((s) => s[0] === i && s[1] === j);
    const occupied = (i, j, except) => agents.some((a) => a !== except && ((Math.floor(a.u) === i && Math.floor(a.v) === j && !a.step) || (a.path.length && a.path[a.path.length - 1][0] === i && a.path[a.path.length - 1][1] === j)));
    function bfs(s, t) {
      const K = (a) => `${a[0]},${a[1]}`;
      const q = [s], prev = { [K(s)]: null };
      while (q.length) {
        const c = q.shift();
        if (c[0] === t[0] && c[1] === t[1]) break;
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = [c[0] + du, c[1] + dv], k = K(n);
          if (n[0] < 0 || n[1] < 0 || n[0] >= N || n[1] >= N || k in prev) continue;
          const isT = n[0] === t[0] && n[1] === t[1];
          if (blocked.has(k) || (isSeat(n[0], n[1]) && !isT)) continue;
          prev[k] = c;
          q.push(n);
        }
      }
      if (!(K(t) in prev)) return null;
      const p = [];
      let c = t;
      while (c) { p.unshift(c); c = prev[K(c)]; }
      return p.slice(1);
    }
    function walkTo(a, t) {
      const s = [Math.floor(a.u), Math.floor(a.v)];
      if (s[0] === t[0] && s[1] === t[1]) { a.path = []; return true; }
      const p = bfs(s, t);
      if (!p) return false;
      a.path = p;
      a.seat = false;
      return true;
    }
    function freeTiles() {
      const f = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!blocked.has(tileKey(i, j)) && !isSeat(i, j)) f.push([i, j]);
      return f;
    }
    // Visitors come and go by the front corner of the room.
    const door = () => [N - 1, N - 1];

    /* What everyone does on their own */
    function pickActivity(a) {
      const choices = [];
      const add = (n, w) => choices.push([n, w]);
      if (spots.stove && !reserved.stove && !a.visitor) add('stove', 3);
      if (spots.sink && !reserved.sink && !a.visitor) add('sink', 2);
      if (spots.fridge && !reserved.fridge) add('fridge', 2);
      if (spots.coffee && !reserved.coffee) add('coffee', 1.5);
      if (spots.plant && !reserved.plant) add('plant', 1.2);
      if (seats.some((s) => !reserved[`seat${s}`])) add('eat', 3);
      if (agents.length > 1 && agents.some((b) => b !== a && !b.act && !b.path.length && !b.partner && !b.leaving)) add('chat', a.visitor ? 4 : 2.5);
      if (has('lights') && opts.night) add('dance', 1.5);
      add('wander', 2);
      let r = Math.random() * choices.reduce((s, o) => s + o[1], 0);
      for (const [n, w] of choices) if ((r -= w) <= 0) return n;
      return 'wander';
    }
    const release = (a) => Object.keys(reserved).forEach((k) => { if (reserved[k] === a) delete reserved[k]; });
    function startPlan(a) {
      release(a);
      const kind = pickActivity(a);
      a.plan = null;
      if (['stove', 'sink', 'fridge', 'coffee', 'plant'].includes(kind)) {
        const sp = spots[kind];
        if (occupied(sp.t[0], sp.t[1], a)) return;
        reserved[kind] = a;
        if (walkTo(a, sp.t)) a.plan = { kind, obj: sp.o }; else release(a);
        return;
      }
      if (kind === 'eat') {
        const free = seats.filter((s) => !reserved[`seat${s}`] && !occupied(s[0], s[1], a));
        if (!free.length) return;
        const s = free[Math.floor(Math.random() * free.length)];
        reserved[`seat${s}`] = a;
        if (walkTo(a, s)) a.plan = { kind: 'eat', obj: tablePos, seat: true }; else release(a);
        return;
      }
      if (kind === 'chat') {
        const others2 = agents.filter((b) => b !== a && !b.act && !b.path.length && !b.partner && b.manual <= 0 && !b.leaving);
        if (!others2.length) return;
        const b = others2[Math.floor(Math.random() * others2.length)];
        const bt = [Math.floor(b.u), Math.floor(b.v)];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => [bt[0] + x, bt[1] + y]).filter(([i, j]) => i >= 0 && j >= 0 && i < N && j < N && !blocked.has(tileKey(i, j)) && !isSeat(i, j) && !occupied(i, j, a));
        if (!nb.length) return;
        if (walkTo(a, nb[0])) { a.plan = { kind: 'chat', partner: b }; b.partner = a; b.wait = 99; }
        return;
      }
      if (kind === 'dance') {
        const f = freeTiles().filter(([i, j]) => Math.abs(i + 0.5 - tablePos[0]) < 3 && Math.abs(j + 0.5 - tablePos[1]) < 3 && !occupied(i, j, a));
        if (f.length && walkTo(a, f[Math.floor(Math.random() * f.length)])) a.plan = { kind: 'dance' };
        return;
      }
      const f = freeTiles().filter(([i, j]) => !occupied(i, j, a));
      if (f.length) walkTo(a, f[Math.floor(Math.random() * f.length)]);
      a.plan = { kind: 'wander' };
    }
    const LINES = { chat: ['haha', '…', 'no way!', '♥', 'same', 'lol'], tap: ['Hi!', 'Hungry?', 'Let’s cook!', 'Egg-cellent.'], visit: ['Hiii!', 'Smells good!', 'Just visiting!', 'Snacks?'] };
    function beginAct(a) {
      const p = a.plan;
      a.plan = null;
      if (!p) return;
      if (p.kind === 'wander') { a.wait = 1.5 + Math.random() * 3; return; }
      a.act = p.kind;
      a.actT = 0;
      a.actDur = p.kind === 'chat' ? 5 : p.kind === 'eat' ? 6 : 4.5 + Math.random() * 2;
      if (p.obj) { const ax = P(a.u, a.v)[0], bx = P(p.obj[0], p.obj[1])[0]; if (Math.abs(bx - ax) > 2) a.face = bx > ax ? 1 : -1; }
      a.seat = !!p.seat;
      if (p.kind === 'chat') {
        const b = p.partner;
        a.partner = b; b.partner = a; b.act = 'chat'; b.actT = 0; b.actDur = a.actDur; b.path = [];
        const ax = P(a.u, a.v)[0], bx = P(b.u, b.v)[0];
        a.face = bx > ax ? 1 : -1;
        b.face = -a.face;
        a.say = LINES.chat[0];
        a.sayT = 1.2;
      }
      if (p.kind === 'stove') { a.say = 'sizzle'; a.sayT = 1.4; }
    }
    function endAct(a) {
      if (a.act === 'chat' && a.partner) { const b = a.partner; b.act = null; b.partner = null; b.wait = 1 + Math.random() * 2; a.partner = null; }
      a.act = null;
      a.wait = 1.5 + Math.random() * 3;
      release(a);
      if (a.seat) {
        a.seat = false;
        const f = freeTiles().filter(([i, j]) => !occupied(i, j, a)).sort((x, y) => Math.hypot(x[0] - a.u, x[1] - a.v) - Math.hypot(y[0] - a.u, y[1] - a.v));
        if (f.length) walkTo(a, f[0]);
      }
    }

    /* Friend visits: every so often a friend you've met wanders in for a while, then heads off. */
    let visit = null;   // { f, until, u, v } while a friend is over
    let nextVisit = 6;
    function startVisit(f) {
      if (visit) return false;
      visit = { f, until: clock + (RM ? 30 : 24), u: N - 0.5, v: N - 0.5 };
      const a = addAgent({ who: '', type: f.id, name: f.name, visitor: true, at: door() });
      a.say = LINES.visit[Math.floor(Math.random() * LINES.visit.length)];
      a.sayT = 2;
      a.wait = 1;
      drawLabels();
      toast(`${f.name} dropped by!`);
      return true;
    }
    function endVisit(a) {
      a.el.remove();
      a.lb.remove();
      release(a);
      agents.forEach((b) => { if (b.partner === a) { b.partner = null; b.act = null; b.wait = 1; } });
      agents = agents.filter((b) => b !== a);
      visit = null;
      nextVisit = clock + 35 + Math.random() * 25;
    }

    /* Steam, bubbles, hearts and notes */
    let parts = [];
    function emit(kind, x, y) {
      if (RM && Math.random() < 0.7) return;
      if (kind === 'steam') parts.push({ k: 'c', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 6, vy: -22, life: 1.6, t: 0, r: 4, c: '#FFFFFF', grow: 6, op: 0.75 });
      if (kind === 'bubble') parts.push({ k: 'o', x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 8, vy: -18, life: 1.4, t: 0, r: 2.5 + Math.random() * 3, c: '#8FCBFF', grow: 1, op: 0.9 });
      if (kind === 'cold') parts.push({ k: 'c', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 40, vx: 0, vy: -6, life: 1, t: 0, r: 2, c: '#BFE6FF', grow: 0, op: 0.9 });
      if (kind === 'heart') parts.push({ k: 't', s: '♥', x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 10, vy: -24, life: 1.4, t: 0, c: '#FF7D6B', fs: 12, op: 1 });
      if (kind === 'note') parts.push({ k: 't', s: Math.random() < 0.5 ? '♪' : '♫', x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 14, vy: -26, life: 1.5, t: 0, c: '#6B4DE6', fs: 14, op: 1 });
      if (kind === 'drop') parts.push({ k: 'd', x: x + (Math.random() - 0.5) * 6, y, vx: 4, vy: 30, life: 0.7, t: 0, c: '#5BB3F0', op: 1 });
      if (kind === 'crumb') parts.push({ k: 'c', x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.6, t: 0, r: 1.6, c: '#E9A44C', grow: 0, op: 1, g: 60 });
      if (kind === 'spark') for (let i = 0; i < 14; i++) { const an = (i / 14) * Math.PI * 2; parts.push({ k: 'c', x, y, vx: Math.cos(an) * 110, vy: Math.sin(an) * 70 - 30, life: 0.9, t: 0, r: 4, c: ['#FFC83D', '#6B4DE6', '#2E9E6A', '#FF8A7A'][i % 4], grow: 0, op: 1 }); }
    }
    function drawParts(dt) {
      let s = '';
      parts = parts.filter((p) => (p.t += dt) < p.life);
      parts.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.g) p.vy += p.g * dt;
        const k = p.t / p.life, o = (p.op * (1 - k)).toFixed(2);
        if (p.k === 'c') s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.r + p.grow * k).toFixed(1)}" fill="${p.c}" opacity="${o}"/>`;
        else if (p.k === 'o') s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="none" stroke="${p.c}" stroke-width="1.4" opacity="${o}"/>`;
        else if (p.k === 'd') s += `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="1.8" ry="3" fill="${p.c}" opacity="${o}"/>`;
        else s += `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-size="${p.fs}" font-weight="700" fill="${p.c}" opacity="${o}" text-anchor="middle">${p.s}</text>`;
      });
      el('fx').innerHTML = s;
    }

    /* Name tags: the house members' names. Yours is plum, because you steer Yolkie; visiting friends get yolk. */
    function drawLabels() {
      agents.forEach((a) => {
        const name = nameOf(a);
        const mine = a.who === 'you';
        const w = Math.max(44, name.length * 7.2 + (a.visitor ? 34 : 24));
        const fill = mine ? '#6B4DE6' : a.visitor ? '#FFC83D' : '#FFFFFF';
        a.lb.innerHTML = `<g><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11" fill="${fill}" stroke="${mine ? '#6B4DE6' : a.visitor ? '#E0A511' : '#E3DEEF'}" stroke-width="1.5"/><text y="4.5" text-anchor="middle" font-family="DM Sans, system-ui, sans-serif" font-size="12" font-weight="700" fill="${mine ? '#fff' : '#1E1A2E'}">${a.visitor ? '★ ' : ''}${esc(name)}</text></g>
          <g class="ic" style="display:none"><circle cx="${w / 2 + 14}" cy="0" r="13" fill="#fff" stroke="#E3DEEF" stroke-width="1.5"/><text class="ict" x="${w / 2 + 14}" y="5" text-anchor="middle" font-size="14"></text></g>
          <g class="say" style="display:none"><rect class="sr" x="-30" y="-46" width="60" height="24" rx="12" fill="#fff" stroke="#E3DEEF" stroke-width="1.5"/><path d="M-5 -23 L0 -15 L5 -23 Z" fill="#fff"/><text class="st" y="-29.5" text-anchor="middle" font-family="DM Sans, system-ui, sans-serif" font-size="12" font-weight="700" fill="#1E1A2E"></text></g>`;
      });
    }

    /* Controls under the scene */
    let toastT;
    function toast(m) {
      const t = el('toast');
      t.textContent = m;
      t.classList.add('is-on');
      clearTimeout(toastT);
      toastT = setTimeout(() => t.classList.remove('is-on'), m.length > 40 ? 4200 : 2200);
    }
    function applyNight() {
      const night = opts.night;
      $('.js-k-night').setAttribute('aria-pressed', String(night));
      el('nightTint').setAttribute('opacity', night ? 0.36 : 0);
      el('sky').setAttribute('fill', night ? 'url(#k-skyNight)' : 'url(#k-skyDay)');
      ['sun', 'cloud'].forEach((i) => el(i).setAttribute('opacity', night ? 0 : i === 'cloud' ? 0.9 : 1));
      ['moonA', 'moonB', 'stars'].forEach((i) => el(i).setAttribute('opacity', night ? 1 : 0));
      let gl = '';
      if (night) {
        gl += lightsGlow;
        if (has('lamp')) { const c = P(tablePos[0], tablePos[1], 150); gl += `<ellipse cx="${c[0]}" cy="${c[1] + 70}" rx="120" ry="84" fill="url(#k-cone)"/>`; }
        const w = P(3.2, 0, 135);
        gl += `<ellipse cx="${w[0]}" cy="${w[1]}" rx="70" ry="50" fill="url(#k-glow)" opacity=".25"/>`;
      }
      el('glows').innerHTML = gl;
    }
    const BONUS_DECOR = [['toaster', 'Toaster', 'Breakfast Club'], ['cookies', 'Cookie jar', 'Midnight Snacks'], ['cactus', 'Tiny cactus', 'Taco Tuesday']];
    function renderControls() {
      const all = active();
      $('.js-k-sizes').innerHTML = all.map((m, k) => {
        const n = k + 1;
        const label = n === 1 ? 'Just you' : n === all.length && n > 2 ? 'Everyone' : `You & ${rawName(all[1].id)}`;
        return `<button type="button" class="tag${size === n ? ' is-on' : ''}" data-k-size="${n}" aria-pressed="${size === n}">${esc(label)}</button>`;
      }).join('');
      const names = $('.js-k-names');
      if (!names.contains(document.activeElement)) {
        names.innerHTML = people.map((m) => `<label>Name tag · ${CHAR_NAME[m.char]}<input class="text-input" type="text" data-k-name="${m.id}" value="${memberName(m.id)}" maxlength="16" autocomplete="off"></label>`).join('');
      }
      const sample = sampleOn();
      const sliding = sample || opts.tester;
      $('.js-k-count').textContent = meals;
      $('.js-k-count-label').textContent = sample ? 'Meals cooked (sample preview)' : opts.tester ? 'Meals cooked (tester preview)' : 'Meals cooked';
      $('.js-k-tester').checked = !!opts.tester;
      $('.js-k-slider-row').hidden = !sliding;
      if (sliding) $('.js-k-slider').value = Math.min(20, meals);
      $('.js-k-hint').textContent = sample
        ? 'Sample data is on, so you can slide to preview how the kitchen fills in.'
        : opts.tester
          ? 'Slide to preview the kitchen at any number of meals. It’s only a preview: your real stats don’t change.'
          : 'The kitchen fills in as you cook. Every meal you finish in cook mode counts.';
      const postcards = col.done.filter((s) => s.cuisine).length;
      $('.js-k-decor').innerHTML = DECOR.map((d) => {
        const open = meals >= d.at;
        return `<li class="decor-item${open ? ' is-open' : ''}"><strong>${d.name}</strong><small>${open ? 'Unlocked' : `Cook ${plural(d.at - meals, 'more meal')}`}</small></li>`;
      }).join('') + BONUS_DECOR.map(([id, name, set]) => `<li class="decor-item decor-item--bonus${bonus(id) ? ' is-open' : ''}"><strong>${name}</strong><small>${bonus(id) ? `Bonus: ${set}` : `Finish ${set} in your binder`}</small></li>`).join('')
        + `<li class="decor-item decor-item--bonus${postcards ? ' is-open' : ''}"><strong>Postcards</strong><small>${postcards ? `${postcards} of ${CUISINES.length} cuisines` : 'Finish a cuisine set'}</small></li>`;
      $('.js-k-auto').setAttribute('aria-pressed', String(opts.auto));
      $('.js-k-night').setAttribute('aria-pressed', String(opts.night));
      const met = metFriends();
      $('.js-k-visit').hidden = !met.length;
      $('.js-k-friends').textContent = met.length ? `On the shelf: ${listText(met.map((f) => f.name))}. Tap one to say hi.` : 'Friends you meet by cooking sit on the shelf here, and drop by now and then.';
      renderTray();
    }
    // The sticker tray: drag one onto the fridge, or tap it to stick it on. Stickers on the fridge can be dragged around.
    function renderTray() {
      const a = activity();
      const owned = Object.keys(a.stickers).filter((id) => a.stickers[id] > 0 && stickerById(id));
      const on = new Set(fridge.map((f) => f.s));
      const tray = owned.filter((id) => !on.has(id));
      $('.js-k-tray').innerHTML = owned.length
        ? `${tray.length ? `<div class="tray" role="group" aria-label="Your stickers">${tray.map((id) => `<button type="button" class="tray-sticker" data-tray="${id}" aria-label="Stick ${esc(stickerById(id).name)} on the fridge">${stickerSvg(id)}</button>`).join('')}</div>` : '<p class="fine">Every sticker you have is on the fridge.</p>'}
          ${fridge.length ? `<ul class="on-fridge">${fridge.map((f, k) => `<li class="${k === picked ? 'is-picked' : ''}">${stickerSvg(f.s)}<span>${esc(stickerById(f.s).name)}</span>
            <button type="button" class="icon-btn icon-btn--sm" data-k-rot="${k}" data-d="-8" aria-label="Turn ${esc(stickerById(f.s).name)} left"><span class="icon" aria-hidden="true">rotate_left</span></button>
            <button type="button" class="icon-btn icon-btn--sm" data-k-rot="${k}" data-d="8" aria-label="Turn ${esc(stickerById(f.s).name)} right"><span class="icon" aria-hidden="true">rotate_right</span></button>
            <button type="button" class="icon-btn icon-btn--sm" data-k-off="${k}" aria-label="Take ${esc(stickerById(f.s).name)} off the fridge"><span class="icon" aria-hidden="true">close</span></button></li>`).join('')}</ul>` : ''}`
        : '<p class="fine">No stickers yet. Fun moments earn them: your first breakfast, a fridge rescue, cooking after 11 PM…</p>';
    }

    // Who's in the kitchen, how many meals, what Yolkie is wearing, the collection and the fridge, all from the rest of the demo.
    function sync() {
      const a = activity();
      const real = statsFor(a).cooked;
      if (!sampleOn() && !opts.tester) preview = null;
      meals = preview == null ? real : preview;
      const all = active();
      people = all.slice(0, opts.home && opts.home <= all.length ? opts.home : all.length);
      size = people.length;
      outfit = worn();
      col = collectionFor(a);
      fridge = a.fridge;
      if (picked >= fridge.length) picked = -1;
      return real;
    }
    function celebrate(names) {
      toast(`New for the kitchen: ${names[names.length - 1]}!`);
      agents.forEach((a) => { a.happy = 1.6; a.jump = RM ? 0 : 0.45; });
      const c = P(agents[0].u, agents[0].v, 60);
      emit('spark', c[0], c[1]);
    }
    function saveFridge() {
      const a = activity();
      a.fridge = fridge;
      saveActivity(a);
    }
    // A free-ish spot on the door for a tapped sticker.
    function freeSpot() {
      const spotsList = [[14, 18], [34, 22], [16, 46], [34, 52], [14, 76], [34, 82], [24, 34], [24, 66]];
      return spotsList.find(([x, y]) => !fridge.some((f) => Math.hypot(f.x - x, f.y - y) < 12)) || [24, 50];
    }
    function stick(id, x, y) {
      fridge.push({ s: id, x: Math.min(DOOR.w - 8, Math.max(8, x)), y: Math.min(DOOR.h - 8, Math.max(8, y)), r: Math.round(Math.random() * 20 - 10) });
      picked = fridge.length - 1;
      saveFridge();
      drawFridge();
      renderTray();
      toast(`${stickerById(id).name}, on the fridge!`);
    }

    /* Tap the floor to walk Yolkie; tap anyone to say hi; tap a figurine to meet them; drag stickers on the fridge */
    function toSvg(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      const st = e.target.closest && e.target.closest('[data-fs]');
      if (st) {
        const k = Number(st.dataset.fs);
        picked = k;
        drag = { k, moved: false };
        svg.setPointerCapture(e.pointerId);
        drawFridge();
        renderTray();
        e.preventDefault();
        return;
      }
      const fig = e.target.closest && e.target.closest('[data-fig]');
      if (fig) { const f = FRIENDS.find((x) => x.id === fig.dataset.fig); toast(`${f.name}: ${f.bio}`); return; }
      const hit = e.target.closest && e.target.closest('[data-agent]');
      if (hit) {
        const a = agents[Number(hit.dataset.agent)];
        if (a) { a.happy = 1.4; a.jump = RM ? 0 : 0.45; a.say = (a.visitor ? LINES.visit : LINES.tap)[Math.floor(Math.random() * 4)]; a.sayT = 1.6; if (a.visitor) toast(`${a.name}: ${FRIENDS.find((f) => f.id === a.type).bio}`); }
        return;
      }
      const p = toSvg(e), A = (p.x - ox) / TW, B = (p.y - oy) / TH, u = Math.floor((A + B) / 2), v = Math.floor((B - A) / 2);
      if (u < 0 || v < 0 || u >= N || v >= N) return;
      const me = agents[0];
      if (blocked.has(tileKey(u, v))) { toast(`${nameOf(me)} can’t stand there`); return; }
      if (me.act) endAct(me);
      release(me);
      me.plan = null;
      if (isSeat(u, v)) { reserved[`seat${[u, v]}`] = me; if (walkTo(me, [u, v])) me.plan = { kind: 'eat', obj: tablePos, seat: true }; me.manual = 8; return; }
      if (!walkTo(me, [u, v])) toast('No path there');
      me.manual = 8;
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const d = toDoor(toSvg(e));
      const f = fridge[drag.k];
      f.x = Math.min(DOOR.w - 8, Math.max(8, d.x));
      f.y = Math.min(DOOR.h - 8, Math.max(8, d.y));
      drag.moved = true;
      drawFridge();
    });
    const endDrag = () => { if (!drag) return; if (drag.moved) saveFridge(); drag = null; };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    // Dragging from the tray: a copy follows your finger, and lands where you let go, if that's the fridge door.
    kBox.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-tray]');
      if (!b) return;
      e.preventDefault();
      const id = b.dataset.tray;
      const ghost = document.createElement('div');
      ghost.className = 'sticker-ghost';
      ghost.innerHTML = stickerSvg(id);
      document.body.appendChild(ghost);
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const move = (ev) => { moved = moved || Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6; ghost.style.transform = `translate(${ev.clientX - 22}px, ${ev.clientY - 22}px)`; };
      move(e);
      const up = (ev) => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        ghost.remove();
        if (!moved) { const [x, y] = freeSpot(); stick(id, x, y); return; }
        const d = toDoor(toSvg(ev));
        if (d.x > -6 && d.x < DOOR.w + 6 && d.y > -6 && d.y < DOOR.h + 6) stick(id, d.x, d.y);
        else toast('Drop it on the fridge door');
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
    kBox.addEventListener('keydown', (e) => {
      const b = e.target.closest('[data-tray]');
      if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const [x, y] = freeSpot(); stick(b.dataset.tray, x, y); const next = $('[data-tray]', kBox); if (next) next.focus(); }
    });
    kBox.addEventListener('click', (e) => {
      const s = e.target.closest('[data-k-size]');
      if (s) {
        opts.home = Number(s.dataset.kSize);
        saveOpts();
        sync();
        build();
        renderControls();
        $(`[data-k-size="${size}"]`).focus();
        toast(size > 1 ? 'The kitchen got bigger!' : 'Just you and the kitchen');
      }
      const rot = e.target.closest('[data-k-rot]');
      if (rot) { const k = Number(rot.dataset.kRot); fridge[k].r = Math.max(-24, Math.min(24, fridge[k].r + Number(rot.dataset.d))); picked = k; saveFridge(); drawFridge(); renderTray(); $(`[data-k-rot="${k}"][data-d="${rot.dataset.d}"]`).focus(); }
      const off = e.target.closest('[data-k-off]');
      if (off) { const f = fridge.splice(Number(off.dataset.kOff), 1)[0]; picked = -1; saveFridge(); drawFridge(); renderTray(); toast(`${stickerById(f.s).name}, back in the book`); const next = $('[data-tray]', kBox); if (next) next.focus(); }
      if (e.target.closest('.js-k-visit')) {
        const met = metFriends();
        if (visit) toast(`${visit.f.name} is already here`);
        else startVisit(met[Math.floor(Math.random() * met.length)]);
      }
      if (e.target.closest('.js-k-night')) { opts.night = !opts.night; saveOpts(); applyNight(); }
      if (e.target.closest('.js-k-auto')) { opts.auto = !opts.auto; saveOpts(); renderControls(); }
      if (e.target.closest('.js-k-closet')) { showMeView('progress'); const c = document.getElementById('closet'); c.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }
    });
    // Tester preview: the slider without loading the sample week. Turning it off goes back to the real count.
    kBox.addEventListener('change', (e) => {
      if (!e.target.matches('.js-k-tester')) return;
      opts.tester = e.target.checked;
      if (!opts.tester) preview = null;
      saveOpts();
      sync();
      build();
      renderControls();
    });
    kBox.addEventListener('input', (e) => {
      if (e.target.matches('[data-k-name]')) {
        const m = member(e.target.dataset.kName);
        if (m) { m.name = e.target.value; savePrefs(); }
        drawLabels();
      }
      if (e.target.matches('.js-k-slider')) {
        const prev = meals;
        preview = Number(e.target.value);
        meals = preview;
        const nw = DECOR.filter((d) => d.at > prev && d.at <= meals);
        const keep = agents.map((a) => [a.u, a.v]);
        build();
        agents.forEach((a, i) => { if (!keep[i]) return; const t = [Math.floor(keep[i][0]), Math.floor(keep[i][1])]; if (!blocked.has(tileKey(t[0], t[1])) && !isSeat(t[0], t[1])) { a.u = keep[i][0]; a.v = keep[i][1]; } });
        renderControls();
        if (nw.length) celebrate(nw.map((d) => d.name));
      }
    });

    /* Animation loop: runs only while the kitchen is on screen */
    let running = false, last = 0, clock = 0;
    const onScreen = () => !kBox.hidden && !kBox.closest('[role="tabpanel"]').hidden;
    function frame(now) {
      if (!onScreen()) { running = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      let cooking = false, washing = false, fridgeOn = false;
      // A friend drops by now and then, if you've met any and everyone's doing their own thing.
      if (!visit && opts.auto && clock > nextVisit) {
        const met = metFriends();
        if (met.length) startVisit(met[Math.floor(Math.random() * met.length)]); else nextVisit = clock + 10;
      }
      agents.forEach((a) => {
        if (a.visitor) {
          a.fade = Math.min(1, a.fade + dt * 2);
          if (!a.leaving && clock > visit.until) {
            if (a.act) endAct(a);
            release(a);
            a.plan = null;
            a.leaving = true;
            a.say = 'Bye!';
            a.sayT = 1.4;
            if (!walkTo(a, door())) a.path = [];
          }
          if (a.leaving && !a.step && !a.path.length) a.gone = (a.gone || 0) + dt * 2;
          visit.u = a.u;
          visit.v = a.v;
        }
        if (a.manual > 0) a.manual -= dt;
        if (!a.step && a.path.length) {
          const n = a.path.shift();
          a.step = { fu: a.u, fv: a.v, tu: n[0] + 0.5, tv: n[1] + 0.5, t: 0 };
          const sx = P(n[0] + 0.5, n[1] + 0.5)[0] - P(a.u, a.v)[0];
          if (Math.abs(sx) > 1) a.face = sx > 0 ? 1 : -1;
        }
        a.hop = 0;
        a.sq = 0;
        if (a.step) {
          const s = a.step;
          s.t += dt / (RM ? 0.2 : 0.3);
          const p = Math.min(1, s.t);
          a.u = s.fu + (s.tu - s.fu) * p;
          a.v = s.fv + (s.tv - s.fv) * p;
          a.hop = RM ? 0 : Math.sin(Math.PI * p) * 8;
          a.sq = Math.sin(Math.PI * p);
          if (p >= 1) { a.step = null; if (!a.path.length && a.plan) beginAct(a); }
        }
        if (a.act) {
          a.actT += dt;
          const c = P(a.u, a.v, 40);
          if (a.act === 'stove') { cooking = true; if (Math.random() < dt * 7) { const pc = P(2.32, 0.68, 64); emit('steam', pc[0], pc[1]); } }
          if (a.act === 'sink') { washing = true; if (Math.random() < dt * 8) { const sc = P(4.5, 0.5, 60); emit('bubble', sc[0], sc[1]); } }
          if (a.act === 'fridge') { fridgeOn = true; if (Math.random() < dt * 6) { const fc = P(0.5, 1, 70); emit('cold', fc[0], fc[1]); } }
          if (a.act === 'eat') { if (Math.random() < dt * 1.6) emit('heart', c[0], c[1] - 50); if (Math.random() < dt * 3) emit('crumb', c[0] + a.face * 14, c[1] - 10); }
          if (a.act === 'dance' && Math.random() < dt * 2.5) emit('note', c[0], c[1] - 60);
          if (a.act === 'plant' && Math.random() < dt * 10) emit('drop', c[0] + a.face * 26, c[1] - 6);
          if (a.act === 'coffee' && Math.random() < dt * 4) { const cc = P(5.5, 0.45, 94); emit('steam', cc[0], cc[1]); }
          if (a.act === 'chat' && a.partner && a.sayT <= 0 && a.i < a.partner.i) {
            const talker = Math.random() < 0.5 ? a : a.partner;
            talker.say = LINES.chat[Math.floor(Math.random() * LINES.chat.length)];
            talker.sayT = 1.1;
            (talker === a ? a.partner : a).sayT = 0;
            a.sayT = a.sayT || 0.01;
          }
          if (a.actT >= a.actDur && !(a.act === 'chat' && a.partner && a.i > a.partner.i)) endAct(a);
        } else if (!a.step && !a.path.length && !a.partner && opts.auto && a.manual <= 0 && !a.leaving) {
          a.wait -= dt;
          if (a.wait <= 0) { a.wait = 2; startPlan(a); }
        }
        if (a.jump > 0) a.jump -= dt;
        if (a.happy > 0) a.happy -= dt;
        if (a.sayT > 0) a.sayT -= dt;
      });
      const gone = agents.find((a) => a.visitor && a.gone >= 1);
      if (gone) endVisit(gone);
      if (fridgeDoor) fridgeDoor.style.display = fridgeOn ? '' : 'none';
      const burner = el('burner');
      if (burner) burner.setAttribute('opacity', cooking ? 0.55 + Math.sin(clock * 20) * 0.2 : 0);
      const water = el('water');
      if (water) water.setAttribute('opacity', washing ? 0.9 : 0);
      const headWorn = !!outfit.head;
      agents.forEach((a) => {
        const id = a.id;
        const part = (n) => document.getElementById(`${id}_${n}`);
        const isHappy = a.happy > 0 || a.act === 'dance' || (a.act === 'eat' && Math.sin(clock * 2 + a.i) > 0.6) || (a.visitor && a.sayT > 0);
        let jy = 0;
        if (a.jump > 0) { const p = 1 - a.jump / 0.45; jy = Math.sin(Math.PI * Math.max(0, Math.min(1, p))) * 24; }
        const ph = (clock + a.i * 1.1) % 3.1, bl = ph < 0.12 ? Math.abs(Math.cos((ph / 0.12) * Math.PI)) : 1;
        part('eO').style.display = isHappy ? 'none' : '';
        part('eH').style.display = isHappy ? '' : 'none';
        part('eO').setAttribute('transform', `translate(0,-90) scale(1,${bl}) translate(0,90)`);
        const talking = a.sayT > 0 && a.act === 'chat';
        const open = talking && Math.sin(clock * 18) > 0;
        part('mS').style.display = !isHappy && !open ? '' : 'none';
        part('mB').style.display = isHappy && !open ? '' : 'none';
        part('mO').style.display = open ? '' : 'none';
        let aL = 0, aR = 0, rot = 0, bob = 0;
        const t = clock;
        if (a.step) { aL = Math.sin(t * 18) * 18; aR = -aL; }
        if (a.happy > 0) aL = -120 + Math.sin(t * 14) * 20;
        switch (a.act) {
          case 'stove': aR = -40 + Math.sin(t * 9) * 28; break;
          case 'sink': aL = -30 + Math.sin(t * 12) * 22; aR = -30 - Math.sin(t * 12) * 22; break;
          case 'fridge': aR = -105; break;
          case 'eat': aR = -50 + Math.max(0, Math.sin(t * 4)) * -40; bob = Math.abs(Math.sin(t * 4)) * 2; break;
          case 'chat': aL = Math.sin(t * 6 + a.i) * 25; aR = Math.sin(t * 5 + a.i) * -20; break;
          case 'dance': rot = Math.sin(t * 6 + a.i) * 9; bob = Math.abs(Math.sin(t * 6 + a.i)) * 10; aL = -120 + Math.sin(t * 12) * 30; aR = -120 - Math.sin(t * 12) * 30; break;
          case 'plant': aR = -70; break;
          case 'coffee': aR = -60 + Math.sin(t * 2) * 10; break;
          default: break;
        }
        if (RM) { rot = 0; bob = 0; }
        part('aL').setAttribute('transform', `rotate(${aL} -60 -72)`);
        part('aR').setAttribute('transform', `rotate(${aR} 60 -72)`);
        const br = RM ? 0 : Math.sin(t * 2.4 + a.i) * 0.02;
        part('all').setAttribute('transform', `scale(${1 + a.sq * 0.05},${1 - a.sq * 0.06 + br})`);
        const seatZ = a.seat && !a.step ? 26 : 0;
        const p = P(a.u, a.v, seatZ);
        const s = (size > 1 ? 0.38 : 0.36) * (a.visitor ? 0.86 : 1);
        a.sx = p[0];
        a.sy = p[1] - a.hop - jy - bob;
        a.el.setAttribute('transform', `translate(${a.sx.toFixed(1)},${a.sy.toFixed(1)}) rotate(${rot}) scale(${s * a.face},${s})`);
        const op = a.visitor ? Math.max(0, Math.min(a.fade, 1 - (a.gone || 0))).toFixed(2) : '1';
        a.el.setAttribute('opacity', op);
        a.lb.setAttribute('opacity', op);
        a.key = a.u + a.v + (seatZ ? 1 : 0.02);
        const topY = a.sy + a.top * s - (a.who === 'you' && headWorn ? 46 * s : 0) - 14;
        a.lb.setAttribute('transform', `translate(${a.sx.toFixed(1)},${topY.toFixed(1)})`);
        const ic = a.lb.querySelector('.ic');
        const icon = a.act && spots[a.act] ? spots[a.act].icon : a.act === 'eat' ? '😋' : a.act === 'dance' ? '🎵' : null;
        if (ic) { ic.style.display = icon ? '' : 'none'; if (icon) a.lb.querySelector('.ict').textContent = icon; }
        const say = a.lb.querySelector('.say');
        if (say) {
          const on = a.sayT > 0 && a.say;
          say.style.display = on ? '' : 'none';
          if (on) {
            const st = a.lb.querySelector('.st');
            if (st.textContent !== a.say) { st.textContent = a.say; const w = Math.max(40, a.say.length * 7 + 20); const r = a.lb.querySelector('.sr'); r.setAttribute('x', -w / 2); r.setAttribute('width', w); }
          }
        }
      });
      // Back to front, so whoever is nearer covers whoever is behind
      const og = el('objs');
      objects.map((o) => ({ k: o.key, el: o.el })).concat(agents.map((a) => ({ k: a.key, el: a.el }))).sort((x, y) => x.k - y.k).forEach((x) => og.appendChild(x.el));
      const mh = el('mh'), hh = el('hh');
      if (mh) { const d = new Date(); mh.setAttribute('transform', `rotate(${d.getMinutes() * 6})`); hh.setAttribute('transform', `rotate(${(d.getHours() % 12) * 30 + d.getMinutes() / 2})`); }
      drawParts(dt);
      requestAnimationFrame(frame);
    }

    return {
      // Called whenever the Kitchen view appears, or the data behind it changes while it's open.
      show() {
        const real = sync();
        build();
        renderControls();
        if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
        // New decor since you last looked: celebrate it once (real meals only, not the sample).
        if (!sampleOn()) {
          const nw = DECOR.filter((d) => d.at > opts.seen && d.at <= real).map((d) => d.name);
          const bonusNow = col.done.map((s) => s.bonus);
          if (opts.seenBonus) nw.push(...col.done.filter((s) => !opts.seenBonus.includes(s.bonus)).map((s) => s.bonusName));
          if (opts.seen >= 0 && nw.length) setTimeout(() => celebrate(nw), 400);
          if (opts.seen !== real || String(opts.seenBonus) !== String(bonusNow)) { opts.seen = real; opts.seenBonus = bonusNow; saveOpts(); }
        }
      },
      isOpen: onScreen,
    };
  })();
  // Me has two views: Progress and the Kitchen.
  function showMeView(view, focus = false) {
    prefs.meView = view;
    savePrefs();
    $$('[data-me-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.meView === view)));
    meBox.hidden = view !== 'progress';
    $('.js-kitchen').hidden = view !== 'kitchen';
    if (view === 'kitchen') kitchen.show(); else renderMe();
    if (focus) $(view === 'kitchen' ? '.js-kitchen .stage__title' : '.js-me .stage__title').focus({ preventScroll: true });
  }
  $$('[data-me-view]').forEach((b) => b.addEventListener('click', () => {
    showMeView(b.dataset.meView);
    yolk('happy', b.dataset.meView === 'kitchen' ? 'Welcome to the kitchen. Tap the floor and I’ll walk there.' : 'Your progress. It only goes up from here.');
  }));

  /* Collection: recipe cards and the binder, fridge stickers, friend figurines, the Pantry-dex, and
     gifting duplicates. All of it is earned by cooking: nothing is sold, nothing comes in random packs,
     rarity comes from effort, and it's private to you (gifts only go to people in the house). */
  const colBox = $('.js-collection');
  const COL_VIEWS = [['binder', 'Binder', 'style'], ['stickers', 'Stickers', 'kitchen'], ['friends', 'Friends', 'diversity_1'], ['pantry', 'Pantry-dex', 'menu_book'], ['swap', 'Swap & gift', 'redeem']];
  const colState = { set: 'all', picked: -1 };
  const giftable = () => others().filter((m) => m.role !== 'guest');
  function showColView(view, focus = false) {
    prefs.colView = view;
    savePrefs();
    renderCollection();
    if (focus) { const b = $(`[data-col-view="${view}"]`, colBox); if (b) b.focus(); }
  }
  function renderCollection() {
    const a = activity();
    const col = collectionFor(a);
    const view = COL_VIEWS.some((v) => v[0] === prefs.colView) ? prefs.colView : 'binder';
    const body = { binder: binderView, stickers: stickersView, friends: friendsView, pantry: pantryView, swap: swapView }[view](a, col);
    colBox.innerHTML = `
      <div class="tab-head"><h2 class="stage__title" tabindex="-1">Collection</h2>
        <p class="stage__sub">Earned by cooking and trying things. Nothing’s for sale, there are no random packs, and it’s private to you${sampleOn() ? '. Right now it’s the sample week' : ''}.</p></div>
      <div class="col-nav" role="group" aria-label="Collection sections">${COL_VIEWS.map(([id, label, icon]) => `<button type="button" class="tag" data-col-view="${id}" aria-pressed="${id === view}"><span class="icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div>
      ${body}`;
  }

  // 11. Recipe cards in a binder, grouped into sets.
  function binderView(a, col) {
    const got = Object.keys(col.cards).length;
    const mastered = Object.values(col.cards).filter((c) => c.n >= MASTER_AT).length;
    const set = SETS.find((x) => x.id === colState.set);
    const ids = set ? set.ids : RECIPES.map((r) => r.id);
    const order = ['breakfast', 'lunch', 'dinner', 'snack'];
    const list = ids.map(byId).sort((x, y) => (set ? 0 : order.indexOf(x.meal) - order.indexOf(y.meal)));
    const chip = (id, label, n, total, done) => `<button type="button" class="tag tag--set${done ? ' is-done' : ''}" data-set="${id}" aria-pressed="${colState.set === id}">${done ? '<span class="icon" aria-hidden="true">check_circle</span>' : ''}${esc(label)} <small>${n}/${total}</small></button>`;
    const info = col.sets.find((x) => x.id === colState.set);
    return `
      <section class="panel" aria-labelledby="binder-title">
        <div class="servings"><h3 id="binder-title">Binder</h3><span class="fine">${got} of ${RECIPES.length} cards · ${mastered} mastered</span></div>
        <p class="fine">Finish a recipe in cook mode and its card drops in. Cook it ${MASTER_AT} times and it turns foil.</p>
        <ul class="gem-key">${[1, 2, 3].map((k) => `<li>${gemSvg(k)}<span><strong>${RARITY[k].name}</strong> ${['', 'Quick recipes', 'Longer recipes, or your first of a cuisine', 'The whole house ate together'][k]}</span></li>`).join('')}</ul>
        <h4 class="mini-head">Sets</h4>
        <div class="tags set-tags">${chip('all', 'All cards', got, RECIPES.length, false)}${col.sets.map((x) => chip(x.id, x.name, x.got, x.ids.length, x.got === x.ids.length)).join('')}</div>
        ${info ? `<p class="set-line${info.got === info.ids.length ? ' is-done' : ''}">${info.got === info.ids.length ? `<span class="icon" aria-hidden="true">auto_awesome</span>Complete! Bonus in the kitchen: ${esc(info.bonusName)}.` : `${info.got} of ${info.ids.length}. Finish the set for a kitchen bonus: ${esc(info.bonusName)}.`}</p>` : ''}
        <div class="binder">${list.map((r) => cardHtml(r, col.cards[r.id])).join('')}</div>
      </section>`;
  }

  // 12. Sticker book and the fridge door
  const owned = (a) => Object.keys(a.stickers).filter((id) => a.stickers[id] > 0 && stickerById(id));
  function stickerCell(a, st) {
    const n = a.stickers[st.id] || 0;
    const from = a.stickerFrom[st.id];
    return `<li class="sticker${n ? '' : ' is-missing'}">${stickerSvg(st.id)}${n > 1 ? `<span class="sticker__count" aria-label="${n} copies">×${n}</span>` : ''}
      <strong>${n ? st.name : '???'}</strong><small>${st.how}</small>${from ? `<span class="sticker__from">From ${memberName(from)}</span>` : ''}</li>`;
  }
  function doorHtml(a) {
    return `<div class="fridge-door js-door" role="group" aria-label="Fridge door. Drag stickers to move them.">
      <span class="fridge-door__handle" aria-hidden="true"></span>
      ${a.fridge.map((f, k) => `<button type="button" class="door-sticker${k === colState.picked ? ' is-picked' : ''}" data-door="${k}" style="left:${(f.x / 48) * 100}%;top:${f.y}%;--r:${f.r}deg" aria-label="${esc(stickerById(f.s).name)} on the fridge. Arrow keys move it.">${stickerSvg(f.s)}</button>`).join('')}
    </div>`;
  }
  function stickersView(a) {
    const have = owned(a);
    const on = new Set(a.fridge.map((f) => f.s));
    const tray = have.filter((id) => !on.has(id));
    const pick = a.fridge[colState.picked];
    const now = seasonOf(Date.now());
    return `
      <section class="panel" aria-labelledby="book-title">
        <div class="servings"><h3 id="book-title">Sticker book</h3><span class="fine">${have.length} of ${ALL_STICKERS.length}</span></div>
        <p class="fine">Fun moments earn stickers. The same moment again gives you a duplicate to gift or turn into crumbs.</p>
        <ul class="sticker-book">${STICKERS.map((st) => stickerCell(a, st)).join('')}</ul>
        ${SEASONS.map((s) => `<h4 class="mini-head season-head">${s.name} <span class="season-tag${now && now.id === s.id ? ' is-now' : ''}">${now && now.id === s.id ? 'On now' : s.back}</span></h4>
          <p class="fine">A seasonal set. It comes back every year, so nobody misses out for good.</p>
          <ul class="sticker-book">${s.stickers.map((st) => stickerCell(a, st)).join('')}</ul>`).join('')}
      </section>
      <section class="panel" aria-labelledby="door-title">
        <h3 id="door-title">The fridge</h3>
        <p class="fine">Drag a sticker onto the door, or tap it to stick it on. Drag to move, and the same stickers show up on the fridge in Yolkie’s Kitchen.</p>
        <div class="fridge-wrap">${doorHtml(a)}
          <div class="fridge-side">
            ${have.length ? (tray.length ? `<div class="tray" role="group" aria-label="Stickers to put on the fridge">${tray.map((id) => `<button type="button" class="tray-sticker" data-door-add="${id}" aria-label="Stick ${esc(stickerById(id).name)} on the fridge">${stickerSvg(id)}</button>`).join('')}</div>` : '<p class="fine">Every sticker you have is on the fridge.</p>')
              : '<p class="fine">Earn a sticker and it shows up here.</p>'}
            ${pick ? `<div class="door-tools" role="group" aria-label="${esc(stickerById(pick.s).name)}"><p><strong>${esc(stickerById(pick.s).name)}</strong></p>
              <button type="button" class="icon-btn icon-btn--sm js-door-rot" data-d="-8" aria-label="Turn it left"><span class="icon" aria-hidden="true">rotate_left</span></button>
              <button type="button" class="icon-btn icon-btn--sm js-door-rot" data-d="8" aria-label="Turn it right"><span class="icon" aria-hidden="true">rotate_right</span></button>
              <button type="button" class="btn btn--ghost btn--small js-door-off">Take it off</button></div>` : ''}
          </div>
        </div>
      </section>`;
  }

  // 13. Friend figurines
  function friendsView(a, col) {
    const met = FRIENDS.filter((f) => col.friends[f.id]).length;
    return `
      <section class="panel" aria-labelledby="friends-title">
        <div class="servings"><h3 id="friends-title">Friends</h3><span class="fine">${met} of ${FRIENDS.length} met</span></div>
        <p class="fine">Cook something with their favourite ingredient to meet them. Friends sit on the kitchen shelf and drop by now and then.</p>
        <ul class="friends">${FRIENDS.map((f) => {
          const got = col.friends[f.id];
          return `<li class="friend${got ? '' : ' is-locked'}">${charArt(f.id, 'friend__art')}
            <div><strong>${got ? f.name : '???'}</strong>
            <p class="fine">${got ? f.bio : `Cook ${f.what} to meet them.`}</p>
            ${got ? `<p class="friend__met">Met ${new Date(got.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, over ${esc(byId(got.r).name)}</p>` : ''}</div></li>`;
        }).join('')}</ul>
      </section>`;
  }

  // 14. Pantry-dex
  function pantryView(a, col) {
    const found = PANTRY.filter((p) => col.pantry[p.id]).length;
    const rare = PANTRY.filter((p) => p.rare);
    return `
      <section class="panel" aria-labelledby="dex-title">
        <div class="servings"><h3 id="dex-title">Pantry-dex</h3><span class="fine">${found} of ${PANTRY.length} found · rare finds ${rare.filter((p) => col.pantry[p.id]).length} of ${rare.length}</span></div>
        <p class="fine">Every ingredient you cook with gets an entry. Sparkly ones are rare finds: ${esc(listText(rare.map((p) => lower(p.name))))}.</p>
        <ol class="dex">${PANTRY.map((p, k) => {
          const e = col.pantry[p.id];
          return `<li class="dex-entry${e ? '' : ' is-locked'}${p.rare ? ' is-rare' : ''}"><span class="dex-entry__num">#${String(k + 1).padStart(3, '0')}</span>${pantryArt(p)}
            <strong>${e ? p.name : '???'}</strong>${e ? `<small class="dex-entry__used">Used ${e.n}×</small><p class="dex-entry__fact">${p.fact}</p>` : `<small>${p.rare ? 'A rare find' : 'Not found yet'}</small>`}${p.rare && e ? '<span class="sr-only">Rare find.</span>' : ''}</li>`;
        }).join('')}</ol>
      </section>`;
  }

  // 15. Duplicates: gift them to someone in the house, or turn them into crumbs to pick a missing sticker.
  function swapView(a) {
    const dups = owned(a).filter((id) => a.stickers[id] > 1);
    const missing = ALL_STICKERS.filter((st) => !a.stickers[st.id]);
    const to = giftable();
    return `
      <section class="panel" aria-labelledby="dups-title">
        <div class="servings"><h3 id="dups-title">Duplicates</h3><span class="crumbs"><span class="icon" aria-hidden="true">bakery_dining</span>${plural(a.crumbs, 'crumb')}</span></div>
        <p class="fine">Gift a spare to someone in the house, or turn it into crumbs. Gifts stay inside the household: no marketplace, no money.</p>
        ${dups.length ? `<ul class="dups">${dups.map((id) => `<li class="dup">${stickerSvg(id)}<div class="dup__body"><strong>${stickerById(id).name}</strong><small>${plural(a.stickers[id] - 1, 'spare')}</small>
            <div class="dup__actions">${to.length ? to.map((m) => `<button type="button" class="btn btn--secondary btn--small" data-gift="${id}" data-to="${m.id}"><span class="icon" aria-hidden="true">redeem</span>Gift to ${memberName(m.id)}</button>`).join('') : ''}
              <button type="button" class="btn btn--ghost btn--small" data-crumb="${id}">Turn into ${plural(CRUMBS_PER_DUP, 'crumb')}</button></div>
            ${!to.length ? '<p class="fine">Gifts need someone in the house with the app.</p>' : ''}</div></li>`).join('')}</ul>`
          : '<p class="fine">No spares yet. Earn the same sticker twice and the extra lands here.</p>'}
      </section>
      <section class="panel" aria-labelledby="crumbs-title">
        <h3 id="crumbs-title">Pick any sticker</h3>
        <p class="fine">${CRUMBS_TO_PICK} crumbs buys the exact sticker you’re missing, so nobody gets stuck chasing the last one. Crumbs only come from spares.</p>
        ${missing.length ? `<ul class="pick-stickers">${missing.map((st) => `<li>${stickerSvg(st.id)}<span><strong>${st.name}</strong><small>${st.season ? `${SEASONS.find((s) => s.id === st.season).name} · ` : ''}${st.how}</small></span>
            <button type="button" class="btn btn--secondary btn--small" data-pick="${st.id}"${a.crumbs < CRUMBS_TO_PICK ? ' disabled' : ''}>Pick for ${CRUMBS_TO_PICK}</button></li>`).join('')}</ul>`
          : '<p class="fine">You have every sticker. Wow.</p>'}
      </section>
      ${a.gifts.length ? `<section class="panel" aria-labelledby="gifts-title"><h3 id="gifts-title">Gifts you’ve given</h3><ul class="gift-log">${[...a.gifts].reverse().slice(0, 6).map((g) => `<li>${stickerSvg(g.s)}<span>${esc(stickerById(g.s).name)} to ${memberName(g.to)}</span><time datetime="${new Date(g.at).toISOString()}">${new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>`).join('')}</ul></section>` : ''}`;
  }

  /* The fridge door in the Collection: the same placements as the kitchen fridge (48 × 100 units). */
  function saveDoor(fn) {
    const a = activity();
    fn(a);
    saveActivity(a);
    renderCollection();
  }
  function addToDoor(id, x, y) {
    saveDoor((a) => {
      const spot = [[14, 18], [34, 22], [16, 46], [34, 52], [14, 76], [34, 82], [24, 34], [24, 66]].find(([sx, sy]) => !a.fridge.some((f) => Math.hypot(f.x - sx, f.y - sy) < 12)) || [24, 50];
      a.fridge.push({ s: id, x: x == null ? spot[0] : Math.min(40, Math.max(8, x)), y: y == null ? spot[1] : Math.min(92, Math.max(8, y)), r: Math.round(Math.random() * 20 - 10) });
      colState.picked = a.fridge.length - 1;
    });
    yolk('happy', `${stickerById(id).name}, on the fridge. Very decorated.`);
  }
  const doorPoint = (door, ev) => { const r = door.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * 48, y: ((ev.clientY - r.top) / r.height) * 100, inside: ev.clientX >= r.left - 8 && ev.clientX <= r.right + 8 && ev.clientY >= r.top - 8 && ev.clientY <= r.bottom + 8 }; };
  colBox.addEventListener('pointerdown', (e) => {
    const onDoor = e.target.closest('[data-door]');
    const fromTray = e.target.closest('[data-door-add]');
    if (!onDoor && !fromTray) return;
    e.preventDefault();
    const door = $('.js-door', colBox);
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    let ghost = null;
    const k = onDoor ? Number(onDoor.dataset.door) : -1;
    if (fromTray) { ghost = document.createElement('div'); ghost.className = 'sticker-ghost sticker-ghost--big'; ghost.innerHTML = stickerSvg(fromTray.dataset.doorAdd); document.body.appendChild(ghost); }
    const move = (ev) => {
      moved = moved || Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6;
      if (ghost) { ghost.style.transform = `translate(${ev.clientX - 34}px, ${ev.clientY - 34}px)`; return; }
      if (!moved) return;
      const p = doorPoint(door, ev);
      onDoor.style.left = `${(Math.min(40, Math.max(8, p.x)) / 48) * 100}%`;
      onDoor.style.top = `${Math.min(92, Math.max(8, p.y))}%`;
    };
    move(e);
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (ghost) ghost.remove();
      const p = doorPoint(door, ev);
      if (fromTray) {
        if (!moved) addToDoor(fromTray.dataset.doorAdd);
        else if (p.inside) addToDoor(fromTray.dataset.doorAdd, p.x, p.y);
        return;
      }
      if (moved) saveDoor((a) => { a.fridge[k].x = Math.min(40, Math.max(8, p.x)); a.fridge[k].y = Math.min(92, Math.max(8, p.y)); colState.picked = k; });
      else { colState.picked = colState.picked === k ? -1 : k; renderCollection(); }
      const again = $(`[data-door="${k}"]`, colBox);
      if (again) again.focus();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
  colBox.addEventListener('keydown', (e) => {
    const onDoor = e.target.closest('[data-door]');
    const fromTray = e.target.closest('[data-door-add]');
    if (fromTray && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addToDoor(fromTray.dataset.doorAdd); const b = $(`[data-door="${colState.picked}"]`, colBox); if (b) b.focus(); return; }
    if (!onDoor) return;
    const k = Number(onDoor.dataset.door);
    const d = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
    if (d) { e.preventDefault(); saveDoor((a) => { const f = a.fridge[k]; f.x = Math.min(40, Math.max(8, f.x + d[0])); f.y = Math.min(92, Math.max(8, f.y + d[1])); colState.picked = k; }); $(`[data-door="${k}"]`, colBox).focus(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); colState.picked = k; $('.js-door-off', colBox).click(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); colState.picked = k; renderCollection(); $(`[data-door="${k}"]`, colBox).focus(); }
  });
  colBox.addEventListener('click', (e) => {
    const t = e.target;
    const v = t.closest('[data-col-view]');
    if (v) { colState.picked = -1; showColView(v.dataset.colView, true); }
    const st = t.closest('[data-set]');
    if (st) { colState.set = st.dataset.set; renderCollection(); refocus(colBox, `[data-set="${colState.set}"]`); }
    const rot = t.closest('.js-door-rot');
    if (rot) { saveDoor((a) => { const f = a.fridge[colState.picked]; f.r = Math.max(-24, Math.min(24, f.r + Number(rot.dataset.d))); }); refocus(colBox, `.js-door-rot[data-d="${rot.dataset.d}"]`); }
    if (t.closest('.js-door-off')) {
      const a = activity();
      const f = a.fridge[colState.picked];
      saveDoor((x) => { x.fridge.splice(colState.picked, 1); colState.picked = -1; });
      if (f) yolk('default', `${stickerById(f.s).name}, back in the book.`);
      refocus(colBox, '[data-door-add]');
    }
    const cr = t.closest('[data-crumb]');
    if (cr) {
      const id = cr.dataset.crumb;
      saveDoor((a) => { a.stickers[id] -= 1; a.crumbs += CRUMBS_PER_DUP; });
      yolk('happy', `Crumbs! You have ${plural(activity().crumbs, 'crumb')}.`);
      refocus(colBox, `[data-crumb="${id}"]`) || refocus(colBox, '#dups-title');
    }
    const pk = t.closest('[data-pick]');
    if (pk) {
      const id = pk.dataset.pick;
      saveDoor((a) => { if (a.crumbs < CRUMBS_TO_PICK) return; a.crumbs -= CRUMBS_TO_PICK; a.stickers[id] = 1; });
      yolk('happy', `${stickerById(id).name}, yours. Picked with crumbs, not luck.`);
      refocus(colBox, '#crumbs-title');
    }
    const g = t.closest('[data-gift]');
    if (g) openGift(g.dataset.gift, g.dataset.to);
  });

  /* Gifting, on one phone: pass it over, they unwrap it, and it lands in their sticker book. */
  const giftSheet = $('.js-gift');
  let gift = null;
  function openGift(id, to) {
    gift = { id, to, open: false };
    renderGift();
    openSheet(giftSheet);
    $('.js-gift-open', giftSheet).focus();
  }
  function renderGift() {
    const st = stickerById(gift.id);
    $('.js-gift-body').innerHTML = gift.open
      ? `<div class="gift is-open${reduceMotion ? '' : ' is-opening'}">
          <div class="gift__box" aria-hidden="true"><span class="gift__lid"></span><span class="gift__base"></span></div>
          <div class="gift__prize">${stickerSvg(gift.id)}<span class="gift__tag">From ${memberName('you')}</span></div>
        </div>
        <h3 class="gift__title" tabindex="-1">${esc(st.name)}, for ${memberName(gift.to)}!</h3>
        <p class="fine">It’s in ${memberName(gift.to)}’s sticker book now. Sticker books are private, so only ${memberName(gift.to)} sees it there.</p>
        <div class="sheet-actions"><button type="button" class="btn btn--primary js-close">Pass the phone back</button></div>`
      : `<div class="gift"><div class="gift__box" aria-hidden="true"><span class="gift__lid"></span><span class="gift__base"></span></div></div>
        <h3 class="gift__title">Pass the phone to ${memberName(gift.to)}.</h3>
        <p class="fine">A wrapped sticker from ${memberName('you')}. No peeking, everyone else.</p>
        <div class="sheet-actions"><button type="button" class="btn btn--primary js-gift-open">I’m ${memberName(gift.to)}. Open it</button><button type="button" class="btn btn--ghost js-close">Not now</button></div>`;
  }
  giftSheet.addEventListener('click', (e) => {
    if (!e.target.closest('.js-gift-open') || !gift || gift.open) return;
    const a = activity();
    if ((a.stickers[gift.id] || 0) < 2) { closeSheet(giftSheet); return; }
    a.stickers[gift.id] -= 1;
    a.gifts.push({ s: gift.id, to: gift.to, at: Date.now() });
    saveActivity(a);
    gift.open = true;
    renderGift();
    $('.gift__title', giftSheet).focus();
    yolk('happy', `${rawName(gift.to)} got a ${stickerById(gift.id).name} sticker. Sharing is caring.`, { celebrate: true });
  });
  giftSheet.addEventListener('close', () => { if (prefs.tab === 'collection') renderCollection(); });

  /* Preferences sheet: diets, dislikes, allergies, the household's restrictions, nutrition, reminders,
     what Yolkie remembers, hidden meals, takeout and sample data */
  const prefsSheet = $('.js-prefs-sheet');
  const prefsBody = $('.js-prefs-body');
  let resetArmed = false;
  // Each person edits their own restrictions; you edit guests'. On one phone, that means passing it over.
  const canEdit = (m) => m.id === 'you' || m.role === 'guest' || state.editing === m.id;
  const keepSwitch = (id, a, on) => `<label class="switch switch--sm"><input type="checkbox" data-keep="${id}" data-a="${esc(a)}"${on ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Keep ${esc(allergyWord(a))} out of the house, even when ${id === 'you' ? 'you’re' : `${memberName(id)}’s`} not eating</label>`;
  function restrCard(m) {
    const r = restrOf(m.id);
    const head = `<div class="restr-card__head">${avatar(m.id, 'idle', 'avatar--sm')}<div><strong>${memberName(m.id)}</strong><small>${m.id === 'you' ? 'You' : m.role === 'guest' ? 'Guest: you look after this profile' : 'Member: edits their own'}</small></div></div>`;
    if (m.id === 'you') {
      return `<div class="restr-card" id="restr-you">${head}<p class="fine">Your diet, “never show me” list and allergies are set above.${r.keepOut.length ? ` You keep ${esc(listText(r.keepOut.map(allergyWord)))} out of the house.` : ''}</p></div>`;
    }
    if (!canEdit(m)) {
      return `<div class="restr-card" id="restr-${m.id}">${head}<p class="fine">${esc(restrSummary(m.id))}</p>
        <button type="button" class="btn btn--secondary btn--small" data-pass="${m.id}"><span class="icon" aria-hidden="true">smartphone</span>Pass the phone to ${memberName(m.id)} to edit</button></div>`;
    }
    const custom = r.allergies.filter((x) => !ALLERGENS.some((a) => a.id === x));
    return `<div class="restr-card is-editing" id="restr-${m.id}">${head}
      ${state.editing === m.id ? `<p class="editing-note"><span class="icon" aria-hidden="true">edit</span>${memberName(m.id)} is editing. <button type="button" class="link-btn" data-pass-back="${m.id}">Done, pass it back</button></p>` : ''}
      <h4 class="mini-head">Diet</h4><div class="tags">${DIETS.map((d) => tag(`rd-${m.id}`, d.id, d.label, r.diets.includes(d.id))).join('')}</div>
      <h4 class="mini-head">Allergies</h4><div class="tags">${ALLERGENS.map((a) => tag(`ra-${m.id}`, a.id, a.label, r.allergies.includes(a.id))).join('')}${custom.map((x) => tag(`ra-${m.id}`, x, x, true)).join('')}</div>
      ${r.allergies.length ? `<div class="keep-list">${r.allergies.map((a) => keepSwitch(m.id, a, r.keepOut.includes(a))).join('')}</div>` : ''}
      <h4 class="mini-head">Not a fan of</h4><p class="fine">These push a recipe down the list when ${memberName(m.id)} is eating. They never hide it.</p>
      <div class="tags">${r.dislikes.map((t) => `<button type="button" class="tag is-on" data-mdislike-rm="${m.id}" data-t="${esc(t)}"><span class="sr-only">Remove </span>${esc(t)}<span class="icon" aria-hidden="true">close</span></button>`).join('')}
        ${DISLIKE_IDEAS.filter((t) => !r.dislikes.includes(t)).map((t) => `<button type="button" class="tag tag--add" data-mdislike-add="${m.id}" data-t="${t}"><span class="icon" aria-hidden="true">add</span>${t}</button>`).join('')}</div>
    </div>`;
  }
  function renderPrefs() {
    const sec = (title, body, id = '') => `<section class="sheet-sec"${id ? ` id="${id}"` : ''}><h3>${title}</h3>${body}</section>`;
    const customAllergies = prefs.allergies.filter((x) => !ALLERGENS.some((a) => a.id === x));
    const today = prefs.notToday === dayKey();
    const mem = freshMem();
    prefsBody.innerHTML =
      sec('Diet', `<p class="fine">Recipes have to match every diet you turn on, whenever you’re eating.</p>
        <div class="tags">${DIETS.map((d) => tag('diet', d.id, d.label, prefs.diets.includes(d.id))).join('')}</div>`)
      + sec('Never show me', `<p class="fine">Recipes with these are left out.</p>
        <div class="tags">${prefs.dislikes.length ? prefs.dislikes.map((t) => `<button type="button" class="tag is-on" data-undislike="${esc(t)}"><span class="sr-only">Remove </span>${esc(t)}<span class="icon" aria-hidden="true">close</span></button>`).join('') : '<span class="fine">Nothing yet.</span>'}</div>
        <div class="tags">${DISLIKE_IDEAS.filter((t) => !prefs.dislikes.includes(t)).map((t) => `<button type="button" class="tag tag--add" data-dislike="${t}"><span class="icon" aria-hidden="true">add</span>${t}</button>`).join('')}</div>
        <form class="add-row js-add-dislike"><label class="sr-only" for="dislike-input">Add something to never show</label><input id="dislike-input" class="text-input" type="text" placeholder="Add an ingredient" maxlength="30" autocomplete="off"><button class="btn btn--secondary btn--small">Add</button></form>`)
      + sec('Allergies', `<p class="allergy-note"><span class="icon" aria-hidden="true">info</span>We filter recipes, but always check labels.</p>
        <p class="fine">Strict filters: when you’re eating, a recipe with any of these never shows up. Keep one out of the house and it’s filtered out of every suggestion, even when you’re not eating.</p>
        <div class="tags">${ALLERGENS.map((a) => tag('allergy', a.id, a.label, prefs.allergies.includes(a.id))).join('')}${customAllergies.map((x) => tag('allergy', x, x, true)).join('')}</div>
        ${prefs.allergies.length ? `<div class="keep-list">${prefs.allergies.map((a) => keepSwitch('you', a, prefs.keepOut.includes(a))).join('')}</div>` : ''}
        <form class="add-row js-add-allergy"><label class="sr-only" for="allergy-input">Add another allergy</label><input id="allergy-input" class="text-input" type="text" placeholder="Another allergy, like mustard" maxlength="30" autocomplete="off"><button class="btn btn--secondary btn--small">Add</button></form>`)
      + sec('Household restrictions', `<p class="fine">Suggestions and house votes work for everyone eating: all their diets and allergies together. Dislikes only move a recipe down.${sampleOn() ? ' Right now these are the sample week’s.' : ''}</p>
        ${active().map(restrCard).join('')}`, 'prefs-house')
      + sec('Nutrition', `<label class="switch"><input type="checkbox" class="js-nutri-hide"${nutritionOn() ? '' : ' checked'}><span class="switch__track" aria-hidden="true"></span>Hide nutrition</label>
        <p class="fine">Hides every calorie, protein and nutrition number, here and on the home page.</p>`)
      + sec('Check-in reminders', `<p class="fine">Preview: real reminders arrive in the app. Your check-in times are private to you.</p>
        ${['breakfast', 'lunch', 'dinner'].map((k) => `<div class="remind-row"><label class="switch"><input type="checkbox" data-remind="${k}"${prefs.reminders[k].on ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Remind me before ${k}</label>
          <label class="time-field"><span class="sr-only">${cap(k)} reminder time</span><input class="time-input" type="time" data-remind-time="${k}" value="${prefs.reminders[k].time}"></label></div>`).join('')}
        <div class="remind-row"><span>${today ? 'Paused for today. Back tomorrow.' : 'Need a day off?'}</span><button type="button" class="btn btn--secondary btn--small js-not-today" aria-pressed="${today}">${today ? 'Undo' : 'Not today'}</button></div>
        <div class="remind-row"><label class="switch"><input type="checkbox" class="js-quiet"${prefs.quiet.on ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Quiet hours</label>
          <span class="time-pair"><input class="time-input" type="time" data-quiet="from" value="${prefs.quiet.from}" aria-label="Quiet hours start"> to <input class="time-input" type="time" data-quiet="to" value="${prefs.quiet.to}" aria-label="Quiet hours end"></span></div>
        <p class="fine"><button type="button" class="link-btn js-open-checkin">Preview the check-in</button></p>`, 'prefs-reminders')
      + sec('What Yolkie remembers', `<p class="fine">What you said you had, and what you ticked off a shopping list. It’s only ever a guess you confirm, and each item fades after ${MEM_DAYS} days.</p>
        ${mem.length ? `<ul class="mem-list">${mem.map((x) => `<li style="--age:${Math.min(1, (Date.now() - x.at) / (MEM_DAYS * DAY)).toFixed(2)}"><span>${esc(cap(haveLabel(x.k)))}</span><small>${x.used ? 'probably used up' : dayWord(x.at).replace(/^On /, '')}</small></li>`).join('')}</ul>
          <button type="button" class="btn btn--secondary btn--small js-clear-memory">Clear remembered items</button>` : '<p class="fine">Nothing remembered right now.</p>'}`, 'prefs-memory')
      + sec('Hidden meals', prefs.hidden.length
        ? `<p class="fine">You said “Don’t suggest this again”. Bring any of them back.</p><ul class="hidden-list">${prefs.hidden.filter(byId).map((id) => `<li><span>${byId(id).name}</span><button type="button" class="btn btn--ghost btn--small" data-unhide="${id}">Suggest it again</button></li>`).join('')}</ul>`
        : '<p class="fine">None. Tap “Don’t suggest this again” on a meal and it lands here, so you can undo it.</p>', 'prefs-hidden')
      + sec('Takeout', `<label class="money-field" for="takeout-input">Your usual takeout meal costs <span class="money"><span aria-hidden="true">$</span><input id="takeout-input" class="js-takeout" type="number" min="1" max="200" step="1" value="${prefs.takeout}" inputmode="decimal"></span></label>
        <p class="fine">Each meal you finish adds this to “takeout dodged”. It’s an estimate.</p>`)
      + sec('Sample data for testers', sampleOn()
        ? '<p>Sample data is on. Everything you see, and anything you cook, uses the sample weeks.</p><button type="button" class="btn btn--secondary btn--small js-clear-sample">Clear sample data</button>'
        : '<p class="fine">Fills in a realistic, made-up few weeks: meals, ratings, cards, stickers, friends, Pantry-dex, the house’s profiles and remembered ingredients. It’s kept apart from your real stats and clears in one tap.</p><button type="button" class="btn btn--secondary btn--small js-load-sample">Load sample week</button>')
      + sec('Start over', `<p class="fine">Clears every choice and meal this demo saved on this device.</p><button type="button" class="btn btn--ghost btn--small js-reset-all">${resetArmed ? 'Tap again to clear everything' : 'Clear all demo data'}</button>`);
  }
  function openPrefs(section) {
    resetArmed = false;
    state.editing = null;
    renderPrefs();
    openSheet(prefsSheet);
    if (section) {
      const el = document.getElementById(section);
      if (!el) return;
      el.scrollIntoView({ block: 'start' });
      const first = $('button, input, summary', el);
      if (first) first.focus();
    }
  }
  prefsSheet.addEventListener('close', () => { state.editing = null; });
  const afterPrefs = () => { savePrefs(); refilter(); if (prefs.tab === 'house') renderHouse(); };
  const rerenderPrefs = (sel) => { const top = prefsBody.scrollTop; renderPrefs(); prefsBody.scrollTop = top; const el = sel && $(sel, prefsSheet); if (el) el.focus({ preventScroll: true }); };
  const flip = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  prefsSheet.addEventListener('click', (e) => {
    const t = e.target;
    const tg = t.closest('[data-group]');
    if (tg) {
      const { group, id } = tg.dataset;
      if (group === 'diet') prefs.diets = flip(prefs.diets, id);
      if (group === 'allergy') setRestr('you', (r) => { r.allergies = flip(r.allergies, id); });
      if (group.startsWith('rd-')) setRestr(group.slice(3), (r) => { r.diets = flip(r.diets, id); });
      if (group.startsWith('ra-')) setRestr(group.slice(3), (r) => { r.allergies = flip(r.allergies, id); });
      afterPrefs();
      rerenderPrefs(`[data-group="${group}"][data-id="${CSS.escape(id)}"]`);
    }
    const add = t.closest('[data-dislike]');
    if (add) { prefs.dislikes = [...prefs.dislikes, add.dataset.dislike]; afterPrefs(); rerenderPrefs('#dislike-input'); }
    const rm = t.closest('[data-undislike]');
    if (rm) { prefs.dislikes = prefs.dislikes.filter((x) => x !== rm.dataset.undislike); afterPrefs(); rerenderPrefs('#dislike-input'); }
    const ma = t.closest('[data-mdislike-add]');
    if (ma) { const id = ma.dataset.mdislikeAdd; setRestr(id, (r) => { r.dislikes = [...r.dislikes, ma.dataset.t]; }); afterPrefs(); rerenderPrefs(`[data-mdislike-rm="${id}"][data-t="${CSS.escape(ma.dataset.t)}"]`); }
    const mr = t.closest('[data-mdislike-rm]');
    if (mr) { const id = mr.dataset.mdislikeRm; setRestr(id, (r) => { r.dislikes = r.dislikes.filter((x) => x !== mr.dataset.t); }); afterPrefs(); rerenderPrefs(`#restr-${id} [data-mdislike-add]`); }
    const pass = t.closest('[data-pass]');
    if (pass) { state.editing = pass.dataset.pass; rerenderPrefs(`#restr-${state.editing} [data-group]`); yolk('default', `Hi ${rawName(state.editing)}! Your restrictions, your call.`); }
    const back = t.closest('[data-pass-back]');
    if (back) { const id = back.dataset.passBack; state.editing = null; rerenderPrefs(`[data-pass="${id}"]`); yolk('happy', 'Got it. Phone’s back with you.'); }
    if (t.closest('.js-clear-memory')) { const a = activity(); a.remembered = []; saveActivity(a); state.memAsked = false; renderRemember(); rerenderPrefs('#prefs-memory h3'); yolk('default', 'Forgotten. Clean slate.'); }
    const un = t.closest('[data-unhide]');
    if (un) { toggleHidden(un.dataset.unhide); afterPrefs(); rerenderPrefs('#prefs-hidden button, #prefs-hidden h3'); yolk('happy', `${byId(un.dataset.unhide).name} is back on the menu.`); }
    if (t.closest('.js-not-today')) { prefs.notToday = prefs.notToday === dayKey() ? '' : dayKey(); savePrefs(); rerenderPrefs('.js-not-today'); }
    if (t.closest('.js-open-checkin')) { closeSheet(prefsSheet); openCheckin(); }
    if (t.closest('.js-load-sample')) {
      store.set(SAMPLE_KEY, sampleWeek());
      dataChanged();
      rerenderPrefs('.js-clear-sample');
      yolk('happy', 'Sample weeks loaded. It’s all made up, and your real stats are safe.');
    }
    if (t.closest('.js-clear-sample')) { clearSample(); rerenderPrefs('.js-load-sample'); }
    if (t.closest('.js-reset-all')) {
      if (!resetArmed) { resetArmed = true; rerenderPrefs('.js-reset-all'); return; }
      [PREFS_KEY, ACTIVITY_KEY, SAMPLE_KEY, 'yolkie-log', 'yolkie-nutrition'].forEach((k) => store.del(k));
      location.reload();
    }
  });
  prefsSheet.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const v = lower(input.value).trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (e.target.matches('.js-add-dislike') && !prefs.dislikes.includes(v)) prefs.dislikes = [...prefs.dislikes, v];
    if (e.target.matches('.js-add-allergy') && !prefs.allergies.includes(v)) prefs.allergies = [...prefs.allergies, v];
    afterPrefs();
    rerenderPrefs(e.target.matches('.js-add-dislike') ? '#dislike-input' : '#allergy-input');
  });
  prefsSheet.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.keep) {
      const id = t.dataset.keep;
      setRestr(id, (r) => { r.keepOut = t.checked ? [...new Set([...r.keepOut, t.dataset.a])] : r.keepOut.filter((x) => x !== t.dataset.a); });
      afterPrefs();
      rerenderPrefs(`[data-keep="${id}"][data-a="${CSS.escape(t.dataset.a)}"]`);
      yolk('default', t.checked ? `No ${allergyWord(t.dataset.a)} in any suggestion now, whoever’s eating.` : `${cap(allergyWord(t.dataset.a))} only counts when ${id === 'you' ? 'you’re' : `${rawName(id)}’s`} eating again.`);
      return;
    }
    if (t.dataset.remind) prefs.reminders[t.dataset.remind].on = t.checked;
    if (t.dataset.remindTime && t.value) prefs.reminders[t.dataset.remindTime].time = t.value;
    if (t.matches('.js-quiet')) prefs.quiet.on = t.checked;
    if (t.dataset.quiet && t.value) prefs.quiet[t.dataset.quiet] = t.value;
    if (t.matches('.js-takeout')) { const v = Math.round(Number(t.value)); if (v > 0) prefs.takeout = Math.min(200, v); prefs.takeoutAsked = true; t.value = prefs.takeout; }
    savePrefs();
    if (prefs.tab === 'me') renderMe();
    if (prefs.tab === 'house') renderHouse();
  });
  /* Pre-meal check-in (simulated) */
  const checkinSheet = $('.js-checkin');
  function upcomingReminder() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const on = ['breakfast', 'lunch', 'dinner'].filter((k) => prefs.reminders[k].on).map((k) => ({ meal: k, at: toMin(prefs.reminders[k].time) }));
    if (!on.length) return { meal: mins < 630 ? 'breakfast' : mins < 900 ? 'lunch' : mins < 1290 ? 'dinner' : 'snack', at: mins, off: true };
    return on.find((r) => r.at > mins) || on[0];
  }
  const inQuiet = (at) => {
    if (!prefs.quiet.on) return false;
    const f = toMin(prefs.quiet.from);
    const t = toMin(prefs.quiet.to);
    return f <= t ? at >= f && at < t : at >= f || at < t;
  };
  // The check-in can use what you probably still have: "You probably still have chicken and rice. Lemon garlic chicken tonight?"
  const WHEN = { breakfast: 'this morning', lunch: 'for lunch', dinner: 'tonight', snack: 'for a snack' };
  function memoryPick(meal) {
    const keys = stillHave().slice(0, 3).map((x) => x.k);
    if (!keys.length) return null;
    const g = groupFilter(['you']);
    const best = RECIPES.filter((rr) => rr.meal === meal && passesGroup(rr, g)).map((rr) => ({ rr, used: usesHave(rr, keys) })).filter((x) => x.used.length).sort((a, b) => b.used.length - a.used.length)[0];
    if (!best) return { keys, text: `You probably still have ${listText(keys.map(haveLabel))}. Hungry in an hour?` };
    return { keys: best.used, text: `You probably still have ${listText(best.used.map(haveLabel))}. ${best.rr.name} ${WHEN[meal]}?` };
  }
  function openCheckin() {
    const r = upcomingReminder();
    // The lock screen shows the moment the reminder would arrive: later today, or tomorrow.
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const when = new Date(now.getTime() + (r.at < mins ? DAY : 0));
    const notes = [];
    if (r.off) notes.push('All reminders are off, so the app wouldn’t send this. Here’s the preview anyway.');
    if (prefs.notToday === dayKey()) notes.push('“Not today” is on, so the app would stay quiet until tomorrow.');
    if (inQuiet(r.at)) notes.push('That time is inside your quiet hours, so the app would hold it.');
    const guess = memoryPick(r.meal);
    if (guess) notes.push('“Probably still have” is Yolkie’s guess from what you said before. It forgets after 5 days.');
    $('.js-checkin-body').innerHTML = `
      <div class="phone">
        <div class="phone__bar" aria-hidden="true"><span>${clock12(r.at)}</span><span><span class="icon">signal_cellular_alt</span><span class="icon">battery_5_bar</span></span></div>
        <p class="phone__date">${when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <p class="phone__clock">${clock12(r.at).replace(/ (am|pm)$/, '')}</p>
        <div class="notif" role="group" aria-labelledby="notif-text">
          <div class="notif__head"><span class="notif__icon">${yolkieArt('happy')}</span><span class="notif__app">Yolkie</span><span class="notif__when">now</span></div>
          <p class="notif__text" id="notif-text"><span class="sr-only">Yolkie: </span>${guess ? esc(guess.text) : 'Hungry in an hour? How’s your energy?'}</p>
          <p class="notif__meta">${cap(MEALS[r.meal].label)} check-in · ${clock12(r.at)}</p>
          <div class="notif__actions" role="group" aria-label="Your energy">
            <button type="button" data-checkin="1">Wiped</button><button type="button" data-checkin="2">Okay</button><button type="button" data-checkin="3">Good</button>
          </div>
        </div>
      </div>
      <div class="checkin-foot">
        <p class="preview-label"><span class="icon" aria-hidden="true">visibility</span>Preview: real reminders arrive in the app.</p>
        ${notes.map((n) => `<p class="fine">${n}</p>`).join('')}
        <div class="checkin-foot__row"><button type="button" class="link-btn js-checkin-prefs">Change reminder times</button><button type="button" class="btn btn--ghost btn--small js-close">Close</button></div>
      </div>`;
    openSheet(checkinSheet);
    $('[data-checkin="2"]', checkinSheet).focus();
  }
  checkinSheet.addEventListener('click', (e) => {
    if (e.target.closest('.js-checkin-prefs')) { closeSheet(checkinSheet); openPrefs('prefs-reminders'); return; }
    const b = e.target.closest('[data-checkin]');
    if (!b) return;
    const r = upcomingReminder();
    closeSheet(checkinSheet);
    // Straight to the suggestion, with the shopping list worked out.
    state.meal = r.meal;
    state.energy = Number(b.dataset.checkin);
    state.time = state.time || Number(prefs.last.time) || 30;
    const guess = memoryPick(r.meal);
    if (guess) { state.have = guess.keys.slice(0, 3); state.memAsked = true; renderRemember(); }
    state.haveDone = true;
    state.fromCheckin = true;
    checkRadios();
    savePick();
    go('pick');
    rank();
    const line = suggest(false);
    const btn = $('.js-cook-this');
    if (btn) btn.focus({ preventScroll: true });
    yolk(...ENERGY[state.energy], { then: state.recipe && state.fits.length ? ['happy', `${cap(MEALS[state.meal].label)}’s sorted, and your list is ready.`] : line, after: 1500 });
  });

  /* Yolkie Wrapped: a swipeable story, any card saved as an image */
  const wrappedSheet = $('.js-wrapped');
  const TONES = { plum: ['#6B4DE6', '#FFFFFF'], yolk: ['#FFC83D', '#1E1A2E'], basil: ['#2E9E6A', '#1E1A2E'], night: ['#1E1740', '#F6F4FB'], paper: ['#F6F4FB', '#1E1A2E'] };
  const MEAL_HOURS = { breakfast: [5, 11], lunch: [11, 15], dinner: [17, 22] };
  // Chaos night: the fridge rescue with the most "already have" items, extra points if it was
  // cooked well outside its usual hours (pancakes at 10:30 pm).
  function oddest(meals) {
    const odd = (m) => { const h = new Date(m.at).getHours(); const w = MEAL_HOURS[byId(m.r).meal]; return w && (h < w[0] || h >= w[1]) ? 3 : 0; };
    return meals.filter((m) => m.have && m.have.length).map((m) => ({ m, score: m.have.length + odd(m) }))
      .sort((a, b) => b.score - a.score || b.m.at - a.m.at).map((x) => x.m)[0];
  }
  function wrappedCards() {
    const s = statsFor(activity());
    const fill = 'Keep cooking to fill this in.';
    const counts = {};
    s.mine.forEach((m) => { counts[m.r] = counts[m.r] || { n: 0, at: 0 }; counts[m.r].n += 1; counts[m.r].at = m.at; });
    const top = Object.entries(counts).sort((a, b) => b[1].n - a[1].n || b[1].at - a[1].at)[0];
    const chaos = oddest(s.mine);
    const when = chaos && new Date(chaos.at);
    const col = collectionFor(activity());
    const got = Object.keys(col.cards).length;
    const mastered = Object.values(col.cards).filter((c) => c.n >= MASTER_AT).length;
    const friend = FRIENDS.filter((f) => col.friends[f.id]).sort((a, b) => col.friends[b.id].at - col.friends[a.id].at)[0];
    return [
      { tone: 'plum', mood: 'happy', kicker: 'Meals cooked', big: String(s.cooked), title: s.cooked === 1 ? 'meal, cooked by you' : 'meals, cooked by you', sub: s.cooked < 3 ? fill : 'Every one of them from hungry to fed.' },
      { tone: 'yolk', mood: 'surprised', kicker: 'Top dish', big: top ? `${top[1].n}×` : '–', title: top ? byId(top[0]).name : 'No favourite yet', sub: top ? (top[1].n > 1 ? 'Your comfort pick.' : 'All tied at one, so here’s the latest.') : fill },
      { tone: 'basil', mood: 'happy', kicker: 'Money kept', big: `$${s.kept}`, title: 'kept in your pocket', sub: s.cooked ? `Estimate: ${s.cooked} × your usual $${prefs.takeout} takeout.` : fill },
      { tone: 'night', mood: 'default', kicker: 'Cuisines stamped', big: String(s.cuisines.length), title: s.cuisines.length === 1 ? 'cuisine in your passport' : 'cuisines in your passport', sub: s.cuisines.length ? s.cuisines.join(' · ') : fill },
      { tone: 'paper', mood: 'surprised', kicker: 'Chaos night', big: chaos ? clock12(when.getHours() * 60 + when.getMinutes()) : '?', title: chaos ? byId(chaos.r).name : 'No chaos yet', sub: chaos ? `Made from ${listText(chaos.have.map(haveLabel))} on a ${when.toLocaleDateString(undefined, { weekday: 'long' })}. Bold.` : `${fill} Fridge rescues count.` },
      { tone: 'yolk', mood: 'happy', kicker: 'Cards collected', big: String(got), title: `of ${RECIPES.length} recipe cards in your binder`, sub: got ? (mastered ? `${plural(mastered, 'card')} mastered and gone foil.` : `Cook one ${MASTER_AT} times and it turns foil.`) : `${fill} Every recipe you finish drops a card.` },
      { tone: 'plum', mood: 'happy', art: friend && friend.id, kicker: 'Newest friend', big: friend ? friend.name : '?', title: friend ? `came over after ${byId(col.friends[friend.id].r).name}` : 'No friends yet', sub: friend ? friend.bio : `${fill} Cook with avocado, bread, berries or noodles to meet one.` },
    ];
  }
  let storyCards = [];
  let storyAt = 0;
  function renderWrapped() {
    storyCards = wrappedCards();
    storyAt = 0;
    const sample = sampleOn();
    $('.js-wrapped-body').innerHTML = `
      <div class="story js-story" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Yolkie Wrapped. Swipe or use the arrow keys.">
        ${storyCards.map((c, k) => `<article class="story-card story-card--${c.tone}" role="group" aria-roledescription="slide" aria-label="${k + 1} of ${storyCards.length}: ${c.kicker}">
          <p class="story-card__kicker">Yolkie Wrapped · ${c.kicker}</p>
          <p class="story-card__big">${esc(c.big)}</p>
          <p class="story-card__title">${esc(c.title)}</p>
          <p class="story-card__sub">${esc(c.sub)}</p>
          ${c.art ? charArt(c.art, 'story-card__yolk story-card__friend') : yolkieArt(c.mood, 'story-card__yolk')}
          ${sample ? '<p class="story-card__sample">Sample data</p>' : ''}
        </article>`).join('')}
      </div>
      <div class="story-nav">
        <button type="button" class="icon-btn js-story-prev" aria-label="Previous card"><span class="icon" aria-hidden="true">chevron_left</span></button>
        <span class="story-dots" aria-hidden="true">${storyCards.map((_, k) => `<span${k === 0 ? ' class="is-on"' : ''}></span>`).join('')}</span>
        <span class="sr-only js-story-pos" aria-live="polite">Card 1 of ${storyCards.length}</span>
        <button type="button" class="icon-btn js-story-next" aria-label="Next card"><span class="icon" aria-hidden="true">chevron_right</span></button>
      </div>
      <div class="story-actions">
        <button type="button" class="btn btn--primary js-story-save"><span class="icon" aria-hidden="true">download</span>Save as image</button>
        <button type="button" class="btn btn--ghost js-close">Close</button>
      </div>
      <p class="fine js-story-status" aria-live="polite"></p>`;
    const story = $('.js-story', wrappedSheet);
    story.addEventListener('scroll', () => {
      const k = Math.round(story.scrollLeft / story.clientWidth);
      if (k === storyAt) return;
      storyAt = k;
      $$('.story-dots span', wrappedSheet).forEach((d, i) => d.classList.toggle('is-on', i === k));
      $('.js-story-pos', wrappedSheet).textContent = `Card ${k + 1} of ${storyCards.length}`;
    }, { passive: true });
    story.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); toCard(storyAt + d); }
    });
  }
  function toCard(k) {
    const story = $('.js-story', wrappedSheet);
    const i = Math.max(0, Math.min(storyCards.length - 1, k));
    story.scrollTo({ left: i * story.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  function wrapText(g, text, x, y, maxW, lineH) {
    let line = '';
    text.split(' ').forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lineH; } else line = test;
    });
    if (line) g.fillText(line, x, y);
    return y + lineH;
  }
  // Draws the card on a 1080×1350 canvas (Yolkie and the outfit included) and downloads it.
  async function saveCard() {
    const c = storyCards[storyAt];
    const [bg, fg] = TONES[c.tone];
    const status = $('.js-story-status', wrappedSheet);
    try {
      await Promise.all(['800 100px "Bricolage Grotesque"', '700 40px "DM Sans"'].map((f) => document.fonts.load(f)));
      const cv = document.createElement('canvas');
      cv.width = 1080;
      cv.height = 1350;
      const g = cv.getContext('2d');
      g.fillStyle = bg;
      g.fillRect(0, 0, 1080, 1350);
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.beginPath(); g.arc(1000, 90, 260, 0, Math.PI * 2); g.fill();
      g.fillStyle = fg;
      g.font = '700 38px "DM Sans", sans-serif';
      g.fillText(`YOLKIE WRAPPED · ${c.kicker.toUpperCase()}`, 80, 130);
      let size = 260;
      g.font = `800 ${size}px "Bricolage Grotesque", sans-serif`;
      while (g.measureText(c.big).width > 920 && size > 80) { size -= 10; g.font = `800 ${size}px "Bricolage Grotesque", sans-serif`; }
      g.fillText(c.big, 72, 140 + size);
      g.font = '800 64px "Bricolage Grotesque", sans-serif';
      let y = wrapText(g, c.title, 80, 240 + size, 920, 72);
      g.font = '500 40px "DM Sans", sans-serif';
      wrapText(g, c.sub, 80, y + 20, 820, 54);
      if (c.art) {
        const friend = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -200 220 220">${charSVG('wr', c.art)}</svg>`)}`);
        g.drawImage(friend, 600, 860, 420, 420);
      } else {
        const outfit = worn();
        const body = await loadImg(`${mascotDir}yolk-${c.mood}.svg`);
        const acc = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -200 220 220">${accLayers(outfit)}</svg>`)}`);
        g.drawImage(body, 600, 860, 420, 420);
        g.drawImage(acc, 600, 860, 420, 420);
      }
      g.font = '700 30px "DM Sans", sans-serif';
      g.fillText(sampleOn() ? 'yolkie.isolatedideas.dev · sample data' : 'yolkie.isolatedideas.dev · demo', 80, 1280);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yolkie-wrapped-${storyAt + 1}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      status.textContent = `Saved card ${storyAt + 1} as an image.`;
    } catch (err) {
      status.textContent = 'Couldn’t save that one. Try a screenshot instead?';
    }
  }
  wrappedSheet.addEventListener('click', (e) => {
    if (e.target.closest('.js-story-prev')) toCard(storyAt - 1);
    if (e.target.closest('.js-story-next')) toCard(storyAt + 1);
    if (e.target.closest('.js-story-save')) saveCard();
  });

  /* Sample weeks for testers: realistic, made up, and never mixed into real stats */
  function sampleWeek() {
    const now = Date.now();
    const at = (daysAgo, time) => {
      const d = new Date(now - daysAgo * DAY);
      const [h, m] = time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      let t = d.getTime();
      while (t > now) t -= DAY;
      return t;
    };
    // [recipe, days ago, time, who cooked, what they had, kudos from, ratings, everyone ate, cold day]
    const plan = [
      ['omelette', 18, '08:15', 'you', ['eggs', 'spinach'], [], { you: 3 }],
      ['scrambled', 17, '08:00', 'you', ['eggs'], [], { you: 2 }],
      ['omelette', 16, '08:30', 'you', ['eggs', 'cheese'], [], {}],
      ['salmon-eggs', 15, '09:10', 'you', ['eggs', 'lemon'], [], { you: 3 }],
      ['omelette', 14, '08:05', 'you', ['eggs'], [], {}],
      ['soup', 13, '12:30', 'you', [], ['boyd'], { you: 3, boyd: 2 }, false, true],
      ['tofu-tacos', 12, '09:30', 'you', ['tortillas', 'beans'], [], { you: 2 }],
      ['omelette', 11, '08:20', 'you', ['eggs', 'spinach'], [], { you: 3 }],
      ['salmon', 10, '19:15', 'you', ['lemon'], ['scramble'], { you: 2, scramble: 2 }],
      ['oatmeal', 9, '07:45', 'you', [], [], {}],
      ['fried-rice', 8, '19:00', 'you', ['eggs', 'rice'], [], { you: 1 }],
      ['popcorn', 7, '23:20', 'you', [], ['boyd'], { you: 2, boyd: 3 }],
      ['lemon-chicken', 6, '18:50', 'you', ['chicken', 'lemon', 'rice'], ['boyd'], { you: 2, boyd: 3 }],
      ['peanut-noodles', 5, '12:15', 'boyd', ['pasta'], [], { boyd: 2 }],
      ['hummus-plate', 4, '15:30', 'scramble', [], ['you'], { scramble: 2, you: 2 }],
      ['curry', 3, '19:05', 'you', ['rice', 'beans', 'spinach'], ['boyd', 'scramble'], { you: 3, boyd: 3, scramble: 2 }, true],
      ['pancakes', 2, '22:30', 'you', ['eggs'], ['scramble'], { you: 3, scramble: 3 }],
      ['quesadillas', 2, '12:40', 'you', ['tortillas', 'cheese'], [], { you: 2 }],
      ['sweet-potato-tacos', 1, '19:20', 'you', ['tortillas', 'beans'], ['scramble'], { you: 3, scramble: 3 }],
      ['omelette', 0, '08:10', 'you', ['eggs', 'spinach', 'cheese'], ['boyd'], { you: 3, boyd: 2 }],
    ];
    const a = { meals: [], badges: [{ id: 'rescue', at: now - 4 * DAY }], challenge: { id: 'speed', start: now - 2.5 * DAY }, stickers: {}, stickerFrom: {}, crumbs: 2, fridge: [], gifts: [], remembered: [] };
    // Stickers come from the same rules as real meals, replayed in order.
    plan.map((p, k) => ({ p, t: at(p[1], p[2]), k })).sort((x, y) => x.t - y.t).forEach(({ p: [id, , , cook, have, kudos, ratings, everyone, cold], t, k }) => {
      const r = byId(id);
      const cleans = r.steps.filter((s) => s.clean);
      const before = statsFor(a);
      const meal = { id: `sample${k}`, r: id, at: t, servings: 2, have: usesHave(r, have), rinsed: cleans.filter((s) => s.clean.dish).length, tidies: cleans.length, cook, kudos,
        eaters: [cook, ...kudos], ratings, everyone: !!everyone, cold: !!cold, stickers: [] };
      a.meals.push(meal);
      const after = statsFor(a);
      meal.stickers = earnStickers(a, meal, { before, after, goalHit: before.week < prefs.goal && after.week >= prefs.goal });
    });
    // A spare already gifted, one received last summer, and three on the fridge.
    if ((a.stickers.early || 0) > 1) { a.stickers.early -= 1; a.gifts.push({ s: 'early', to: 'scramble', at: now - 3 * DAY }); }
    a.stickers.sun = 1;
    a.stickerFrom.sun = 'boyd';
    a.fridge = Object.keys(a.stickers).slice(0, 3).map((s, k) => ({ s, x: [14, 34, 22][k], y: [20, 44, 74][k], r: [-8, 6, -3][k] }));
    // What you said you had two days ago (chicken, rice, spinach) and a lemon from last week, long faded.
    a.remembered = [
      { k: 'chicken', at: now - 2 * DAY, used: false }, { k: 'rice', at: now - 2 * DAY, used: false },
      { k: 'spinach', at: now - 2 * DAY, used: true, usedAt: now - 0.2 * DAY }, { k: 'lemon', at: now - 7 * DAY, used: false },
    ];
    // The house's profiles while the sample is on (yours always stay your real ones).
    a.restr = {
      boyd: { diets: [], allergies: ['dairy'], dislikes: ['mushrooms'], keepOut: [] },
      scramble: { diets: ['vegetarian'], allergies: ['peanut'], dislikes: ['olives'], keepOut: [] },
    };
    return a;
  }
  function syncBanner() { $('.js-sample-banner').hidden = !sampleOn(); }
  function dataChanged() {
    syncBanner();
    dress();
    state.memAsked = false;
    renderRemember();
    refilter();
    if (kitchen.isOpen()) kitchen.show();
    if (prefs.tab === 'me') renderMe();
    if (prefs.tab === 'house') renderHouse();
    if (prefs.tab === 'collection') renderCollection();
  }
  function clearSample() {
    store.del(SAMPLE_KEY);
    dataChanged();
    yolk('default', 'Sample data cleared. Back to your real stats.');
  }

  // Buttons that live in several places
  demo.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.js-open-prefs')) openPrefs();
    if (t.closest('.js-open-checkin') && !t.closest('.js-prefs-sheet')) openCheckin();
    if (t.closest('.js-nutri-open')) openNutrition();
    if (t.closest('.js-open-wrapped')) { renderWrapped(); openSheet(wrappedSheet); $('.js-story', wrappedSheet).focus(); }
    if (t.closest('.js-sample-banner .js-clear-sample')) { clearSample(); $('.js-open-prefs').focus(); }
  });

  /* Yolkie's picks (the house vote): up to three picks. It follows the same rules as a suggestion: they work
     for everyone voting (they're the ones eating), plus anything someone keeps out of the house. */
  const voteBox = $('.js-vote');
  const pickMeta = (r) => `${r.time} min · Dishes: ${r.dishes.length}${r.time > state.time ? ' · a bit longer' : ''}`;
  // Picks: this one, then what else fits, then the rest of the same meal (quickest first).
  function votePicks(voters) {
    const meal = state.recipe.meal;
    const g = groupFilter(voters);
    const sameMeal = RECIPES.filter((r) => r.meal === meal && !state.fits.includes(r)).sort((a, b) => a.time - b.time);
    return [state.recipe, ...state.fits, ...sameMeal].filter((r, k, all) => all.indexOf(r) === k).filter((r) => passesGroup(r, g)).slice(0, 3);
  }
  function startVote() {
    const voters = eaters();
    state.vote = { voters, picks: votePicks(voters), votes: [], turn: 0 };
    renderVoteSetup();
    go('vote');
    yolk('surprised', voters.length > 1 ? `A vote? Democracy, at ${mealOf().at}. I love it.` : 'A vote! Tap who’s eating, and they all get a say.');
  }

  function renderVoteSetup() {
    const v = state.vote;
    const few = v.voters.length < 2;
    const short = v.picks.length < 2;
    voteBox.innerHTML = `
      <div class="panel">
        <p class="eating__label" id="voters-label">Who’s eating?</p>
        <div class="tags" role="group" aria-labelledby="voters-label">${active().map((m) => {
          const on = v.voters.includes(m.id);
          return `<button type="button" class="tag tag--person${on ? ' is-on' : ''}" data-voter="${m.id}" aria-pressed="${on}">${avatar(m.id, 'idle', 'avatar--xs')}${memberName(m.id)}</button>`;
        }).join('')}</div>
        <p class="fine eating__note">${few ? 'Pick at least two people. Everyone eating gets a vote.' : esc(eatingNote())}</p>
      </div>
      <div class="panel">
        <h3>${short ? 'Not enough to vote on' : `${v.picks.length === 3 ? 'Three' : 'Two'} ${mealOf(state.recipe).label} picks`}</h3>
        <p class="fine">Every pick works for everyone eating, and leaves out anything kept out of the house.</p>
        ${short ? `<p class="meal-note">Only ${v.picks.length ? `${v.picks[0].name} works` : 'nothing works'} for everyone right now. Check restrictions in <button type="button" class="link-btn js-open-prefs">Preferences</button>, or try fewer people.</p>` : ''}
        <div class="ballot">${v.picks.map((r) => `<div class="pick"><span class="pick__name">${r.name}</span><span class="pick__meta">${pickMeta(r)}</span></div>`).join('')}</div>
      </div>
      <div class="stage-actions">
        <button type="button" class="btn btn--secondary js-vote-back">Back to my pick</button>
        ${short ? (v.picks.length ? '<button type="button" class="btn btn--primary js-vote-solo"><span class="btn__dot" aria-hidden="true"></span>Cook it</button>' : '')
          : `<button type="button" class="btn btn--primary js-vote-begin"${few ? ' disabled' : ''}><span class="btn__dot" aria-hidden="true"></span>Start the vote</button>`}
      </div>`;
  }

  function renderHandoff() {
    const v = state.vote;
    const id = v.voters[v.turn];
    voteBox.innerHTML = `
      <div class="panel handoff">
        ${avatar(id, 'idle', 'avatar--big')}
        <h3 tabindex="-1">Pass the phone to ${memberName(id)}.</h3>
        <p>Everyone else, eyes off the screen. Voter ${v.turn + 1} of ${v.voters.length}.</p>
        <button type="button" class="btn btn--primary js-vote-ready">I’m ${memberName(id)}. Show me the picks.</button>
      </div>`;
    $('h3', voteBox).focus();
  }

  function renderBallot() {
    const v = state.vote;
    voteBox.innerHTML = `
      <div class="panel">
        <h3 tabindex="-1">${memberName(v.voters[v.turn])}, pick one.</h3>
        <p class="fine">Your vote stays secret until the reveal.</p>
        <div class="ballot">${v.picks.map((r, k) => `<button type="button" class="pick js-cast" data-k="${k}"><span class="pick__name">${r.name}</span><span class="pick__meta">${pickMeta(r)}</span></button>`).join('')}</div>
      </div>`;
    $('h3', voteBox).focus();
  }

  function renderReady() {
    const v = state.vote;
    voteBox.innerHTML = `
      <div class="panel handoff">
        <div class="vote-reactions vote-reactions--center">${v.voters.map((id) => avatar(id)).join('')}</div>
        <h3 tabindex="-1">Everyone’s voted.</h3>
        <p>Phone in the middle of the table. Drumroll optional.</p>
        <button type="button" class="btn btn--primary js-vote-reveal"><span class="btn__dot" aria-hidden="true"></span>Reveal the winner</button>
      </div>`;
    $('h3', voteBox).focus();
  }

  function reveal() {
    const v = state.vote;
    const tally = v.picks.map((_, k) => v.votes.filter((x) => x === k).length);
    const top = Math.max(...tally);
    const leaders = tally.map((n, k) => (n === top ? k : -1)).filter((k) => k >= 0);
    const win = leaders[Math.floor(Math.random() * leaders.length)];
    v.winner = win;
    voteBox.innerHTML = `
      <div class="panel reveal-zone">
        <div class="confetti js-vote-confetti" aria-hidden="true"></div>
        <h3 tabindex="-1">And the ${mealOf(v.picks[0]).label} is…</h3>
        <div class="ballot">${v.picks.map((r, k) => {
          const by = v.voters.filter((_, i) => v.votes[i] === k);
          return `<div class="pick" data-k="${k}"><span class="pick__name">${r.name}</span><span class="pick__meta">${tally[k]} vote${tally[k] === 1 ? '' : 's'}</span><span class="pick__votes" hidden>${by.map((id) => avatar(id)).join('')}<span class="sr-only">from ${by.map(rawName).join(', ') || 'nobody'}</span></span></div>`;
        }).join('')}</div>
        <div class="js-vote-result" aria-live="polite"></div>
      </div>`;
    $('h3', voteBox).focus();
    yolk('surprised', 'Drumroll…');
    const cards = $$('.pick', voteBox);
    const land = () => {
      const r = v.picks[win];
      cards.forEach((c) => c.classList.remove('is-spot'));
      cards[win].classList.add('is-winner');
      cards[win].insertAdjacentHTML('beforeend', '<span class="pick__stamp">Winner</span>');
      $$('.pick__votes', voteBox).forEach((el) => { el.hidden = false; });
      const tie = leaders.length > 1 ? ' It was a tie, so Yolkie flipped a coin.' : '';
      $('.js-vote-result', voteBox).innerHTML = `
        <p class="vote-result">${r.name} wins with ${top} of ${v.voters.length} votes.${tie}</p>
        <div class="vote-reactions">${v.voters.map((id, i) => `<figure>${avatar(id, v.votes[i] === win ? 'win' : 'lose')}<figcaption>${memberName(id)}</figcaption></figure>`).join('')}</div>
        <div class="stage-actions">
          <button type="button" class="btn btn--secondary js-vote-again">Vote again</button>
          <button type="button" class="btn btn--primary js-vote-cook"><span class="btn__dot" aria-hidden="true"></span>Cook the winner</button>
        </div>`;
      confetti($('.js-vote-confetti', voteBox));
      const pouter = v.voters.find((id, i) => charOf(id) === 'scramble' && v.votes[i] !== win);
      const youLost = v.voters.includes('you') && v.votes[v.voters.indexOf('you')] !== win;
      if (pouter) yolk('happy', `${r.name} it is! ${rawName(pouter)} is pouting. ${rawName(pouter)} will be fine.`, { celebrate: true });
      else if (youLost) yolk('meh', `${r.name} wins. You voted for something else. It’ll grow on you.`);
      else yolk('happy', `${r.name} wins. Democracy is delicious.`, { celebrate: true });
    };
    if (reduceMotion) { land(); return; }
    // A spotlight hops between the picks, slowing down, and stops on the winner.
    const hops = v.picks.length * 3 + win;
    let n = 0;
    const hop = () => {
      cards.forEach((c, k) => c.classList.toggle('is-spot', k === n % v.picks.length));
      if (n >= hops) { setTimeout(land, 300); return; }
      n += 1;
      setTimeout(hop, 80 + n * n * 5);
    };
    hop();
  }

  voteBox.addEventListener('click', (e) => {
    const v = state.vote;
    const t = e.target;
    const vt = t.closest('[data-voter]');
    if (vt) {
      const id = vt.dataset.voter;
      if (v.voters.includes(id) && v.voters.length === 1) return;
      v.voters = v.voters.includes(id) ? v.voters.filter((x) => x !== id) : active().map((m) => m.id).filter((x) => x === id || v.voters.includes(x));
      state.eaters = [...v.voters];
      v.picks = votePicks(v.voters);
      renderVoteSetup();
      renderExtras();
      $(`[data-voter="${id}"]`, voteBox).focus();
    }
    if (t.closest('.js-vote-back')) { go('pick'); refilter(); yolk('default', 'Back to the pick. Peaceful.'); }
    if (t.closest('.js-vote-begin')) { v.votes = []; v.turn = 0; renderHandoff(); yolk('default', 'No peeking. I’m watching. Sort of.'); }
    if (t.closest('.js-vote-solo')) startCheck(v.picks[0]);
    if (t.closest('.js-vote-ready')) renderBallot();
    const cast = t.closest('.js-cast');
    if (cast) {
      v.votes[v.turn] = Number(cast.dataset.k);
      v.turn += 1;
      if (v.turn < v.voters.length) { renderHandoff(); yolk('default', 'Vote locked in. Pass it on.'); } else { renderReady(); yolk('surprised', 'Everyone’s in. The suspense!'); }
    }
    if (t.closest('.js-vote-reveal')) reveal();
    if (t.closest('.js-vote-again')) { renderVoteSetup(); yolk('surprised', 'A recount? Bold.'); }
    if (t.closest('.js-vote-cook')) startCheck(v.picks[v.winner]);
  });
  /* Start: put back the last pick, the outfit and the tab */
  (function restore() {
    const last = prefs.last || {};
    state.meal = MEALS[last.meal] ? last.meal : '';
    state.energy = Number(last.energy) || 0;
    state.time = Number(last.time) || 0;
    state.have = Array.isArray(last.have) ? last.have.slice(0, 3) : [];
    state.haveDone = !!last.haveDone;
    checkRadios();
    renderDietBar();
    renderExtras();
    renderRemember();
    syncBanner();
    dress();
    if (state.meal && state.energy && state.time) {
      if (state.haveDone) { rank(); suggest(false); } else renderHave(false);
    }
    // An invite link (#join=YOLK-XXXX) opens the join screen with the code filled in.
    const join = /^#join=(YOLK-[A-Z0-9]{4})$/i.exec(location.hash);
    if (join) {
      house.view = 'join';
      house.joinCode = join[1].toUpperCase();
      showTab('house');
      setTimeout(() => { const f = document.getElementById('join-code'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus({ preventScroll: true }); } }, 0);
      yolk('surprised', 'An invite! Tap Join and the owner gets asked.');
      return;
    }
    showTab(['cook', 'me', 'house', 'collection'].includes(prefs.tab) ? prefs.tab : 'cook');
  })();
}
