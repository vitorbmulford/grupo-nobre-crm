import { evaluateTransition } from './pipeline-policy.js';

describe('pipeline policy', () => {
  it.each([
    ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO'],
    ['APRESENTACAO_ORCAMENTO', 'FOLLOW_UP'],
    ['FOLLOW_UP', 'FORECAST'],
    ['FORECAST', 'FECHAMENTO'],
  ] as const)('allows %s to %s', (from, to) => {
    expect(evaluateTransition(from, to, null, true, true)).toEqual({
      reason: null,
    });
  });

  it.each([
    'PRIMEIRO_CONTATO',
    'APRESENTACAO_ORCAMENTO',
    'FOLLOW_UP',
    'FORECAST',
  ] as const)('allows loss from %s with normalized reason', (from) => {
    expect(
      evaluateTransition(from, 'PERDIDA', '  Sem prazo  ', false, false),
    ).toEqual({
      reason: 'Sem prazo',
    });
  });

  it.each([
    ['PRIMEIRO_CONTATO', 'FORECAST', null],
    ['FORECAST', 'PRIMEIRO_CONTATO', 'Voltar'],
    ['FOLLOW_UP', 'APRESENTACAO_ORCAMENTO', '   '],
    ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', null],
    ['FECHAMENTO', 'PERDIDA', 'Motivo'],
    ['PERDIDA', 'PRIMEIRO_CONTATO', 'Motivo'],
    ['FOLLOW_UP', 'FOLLOW_UP', null],
  ] as const)('rejects invalid transition %s to %s', (from, to, reason) => {
    expect(() => evaluateTransition(from, to, reason, false, false)).toThrow();
  });

  it('requires both commercial prerequisites when entering budget presentation', () => {
    expect(() =>
      evaluateTransition(
        'PRIMEIRO_CONTATO',
        'APRESENTACAO_ORCAMENTO',
        null,
        false,
        true,
      ),
    ).toThrow('An estimated value is required');
    expect(() =>
      evaluateTransition(
        'PRIMEIRO_CONTATO',
        'APRESENTACAO_ORCAMENTO',
        null,
        true,
        false,
      ),
    ).toThrow('At least one gift item is required');
  });
});
