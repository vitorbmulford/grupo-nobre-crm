import { searchTerms } from './search-terms.js';

describe('searchTerms', () => {
  it('matches Portuguese names when the query omits diacritics', () => {
    expect(searchTerms('agencia')).toContain('agência');
    expect(searchTerms('Agência')).toContain('Agencia');
    expect(searchTerms('Nobre')).toContain('Nobre');
  });

  it('bounds the number of database search alternatives', () => {
    expect(searchTerms('a'.repeat(120)).length).toBeLessThanOrEqual(128);
  });
});
