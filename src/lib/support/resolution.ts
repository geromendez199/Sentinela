export function resolutionEconomics(input: { refund: number; returnCost: number; replacementCost: number; atRiskMargin: number; mediationProbability: number }) {
  const amounts = [input.refund, input.returnCost, input.replacementCost, input.atRiskMargin];
  if (amounts.some(value => !Number.isFinite(value) || value < 0) || !Number.isFinite(input.mediationProbability) || input.mediationProbability < 0 || input.mediationProbability > 1) return null;
  return { refundWithoutReturn: input.refund, refundWithReturn: input.refund + input.returnCost, replacement: input.replacementCost + input.returnCost, expectedCommercialLoss: input.atRiskMargin * input.mediationProbability };
}

export function buildPlanOfAction(rootCause: string, immediate: string, preventive: string, evidence: string) {
  return `PLAN DE ACCIÓN\n\n1. Causa raíz\n${rootCause.trim() || '[Completar causa raíz verificada]'}\n\n2. Acción inmediata\n${immediate.trim() || '[Completar medida tomada]'}\n\n3. Prevención\n${preventive.trim() || '[Completar medida y responsable]'}\n\n4. Evidencia\n${evidence.trim() || '[Adjuntar únicamente evidencia existente]'}`;
}
