import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, FlaskConical, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  evaluateFormula,
  formulaKeys,
  getFormula,
  upsertFormula,
  validateFormula,
} from "@/api/formulas";
import { parseApiError } from "@/api/errors";
import type { AssignedProductVariable } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function FormulaEditor({
  productId,
  itemId,
  itemName,
  variables,
  onSaved,
}: {
  productId: string;
  itemId: string;
  itemName: string;
  variables: AssignedProductVariable[];
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [expression, setExpression] = useState("");
  const [loadedFormulaId, setLoadedFormulaId] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<{ ok: boolean; message: string } | null>(null);
  const [evalResult, setEvalResult] = useState<number | null>(null);

  const formulaQuery = useQuery({
    queryKey: formulaKeys.detail(itemId),
    queryFn: () => getFormula(itemId),
    retry: (count, error) => (isNotFound(error) ? false : count < 1),
  });

  // Sync the editable draft when a (different) formula finishes loading.
  // Compared during render so local edits are never clobbered by refetches.
  if (formulaQuery.data && formulaQuery.data.id !== loadedFormulaId) {
    setLoadedFormulaId(formulaQuery.data.id);
    setExpression(formulaQuery.data.expression);
  }

  // Treat "no formula yet" as an empty state, not an error.
  const noFormulaYet = formulaQuery.isError && isNotFound(formulaQuery.error);

  const validateMutation = useMutation({
    mutationFn: () => validateFormula({ expression: expression.trim(), productId }),
    onSuccess: (res) => {
      setValidation(
        res.isValid
          ? { ok: true, message: "المعادلة صالحة" }
          : { ok: false, message: res.errorMessage ?? "المعادلة غير صالحة" },
      );
    },
    onError: (error) => {
      setValidation({ ok: false, message: parseApiError(error).message });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: () => {
      const sampleValues: Record<string, number> = {};
      for (const v of variables) {
        const raw = (samples[v.variableId] ?? "").trim();
        if (raw !== "") sampleValues[v.key] = Number(raw);
      }
      return evaluateFormula({ expression: expression.trim(), productId, sampleValues });
    },
    onSuccess: (res) => setEvalResult(res.result),
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const saveMutation = useMutation({
    mutationFn: () => upsertFormula(itemId, { expression: expression.trim(), productId }),
    onSuccess: (res) => {
      toast.success(`تم حفظ المعادلة (إصدار ${res.version})`);
      void queryClient.invalidateQueries({ queryKey: formulaKeys.detail(itemId) });
      onSaved?.();
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const variableKeys = variables.map((v) => v.key);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          معادلة الصنف <span className="font-semibold text-foreground">{itemName}</span> — تُحسب منها
          الكمية من متغيرات المنتج.
        </p>
        {formulaQuery.data && (
          <p className="tnum mt-1 text-xs text-muted-foreground" dir="ltr">
            v{formulaQuery.data.version} · {formulaQuery.data.isActive ? "active" : "inactive"}
          </p>
        )}
        {noFormulaYet && (
          <p className="mt-1 text-xs text-muted-foreground">لا توجد معادلة بعد — اكتب واحدة واحفظها.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`expr-${itemId}`}>المعادلة</Label>
        <Textarea
          id={`expr-${itemId}`}
          dir="ltr"
          rows={3}
          placeholder="width * height"
          value={expression}
          onChange={(e) => {
            setExpression(e.target.value);
            setValidation(null);
          }}
          className="tnum font-mono text-left"
        />
        {variableKeys.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {variableKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setExpression((e) => (e ? `${e} ${k}` : k))}
                className="tnum rounded-md bg-brand-100 px-2 py-0.5 font-mono text-xs text-brand-800 hover:bg-brand-200"
                dir="ltr"
                title="إدراج في المعادلة"
              >
                {k}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!expression.trim() || validateMutation.isPending}
            onClick={() => validateMutation.mutate()}
          >
            {validateMutation.isPending ? "جارٍ الفحص…" : "فحص المعادلة"}
          </Button>
          {validation &&
            (validation.ok ? (
              <span className="flex items-center gap-1 text-sm text-green-700">
                <CheckCircle2 className="size-4" /> {validation.message}
              </span>
            ) : (
              <span className="flex items-start gap-1 text-sm text-destructive">
                <XCircle className="size-4 shrink-0 translate-y-1" /> {validation.message}
              </span>
            ))}
        </div>
      </div>

      {variables.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-muted/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <FlaskConical className="size-4" />
            تجربة بقيم حقيقية
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {variables.map((v) => (
              <div key={v.variableId} className="space-y-1">
                <Label htmlFor={`sample-${v.variableId}`} className="text-xs">
                  {v.name}
                  {v.unit ? ` (${v.unit})` : ""}
                </Label>
                <Input
                  id={`sample-${v.variableId}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="0"
                  value={samples[v.variableId] ?? ""}
                  onChange={(e) => setSamples((s) => ({ ...s, [v.variableId]: e.target.value }))}
                  className="tnum text-left"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!expression.trim() || evaluateMutation.isPending}
              onClick={() => evaluateMutation.mutate()}
            >
              {evaluateMutation.isPending ? "جارٍ الحساب…" : "احسب النتيجة"}
            </Button>
            {evalResult != null && (
              <span className="tnum text-lg font-bold text-brand-900" dir="ltr">
                = {evalResult}
              </span>
            )}
          </div>
        </div>
      )}

      <Button
        type="button"
        disabled={!expression.trim() || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
        className="bg-brand-800 hover:bg-brand-900"
      >
        <Save className="size-4" />
        {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ المعادلة"}
      </Button>
    </div>
  );
}
