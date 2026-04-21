export async function onRequest(context) {
  const { request, env } = context;
  const h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: h });
  try {
    const body = await request.json();
    const hasKey = !!env.GEMINI_KEY;
    return new Response(JSON.stringify({ ok: true, hasKey, framesCount: (body.frames||[]).length, prompt: body.prompt }), { headers: h });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: h });
  }
}
