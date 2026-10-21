import type { QueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queries";
import type { FollowUpAlert } from "@/types/api";

export function resolveAlert(alertId: string) {
  return api.patch<FollowUpAlert>(`/alerts/${alertId}/resolve`);
}

export function alertMutationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404)
      return "Este alerta não está mais disponível. Atualize a lista para ver a situação atual.";
    if (error.status === 409)
      return "Este alerta mudou enquanto você trabalhava. Atualize a lista e tente novamente.";
    if (error.status === 0)
      return "Não foi possível conectar à API. Verifique a conexão e tente novamente.";
  }
  return "Não foi possível atualizar o alerta. Tente novamente.";
}

export function invalidateAfterAlertResolution(queryClient: QueryClient) {
  // Both alert pages and the sidebar count share this prefix.
  return queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
}
