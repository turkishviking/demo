/** Codes métier de Cardholders → statut HTTP. Les codes non listés : 404 (introuvable) ou 422. */
export const CARDHOLDERS_ERROR_STATUSES: Readonly<Record<string, number>> = {
  EMAIL_ALREADY_USED: 409,
  PERSON_DEACTIVATED: 409,
  GROUP_NAME_ALREADY_USED: 409,
  GROUP_ARCHIVED: 409,
  GROUP_FULL: 409,
  PERSON_ALREADY_IN_A_GROUP: 409,
  PERSON_NOT_MEMBER: 409,
  GROUP_NOT_EMPTY: 409,
  CAPACITY_BELOW_MEMBER_COUNT: 409,
};
