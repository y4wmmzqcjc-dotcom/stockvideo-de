import type { APIRoute } from 'astro';
import videos from '../data/videos.json';

const getVideoSitemap = (): string => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${videos
  .map((video) => {
    const durationInSeconds = convertDurationToSeconds(video.duration);
    return `  <url>
    <loc>https://stockvideo.de/video/${video.slug}</loc>
    <video:video>
      <video:title>${escapeXml(video.title)}</video:title>
      <video:description>${escapeXml(video.description)}</video:description>
      <video:thumbnail_loc>${video.thumbnail}</video:thumbnail_loc>
      <video:duration>${durationInSeconds}</video:duration>
      <video:uploader info="contact">stockvideo.de</video:uploader>
    </video:video>
  </url>`;
  })
  .join('\n')}
</urlset>`;
  return sitemap;
};

const convertDurationToSeconds = (duration: string): number => {
  const parts = duration.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 0;
};

const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const GET: APIRoute = () => {
  const sitemap = getVideoSitemap();
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
