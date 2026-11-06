import type { ProblemDetails } from '@cardsim/shared';

/** Messages affichés pour les codes d'erreur de l'API. Complété par context à partir de M1. */
const FALLBACK = 'Une erreur inattendue est survenue.';

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Certaines informations saisies sont invalides.',
  NOT_FOUND: "L'élément demandé est introuvable.",
  CONCURRENT_MODIFICATION: 'Cet élément vient d’être modifié. Rechargez la page et réessayez.',
  INTERNAL_ERROR: FALLBACK,
  API_UNREACHABLE: "L'API est injoignable.",
};

export function errorMessage(problem: Pick<ProblemDetails, 'code'>): string {
  return MESSAGES[problem.code] ?? FALLBACK;
}
