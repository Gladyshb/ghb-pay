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
    if (me.referred_by) return Response.json({ ok: false, reason: 'already_referred' });

    const appId = secrets.get("BASE44_APP_ID");
    const auth = req.headers.get('authorization');
    const u = new URL(`https://app.base44.com/api/apps/${appId}/entities/User`);
    u.searchParams.set('q', JSON.stringify({ referral_code: code }));
    u.searchParams.set('limit', '1');
    const res = await fetch(u, { headers: auth ? { authorization: auth } : {} });
    if (!res.ok) return Response.json({ ok: false, reason: 'lookup_failed' });
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (raw?.items || []);
    const referrer = list[0];
    if (!referrer) return Response.json({ ok: false, reason: 'not_found' });
    if (referrer.id === me.id) return Response.json({ ok: false, reason: 'self' });

    await base44.auth.updateMe({ referred_by: referrer.id });
    await base44.entities.Referral.create({
      referrer_id: referrer.id,
      referrer_name: referrer.legal_name || referrer.email,
      referrer_code: referrer.referral_code || '',
      referred_id: me.id,
      referred_name: me.legal_name || me.email,
      referred_username: me.username || '',
      referred_email: me.email,
      status: 'pending',
      reward_amount: 0,
    });
    return Response.json({ ok: true, referrer_name: referrer.legal_name || referrer.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}