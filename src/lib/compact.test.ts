import { describe, expect, it } from 'vitest';
import { etendre, minifier } from './compact';

describe('compactage des liens', () => {
  it('raccourcit les clés connues', () => {
    expect(minifier('?resultat=120000&fraisMensuels=210')).toBe('?r=120000&fm=210');
  });

  it('garde les virgules littérales plutôt que %2C', () => {
    expect(minifier('?verses=5000%2C3000')).toBe('?vs=5000,3000');
    expect(minifier('?ca=1000%2C2000%2C3000')).toBe('?ca=1000,2000,3000');
  });

  it('laisse « ca » tel quel, déjà court', () => {
    expect(minifier('?ca=1000,2000')).toBe('?ca=1000,2000');
  });

  it('fait un aller-retour fidèle', () => {
    const longue =
      '?resultat=120000&precedent=40000&avantDernier=120000&previsionnel=120000' +
      '&passees=2&verses=5000,1&moisFactures=7&fraisMensuels=210&ca=9000,8500,0';
    expect(etendre(minifier(longue))).toBe(longue);
  });

  it('raccourcit réellement une requête chargée', () => {
    const longue =
      '?ca=10000,10000,13000,0,4000&moisFactures=7&fraisMensuels=210&resultat=120000' +
      '&precedent=40000&avantDernier=120000&previsionnel=120000&passees=2&verses=5000,1';
    expect(minifier(longue).length).toBeLessThan(longue.length * 0.8);
  });

  it('laisse passer un ancien lien à clés longues', () => {
    // Rétrocompatibilité : une URL déjà en clés longues se lit inchangée.
    expect(etendre('?resultat=90000&brut=45000')).toBe('?resultat=90000&brut=45000');
  });

  it('gère la requête vide', () => {
    expect(minifier('')).toBe('');
    expect(minifier('?')).toBe('');
    expect(etendre('')).toBe('');
  });

  it('n’écrase pas une clé dont une autre est le préfixe', () => {
    // "mois" (moisRemuneration) ne doit pas être confondu avec "moisFactures".
    expect(minifier('?mois=6&moisFactures=7&moisPrecedent=15')).toBe(
      '?mo=6&mf=7&mp=15',
    );
  });
});
