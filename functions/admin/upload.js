// Cloudflare Pages Function: PUT /admin/upload?key=...
// Requires R2 binding "R2" and secret "ADMIN_TOKEN" in Pages project settings.
export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Upload-Key',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\\s+/i, '');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }
  if (!env.R2) {
    return new Response('R2 binding missing', { status: 500, headers: cors });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('X-Upload-Key');
  if (!key) return new Response('Missing key', { status: 400, headers: cors });
  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  await env.R2.put(key, request.body, { httpMetadata: { contentType } });
  return new Response(JSON.stringify({ ok: true, key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
