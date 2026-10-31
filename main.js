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
  if (target && !target.classList.contains('anchor')) target.scrollIntoView({ behavior: 'instant' }); // .anchor marks a sheet, not a place
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

// The waitlist and the feedback page save to Supabase (supabase/README.md has the setup). Paste in the
// project's URL and its anon (public) key, or the newer publishable key. Never the service_role key:
// everything in this file is public. While either is empty, both forms say they can't send right now
// and keep what was typed.
const SUPABASE_URL = 'https://teavrtstsnemauatvdfo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eDcmppmByWCE37z3SCP1hQ_d5Dqehaq';
// Sent with each feedback note, so a report can be matched to the version of the site it came from.
const APP_VERSION = 'demo-2026.10.27';

const supabaseReady = () => /^https:\/\/\S+$/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;
// Legacy anon keys are JWTs and also go in Authorization; the newer publishable keys only go in apikey.
const sbHeaders = (extra) => ({
  apikey: SUPABASE_ANON_KEY,
  ...(SUPABASE_ANON_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
  ...extra,
});
const sbBase = () => SUPABASE_URL.replace(/\/+$/, '');
// Add one row. Resolves 'ok', or 'duplicate' when a unique value (a waitlist email) is already there.
// Anything else throws. The website can only insert, so it never asks for the row back.
async function sbInsert(table, row) {
  if (!supabaseReady()) throw new Error('not configured');
  const res = await fetch(`${sbBase()}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
  if (res.status === 409) return 'duplicate';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return 'ok';
}
// Upload one file into a storage bucket at `path`.
async function sbUpload(bucket, path, file) {
  if (!supabaseReady()) throw new Error('not configured');
  const res = await fetch(`${sbBase()}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }),
    body: file,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
// One send per form every 30 seconds, per browser.
const SEND_GAP = 30000;
const sentRecently = (form) => { try { return Date.now() - Number(localStorage.getItem(`yolkie-sent-${form}`) || 0) < SEND_GAP; } catch (e) { return false; } };
const markSent = (form) => { try { localStorage.setItem(`yolkie-sent-${form}`, String(Date.now())); } catch (e) {} };
// Stricter than type="email", which accepts "name@host" with no dot in the domain. Matches the database check.
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sendFailed = () => (supabaseReady()
  ? 'That didn’t go through. Check your connection, then try again. Everything you typed is still here.'
  : 'This can’t send right now. Everything you typed is still here, so try again in a little while.');

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* The icon font is a subset: each page's font link lists the icons it may use (icon_names). On a local
   server, warn about any icon that isn't in it, so a new icon can't go missing without anyone noticing. */
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && document.fonts) {
  const seen = new Set();
  let wait = 0;
  const checkIcons = () => document.querySelectorAll('.icon').forEach((el) => {
    const name = el.textContent.trim();
    // Only icons really on show: inside a closed section, the browser doesn't measure them.
    if (!/^[a-z0-9_]+$/.test(name) || seen.has(name) || !(el.checkVisibility ? el.checkVisibility() : el.offsetWidth) || el.closest('details:not([open])')) return;
    seen.add(name);
    if (el.scrollWidth > el.clientWidth + 2) console.warn(`Icon "${name}" isn't in the icon font. Add it to icon_names in the font link on every page.`);
  });
  document.fonts.ready.then(() => {
    checkIcons();
    new MutationObserver(() => { clearTimeout(wait); wait = setTimeout(checkIcons, 400); }).observe(document.body, { childList: true, subtree: true });
  });
}

/* ---------- Accounts: the sign-in shared by account.html, admin.html and the header link ----------
   People sign in through Supabase Auth (GitHub, Google, Apple, or an email and password). The login
   token lives in this browser, and every request carries it, so the database rules in
   supabase/accounts.sql decide what each person can see. */

// Cloudflare Turnstile's *site* key, which is public. Its secret key goes in the Supabase dashboard,
// never here. Leave it empty while Supabase's bot protection (CAPTCHA) is switched off.
const TURNSTILE_SITE_KEY = '0x4AAAAAAFnMEgGLGkUMdSFG';

// Badges, in the order they're shown. Admin isn't given by hand: it shows for anyone on the admin list.
// Yolkling isn't given by hand either: everyone with an account has it.
const BADGES = {
  owner: { label: 'Owner', icon: 'workspace_premium' },
  admin: { label: 'Admin', icon: 'shield_person' },
  developer: { label: 'Developer', icon: 'code' },
  tester: { label: 'Tester', icon: 'science' },
  early_adopter: { label: 'Early adopter', icon: 'egg' },
  yolkling: { label: 'Yolkling', icon: 'sunny' },
};
const badgeList = (keys) => Object.keys(BADGES).filter((k) => keys.includes(k))
  .map((k) => `<li class="badge badge--${k}"><span class="icon" aria-hidden="true">${BADGES[k].icon}</span>${BADGES[k].label}</li>`).join('');

const YolkieAuth = (() => {
  const KEY = 'yolkie-session';
  try {
    // Before accounts, the admin page kept its own sign-in. Carry it over once.
    const old = localStorage.getItem('yolkie-admin-session');
    if (old && !localStorage.getItem(KEY)) localStorage.setItem(KEY, old);
    localStorage.removeItem('yolkie-admin-session');
  } catch (e) {}
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const save = () => { try { if (session) localStorage.setItem(KEY, JSON.stringify(session)); else localStorage.removeItem(KEY); } catch (e) {} };
  const fromTokens = (t, name) => ({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Number(t.expires_at) || Math.floor(Date.now() / 1000) + (Number(t.expires_in) || 3600),
    ...(name ? { name } : {}),
  });
  let session = read();
  const watchers = [];
  // Signing out (or the login ending) also ends a pass that was only for this sign-in.
  const changed = () => { save(); if (!session) dropTemporaryDevice(); watchers.forEach((fn) => fn(session)); };
  const expired = () => session && session.expires_at - 60 < Date.now() / 1000;

  // A remembered browser's pass (see supabase/accounts.sql): sent with every request, so the database
  // can skip the 2FA code here until it runs out.
  const DEVICE_KEY = 'yolkie-device';
  const device = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DEVICE_KEY));
      return d && d.expires_at > Date.now() ? d.token : '';
    } catch (e) { return ''; }
  };
  // `temporary`: a backup code used without "remember this device" only covers this sign-in.
  const setDevice = (token, days, temporary = false) => { try { localStorage.setItem(DEVICE_KEY, JSON.stringify({ token, expires_at: Date.now() + days * 86400000, temporary })); } catch (e) {} };
  const forgetDevice = () => { try { localStorage.removeItem(DEVICE_KEY); } catch (e) {} };
  function dropTemporaryDevice() {
    try { if ((JSON.parse(localStorage.getItem(DEVICE_KEY)) || {}).temporary) forgetDevice(); } catch (e) {}
  }
  // How far this login has got: 'aal2' once a code from the authenticator app was entered.
  const aal = () => {
    try { return JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal || 'aal1'; } catch (e) { return 'aal1'; }
  };

  // Supabase sends people back with tokens, or an error, after the # in the address. Keep the tokens,
  // then clean the address so they don't sit in the history or get copied. Returns what happened.
  function takeFromLink() {
    if (!/access_token|error/.test(location.hash)) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error')) return { error: p.get('error_code') || p.get('error'), type: '' };
    session = fromTokens(Object.fromEntries(p));
    changed();
    return { type: p.get('type') || 'signin' };
  }

  async function refresh() {
    if (!session || !session.refresh_token) return false;
    try {
      const res = await fetch(`${sbBase()}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) return false;
      session = fromTokens(await res.json(), session.name);
      changed();
      return true;
    } catch (e) { return false; }
  }

  // A request as the signed-in person. Throws an Error with .status; .signedOut when the login has ended.
  async function api(path, opts = {}, retried = false) {
    if (!session) throw Object.assign(new Error('signed out'), { signedOut: true });
    if (expired()) await refresh();
    const res = await fetch(`${sbBase()}${path}`, {
      ...opts,
      headers: {
        apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`,
        ...(device() ? { 'x-yolkie-device': device() } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}),
      },
    });
    if (res.status === 401 && !retried && (await refresh())) return api(path, opts, true);
    if (res.status === 401) { session = null; changed(); throw Object.assign(new Error('signed out'), { signedOut: true, status: 401 }); }
    if (!res.ok) {
      // Keep Supabase's explanation (its error code or the database's message) for the page to read.
      const data = await res.json().catch(() => ({}));
      throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, code: data.error_code || data.message || data.msg || '' });
    }
    return res;
  }

  // Signing in, signing up and password resets. Resolves { ok, status, code, data }; `code` is
  // Supabase's error code (invalid_credentials, weak_password…) when it isn't ok.
  async function call(path, body, back) {
    const url = `${sbBase()}/auth/v1/${path}${back ? `${path.includes('?') ? '&' : '?'}redirect_to=${encodeURIComponent(back)}` : ''}`;
    const res = await fetch(url, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) { session = fromTokens(data); changed(); }
    return { ok: res.ok, status: res.status, code: res.ok ? '' : data.error_code || data.error || data.code || '', data };
  }

  // Which ways in are switched on in Supabase, so the page only offers those.
  async function settings() {
    const res = await fetch(`${sbBase()}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function signOut() {
    const token = session && session.access_token;
    session = null;
    changed();
    if (token) fetch(`${sbBase()}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
  }

  return {
    get session() { return session; },
    takeFromLink, refresh, api, call, settings, signOut,
    // GitHub, Google and Apple sign in on their own page, then send people back to `back`.
    providerUrl: (provider, back) => `${sbBase()}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(back)}`,
    forget: () => { session = null; changed(); },
    // New tokens from Supabase (after an authenticator code), keeping the name.
    useTokens: (t) => { session = fromTokens(t, session && session.name); changed(); },
    aal, device, setDevice, forgetDevice,
    setName: (name) => { if (session) { session.name = name; changed(); } },
    expired,
    onChange: (fn) => watchers.push(fn),
    // Another tab signed in, out, or renewed the login: pick that up instead of using a stale one.
    reread: () => { session = read(); watchers.forEach((fn) => fn(session)); },
  };
})();

// The header's account link says who's signed in on every page.
function paintAccountLink() {
  const s = YolkieAuth.session;
  document.querySelectorAll('.js-account-link').forEach((a) => {
    const label = a.querySelector('.js-account-label');
    if (label) label.textContent = s ? (s.name || 'Account') : 'Sign in';
    a.classList.toggle('is-signed-in', !!s);
  });
}
paintAccountLink();
YolkieAuth.onChange(paintAccountLink);
// Supabase falls back to the home page when a link's address isn't on its allowed list (an invite sent
// from the dashboard, say). Carry the sign-in on to the account page, which knows what to do with it.
if (/access_token=|error_code=/.test(location.hash) && !document.querySelector('.js-acct-signin')) {
  location.replace(`account.html${location.hash}`);
}
window.addEventListener('storage', (e) => { if (e.key === 'yolkie-session') YolkieAuth.reread(); });

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
  box.innerHTML = Array.from({ length: 32 }, (_, k) => {
    const size = 8 + Math.random() * 12;
    return `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--s:${size.toFixed(0)}px;--c:${colors[k % 4]};--r:${shapes[k % 3]};--d:calc(var(--dur-l) * ${(3 + Math.random() * 2.5).toFixed(2)});--delay:calc(var(--dur-l) * ${Math.random().toFixed(2)});--rot:${Math.round(Math.random() * 720 - 360)}deg;--fall:${Math.round(260 + Math.random() * 220)}px"></i>`;
  }).join('');
  setTimeout(() => { box.innerHTML = ''; }, 3200);
}

// Motion tokens, read from the stylesheet so scripted motion matches the CSS.
const durL = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-l')) || 400;

// Numbers that count up to a new value (meals cooked at home, and what that saved). `key` remembers the last value
// shown, so a number only moves when it changed. Instant with reduced motion.
const lastCount = {};
function countTo(el, key, to, pre = '', from = lastCount[key]) {
  if (!el) return;
  cancelAnimationFrame(el.countRaf || 0);
  // Off screen (a hidden tab): show the number, but keep the old one so it counts up when you look.
  if (!el.getClientRects().length) { el.textContent = `${pre}${to}`; return; }
  lastCount[key] = to;
  if (from === undefined || from === to || reduceMotion) { el.textContent = `${pre}${to}`; return; }
  const dur = durL() * 2;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = `${pre}${Math.round(from + (to - from) * (1 - (1 - k) ** 3))}`;
    if (k < 1) el.countRaf = requestAnimationFrame(step);
  };
  el.textContent = `${pre}${from}`;
  el.countRaf = requestAnimationFrame(step);
}
const countUps = (box) => box.querySelectorAll('[data-count]').forEach((el) => countTo(el, el.dataset.count, Number(el.dataset.to), el.dataset.pre || ''));

// Sounds, made on the spot with the Web Audio API (no audio files). The demo decides when they play:
// the timer chime is on by default, the celebration sound is off until it's turned on in Preferences.
const Sound = (() => {
  let ctx = null;
  const get = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  // One soft bell: a triangle note with two quiet overtones, a quick start and a long, gentle fade.
  function bell(ac, at, freq, len, vol) {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    out.gain.exponentialRampToValueAtTime(0.0001, at + len);
    out.connect(ac.destination);
    [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]].forEach(([mult, type, level]) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      g.gain.value = level;
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + len + 0.05);
    });
  }
  const play = (notes, len, vol) => {
    const ac = get();
    if (!ac) return;
    const t = ac.currentTime + 0.03;
    notes.forEach(([f, d]) => bell(ac, t + d, f, len, vol));
  };
  return {
    unlock: get, // call it from a tap, so the browser lets later sounds play
    chime: () => play([[659.25, 0], [830.61, 0.16], [987.77, 0.32], [1318.51, 0.5]], 1.6, 0.16), // E, G sharp, B, E: a rising bell
    cheer: () => play([[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.3]], 0.9, 0.1),
  };
})();

// Waitlist form: Yolkie watches you fill it in, then it saves to the `waitlist` table. Arriving from
// the help page (./?from=help#early-access) marks the sign-up's source as "help".
const signup = document.querySelector('.js-signup');
if (signup) {
  const face = signup.querySelector('.js-signup-yolk');
  const dir = face.getAttribute('src').replace(/[^/]+$/, '');
  const email = signup.querySelector('input[type="email"]');
  const mustHave = signup.querySelector('[name="must_have"]');
  const status = signup.querySelector('.js-signup-status');
  const submit = signup.querySelector('[type="submit"]');
  const retry = signup.querySelector('.js-signup-retry');
  const source = new URLSearchParams(location.search).get('from') === 'help' ? 'help' : 'landing';
  ['happy', 'meh', 'sleepy', 'surprised'].forEach((m) => { new Image().src = `${dir}yolk-${m}.svg`; });
  const setFace = (m, cls) => {
    if (!face.getAttribute('src').endsWith(`yolk-${m}.svg`)) face.src = `${dir}yolk-${m}.svg`;
    replay(face, cls);
  };
  const say = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };
  const looksValid = () => email.validity.valid && EMAIL_OK.test(email.value.trim()) && email.value.trim().length <= 254;

  email.addEventListener('focus', () => { if (!looksValid() && !email.getAttribute('aria-invalid')) setFace('surprised'); });
  email.addEventListener('input', () => {
    if (email.getAttribute('aria-invalid')) { email.removeAttribute('aria-invalid'); say(''); }
    const mood = looksValid() ? 'happy' : 'surprised';
    if (!face.getAttribute('src').endsWith(`yolk-${mood}.svg`)) setFace(mood);
  });
  email.addEventListener('blur', () => { if (!email.value) setFace('default'); });

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
    retry.hidden = true;
    if (!looksValid()) {
      email.setAttribute('aria-invalid', 'true');
      setFace('meh');
      say(email.value.trim() ? 'Hmm, that email looks a little scrambled. Mind checking it?' : 'Pop your email in first, and Yolkie will save you a seat.', true);
      email.focus();
      return;
    }
    if (signup.elements.company.value) { finish(); return; } // filled spam trap: look successful, send nothing
    if (sentRecently('waitlist')) {
      setFace('sleepy');
      say('You just signed up a moment ago! Give it 30 seconds, then try again.', true);
      return;
    }
    submit.disabled = true;
    say('Sending…');
    try {
      const result = await sbInsert('waitlist', { email: email.value.trim().toLowerCase(), must_have: mustHave.value.trim() || null, source });
      markSent('waitlist');
      say('');
      if (result === 'duplicate') finish('You’re already on the list!', 'No need to sign up twice. We’ll email you when Yolkie has something to tap.');
      else finish();
    } catch (err) {
      setFace('meh');
      say(sendFailed(), true);
      retry.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  retry.addEventListener('click', () => signup.requestSubmit());

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

/* ---------- The help page (help.html) ---------- */

// Search filters the sections as you type, opening every match; clearing it puts back what was open.
// Arriving at help.html#water (or tapping it in the contents) opens that section.
const helpSearch = document.querySelector('.js-help-search');
if (helpSearch) {
  const secs = [...document.querySelectorAll('.help-sec')];
  const tocItems = [...document.querySelectorAll('.js-help-toc li')];
  const count = document.querySelector('.js-help-count');
  const empty = document.querySelector('.js-help-empty');
  let before = null;
  const openFromHash = () => {
    const sec = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (sec && sec.matches('.help-sec')) sec.open = true;
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
  document.querySelector('.js-help-toc').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    const sec = a && document.getElementById(a.getAttribute('href').slice(1));
    if (sec) sec.open = true;
  });
  helpSearch.addEventListener('input', () => {
    const term = helpSearch.value.trim().toLowerCase();
    if (term && !before) before = secs.map((sec) => sec.open);
    let n = 0;
    secs.forEach((sec, k) => {
      const hit = !term || sec.textContent.toLowerCase().includes(term);
      sec.hidden = !hit;
      tocItems[k].hidden = !hit;
      if (hit && term) { sec.open = true; n += 1; }
    });
    if (!term && before) { secs.forEach((sec, k) => { sec.open = before[k]; }); before = null; }
    count.textContent = term ? (n ? `${n} ${n === 1 ? 'section matches' : 'sections match'}.` : '') : '';
    empty.hidden = !term || n > 0;
  });
}

/* ---------- The feedback page (feedback.html) ---------- */

// A star rating (the only required answer), what they tried, and whether it's a bug or an idea, which
// each open their own questions. Screenshots upload to the private bucket first, then the note saves to
// the `feedback` table with their paths. `page` is where the form was opened from: ?from=… on the link,
// or else the page it was reached from on this site.
const fb = document.querySelector('.js-fb');
if (fb) {
  const f = fb.elements;
  const face = fb.querySelector('.js-fb-yolk');
  const dir = face.getAttribute('src').replace(/[^/]+$/, '');
  const status = fb.querySelector('.js-fb-status');
  const submit = fb.querySelector('[type="submit"]');
  const retry = fb.querySelector('.js-fb-retry');
  const noShots = fb.querySelector('.js-fb-noshots');
  let skipFiles = false;
  const bugBox = fb.querySelector('.js-fb-bug');
  const ideaBox = fb.querySelector('.js-fb-idea');
  const fileInput = fb.querySelector('.js-fb-file');
  const upload = fb.querySelector('.js-fb-upload');
  const shotList = fb.querySelector('.js-fb-shots');
  const ratingText = fb.querySelector('.js-fb-rating-text');
  const stars = [...fb.querySelectorAll('input[name="rating"]')];
  const MAX_SHOTS = 3;
  const MAX_BYTES = 10 * 1024 * 1024;
  const LONG = 2000;
  // File types the storage bucket takes, by extension.
  const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
  const RATING_WORDS = ['', 'Not great', 'Could be better', 'It’s okay', 'Pretty good', 'Loved it'];
  const RATING_FACES = ['', 'meh', 'meh', 'default', 'happy', 'happy'];
  const shots = []; // { file, url, path once uploaded }

  const page = (() => {
    const from = new URLSearchParams(location.search).get('from');
    if (from) return from.slice(0, 200);
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === location.origin) return ref.pathname.replace(/^.*\//, '').replace(/\.html$/, '') || 'home';
    } catch (e) {}
    return 'direct';
  })();

  ['happy', 'meh', 'sleepy'].forEach((m) => { new Image().src = `${dir}yolk-${m}.svg`; });
  const setFace = (m, cls) => {
    if (!face.getAttribute('src').endsWith(`yolk-${m}.svg`)) face.src = `${dir}yolk-${m}.svg`;
    replay(face, cls);
  };
  const say = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };
  const val = (name) => f[name].value.trim();

  // Messages under a field, tied to it with aria-describedby so screen readers hear them too.
  const errFor = (name) => fb.querySelector(`[data-err="${name}"]`);
  const flag = (name, msg, el) => {
    const err = errFor(name);
    err.textContent = msg;
    err.hidden = false;
    if (el.matches('input:not([type="radio"]), textarea')) el.setAttribute('aria-invalid', 'true');
  };
  const unflag = (name) => {
    const err = errFor(name);
    if (!err || err.hidden) return;
    err.hidden = true;
    err.textContent = '';
    fb.querySelectorAll(`[name="${name}"][aria-invalid]`).forEach((el) => el.removeAttribute('aria-invalid'));
  };

  // Stars fill up to the one you pick (or point at), and Yolkie reacts.
  const paint = (n) => stars.forEach((s) => s.closest('.star').classList.toggle('is-on', Number(s.value) <= n));
  stars.forEach((s) => {
    const label = s.closest('.star');
    label.addEventListener('pointerenter', () => paint(Number(s.value)));
    label.addEventListener('pointerleave', () => paint(Number(f.rating.value) || 0));
  });

  const showBranches = () => {
    const kind = f.kind.value;
    bugBox.hidden = !['bug', 'both'].includes(kind);
    ideaBox.hidden = !['idea', 'both'].includes(kind);
  };

  fb.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'rating') {
      const n = Number(t.value);
      paint(n);
      ratingText.textContent = RATING_WORDS[n];
      setFace(RATING_FACES[n], n === 5 ? 'is-celebrating' : undefined);
      unflag('rating');
    }
    if (t.name === 'kind') showBranches();
  });
  fb.addEventListener('input', (e) => { if (e.target.name) unflag(e.target.name); });

  // Screenshots: up to three images or videos, 10 MB each, with a preview and a remove button.
  const extOf = (file) => {
    const m = /\.([a-z0-9]{2,5})$/i.exec(file.name);
    const byName = m && m[1].toLowerCase();
    return Object.values(EXT).includes(byName) ? byName : EXT[file.type] || (byName === 'jpeg' ? 'jpeg' : '');
  };
  function renderShots() {
    shotList.innerHTML = shots.map((s, i) => {
      const isVideo = s.file.type.startsWith('video/');
      const thumb = isVideo
        ? `<video src="${s.url}" muted playsinline preload="metadata" aria-hidden="true"></video>`
        : `<img src="${s.url}" alt="" aria-hidden="true">`;
      return `<li class="fb-shot">${thumb}<span class="fb-shot__name">${esc(s.file.name)}</span>
        <button type="button" class="icon-btn fb-shot__remove" data-remove="${i}" aria-label="Remove ${esc(s.file.name)}"><span class="icon" aria-hidden="true">close</span></button></li>`;
    }).join('');
    const full = shots.length >= MAX_SHOTS;
    fileInput.disabled = full;
    upload.classList.toggle('is-disabled', full);
    fb.querySelector('.js-fb-shot-count').textContent = shots.length ? `${shots.length} of ${MAX_SHOTS} added.` : '';
  }
  fileInput.addEventListener('change', () => {
    const notes = new Set();
    [...fileInput.files].forEach((file) => {
      if (shots.length >= MAX_SHOTS) { notes.add(`Only ${MAX_SHOTS} files fit, so some were left out.`); return; }
      if (!/^(image|video)\//.test(file.type) || !extOf(file)) { notes.add(`${file.name} isn’t an image or video type we can take.`); return; }
      if (file.size > MAX_BYTES) { notes.add(`${file.name} is over 10 MB.`); return; }
      shots.push({ file, url: URL.createObjectURL(file) });
    });
    fileInput.value = '';
    renderShots();
    if (notes.size) flag('screenshots', [...notes].join(' '), fileInput);
    else unflag('screenshots');
  });
  shotList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const [gone] = shots.splice(Number(b.dataset.remove), 1);
    URL.revokeObjectURL(gone.url);
    renderShots();
    unflag('screenshots');
    fileInput.focus();
  });

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

  const finish = () => {
    fb.querySelector('.js-fb-fields').hidden = true;
    const done = fb.querySelector('.js-fb-done');
    done.hidden = false;
    done.querySelector('.js-fb-done-title').focus({ preventScroll: true });
    done.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    setFace('happy', 'is-celebrating');
    confetti(fb.querySelector('.js-fb-confetti'));
    shots.forEach((s) => URL.revokeObjectURL(s.url));
  };

  fb.addEventListener('submit', async (e) => {
    e.preventDefault();
    retry.hidden = true;
    const kind = f.kind.value || null;
    const isBug = kind === 'bug' || kind === 'both';
    const isIdea = kind === 'idea' || kind === 'both';
    const rating = Number(f.rating.value) || 0;
    const problems = [];
    if (!rating) problems.push(['rating', 'Pick a rating first: tap a star.', stars[0]]);
    if (isBug && !val('what_happened')) problems.push(['what_happened', 'Tell us what happened, even in a few words.', f.what_happened]);
    if (isIdea && !val('idea')) problems.push(['idea', 'Tell us your idea, even in a few words.', f.idea]);
    ['what_happened', 'idea', 'anything_else'].forEach((name) => {
      if (val(name).length > LONG) problems.push([name, 'That’s a little long. Keep it under 2,000 characters.', f[name]]);
    });
    if (val('email') && (!EMAIL_OK.test(val('email')) || val('email').length > 254)) problems.push(['email', 'That email looks a little scrambled. Mind checking it?', f.email]);
    if (problems.length) {
      problems.forEach(([name, msg, el]) => flag(name, msg, el));
      problems[0][2].focus();
      setFace('meh');
      say(problems.length === 1 ? 'One thing to fix before this can send.' : `${problems.length} things to fix before this can send.`, true);
      return;
    }
    if (f.company.value) { finish(); return; } // filled spam trap: look successful, send nothing
    if (sentRecently('feedback')) {
      setFace('sleepy');
      say('You sent a note a moment ago! Give it 30 seconds, then send this one.', true);
      return;
    }
    // Files go with every kind of note. If uploading them fails, the note can still go without them.
    const toUpload = skipFiles ? shots.filter((s) => s.path) : shots;
    submit.disabled = true;
    noShots.hidden = true;
    say(toUpload.length ? 'Uploading…' : 'Sending…');
    try {
      const day = new Date().toISOString().slice(0, 10);
      try {
        for (const s of toUpload) {
          if (s.path) continue; // already uploaded on an earlier try
          const path = `${day}/${uid()}.${extOf(s.file)}`;
          await sbUpload('feedback-screenshots', path, s.file);
          s.path = path;
        }
      } catch (err) {
        setFace('meh');
        say('The files didn’t upload. Try again, or send your note without them. Everything you typed is still here.', true);
        retry.hidden = false;
        noShots.hidden = false;
        return;
      }
      await sbInsert('feedback', {
        rating,
        tried: [...fb.querySelectorAll('input[name="tried"]:checked')].map((c) => c.value),
        kind,
        what_happened: isBug ? val('what_happened') : null,
        device: isBug ? f.device.value || null : null,
        idea: isIdea ? val('idea') : null,
        anything_else: val('anything_else') || null,
        email: val('email').toLowerCase() || null,
        screenshot_paths: toUpload.map((s) => s.path).filter(Boolean),
        page,
        app_version: APP_VERSION,
      });
      markSent('feedback');
      say('');
      finish();
    } catch (err) {
      setFace('meh');
      say(sendFailed(), true);
      retry.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  retry.addEventListener('click', () => { skipFiles = false; fb.requestSubmit(); });
  noShots.addEventListener('click', () => { skipFiles = true; fb.requestSubmit(); });
}
