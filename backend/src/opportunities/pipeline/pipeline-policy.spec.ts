import { evaluateTransition } from './pipeline-policy.js';

describe('pipeline policy', () => {
  const stages = [
    'PRIMEIRO_CONTATO',
    'APRESENTACAO_ORCAMENTO',
    'FOLLOW_UP',
    'FORECAST',
    'FECHAMENTO',
    'PERDIDA',
  ] as const;
  const activeStages = stages.slice(0, 4);

  it.each(
    stages.flatMap((from) =>
      stages.map((to) => {
        const fromIndex = activeStages.indexOf(
          from as (typeof activeStages)[number],
        );
        const toIndex = activeStages.indexOf(
          to as (typeof activeStages)[number],
        );
        const allowed =
          (fromIndex >= 0 && to === 'PERDIDA') ||
          (fromIndex >= 0 && to === 'FECHAMENTO' && from === 'FORECAST') ||
          (fromIndex >= 0 &&
            toIndex >= 0 &&
            Math.abs(fromIndex - toIndex) === 1);
        return [from, to, allowed] as const;
      }),
    ),
  )(
    'evaluates the complete transition matrix: %s -> %s',
    (from, to, allowed) => {
      const fromIndex = activeStages.indexOf(
        from as (typeof activeStages)[number],
      );
      const toIndex = activeStages.indexOf(to as (typeof activeStages)[number]);
      const reason =
        to === 'PERDIDA' || (toIndex >= 0 && toIndex < fromIndex)
          ? 'Justificativa'
          : null;
      const run = () => evaluateTransition(from, to, reason, true, true);

      if (allowed) {
        expect(run()).toEqual({ reason });
      } else {
        expect(run).toThrow();
      }
    },
  );

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
