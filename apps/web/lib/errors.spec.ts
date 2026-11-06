import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('maps known codes to French messages', () => {
    expect(errorMessage({ code: 'NOT_FOUND' })).toBe("L'élément demandé est introuvable.");
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(errorMessage({ code: 'SOMETHING_NEW' })).toBe('Une erreur inattendue est survenue.');
  });
});

describe('Cardholders error messages', () => {
  it.each([
    ['GROUP_FULL', 'Ce groupe est complet.'],
    ['EMAIL_ALREADY_USED', 'Cet email est déjà utilisé par une autre personne.'],
  ])('explains %s', (code, message) => {
    expect(errorMessage({ code })).toBe(message);
  });

  it('explains the one-group rule', () => {
    expect(errorMessage({ code: 'PERSON_ALREADY_IN_A_GROUP' })).toMatch(/déjà partie d’un groupe/);
  });
});
