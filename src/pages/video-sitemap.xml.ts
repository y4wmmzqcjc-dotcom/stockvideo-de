import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const videos = await getCollection('videos');
  const siteUrl = 'https://stockvideo.de';

  const videoEntries = videos.map(video => {
    const { data, id } = video;
    const thumbnail = data.thumbnail
      ? `${siteUrl}${data.thumbnail}`
      : `${siteUrl}/og-image.jpg`;

    return `
  <url>
    <loc>${siteUrl}/video/${id}</loc>
    <video:video>
      <video:thumbnail_loc>${thumbnail}</video:thumbnail_loc>
      <video:title>${escapeXml(data.title)}</video:title>
      <video:description>${escapeXml(data.description)}</video:description>
      <video:content_loc>${siteUrl}/video/${id}</video:content_loc>
      <video:duration>${data.duration}</video:duration>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
>
${videoEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
