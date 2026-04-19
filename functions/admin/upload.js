// Konstantzeitvergleich fuer hex/string Tokens.
function _tseq(a, b){ if(typeof a!=='string'||typeof b!=='string')return false; if(a.length!==b.length)return false; let d=0; for(let i=0;i<a.length;i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d===0; }
async function _sha256hex(s){ const buf=new TextEncoder().encode(s); const h=await crypto.subtle.digest('SHA-256',buf); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': 'https://www.stockvideo.de',
    'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Key, X-Admin-Password, Authorization',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'PUT' && request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  // Origin / Referer check als erste (schwache) Huerde.
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const allowed = ['https://www.stockvideo.de', 'https://stockvideo.de'];
  const originOk = allowed.some(a => origin === a || referer.startsWith(a + '/'));
  if (!originOk) return new Response('Forbidden', { status: 403, headers: cors });
  // Echte Auth: Admin-Passwort (Pages-Env: env.ADMIN_PASSWORD) per Header.
  // Backward-compat: Wenn env.ADMIN_PASSWORD noch nicht gesetzt ist, bleibt der alte
  // Origin-only-Modus aktiv (mit Warn-Response-Header), damit Deploys nichts brechen.
  // Sobald ADMIN_PASSWORD gesetzt ist, wird der Header-Check erzwungen.
  const ADMIN_PASSWORD = (env && env.ADMIN_PASSWORD) || '';
  let authMode = 'origin-only';
  if (ADMIN_PASSWORD) {
    const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const pwHeader = request.headers.get('X-Admin-Password') || bearer || '';
    if (!pwHeader) return new Response('Unauthorized', { status: 401, headers: cors });
    // Akzeptiere entweder Klartext (von der Admin-Session) ODER SHA-256-Hex des Passworts.
    const pwHash = await _sha256hex(pwHeader);
    const adminHash = await _sha256hex(ADMIN_PASSWORD);
    if (!_tseq(pwHash, adminHash) && !_tseq(pwHeader, adminHash)) return new Response('Unauthorized', { status: 401, headers: cors });
    authMode = 'password';
  }
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
  return new Response(JSON.stringify({ ok: true, key, authMode }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Upload-Auth': authMode, ...cors } });
}
