/* Yolkie account page (account.html). Loaded after main.js, which provides YolkieAuth, BADGES and the
   Supabase settings. People sign in with GitHub, Google, Apple or an email and password; whichever of
   those is switched on in Supabase shows up here. Nothing typed is written to the console. */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const A = YolkieAuth;
  const back = location.origin + location.pathname;
  const VIEWS = ['loading', 'signin', 'check', 'code', 'newpass', 'me', 'gone'];
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
    el.textContent = code ? MSG[code] || 'Hmm, that didn’t go through. Check your connection and give it another go.' : '';
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

  // Functions that return nothing (turning 2FA off, forgetting devices) answer with an empty reply.
  const rpc = (name, args = {}) => A.api(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) })
    .then((r) => r.text()).then((t) => (t ? JSON.parse(t) : null));
  const verifiedFactor = (user) => (user.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified') || null;

  async function enter(note = '') {
    show('loading');
    try {
      const user = await A.api('/auth/v1/user').then((r) => r.json());
      // 2FA is on and this login hasn't passed it: ask for a code, unless this browser is remembered.
      const factor = verifiedFactor(user);
      if (factor && A.aal() !== 'aal2' && (await rpc('yolkie_mfa_ok').catch(() => false)) !== true) {
        askCode('signin', factor.id, note);
        return;
      }
      let next = '';
      try { next = sessionStorage.getItem('yolkie-next'); sessionStorage.removeItem('yolkie-next'); } catch (e) {}
      if (next === 'admin') { location.replace('admin.html'); return; }
      const [profile, badges, adminStatus] = await Promise.all([
        A.api(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=display_name,created_at`).then((r) => r.json()).then((r) => r[0] || null).catch(() => null),
        A.api(`/rest/v1/user_badges?user_id=eq.${encodeURIComponent(user.id)}&select=badge`).then((r) => r.json()).then((r) => r.map((b) => b.badge)).catch(() => []),
        rpc('yolkie_admin_status').catch(() => rpc('is_yolkie_admin').then((a) => (a === true ? 'admin' : 'no')).catch(() => 'no')),
      ]);
      const admin = adminStatus === 'admin' || adminStatus === 'needs_2fa';
      const meta = user.user_metadata || {};
      const name = (profile && profile.display_name) || meta.display_name || meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Yolkie friend';
      me = { id: user.id, name, admin };
      A.setName(name);
      $('#acct-me-name').textContent = name;
      $('.js-acct-badges').innerHTML = badgeList([...badges, ...(me.admin ? ['admin'] : []), 'yolkling']);
      $('.js-acct-badges').hidden = !$('.js-acct-badges').children.length;
      $('.js-acct-email').textContent = user.email || 'Not shared';
      const via = (user.app_metadata && user.app_metadata.providers) || [];
      $('.js-acct-via').textContent = via.map((p) => PROVIDER[p] || p).join(', ') || 'Email';
      $('.js-acct-joined').textContent = fmtDate((profile && profile.created_at) || user.created_at);
      $('#acct-rename').value = name;
      $('.js-acct-admin').hidden = !me.admin;
      $('.js-acct-msg').textContent = note || (adminStatus === 'needs_2fa' ? 'The admin page needs two-step sign-in. Turn it on below.' : '');
      await paint2fa(user);
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

  /* ---------- The code step: after signing in, and before a password reset ---------- */
  const codeForm = $('.js-acct-code-form');
  const codeIn = $('#acct-code');
  const codeStatus = $('.js-acct-code-status');
  let code = { mode: 'signin', factor: '', backup: false, note: '' };
  const CODE_MSG = {
    wrong: 'That code didn’t work. Check it and try again.',
    slow: 'Too many wrong codes. Wait 15 minutes, then try again.',
    x: 'That didn’t go through. Check your connection and try again.',
  };
  function setBackup(on) {
    code.backup = on;
    $('.js-acct-code-label').textContent = on ? 'Backup code' : '6-digit code';
    $('.js-acct-code-lede').textContent = on ? 'Type one of the backup codes you saved when you turned on two-step sign-in. Each works once.' : 'Open your authenticator app and type the 6-digit code for Yolkie.';
    $('.js-acct-code-switch').textContent = on ? 'Use my authenticator app instead' : 'Use a backup code instead';
    codeIn.inputMode = on ? 'text' : 'numeric';
    codeIn.maxLength = on ? 11 : 6;
    codeIn.autocomplete = on ? 'off' : 'one-time-code';
    codeIn.value = '';
    codeStatus.textContent = '';
    codeStatus.classList.remove('is-error');
  }
  function askCode(mode, factor, note = '') {
    code = { mode, factor, backup: false, note };
    setBackup(false);
    $('.js-acct-code-title').textContent = mode === 'reset' ? 'First, your code' : 'Enter your code';
    // A password reset always asks, even on a remembered browser, so "remember" doesn't apply there.
    $('.js-acct-remember-wrap').hidden = mode === 'reset';
    $('.js-acct-remember').checked = false;
    show('code');
    focusIn('.js-acct-code');
  }
  // A code from the app makes this login "aal2"; Supabase sends back new tokens that say so.
  async function verifyAppCode(factor, digits) {
    const ch = await A.api(`/auth/v1/factors/${encodeURIComponent(factor)}/challenge`, { method: 'POST', body: '{}' }).then((r) => r.json());
    const t = await A.api(`/auth/v1/factors/${encodeURIComponent(factor)}/verify`, { method: 'POST', body: JSON.stringify({ challenge_id: ch.id, code: digits }) }).then((r) => r.json());
    A.useTokens(t);
  }
  const codeError = (err) => (/too_many/.test(err.code) ? 'slow' : (err.status === 422 || err.status === 400 || /wrong_code|mfa_verification|invalid/.test(err.code)) ? 'wrong' : 'x');
  $('.js-acct-code-switch').addEventListener('click', () => { setBackup(!code.backup); codeIn.focus(); });
  $('.js-acct-code-cancel').addEventListener('click', () => { A.signOut(); showSignin(); });
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = codeIn.value.trim();
    const remember = code.mode === 'signin' && $('.js-acct-remember').checked;
    const ok = code.backup ? val.replace(/[^a-z0-9]/gi, '').length === 10 : /^\d{6}$/.test(val.replace(/\s/g, ''));
    codeIn.setAttribute('aria-invalid', !ok);
    if (!ok) {
      codeStatus.textContent = code.backup ? 'Backup codes look like abcde-23456.' : 'Type the 6 digits from your app.';
      codeStatus.classList.add('is-error');
      codeIn.focus();
      return;
    }
    const btn = $('[type="submit"]', codeForm);
    btn.disabled = true;
    codeStatus.classList.remove('is-error');
    codeStatus.textContent = 'Checking…';
    try {
      if (code.backup) {
        // A wrong code comes back empty (so the database can count it towards the 5-tries limit).
        const pass = await rpc('use_backup_code', { code: val, remember });
        if (!pass) throw Object.assign(new Error('wrong_code'), { code: 'wrong_code' });
        A.setDevice(pass, remember ? 30 : 0.5, !remember);
      } else {
        await verifyAppCode(code.factor, val.replace(/\s/g, ''));
        if (remember) A.setDevice(await rpc('trust_this_device'), 30);
      }
      codeIn.value = '';
      codeStatus.textContent = '';
      if (code.mode === 'reset') { show('newpass'); focusIn('.js-acct-newpass'); } else enter(code.note);
    } catch (err) {
      if (err.signedOut) { showSignin('otp_expired'); return; }
      codeStatus.textContent = CODE_MSG[codeError(err)];
      codeStatus.classList.add('is-error');
      codeIn.select();
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Two-step sign-in on the account page ---------- */
  const box = (name) => ['off', 'setup', 'codes', 'on'].forEach((v) => { $(`.js-2fa-${v}`).hidden = v !== name; });
  const twoSay = (text, isError = false) => { const o = $('.js-2fa-status'); o.textContent = text; o.classList.toggle('is-error', isError); };
  let pending = null; // the authenticator being set up
  let shownCodes = [];

  async function paint2fa(user) {
    twoSay('');
    if (!verifiedFactor(user)) { box('off'); return; }
    box('on');
    const left = await rpc('backup_codes_left').catch(() => null);
    $('.js-2fa-left').textContent = left === null ? '' : left === 0
      ? 'You have no backup codes left. Make new ones so you can still get in without your phone.'
      : `${left} backup ${left === 1 ? 'code' : 'codes'} left${left <= 2 ? '. Make new ones soon.' : '.'}`;
  }

  $('.js-2fa-start').addEventListener('click', async () => {
    twoSay('Getting a code ready…');
    try {
      const user = await A.api('/auth/v1/user').then((r) => r.json());
      // Clear out any half-finished setup first, so the new one can take its place.
      for (const f of (user.factors || []).filter((x) => x.status !== 'verified')) {
        await A.api(`/auth/v1/factors/${encodeURIComponent(f.id)}`, { method: 'DELETE' }).catch(() => {});
      }
      const f = await A.api('/auth/v1/factors', { method: 'POST', body: JSON.stringify({ factor_type: 'totp', friendly_name: `Yolkie ${new Date().toISOString().slice(0, 16)}`, issuer: 'Yolkie' }) }).then((r) => r.json());
      pending = f.id;
      const qr = f.totp.qr_code;
      $('.js-2fa-qr').src = qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
      $('.js-2fa-secret').textContent = f.totp.secret.replace(/(.{4})/g, '$1 ').trim();
      $('#acct-2fa-code').value = '';
      $('.js-2fa-setup-status').textContent = '';
      twoSay('');
      box('setup');
      $('#acct-2fa-code').focus();
    } catch (err) {
      twoSay('Couldn’t start setting it up. Check your connection and try again.', true);
    }
  });
  $('.js-2fa-cancel').addEventListener('click', () => {
    if (pending) A.api(`/auth/v1/factors/${encodeURIComponent(pending)}`, { method: 'DELETE' }).catch(() => {});
    pending = null;
    box('off');
  });
  function showCodes(codes) {
    shownCodes = codes;
    $('.js-2fa-code-list').innerHTML = codes.map((c) => `<li><code>${esc(c)}</code></li>`).join('');
    box('codes');
    $('.js-2fa-copy').focus();
  }
  $('.js-2fa-setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('.js-2fa-setup-status');
    const digits = $('#acct-2fa-code').value.replace(/\s/g, '');
    if (!/^\d{6}$/.test(digits)) { out.textContent = 'Type the 6 digits from your app.'; out.classList.add('is-error'); return; }
    out.classList.remove('is-error');
    out.textContent = 'Checking…';
    try {
      await verifyAppCode(pending, digits);
      pending = null;
      out.textContent = '';
      showCodes(await rpc('create_backup_codes'));
      twoSay('Two-step sign-in is on.');
    } catch (err) {
      out.textContent = codeError(err) === 'wrong' ? CODE_MSG.wrong : CODE_MSG.x;
      out.classList.add('is-error');
    }
  });
  $('.js-2fa-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shownCodes.join('\n')); twoSay('Copied.'); } catch (e) { twoSay('Couldn’t copy. Select the codes and copy them instead.', true); }
  });
  $('.js-2fa-download').addEventListener('click', () => {
    const text = ['Yolkie backup codes', `Made ${new Date().toLocaleDateString()}`, 'Each code works once, in place of a code from your authenticator app.', '', ...shownCodes, ''].join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'yolkie-backup-codes.txt' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('.js-2fa-saved').addEventListener('click', () => { shownCodes = []; $('.js-2fa-code-list').innerHTML = ''; enter('Two-step sign-in is on.'); });

  // Replacing codes and turning 2FA off are tap-twice buttons, like "Clear all demo data" in the demo.
  function tapTwice(btn, again, run) {
    btn.addEventListener('click', async () => {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.dataset.label = btn.innerHTML;
        btn.textContent = again;
        setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.innerHTML = btn.dataset.label; } }, 5000);
        return;
      }
      delete btn.dataset.armed;
      btn.innerHTML = btn.dataset.label;
      btn.disabled = true;
      try { await run(); } catch (err) { twoSay('That didn’t go through. Check your connection and try again.', true); } finally { btn.disabled = false; }
    });
  }
  tapTwice($('.js-2fa-newcodes'), 'Tap again: your old codes stop working', async () => { showCodes(await rpc('create_backup_codes')); twoSay('Here are your new codes. The old ones no longer work.'); });
  tapTwice($('.js-2fa-off-btn'), 'Tap again to turn it off', async () => {
    const user = await A.api('/auth/v1/user').then((r) => r.json());
    const f = verifiedFactor(user);
    // With an app code this session, Supabase removes the authenticator itself; the database then
    // clears the backup codes and remembered browsers (and the authenticator, after a backup code).
    if (f && A.aal() === 'aal2') await A.api(`/auth/v1/factors/${encodeURIComponent(f.id)}`, { method: 'DELETE' });
    await rpc('turn_off_my_2fa');
    A.forgetDevice();
    await A.refresh();
    enter('Two-step sign-in is off.');
  });
  $('.js-2fa-forget').addEventListener('click', async () => {
    try {
      await rpc('forget_my_devices');
      A.forgetDevice();
      twoSay('Done. Every browser will ask for a code next time you sign in, this one too.');
    } catch (err) { twoSay('That didn’t go through. Check your connection and try again.', true); }
  });

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
      out.textContent = /2FA/.test(err.code) ? 'Sign out and back in with your code first, then try again.' : 'Couldn’t delete your account just now. Check your connection and try again.';
      out.classList.add('is-error');
      go.disabled = false;
    }
  });

  /* ---------- Start ---------- */
  // The emails link here with a one-time code (?token_hash=…&type=…) rather than to Supabase's own
  // address, so the links match the domain the email is sent from. Swap the code for a sign-in.
  const EMAIL_LINK = { signup: 'signup', email: 'signup', recovery: 'recovery', invite: 'invite', magiclink: 'signin', email_change: 'email_change' };
  async function takeFromEmail() {
    const q = new URLSearchParams(location.search);
    const hash = q.get('token_hash');
    const type = q.get('type');
    if (!hash || !EMAIL_LINK[type]) return null;
    history.replaceState(null, '', location.pathname);
    try {
      const r = await A.call('verify', { type, token_hash: hash });
      if (!r.ok || !A.session) return { error: r.code === 'otp_expired' || r.status === 403 ? 'otp_expired' : r.code || 'x' };
      return { type: EMAIL_LINK[type] };
    } catch (e) { return { error: 'x' }; }
  }

  async function start() {
    if (new URLSearchParams(location.search).get('next') === 'admin') {
      try { sessionStorage.setItem('yolkie-next', 'admin'); } catch (e) {}
    }
    if (new URLSearchParams(location.search).get('token_hash')) show('loading');
    const link = (await takeFromEmail()) || A.takeFromLink();
    if (link && link.error) { showSignin(MSG[link.error] ? link.error : 'otp_expired'); return; }
    if (link && link.type === 'recovery') {
      try {
        const factor = verifiedFactor(await A.api('/auth/v1/user').then((r) => r.json()));
        if (factor && A.aal() !== 'aal2') { askCode('reset', factor.id); return; }
      } catch (err) {
        if (err.signedOut) { showSignin('otp_expired'); return; }
      }
    }
    if (link && (link.type === 'recovery' || link.type === 'invite')) {
      // An invite from the Supabase dashboard signs them in with no password yet, so they pick one now.
      $('.js-acct-newpass h2').textContent = link.type === 'invite' ? 'Welcome! Pick a password' : 'Pick a new password';
      show('newpass');
      focusIn('.js-acct-newpass');
      return;
    }
    if (A.session) { enter(link && link.type === 'signup' ? 'Your email is confirmed. Welcome to Yolkie!' : link && link.type === 'email_change' ? 'Your new email is confirmed.' : ''); return; }
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
