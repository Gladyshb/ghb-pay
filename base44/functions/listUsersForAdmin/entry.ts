import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const appId = secrets.get("BASE44_APP_ID");
    const auth = req.headers.get('authorization');
    const filter = { kyc_status: { $in: ['pending', 'rejected'] } };
    const u = new URL(`https://app.base44.com/api/apps/${appId}/entities/User`);
    u.searchParams.set('q', JSON.stringify(filter));
    u.searchParams.set('limit', '200');
    u.searchParams.set('sort', '-created_date');

    const res = await fetch(u, { headers: auth ? { authorization: auth } : {} });
    if (!res.ok) {
      const txt = await res.text();
      return Response.json({ error: `users endpoint ${res.status}: ${txt}` }, { status: 502 });
    }
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (raw?.items || []);
    const items = list.map((x) => ({
      id: x.id, email: x.email, full_name: x.full_name, role: x.role,
      kyc_status: x.kyc_status, legal_name: x.legal_name, phone: x.phone,
      country: x.country, id_document_type: x.id_document_type,
      id_document_uri: x.id_document_uri, kyc_rejection_reason: x.kyc_rejection_reason,
      created_date: x.created_date,
    }));
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}