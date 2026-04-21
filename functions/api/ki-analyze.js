// Cloudflare Pages Function: /api/ki-analyze
// GEMINI_KEY wird als Cloudflare Pages Secret hinterlegt (niemals im Code!)
export async function onRequestPost(context) {
  const { request, env } = context;
  const GEMINI_KEY = env.GEMINI_KEY;
  if (!GEMINI_KEY) return new Response(JSON.stringify({ error: 'GEMINI_KEY nicht konfiguriert' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const body = await request.json();
  const { frames, prompt } = body;
  if (!frames || !prompt) return new Response(JSON.stringify({ error: 'frames und prompt erforderlich' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const parts = frames.map(f => ({ inline_data: { mime_type: 'image/jpeg', data: f } }));
  parts.push({ text: prompt });
  const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: 'application/json', temperature: 0.2, maxOutputTokens: 512 } })
  });
  if (!geminiRes.ok) { const t = await geminiRes.text(); return new Response(JSON.stringify({ error: 'Gemini ' + geminiRes.status, detail: t.substring(0,200) }), { status: 502, headers: { 'Content-Type': 'application/json' } }); }
  const result = await geminiRes.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  return new Response(JSON.stringify({ analysis: text || null }), { headers: { 'Content-Type': 'application/json' } });
}