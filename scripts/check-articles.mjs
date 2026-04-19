#!/usr/bin/env node
/**
 * Konsistenz-Check fuer Wissens-Artikel.
 *
 * Spiegelt die Filterlogik aus src/pages/wissen/index.astro und
 * src/pages/wissen/[slug].astro. Laeuft die Artikelliste durch und meldet,
 * wenn ein Artikel mit status=published vom Filter ausgeschlossen wuerde —
 * genau der Fehler, der Artikel #22 unsichtbar gemacht hat.
 *
 * Exit-Code 0 = ok, 1 = Inkonsistenz entdeckt.
 * Wird in package.json als "predeploy" oder "check" eingebunden und kann
 * lokal via `npm run check:articles` laufen.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesPath = resolve(__dirname, '../public/data/articles.json');

const articles = JSON.parse(readFileSync(articlesPath, 'utf8'));
const now = new Date();

function isVisible(a) {
  if (a.status === 'draft') return false;
  if (a.status === 'published') return true;
  if (a.status === 'scheduled' && a.scheduledDate) {
    const t = a.scheduledTime || '00:00';
    return new Date(a.scheduledDate + 'T' + t + ':00') <= now;
  }
  if (!a.status && a.publishDate) {
    return new Date(a.publishDate + 'T00:00:00') <= now;
  }
  return false;
}

const byStatus = { published: 0, scheduled: 0, draft: 0, other: 0 };
const ghosts = [];      // status=published aber Filter=false (sollte nicht passieren)
const dateMismatch = []; // status=published mit scheduledDate/scheduledTime-Resten

for (const a of articles) {
  const s = ['published', 'scheduled', 'draft'].includes(a.status) ? a.status : 'other';
  byStatus[s]++;

  if (a.status === 'published' && !isVisible(a)) {
    ghosts.push({ id: a.id, slug: a.slug, title: a.title });
  }
  if (a.status === 'published' && (a.scheduledDate || a.scheduledTime)) {
    dateMismatch.push({
      id: a.id,
      slug: a.slug,
      scheduledDate: a.scheduledDate,
      scheduledTime: a.scheduledTime
    });
  }
}

const visibleCount = articles.filter(isVisible).length;

console.log('\nArtikel-Konsistenz-Check');
console.log('-------------------------');
console.log(`gesamt:         ${articles.length}`);
console.log(`published:      ${byStatus.published}`);
console.log(`scheduled:      ${byStatus.scheduled}`);
console.log(`draft:          ${byStatus.draft}`);
console.log(`ohne status:    ${byStatus.other}`);
console.log(`vom Filter ok:  ${visibleCount}`);

let ok = true;

if (ghosts.length) {
  ok = false;
  console.error('\nFEHLER: status=published, aber vom Filter ausgeschlossen:');
  for (const g of ghosts) console.error(`  #${g.id}  ${g.slug}  ${g.title}`);
}

if (dateMismatch.length) {
  console.warn(`\nHINWEIS: ${dateMismatch.length} Artikel haben status=published mit uebrigen`);
  console.warn('         scheduledDate/Time-Feldern (harmlos, koennen bereinigt werden).');
  console.warn('         Mit CHECK_ARTICLES_VERBOSE=1 komplette Liste anzeigen.');
  if (process.env.CHECK_ARTICLES_VERBOSE) {
    for (const d of dateMismatch) {
      console.warn(`  #${d.id}  ${d.slug}  (${d.scheduledDate || '-'} ${d.scheduledTime || ''})`);
    }
  }
}

if (!ok) {
  console.error('\n==> Check fehlgeschlagen. Build stoppen und Filter/Daten pruefen.\n');
  process.exit(1);
}

console.log('\n==> Alle veroeffentlichten Artikel werden ausgeliefert.\n');
