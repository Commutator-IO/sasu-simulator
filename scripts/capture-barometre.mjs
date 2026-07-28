// Monthly capture of the public day-rate barometer, to grow a real history.
//
// The page renders its figures client-side, so a plain fetch returns an empty
// shell — we drive a headless browser instead. The target URL is read from the
// BAROMETRE_URL environment variable (a repository secret), so no source name
// lives in the committed code.
//
// Run by .github/workflows/capture-tjm.yml. Appends one dated point per month
// to src/data/barometreTjm.json and is idempotent: a month already captured as
// a real ("live") measurement is left untouched.
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

// "YYYY-MM" for the current month, from the runner's clock.
const maintenant = new Date();
const mois = `${maintenant.getUTCFullYear()}-${String(maintenant.getUTCMonth() + 1).padStart(2, '0')}`;

function nombre(txt) {
  const m = String(txt).match(/(\d[\d\s]*)/);
  return m ? Number(m[1].replace(/\s/g, '')) : null;
}

function moyenne(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

const navigateur = await chromium.launch();
let brut;
try {
  const page = await navigateur.newPage();
  await page.goto(CIBLE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500); // let the client-side figures settle

  brut = await page.evaluate(() => {
    const lignes = document.body.innerText.split('\n').map((l) => l.trim());

    // National headline: the first standalone price, taken from the block before
    // the by-seniority section. The DOM text order around the "Tarif jour moyen"
    // label is not stable, but the headline is the first bare "NNN €" on the page.
    const finEntete = lignes.findIndex((l) => /ans d'expérience/i.test(l));
    const zone = finEntete > 0 ? lignes.slice(0, finEntete) : lignes;
    const national = zone.find((l) => /^\d[\d\s]*\s*€$/.test(l)) ?? null;

    // Per-seniority average: a label line then a "Tarif moyen : N€" line.
    const trancheApres = (regex) => {
      const i = lignes.findIndex((l) => regex.test(l));
      if (i < 0) return null;
      for (let j = i + 1; j < Math.min(i + 6, lignes.length); j++) {
        const m = lignes[j].match(/Tarif moyen\s*:\s*([\d\s]+)/i);
        if (m) return m[1];
      }
      return null;
    };
    const experience = {
      '0-2': trancheApres(/0-2 ans/i),
      '3-7': trancheApres(/3-7 ans/i),
      '8-15': trancheApres(/8-15 ans/i),
      '15p': trancheApres(/15 ans et \+/i),
    };

    // By-city table: header row naming the cities, then one row per sub-branch.
    const tables = [...document.querySelectorAll('table')].map((t) =>
      [...t.querySelectorAll('tr')].map((tr) =>
        [...tr.querySelectorAll('th,td')].map((c) => c.innerText.trim()),
      ),
    );

    return { national, experience, tables };
  });
} finally {
  await navigateur.close();
}

// Locate the city table and average each city column across its rows.
{
  const parVille = {};
  const table = brut.tables.find(
    (rows) => rows[0] && VILLES.every((v) => rows[0].includes(v)),
  );
  if (table) {
    const entete = table[0];
    const colonnes = Object.fromEntries(VILLES.map((v) => [v, entete.indexOf(v)]));
    for (const v of VILLES) {
      const col = colonnes[v];
      const vals = table.slice(1).map((r) => nombre(r[col])).filter((x) => x);
      parVille[v] = moyenne(vals);
    }
  }

  const national = nombre(brut.national);
  const experience = Object.fromEntries(
    Object.entries(brut.experience).map(([k, val]) => [k, nombre(val)]),
  );

  // Refuse to write a partial or implausible capture.
  const plausible = (x) => Number.isFinite(x) && x >= 200 && x <= 2000;
  const manquant = [
    ['national', national],
    ...VILLES.map((v) => [v, parVille[v]]),
    ...Object.entries(experience),
  ].filter(([, x]) => !plausible(x));
  if (manquant.length) {
    console.error('Capture incomplète, rien n’est écrit. Champs invalides :', manquant);
    process.exit(2);
  }

  const donnees = JSON.parse(readFileSync(CHEMIN_JSON, 'utf8'));

  // BAROMETRE_URL points at the Experts Data category page; other professions
  // would each need their own capture. Append to that profession's series.
  const prof = donnees.professions.find((p) => p.cle === 'expert-data');
  if (!prof) {
    console.error('Profession expert-data introuvable dans le dataset.');
    process.exit(3);
  }

  if (prof.villes.some((p) => p.date === mois && p.origine === 'live')) {
    console.log(`Le mois ${mois} est déjà capturé (mesure réelle). Rien à faire.`);
    process.exit(0);
  }

  // Stamp the check date: the page shows it, and a figure whose date stops
  // moving is the only visible sign that the capture has stopped running.
  donnees.meta.verifieLe = maintenant.toISOString().slice(0, 10);

  prof.villes.push({ date: mois, origine: 'live', national, ...parVille });
  // A profession only carries a per-bracket history when its page publishes one.
  if (Array.isArray(prof.experienceHistorique)) {
    prof.experienceHistorique.push({ date: mois, ...experience });
  }
  // Keep the projections after the freshly measured point.
  prof.villes.sort((a, b) => (a.date < b.date ? -1 : 1));

  writeFileSync(CHEMIN_JSON, `${JSON.stringify(donnees, null, 2)}\n`);
  console.log(`Point ${mois} ajouté : national ${national} €, Paris ${parVille.Paris} €.`);
}
