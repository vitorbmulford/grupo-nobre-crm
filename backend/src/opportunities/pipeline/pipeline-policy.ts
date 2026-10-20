export const ACTIVE_STAGES = [
  'PRIMEIRO_CONTATO',
  'APRESENTACAO_ORCAMENTO',
  'FOLLOW_UP',
  'FORECAST',
] as const;

export type PipelineStage =
  (typeof ACTIVE_STAGES)[number] | 'FECHAMENTO' | 'PERDIDA';

const ORDERED_ACTIVE_STAGES: readonly string[] = ACTIVE_STAGES;

export type PipelineDecision = {
  reason: string | null;
};

export function evaluateTransition(
  fromStage: PipelineStage,
  toStage: PipelineStage,
  reason: string | null | undefined,
  hasEstimatedValue: boolean,
  hasPositiveItem: boolean,
): PipelineDecision {
  const normalizedReason = reason?.trim() || null;
  if (fromStage === 'FECHAMENTO' || fromStage === 'PERDIDA') {
    throw new Error('Terminal opportunities cannot be moved');
  }
  if (fromStage === toStage)
    throw new Error('Opportunity is already in this stage');

  if (toStage === 'PERDIDA') {
    if (!normalizedReason) throw new Error('A loss reason is required');
    return { reason: normalizedReason };
  }

  const fromIndex = ORDERED_ACTIVE_STAGES.indexOf(fromStage);
  const toIndex = ORDERED_ACTIVE_STAGES.indexOf(toStage);
  if (toStage === 'FECHAMENTO') {
    if (fromStage !== 'FORECAST') {
      throw new Error('Closing is only allowed from FORECAST');
    }
    return { reason: normalizedReason };
  }

  if (toIndex === fromIndex + 1) {
    if (toStage === 'APRESENTACAO_ORCAMENTO') {
      if (!hasEstimatedValue) throw new Error('An estimated value is required');
      if (!hasPositiveItem)
        throw new Error('At least one gift item is required');
    }
    return { reason: normalizedReason };
  }
  if (toIndex === fromIndex - 1) {
    if (!normalizedReason)
      throw new Error('A reason is required to move backward');
    return { reason: normalizedReason };
  }
  throw new Error('Only sequential stage movements are allowed');
}
