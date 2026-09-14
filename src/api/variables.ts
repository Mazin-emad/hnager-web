import { api } from "./client";
import type {
  CreateVariableRequest,
  UpdateVariableRequest,
  VariableResponse,
} from "./types";

export const variableKeys = {
  all: (activeOnly: boolean) => ["variables", activeOnly] as const,
  detail: (id: string) => ["variables", id] as const,
};

export async function listVariables(activeOnly = false): Promise<VariableResponse[]> {
  const res = await api.get<VariableResponse[]>("/api/v1/variables", {
    params: { activeOnly },
  });
  return res.data;
}

export async function getVariable(id: string): Promise<VariableResponse> {
  const res = await api.get<VariableResponse>(`/api/v1/variables/${id}`);
  return res.data;
}

export async function createVariable(body: CreateVariableRequest): Promise<VariableResponse> {
  const res = await api.post<VariableResponse>("/api/v1/variables", body);
  return res.data;
}

export async function updateVariable(
  id: string,
  body: UpdateVariableRequest,
): Promise<VariableResponse> {
  const res = await api.put<VariableResponse>(`/api/v1/variables/${id}`, body);
  return res.data;
}

export async function toggleVariableActive(id: string): Promise<void> {
  await api.patch(`/api/v1/variables/${id}/toggle-active`);
}

/**
 * Soft delete (sets isActive = false, never removes the row). Requires
 * `variables:delete`. Idempotent: deleting an already-inactive variable
 * still returns 204. Blocked with `409 Variable.KeyInUseByFormula` when
 * referenced by an active formula.
 */
export async function deleteVariable(id: string): Promise<void> {
  await api.delete(`/api/v1/variables/${id}`);
}
