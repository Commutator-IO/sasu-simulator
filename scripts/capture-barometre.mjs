// Monthly capture of the public day-rate barometer, to grow a real history.
//
// The pages render their figures client-side, so a plain fetch returns an empty
// shell — we drive a headless browser instead. The base address is read from the
// BAROMETRE_URL environment variable (a repository secret), so no source name
// lives in the committed code: only the per-profession path segments, which name
// trades rather than a site.
//
// Run by .github/workflows/capture-tjm.yml. Appends one dated point per month to
// every profession in src/data/barometreTjm.json, refreshes their seniority
// brackets, and extends the projections from the new measurements. Idempotent: a
// month already captured as a real ("live") measurement is left untouched.
//
// One profession failing does not sink the others — each is written or skipped
// on its own, and the run only fails if nothing at all could be captured. That
// matters: a single stale profession is exactly how the dataset drifted before.
//
// Known limit: the source is behind bot protection. A default headless run gets
// a 403 challenge page, so the monthly schedule is off and the workflow is
// manual-only. This script works when run from an environment the source serves;
// otherwise the refresh is done by hand and `meta.verifieLe` records the date.
// Defeating that protection is out of scope, deliberately.
//
// Playwright is installed by the workflow, not declared as an app dependency —
// this script never runs in the app bundle.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const CIBLE = process.env.BAROMETRE_URL;
if (!CIBLE) {
  console.error('BAROMETRE_URL manquant (le définir en secret du dépôt).');
  process.exit(1);
}

const CHEMIN_JSON = new URL('../src/data/barometreTjm.json', import.meta.url);
const VILLES = ['Paris', 'Lyon', 'Bordeaux', 'Lille', 'Marseille'];
const COLONNES = ['national', ...VILLES];

// Profession key in the dataset -> the path segment its page sits under. The
// secret carries the host and the section; only these trade names are in code.
const SEGMENTS = {
  'expert-data': 'expert-data',
  developpeur: 'tech',
  consultant: 'business-conseil',
  'chef-de-projet': 'gestion-de-projets-coaching',
  marketing: 'marketing',
  graphiste: 'web-graphic-design',
  redacteur: 'communication',
  motion: 'image-son',
  'jeux-video': 'jeux-video',
};

// BAROMETRE_URL points at one profession's page; its parent is the section.
const base = CIBLE.replace(/\/+$/, '').replace(/\/[^/]*$/, '');
const urlDe = (segment) => `${base}/${segment}`;

// "YYYY-MM" for the current month, from the runner's clock.
const maintenant = new Date();
const mois = `${maintenant.getUTCFullYear()}-${String(maintenant.getUTCMonth() + 1).padStart(2, '0')}`;

const nombre = (txt) => {
  const m = String(txt).match(/(\d[\d\s]*)/);
  return m ? Number(m[1].replace(/\s/g, '')) : null;
};

const moyenne = (valeurs) => {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** "YYYY-MM" as a decimal year, for fitting a trend over dated points. */
const anneeDecimale = (date) => {
  const [a, m] = date.split('-').map(Number);
  return a + (m - 0.5) / 12;
};

/** Reads one profession's page. Returns raw strings; parsing happens after. */
async function lire(page, url) {
  // Waiting for the by-city table beats waiting for the network to fall quiet:
  // these pages keep chattering long after the figures are painted, and nine of
  // them at a 60-second idle timeout is most of a CI job spent doing nothing.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('table', { timeout: 30000 });
  await page.waitForTimeout(800); // let the last cells settle

  return page.evaluate(() => {
    const lignes = document.body.innerText.split('\n').map((l) => l.trim());

    // National headline: the first standalone price, taken from the block before
    // the by-seniority section. The DOM text order around the "Tarif jour moyen"
    // label is not stable, but the headline is the first bare "NNN €" on the page.
    const finEntete = lignes.findIndex((l) => /ans d'expérience/i.test(l));
    const zone = finEntete > 0 ? lignes.slice(0, finEntete) : lignes;
    const national = zone.find((l) => /^\d[\d\s]*\s*€$/.test(l)) ?? null;

    // Seniority brackets: a label line, then floor / average / ceiling. Read as
    // the first three figures after the label rather than by wording — some
    // pages render this block in English ("€120 or less", "Average rate : …").
    const tranche = (regex) => {
      const i = lignes.findIndex((l) => regex.test(l));
      if (i < 0) return null;
      const nombres = [];
      for (let j = i + 1; j < Math.min(i + 7, lignes.length) && nombres.length < 3; j++) {
        for (const m of lignes[j].matchAll(/(\d[\d\s]*)/g)) {
          const n = Number(m[1].replace(/\s/g, ''));
          if (n >= 100) nombres.push(n);
        }
      }
      return nombres.length === 3 ? nombres : null;
    };
    const experience = {
      '0-2': tranche(/^0-2 ans/i),
      '3-7': tranche(/^3-7 ans/i),
      '8-15': tranche(/^8-15 ans/i),
      '15p': tranche(/^15 ans et \+/i),
    };

    // By-city table: header row naming the cities, then one row per speciality.
    const tables = [...document.querySelectorAll('table')].map((t) =>
      [...t.querySelectorAll('tr')].map((tr) =>
        [...tr.querySelectorAll('th,td')].map((c) => c.innerText.trim()),
      ),
    );

    return { national, experience, tables };
  });
}

/** Turns one page's raw strings into a dated point, or explains what is missing. */
function interpreter(brut) {
  const parVille = {};
  const table = brut.tables.find(
    (rows) => rows[0] && VILLES.every((v) => rows[0].includes(v)),
  );
  if (table) {
    const entete = table[0];
    for (const v of VILLES) {
      const col = entete.indexOf(v);
      parVille[v] = moyenne(table.slice(1).map((r) => nombre(r[col])).filter((x) => x));
    }
  }

  const national = nombre(brut.national);
  const experience = Object.fromEntries(
    Object.entries(brut.experience).map(([cle, v]) => [
      cle,
      v ? { bas: v[0], moyen: v[1], haut: v[2] } : null,
    ]),
  );

  // Refuse a partial or implausible capture rather than write half a point.
  const plausible = (x) => Number.isFinite(x) && x >= 100 && x <= 5000;
  const invalides = [
    ['national', national],
    ...VILLES.map((v) => [v, parVille[v]]),
    ...Object.entries(experience).flatMap(([cle, t]) =>
      t ? [[`${cle}.moyen`, t.moyen]] : [[cle, null]],
    ),
  ].filter(([, x]) => !plausible(x));

  return { national, parVille, experience, invalides };
}

/**
 * Extends a profession's projections from its measurements.
 *
 * The documented rule, and the one used to rebuild the series by hand: fit the
 * last three years and carry it forward at half intensity — a trend is evidence
 * of direction, not a promise it continues at pace. Each band keeps the relative
 * width it already had, since that encodes the profession's own volatility.
 */
function reprojeter(prof) {
  const projections = prof.villes.filter((p) => p.origine === 'projection');
  const mesures = prof.villes.filter((p) => p.origine !== 'projection');
  if (!projections.length || mesures.length < 2) return;

  const ratios = new Map(
    projections.map((p) => [
      p.date,
      Object.fromEntries(
        COLONNES.filter((c) => p.marge?.[c] && p[c]).map((c) => [
          c,
          [p.marge[c][0] / p[c], p.marge[c][1] / p[c]],
        ]),
      ),
    ]),
  );

  const fin = mesures[mesures.length - 1];
  const recents = mesures.filter(
    (p) => anneeDecimale(p.date) >= anneeDecimale(fin.date) - 3,
  );

  for (const p of projections) {
    const dt = anneeDecimale(p.date) - anneeDecimale(fin.date);
    for (const c of COLONNES) {
      const xs = recents.filter((r) => Number.isFinite(r[c])).map((r) => anneeDecimale(r.date));
      const ys = recents.filter((r) => Number.isFinite(r[c])).map((r) => r[c]);
      if (xs.length < 2 || !Number.isFinite(fin[c])) continue;
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      const pente = den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : 0;
      p[c] = Math.round(fin[c] + pente * 0.5 * dt);
      const r = ratios.get(p.date)?.[c];
      if (r && p.marge?.[c]) p.marge[c] = [Math.round(p[c] * r[0]), Math.round(p[c] * r[1])];
    }
  }
}

const donnees = JSON.parse(readFileSync(CHEMIN_JSON, 'utf8'));
const navigateur = await chromium.launch();
const ajoutes = [];
const ignores = [];

try {
  const page = await navigateur.newPage();

  for (const [cle, segment] of Object.entries(SEGMENTS)) {
    const prof = donnees.professions.find((p) => p.cle === cle);
    if (!prof) {
      ignores.push(`${cle} : absent du jeu de données`);
      continue;
    }
    if (prof.villes.some((p) => p.date === mois && p.origine === 'live')) {
      ignores.push(`${cle} : ${mois} déjà capturé`);
      continue;
    }

    let releve;
    try {
      releve = interpreter(await lire(page, urlDe(segment)));
    } catch (err) {
      ignores.push(`${cle} : lecture impossible (${err.message.split('\n')[0]})`);
      continue;
    }
    if (releve.invalides.length) {
      ignores.push(
        `${cle} : capture incomplète, rien écrit (${releve.invalides
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')})`,
      );
      continue;
    }

    prof.villes.push({
      date: mois,
      origine: 'live',
      national: releve.national,
      ...releve.parVille,
    });
    // Keep the projections after the freshly measured point.
    prof.villes.sort((a, b) => (a.date < b.date ? -1 : 1));

    // Brackets are republished each month too, and a stale ceiling misplaces the
    // whole seniority gauge — so they are refreshed, not just appended to.
    for (const niveau of prof.experience) {
      const t = releve.experience[niveau.cle];
      if (t) Object.assign(niveau, t);
    }
    if (Array.isArray(prof.experienceHistorique)) {
      prof.experienceHistorique.push({
        date: mois,
        ...Object.fromEntries(
          Object.entries(releve.experience).map(([k, t]) => [k, t?.moyen ?? null]),
        ),
      });
    }

    reprojeter(prof);
    ajoutes.push(`${cle} : national ${releve.national} €, Paris ${releve.parVille.Paris} €`);
  }
} finally {
  await navigateur.close();
}

if (!ajoutes.length) {
  console.log('Aucun point ajouté.');
  ignores.forEach((l) => console.log(`  - ${l}`));
  // Nothing new is a normal outcome for a re-run; only a total failure is not.
  process.exit(ignores.every((l) => l.includes('déjà capturé')) ? 0 : 2);
}

// The date is shown on the site: a figure whose date stops moving is the only
// visible sign that the capture has stopped running.
donnees.meta.verifieLe = maintenant.toISOString().slice(0, 10);
writeFileSync(CHEMIN_JSON, `${JSON.stringify(donnees, null, 2)}\n`);

console.log(`Point ${mois} ajouté pour ${ajoutes.length} métier(s) :`);
ajoutes.forEach((l) => console.log(`  + ${l}`));
if (ignores.length) {
  console.log('Ignorés :');
  ignores.forEach((l) => console.log(`  - ${l}`));
}
