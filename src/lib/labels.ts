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
  "roles:read": "عرض الأدوار",
  "roles:add": "إضافة الأدوار",
  "roles:update": "تعديل الأدوار",
};

export const KNOWN_PERMISSIONS = Object.keys(PERMISSION_LABELS);

export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}
