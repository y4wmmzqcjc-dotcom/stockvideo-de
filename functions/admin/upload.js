export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': 'https://www.stockvideo.de',
    'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Key',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'PUT' && request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  // Origin / Referer check (lightweight protection - same as panel auth)
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const allowed = ['https://www.stockvideo.de', 'https://stockvideo.de'];
  const ok = allowed.some(a => origin === a || referer.startsWith(a + '/'));
  if (!ok) return new Response('Forbidden', { status: 403, headers: cors });
  if (!env.R2) return new Response('R2 binding missing', { status: 500, headers: cors });
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('X-Upload-Key');
  if (!key) return new Response('Missing key', { status: 400, headers: cors });
  // basic key sanity: only allow videos/, thumbs/, previews/
  if (!/^(videos|thumbs|previews)\/[A-Za-z0-9._-]{1,200}$/.test(key)) {
    return new Response('Invalid key', { status: 400, headers: cors });
  }
  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  await env.R2.put(key, request.body, { httpMetadata: { contentType } });
  return new Response(JSON.stringify({ ok: true, key }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
}
