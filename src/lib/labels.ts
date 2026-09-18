import type { InvoiceStatus, InvoiceType, QuantityMultiplier, ReceivedInvoicePeriod } from "@/api/types";

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  Sales: "مبيعات",
  Purchases: "مشتريات",
  Returns: "مرتجعات",
};

/**
 * Counterparty label: purchases are made FROM a supplier (المورد),
 * sales are made TO a customer (عميل).
 */
export function counterpartyLabel(invoiceType: InvoiceType): "المورد" | "العميل" {
  return invoiceType === "Purchases" ? "المورد" : "العميل";
}

/** "اسم المورد" for Purchases, "اسم العميل" for Sales. */
export function counterpartyNameLabel(invoiceType: InvoiceType): string {
  return `اسم ${counterpartyLabel(invoiceType)}`;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  Draft: "مسودة",
  Finalized: "معتمدة",
  Cancelled: "ملغاة",
};

export const QUANTITY_MULTIPLIER_LABELS: Record<QuantityMultiplier, string> = {
  ProductQuantity: "كمية المنتج",
  LinesCount: "عدد الخطوط",
  BarnsCount: "عدد العنابر",
};

export const RECEIVED_PERIOD_LABELS: Record<ReceivedInvoicePeriod, string> = {
  Last24Hours: "آخر ٢٤ ساعة",
  Last7Days: "آخر ٧ أيام",
  Last30Days: "آخر ٣٠ يومًا",
};

/** API `day` values are English day names — map them for display. */
export const WEEKDAY_LABELS: Record<string, string> = {
  Saturday: "السبت",
  Sunday: "الأحد",
  Monday: "الاثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
  Friday: "الجمعة",
};

export const PERMISSION_LABELS: Record<string, string> = {
  "users:read": "عرض المستخدمين",
  "users:add": "إضافة المستخدمين",
  "users:update": "تعديل المستخدمين",
  "users:delete": "حذف المستخدمين",
  "roles:read": "عرض الأدوار",
  "roles:add": "إضافة الأدوار",
  "roles:update": "تعديل الأدوار",
  "roles:delete": "حذف الأدوار",
  "products:read": "عرض المنتجات",
  "products:add": "إضافة المنتجات",
  "products:update": "تعديل المنتجات",
  "products:delete": "حذف المنتجات",
  "items:read": "عرض الأصناف",
  "items:add": "إضافة الأصناف",
  "items:update": "تعديل الأصناف",
  "items:update-price": "تغيير أسعار الأصناف",
  "items:delete": "حذف الأصناف",
  "variables:read": "عرض المتغيرات",
  "variables:add": "إضافة المتغيرات",
  "variables:update": "تعديل المتغيرات",
  "variables:delete": "حذف المتغيرات",
  "formulas:read": "عرض المعادلات",
  "formulas:add": "إضافة المعادلات",
  "formulas:update": "تعديل المعادلات",
  "formulas:delete": "حذف المعادلات",
  "invoices:read": "عرض الفواتير",
  "invoices:add": "إضافة الفواتير",
  "invoices:update": "تعديل الفواتير",
  "invoices:recalculate": "إعادة حساب الفواتير",
  "invoices:finalize": "اعتماد الفواتير",
  "invoices:pdf": "تصدير PDF للفواتير",
  "invoices:delete": "حذف الفواتير",
  "invoices:share": "مشاركة الفواتير",
  "invoices:received-read": "عرض الفواتير المرسلة لي",
  "users:directory-read": "عرض دليل الأعضاء",
};

export const KNOWN_PERMISSIONS = Object.keys(PERMISSION_LABELS);

export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}
