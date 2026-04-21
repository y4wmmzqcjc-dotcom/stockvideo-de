// Cloudflare Pages Function: /api/ki-analyze
// GEMINI_KEY als Cloudflare Pages Secret - niemals im Code!
export async function onRequest(context) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }
  try {
    const key = env.GEMINI_KEY;
    if (!key) return new Response(JSON.stringify({ error: 'GEMINI_KEY fehlt' }), { status: 500, headers: cors });
    const body = await request.json();
    const frames = Array.isArray(body.frames) ? body.frames : [];
    const prompt = body.prompt || '';
    const parts = frames.map(f => ({ inline_data: { mime_type: 'image/jpeg', data: f } }));
    parts.push({ text: prompt });
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key;
    const gr = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: 'application/json', temperature: 0.2, maxOutputTokens: 512 } })
    });
    const raw = await gr.text();
    if (!gr.ok) return new Response(JSON.stringify({ error: 'Gemini ' + gr.status, detail: raw.substring(0, 300) }), { status: 500, headers: cors });
    let result;
    try { result = JSON.parse(raw); } catch(e) { return new Response(JSON.stringify({ error: 'Gemini kein JSON', raw: raw.substring(0,200) }), { status: 500, headers: cors }); }
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return new Response(JSON.stringify({ analysis: text }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Exception', detail: String(err) }), { status: 500, headers: cors });
  }
}
