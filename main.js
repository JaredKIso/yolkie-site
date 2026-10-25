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

// Twenty-seven everyday recipes, six to nine for each meal (`meal`), each tagged with a cuisine, the diets
// it fits (`diet`; keto, low-carb and high-protein come from the numbers) and its allergens.
// Amounts are for `base` servings; `step` is the smallest sensible increment when scaling, so eggs stay whole and cans go in halves. Nutrition is per serving
// and a rough estimate. Steps: { do } is a task you tick off, { timer } also starts a timer when
// you tick it, { wait } pauses until a timer ends (or has `until` minutes left).
const RECIPES = [
  /* Breakfast */
  {
    id: 'scrambled', meal: 'breakfast', name: 'Soft scrambled eggs on toast', time: 10, effort: 1, base: 2, kcal: 400, protein: 20,
    cuisine: 'British', diet: ['vegetarian'], allergens: ['egg', 'dairy', 'gluten'],
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
    cuisine: 'American', diet: ['vegetarian'], allergens: ['egg', 'dairy', 'gluten'],
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
    cuisine: 'Thai', diet: ['vegan'], allergens: ['peanut', 'soy', 'gluten'], has: ['spicy'],
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
    cuisine: 'American', diet: ['vegetarian'], allergens: ['dairy', 'gluten'],
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
    cuisine: 'Middle Eastern', diet: ['vegan'], allergens: ['sesame', 'gluten'],
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
    cuisine: 'Greek', diet: ['vegetarian', 'gluten-free'], allergens: ['egg', 'dairy'],
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
    cuisine: 'Nordic', diet: ['pescatarian', 'gluten-free', 'dairy-free'], allergens: ['egg', 'fish'],
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
    cuisine: 'American', diet: ['pescatarian', 'gluten-free', 'dairy-free'], allergens: ['fish'],
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
    cuisine: 'Italian', diet: ['vegetarian'], allergens: ['gluten', 'dairy'],
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
    cuisine: 'Greek', diet: ['vegetarian', 'gluten-free'], allergens: ['dairy', 'treenut'],
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
const UNIT_PLURALS = { can: 'cans', cup: 'cups', pouch: 'pouches', clove: 'cloves', slice: 'slices' };
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
const MEMBERS = [
  { name: 'You' },
  { name: 'Yolkie', yolkie: true },
  { name: 'Boyd', idle: 'boyd-default', win: 'boyd-happy', lose: 'boyd-default' },
  { name: 'Scramble', idle: 'scramble-default', win: 'scramble-default', lose: 'scramble-pout' },
];
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
const passes = (r, f) => f.diets.every((d) => dietsOf(r).has(d)) && !f.dislikes.some((t) => mentions(r, t)) && !allergic(r, f.allergies);
const haveTest = (key) => { const p = HAVE.find((h) => h.id === key); return p ? p.test : (n) => n.includes(stem(key)); };
const hasItem = (item, have) => have.some((k) => haveTest(k)(lower(item.n)));
const usesHave = (r, have) => have.filter((k) => r.ingredients.some((i) => haveTest(k)(lower(i.n))));
const haveLabel = (key) => lower(labelOf(HAVE, key));
const CUISINES = [...new Set(RECIPES.map((r) => r.cuisine))].sort();
const ALL_ITEMS = [...new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => lower(i.n))))].sort();

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
  const freshPrefs = () => ({
    diets: [], dislikes: [], allergies: [], houseAllergies: [[], [], [], []], names: MEMBERS.map((m) => m.name),
    houseSize: 4, houseGoal: 10, goal: 3, takeout: 15, takeoutAsked: false, outfit: {}, tab: 'cook',
    reminders: { breakfast: { on: false, time: '07:30' }, lunch: { on: false, time: '11:30' }, dinner: { on: true, time: '17:30' } },
    notToday: '', quiet: { on: true, from: '21:30', to: '07:00' }, dietAsk: { key: '', count: 0, never: false }, last: {},
  });
  const prefs = Object.assign(freshPrefs(), store.get(PREFS_KEY, {}));
  prefs.reminders = Object.assign(freshPrefs().reminders, prefs.reminders);
  const savePrefs = () => store.set(PREFS_KEY, prefs);
  const sampleOn = () => !!store.get(SAMPLE_KEY, null);
  const activity = () => Object.assign({ meals: [], badges: [], challenge: null }, store.get(sampleOn() ? SAMPLE_KEY : ACTIVITY_KEY, {}));
  const saveActivity = (a) => store.set(sampleOn() ? SAMPLE_KEY : ACTIVITY_KEY, a);

  const state = {
    meal: '', energy: 0, time: 0, have: [], haveDone: false, fromCheckin: false, temp: null, shown: false,
    fits: [], pool: [], fallback: false, idx: 0, another: 0, recipe: null, servings: Number(prefs.last.servings) || 2,
    marks: {}, out: {}, buy: {}, cook: null, vote: null, done: null, askDiet: null,
  };
  const eff = () => ({ diets: state.temp ? state.temp.diets : prefs.diets, dislikes: state.temp ? state.temp.dislikes : prefs.dislikes, allergies: prefs.allergies });
  const savePick = () => {
    prefs.last = { meal: state.meal, energy: state.energy, time: state.time, have: state.have, haveDone: state.haveDone, servings: state.servings };
    savePrefs();
  };

  // Everything shown on Me, House and Wrapped is worked out from the meals list.
  // "Mine" are the meals tagged as cooked by You, which is the default.
  function statsFor(a) {
    const meals = a.meals.filter((m) => byId(m.r)).sort((x, y) => x.at - y.at);
    const mine = meals.filter((m) => !m.cook);
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

  /* Members of the house (single device) */
  const rawName = (i) => (prefs.names[i] || '').trim() || MEMBERS[i].name;
  const memberName = (i) => esc(rawName(i));
  const memberAllergies = (i) => (i === 0 ? prefs.allergies : prefs.houseAllergies[i] || []);
  const houseMembers = () => Array.from({ length: prefs.houseSize }, (_, i) => i);
  function avatar(i, mood = 'idle', extra = '') {
    const p = MEMBERS[i];
    if (p.yolkie) return `<span class="avatar ${extra}">${yolkieArt({ idle: 'default', win: 'happy', lose: 'meh' }[mood])}</span>`;
    if (p[mood]) return `<span class="avatar ${extra}"><img src="${mascotDir}${p[mood]}.svg" alt="" width="220" height="220"></span>`;
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

  /* Tabs: Cook, Me, House */
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
  }
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => {
      showTab(t.dataset.tab);
      if (t.dataset.tab === 'me') yolk('happy', 'Your progress. It only goes up from here.');
      if (t.dataset.tab === 'house') yolk('default', 'The whole house, on one phone. Pass it around.');
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

  // Recipes for the chosen meal that pass your filters and fit the time and energy. Ones that
  // use more of what you already have come first; then effort close to your energy, and using
  // most of the time you have. If none fit the time and energy, the quickest one that passes.
  function rank() {
    const score = (r) => (state.energy - r.effort) * 2 + (state.time - r.time) / 15;
    const haveN = (r) => usesHave(r, state.have).length;
    state.pool = RECIPES.filter((r) => r.meal === state.meal && passes(r, eff()));
    state.fits = state.pool.filter((r) => r.time <= state.time && r.effort <= state.energy).sort((a, b) => haveN(b) - haveN(a) || score(a) - score(b));
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
    state.shown = true;
    $('.js-pick-hint').hidden = true;
    slot.innerHTML = `
      <article class="meal-card${reduceMotion ? '' : ' is-new'}">
        <div class="meal-card__top"><p class="eyebrow">Yolkie's pick · ${cap(mealOf(r).label)} · ${r.cuisine}</p>${haveBadge(r)}</div>
        <h3 class="meal-card__name">${r.name}</h3>
        <p class="meal-card__blurb">${r.blurb}</p>
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
          <button type="button" class="btn btn--ghost js-vote-start"><span class="icon" aria-hidden="true">how_to_vote</span>Vote with the house</button>
        </div>
      </article>`;
  }

  // Nothing passes the filters: say so kindly and offer the one change that opens most up.
  function loosenIdea() {
    const f = eff();
    const opts = [
      ...f.diets.map((d) => ({ label: labelOf(DIETS, d), f: { ...f, diets: f.diets.filter((x) => x !== d) } })),
      ...f.dislikes.map((t) => ({ label: `no ${t}`, f: { ...f, dislikes: f.dislikes.filter((x) => x !== t) } })),
    ];
    opts.forEach((o) => { o.n = RECIPES.filter((r) => r.meal === state.meal && passes(r, o.f)).length; });
    return opts.filter((o) => o.n).sort((a, b) => b.n - a.n)[0];
  }
  let loosen = null;
  function renderEmpty() {
    const f = eff();
    const meal = MEALS[state.meal].label;
    loosen = loosenIdea();
    state.shown = true;
    $('.js-pick-hint').hidden = true;
    const onlyAllergies = !f.diets.length && !f.dislikes.length;
    slot.innerHTML = `
      <article class="meal-card meal-card--empty${reduceMotion ? '' : ' is-new'}">
        <p class="eyebrow">Hmm</p>
        <h3 class="meal-card__name">No ${meal} matches all of that.</h3>
        <p class="meal-card__blurb">Right now it's ${esc(summarize(f))}.</p>
        ${loosen
          ? `<p class="meal-note">Without ${esc(loosen.label)}, there ${loosen.n === 1 ? 'is 1 option' : `are ${loosen.n} options`}.</p>
             <div class="actions"><button type="button" class="btn btn--primary js-loosen">Try without ${esc(loosen.label)}, just this meal</button><button type="button" class="btn btn--ghost js-open-prefs">Open preferences</button></div>`
          : `<p class="meal-note">${onlyAllergies ? `Your allergies rule out every ${meal} in this demo. That’s the filter doing its job. Another meal might work.` : 'Loosening one thing doesn’t open anything up here. Another meal, or a change in preferences, might.'}</p>
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
      note = `Nothing fits that time and energy, so here’s the quickest ${MEALS[state.meal].label} that matches your preferences.`;
    }
    state.recipe = state.fits[state.idx];
    renderMeal(note);
    return state.another >= 3 ? ['meh', `Picky today. Valid. How about ${state.recipe.name}?`] : pickedLine(state.recipe);
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
    savePick();
    rank();
    const line = suggest(false);
    yolk(...line);
    const btn = $('.js-cook-this') || $('.js-loosen') || $('.js-open-prefs', slot);
    if (btn) btn.focus({ preventScroll: true });
  }

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
      state.temp = { diets: loosen.f.diets, dislikes: loosen.f.dislikes };
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
    const items = r.ingredients.map((item, i) => (state.marks[i] === 'need' ? { s: item.s, ...amount(item) } : null)).filter(Boolean);
    r.spices.forEach((sp, i) => { if (state.out[i] && state.buy[i]) items.push({ s: 'Spices', qty: amount(sp).qty, name: sp.n.toLowerCase() }); });
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
      return `<div class="shop-section" data-section="${sec}"><h4>${sec}</h4><ul>${inSec.map((it) => `<li>${it.qty} ${it.name}</li>`).join('')}</ul></div>`;
    }).join('');
  }

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

  $('.js-start-cook').addEventListener('click', () => {
    stopCook();
    state.cook = { r: state.recipe, i: -1, timers: new Map(), rinsed: new Set(), tidies: 0, last: performance.now(), loop: setInterval(tick, 200) };
    $('.js-cook-title').textContent = state.recipe.name;
    $('.js-timers').innerHTML = '';
    renderNow();
    go('cook');
    keepAwake(true);
    yolk('default', 'One tiny thing first. That’s all.');
  });

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

  /* 4. Done: the meal is saved, and everything it adds shows up here */
  function finishCook() {
    const c = state.cook;
    stopCook();
    const r = c.r;
    const a = activity();
    const before = statsFor(a);
    const meal = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, r: r.id, at: Date.now(), servings: state.servings,
      have: usesHave(r, state.have), rinsed: c.rinsed.size, tidies: c.tidies, cook: 0, kudos: [],
    };
    a.meals.push(meal);
    const finished = settleChallenge(a);
    saveActivity(a);
    const after = statsFor(a);
    state.done = {
      mealId: meal.id, finished,
      goalHit: before.week < prefs.goal && after.week >= prefs.goal,
      unlocked: CLOSET.filter((it) => before.cooked < it.at && after.cooked >= it.at),
      newCuisine: !before.cuisines.includes(r.cuisine),
      newRecipe: !before.recipes.includes(r.id),
      askTakeout: !prefs.takeoutAsked,
    };
    if (!prefs.takeoutAsked) { prefs.takeoutAsked = true; savePrefs(); }
    // "Just this meal" ends with the meal; what you had is used up.
    state.temp = null;
    state.have = [];
    state.haveDone = false;
    state.fromCheckin = false;
    savePick();
    renderDietBar();

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
  function renderDone() {
    const d = state.done;
    const a = activity();
    const meal = a.meals.find((m) => m.id === d.mealId);
    const gainsBox = $('.js-gains');
    const who = $('.js-who');
    if (!meal) {
      gainsBox.innerHTML = '<h3>Removed</h3><p class="fine">That one isn’t counted anymore. No harm done.</p>';
      who.hidden = true;
      return;
    }
    const s = statsFor(a);
    const r = byId(meal.r);
    const mine = !meal.cook;
    const items = [];
    items.push(gain('savings', mine ? `+$${prefs.takeout} kept in your pocket` : `+$${prefs.takeout} for the house`,
      `Estimate, from your usual takeout cost.${mine ? ` $${s.kept} so far.` : ` The house: $${s.houseKept}.`}`, 'gain--money'));
    if (meal.have.length) items.push(gain('kitchen', 'Fridge rescue!', `You used ${esc(listText(meal.have.map(haveLabel)))}.`));
    if (mine && d.newCuisine) items.push(gain('approval', `New passport stamp: ${r.cuisine}`, 'Your first one here.'));
    else if (mine && d.newRecipe) items.push(gain('approval', 'New recipe stamp', `${r.name}, first time.`));
    if (meal.rinsed) items.push(gain('wash', `${plural(meal.rinsed, 'dish', 'dishes')} dodged`, 'Rinsed while something cooked, so they never hit the sink.'));
    else if (meal.tidies) items.push(gain('wash', `${plural(meal.tidies, 'tidy-up')} done`, 'Clean as you go. Future you says thanks.'));
    if (mine) {
      const hit = s.week >= prefs.goal;
      items.push(`<li class="gain gain--ring">${ring(s.week, prefs.goal, 'Weekly goal', 'ring--sm')}<p><strong>${hit ? 'Weekly goal hit!' : `${s.week} of ${prefs.goal} this week`}</strong><small>${hit ? 'Anything more is a bonus.' : 'Your weekly goal. No rush.'}</small></p></li>`);
    } else {
      items.push(gain('home', `The house: ${plural(s.houseWeek, 'meal')} this week`, `House goal: ${prefs.houseGoal}.`));
    }
    const active = a.challenge && CHALLENGES.find((c) => c.id === a.challenge.id);
    if (d.finished) items.push(gain('military_tech', `Badge earned: ${d.finished.badge}`, `${d.finished.name}, done.`, 'gain--badge'));
    else if (active) items.push(gain(active.icon, `${active.name}: ${challengeProgress(a, s)} of ${active.goal}`, active.unit));
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
    who.hidden = false;
    who.innerHTML = whoHtml(meal);
  }
  function whoHtml(meal) {
    const people = [...new Set([...houseMembers(), meal.cook])];
    return `<h3>Who cooked?</h3><p class="fine">Demo: pass the phone.</p>
      <div class="tags" role="group" aria-label="Who cooked">${people.map((i) => tag('cook', i, rawName(i), meal.cook === i)).join('')}</div>
      <p class="kudos-label">Everyone else: was it good?</p>
      ${kudosRow(meal)}`;
  }
  function kudosRow(meal, small = false) {
    const others = houseMembers().filter((i) => i !== meal.cook);
    return `<div class="kudos-row">${others.map((i) => {
      const on = meal.kudos.includes(i);
      // Once tapped, the button turns into that member's sticker.
      return `<button type="button" class="kudos-btn${small ? ' kudos-btn--sm' : ''}" data-meal="${meal.id}" data-kudos="${i}" aria-pressed="${on}">${avatar(i, on ? 'win' : 'idle', 'avatar--sm')}<span>${memberName(i)}: That was good!</span>${on ? '<span class="icon" aria-hidden="true">favorite</span>' : ''}</button>`;
    }).join('')}</div>`;
  }
  function updateMeal(id, fn) {
    const a = activity();
    const meal = a.meals.find((m) => m.id === id);
    if (!meal) return;
    fn(meal, a);
    saveActivity(a);
  }
  const toggleKudos = (id, i) => updateMeal(id, (m) => { m.kudos = m.kudos.includes(i) ? m.kudos.filter((x) => x !== i) : [...m.kudos, i]; });

  const doneStage = $('[data-stage="done"]');
  doneStage.addEventListener('click', (e) => {
    const t = e.target;
    const d = state.done;
    if (!d) return;
    const cook = t.closest('[data-group="cook"]');
    if (cook) {
      const i = Number(cook.dataset.id);
      updateMeal(d.mealId, (m) => { m.cook = i; m.kudos = m.kudos.filter((x) => x !== i); });
      renderDone();
      dress();
      $(`[data-group="cook"][data-id="${i}"]`).focus();
      yolk('happy', i === 0 ? 'Chef: you. Obviously.' : `Chef: ${rawName(i)}. Nice one.`);
    }
    const k = t.closest('[data-kudos]');
    if (k) {
      const i = Number(k.dataset.kudos);
      toggleKudos(d.mealId, i);
      renderDone();
      $(`[data-kudos="${i}"]`, doneStage).focus();
      const meal = activity().meals.find((m) => m.id === d.mealId);
      if (meal && meal.kudos.includes(i)) yolk('happy', `${rawName(i)} says that was good! Sticker earned.`);
    }
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
        <div><h3 id="wrapped-title">Yolkie Wrapped</h3><p class="fine">Your cooking so far, as a five-card story. Save any card as an image.</p></div>
        <button type="button" class="btn btn--primary js-open-wrapped"><span class="btn__dot" aria-hidden="true"></span>Preview Yolkie Wrapped</button>
      </section>`;
  }
  const refocus = (box, sel) => { const el = $(sel, box); if (el) el.focus(); };
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

  /* House: single device, shared goal, kudos. No rankings. */
  const houseBox = $('.js-house');
  function renderHouse() {
    const a = activity();
    const s = statsFor(a);
    const goal = prefs.houseGoal;
    const recent = [...s.meals].reverse().slice(0, 6);
    houseBox.innerHTML = `
      <div class="tab-head"><h2 class="stage__title" tabindex="-1">House</h2><p class="stage__sub">One goal for everyone, and a sticker when someone cooks something good.</p></div>
      <p class="vote-label"><span class="icon" aria-hidden="true">smartphone</span><span><strong>Demo: pass the phone.</strong> The whole house shares this one device here. In the app, everyone would join from their own phone.</span></p>
      <section class="panel" aria-labelledby="members-title">
        <div class="servings"><h3 id="members-title">Who’s in the house?</h3>
          <span class="count-choices" role="group" aria-label="House size">${[2, 3, 4].map((n) => `<button type="button" data-house-size="${n}" aria-pressed="${n === prefs.houseSize}">${n}</button>`).join('')}</span></div>
        <ul class="members">${houseMembers().map((i) => {
          const al = memberAllergies(i).map((x) => labelOf(ALLERGENS, x));
          return `<li class="member">${avatar(i)}<div class="member__body"><label for="member-${i}">${i === 0 ? 'You' : `Member ${i + 1}`}</label>
            <input id="member-${i}" class="text-input" type="text" value="${memberName(i)}" data-house-name="${i}" maxlength="16" autocomplete="off">
            <span class="member__allergy">Allergies: ${al.length ? esc(listText(al)) : 'none'}</span></div></li>`;
        }).join('')}</ul>
        <p class="fine">Allergies are set in <button type="button" class="link-btn js-prefs-house">Preferences</button>. Yolkie’s picks leave out anything a member can’t eat.</p>
      </section>
      <section class="panel goal-panel" aria-labelledby="house-goal-title">
        ${ring(s.houseWeek, goal, 'House meals this week')}
        <div><h3 id="house-goal-title">House goal</h3><p class="goal-line">The house cooked ${plural(s.houseWeek, 'meal')} this week</p>
          <p class="fine">${s.houseWeek >= goal ? 'Goal hit! Everyone gets a gold star.' : s.houseWeek ? `${goal - s.houseWeek} more and the house hits ${goal}.` : 'New week, fresh start. Every meal counts, whoever cooks it.'}</p>
          <div class="count-choices" role="group" aria-label="House meals per week">${[5, 7, 10, 14].map((n) => `<button type="button" data-house-goal="${n}" aria-pressed="${n === goal}">${n}</button>`).join('')}</div></div>
      </section>
      <section class="panel house-kept" aria-labelledby="house-kept-title"><span class="icon" aria-hidden="true">savings</span>
        <div><h3 id="house-kept-title">House takeout dodged</h3><p class="house-kept__big">$${s.houseKept}</p><p class="fine">Estimate: ${plural(s.meals.length, 'meal')} × $${prefs.takeout}, everyone’s meals added together.</p></div></section>
      <section class="panel" aria-labelledby="recent-title">
        <h3 id="recent-title">Recent meals</h3><p class="fine">No rankings here. Just thanks.</p>
        ${recent.length ? `<ul class="recent">${recent.map((m) => `<li><div class="recent__top"><strong>${byId(m.r).name}</strong><time datetime="${new Date(m.at).toISOString()}">${new Date(m.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</time></div>
          <p class="fine">Cooked by ${memberName(m.cook || 0)}</p>${kudosRow(m, true)}</li>`).join('')}</ul>` : '<p class="fine">Nothing cooked yet. The first meal lands here.</p>'}
      </section>`;
  }
  houseBox.addEventListener('click', (e) => {
    const t = e.target;
    const size = t.closest('[data-house-size]');
    if (size) { prefs.houseSize = Number(size.dataset.houseSize); savePrefs(); renderHouse(); refocus(houseBox, `[data-house-size="${prefs.houseSize}"]`); }
    const g = t.closest('[data-house-goal]');
    if (g) { prefs.houseGoal = Number(g.dataset.houseGoal); savePrefs(); renderHouse(); refocus(houseBox, `[data-house-goal="${prefs.houseGoal}"]`); }
    const k = t.closest('[data-kudos]');
    if (k) {
      const i = Number(k.dataset.kudos);
      toggleKudos(k.dataset.meal, i);
      renderHouse();
      refocus(houseBox, `[data-meal="${k.dataset.meal}"][data-kudos="${i}"]`);
      yolk('happy', `${rawName(i)} left a sticker. Wholesome.`);
    }
    if (t.closest('.js-prefs-house')) openPrefs('prefs-house');
  });
  houseBox.addEventListener('input', (e) => {
    if (e.target.matches('[data-house-name]')) { prefs.names[Number(e.target.dataset.houseName)] = e.target.value; savePrefs(); }
  });
  houseBox.addEventListener('change', (e) => { if (e.target.matches('[data-house-name]')) renderHouse(); });

  /* Yolkie's Kitchen: an isometric kitchen in the Me tab. You steer Yolkie; the other house
     members cook, wash up, raid the fridge, eat, chat and water the plant on their own.
     Decor unlocks as you cook. Ported from the Yolkies-Kitchen.html prototype. */
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
    const TYPES = ['yolk', 'boiled', 'scramble'];
    const opts = Object.assign({ night: false, auto: true, seen: -1 }, prefs.kitchen);
    const saveOpts = () => { prefs.kitchen = opts; savePrefs(); };
    let size = 1;       // characters in the kitchen: Yolkie, then Boyd, then Scramble
    let meals = 0;      // meals cooked, or the slider's value while the sample week is loaded
    let preview = null;
    let outfit = {};
    const has = (id) => meals >= DECOR.find((d) => d.id === id).at;
    const kName = (a) => rawName(a + 1); // kitchen character a is house member a + 1

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

    /* Characters, in the mascots' own coordinates; Yolkie wears the closet outfit */
    function bodyOf(id, type) {
      if (type === 'boiled') return { base: '', body: `<path d="M0,-188 C52,-188 80,-112 80,-62 C80,-14 44,8 0,8 C-44,8 -80,-14 -80,-62 C-80,-112 -52,-188 0,-188Z" fill="url(#wg_${id})"/><ellipse cx="-28" cy="-138" rx="16" ry="26" fill="#fff" opacity=".9" transform="rotate(20 -28 -138)"/>`, arm: '#CFC6E2' };
      if (type === 'scramble') {
        const C = [[-50, -66, 40], [0, -104, 50], [50, -70, 42], [-22, -36, 40], [28, -34, 40], [-64, -26, 28], [64, -26, 28], [-30, -108, 34], [34, -112, 32]];
        return { base: '', body: C.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFDD6E"/>`).join('') + C.map(([x, y, r]) => `<circle cx="${x + r * 0.3}" cy="${y + r * 0.35}" r="${r * 0.5}" fill="#F7C94B" opacity=".55"/>`).join('') + '<circle cx="-52" cy="-128" r="5" fill="#3E9B5C"/><circle cx="40" cy="-140" r="4" fill="#3E9B5C"/><circle cx="66" cy="-60" r="4.5" fill="#3E9B5C"/><ellipse cx="-24" cy="-136" rx="16" ry="9" fill="#fff" opacity=".55"/>', arm: '#EDB22A' };
      }
      return { base: '<path d="M-104,-6 C-112,-30 -74,-38 -42,-32 C-22,-48 30,-46 52,-32 C84,-40 114,-24 100,-6 C92,12 50,14 0,12 C-52,14 -96,12 -104,-6Z" fill="#fff"/>', body: `<circle cx="0" cy="-84" r="70" fill="url(#yg_${id})"/><ellipse cx="-26" cy="-120" rx="22" ry="12" fill="#fff" opacity=".6" transform="rotate(-25 -26 -120)"/>`, arm: '#EE9D1C' };
    }
    function charSVG(id, type, acc) {
      const B = bodyOf(id, type);
      return `<defs><radialGradient id="yg_${id}" cx="35%" cy="28%" r="78%"><stop offset="0" stop-color="#FFE68A"/><stop offset=".55" stop-color="#FFC531"/><stop offset="1" stop-color="#F09A12"/></radialGradient><radialGradient id="wg_${id}" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F6F3FB"/><stop offset="1" stop-color="#DCD5EA"/></radialGradient></defs>
        <ellipse cx="0" cy="8" rx="80" ry="12" fill="rgba(30,20,60,.18)"/>
        <g id="${id}_all">${B.base}
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
      // Walls, tiles, window, shelf
      let w = poly([P(0, 0), P(0, N), P(0, N, WALL), P(0, 0, WALL)], '#EEE8FA') + poly([P(0, 0), P(N, 0), P(N, 0, WALL), P(0, 0, WALL)], '#E2D9F5')
        + poly([P(0, 0), P(0, N), P(0, N, 12), P(0, 0, 12)], '#D9CFF0') + poly([P(0, 0), P(N, 0), P(N, 0, 12), P(0, 0, 12)], '#CBBFE8');
      const cEnd = N > 6 ? 6 : 5;
      for (let i = 1; i < cEnd; i++) for (let r = 0; r < 3; r++) { const z = 56 + r * 12; w += poly([P(i, 0, z), P(i + 1, 0, z), P(i + 1, 0, z + 12), P(i, 0, z + 12)], (i + r) % 2 ? '#F7F3FF' : '#EFE8FF', 'stroke="#E2D9F5" stroke-width=".8"'); }
      w += poly([P(2, 0, 96), P(4.4, 0, 96), P(4.4, 0, 178), P(2, 0, 178)], '#fff') + `<polygon id="k-sky" points="${pts([P(2.12, 0, 104), P(4.28, 0, 104), P(4.28, 0, 170), P(2.12, 0, 170)])}" fill="url(#k-skyDay)"/>`;
      w += `<g transform="${onRight(2.12, 104)}"><circle id="k-sun" cx="78" cy="-30" r="12" fill="#FFE27A"/><circle id="k-moonA" cx="78" cy="-30" r="11" fill="#FFF3C4" opacity="0"/><circle id="k-moonB" cx="84" cy="-35" r="10" fill="#2A2F66" opacity="0"/><g id="k-stars" opacity="0" fill="#fff"><circle cx="20" cy="-50" r="1.6"/><circle cx="44" cy="-20" r="1.2"/><circle cx="104" cy="-52" r="1.4"/><circle cx="96" cy="-12" r="1"/></g><path id="k-cloud" d="M14 -22 a8 8 0 0 1 14 -4 a7 7 0 0 1 12 4 z" fill="#fff" opacity=".9"/></g>`;
      const m1 = P(3.2, 0, 104), m2 = P(3.2, 0, 170);
      w += `<line x1="${m1[0]}" y1="${m1[1]}" x2="${m2[0]}" y2="${m2[1]}" stroke="#fff" stroke-width="4"/>` + poly([P(2, 0, 96), P(4.4, 0, 96), P(4.4, 0, 90), P(2, 0, 90)], '#F2ECFF');
      w += box(0, 1.6, 0.28, 1.7, 6, ['#E9C79A', '#D6B07F', '#C79E6C'], 118);
      [['#FF8A7A', 1.75, 24], ['#FFC83D', 2.15, 30], ['#9FE0BC', 2.55, 20], ['#B9A8FF', 2.9, 26]].forEach(([c, v, h]) => { w += box(0.04, v, 0.18, 0.25, h, [c, c, c], 124) + box(0.04, v, 0.18, 0.25, 4, ['#fff', '#eee', '#ddd'], 124 + h); });
      if (has('poster')) w += `<g transform="${onLeft(N - 2.25, 58)} scale(-1,1) translate(-58,0)"><rect x="0" y="-92" width="58" height="80" rx="4" fill="#6B4DE6"/><circle cx="29" cy="-58" r="17" fill="#FFC83D"/><circle cx="23" cy="-61" r="2.6" fill="${INK}"/><circle cx="35" cy="-61" r="2.6" fill="${INK}"/><path d="M23 -52 Q29 -46 35 -52" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/><text x="29" y="-22" text-anchor="middle" font-family="Bricolage Grotesque, DM Sans, sans-serif" font-weight="800" font-size="11" fill="#fff">YOLKIE</text></g>`;
      if (has('clock')) w += `<g transform="${onLeft(N - 0.85, 150)}"><circle r="17" fill="#fff" stroke="#6B4DE6" stroke-width="3"/><line id="k-hh" x2="0" y2="-9" stroke="#1E1A2E" stroke-width="2.6" stroke-linecap="round"/><line id="k-mh" x2="0" y2="-13" stroke="#FF8A7A" stroke-width="2" stroke-linecap="round"/></g>`;
      el('walls').innerHTML = w;
      el('nightTint').setAttribute('points', pts([P(0, N, WALL), P(0, 0, WALL), P(N, 0, WALL), P(N, 0), P(N, N), P(0, N)]));
      let f = '';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) f += poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (i + j) % 2 ? '#E7E1F3' : '#F1ECF9', 'stroke="#DDD5EE" stroke-width=".6"');
      el('floor').innerHTML = f;

      // Fridge, with a door that opens while someone's at it
      footprint(0, 0, 1, 1);
      addObj(1, box(0, 0, 1, 1, 160, ['#FFFFFF', '#F1EEF8', '#E3DEEF']) + `<line x1="${P(0, 1, 100)[0]}" y1="${P(0, 1, 100)[1]}" x2="${P(1, 1, 100)[0]}" y2="${P(1, 1, 100)[1]}" stroke="#D5CFE4" stroke-width="2"/>`
        + [112, 60].map((z) => `<line x1="${P(0.82, 1, z)[0]}" y1="${P(0.82, 1, z)[1]}" x2="${P(0.82, 1, z + 28)[0]}" y2="${P(0.82, 1, z + 28)[1]}" stroke="#B8B0CC" stroke-width="4" stroke-linecap="round"/>`).join('')
        + (has('magnets') ? (() => { const a = P(0.25, 1, 118), b = P(0.55, 1, 132), c = P(0.4, 1, 74); return `<circle cx="${a[0]}" cy="${a[1]}" r="6" fill="#FF8A7A"/><rect x="${b[0] - 6}" y="${b[1] - 6}" width="12" height="12" fill="#1D5FC4" transform="rotate(-27 ${b[0]} ${b[1]})"/><path d="M${c[0]} ${c[1] - 8} L${c[0] + 7} ${c[1] + 4} L${c[0] - 7} ${c[1] + 4} Z" fill="#2E9E6A"/>`; })() : ''));
      addObj(1.9, poly([P(0.04, 1, 12), P(0.96, 1, 12), P(0.96, 1, 98), P(0.04, 1, 98)], '#FFF3C9') + poly([P(1, 1, 10), P(1, 1.85, 10), P(1, 1.85, 98), P(1, 1, 98)], '#F7F5FC', 'stroke="#DCD6EA" stroke-width="1.5"'), 'fridgeOpen');
      spots.fridge = { t: [0, 1], o: [0.5, 0.5], icon: '🥛' };
      // Counter: stove, sink, coffee machine
      const CAB = ['#FFF6E6', '#6B4DE6', '#5A3DD0'], TOP = ['#E9C79A', '#D9B585', '#C9A06E'];
      for (let i = 1; i < cEnd; i++) {
        footprint(i, 0, 1, 1);
        let h = box(i, 0, 1, 1, 50, CAB) + box(i, 0, 1, 1.06, 6, TOP, 50);
        const k = P(i + 0.5, 1, 30);
        h += `<rect x="${k[0] - 8}" y="${k[1] - 2}" width="16" height="4" rx="2" fill="#FFC83D"/>`;
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
      // Table and stools (the seats)
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
      // The characters
      const og = el('objs');
      og.innerHTML = '';
      el('labels').innerHTML = '';
      fridgeDoor = null;
      objects.forEach((o) => { const g = document.createElementNS(NS, 'g'); g.innerHTML = o.html; o.el = g; if (o.id === 'fridgeOpen') { g.style.display = 'none'; fridgeDoor = g; } og.appendChild(g); });
      const start = size > 1 ? [[2, 2], [5, 6], [1, 4]] : [[2, 2]];
      agents = [];
      for (let a = 0; a < size; a++) {
        const id = `kag${a}`;
        const g = document.createElementNS(NS, 'g');
        g.innerHTML = charSVG(id, TYPES[a], a === 0 ? accLayers(outfit) : '');
        g.dataset.agent = a;
        og.appendChild(g);
        const lb = document.createElementNS(NS, 'g');
        lb.dataset.agent = a;
        el('labels').appendChild(lb);
        const s = start[a];
        agents.push({ i: a, id, type: TYPES[a], el: g, lb, u: s[0] + 0.5, v: s[1] + 0.5, path: [], step: null, face: 1, act: null, actT: 0, wait: 1 + a * 1.3, happy: 0, jump: 0, say: '', sayT: 0, seat: false, partner: null, manual: 0 });
      }
      applyNight();
      drawLabels();
    }

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

    /* What everyone does on their own */
    function pickActivity(a) {
      const choices = [];
      const add = (n, w) => choices.push([n, w]);
      if (spots.stove && !reserved.stove) add('stove', 3);
      if (spots.sink && !reserved.sink) add('sink', 2);
      if (spots.fridge && !reserved.fridge) add('fridge', 2);
      if (spots.coffee && !reserved.coffee) add('coffee', 1.5);
      if (spots.plant && !reserved.plant) add('plant', 1.2);
      if (seats.some((s) => !reserved[`seat${s}`])) add('eat', 3);
      if (agents.length > 1 && agents.some((b) => b !== a && !b.act && !b.path.length && !b.partner)) add('chat', 2.5);
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
        const others = agents.filter((b) => b !== a && !b.act && !b.path.length && !b.partner && b.manual <= 0);
        if (!others.length) return;
        const b = others[Math.floor(Math.random() * others.length)];
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
    const LINES = { chat: ['haha', '…', 'no way!', '♥', 'same', 'lol'], tap: ['Hi!', 'Hungry?', 'Let’s cook!', 'Egg-cellent.'] };
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

    /* Name tags: the house members' names. Yolkie's tag is plum, because you steer Yolkie. */
    function drawLabels() {
      agents.forEach((a) => {
        const name = kName(a.i);
        const mine = a.i === 0;
        const w = Math.max(44, name.length * 7.2 + 24);
        a.lb.innerHTML = `<g><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11" fill="${mine ? '#6B4DE6' : '#FFFFFF'}" stroke="${mine ? '#6B4DE6' : '#E3DEEF'}" stroke-width="1.5"/><text y="4.5" text-anchor="middle" font-family="DM Sans, system-ui, sans-serif" font-size="12" font-weight="700" fill="${mine ? '#fff' : '#1E1A2E'}">${esc(name)}</text></g>
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
      toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
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
    function renderControls() {
      const sizes = [[2, `${rawName(0)} & ${kName(0)}`], [3, `+ ${kName(1)}`], [4, `+ ${kName(1)} & ${kName(2)}`]];
      $('.js-k-sizes').innerHTML = sizes.map(([n, label]) => `<button type="button" class="tag${prefs.houseSize === n ? ' is-on' : ''}" data-k-size="${n}" aria-pressed="${prefs.houseSize === n}">${esc(label)}</button>`).join('');
      $$('[data-k-name]').forEach((inp) => {
        const i = Number(inp.dataset.kName);
        if (document.activeElement !== inp) inp.value = rawName(i);
        inp.closest('label').hidden = i > size;
      });
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
      $('.js-k-decor').innerHTML = DECOR.map((d) => {
        const open = meals >= d.at;
        return `<li class="decor-item${open ? ' is-open' : ''}"><strong>${d.name}</strong><small>${open ? 'Unlocked' : `Cook ${plural(d.at - meals, 'more meal')}`}</small></li>`;
      }).join('');
      $('.js-k-auto').setAttribute('aria-pressed', String(opts.auto));
      $('.js-k-night').setAttribute('aria-pressed', String(opts.night));
    }

    // Who's in the kitchen, how many meals, and what Yolkie is wearing, all from the rest of the demo.
    function sync() {
      const real = statsFor(activity()).cooked;
      if (!sampleOn() && !opts.tester) preview = null;
      meals = preview == null ? real : preview;
      size = Math.min(3, Math.max(1, prefs.houseSize - 1));
      outfit = worn();
      return real;
    }
    function celebrate(nw) {
      toast(`New for the kitchen: ${nw[nw.length - 1].name}!`);
      agents.forEach((a) => { a.happy = 1.6; a.jump = RM ? 0 : 0.45; });
      const c = P(agents[0].u, agents[0].v, 60);
      emit('spark', c[0], c[1]);
    }

    /* Tap the floor to walk Yolkie; tap anyone to say hi */
    function toSvg(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
    svg.addEventListener('pointerdown', (e) => {
      const hit = e.target.closest && e.target.closest('[data-agent]');
      if (hit) {
        const a = agents[Number(hit.dataset.agent)];
        if (a) { a.happy = 1.4; a.jump = RM ? 0 : 0.45; a.say = LINES.tap[Math.floor(Math.random() * 4)]; a.sayT = 1.6; }
        return;
      }
      const p = toSvg(e), A = (p.x - ox) / TW, B = (p.y - oy) / TH, u = Math.floor((A + B) / 2), v = Math.floor((B - A) / 2);
      if (u < 0 || v < 0 || u >= N || v >= N) return;
      const me = agents[0];
      if (blocked.has(tileKey(u, v))) { toast(`${kName(0)} can’t stand there`); return; }
      if (me.act) endAct(me);
      release(me);
      me.plan = null;
      if (isSeat(u, v)) { reserved[`seat${[u, v]}`] = me; if (walkTo(me, [u, v])) me.plan = { kind: 'eat', obj: tablePos, seat: true }; me.manual = 8; return; }
      if (!walkTo(me, [u, v])) toast('No path there');
      me.manual = 8;
    });
    kBox.addEventListener('click', (e) => {
      const s = e.target.closest('[data-k-size]');
      if (s) {
        prefs.houseSize = Number(s.dataset.kSize);
        savePrefs();
        sync();
        build();
        renderControls();
        $(`[data-k-size="${prefs.houseSize}"]`).focus();
        toast(size > 1 ? 'The kitchen got bigger!' : `Just you and ${kName(0)}`);
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
        prefs.names[Number(e.target.dataset.kName)] = e.target.value;
        savePrefs();
        drawLabels();
        renderControls();
      }
      if (e.target.matches('.js-k-slider')) {
        const prev = meals;
        preview = Number(e.target.value);
        meals = preview;
        const nw = DECOR.filter((d) => d.at > prev && d.at <= meals);
        const keep = agents.map((a) => [a.u, a.v]);
        build();
        agents.forEach((a, i) => { const t = [Math.floor(keep[i][0]), Math.floor(keep[i][1])]; if (!blocked.has(tileKey(t[0], t[1])) && !isSeat(t[0], t[1])) { a.u = keep[i][0]; a.v = keep[i][1]; } });
        renderControls();
        if (nw.length) celebrate(nw);
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
      agents.forEach((a) => {
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
        } else if (!a.step && !a.path.length && !a.partner && opts.auto && a.manual <= 0) {
          a.wait -= dt;
          if (a.wait <= 0) { a.wait = 2; startPlan(a); }
        }
        if (a.jump > 0) a.jump -= dt;
        if (a.happy > 0) a.happy -= dt;
        if (a.sayT > 0) a.sayT -= dt;
      });
      if (fridgeDoor) fridgeDoor.style.display = fridgeOn ? '' : 'none';
      const burner = el('burner');
      if (burner) burner.setAttribute('opacity', cooking ? 0.55 + Math.sin(clock * 20) * 0.2 : 0);
      const water = el('water');
      if (water) water.setAttribute('opacity', washing ? 0.9 : 0);
      const headWorn = !!outfit.head;
      agents.forEach((a) => {
        const id = a.id;
        const part = (n) => document.getElementById(`${id}_${n}`);
        const isHappy = a.happy > 0 || a.act === 'dance' || (a.act === 'eat' && Math.sin(clock * 2 + a.i) > 0.6);
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
        const s = size > 1 ? 0.38 : 0.36;
        a.sx = p[0];
        a.sy = p[1] - a.hop - jy - bob;
        a.el.setAttribute('transform', `translate(${a.sx.toFixed(1)},${a.sy.toFixed(1)}) rotate(${rot}) scale(${s * a.face},${s})`);
        a.key = a.u + a.v + (seatZ ? 1 : 0.02);
        const topY = a.sy + (a.type === 'boiled' ? -200 : a.type === 'scramble' ? -170 : -160) * s - (a.i === 0 && headWorn ? 46 * s : 0) - 14;
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
          const nw = DECOR.filter((d) => d.at > opts.seen && d.at <= real);
          if (opts.seen >= 0 && nw.length) setTimeout(() => celebrate(nw), 400);
          if (opts.seen !== real) { opts.seen = real; saveOpts(); }
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

  /* Preferences sheet: diets, dislikes, allergies, nutrition, reminders, takeout, sample data */
  const prefsSheet = $('.js-prefs-sheet');
  const prefsBody = $('.js-prefs-body');
  let resetArmed = false;
  function renderPrefs() {
    const sec = (title, body, id = '') => `<section class="sheet-sec"${id ? ` id="${id}"` : ''}><h3>${title}</h3>${body}</section>`;
    const customAllergies = prefs.allergies.filter((x) => !ALLERGENS.some((a) => a.id === x));
    const today = prefs.notToday === dayKey();
    prefsBody.innerHTML =
      sec('Diet', `<p class="fine">Recipes have to match every diet you turn on.</p>
        <div class="tags">${DIETS.map((d) => tag('diet', d.id, d.label, prefs.diets.includes(d.id))).join('')}</div>`)
      + sec('Never show me', `<p class="fine">Recipes with these are left out.</p>
        <div class="tags">${prefs.dislikes.length ? prefs.dislikes.map((t) => `<button type="button" class="tag is-on" data-undislike="${esc(t)}"><span class="sr-only">Remove </span>${esc(t)}<span class="icon" aria-hidden="true">close</span></button>`).join('') : '<span class="fine">Nothing yet.</span>'}</div>
        <div class="tags">${DISLIKE_IDEAS.filter((t) => !prefs.dislikes.includes(t)).map((t) => `<button type="button" class="tag tag--add" data-dislike="${t}"><span class="icon" aria-hidden="true">add</span>${t}</button>`).join('')}</div>
        <form class="add-row js-add-dislike"><label class="sr-only" for="dislike-input">Add something to never show</label><input id="dislike-input" class="text-input" type="text" placeholder="Add an ingredient" maxlength="30" autocomplete="off"><button class="btn btn--secondary btn--small">Add</button></form>`)
      + sec('Allergies', `<p class="allergy-note"><span class="icon" aria-hidden="true">info</span>We filter recipes, but always check labels.</p>
        <p class="fine">Strict filters: a recipe with any of these never shows up. They can only be changed here.</p>
        <div class="tags">${ALLERGENS.map((a) => tag('allergy', a.id, a.label, prefs.allergies.includes(a.id))).join('')}${customAllergies.map((x) => tag('allergy', x, x, true)).join('')}</div>
        <form class="add-row js-add-allergy"><label class="sr-only" for="allergy-input">Add another allergy</label><input id="allergy-input" class="text-input" type="text" placeholder="Another allergy, like mustard" maxlength="30" autocomplete="off"><button class="btn btn--secondary btn--small">Add</button></form>`)
      + sec('Household allergies', `<p class="fine">Yolkie’s picks (the house vote) leave out anything a member can’t eat.</p>
        ${[1, 2, 3].map((i) => { const al = prefs.houseAllergies[i]; return `<details class="member-allergies"><summary><span>${memberName(i)}</span><span class="fine">${al.length ? esc(listText(al.map((x) => labelOf(ALLERGENS, x)))) : 'None'}</span></summary>
          <div class="tags">${ALLERGENS.map((a) => tag(`house-${i}`, a.id, a.label, al.includes(a.id))).join('')}</div></details>`; }).join('')}`, 'prefs-house')
      + sec('Nutrition', `<label class="switch"><input type="checkbox" class="js-nutri-hide"${nutritionOn() ? '' : ' checked'}><span class="switch__track" aria-hidden="true"></span>Hide nutrition</label>
        <p class="fine">Hides every calorie, protein and nutrition number, here and on the home page.</p>`)
      + sec('Check-in reminders', `<p class="fine">Preview: real reminders arrive in the app.</p>
        ${['breakfast', 'lunch', 'dinner'].map((k) => `<div class="remind-row"><label class="switch"><input type="checkbox" data-remind="${k}"${prefs.reminders[k].on ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Remind me before ${k}</label>
          <label class="time-field"><span class="sr-only">${cap(k)} reminder time</span><input class="time-input" type="time" data-remind-time="${k}" value="${prefs.reminders[k].time}"></label></div>`).join('')}
        <div class="remind-row"><span>${today ? 'Paused for today. Back tomorrow.' : 'Need a day off?'}</span><button type="button" class="btn btn--secondary btn--small js-not-today" aria-pressed="${today}">${today ? 'Undo' : 'Not today'}</button></div>
        <div class="remind-row"><label class="switch"><input type="checkbox" class="js-quiet"${prefs.quiet.on ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Quiet hours</label>
          <span class="time-pair"><input class="time-input" type="time" data-quiet="from" value="${prefs.quiet.from}" aria-label="Quiet hours start"> to <input class="time-input" type="time" data-quiet="to" value="${prefs.quiet.to}" aria-label="Quiet hours end"></span></div>
        <p class="fine"><button type="button" class="link-btn js-open-checkin">Preview the check-in</button></p>`, 'prefs-reminders')
      + sec('Takeout', `<label class="money-field" for="takeout-input">Your usual takeout meal costs <span class="money"><span aria-hidden="true">$</span><input id="takeout-input" class="js-takeout" type="number" min="1" max="200" step="1" value="${prefs.takeout}" inputmode="decimal"></span></label>
        <p class="fine">Each meal you finish adds this to “takeout dodged”. It’s an estimate.</p>`)
      + sec('Sample data for testers', sampleOn()
        ? '<p>Sample data is on. Everything you see, and anything you cook, uses the sample week.</p><button type="button" class="btn btn--secondary btn--small js-clear-sample">Clear sample data</button>'
        : '<p class="fine">Fills in a realistic, made-up week so you can see everything at once. It’s kept apart from your real stats and clears in one tap.</p><button type="button" class="btn btn--secondary btn--small js-load-sample">Load sample week</button>')
      + sec('Start over', `<p class="fine">Clears every choice and meal this demo saved on this device.</p><button type="button" class="btn btn--ghost btn--small js-reset-all">${resetArmed ? 'Tap again to clear everything' : 'Clear all demo data'}</button>`);
  }
  function openPrefs(section) {
    resetArmed = false;
    renderPrefs();
    openSheet(prefsSheet);
    if (section) {
      const el = document.getElementById(section);
      el.scrollIntoView({ block: 'start' });
      const first = $('summary, input, button', el);
      if (first) first.focus();
    }
  }
  const afterPrefs = () => { savePrefs(); refilter(); if (prefs.tab === 'house') renderHouse(); };
  const rerenderPrefs = (sel) => { renderPrefs(); const el = sel && $(sel, prefsSheet); if (el) el.focus(); };
  const openDetails = () => $$('.member-allergies', prefsSheet).map((d) => d.open);
  prefsSheet.addEventListener('click', (e) => {
    const t = e.target;
    const tg = t.closest('[data-group]');
    if (tg) {
      const { group, id } = tg.dataset;
      const flip = (list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
      if (group === 'diet') prefs.diets = flip(prefs.diets);
      if (group === 'allergy') prefs.allergies = flip(prefs.allergies);
      if (group.startsWith('house-')) { const i = Number(group.slice(6)); prefs.houseAllergies[i] = flip(prefs.houseAllergies[i]); }
      const was = openDetails();
      afterPrefs();
      rerenderPrefs(`[data-group="${group}"][data-id="${CSS.escape(id)}"]`);
      $$('.member-allergies', prefsSheet).forEach((d, k) => { d.open = was[k]; });
    }
    const add = t.closest('[data-dislike]');
    if (add) { prefs.dislikes = [...prefs.dislikes, add.dataset.dislike]; afterPrefs(); rerenderPrefs('#dislike-input'); }
    const rm = t.closest('[data-undislike]');
    if (rm) { prefs.dislikes = prefs.dislikes.filter((x) => x !== rm.dataset.undislike); afterPrefs(); rerenderPrefs('#dislike-input'); }
    if (t.closest('.js-not-today')) { prefs.notToday = prefs.notToday === dayKey() ? '' : dayKey(); savePrefs(); rerenderPrefs('.js-not-today'); }
    if (t.closest('.js-open-checkin')) { closeSheet(prefsSheet); openCheckin(); }
    if (t.closest('.js-load-sample')) {
      store.set(SAMPLE_KEY, sampleWeek());
      dataChanged();
      rerenderPrefs('.js-clear-sample');
      yolk('happy', 'Sample week loaded. It’s all made up, and your real stats are safe.');
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
    $('.js-checkin-body').innerHTML = `
      <div class="phone">
        <div class="phone__bar" aria-hidden="true"><span>${clock12(r.at)}</span><span><span class="icon">signal_cellular_alt</span><span class="icon">battery_5_bar</span></span></div>
        <p class="phone__date">${when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <p class="phone__clock">${clock12(r.at).replace(/ (am|pm)$/, '')}</p>
        <div class="notif" role="group" aria-labelledby="notif-text">
          <div class="notif__head"><span class="notif__icon">${yolkieArt('happy')}</span><span class="notif__app">Yolkie</span><span class="notif__when">now</span></div>
          <p class="notif__text" id="notif-text"><span class="sr-only">Yolkie: </span>Hungry in an hour? How’s your energy?</p>
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
    return [
      { tone: 'plum', mood: 'happy', kicker: 'Meals cooked', big: String(s.cooked), title: s.cooked === 1 ? 'meal, cooked by you' : 'meals, cooked by you', sub: s.cooked < 3 ? fill : 'Every one of them from hungry to fed.' },
      { tone: 'yolk', mood: 'surprised', kicker: 'Top dish', big: top ? `${top[1].n}×` : '–', title: top ? byId(top[0]).name : 'No favourite yet', sub: top ? (top[1].n > 1 ? 'Your comfort pick.' : 'All tied at one, so here’s the latest.') : fill },
      { tone: 'basil', mood: 'happy', kicker: 'Money kept', big: `$${s.kept}`, title: 'kept in your pocket', sub: s.cooked ? `Estimate: ${s.cooked} × your usual $${prefs.takeout} takeout.` : fill },
      { tone: 'night', mood: 'default', kicker: 'Cuisines stamped', big: String(s.cuisines.length), title: s.cuisines.length === 1 ? 'cuisine in your passport' : 'cuisines in your passport', sub: s.cuisines.length ? s.cuisines.join(' · ') : fill },
      { tone: 'paper', mood: 'surprised', kicker: 'Chaos night', big: chaos ? clock12(when.getHours() * 60 + when.getMinutes()) : '?', title: chaos ? byId(chaos.r).name : 'No chaos yet', sub: chaos ? `Made from ${listText(chaos.have.map(haveLabel))} on a ${when.toLocaleDateString(undefined, { weekday: 'long' })}. Bold.` : `${fill} Fridge rescues count.` },
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
          ${yolkieArt(c.mood, 'story-card__yolk')}
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
      const outfit = worn();
      const body = await loadImg(`${mascotDir}yolk-${c.mood}.svg`);
      const acc = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -200 220 220">${accLayers(outfit)}</svg>`)}`);
      g.drawImage(body, 600, 860, 420, 420);
      g.drawImage(acc, 600, 860, 420, 420);
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

  /* Sample week for testers: realistic, made up, and never mixed into real stats */
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
    const plan = [
      ['omelette', 0, '08:10', 0, ['eggs', 'spinach', 'cheese'], [2]],
      ['sweet-potato-tacos', 1, '19:20', 0, ['tortillas', 'beans'], [1, 3]],
      ['quesadillas', 2, '12:40', 2, ['tortillas', 'cheese'], [0]],
      ['pancakes', 2, '22:30', 0, ['eggs'], [3]],
      ['curry', 3, '19:05', 0, ['rice', 'beans', 'spinach'], [1, 2, 3]],
      ['hummus-plate', 4, '15:30', 3, [], [0]],
      ['peanut-noodles', 5, '12:15', 0, ['pasta'], []],
      ['lemon-chicken', 6, '18:50', 0, ['chicken', 'lemon', 'rice'], [2]],
      ['popcorn', 7, '20:30', 1, [], [0, 2]],
      ['fried-rice', 8, '19:00', 0, ['eggs', 'rice'], []],
      ['oatmeal', 9, '07:45', 0, [], []],
      ['salmon', 10, '19:15', 0, ['lemon'], [1]],
    ];
    const meals = plan.map(([id, d, t, cook, have, kudos], k) => {
      const r = byId(id);
      const cleans = r.steps.filter((s) => s.clean);
      return { id: `sample${k}`, r: id, at: at(d, t), servings: 2, have: usesHave(r, have), rinsed: cleans.filter((s) => s.clean.dish).length, tidies: cleans.length, cook, kudos };
    });
    return { meals, badges: [{ id: 'rescue', at: now - 4 * DAY }], challenge: { id: 'speed', start: now - 2.5 * DAY } };
  }
  function syncBanner() { $('.js-sample-banner').hidden = !sampleOn(); }
  function dataChanged() {
    syncBanner();
    dress();
    if (kitchen.isOpen()) kitchen.show();
    if (prefs.tab === 'me') renderMe();
    if (prefs.tab === 'house') renderHouse();
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

  /* Yolkie's picks (the house vote): up to three picks that work for everyone's allergies */
  const voteBox = $('.js-vote');
  const pickMeta = (r) => `${r.time} min · Dishes: ${r.dishes.length}${r.time > state.time ? ' · a bit longer' : ''}`;
  const playerName = memberName;
  const safeFor = (r, count) => Array.from({ length: count }, (_, i) => i).every((i) => !allergic(r, memberAllergies(i)));
  // Picks: this one, then what else fits, then the rest of the same meal (quickest first).
  function votePicks(count) {
    const meal = state.recipe.meal;
    const sameMeal = RECIPES.filter((r) => r.meal === meal && !state.fits.includes(r)).sort((a, b) => a.time - b.time);
    return [state.recipe, ...state.fits, ...sameMeal].filter((r, k, all) => all.indexOf(r) === k)
      .filter((r) => passes(r, eff()) && safeFor(r, count)).slice(0, 3);
  }
  function startVote() {
    const count = Math.max(2, prefs.houseSize);
    state.vote = { count, picks: votePicks(count), votes: [], turn: 0 };
    renderVoteSetup();
    go('vote');
    yolk('surprised', `A vote? Democracy, at ${mealOf().at}. I love it.`);
  }

  function renderVoteSetup() {
    const v = state.vote;
    const short = v.picks.length < 2;
    voteBox.innerHTML = `
      <div class="panel">
        <h3>${short ? 'Not enough to vote on' : `${v.picks.length === 3 ? 'Three' : 'Two'} ${mealOf(state.recipe).label} picks`}</h3>
        <p class="fine">Every pick works for everyone’s allergies${v.count > 1 ? ` in a house of ${v.count}` : ''}.</p>
        ${short ? `<p class="meal-note">Only ${v.picks.length ? `${v.picks[0].name} works` : 'nothing works'} for everyone right now. Check allergies in <button type="button" class="link-btn js-open-prefs">Preferences</button>, or try fewer people.</p>` : ''}
        <div class="ballot">${v.picks.map((r) => `<div class="pick"><span class="pick__name">${r.name}</span><span class="pick__meta">${pickMeta(r)}</span></div>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="servings">
          <span class="servings__label" id="people-label">How many people?</span>
          <span class="count-choices" role="group" aria-labelledby="people-label">${[2, 3, 4].map((n) => `<button type="button" data-count="${n}" aria-pressed="${n === v.count}">${n}</button>`).join('')}</span>
        </div>
        <ul class="player-list">${Array.from({ length: v.count }, (_, i) => `
          <li class="player">${avatar(i)}<label>Player ${i + 1}<input type="text" value="${playerName(i)}" data-p="${i}" maxlength="16" autocomplete="off"></label></li>`).join('')}
        </ul>
      </div>
      <div class="stage-actions">
        <button type="button" class="btn btn--secondary js-vote-back">Back to my pick</button>
        ${short ? (v.picks.length ? '<button type="button" class="btn btn--primary js-vote-solo"><span class="btn__dot" aria-hidden="true"></span>Cook it</button>' : '')
          : '<button type="button" class="btn btn--primary js-vote-begin"><span class="btn__dot" aria-hidden="true"></span>Start the vote</button>'}
      </div>`;
  }

  function renderHandoff() {
    const v = state.vote;
    const name = playerName(v.turn);
    voteBox.innerHTML = `
      <div class="panel handoff">
        ${avatar(v.turn, 'idle', 'avatar--big')}
        <h3 tabindex="-1">Pass the phone to ${name}.</h3>
        <p>Everyone else, eyes off the screen. Voter ${v.turn + 1} of ${v.count}.</p>
        <button type="button" class="btn btn--primary js-vote-ready">I’m ${name}. Show me the picks.</button>
      </div>`;
    $('h3', voteBox).focus();
  }

  function renderBallot() {
    const v = state.vote;
    voteBox.innerHTML = `
      <div class="panel">
        <h3 tabindex="-1">${playerName(v.turn)}, pick one.</h3>
        <p class="fine">Your vote stays secret until the reveal.</p>
        <div class="ballot">${v.picks.map((r, k) => `<button type="button" class="pick js-cast" data-k="${k}"><span class="pick__name">${r.name}</span><span class="pick__meta">${pickMeta(r)}</span></button>`).join('')}</div>
      </div>`;
    $('h3', voteBox).focus();
  }

  function renderReady() {
    const v = state.vote;
    voteBox.innerHTML = `
      <div class="panel handoff">
        <div class="vote-reactions vote-reactions--center">${Array.from({ length: v.count }, (_, i) => avatar(i)).join('')}</div>
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
          const voters = v.votes.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0);
          return `<div class="pick" data-k="${k}"><span class="pick__name">${r.name}</span><span class="pick__meta">${tally[k]} vote${tally[k] === 1 ? '' : 's'}</span><span class="pick__votes" hidden>${voters.map((i) => avatar(i)).join('')}<span class="sr-only">from ${voters.map(playerName).join(', ') || 'nobody'}</span></span></div>`;
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
        <p class="vote-result">${r.name} wins with ${top} of ${v.count} votes.${tie}</p>
        <div class="vote-reactions">${v.votes.map((x, i) => `<figure>${avatar(i, x === win ? 'win' : 'lose')}<figcaption>${playerName(i)}</figcaption></figure>`).join('')}</div>
        <div class="stage-actions">
          <button type="button" class="btn btn--secondary js-vote-again">Vote again</button>
          <button type="button" class="btn btn--primary js-vote-cook"><span class="btn__dot" aria-hidden="true"></span>Cook the winner</button>
        </div>`;
      confetti($('.js-vote-confetti', voteBox));
      const pouter = v.count >= 4 && v.votes[3] !== win;
      if (pouter) yolk('happy', `${r.name} it is! ${rawName(3)} is pouting. ${rawName(3)} will be fine.`, { celebrate: true });
      else if (v.votes[1] !== win) yolk('meh', `${r.name} wins. I voted for something else. I’m fine. Totally fine.`);
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
    const count = t.closest('[data-count]');
    if (count) { v.count = Number(count.dataset.count); v.picks = votePicks(v.count); renderVoteSetup(); $(`[data-count="${v.count}"]`, voteBox).focus(); }
    if (t.closest('.js-vote-back')) { go('pick'); yolk('default', 'Back to just you. Peaceful.'); }
    if (t.closest('.js-vote-begin')) { v.votes = []; v.turn = 0; renderHandoff(); yolk('default', 'No peeking. I’m watching. Sort of.'); }
    if (t.closest('.js-vote-solo')) startCheck(v.picks[0]);
    if (t.closest('.js-vote-ready')) renderBallot();
    const cast = t.closest('.js-cast');
    if (cast) {
      v.votes[v.turn] = Number(cast.dataset.k);
      v.turn += 1;
      if (v.turn < v.count) { renderHandoff(); yolk('default', 'Vote locked in. Pass it on.'); } else { renderReady(); yolk('surprised', 'Everyone’s in. The suspense!'); }
    }
    if (t.closest('.js-vote-reveal')) reveal();
    if (t.closest('.js-vote-again')) { renderVoteSetup(); yolk('surprised', 'A recount? Bold.'); }
    if (t.closest('.js-vote-cook')) startCheck(v.picks[v.winner]);
  });
  voteBox.addEventListener('input', (e) => {
    if (e.target.matches('input[data-p]')) { prefs.names[Number(e.target.dataset.p)] = e.target.value; savePrefs(); }
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
    syncBanner();
    dress();
    if (state.meal && state.energy && state.time) {
      if (state.haveDone) { rank(); suggest(false); } else renderHave(false);
    }
    showTab(['cook', 'me', 'house'].includes(prefs.tab) ? prefs.tab : 'cook');
  })();
}
