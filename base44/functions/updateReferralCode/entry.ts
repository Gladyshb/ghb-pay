import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch {}
    const code = (body && body.code || '').toString().trim().toUpperCase();
    if (!code) return Response.json({ ok: false, reason: 'no_code' });
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return Response.json({ ok: false, reason: 'invalid_format' });

    const appId = secrets.get("BASE44_APP_ID");
    const auth = req.headers.get('authorization');
    const u = new URL(`https://app.base44.com/api/apps/${appId}/entities/User`);
    u.searchParams.set('q', JSON.stringify({ referral_code: code }));
    u.searchParams.set('limit', '1');
    const res = await fetch(u, { headers: auth ? { authorization: auth } : {} });
    if (!res.ok) return Response.json({ ok: false, reason: 'lookup_failed' });
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (raw?.items || []);
    const existing = list[0];
    if (existing && existing.id !== me.id) return Response.json({ ok: false, reason: 'taken' });

    await base44.auth.updateMe({ referral_code: code });
    return Response.json({ ok: true, code });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}