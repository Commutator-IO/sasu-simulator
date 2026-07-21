/**
 * Links back to the source repository.
 *
 * Reporting a wrong rate matters more here than in most tools: the flat tax
 * shipped at 30% for a while after the 2026 act moved it to 31.4%, and it was
 * a user who spotted it. A report is only actionable if it carries the exact
 * simulation, hence the prefilled body.
 */

export const DEPOT = 'https://github.com/Commutator-IO/sasu-simulator';

export const LIEN_ISSUES = `${DEPOT}/issues`;

/**
 * URL of a new issue, prefilled with a template. `lienSimulation` is the
 * shareable link of the simulation being viewed, so the report reproduces
 * without the reporter having to describe their inputs.
 */
export function lienNouvelleIssue(lienSimulation?: string): string {
  const corps = [
    "### Ce que j'observe",
    '',
    '',
    '',
    '### Ce que j’attendais',
    '',
    '',
    '',
    ...(lienSimulation
      ? ['### Simulation concernée', '', lienSimulation, '']
      : []),
    '### Source',
    '',
    'Si un taux ou un barème est en cause, merci d’indiquer la référence',
    'officielle (Urssaf, service-public.fr, Légifrance…).',
  ].join('\n');

  const params = new URLSearchParams({
    title: '',
    body: corps,
  });
  return `${DEPOT}/issues/new?${params.toString()}`;
}
