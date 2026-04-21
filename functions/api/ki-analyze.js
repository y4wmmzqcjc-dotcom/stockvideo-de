// Cloudflare Pages Function: /api/ki-analyze
// GEMINI_KEY wird als Cloudflare Pages Secret hinterlegt (niemals im Code!)
export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  const { request, env } = context;

  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const GEMINI_KEY = env.GEMINI_KEY;
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_KEY nicht konfiguriert' }), { status: 500, headers: corsHeaders });
    }
    const body = await request.json();
    const frames = body.frames || [];
    const prompt = body.prompt || '';
    const parts = frames.map(f => ({ inline_data: { mime_type: 'image/jpeg', data: f } }));
    parts.push({ text: prompt });
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent' +
                     '?key=' + GEMINI_KEY;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.2, maxOutputTokens: 512 }
      })
    });
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: 'Gemini Fehler ' + geminiRes.status, detail: errText.substring(0, 300) }), { status: 502, headers: corsHeaders });
    }
    const result = await geminiRes.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return new Response(JSON.stringify({ analysis: text }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Interner Fehler', detail: String(err) }), { status: 500, headers: corsHeaders });
  }
}
