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
}
document.querySelectorAll('.js-nutri-toggle').forEach((t) => { t.checked = nutritionOn(); });
document.addEventListener('change', (e) => {
  if (e.target.matches && e.target.matches('.js-nutri-toggle')) setNutrition(e.target.checked);
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

// Thirteen everyday recipes, three or four for each meal (`meal`). Amounts are for `base` servings; `step` is the smallest sensible
// increment when scaling, so eggs stay whole and cans go in halves. Nutrition is per serving
// and a rough estimate. Steps: { do } is a task you tick off, { timer } also starts a timer when
// you tick it, { wait } pauses until a timer ends (or has `until` minutes left).
const RECIPES = [
  /* Breakfast */
  {
    id: 'scrambled', meal: 'breakfast', name: 'Soft scrambled eggs on toast', time: 10, effort: 1, base: 2, kcal: 400, protein: 20,
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
    id: 'oatmeal', meal: 'breakfast', name: 'Peanut butter banana oatmeal', time: 10, effort: 1, base: 2, kcal: 440, protein: 17,
    blurb: 'One pot, five minutes of stirring now and then, and it keeps you going till lunch.',
    dishes: ['saucepan'],
    ingredients: [
      { q: 1, u: 'cup', n: 'rolled oats', s: 'Pantry', step: 0.25 },
      { q: 2, u: 'cup', n: 'milk (any kind)', s: 'Dairy', step: 0.5 },
      { q: 1, n: 'banana', p: 'bananas', s: 'Produce', step: 0.5 },
      { q: 2, u: 'tbsp', n: 'peanut butter', s: 'Pantry', step: 0.5 },
      { q: 2, u: 'tsp', n: 'honey', s: 'Pantry', step: 1 },
    ],
    spices: [{ q: 0.5, u: 'tsp', n: 'Ground cinnamon', step: 0.25, swap: 'A pinch of pumpkin pie spice or nutmeg. Or skip it.' }],
    zero: 'Put the saucepan on the stove.',
    steps: [
      { do: 'Oats, milk, cinnamon and a pinch of salt into the saucepan. Medium heat.', timer: { id: 'oats', label: 'Oats', mins: 5 } },
      { do: 'Peel the banana and slice it. A butter knife is fine.', mins: 1 },
      { wait: 'oats', note: 'Give it a stir now and then so it doesn’t catch. This moves on by itself.', clean: { text: 'Milk back in the fridge, oats back in the cupboard.' } },
      { do: 'Heat off. Spoon into bowls and top with banana, peanut butter and a drizzle of honey.', mins: 1 },
    ],
  },
  {
    id: 'pancakes', meal: 'breakfast', name: 'Weekend pancakes with berries', time: 30, effort: 2, base: 2, kcal: 570, protein: 14,
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
      { q: 1, u: 'tsp', n: 'honey', s: 'Pantry', step: 0.25 },
    ],
    spices: [
      { q: 0.5, u: 'tsp', n: 'Red pepper flakes', step: 0.25, swap: 'A squeeze of hot sauce, or leave it out.' },
      { q: 0.25, u: 'tsp', n: 'Ground ginger', step: 0.25, swap: 'Skip it. The lime does the heavy lifting.' },
    ],
    zero: 'Fill the big pot with water and put it on the stove.',
    steps: [
      { do: 'Lid on, high heat, pinch of salt.', timer: { id: 'boil', label: 'Water', mins: 6 } },
      { do: 'In the bowl, whisk the peanut butter, soy sauce, honey, spices, lime juice and 3 tbsp of hot tap water.', mins: 3 },
      { do: 'Cut the carrot and cucumber into thin sticks. Slice the green onions.', mins: 4 },
      { wait: 'boil', clean: { text: 'Rinse the knife and cutting board and put them on the rack.', dish: 'cutting board' } },
      { do: 'Noodles and edamame into the boiling water.', timer: { id: 'noodles', label: 'Noodles', mins: 4 } },
      { wait: 'noodles', clean: { text: 'Peanut butter and soy sauce back in the cupboard.' } },
      { do: 'Drain. Tip the noodles into the sauce bowl with the veg and toss well.', mins: 1 },
    ],
  },
  {
    id: 'soup', meal: 'lunch', name: 'Tomato soup & grilled cheese', time: 25, effort: 2, base: 2, kcal: 740, protein: 23,
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

const demo = document.getElementById('demo');
if (demo) {
  const $ = (sel, el = demo) => el.querySelector(sel);
  const $$ = (sel, el = demo) => [...el.querySelectorAll(sel)];
  const state = { meal: '', energy: 0, time: 0, fits: [], idx: 0, another: 0, recipe: null, servings: 2, marks: {}, out: {}, buy: {}, cook: null, vote: null };

  // Yolkie: one face, one speech bubble (a polite live region), five expressions from the brand kit.
  const face = $('.yolk-face');
  const says = $('.yolk-says');
  const mascotDir = face.getAttribute('src').replace(/[^/]+$/, '');
  ['default', 'happy', 'meh', 'sleepy', 'surprised'].forEach((m) => { new Image().src = `${mascotDir}yolk-${m}.svg`; });
  let yolkLater;
  function yolk(mood, line, opts = {}) {
    clearTimeout(yolkLater);
    if (!face.getAttribute('src').endsWith(`yolk-${mood}.svg`)) face.src = `${mascotDir}yolk-${mood}.svg`;
    if (line) says.textContent = line;
    replay(face, opts.celebrate ? 'is-celebrating' : 'is-wobbling');
    if (opts.then) yolkLater = setTimeout(() => yolk(...opts.then), opts.after || 1600);
  }

  // Stages: one visible at a time; the track shows how far along you are.
  const ORDER = ['pick', 'check', 'cook', 'done'];
  function go(name) {
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

  // Recipes for the chosen meal that fit the time and energy, best match first: effort close
  // to your energy, and using most of the time you have. If none fit, the quickest one.
  function rank() {
    const score = (r) => (state.energy - r.effort) * 2 + (state.time - r.time) / 15;
    const ofMeal = RECIPES.filter((r) => r.meal === state.meal);
    state.fits = ofMeal.filter((r) => r.time <= state.time && r.effort <= state.energy).sort((a, b) => score(a) - score(b));
    if (!state.fits.length) state.fits = ofMeal.sort((a, b) => a.time - b.time || a.effort - b.effort).slice(0, 1);
    state.idx = 0;
    state.another = 0;
  }

  function renderMeal(note = '') {
    const r = state.recipe;
    $('.js-pick-hint').hidden = true;
    $('.js-meal-slot').innerHTML = `
      <article class="meal-card${reduceMotion ? '' : ' is-new'}">
        <p class="eyebrow">Yolkie's pick · ${cap(mealOf(r).label)}</p>
        <h3 class="meal-card__name">${r.name}</h3>
        <p class="meal-card__blurb">${r.blurb}</p>
        <div class="meal-stats">
          <span class="stat"><span class="icon" aria-hidden="true">schedule</span>${r.time} min</span>
          <span class="stat stat--dishes"><span class="icon" aria-hidden="true">skillet</span>Dishes: ${r.dishes.length}</span>
          <span class="stat nutri">~${r.kcal} kcal</span>
          <span class="stat nutri">~${r.protein} g protein</span>
        </div>
        <p class="fine nutri">Per serving. Calories and protein are rough estimates.</p>
        <label class="switch"><input type="checkbox" class="js-nutri-toggle"${nutritionOn() ? ' checked' : ''}><span class="switch__track" aria-hidden="true"></span>Show calories &amp; protein</label>
        ${note ? `<p class="meal-note">${note}</p>` : ''}
        <div class="actions">
          <button type="button" class="btn btn--primary js-cook-this"><span class="btn__dot" aria-hidden="true"></span>Let's make this</button>
          <button type="button" class="btn btn--secondary js-another">Another one</button>
          <button type="button" class="btn btn--ghost js-vote-start"><span class="icon" aria-hidden="true">how_to_vote</span>Vote with roommates</button>
        </div>
      </article>`;
  }

  function suggest(isAnother) {
    let note = '';
    if (isAnother) {
      state.idx = (state.idx + 1) % state.fits.length;
      state.another += 1;
      if (state.idx === 0) {
        note = state.fits.length === 1
          ? `That’s the only ${MEALS[state.meal].label} that fits right now. More time or energy opens up more.`
          : `That’s all ${state.fits.length} ${MEALS[state.meal].plural} that fit. Back to the first one.`;
      }
    }
    state.recipe = state.fits[state.idx];
    renderMeal(note);
    return state.another >= 3 ? ['meh', `Picky today. Valid. How about ${state.recipe.name}?`] : pickedLine(state.recipe);
  }

  const nextQuestion = () => (!state.meal ? 'Which meal is it?' : !state.energy ? 'And how’s your energy?' : 'And how much time have you got?');
  $$('input[name="meal"], input[name="energy"], input[name="time"]').forEach((input) => input.addEventListener('change', () => {
    state[input.name] = input.name === 'meal' ? input.value : Number(input.value);
    let line = null;
    if (state.meal && state.energy && state.time) { rank(); line = suggest(false); }
    const first = input.name === 'meal' ? MEALS[state.meal].say : input.name === 'energy' ? ENERGY[state.energy] : null;
    if (first) yolk(...first, line ? { then: line, after: 1500 } : {});
    else if (line) yolk(...line);
    else yolk('default', `Got it. ${nextQuestion()}`);
  }));

  $('.js-meal-slot').addEventListener('click', (e) => {
    if (e.target.closest('.js-another')) { yolk(...suggest(true)); $('.js-another').focus(); }
    if (e.target.closest('.js-cook-this')) startCheck(state.recipe);
    if (e.target.closest('.js-vote-start')) startVote();
  });

  /* 2. Check: servings, have/need, spice rack, shopping list */
  function startCheck(recipe) {
    state.recipe = recipe;
    state.servings = 2;
    state.marks = {};
    state.out = {};
    state.buy = {};
    $('.js-check-meal').textContent = `${recipe.name} · ${recipe.time} min · Dishes: ${recipe.dishes.length}`;
    renderChecklist();
    renderShop();
    go('check');
    yolk('default', 'Tap what you’ve got. No judgment.');
  }

  const amount = (item) => describe(item, scaleQty(item, state.servings, state.recipe.base));

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
    renderChecklist();
    renderShop();
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
    state.cook = { r: state.recipe, i: -1, timers: new Map(), rinsed: new Set(), last: performance.now(), loop: setInterval(tick, 200) };
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
    yolk('meh', 'Paused. The kitchen will wait.');
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

  /* 4. Done */
  function finishCook() {
    const c = state.cook;
    stopCook();
    const r = c.r;
    const rinsed = c.rinsed.size;
    $('.js-done-title').textContent = `${cap(mealOf(r).label)}. Done.`;
    $('.js-done-meal').textContent = `${r.name}, for ${state.servings}.`;
    $('.js-done-stats').innerHTML = `
      <div class="done-stat"><dt>Dishes used</dt><dd>${r.dishes.length}<small>${r.dishes.join(', ')}</small></dd></div>
      <div class="done-stat"><dt>Already rinsed</dt><dd>${rinsed}<small>${rinsed ? 'Thanks to clean-as-you-go.' : 'They’ll keep till tomorrow.'}</small></dd></div>
      <div class="done-stat nutri"><dt>Calories</dt><dd>~${r.kcal}<small>per serving, estimate</small></dd></div>
      <div class="done-stat nutri"><dt>Protein</dt><dd>~${r.protein} g<small>per serving, estimate</small></dd></div>`;
    const logBtn = $('.js-log');
    logBtn.disabled = false;
    logBtn.innerHTML = '<span class="icon" aria-hidden="true">bookmark_add</span>Log it';
    renderLog();
    state.cook = null;
    go('done');
    confetti($('.js-confetti'));
    yolk('happy', `${cap(mealOf(r).label)}. Done. Look at you go!`, { celebrate: true });
  }

  const LOG_KEY = 'yolkie-log';
  const readLog = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } };
  function renderLog() {
    const log = readLog();
    $('.js-log-list').innerHTML = log.slice(0, 5).map((entry) => {
      const d = new Date(entry.at);
      return `<li><span>${esc(entry.name)} · for ${Number(entry.servings) || 1}</span><time datetime="${d.toISOString()}">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>`;
    }).join('');
    $('.js-clear-log').hidden = !log.length;
  }
  $('.js-log').addEventListener('click', (e) => {
    const log = readLog();
    log.unshift({ name: state.recipe.name, servings: state.servings, at: Date.now() });
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 30))); } catch (err) {}
    e.currentTarget.disabled = true;
    e.currentTarget.innerHTML = '<span class="icon" aria-hidden="true">check</span>Logged';
    renderLog();
    yolk('happy', 'Logged. It lives on this device only.');
  });
  $('.js-clear-log').addEventListener('click', () => {
    try { localStorage.removeItem(LOG_KEY); } catch (e) {}
    renderLog();
    $('.js-log').focus();
  });
  $('.js-again').addEventListener('click', () => {
    go('pick');
    yolk('default', 'Round two? Same questions, new meal.');
  });

  /* Yolkie's picks (the house vote): three picks, pass the phone, one dramatic reveal */
  const PEOPLE = [
    { name: 'Yolkie', idle: 'yolk-default', win: 'yolk-happy', lose: 'yolk-meh' },
    { name: 'Boyd', idle: 'boyd-default', win: 'boyd-happy', lose: 'boyd-default' },
    { name: 'Scramble', idle: 'scramble-default', win: 'scramble-default', lose: 'scramble-pout' },
    { name: 'Guest' },
  ];
  const voteBox = $('.js-vote');
  const avatar = (i, mood = 'idle', extra = '') => (PEOPLE[i][mood]
    ? `<span class="avatar ${extra}"><img src="${mascotDir}${PEOPLE[i][mood]}.svg" alt="" width="220" height="220"></span>`
    : `<span class="avatar avatar--guest ${extra}"><span class="icon" aria-hidden="true">restaurant</span></span>`);
  const pickMeta = (r) => `${r.time} min · Dishes: ${r.dishes.length}${r.time > state.time ? ' · a bit longer' : ''}`;
  const playerName = (i) => esc(state.vote.names[i].trim() || PEOPLE[i].name);

  // Picks: this one, then what else fits, then the rest of the same meal (quickest first).
  function startVote() {
    const meal = state.recipe.meal;
    const sameMeal = RECIPES.filter((r) => r.meal === meal && !state.fits.includes(r)).sort((a, b) => a.time - b.time);
    const others = [...state.fits, ...sameMeal, ...RECIPES.filter((r) => r.meal !== meal)].filter((r) => r !== state.recipe);
    state.vote = { picks: [state.recipe, others[0], others[1]], count: 3, names: PEOPLE.map((p) => p.name), votes: [], turn: 0 };
    renderVoteSetup();
    go('vote');
    yolk('surprised', `A vote? Democracy, at ${mealOf().at}. I love it.`);
  }

  function renderVoteSetup() {
    const v = state.vote;
    voteBox.innerHTML = `
      <div class="panel">
        <h3>Three ${mealOf(v.picks[0]).label} picks</h3>
        <div class="ballot">${v.picks.map((r) => `<div class="pick"><span class="pick__name">${r.name}</span><span class="pick__meta">${pickMeta(r)}</span></div>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="servings">
          <span class="servings__label" id="people-label">How many people?</span>
          <span class="count-choices" role="group" aria-labelledby="people-label">${[2, 3, 4].map((n) => `<button type="button" data-count="${n}" aria-pressed="${n === v.count}">${n}</button>`).join('')}</span>
        </div>
        <ul class="player-list">${v.names.slice(0, v.count).map((name, i) => `
          <li class="player">${avatar(i)}<label>Player ${i + 1}<input type="text" value="${esc(name)}" data-p="${i}" maxlength="16" autocomplete="off"></label></li>`).join('')}
        </ul>
      </div>
      <div class="stage-actions">
        <button type="button" class="btn btn--secondary js-vote-back">Back to my pick</button>
        <button type="button" class="btn btn--primary js-vote-begin"><span class="btn__dot" aria-hidden="true"></span>Start the vote</button>
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
      const pouter = v.count >= 3 && v.votes[2] !== win;
      if (pouter) yolk('happy', `${r.name} it is! ${playerName(2)} is pouting. ${playerName(2)} will be fine.`, { celebrate: true });
      else if (v.votes[0] !== win) yolk('meh', `${r.name} wins. I voted for something else. I’m fine. Totally fine.`);
      else yolk('happy', `${r.name} wins. Democracy is delicious.`, { celebrate: true });
    };
    if (reduceMotion) { land(); return; }
    // A spotlight hops between the picks, slowing down, and stops on the winner.
    const hops = 9 + win;
    let n = 0;
    const hop = () => {
      cards.forEach((c, k) => c.classList.toggle('is-spot', k === n % 3));
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
    if (count) { v.count = Number(count.dataset.count); renderVoteSetup(); $(`[data-count="${v.count}"]`, voteBox).focus(); }
    if (t.closest('.js-vote-back')) { go('pick'); yolk('default', 'Back to just you. Peaceful.'); }
    if (t.closest('.js-vote-begin')) { v.votes = []; v.turn = 0; renderHandoff(); yolk('default', 'No peeking. I’m watching. Sort of.'); }
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
    if (e.target.matches('input[data-p]')) state.vote.names[Number(e.target.dataset.p)] = e.target.value;
  });
}
