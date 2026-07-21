import { describe, expect, it } from 'vitest';
import { DEPOT, LIEN_ISSUES, lienNouvelleIssue } from './depot';

describe('liens vers le dépôt', () => {
  it('pointe vers la page des issues du dépôt', () => {
    expect(LIEN_ISSUES).toBe(`${DEPOT}/issues`);
    expect(DEPOT).toMatch(/^https:\/\/github\.com\/[\w-]+\/[\w-]+$/);
  });

  it('ouvre une issue neuve avec un corps prérempli', () => {
    const url = new URL(lienNouvelleIssue());
    expect(url.origin + url.pathname).toBe(`${DEPOT}/issues/new`);
    expect(url.searchParams.get('body')).toContain("Ce que j'observe");
  });

  it('inclut le lien de la simulation quand il est fourni', () => {
    const lien = 'https://sasu.commutator.io/?resultat=180000&brut=31000';
    const corps = new URL(lienNouvelleIssue(lien)).searchParams.get('body') ?? '';
    expect(corps).toContain('Simulation concernée');
    expect(corps).toContain(lien);
  });

  it('omet la section simulation en son absence', () => {
    const corps = new URL(lienNouvelleIssue()).searchParams.get('body') ?? '';
    expect(corps).not.toContain('Simulation concernée');
  });

  it('encode les caractères spéciaux du lien', () => {
    // Un lien de simulation est plein de « & » : mal encodé, il tronquerait
    // le corps de l'issue.
    const lien = 'https://sasu.commutator.io/?a=1&b=2&couple=1';
    const url = lienNouvelleIssue(lien);
    expect(url).not.toContain('&b=2');
    expect(new URL(url).searchParams.get('body')).toContain(lien);
  });
});
