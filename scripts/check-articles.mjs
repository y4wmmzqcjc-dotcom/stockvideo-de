#!/usr/bin/env node
/**
 * Konsistenz-Check fuer Wissens-Artikel.
 *
 * Spiegelt die Filterlogik aus src/pages/wissen/index.astro und
 * src/pages/wissen/[slug].astro:
 *   - draft:             nie sichtbar
 *   - published + Datum: sichtbar sobald Datum erreicht (Rollout-Staffel)
 *   - published o. Datum: sofort sichtbar
 *   - scheduled:         sichtbar sobald scheduledDate erreicht
 *
 * Harter Fehler (exit 1) nur bei "published o. Datum" das trotzdem
 * nicht auf der Uebersicht landen wuerde - das wuerde auf einen Filter-Bug
 * hinweisen (siehe urspruenglicher Artikel-#22-Bug).
 *
 * Zukunftsartikel mit status=published werden als HINWEIS gelistet
 * (Staffel-Rollout, bewusst so gesetzt) - kein Fehler.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesPath = resolve(__dirname, '../public/data/articles.json');

const articles = JSON.parse(readFileSync(articlesPath, 'utf8'));
const now = new Date();

function effectivePublishAt(a) {
  if (a.scheduledDate) {
    const t = a.scheduledTime || '00:00';
    return new Date(a.scheduledDate + 'T' + t + ':00');
  }
  if (a.publishDate) {
    const t = a.publishTime || '00:00';
    return new Date(a.publishDate + 'T' + t + ':00');
  }
  return null;
}

function isVisible(a) {
  if (a.status === 'draft') return false;
  const at = effectivePublishAt(a);
  if (a.status === 'published' && !at) return true;
  if (at) return at <= now;
  return false;
}

const byStatus = { published: 0, scheduled: 0, draft: 0, other: 0 };
const futurePublished = []; // published + Datum in Zukunft (Staffel-Rollout, Hinweis)
const realGhosts = [];      // published + KEIN Datum, aber trotzdem unsichtbar (Filter-Bug)

for (const a of articles) {
  const s = ['published', 'scheduled', 'draft'].includes(a.status) ? a.status : 'other';
  byStatus[s]++;

  if (a.status === 'published' && !isVisible(a)) {
    const at = effectivePublishAt(a);
    if (at) {
      futurePublished.push({ id: a.id, slug: a.slug, title: a.title, at });
    } else {
      realGhosts.push({ id: a.id, slug: a.slug, title: a.title });
    }
  }
}

const visibleCount = articles.filter(isVisible).length;

console.log('\nArtikel-Konsistenz-Check');
console.log('-------------------------');
console.log(`gesamt:              ${articles.length}`);
console.log(`published:           ${byStatus.published}`);
console.log(`  davon live:        ${byStatus.published - futurePublished.length}`);
console.log(`  davon verzoegert:  ${futurePublished.length}`);
console.log(`scheduled:           ${byStatus.scheduled}`);
console.log(`draft:               ${byStatus.draft}`);
console.log(`ohne status:         ${byStatus.other}`);
console.log(`aktuell sichtbar:    ${visibleCount}`);

if (futurePublished.length) {
  console.log(`\nHINWEIS: ${futurePublished.length} Artikel mit status=published haben einen Veroeffentlichungs-`);
  console.log('         zeitpunkt in der Zukunft - sie erscheinen automatisch, wenn der Zeitpunkt erreicht ist.');
  console.log('         Ihre Detailseiten werden bereits gebaut, damit interne Verlinkungen funktionieren.');
  console.log('         Mit CHECK_ARTICLES_VERBOSE=1 komplette Liste anzeigen.');
  if (process.env.CHECK_ARTICLES_VERBOSE) {
    const sorted = futurePublished.slice().sort((a, b) => a.at - b.at);
    for (const f of sorted) {
      console.log(`  #${f.id}  ${f.at.toISOString().slice(0, 16).replace('T', ' ')}  ${f.slug}`);
    }
  }
}

if (realGhosts.length) {
  console.error('\nFEHLER: status=published OHNE Datum, trotzdem vom Filter ausgeschlossen:');
  console.error('        Das ist ein Filter-Bug, nicht erwartet. Bitte Filterlogik pruefen.');
  for (const g of realGhosts) console.error(`  #${g.id}  ${g.slug}  ${g.title}`);
  console.error('\n==> Check fehlgeschlagen. Build stoppen und Filter pruefen.\n');
  process.exit(1);
}

console.log('\n==> Filterlogik konsistent. Build kann weiterlaufen.\n');
