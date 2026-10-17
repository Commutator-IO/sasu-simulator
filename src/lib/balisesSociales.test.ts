import { describe, expect, it } from 'vitest';
import { IMAGE_APERCU, insererBalisesSociales, lireEntete } from './balisesSociales';
import config from '../../vite.config.ts?raw';
import apercu from '../../public/apercu.png?inline';

// Every HTML page of the site, read as text the way Vite would serve it.
const SOURCES = import.meta.glob<string>(['../../index.html', '../../*/index.html', '!../../dist/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const PAGE = `<html><head>
    <meta
      name="description"
      content="Ajustez vos acomptes &amp; le solde : « au plus juste »."
    />
    <title>Acomptes d'IS — 2026</title>
  </head><body></body></html>`;

describe('balises d’aperçu', () => {
  const html = insererBalisesSociales(PAGE, 'https://sasu.commutator.io/acomptes/', 'https://sasu.commutator.io');

  it('reprend le titre et la description de la page', () => {
    expect(html).toContain(`<meta property="og:title" content="Acomptes d'IS — 2026" />`);
    expect(html).toContain(
      '<meta property="og:description" content="Ajustez vos acomptes &amp; le solde : « au plus juste »." />',
    );
    expect(html).toContain('<meta name="twitter:title" content="Acomptes d\'IS — 2026" />');
  });

  it('donne l’URL canonique et une image absolue au format attendu', () => {
    expect(html).toContain('<link rel="canonical" href="https://sasu.commutator.io/acomptes/" />');
    expect(html).toContain('<meta property="og:url" content="https://sasu.commutator.io/acomptes/" />');
    expect(html).toContain('<meta property="og:image" content="https://sasu.commutator.io/apercu.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('insère les balises dans le <head>', () => {
    expect(html.indexOf('og:title')).toBeLessThan(html.indexOf('</head>'));
  });

  it('refuse une page sans titre ou sans description', () => {
    expect(() => lireEntete('<head><title>Seul</title></head>')).toThrow();
    expect(() => lireEntete('<head><meta name="description" content="x" /></head>')).toThrow();
  });

  it('trouve un titre et une description dans chaque page du site', () => {
    // Every page the build emits must be shareable.
    const pages = [...config.matchAll(/:\s*'([a-z/]*index\.html)'/g)].map((m) => m[1]);
    expect(pages.length).toBeGreaterThanOrEqual(7);
    for (const page of pages) {
      const source = SOURCES[`../../${page}`];
      expect(source, page).toBeDefined();
      const entete = lireEntete(source);
      expect(entete.titre.length, page).toBeGreaterThan(10);
      expect(entete.description.length, page).toBeGreaterThan(50);
    }
  });

  it('pointe vers une image présente au bon format', () => {
    expect(IMAGE_APERCU.chemin).toBe('/apercu.png');
    const octets = Uint8Array.from(atob(apercu.split(',')[1]), (c) => c.charCodeAt(0));
    const vue = new DataView(octets.buffer);
    // PNG signature, then the IHDR width and height.
    expect(String.fromCharCode(...octets.subarray(1, 4))).toBe('PNG');
    expect(vue.getUint32(16)).toBe(IMAGE_APERCU.largeur);
    expect(vue.getUint32(20)).toBe(IMAGE_APERCU.hauteur);
  });
});
