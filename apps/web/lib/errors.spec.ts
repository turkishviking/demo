import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('maps known codes to French messages', () => {
    expect(errorMessage({ code: 'NOT_FOUND' })).toBe("L'élément demandé est introuvable.");
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(errorMessage({ code: 'SOMETHING_NEW' })).toBe('Une erreur inattendue est survenue.');
  });
});
