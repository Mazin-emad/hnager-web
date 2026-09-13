import type { InvoiceStatus, InvoiceType } from "@/api/types";

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  Sales: "مبيعات",
  Purchases: "مشتريات",
  Returns: "مرتجع",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  Draft: "مسودة",
  Finalized: "معتمدة",
  Cancelled: "ملغاة",
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
  "invoices:delete": "حذف الفواتير",
};

export const KNOWN_PERMISSIONS = Object.keys(PERMISSION_LABELS);

export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}
