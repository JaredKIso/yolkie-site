// Yolkie's send-email Edge Function: sends an email from the admin page through Resend.
//
// The Resend key lives only in Supabase (Edge Functions → Secrets → RESEND_API_KEY), never in the
// website. Every request has to come from a signed-in admin who has passed 2FA: the function asks the
// database with the admin's own login (the same is_yolkie_admin() check the admin page's data uses), so
// it never needs the service_role key. It only sends to people who gave us their email (the waitlist,
// a feedback note or an account), at most DAILY_LIMIT a day, and logs each one in public.email_log.
// Setup: supabase/README.md.

const ALLOWED_ORIGINS = ['https://yolkie.isolatedideas.dev', 'http://127.0.0.1:8781'];
const FROM = 'Yolkie <yolkie@isolatedideas.dev>';
const REPLY_TO = 'yolkie@isolatedideas.dev';
const DAILY_LIMIT = 90; // Resend's free plan stops at 100 a day; this leaves room for sign-in emails.
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// The same look as the sign-in emails (supabase/email-templates): the icon, a white card, plain text.
function html(subject: string, text: string) {
  const paras = text.trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#6B4DE6;">$1</a>')}</p>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F6F4FB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F4FB;"><tr>
<td align="center" style="padding:32px 16px;font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#1E1A2E;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;border:2px solid #DAD4EA;">
<tr><td style="padding:28px 32px 8px;"><img src="https://yolkie.isolatedideas.dev/icon-192.png" width="56" height="56" alt="Yolkie" style="display:block;border:0;border-radius:14px;"></td></tr>
<tr><td style="padding:12px 32px 18px;font-size:16px;line-height:1.6;color:#1E1A2E;">${paras}</td></tr>
</table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#5D5775;"><strong style="color:#1E1A2E;">Yolkie</strong> · From hungry to fed.<br>
<a href="https://yolkie.isolatedideas.dev" style="color:#5D5775;">yolkie.isolatedideas.dev</a> · <a href="https://yolkie.isolatedideas.dev/privacy.html" style="color:#5D5775;">Privacy</a></p>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-yolkie-device, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  // Errors carry a short code in `message`, which the admin page turns into words.
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { message: 'method' });

  const key = Deno.env.get('RESEND_API_KEY');
  const base = Deno.env.get('SUPABASE_URL');
  if (!key || !base) return reply(500, { message: 'not_configured' });

  // Ask the database as the admin who called: their login, the project's public key, and their
  // remembered-browser pass (so 2FA counts the same way it does on the admin page).
  const headers = {
    apikey: req.headers.get('apikey') ?? '',
    Authorization: req.headers.get('authorization') ?? '',
    'x-yolkie-device': req.headers.get('x-yolkie-device') ?? '',
    'Content-Type': 'application/json',
  };
  const db = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

  const admin = await db('/rest/v1/rpc/is_yolkie_admin', { method: 'POST', body: '{}' });
  if (!admin.ok || (await admin.json()) !== true) return reply(403, { message: 'not_admin' });

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return reply(400, { message: 'bad_input' }); }
  const to = String(input.to ?? '').trim().toLowerCase();
  const subject = String(input.subject ?? '').trim().slice(0, 200);
  const text = String(input.text ?? '').trim().slice(0, 10000);
  const kind = input.kind === 'reply' ? 'reply' : 'invite';
  const ref = input.ref ? String(input.ref).slice(0, 100) : null;
  if (!EMAIL_OK.test(to) || to.length > 254 || !subject || !text) return reply(400, { message: 'bad_input' });

  // Only people who gave us this address: the waitlist, a feedback note, or an account.
  const pattern = encodeURIComponent(to.replace(/[%_*\\]/g, '\\$&'));
  const lists = await Promise.all(['waitlist', 'feedback', 'profiles'].map((t) =>
    db(`/rest/v1/${t}?select=email&email=ilike.${pattern}&limit=5`).then((r) => (r.ok ? r.json() : [])).catch(() => [])));
  if (!lists.flat().some((row: { email?: string }) => (row.email ?? '').toLowerCase() === to)) return reply(403, { message: 'unknown_recipient' });

  // A daily cap, counted from the log.
  const since = new Date(Date.now() - 86400000).toISOString();
  const counted = await db(`/rest/v1/email_log?select=id&sent_at=gte.${encodeURIComponent(since)}`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  if (!counted.ok) return reply(500, { message: 'no_log' });
  const sentToday = Number((counted.headers.get('content-range') ?? '*/0').split('/')[1]) || 0;
  if (sentToday >= DAILY_LIMIT) return reply(429, { message: 'daily_limit' });

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text, html: html(subject, text) }),
  });
  const result = await sent.json().catch(() => ({}));
  if (!sent.ok) return reply(502, { message: 'resend', detail: String(result.message ?? sent.status).slice(0, 200) });

  const me = await db('/auth/v1/user').then((r) => r.json()).catch(() => ({}));
  await db('/rest/v1/email_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ sent_by: me.id, to_email: to, subject, body: text, kind, ref_id: ref, resend_id: result.id ?? null }),
  });
  return reply(200, { id: result.id ?? null, sent_at: new Date().toISOString() });
});
