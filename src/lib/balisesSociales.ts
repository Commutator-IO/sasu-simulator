/**
 * Link-preview tags for each page: Open Graph, read by Slack, LinkedIn and
 * Facebook, and the Twitter card, read by X.
 *
 * Without them a shared link shows a bare URL, or whatever a crawler guesses.
 * The title and description are lifted from the page's own <title> and
 * <meta name="description">, so the preview cannot drift from the page: edit
 * one, the other follows. Same set of tags as the parent site, plus the image
 * that makes Slack show a large card.
 */

/** Image shared by every page, generated from scripts/apercu-social.html. */
export const IMAGE_APERCU = {
  chemin: '/apercu.png',
  largeur: 1200,
  hauteur: 630,
  alt: 'SASU simulator — salaire ou dividendes, le bon dosage. Barèmes 2026 sourcés.',
} as const;

export const NOM_DU_SITE = 'SASU simulator';

const echapper = (texte: string) =>
  texte
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Undoes the entities a hand-written <title> may contain, before re-escaping. */
const desechapper = (texte: string) =>
  texte
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

/** Reads the page's title and description; throws if either is missing. */
export function lireEntete(html: string): { titre: string; description: string } {
  const titre = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  const description = html.match(
    /<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/,
  )?.[1];
  // A page without them would share an empty card: better to fail the build.
  if (!titre || !description) {
    throw new Error('Page sans <title> ou sans <meta name="description">.');
  }
  const net = (t: string) => desechapper(t.replace(/\s+/g, ' ').trim());
  return { titre: net(titre), description: net(description) };
}

/** The tags for a page served at `url`, with its images under `origine`. */
export function balisesSociales(
  html: string,
  url: string,
  origine: string,
): string {
  const { titre, description } = lireEntete(html);
  const image = `${origine}${IMAGE_APERCU.chemin}`;
  const meta = (attribut: 'property' | 'name', cle: string, valeur: string | number) =>
    `<meta ${attribut}="${cle}" content="${echapper(String(valeur))}" />`;
  return [
    `<link rel="canonical" href="${echapper(url)}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', NOM_DU_SITE),
    meta('property', 'og:locale', 'fr_FR'),
    meta('property', 'og:title', titre),
    meta('property', 'og:description', description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', IMAGE_APERCU.largeur),
    meta('property', 'og:image:height', IMAGE_APERCU.hauteur),
    meta('property', 'og:image:alt', IMAGE_APERCU.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', titre),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', IMAGE_APERCU.alt),
  ].join('\n    ');
}

/** Inserts the tags just before </head>. */
export function insererBalisesSociales(html: string, url: string, origine: string): string {
  if (!html.includes('</head>')) throw new Error('Page sans </head>.');
  return html.replace('</head>', `    ${balisesSociales(html, url, origine)}\n  </head>`);
}
