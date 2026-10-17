import { DEFAUTS_CFE, type HypothesesCfe } from './cfe';
import { arrondi, booleen, MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of the CFE estimate into the URL. It shares the instalments
 * page, so its keys are prefixed and merged into the same query string; the
 * two decoders each ignore the other's keys.
 */
const CLES = {
  chiffreAffaires: 'cfeCa',
  anneeCreation: 'cfeCreation',
  baseCommune: 'cfeBase',
  tauxCommune: 'cfeTaux',
  ressortissantCci: 'cfeCci',
} as const;

export const CLES_CFE: string[] = Object.values(CLES);

export function encoderCfe(h: HypothesesCfe, defauts: HypothesesCfe = DEFAUTS_CFE): URLSearchParams {
  const params = new URLSearchParams();
  const ajouter = (cle: string, valeur: number | boolean, defaut: number | boolean) => {
    if (valeur === defaut) return;
    params.set(cle, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : String(valeur));
  };
  ajouter(CLES.chiffreAffaires, arrondi(h.chiffreAffaires), arrondi(defauts.chiffreAffaires));
  ajouter(CLES.anneeCreation, h.anneeCreation, defauts.anneeCreation);
  ajouter(CLES.baseCommune, arrondi(h.baseCommune), defauts.baseCommune);
  ajouter(CLES.tauxCommune, arrondi(h.tauxCommune, 2), defauts.tauxCommune);
  ajouter(CLES.ressortissantCci, h.ressortissantCci, defauts.ressortissantCci);
  return params;
}

export function decoderCfe(recherche: string, defauts: HypothesesCfe = DEFAUTS_CFE): HypothesesCfe {
  const p = new URLSearchParams(recherche);
  return {
    chiffreAffaires: nombre(p.get(CLES.chiffreAffaires), defauts.chiffreAffaires, 0, MAX_MONTANT),
    anneeCreation: nombre(p.get(CLES.anneeCreation), defauts.anneeCreation, 1900, 2100),
    baseCommune: nombre(p.get(CLES.baseCommune), defauts.baseCommune, 0, MAX_MONTANT),
    tauxCommune: nombre(p.get(CLES.tauxCommune), defauts.tauxCommune, 0, 100, 2),
    ressortissantCci: booleen(p.get(CLES.ressortissantCci), defauts.ressortissantCci),
  };
}

/** Appends the CFE keys to a query string produced by another encoder. */
export function fusionnerCfe(requete: string, h: HypothesesCfe): string {
  const params = new URLSearchParams(requete);
  for (const [cle, valeur] of encoderCfe(h)) params.set(cle, valeur);
  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}
