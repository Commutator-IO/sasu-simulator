import { describe, expect, it } from 'vitest';
import { DEFAUTS_CFE } from './cfe';
import { decoderCfe, encoderCfe, fusionnerCfe } from './urlCfe';
import { decoderAcomptes } from './urlAcomptes';
import { DEFAUTS_ACOMPTES } from './acomptes';

describe('CFE dans l’adresse', () => {
  it('n’écrit rien pour les valeurs par défaut', () => {
    expect(encoderCfe(DEFAUTS_CFE).toString()).toBe('');
  });

  it('fait l’aller-retour et partage la page avec les acomptes', () => {
    const h = { ...DEFAUTS_CFE, tauxCommune: 26.45, anneeCreation: 2025, ressortissantCci: false };
    const requete = fusionnerCfe('?previsionnel=60000', h);
    expect(decoderCfe(requete)).toEqual(h);
    // The instalments decoder still reads its own key and ignores the others.
    expect(decoderAcomptes(requete, DEFAUTS_ACOMPTES).beneficePrevisionnel).toBe(60_000);
  });

  it('borne les valeurs lues', () => {
    expect(decoderCfe('?cfeTaux=250&cfeCa=-5').tauxCommune).toBe(100);
    expect(decoderCfe('?cfeTaux=250&cfeCa=-5').chiffreAffaires).toBe(0);
  });
});
