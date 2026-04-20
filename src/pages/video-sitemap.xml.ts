import videos from '../../public/data/videos.json';

const R2_BASE = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const entries = (videos as any[]).map((v) => {
    const price     = v.price || v.prices?.web || 5;
    const thumb     = v.thumbnail || `${R2_BASE}/thumbs/${v.slug}.jpg`;
    const videoUrl  = v.r2Preview
      ? `${R2_BASE}/${v.r2Preview}`
      : v.r2Key ? `${R2_BASE}/${v.r2Key}` : '';
    const pageUrl   = `https://stockvideo.de/video/${v.slug}/`;
    const duration  = typeof v.duration === 'number'
      ? v.duration
      : (parseInt(String(v.duration).split(':').pop() || '0', 10) || 0);
    // Upload-Datum aus ID-Timestamp ableiten
    const uploadDate = v.id
      ? new Date(parseInt(String(v.id))).toISOString().split('T')[0]
      : '2025-01-01';
    // Beschreibung auf 2 048 Zeichen begrenzen (Google-Limit)
    const desc = esc((v.description || v.title).slice(0, 2048));

    return `  <url>
    <loc>${esc(pageUrl)}</loc>
    <video:video>
      <video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc>
      <video:title>${esc(v.title)}</video:title>
      <video:description>${desc}</video:description>
      ${videoUrl ? `<video:content_loc>${esc(videoUrl)}</video:content_loc>` : ''}
      <video:player_loc>${esc(pageUrl)}</video:player_loc>
      <video:duration>${duration}</video:duration>
      <video:publication_date>${uploadDate}</video:publication_date>
      <video:price currency="EUR" type="own">${price.toFixed(2)}</video:price>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
    </video:video>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
