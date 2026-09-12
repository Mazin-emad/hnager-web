import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { validateFormula } from "@/api/formulas";
import { getQuantityFormula, productKeys, updateQuantityFormula } from "@/api/products";
import { getServerErrorDetail, parseApiError } from "@/api/errors";
import type { AssignedProductVariable } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton } from "@/components/common";

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

/**
 * Product-level Quantity Formula editor (backend-calculated product quantity).
 * Admin: prefill + variable-key chips + live validate + save, version display.
 * Read-only: shows the current expression/version (or the never-configured hint).
 */
export function QuantityFormulaEditor({
  productId,
  variables,
  readOnly = false,
}: {
  productId: string;
  variables: AssignedProductVariable[];
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [expression, setExpression] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const formulaQuery = useQuery({
    queryKey: productKeys.quantityFormula(productId),
    queryFn: () => getQuantityFormula(productId),
    retry: (count, error) => (isNotFound(error) ? false : count < 1),
  });

  // Prefill the editor once the current formula loads.
  // Compared during render so local edits are never clobbered by refetches.
  const remoteKey = formulaQuery.data ? `${productId}:v${formulaQuery.data.version}` : null;
  if (formulaQuery.data && remoteKey !== loadedKey) {
    setLoadedKey(remoteKey);
    setExpression(formulaQuery.data.expression ?? "");
  }

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

  const saveMutation = useMutation({
    mutationFn: () => updateQuantityFormula(productId, { expression: expression.trim() }),
    onSuccess: (res) => {
      setSaveError(null);
      toast.success(`تم حفظ معادلة الكمية (إصدار ${res.version})`);
      void queryClient.invalidateQueries({ queryKey: productKeys.quantityFormula(productId) });
      void queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      void queryClient.invalidateQueries({ queryKey: productKeys.configuration(productId) });
    },
    onError: (error) => {
      // Spec: show errors[1] verbatim — it names the bad key on ValidationFailed.
      setSaveError(getServerErrorDetail(error) ?? parseApiError(error).message);
    },
  });

  if (formulaQuery.isPending) return <TableSkeleton rows={3} cols={2} />;
  if (formulaQuery.isError || !formulaQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {parseApiError(formulaQuery.error).message}
      </p>
    );
  }

  const { expression: savedExpression, version } = formulaQuery.data;
  const neverConfigured = savedExpression == null;
  const variableKeys = variables.map((v) => v.key);

  if (readOnly) {
    return (
      <div className="space-y-2">
        {neverConfigured ? (
          <p className="text-sm text-muted-foreground">
            لا توجد معادلة كمية بعد — تُحسب الكمية بقيمة 1.
          </p>
        ) : (
          <>
            <code
              className="tnum block rounded-lg bg-brand-50 px-3 py-2 font-mono text-sm text-brand-900"
              dir="ltr"
            >
              {savedExpression}
            </code>
            <p className="tnum text-xs text-muted-foreground" dir="ltr">
              v{version}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          تُحسب كمية المنتج في الفاتورة من قيم المتغيرات — لا تُدخل الكمية يدويًا في أي مكان.
        </p>
        {version > 0 ? (
          <p className="tnum mt-1 text-xs text-muted-foreground" dir="ltr">
            v{version}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            لا توجد معادلة كمية بعد — الكمية تُحسب بقيمة 1 حتى تحفظ واحدة.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`qty-expr-${productId}`}>معادلة الكمية</Label>
        <Textarea
          id={`qty-expr-${productId}`}
          dir="ltr"
          rows={3}
          placeholder="Length * Width / 100"
          value={expression}
          onChange={(e) => {
            setExpression(e.target.value);
            setValidation(null);
            setSaveError(null);
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
        {saveError && (
          <p className="flex items-start gap-1 text-sm text-destructive">
            <XCircle className="size-4 shrink-0 translate-y-1" /> {saveError}
          </p>
        )}
      </div>

      <Button
        type="button"
        disabled={!expression.trim() || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
        className="bg-brand-800 hover:bg-brand-900"
      >
        <Save className="size-4" />
        {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ معادلة الكمية"}
      </Button>
    </div>
  );
}
