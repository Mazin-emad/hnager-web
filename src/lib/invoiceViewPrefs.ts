import { useState } from "react";

// ── Invoice list display preferences (client-side only) ─────────────────────
// Pure display preference — the backend never needs to know about it.
// Persisted in localStorage so the table/cards choice, the brief-details
// toggle, and the brief field set survive reloads and are shared with the
// account/settings page. Applies to both the owner's invoices list and the
// received-invoices list.

export type InvoiceViewMode = "table" | "cards";

/**
 * Fields the user may include in brief-details mode. The invoice number
 * (ID) is deliberately NOT a choice — it is never shown in brief mode.
 * `owner` / `sharedAt` only exist on the received-invoices screen; the
 * owner's list simply ignores them.
 */
export type BriefFieldKey =
  | "customerName"
  | "invoiceDate"
  | "type"
  | "grandTotal"
  | "status"
  | "sharedAt"
  | "owner";

export interface InvoiceViewPrefs {
  viewMode: InvoiceViewMode;
  briefDetails: boolean;
  briefFields: BriefFieldKey[];
}

const STORAGE_KEY = "invoice-web:invoice-view-prefs";

export const BRIEF_FIELD_LABELS: Record<BriefFieldKey, string> = {
  customerName: "اسم العميل",
  invoiceDate: "التاريخ",
  type: "النوع",
  grandTotal: "الإجمالي",
  status: "الحالة",
  sharedAt: "تاريخ الاستلام",
  owner: "المالك / المرسِل",
};

/** Canonical column order for brief rendering (tables and cards). */
export const BRIEF_FIELD_ORDER: BriefFieldKey[] = [
  "customerName",
  "type",
  "invoiceDate",
  "sharedAt",
  "owner",
  "status",
  "grandTotal",
];

const ALL_FIELDS = new Set<BriefFieldKey>(BRIEF_FIELD_ORDER);

/** Default brief set reproduces the original fixed brief (no ID, no status). */
const DEFAULT_BRIEF_FIELDS: BriefFieldKey[] = [
  "customerName",
  "type",
  "invoiceDate",
  "grandTotal",
];

const DEFAULTS: InvoiceViewPrefs = {
  viewMode: "table",
  briefDetails: false,
  briefFields: DEFAULT_BRIEF_FIELDS,
};

function sanitizeFields(value: unknown): BriefFieldKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_BRIEF_FIELDS];
  const kept = (value as unknown[]).filter(
    (f): f is BriefFieldKey => typeof f === "string" && ALL_FIELDS.has(f as BriefFieldKey),
  );
  return kept;
}

export function loadInvoiceViewPrefs(): InvoiceViewPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, briefFields: [...DEFAULT_BRIEF_FIELDS] };
    const parsed = JSON.parse(raw) as Partial<InvoiceViewPrefs>;
    return {
      viewMode: parsed.viewMode === "cards" ? "cards" : "table",
      briefDetails: parsed.briefDetails === true,
      briefFields: sanitizeFields(parsed.briefFields),
    };
  } catch {
    return { ...DEFAULTS, briefFields: [...DEFAULT_BRIEF_FIELDS] };
  }
}

export function saveInvoiceViewPrefs(prefs: InvoiceViewPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private-mode / quota failure — the preference just won't persist.
  }
}

/** Local state bound to localStorage; every setter call persists. */
export function useInvoiceViewPrefs(): [
  InvoiceViewPrefs,
  (patch: Partial<InvoiceViewPrefs>) => void,
] {
  const [prefs, setPrefs] = useState<InvoiceViewPrefs>(loadInvoiceViewPrefs);
  function update(patch: Partial<InvoiceViewPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveInvoiceViewPrefs(next);
      return next;
    });
  }
  return [prefs, update];
}
