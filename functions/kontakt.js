/**
 * Kontaktformular-Handler (Cloudflare Pages Function)
 *
 * Erforderliche Env-Variablen (im Cloudflare Pages Dashboard setzen):
 *   - RESEND_API_KEY     (von resend.com → API Keys)
 *   - CONTACT_TO_EMAIL   (Empfänger, z. B. info@stockvideo.de)
 *   - CONTACT_FROM_EMAIL (Absender, z. B. noreply@stockvideo.de — muss bei Resend verifiziert sein)
 */
export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { name, email, subject, message, website } = body || {};

    // Honeypot: gefülltes website-Feld = Bot
    if (website) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Pflichtfelder prüfen
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Bitte fülle alle Pflichtfelder aus.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Einfache E-Mail-Validierung
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Längen-Limits gegen Missbrauch
    const safe = (s, max) => String(s).slice(0, max);
    const safeName = safe(name, 200);
    const safeEmail = safe(email, 200);
    const safeSubject = safe(subject || 'allgemein', 100);
    const safeMessage = safe(message, 5000);

    // HTML-Escape gegen XSS in der Mail
    const esc = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const html = `
      <h2>Neue Nachricht über das Kontaktformular</h2>
      <p><strong>Name:</strong> ${esc(safeName)}</p>
      <p><strong>E-Mail:</strong> ${esc(safeEmail)}</p>
      <p><strong>Betreff:</strong> ${esc(safeSubject)}</p>
      <hr>
      <p>${esc(safeMessage).replace(/\n/g, '<br>')}</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: env.CONTACT_TO_EMAIL,
        reply_to: safeEmail,
        subject: `[Kontakt] ${safeSubject} — ${safeName}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', errText);
      return new Response(
        JSON.stringify({ error: 'E-Mail konnte nicht versendet werden. Bitte versuche es später erneut oder schreibe direkt an die im Impressum angegebene Adresse.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Unerwarteter Fehler: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
