/**
 * Table `code d'erreur métier → statut HTTP`. Chaque context y enregistre ses codes au
 * démarrage de son module. Sans entrée : 404 pour un `NotFoundError`, 422 sinon.
 */
const statusByCode = new Map<string, number>();

export function registerDomainErrorStatuses(mapping: Readonly<Record<string, number>>): void {
  for (const [code, status] of Object.entries(mapping)) {
    const existing = statusByCode.get(code);
    if (existing !== undefined && existing !== status) {
      throw new Error(`Domain error ${code} already mapped to HTTP ${existing}`);
    }
    statusByCode.set(code, status);
  }
}

export function statusForDomainErrorCode(code: string): number | undefined {
  return statusByCode.get(code);
}

/** Pour les tests uniquement. */
export function resetDomainErrorStatuses(): void {
  statusByCode.clear();
}
