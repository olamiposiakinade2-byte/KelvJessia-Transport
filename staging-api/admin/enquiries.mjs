import { bookingIntakeEnabled, json, readJson, requestError, requireAdmin, safeText, supabaseRequest } from '../_lib.mjs';

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f-]{34}$/i.test(value);
const statuses = new Set(['new', 'in_progress', 'awaiting_customer', 'resolved', 'closed']);

export default async function handler(req, res) {
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The protected administration area is not enabled.' });
  try {
    const admin = await requireAdmin(req);
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://placeholder.invalid');
      const params = new URLSearchParams({ select: 'id,reference,full_name,email,phone,category,subject,message,status,assigned_to,created_at,updated_at,resolved_at', order: 'created_at.desc', limit: '250' });
      const status = safeText(url.searchParams.get('status'), 24); const category = safeText(url.searchParams.get('category'), 32); const query = safeText(url.searchParams.get('q'), 80);
      if (statuses.has(status)) params.set('status', `eq.${status}`);
      if (category) params.set('category', `eq.${category}`);
      const enquiries = await supabaseRequest(`/rest/v1/customer_enquiries?${params}`);
      const filtered = query ? enquiries.filter(item => [item.reference, item.full_name, item.subject, item.email].join(' ').toLowerCase().includes(query.toLowerCase())) : enquiries;
      return json(res, 200, { enquiries: filtered });
    }
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET, PATCH' });
    const body = await readJson(req); const id = safeText(body.id, 36); const status = safeText(body.status, 24); const hasAssignment = Object.hasOwn(body, 'assignedTo'); const assignedTo = !hasAssignment ? undefined : (body.assignedTo === null ? null : safeText(body.assignedTo, 36)); const internalNote = safeText(body.internalNote, 4000);
    if (!isUuid(id) || !statuses.has(status) || (assignedTo && !isUuid(assignedTo))) return json(res, 400, { error: 'Invalid enquiry update.' });
    if (assignedTo) {
      const roles = await supabaseRequest(`/rest/v1/user_roles?select=user_id&user_id=eq.${encodeURIComponent(assignedTo)}&role=in.(admin,staff)&limit=1`);
      if (!Array.isArray(roles) || !roles.length) return json(res, 400, { error: 'The assigned user is not authorized staff.' });
    }
    const patch = { status, resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null, ...(hasAssignment ? { assigned_to: assignedTo } : {}) };
    const rows = await supabaseRequest(`/rest/v1/customer_enquiries?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch });
    if (!Array.isArray(rows) || !rows.length) return json(res, 404, { error: 'Enquiry was not found.' });
    if (internalNote) await supabaseRequest('/rest/v1/enquiry_responses', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { enquiry_id: id, author_id: admin.id, body: internalNote, is_internal: true } });
    await supabaseRequest('/rest/v1/audit_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { actor_id: admin.id, action: 'enquiry_updated', entity_type: 'enquiry', entity_id: id, after_state: { status, assignedTo, internalNoteAdded: Boolean(internalNote) } } });
    json(res, 200, { enquiry: rows[0] });
  } catch (error) { requestError(res, error); }
}
