/* Yolkie admin page (admin.html). Loaded after main.js, which provides SUPABASE_URL, SUPABASE_ANON_KEY,
   esc() and the theme toggle. Admins sign in on the account page like everyone else; every request then carries their
   own login token, and the database's rules (supabase/admin.sql and accounts.sql) decide what they can see.
   This page never holds the secret key, so nothing here can get past those rules. */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const base = SUPABASE_URL.replace(/\/+$/, '');
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
    $('.js-ad-2fa').hidden = name !== '2fa';
    $('.js-ad-app').hidden = name !== 'app';
  };

  /* ---------- The login session (shared with the account page, through YolkieAuth in main.js) ---------- */
  const api = (path, opts) => YolkieAuth.api(path, opts).catch((err) => {
    if (err.signedOut) signOut(true);
    throw err;
  });

  function signOut(expired = false) {
    if (YolkieAuth.session) YolkieAuth.signOut();
    feedback = [];
    waitlist = [];
    people = [];
    $('.js-ad-fb-list').innerHTML = '';
    $('.js-ad-wl-list').innerHTML = '';
    $('.js-ad-pp-list').innerHTML = '';
    showSignin(expired ? 'You were signed out. Sign in again to carry on.' : '');
  }
  $$('.js-ad-signout').forEach((b) => b.addEventListener('click', () => signOut()));

  /* ---------- Signing in happens on the account page, which sends admins back here ---------- */
  function showSignin(msg = '') {
    show('signin');
    const out = $('.js-ad-signin-status');
    out.textContent = msg;
    out.classList.toggle('is-error', !!msg);
  }

  /* ---------- Data ---------- */
  let feedback = [];
  let waitlist = [];
  let removals = null; // null until supabase/removals.sql has been run
  let hidden = [];
  let people = [];
  let invites = [];
  let emails = []; // what the admin page has sent (supabase/email.sql), newest first
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
    say('Yolkie’s fetching the latest…');
    try {
      const [fb, wl, pp, el, rq, hr] = await Promise.all([
        api('/rest/v1/feedback?select=*&order=created_at.desc&limit=5000').then((r) => r.json()),
        api('/rest/v1/waitlist?select=*&order=created_at.desc&limit=5000').then((r) => r.json()),
        loadPeople(),
        api('/rest/v1/email_log?select=to_email,subject,kind,ref_id,sent_at&order=sent_at.desc&limit=2000').then((r) => r.json()).catch(() => []),
        api('/rest/v1/removal_requests?select=*&order=created_at.desc&limit=2000').then((r) => r.json()).catch(() => null),
        api('/rest/v1/hidden_recipes?select=recipe_id').then((r) => r.json()).catch(() => []),
      ]);
      removals = rq;
      hidden = (hr || []).map((x) => x.recipe_id);
      emails = el;
      feedback = fb;
      waitlist = wl;
      people = pp || [];
      say(pp ? '' : 'Accounts aren’t set up yet. Run supabase/accounts.sql to see people here.');
      renderStats();
      renderFeedback();
      renderWaitlist();
      renderPeople();
      renderRemovals();
    } catch (e) {
      $$('.skel__item').forEach((el) => el.remove());
      if (YolkieAuth.session) say('Yolkie couldn’t reach the kitchen. Check your connection, then tap Refresh.', true);
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
      card('Accounts', people.length, people, 'group'),
    ].join('');
    renderChart();
  }

  // Horizontal bars, label above each bar so it stays readable at phone width. Colours come from CSS.
  function renderChart() {
    const counts = TRIED.map((t) => ({ t, n: feedback.filter((r) => (r.tried || []).includes(t)).length }))
      .sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...counts.map((c) => c.n));
    // An HTML list, so the bars flow into columns on wide screens instead of one tall stack.
    const rows = counts.map((c) => `<li class="admin-bars__row"><span class="admin-bars__label">${esc(c.t.replace("'", '’'))}</span>`
      + `<span class="admin-bars__track" aria-hidden="true">${c.n ? `<span class="admin-bars__bar" style="width:${Math.max(3, Math.round((c.n / max) * 100))}%"></span>` : ''}</span>`
      + `<span class="admin-bars__n"><span class="sr-only">: </span>${c.n}</span></li>`).join('');
    const total = counts.reduce((a, c) => a + c.n, 0);
    $('.js-ad-chart').innerHTML = `<ul class="admin-bars">${rows}</ul>`
      + (total ? '' : '<p class="fine">Nobody has ticked any features yet.</p>');
  }

  /* ---------- Feedback list ---------- */
  const fbForm = $('.js-ad-fb-filters');
  const preview = (r) => (r.what_happened || r.idea || r.anything_else || '').replace(/\s+/g, ' ').trim();
  const stars = (n) => `<span class="admin-stars" aria-label="${n} out of 5">${'★'.repeat(n)}<span aria-hidden="true">${'★'.repeat(5 - n)}</span></span>`;
  // Status labels: a tone, an icon and the word, so colour is never the only signal.
  const STATUS_LOOK = { new: ['new', 'fiber_new'], reviewing: ['progress', 'pending'], done: ['done', 'check_circle'] };
  const badge = (s) => { const [tone, icon] = STATUS_LOOK[s] || ['attention', 'help']; return `<span class="admin-badge admin-badge--${esc(s)} tone-${tone}"><span class="icon" aria-hidden="true">${icon}</span>${STATUS[s] || esc(s)}</span>`; };
  const kind = (k) => (k === 'bug' || k === 'both'
    ? `<span class="admin-kind admin-kind--bug"><span class="icon" aria-hidden="true">bug_report</span>${KIND[k]}</span>`
    : `<span class="admin-kind">${KIND[k] || 'Not said'}</span>`);

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
        <span class="admin-row__top">${stars(r.rating)}${kind(r.kind)}${badge(r.status || 'new')}</span>
        <span class="admin-row__text">${esc(preview(r).slice(0, 140)) || '<em>No written answer</em>'}</span>
        <span class="admin-row__meta">${isFresh(r) ? '<span class="admin-new">New</span>' : ''}${fmtDate(r.created_at)} · from ${esc(r.page || 'unknown')}${(r.screenshot_paths || []).length ? ` · <span class="icon" aria-hidden="true">image</span>${r.screenshot_paths.length}` : ''}</span>
      </button></li>`).join('') : '<li class="admin-empty">Nothing matches these filters. Yolkie checked under the fridge too.</li>';
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
      <p class="admin-detail__top">${stars(r.rating)}${kind(r.kind)}${badge(r.status || 'new')}</p>
      <dl class="admin-qa-list">
        ${qa('Sent', esc(fmtWhen(r.created_at)))}
        ${qa('What they tried', (r.tried || []).map(esc).join(', ') || '<em>Nothing ticked</em>')}
        ${qa('What happened', text(r.what_happened))}
        ${qa('Using', esc(r.device || ''))}
        ${qa('Their idea', text(r.idea))}
        ${qa('Anything else', text(r.anything_else))}
        ${qa('Reply to', r.email ? `<span class="admin-reply">${esc(r.email)}<button type="button" class="btn btn--secondary btn--small js-ad-compose" data-to="${esc(r.email)}" data-kind="reply" data-ref="${esc(r.id)}"><span class="icon" aria-hidden="true">reply</span>Reply by email</button></span>` : '')}
        ${qa('Replies sent', repliesFor(r.id).map((m) => `${esc(fmtWhen(m.sent_at))} · ${esc(m.subject)}`).join('<br>'))}
        ${r.email ? `<div class="admin-qa"><dt>Tester</dt><dd class="js-ad-tester">${testerControls(r.email)}</dd></div>` : ''}
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
    if (e.target.closest('[data-tester]')) { onTesterClick(e); return; }
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

  /* ---------- Testers, by email (the waitlist and feedback notes) ---------- */
  const personFor = (email) => people.find((p) => (p.email || '').toLowerCase() === email);
  // Where someone stands: has an account or not, and whether they're a tester (or will be once they join).
  function testerState(raw) {
    const email = (raw || '').trim().toLowerCase();
    const person = personFor(email);
    const accepted = person ? person.badges.includes('tester') : invites.some((i) => i.email === email && i.badge === 'tester');
    return { email, person, accepted };
  }
  const INVITE_SUBJECT = 'You’re in: come test Yolkie';
  const inviteBody = () => ['Hi!', '',
    'Thanks for your interest in Yolkie. You’re in as a tester!', '',
    'Make your account here, with this email address so your Tester badge finds you:',
    `${location.origin}/account.html`, '',
    'Then try the demo and tell us how it goes:', `${location.origin}/try.html`, '',
    'Thanks,', 'The Yolkie team'].join('\n');
  function testerControls(raw) {
    const t = testerState(raw);
    if (!t.email) return '';
    const status = t.accepted
      ? `<span class="badge badge--tester"><span class="icon" aria-hidden="true">${BADGES.tester.icon}</span>Tester</span><span>${t.person ? 'Has an account' : 'Accepted, hasn’t signed up yet'}</span>`
      : (t.person ? '<span>Has an account</span>' : '');
    const invited = emails.find((m) => m.to_email === t.email && m.kind === 'invite');
    const mail = `<button type="button" class="btn btn--secondary btn--small js-ad-compose" data-to="${esc(t.email)}" data-kind="invite"><span class="icon" aria-hidden="true">mail</span>${invited ? 'Email again' : 'Email them'}</button>`;
    return `<span class="admin-tester">${status}${invited ? `<span>Invited ${fmtDate(invited.sent_at)}</span>` : ''}
      ${t.accepted
        ? `${t.person ? '' : mail}<button type="button" class="btn btn--ghost btn--small" data-tester="${esc(t.email)}" data-on="0">Undo</button>`
        : `<button type="button" class="btn btn--secondary btn--small" data-tester="${esc(t.email)}" data-on="1"><span class="icon" aria-hidden="true">${BADGES.tester.icon}</span>Accept as tester</button>`}
    </span>`;
  }
  // With an account, the badge itself changes; without one, the badge waits for their email.
  async function setTester(email, on) {
    const person = personFor(email);
    const enc = encodeURIComponent(email);
    if (on) {
      if (person) await api('/rest/v1/user_badges', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ user_id: person.id, badge: 'tester' }) });
      else await api('/rest/v1/badge_invites', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ email, badge: 'tester' }) });
    } else {
      if (person) await api(`/rest/v1/user_badges?user_id=eq.${encodeURIComponent(person.id)}&badge=eq.tester`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await api(`/rest/v1/badge_invites?email=eq.${enc}&badge=eq.tester`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
    if (person) person.badges = on ? [...new Set([...person.badges, 'tester'])] : person.badges.filter((b) => b !== 'tester');
    invites = invites.filter((i) => !(i.email === email && i.badge === 'tester'));
    if (on && !person) invites.push({ email, badge: 'tester' });
  }
  async function onTesterClick(e) {
    const b = e.target.closest('[data-tester]');
    if (!b || b.disabled) return;
    const email = b.dataset.tester;
    const on = b.dataset.on === '1';
    const list = e.currentTarget;
    b.disabled = true;
    try {
      await setTester(email, on);
      say(on ? `${email} is a tester${personFor(email) ? '' : ' as soon as they make an account'}.` : `${email} isn’t a tester any more.`);
      renderWaitlist();
      renderPeople();
      if (openId) $('.js-ad-tester').innerHTML = testerControls(feedback.find((x) => x.id === openId).email);
      const again = $(`[data-tester="${CSS.escape(email)}"]`, list);
      if (again) again.focus();
    } catch (err) {
      say('Couldn’t change that. If it keeps happening, run supabase/accounts.sql again.', true);
      b.disabled = false;
    }
  }
  $('.js-ad-wl-list').addEventListener('click', onTesterClick);

  /* ---------- Sending email (through Resend, by the send-email Edge Function) ---------- */
  const repliesFor = (id) => emails.filter((m) => m.kind === 'reply' && m.ref_id === id);
  const mailBox = $('.js-ad-mail');
  const mailForm = $('.js-ad-mail-form');
  const mailStatus = $('.js-ad-mail-status');
  let mailing = null; // { to, kind, ref }
  // The sender the send-email function uses, written here rather than in the page so scrapers miss it.
  $('.js-ad-mail-from').textContent = `Yolkie <${['yolkie', 'isolatedideas.dev'].join('@')}>`;
  const MAIL_ERRORS = {
    not_configured: 'Email isn’t set up yet: add the Resend key in Supabase (supabase/README.md, “Emails from the admin page”).',
    not_admin: 'Only admins who’ve passed two-step sign-in can send email. Sign in again with your code.',
    unknown_recipient: 'That address isn’t on the waitlist, in a feedback note or on an account, so Yolkie won’t email it.',
    daily_limit: 'That’s the daily limit (90 emails, to stay under Resend’s free plan). Try again tomorrow.',
    bad_input: 'Add a subject and a message first.',
    no_log: 'Couldn’t check today’s count. Run supabase/email.sql, then try again.',
    resend: 'Resend didn’t accept it. Check the domain and key in Resend, then try again.',
  };
  function replyBody(r) {
    const said = [r.what_happened, r.idea, r.anything_else].filter(Boolean).join('\n\n').slice(0, 800);
    return ['Hi!', '', 'Thanks for your feedback on Yolkie.', '', '', '', 'Thanks,', 'The Yolkie team',
      ...(said ? ['', '---', `You wrote on ${fmtDate(r.created_at)}:`, ...said.split('\n').map((l) => `> ${l}`)] : [])].join('\n');
  }
  function syncMailApp() {
    $('.js-ad-mail-app').href = `mailto:${encodeURIComponent(mailing.to).replace(/%40/g, '@')}?subject=${encodeURIComponent($('#ad-mail-subject').value)}&body=${encodeURIComponent($('#ad-mail-body').value)}`;
  }
  function openCompose(to, kind, ref) {
    mailing = { to, kind, ref };
    const r = ref ? feedback.find((x) => x.id === ref) : null;
    $('.js-ad-mail-to').textContent = to;
    $('#ad-mail-subject').value = kind === 'reply' ? 'Re: your Yolkie feedback' : INVITE_SUBJECT;
    const body = $('#ad-mail-body');
    body.value = kind === 'reply' && r ? replyBody(r) : inviteBody();
    mailStatus.textContent = '';
    mailStatus.classList.remove('is-error');
    $('.js-ad-mail-send').disabled = false;
    syncMailApp();
    mailBox.showModal();
    body.focus();
    // In a reply, start typing on the empty line under "Thanks for your feedback".
    const at = kind === 'reply' ? body.value.indexOf('\n\n\n') + 2 : 0;
    body.setSelectionRange(at, at);
    body.scrollTop = 0;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.js-ad-compose');
    if (b) openCompose(b.dataset.to, b.dataset.kind, b.dataset.ref || null);
  });
  mailForm.addEventListener('input', syncMailApp);
  mailBox.addEventListener('click', (e) => { if (e.target.closest('.js-close') || e.target === mailBox) mailBox.close(); });
  mailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = $('#ad-mail-subject').value.trim();
    const text = $('#ad-mail-body').value.trim();
    if (!subject || !text) { mailStatus.textContent = MAIL_ERRORS.bad_input; mailStatus.classList.add('is-error'); return; }
    const send = $('.js-ad-mail-send');
    send.disabled = true;
    mailStatus.classList.remove('is-error');
    mailStatus.textContent = 'Sending…';
    try {
      await api('/functions/v1/send-email', { method: 'POST', body: JSON.stringify({ to: mailing.to, subject, text, kind: mailing.kind, ref: mailing.ref }) });
      emails.unshift({ to_email: mailing.to, subject, kind: mailing.kind, ref_id: mailing.ref, sent_at: new Date().toISOString() });
      mailStatus.textContent = `Sent to ${mailing.to}.`;
      say(`Email sent to ${mailing.to}.`);
      renderWaitlist();
      // Close the box after a moment, then refresh the open feedback note so the reply shows up there.
      const noteId = openId;
      setTimeout(() => {
        if (mailBox.open) mailBox.close();
        if (noteId && detail.open) { detail.close(); openDetail(noteId); }
      }, 1200);
    } catch (err) {
      if (err.signedOut) return;
      mailStatus.textContent = err.status === 404 ? 'The send-email function isn’t deployed yet (supabase/README.md, “Emails from the admin page”).' : (MAIL_ERRORS[err.code] || 'That didn’t send. Check your connection and try again.');
      mailStatus.classList.add('is-error');
      send.disabled = false;
    }
  });

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
        ${testerControls(r.email)}
      </li>`).join('') : '<li class="admin-empty">Nobody matches that search. Try fewer letters?</li>';
  }
  wlForm.addEventListener('input', renderWaitlist);
  wlForm.addEventListener('submit', (e) => e.preventDefault());

  /* ---------- People: accounts and their badges ---------- */
  // Null when accounts.sql hasn't been run yet, so the rest of the page still works.
  async function loadPeople() {
    try {
      const [profiles, badges, admins, waiting] = await Promise.all([
        api('/rest/v1/profiles?select=id,display_name,email,created_at&order=created_at.desc&limit=5000').then((r) => r.json()),
        api('/rest/v1/user_badges?select=user_id,badge&limit=20000').then((r) => r.json()),
        api('/rest/v1/admin_users?select=user_id&limit=1000').then((r) => r.json()).catch(() => []),
        api('/rest/v1/badge_invites?select=email,badge&limit=20000').then((r) => r.json()).catch(() => []),
      ]);
      invites = waiting;
      const adminIds = new Set(admins.map((a) => a.user_id));
      return profiles.map((p) => ({ ...p, badges: badges.filter((b) => b.user_id === p.id).map((b) => b.badge), admin: adminIds.has(p.id) }));
    } catch (e) {
      if (e.signedOut) throw e;
      return null;
    }
  }
  const GIVEABLE = ['owner', 'developer', 'tester', 'early_adopter'];
  function ppFiltered() {
    const q = $('#ad-pp-q').value.trim().toLowerCase();
    return people.filter((p) => !q || [p.display_name, p.email, ...p.badges.map((b) => BADGES[b].label), p.admin ? 'admin' : '']
      .some((v) => v && v.toLowerCase().includes(q)));
  }
  function renderPeople() {
    const rows = ppFiltered();
    $('.js-ad-pp-count').textContent = `${rows.length} of ${people.length} ${people.length === 1 ? 'account' : 'accounts'}`;
    $('.js-ad-pp-list').innerHTML = rows.length ? rows.map((p) => `
      <li class="admin-wl admin-person${isFresh(p) ? ' is-fresh' : ''}">
        <span class="admin-wl__email">${esc(p.display_name || 'No name yet')}</span>
        <span class="admin-row__meta">${isFresh(p) ? '<span class="admin-new">New</span>' : ''}${esc(p.email || 'No email')} · joined ${fmtDate(p.created_at)}</span>
        <ul class="badges badges--toggle" aria-label="Badges for ${esc(p.display_name || p.email || 'this person')}">
          ${p.admin ? `<li><span class="badge badge--admin"><span class="icon" aria-hidden="true">${BADGES.admin.icon}</span>Admin</span></li>` : ''}
          ${GIVEABLE.map((k) => `<li><button type="button" class="badge badge--${k}${p.badges.includes(k) ? '' : ' is-off'}" data-person="${esc(p.id)}" data-badge="${k}" aria-pressed="${p.badges.includes(k)}"><span class="icon" aria-hidden="true">${BADGES[k].icon}</span>${BADGES[k].label}</button></li>`).join('')}
        </ul>
      </li>`).join('') : `<li class="admin-empty">${people.length ? 'Nobody matches that search.' : 'No accounts yet.'}</li>`;
  }
  $('.js-ad-pp-filters').addEventListener('input', renderPeople);
  $('.js-ad-pp-filters').addEventListener('submit', (e) => e.preventDefault());
  $('.js-ad-pp-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-badge]');
    if (!b || b.disabled) return;
    const p = people.find((x) => x.id === b.dataset.person);
    const k = b.dataset.badge;
    const has = p.badges.includes(k);
    b.disabled = true;
    try {
      if (has) await api(`/rest/v1/user_badges?user_id=eq.${encodeURIComponent(p.id)}&badge=eq.${k}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      else await api('/rest/v1/user_badges', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ user_id: p.id, badge: k }) });
      p.badges = has ? p.badges.filter((x) => x !== k) : [...p.badges, k];
      say(`${has ? 'Took' : 'Gave'} ${BADGES[k].label} ${has ? 'from' : 'to'} ${p.display_name || p.email}.`);
      renderPeople();
      if (k === 'tester') renderWaitlist();
      const again = $(`.js-ad-pp-list [data-person="${CSS.escape(p.id)}"][data-badge="${k}"]`);
      if (again) again.focus();
    } catch (err) {
      say('Couldn’t change that badge. Check your connection and try again.', true);
      b.disabled = false;
    }
  });

  /* ---------- Removal requests and hidden recipes (supabase/removals.sql) ---------- */
  const RR_STATUS = { new: ['New', 'new', 'fiber_new'], removed: ['Removed', 'done', 'check_circle'], declined: ['Declined', 'progress', 'block'] };
  const recipeName = (id) => { const r = (typeof ALL_RECIPES !== 'undefined' ? ALL_RECIPES : []).find((x) => x.id === id); return r ? r.name : id; };
  const creatorRecipes = () => (typeof ALL_RECIPES !== 'undefined' ? ALL_RECIPES : []).filter((r) => r.src);
  const hideBtn = (id, req) => (hidden.includes(id)
    ? `<button type="button" class="btn btn--ghost btn--small" data-unhide="${esc(id)}">Unhide</button>`
    : `<button type="button" class="btn btn--secondary btn--small" data-hide="${esc(id)}"${req ? ` data-req="${esc(req)}"` : ''}><span class="icon" aria-hidden="true">visibility_off</span>Hide recipe</button>`);
  function renderRemovals() {
    const list = $('.js-ad-rr-list');
    if (!removals) {
      list.innerHTML = '<li class="admin-empty">Removal requests aren’t set up yet. Run supabase/removals.sql in Supabase.</li>';
      $('.js-ad-hidden-list').innerHTML = '';
      return;
    }
    const fresh = removals.filter((r) => r.status === 'new').length;
    $('.js-ad-rr-tab').textContent = fresh ? `Removals (${fresh})` : 'Removals';
    $('.js-ad-rr-count').textContent = `${removals.length} ${removals.length === 1 ? 'request' : 'requests'}${fresh ? `, ${fresh} new` : ''}`;
    list.innerHTML = removals.length ? removals.map((r) => {
      const [label, tone, icon] = RR_STATUS[r.status] || RR_STATUS.new;
      const ids = r.recipe_ids || [];
      return `<li class="admin-rr${r.status === 'new' ? ' is-fresh' : ''}" data-rr="${esc(r.id)}">
        <p class="admin-row__top"><strong>${esc(r.creator)}</strong><span class="admin-badge tone-${tone}"><span class="icon" aria-hidden="true">${icon}</span>${label}</span><span class="admin-row__meta">${fmtWhen(r.created_at)}</span></p>
        <p class="admin-rr__recipes">${esc(r.recipes).replace(/\n/g, '<br>')}</p>
        <p class="fine"><a href="${esc(/^https?:\/\//i.test(r.link) ? r.link : '#')}" target="_blank" rel="noopener noreferrer">${esc(r.link)}</a> · ${esc(r.email)}</p>
        ${r.message ? `<p class="admin-wl__answer">${esc(r.message)}</p>` : ''}
        <div class="admin-rr__actions">
          ${ids.map((id) => `<span class="admin-rr__recipe">${esc(recipeName(id))} ${hideBtn(id, r.id)}</span>`).join('')}
          ${ids.length ? '' : `<label class="sr-only" for="rr-pick-${esc(r.id)}">Recipe to hide</label><select id="rr-pick-${esc(r.id)}" class="js-rr-pick"><option value="">Pick the recipe…</option>${creatorRecipes().filter((x) => !hidden.includes(x.id)).map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><button type="button" class="btn btn--secondary btn--small js-rr-hide-picked" data-req="${esc(r.id)}"><span class="icon" aria-hidden="true">visibility_off</span>Hide recipe</button>`}
        </div>
        <div class="chips" role="group" aria-label="Status for ${esc(r.creator)}">${Object.entries(RR_STATUS).map(([v, [l]]) => `<button type="button" class="tag" data-rr-status="${v}" aria-pressed="${r.status === v}">${l}</button>`).join('')}</div>
      </li>`;
    }).join('') : '<li class="admin-empty">No removal requests. Every creator’s happy, as far as Yolkie knows.</li>';
    $('.js-ad-hidden-list').innerHTML = hidden.length
      ? hidden.map((id) => `<li class="admin-rr admin-rr--hidden"><span>${esc(recipeName(id))}${recipeName(id) === id ? '' : ` <small class="fine">${esc(id)}</small>`}</span>${hideBtn(id)}</li>`).join('')
      : '<li class="admin-empty">No recipes hidden.</li>';
  }
  async function setRemovalStatus(id, status) {
    await api(`/rest/v1/removal_requests?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, handled_at: status === 'new' ? null : new Date().toISOString() }) });
    const r = removals.find((x) => x.id === id);
    if (r) r.status = status;
  }
  async function hideRecipe(id, req) {
    await api('/rest/v1/hidden_recipes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ recipe_id: id, request_id: req || null }) });
    hidden = [...new Set([...hidden, id])];
    if (req) await setRemovalStatus(req, 'removed');
  }
  $('#ad-panel-removals').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-hide], [data-unhide], [data-rr-status], .js-rr-hide-picked');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.hide) { await hideRecipe(b.dataset.hide, b.dataset.req); say(`${recipeName(b.dataset.hide)} is hidden from the demo now.`); }
      if (b.matches('.js-rr-hide-picked')) {
        const pick = b.parentElement.querySelector('.js-rr-pick').value;
        if (!pick) { say('Pick the recipe first.', true); b.disabled = false; return; }
        await hideRecipe(pick, b.dataset.req);
        const r = removals.find((x) => x.id === b.dataset.req);
        say(`${recipeName(pick)} is hidden from the demo now.`);
        void r;
      }
      if (b.dataset.unhide) {
        await api(`/rest/v1/hidden_recipes?recipe_id=eq.${encodeURIComponent(b.dataset.unhide)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        hidden = hidden.filter((x) => x !== b.dataset.unhide);
        say(`${recipeName(b.dataset.unhide)} is back in the demo.`);
      }
      if (b.dataset.rrStatus) { await setRemovalStatus(b.closest('[data-rr]').dataset.rr, b.dataset.rrStatus); say('Saved.'); }
      renderRemovals();
    } catch (err) {
      if (err.signedOut) return;
      say('That didn’t save. Check your connection, then try again.', true);
      b.disabled = false;
    }
  });

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
  $('.js-ad-pp-csv').addEventListener('click', () => download('yolkie-accounts', ['created_at', 'display_name', 'email', 'badges'],
    ppFiltered().map((p) => ({ ...p, badges: [...(p.admin ? ['Admin'] : []), ...p.badges.map((b) => BADGES[b].label)] }))));

  /* ---------- Start ---------- */
  async function start() {
    if (!supabaseReady()) { show('denied'); return; }
    if (!YolkieAuth.session) { showSignin(); return; }
    try {
      const [user, status] = await Promise.all([
        api('/auth/v1/user').then((r) => r.json()),
        api('/rest/v1/rpc/yolkie_admin_status', { method: 'POST', body: '{}' }).then((r) => r.json())
          .catch(() => api('/rest/v1/rpc/is_yolkie_admin', { method: 'POST', body: '{}' }).then((r) => r.json()).then((a) => (a === true ? 'admin' : 'no')))
          .catch(() => 'no'),
      ]);
      if (status === 'needs_2fa') { show('2fa'); return; }
      if (status !== 'admin') { show('denied'); return; }
      $('.js-ad-who').textContent = `Signed in as ${user.email}`;
      try { lastVisit = Number(localStorage.getItem(VISIT_KEY)) || 0; localStorage.setItem(VISIT_KEY, String(Date.now())); } catch (e) {}
      show('app');
      await load();
    } catch (e) {
      if (YolkieAuth.session) showSignin('Couldn’t check your sign-in. Check your connection, then reload.');
    }
  }
  start();
})();
