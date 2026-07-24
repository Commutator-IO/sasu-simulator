/**
 * Links back to the source repository.
 *
 * Reporting a wrong rate matters more here than in most tools: brackets move
 * with every finance act, and a stale value looks exactly like a correct one.
 * A report is only actionable if it carries the exact simulation, hence the
 * prefilled body.
 */

export const DEPOT = 'https://github.com/Commutator-IO/sasu-simulator';

export const LIEN_ISSUES = `${DEPOT}/issues`;

/**
 * Contact address for the MCP waitlist. The site is static, so the sign-up form
 * opens a prefilled email here rather than posting to a backend that does not
 * exist yet. Change this single constant to a role address if spam becomes a
 * problem.
 */
export const CONTACT = 'michel@commutator.io';

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
