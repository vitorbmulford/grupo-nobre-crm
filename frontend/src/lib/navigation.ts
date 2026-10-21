export function getInternalReturnTo(
  requested: string | undefined,
  fallback = "/opportunities",
) {
  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.includes("\\")
  ) {
    return fallback;
  }
  return requested;
}

export function withReturnTo(path: string, returnTo: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function getOpportunityBackLabel(
  returnTo: string,
  companyName?: string,
) {
  if (/^\/opportunities\/[^/?]+(?:\?.*)?$/.test(returnTo) && companyName) {
    return `Voltar para ${companyName}`;
  }
  if (returnTo === "/pipeline" || returnTo.startsWith("/pipeline?")) {
    return "Voltar para Pipeline";
  }
  return "Voltar para oportunidades";
}
