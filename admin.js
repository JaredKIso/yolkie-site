/* Yolkie admin page (admin.html). Loaded after main.js, which provides SUPABASE_URL, SUPABASE_ANON_KEY,
   esc() and the theme toggle. Admins sign in with a Supabase magic link; every request then carries their
   own login token, and the database's rules (supabase/admin.sql) decide what they can see. This page never
   holds the secret key, so nothing here can get past those rules. */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const SESSION_KEY = 'yolkie-admin-session';
  const VISIT_KEY = 'yolkie-admin-last-visit';
  const BUCKET = 'feedback-screenshots';
  const TRIED = ['Picking a meal', 'What do you already have?', 'Diet and restrictions', 'Shopping list', 'Cook mode',
    'Nutrition or water tracker', 'Progress and weekly goals', "Yolkie's Closet", "Yolkie's Kitchen", 'Collection',
    'Household and house vote', 'Help page'];
  const KIND = { bug: 'Bug', idea: 'Idea', both: 'Bug + idea', neither: 'General' };
  const STATUS = { new: 'New', reviewing: 'Reviewing', done: 'Done' };

  const show = (name) => {
    $('.js-ad-loading').hidden = true;
    $('.js-ad-signin').hidden = name !== 'signin';
    $('.js-ad-denied').hidden = name !== 'denied';
    $('.js-ad-app').hidden = name !== 'app';
  };

  /* ---------- The login session ---------- */
  const readSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; } };
  const saveSession = (s) => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} };
  const dropSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} };
  let session = null;

  // A sign-in link lands back here with the tokens in the address (#access_token=…). Keep them, then
  // clean the address so they don't sit in the history or get copied.
  function takeTokensFromLink() {
    if (!location.hash.includes('access_token') && !location.hash.includes('error')) return '';
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (p.get('error')) return p.get('error_code') === 'otp_expired' ? 'That sign-in link has expired or was already used. Ask for a new one.' : 'That sign-in link didn’t work. Ask for a new one.';
    const expiresIn = Number(p.get('expires_in')) || 3600;
    saveSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + expiresIn });
    return '';
  }

  async function refresh() {
    if (!session || !session.refresh_token) return false;
    try {
      const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) return false;
      const s = await res.json();
      session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) };
      saveSession(session);
      return true;
    } catch (e) { return false; }
  }

  // Every data request: the public key identifies the project, the admin's own token identifies them.
  async function api(path, opts = {}, retried = false) {
    if (session && session.expires_at - 60 < Date.now() / 1000) await refresh();
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
    });
    if (res.status === 401 && !retried && (await refresh())) return api(path, opts, true);
    if (res.status === 401) { signOut(true); throw new Error('signed out'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  async function signOut(expired = false) {
    const token = session && session.access_token;
    session = null;
    dropSession();
    if (token) fetch(`${base}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
    feedback = [];
    waitlist = [];
    $('.js-ad-fb-list').innerHTML = '';
    $('.js-ad-wl-list').innerHTML = '';
    showSignin(expired ? 'You were signed out. Sign in again to carry on.' : '');
  }
  $$('.js-ad-signout').forEach((b) => b.addEventListener('click', () => signOut()));

  /* ---------- Signing in ---------- */
  const form = $('.js-ad-signin-form');
  const emailIn = $('#ad-email');
  const signinStatus = $('.js-ad-signin-status');
  function showSignin(msg = '') {
    show('signin');
    $('.js-ad-signin-fields').hidden = false;
    $('.js-ad-signin-done').hidden = true;
    signinStatus.textContent = msg;
    signinStatus.classList.toggle('is-error', !!msg);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailIn.value.trim().toLowerCase();
    if (!EMAIL_OK.test(email)) {
      signinStatus.textContent = 'That email looks a little scrambled. Mind checking it?';
      signinStatus.classList.add('is-error');
      emailIn.focus();
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    signinStatus.classList.remove('is-error');
    signinStatus.textContent = 'Sending…';
    try {
      const back = encodeURIComponent(location.origin + location.pathname);
      const res = await fetch(`${base}/auth/v1/otp?redirect_to=${back}`, {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, create_user: true }),
      });
      if (res.status === 429) throw Object.assign(new Error('slow down'), { slow: true });
      if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
      // Any other answer looks the same, so the form never reveals which emails have accounts.
      $('.js-ad-signin-fields').hidden = true;
      const done = $('.js-ad-signin-done');
      done.hidden = false;
      $('h2', done).focus();
    } catch (err) {
      signinStatus.textContent = err.slow ? 'Too many sign-in emails just now. Wait a minute, then try again.' : 'That didn’t go through. Check your connection and try again.';
      signinStatus.classList.add('is-error');
    } finally {
      btn.disabled = false;
    }
  });
  $('.js-ad-signin-again').addEventListener('click', () => { showSignin(); emailIn.select(); emailIn.focus(); });

  /* ---------- Data ---------- */
  let feedback = [];
  let waitlist = [];
  let lastVisit = 0;
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const isFresh = (row) => lastVisit && Date.parse(row.created_at) > lastVisit;
  const say = (text, isError = false) => {
    const m = $('.js-ad-msg');
    m.textContent = text;
    m.classList.toggle('is-error', isError);
  };

  async function load() {
    say('Loading…');
    try {
      const [fb, wl] = await Promise.all([
        api('/rest/v1/feedback?select=*&order=created_at.desc&limit=5000').then((r) => r.json()),
        api('/rest/v1/waitlist?select=*&order=created_at.desc&limit=5000').then((r) => r.json()),
      ]);
      feedback = fb;
      waitlist = wl;
      say('');
      renderStats();
      renderFeedback();
      renderWaitlist();
    } catch (e) {
      if (session) say('Couldn’t load the latest submissions. Check your connection, then tap Refresh.', true);
    }
  }
  $('.js-ad-refresh').addEventListener('click', load);

  /* ---------- Dashboard ---------- */
  function renderStats() {
    const rated = feedback.filter((r) => r.rating);
    const avg = rated.length ? (rated.reduce((a, r) => a + r.rating, 0) / rated.length).toFixed(1) : '–';
    const bugs = feedback.filter((r) => r.kind === 'bug' || r.kind === 'both');
    const ideas = feedback.filter((r) => r.kind === 'idea' || r.kind === 'both');
    const fresh = (rows) => (lastVisit ? rows.filter(isFresh).length : null);
    const card = (label, value, rows, icon) => {
      const n = fresh(rows);
      const note = n === null ? 'First visit on this device' : n ? `${n} new since your last visit` : 'Nothing new since your last visit';
      return `<li class="admin-card${n ? ' has-new' : ''}"><span class="icon" aria-hidden="true">${icon}</span><span class="admin-card__label">${label}</span><strong class="admin-card__value">${value}</strong><span class="admin-card__new">${note}</span></li>`;
    };
    $('.js-ad-cards').innerHTML = [
      card('Feedback', feedback.length, feedback, 'chat'),
      card('Average rating', avg === '–' ? avg : `${avg} ★`, rated, 'star'),
      card('Bugs', bugs.length, bugs, 'bug_report'),
      card('Ideas', ideas.length, ideas, 'lightbulb'),
      card('Waitlist sign-ups', waitlist.length, waitlist, 'mail'),
    ].join('');
    renderChart();
  }

  // Horizontal bars, label above each bar so it stays readable at phone width. Colours come from CSS.
  function renderChart() {
    const counts = TRIED.map((t) => ({ t, n: feedback.filter((r) => (r.tried || []).includes(t)).length }))
      .sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...counts.map((c) => c.n));
    const W = 360, ROW = 40, BAR = 14, LABEL_W = 300;
    const rows = counts.map((c, i) => {
      const y = i * ROW;
      const w = Math.max(c.n ? 4 : 0, Math.round((c.n / max) * LABEL_W));
      return `<g transform="translate(0 ${y})"><text class="admin-chart__label" x="0" y="14">${esc(c.t.replace("'", '’'))}</text>`
        + `<rect class="admin-chart__track" x="0" y="20" width="${LABEL_W}" height="${BAR}" rx="7"></rect>`
        + (w ? `<rect class="admin-chart__bar" x="0" y="20" width="${w}" height="${BAR}" rx="7"></rect>` : '')
        + `<text class="admin-chart__n" x="${LABEL_W + 10}" y="32">${c.n}</text></g>`;
    }).join('');
    const total = counts.reduce((a, c) => a + c.n, 0);
    $('.js-ad-chart').innerHTML = `<svg viewBox="0 0 ${W} ${counts.length * ROW}" role="img" aria-label="How many notes ticked each feature: ${counts.map((c) => `${c.t} ${c.n}`).join(', ')}">${rows}</svg>`
      + (total ? '' : '<p class="fine">Nobody has ticked any features yet.</p>');
  }

  /* ---------- Feedback list ---------- */
  const fbForm = $('.js-ad-fb-filters');
  const preview = (r) => (r.what_happened || r.idea || r.anything_else || '').replace(/\s+/g, ' ').trim();
  const stars = (n) => `<span class="admin-stars" aria-label="${n} out of 5">${'★'.repeat(n)}<span aria-hidden="true">${'★'.repeat(5 - n)}</span></span>`;
  const badge = (s) => `<span class="admin-badge admin-badge--${esc(s)}">${STATUS[s] || esc(s)}</span>`;

  function fbFiltered() {
    const f = Object.fromEntries(new FormData(fbForm));
    const q = (f.q || '').trim().toLowerCase();
    const from = f.from ? Date.parse(`${f.from}T00:00:00`) : null;
    const to = f.to ? Date.parse(`${f.to}T23:59:59.999`) : null;
    return feedback.filter((r) => {
      if (f.kind && (f.kind === 'none' ? r.kind : r.kind !== f.kind)) return false;
      if (f.rating && r.rating !== Number(f.rating)) return false;
      if (f.status && r.status !== f.status) return false;
      const t = Date.parse(r.created_at);
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (q && ![r.what_happened, r.idea, r.anything_else, r.email, r.page, r.notes, r.device, ...(r.tried || [])].some((v) => v && v.toLowerCase().includes(q))) return false;
      return true;
    });
  }
  function renderFeedback() {
    const rows = fbFiltered();
    $('.js-ad-fb-count').textContent = `${rows.length} of ${feedback.length} ${feedback.length === 1 ? 'note' : 'notes'}`;
    $('.js-ad-fb-list').innerHTML = rows.length ? rows.map((r) => `
      <li><button type="button" class="admin-row${isFresh(r) ? ' is-fresh' : ''}" data-fb="${esc(r.id)}">
        <span class="admin-row__top">${stars(r.rating)}<span class="admin-kind">${KIND[r.kind] || 'Not said'}</span>${badge(r.status || 'new')}</span>
        <span class="admin-row__text">${esc(preview(r).slice(0, 140)) || '<em>No written answer</em>'}</span>
        <span class="admin-row__meta">${isFresh(r) ? '<span class="admin-new">New</span>' : ''}${fmtDate(r.created_at)} · from ${esc(r.page || 'unknown')}${(r.screenshot_paths || []).length ? ` · <span class="icon" aria-hidden="true">image</span>${r.screenshot_paths.length}` : ''}</span>
      </button></li>`).join('') : '<li class="admin-empty">Nothing matches these filters.</li>';
  }
  fbForm.addEventListener('input', renderFeedback);
  fbForm.addEventListener('change', renderFeedback);
  fbForm.addEventListener('reset', () => setTimeout(renderFeedback));
  fbForm.addEventListener('submit', (e) => e.preventDefault());

  /* ---------- One submission ---------- */
  const detail = $('.js-ad-detail');
  const zoom = $('.js-ad-zoom');
  let openId = null;
  const isVideo = (path) => /\.(mp4|mov|webm)$/i.test(path);

  async function signedUrls(paths) {
    if (!paths.length) return [];
    const res = await api(`/storage/v1/object/sign/${BUCKET}`, { method: 'POST', body: JSON.stringify({ expiresIn: 600, paths }) });
    const list = await res.json();
    return list.map((x) => (x.signedURL ? `${base}/storage/v1${x.signedURL}` : null));
  }

  function openDetail(id) {
    const r = feedback.find((x) => x.id === id);
    if (!r) return;
    openId = id;
    const qa = (q, a) => (a ? `<div class="admin-qa"><dt>${q}</dt><dd>${a}</dd></div>` : '');
    const text = (v) => (v ? esc(v).replace(/\n/g, '<br>') : '');
    $('.js-ad-detail-body').innerHTML = `
      <p class="admin-detail__top">${stars(r.rating)}<span class="admin-kind">${KIND[r.kind] || 'Not said'}</span>${badge(r.status || 'new')}</p>
      <dl class="admin-qa-list">
        ${qa('Sent', esc(fmtWhen(r.created_at)))}
        ${qa('What they tried', (r.tried || []).map(esc).join(', ') || '<em>Nothing ticked</em>')}
        ${qa('What happened', text(r.what_happened))}
        ${qa('Using', esc(r.device || ''))}
        ${qa('Their idea', text(r.idea))}
        ${qa('Anything else', text(r.anything_else))}
        ${qa('Reply to', r.email ? `<a href="mailto:${encodeURIComponent(r.email).replace(/%40/g, '@')}?subject=${encodeURIComponent('Your Yolkie feedback')}">${esc(r.email)}</a>` : '')}
        ${qa('Sent from', esc(r.page || 'unknown'))}
        ${qa('App version', esc(r.app_version || ''))}
      </dl>
      ${(r.screenshot_paths || []).length ? `<div class="admin-shots-wrap"><h3 class="mini-head">Screenshots</h3><ul class="fb-shots admin-shots js-ad-shots"><li class="fine">Loading…</li></ul></div>` : ''}
      <form class="admin-edit js-ad-edit">
        <fieldset class="field">
          <legend>Status</legend>
          <div class="chips">${Object.entries(STATUS).map(([v, l]) => `<label class="chip"><input type="radio" name="status" value="${v}"${(r.status || 'new') === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
        </fieldset>
        <div class="field">
          <label for="ad-notes">Private notes <span class="field__opt">(only the team sees these)</span></label>
          <textarea id="ad-notes" name="notes" rows="4" maxlength="4000">${esc(r.notes || '')}</textarea>
        </div>
        <button type="submit" class="btn btn--primary btn--small">Save notes</button>
        <p class="admin-saved js-ad-saved" role="status"></p>
      </form>`;
    detail.showModal();
    const shots = r.screenshot_paths || [];
    if (shots.length) {
      signedUrls(shots).then((urls) => {
        if (openId !== id) return;
        $('.js-ad-shots').innerHTML = shots.map((p, i) => (urls[i]
          ? `<li class="fb-shot"><button type="button" class="admin-shot" data-zoom="${i}" aria-label="Enlarge screenshot ${i + 1}">${isVideo(p) ? `<video src="${esc(urls[i])}" muted playsinline preload="metadata"></video>` : `<img src="${esc(urls[i])}" alt="">`}</button></li>`
          : '<li class="fb-shot fine">This file is missing.</li>')).join('');
        $('.js-ad-shots').dataset.urls = JSON.stringify(urls);
      }).catch(() => { if (openId === id) $('.js-ad-shots').innerHTML = '<li class="fine">Couldn’t load the screenshots. Close and open this note to try again.</li>'; });
    }
  }
  $('.js-ad-fb-list').addEventListener('click', (e) => { const b = e.target.closest('[data-fb]'); if (b) openDetail(b.dataset.fb); });

  async function saveEdit(fields) {
    const r = feedback.find((x) => x.id === openId);
    const saved = $('.js-ad-saved');
    saved.textContent = 'Saving…';
    saved.classList.remove('is-error');
    try {
      await api(`/rest/v1/feedback?id=eq.${encodeURIComponent(openId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields) });
      Object.assign(r, fields);
      saved.textContent = 'Saved.';
      $('.admin-detail__top .admin-badge').outerHTML = badge(r.status || 'new');
      renderFeedback();
    } catch (err) {
      saved.textContent = 'Couldn’t save. Check your connection and try again.';
      saved.classList.add('is-error');
    }
  }
  detail.addEventListener('change', (e) => { if (e.target.name === 'status') saveEdit({ status: e.target.value }); });
  detail.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = $('#ad-notes').value.trim();
    saveEdit({ notes: notes || null });
  });
  detail.addEventListener('click', (e) => {
    if (e.target.closest('.js-close') || e.target === detail) detail.close();
    const z = e.target.closest('[data-zoom]');
    if (z) {
      const urls = JSON.parse($('.js-ad-shots').dataset.urls || '[]');
      const r = feedback.find((x) => x.id === openId);
      const path = r.screenshot_paths[Number(z.dataset.zoom)];
      const url = esc(urls[Number(z.dataset.zoom)]);
      $('.js-ad-zoom-body').innerHTML = isVideo(path) ? `<video src="${url}" controls playsinline></video>` : `<img src="${url}" alt="Screenshot from the feedback note">`;
      zoom.showModal();
    }
  });
  detail.addEventListener('close', () => { openId = null; });
  zoom.addEventListener('click', (e) => { if (e.target.closest('.js-close') || e.target === zoom) zoom.close(); });
  zoom.addEventListener('close', () => { $('.js-ad-zoom-body').innerHTML = ''; });

  /* ---------- Waitlist ---------- */
  const wlForm = $('.js-ad-wl-filters');
  function wlFiltered() {
    const q = $('#ad-wl-q').value.trim().toLowerCase();
    return waitlist.filter((r) => !q || [r.email, r.must_have, r.source].some((v) => v && v.toLowerCase().includes(q)));
  }
  function renderWaitlist() {
    const rows = wlFiltered();
    $('.js-ad-wl-count').textContent = `${rows.length} of ${waitlist.length} ${waitlist.length === 1 ? 'sign-up' : 'sign-ups'}`;
    $('.js-ad-wl-list').innerHTML = rows.length ? rows.map((r) => `
      <li class="admin-wl${isFresh(r) ? ' is-fresh' : ''}">
        <span class="admin-wl__email">${esc(r.email)}</span>
        <span class="admin-row__meta">${isFresh(r) ? '<span class="admin-new">New</span>' : ''}${fmtDate(r.created_at)}${r.source === 'help' ? ' · via the help page' : ''}</span>
        ${r.must_have ? `<span class="admin-wl__answer">${esc(r.must_have)}</span>` : ''}
      </li>`).join('') : '<li class="admin-empty">Nobody matches that search.</li>';
  }
  wlForm.addEventListener('input', renderWaitlist);
  wlForm.addEventListener('submit', (e) => e.preventDefault());

  /* ---------- Tabs ---------- */
  const tabs = $$('[data-ad-tab]');
  const pick = (tab) => tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      pick(next);
      next.focus();
    });
  });

  /* ---------- CSV, matching the current filters ---------- */
  // Quote every cell, and defuse anything a spreadsheet would run as a formula.
  const cell = (v) => {
    let s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  function download(name, cols, rows) {
    const csv = [cols.map(cell).join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${name}-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('.js-ad-fb-csv').addEventListener('click', () => download('yolkie-feedback',
    ['created_at', 'rating', 'kind', 'status', 'tried', 'what_happened', 'device', 'idea', 'anything_else', 'email', 'page', 'app_version', 'screenshot_paths', 'notes'], fbFiltered()));
  $('.js-ad-wl-csv').addEventListener('click', () => download('yolkie-waitlist', ['created_at', 'email', 'must_have', 'source'], wlFiltered()));

  /* ---------- Start ---------- */
  async function start() {
    if (!supabaseReady()) { show('denied'); return; }
    const linkError = takeTokensFromLink();
    session = readSession();
    if (!session) { showSignin(linkError); return; }
    if (session.expires_at - 60 < Date.now() / 1000 && !(await refresh())) { dropSession(); session = null; showSignin('Your sign-in expired. Ask for a new link.'); return; }
    try {
      const [user, admin] = await Promise.all([
        api('/auth/v1/user').then((r) => r.json()),
        api('/rest/v1/rpc/is_yolkie_admin', { method: 'POST', body: '{}' }).then((r) => r.json()).catch(() => false),
      ]);
      if (admin !== true) { show('denied'); return; }
      $('.js-ad-who').textContent = `Signed in as ${user.email}`;
      try { lastVisit = Number(localStorage.getItem(VISIT_KEY)) || 0; localStorage.setItem(VISIT_KEY, String(Date.now())); } catch (e) {}
      show('app');
      await load();
    } catch (e) {
      if (session) showSignin('Couldn’t check your sign-in. Check your connection, then reload.');
    }
  }
  start();
  // A sign-in link opened in this same tab only changes the #, which doesn't reload the page.
  window.addEventListener('hashchange', () => { if (/access_token|error/.test(location.hash)) start(); });
})();
