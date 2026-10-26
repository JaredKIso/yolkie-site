/* Yolkie account page (account.html). Loaded after main.js, which provides YolkieAuth, BADGES and the
   Supabase settings. People sign in with GitHub, Google, Apple or an email and password; whichever of
   those is switched on in Supabase shows up here. Nothing typed is written to the console. */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const A = YolkieAuth;
  const back = location.origin + location.pathname;
  const VIEWS = ['loading', 'signin', 'check', 'newpass', 'me', 'gone'];
  const show = (name) => VIEWS.forEach((v) => { $(`.js-acct-${v}`).hidden = v !== name; });
  const focusIn = (sel) => { const h = $(`${sel} [tabindex="-1"]`); if (h) h.focus(); };

  // Supabase's error codes, in Yolkie's words.
  const MSG = {
    invalid_credentials: 'That email and password don’t match. Try again, or reset your password.',
    invalid_grant: 'That email and password don’t match. Try again, or reset your password.',
    email_not_confirmed: 'Confirm your email first. The link is in your inbox.',
    weak_password: 'Pick a stronger password: at least 8 characters, and not a common one.',
    same_password: 'That’s your current password. Pick a new one.',
    signup_disabled: 'Sign-ups are closed right now.',
    email_provider_disabled: 'Email sign-in is switched off right now. Try one of the buttons above.',
    captcha_failed: 'The robot check didn’t pass. Give it another go.',
    over_request_rate_limit: 'Too many tries just now. Wait a minute, then try again.',
    over_email_send_rate_limit: 'Too many emails just now. Wait a minute, then try again.',
    user_already_exists: 'That email already has an account. Sign in instead.',
    email_exists: 'That email already has an account. Sign in instead.',
    otp_expired: 'That link has expired or was already used. Ask for a new one.',
    access_denied: 'Signing in was cancelled. Pick a way in to try again.',
  };
  const say = (el, code) => {
    el.textContent = code ? MSG[code] || 'That didn’t go through. Check your connection and try again.' : '';
    el.classList.toggle('is-error', !!code);
  };

  /* ---------- Signed out ---------- */
  const form = $('.js-acct-form');
  const status = $('.js-acct-status');
  const emailIn = $('#acct-email');
  const passIn = $('#acct-pass');
  let mode = 'signin';
  let signupsOpen = true;

  function setMode(m) {
    mode = m;
    const up = m === 'signup';
    $('.js-acct-title').textContent = up ? 'Make your Yolkie account' : 'Sign in to Yolkie';
    $('.js-acct-lede').textContent = up ? 'Pick one. It only takes a moment.' : 'Welcome back! Pick how you joined.';
    $('.js-acct-name-field').hidden = !up;
    $('.js-acct-pass-note').hidden = !up;
    $('.js-acct-forgot').hidden = up;
    passIn.autocomplete = up ? 'new-password' : 'current-password';
    $('.js-acct-submit-label').textContent = up ? 'Make my account' : 'Sign in';
    $('.js-acct-mode').textContent = up ? 'Have an account? Sign in' : 'New here? Make an account';
    $('.js-acct-mode').hidden = !signupsOpen;
    say(status, '');
  }
  $('.js-acct-mode').addEventListener('click', () => { setMode(mode === 'signin' ? 'signup' : 'signin'); $('.js-acct-title').focus(); });

  $('.js-acct-show').addEventListener('click', (e) => {
    const b = e.currentTarget;
    const on = passIn.type === 'password';
    passIn.type = on ? 'text' : 'password';
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
    $('.icon', b).textContent = on ? 'visibility_off' : 'visibility';
  });

  // Cloudflare Turnstile: Supabase checks its token on every email sign-in, sign-up and reset when
  // bot protection is on. Each token works once, so the widget resets after every try.
  let captchaToken = '';
  let widget = null;
  function loadCaptcha() {
    if (!TURNSTILE_SITE_KEY) return;
    const box = $('.js-acct-captcha');
    box.hidden = false;
    window.yolkieTurnstileReady = () => {
      widget = window.turnstile.render(box, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
        callback: (t) => { captchaToken = t; },
        'expired-callback': () => { captchaToken = ''; },
        'error-callback': () => { captchaToken = ''; },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=yolkieTurnstileReady';
    s.async = true;
    document.head.append(s);
  }
  const captchaReady = () => !TURNSTILE_SITE_KEY || !!captchaToken;
  const captchaUsed = () => { captchaToken = ''; if (widget !== null && window.turnstile) window.turnstile.reset(widget); };
  const security = () => (captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {});

  function showSignin(code = '') {
    show('signin');
    setMode(mode);
    say(status, code);
  }
  function showCheck(text) {
    $('.js-acct-check-text').textContent = text;
    show('check');
    focusIn('.js-acct-check');
  }
  $('.js-acct-back').addEventListener('click', () => { showSignin(); emailIn.focus(); });

  $$('[data-provider]').forEach((b) => b.addEventListener('click', () => {
    location.assign(A.providerUrl(b.dataset.provider, back));
  }));

  function checkEmail() {
    const email = emailIn.value.trim().toLowerCase();
    const ok = EMAIL_OK.test(email) && email.length <= 254;
    emailIn.setAttribute('aria-invalid', !ok);
    if (!ok) { status.textContent = 'That email looks a little scrambled. Mind checking it?'; status.classList.add('is-error'); emailIn.focus(); }
    return ok ? email : '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = checkEmail();
    if (!email) return;
    const password = passIn.value;
    const min = mode === 'signup' ? 8 : 1;
    passIn.setAttribute('aria-invalid', password.length < min);
    if (password.length < min) {
      status.textContent = mode === 'signup' ? 'Your password needs at least 8 characters.' : 'Type your password, or reset it below.';
      status.classList.add('is-error');
      passIn.focus();
      return;
    }
    if (!captchaReady()) { status.textContent = 'Finish the robot check first.'; status.classList.add('is-error'); return; }
    const btn = $('.js-acct-submit');
    btn.disabled = true;
    status.classList.remove('is-error');
    status.textContent = mode === 'signup' ? 'Making your account…' : 'Signing in…';
    try {
      const r = mode === 'signup'
        ? await A.call('signup', { email, password, data: { display_name: $('#acct-name').value.trim().slice(0, 40) || undefined }, ...security() }, back)
        : await A.call('token?grant_type=password', { email, password, ...security() });
      captchaUsed();
      if (!r.ok) { say(status, r.code || 'x'); return; }
      passIn.value = '';
      if (A.session) { enter(mode === 'signup' ? 'Welcome to Yolkie!' : ''); return; }
      showCheck(`We sent a link to ${email}. Tap it to finish making your account. It works once, in this browser.`);
    } catch (err) {
      say(status, 'x');
    } finally {
      btn.disabled = false;
    }
  });

  $('.js-acct-forgot').addEventListener('click', async () => {
    const email = checkEmail();
    if (!email) return;
    if (!captchaReady()) { status.textContent = 'Finish the robot check first, then tap “Forgot your password?” again.'; status.classList.add('is-error'); return; }
    status.classList.remove('is-error');
    status.textContent = 'Sending…';
    try {
      const r = await A.call('recover', { email, ...security() }, back);
      captchaUsed();
      // Any answer but "slow down" looks the same, so this never reveals which emails have accounts.
      if (!r.ok && /rate_limit|captcha/.test(r.code)) { say(status, r.code); return; }
      showCheck(`If ${email} has a Yolkie account, a link to pick a new password is on its way.`);
    } catch (err) { say(status, 'x'); }
  });

  /* ---------- New password, from the reset email ---------- */
  $('.js-acct-newpass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('.js-acct-newpass-status');
    const password = $('#acct-newpass').value;
    if (password.length < 8) { out.textContent = 'Your password needs at least 8 characters.'; out.classList.add('is-error'); return; }
    out.classList.remove('is-error');
    out.textContent = 'Saving…';
    try {
      await A.api('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) });
      $('#acct-newpass').value = '';
      enter('Your new password is saved.');
    } catch (err) {
      if (err.signedOut) { showSignin('otp_expired'); return; }
      say(out, err.status === 422 ? 'weak_password' : 'x');
    }
  });

  /* ---------- Signed in ---------- */
  let me = null;
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const PROVIDER = { email: 'Email and password', github: 'GitHub', google: 'Google', apple: 'Apple' };

  async function enter(note = '') {
    let next = '';
    try { next = sessionStorage.getItem('yolkie-next'); sessionStorage.removeItem('yolkie-next'); } catch (e) {}
    if (next === 'admin') { location.replace('admin.html'); return; }
    show('loading');
    try {
      const user = await A.api('/auth/v1/user').then((r) => r.json());
      const [profile, badges, admin] = await Promise.all([
        A.api(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=display_name,created_at`).then((r) => r.json()).then((r) => r[0] || null).catch(() => null),
        A.api(`/rest/v1/user_badges?user_id=eq.${encodeURIComponent(user.id)}&select=badge`).then((r) => r.json()).then((r) => r.map((b) => b.badge)).catch(() => []),
        A.api('/rest/v1/rpc/is_yolkie_admin', { method: 'POST', body: '{}' }).then((r) => r.json()).catch(() => false),
      ]);
      const meta = user.user_metadata || {};
      const name = (profile && profile.display_name) || meta.display_name || meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Yolkie friend';
      me = { id: user.id, name, admin: admin === true };
      A.setName(name);
      $('#acct-me-name').textContent = name;
      $('.js-acct-badges').innerHTML = badgeList([...badges, ...(me.admin ? ['admin'] : [])]);
      $('.js-acct-badges').hidden = !$('.js-acct-badges').children.length;
      $('.js-acct-email').textContent = user.email || 'Not shared';
      const via = (user.app_metadata && user.app_metadata.providers) || [];
      $('.js-acct-via').textContent = via.map((p) => PROVIDER[p] || p).join(', ') || 'Email';
      $('.js-acct-joined').textContent = fmtDate((profile && profile.created_at) || user.created_at);
      $('#acct-rename').value = name;
      $('.js-acct-admin').hidden = !me.admin;
      $('.js-acct-msg').textContent = note;
      show('me');
      $('#acct-me-name').focus();
    } catch (err) {
      if (err.signedOut) showSignin(''); else { showSignin(''); say(status, 'x'); }
    }
  }

  $('.js-acct-rename').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('.js-acct-rename-status');
    const name = $('#acct-rename').value.trim().slice(0, 40);
    if (!name) { out.textContent = 'Your name can’t be empty.'; out.classList.add('is-error'); return; }
    out.classList.remove('is-error');
    out.textContent = 'Saving…';
    try {
      await A.api(`/rest/v1/profiles?id=eq.${encodeURIComponent(me.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ display_name: name }) });
      me.name = name;
      A.setName(name);
      $('#acct-me-name').textContent = name;
      out.textContent = 'Saved.';
    } catch (err) {
      out.textContent = 'Couldn’t save. Check your connection and try again.';
      out.classList.add('is-error');
    }
  });

  $('.js-acct-signout').addEventListener('click', () => { A.signOut(); me = null; showSignin(); $('.js-acct-title').focus(); });

  /* ---------- Delete my account ---------- */
  const confirmBox = $('.js-acct-confirm');
  const word = $('#acct-confirm-word');
  const go = $('.acct-danger__go');
  $('.js-acct-delete').addEventListener('click', () => {
    word.value = '';
    go.disabled = true;
    say($('.js-acct-confirm-status'), '');
    confirmBox.showModal();
    word.focus();
  });
  word.addEventListener('input', () => { go.disabled = word.value.trim().toLowerCase() !== 'delete'; });
  confirmBox.addEventListener('click', (e) => { if (e.target.closest('.js-close') || e.target === confirmBox) confirmBox.close(); });
  $('.js-acct-confirm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (go.disabled) return;
    const out = $('.js-acct-confirm-status');
    go.disabled = true;
    out.classList.remove('is-error');
    out.textContent = 'Deleting…';
    try {
      await A.api('/rest/v1/rpc/delete_my_account', { method: 'POST', body: '{}' });
      A.forget();
      me = null;
      confirmBox.close();
      show('gone');
      focusIn('.js-acct-gone');
    } catch (err) {
      out.textContent = 'Couldn’t delete your account just now. Check your connection and try again.';
      out.classList.add('is-error');
      go.disabled = false;
    }
  });

  /* ---------- Start ---------- */
  async function start() {
    if (new URLSearchParams(location.search).get('next') === 'admin') {
      try { sessionStorage.setItem('yolkie-next', 'admin'); } catch (e) {}
    }
    const link = A.takeFromLink();
    if (link && link.error) { showSignin(MSG[link.error] ? link.error : 'otp_expired'); return; }
    if (link && link.type === 'recovery') { show('newpass'); focusIn('.js-acct-newpass'); return; }
    if (A.session) { enter(link && link.type === 'signup' ? 'Your email is confirmed. Welcome to Yolkie!' : ''); return; }
    showSignin();
  }

  // Only offer the ways in that are switched on in Supabase.
  async function setup() {
    if (!supabaseReady()) { $('.js-acct-closed').hidden = false; return; }
    try {
      const s = await A.settings();
      const ext = s.external || {};
      let any = false;
      $$('[data-provider]').forEach((b) => { b.hidden = !ext[b.dataset.provider]; any = any || !b.hidden; });
      form.hidden = !ext.email;
      $('.js-acct-or').hidden = !(any && ext.email);
      signupsOpen = !s.disable_signup;
      $('.js-acct-closed').hidden = any || ext.email;
      if (ext.email) loadCaptcha();
    } catch (e) {
      form.hidden = false;
      say(status, 'x');
    }
    setMode(mode);
  }

  setup();
  start();
  window.addEventListener('hashchange', () => { if (/access_token|error/.test(location.hash)) start(); });
})();
