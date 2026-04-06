import videos from '../data/videos.json';

export async function GET() {
  const entries = videos.map(v => `
  <url>
    <loc>https://stockvideo.de/video/${v.slug}</loc>
    <video:video>
      <video:thumbnail_loc>https://stockvideo.de/thumbnails/${v.slug}.jpg</video:thumbnail_loc>
      <video:title>${v.title}</video:title>
      <video:description>${v.description}</video:description>
      <video:duration>${parseInt(v.duration.split(':')[1])}</video:duration>
    </video:video>
  </url>`).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
