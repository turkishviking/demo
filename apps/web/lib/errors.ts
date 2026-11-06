import type { ProblemDetails } from '@cardsim/shared';

/** Messages affichés pour les codes d'erreur de l'API (docs/06-frontend.md). */
const FALLBACK = 'Une erreur inattendue est survenue.';

const MESSAGES: Record<string, string> = {
  // Techniques
  VALIDATION_ERROR: 'Certaines informations saisies sont invalides.',
  NOT_FOUND: "L'élément demandé est introuvable.",
  CONCURRENT_MODIFICATION: 'Cet élément vient d’être modifié. Rechargez la page et réessayez.',
  INTERNAL_ERROR: FALLBACK,
  API_UNREACHABLE: "L'API est injoignable.",
  INVALID_CURSOR: 'Le lien de pagination est invalide. Revenez à la première page.',
  // Cardholders
  PERSON_NOT_FOUND: 'Cette personne est introuvable.',
  PERSON_DEACTIVATED: 'Cette personne est désactivée : elle ne peut plus être modifiée.',
  EMAIL_ALREADY_USED: 'Cet email est déjà utilisé par une autre personne.',
  INVALID_FULL_NAME: 'Le prénom et le nom doivent contenir entre 1 et 100 caractères.',
  INVALID_EMAIL: "L'adresse email n'est pas valide.",
  GROUP_NOT_FOUND: 'Ce groupe est introuvable.',
  GROUP_NAME_ALREADY_USED: 'Un autre groupe porte déjà ce nom.',
  INVALID_GROUP_NAME: 'Le nom du groupe doit contenir entre 2 et 60 caractères.',
  INVALID_GROUP_CAPACITY: 'La capacité doit être un nombre entier entre 1 et 50.',
  GROUP_ARCHIVED: 'Ce groupe est archivé : il ne peut plus être modifié.',
  GROUP_FULL: 'Ce groupe est complet.',
  PERSON_ALREADY_IN_A_GROUP:
    'Cette personne fait déjà partie d’un groupe. Retirez-la d’abord de son groupe actuel.',
  PERSON_NOT_MEMBER: "Cette personne n'est pas membre du groupe.",
  GROUP_NOT_EMPTY: 'Un groupe qui a encore des membres ne peut pas être archivé.',
  CAPACITY_BELOW_MEMBER_COUNT: 'La capacité ne peut pas être inférieure au nombre de membres.',
};

export function errorMessage(problem: Pick<ProblemDetails, 'code'>): string {
  return MESSAGES[problem.code] ?? FALLBACK;
}
