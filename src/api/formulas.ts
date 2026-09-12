import { api } from "./client";
import type {
  EvaluateFormulaRequest,
  EvaluateFormulaResponse,
  FormulaResponse,
  UpsertFormulaRequest,
  ValidateFormulaRequest,
  ValidateFormulaResponse,
} from "./types";

export const formulaKeys = {
  detail: (itemId: string) => ["formulas", itemId] as const,
};

export async function getFormula(itemId: string): Promise<FormulaResponse> {
  const res = await api.get<FormulaResponse>(`/api/v1/items/${itemId}/formula`);
  return res.data;
}

export async function upsertFormula(
  itemId: string,
  body: UpsertFormulaRequest,
): Promise<FormulaResponse> {
  const res = await api.put<FormulaResponse>(`/api/v1/items/${itemId}/formula`, body);
  return res.data;
}

export async function validateFormula(
  body: ValidateFormulaRequest,
): Promise<ValidateFormulaResponse> {
  const res = await api.post<ValidateFormulaResponse>("/api/v1/formulas/validate", body);
  return res.data;
}

export async function evaluateFormula(
  body: EvaluateFormulaRequest,
): Promise<EvaluateFormulaResponse> {
  const res = await api.post<EvaluateFormulaResponse>("/api/v1/formulas/evaluate", body);
  return res.data;
}
