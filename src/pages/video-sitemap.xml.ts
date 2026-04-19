import videos from '../../public/data/videos.json';

function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const entries = videos.map((v: any) => {
    const thumb = v.thumbnail || `https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev/thumbs/${v.slug}.jpg`;
    const duration = typeof v.duration === 'number'
      ? v.duration
      : (parseInt(String(v.duration).split(':').pop() || '0', 10) || 0);
    return `
  <url>
    <loc>https://stockvideo.de/video/${xmlEscape(v.slug)}</loc>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(thumb)}</video:thumbnail_loc>
      <video:title>${xmlEscape(v.title)}</video:title>
      <video:description>${xmlEscape(v.description || v.title)}</video:description>
      <video:duration>${duration}</video:duration>
    </video:video>
  </url>`;
  }).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
