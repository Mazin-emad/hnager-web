import axios, { AxiosError } from "axios";
import type {
  AppProblemDetails,
  AuthResponse,
  ResultOfAuthResponse,
  ValidationProblemDetails,
} from "./types";

/** Every error code documented in API.md, mapped to an Arabic message. */
const CODE_MESSAGES: Record<string, string> = {
  "User.InvalidCredentials": "بيانات الدخول غير صحيحة",
  "User.DisabledUser": "هذا الحساب معطّل، تواصل مع الإدارة",
  "User.LockedUser": "الحساب مقفل مؤقتًا بسبب محاولات خاطئة، حاول لاحقًا",
  "User.InvalidJwtToken": "انتهت الجلسة، سجّل الدخول مجددًا",
  "User.InvalidRefreshToken": "انتهت الجلسة، سجّل الدخول مجددًا",
  "User.EmailNotConfirmed": "البريد الإلكتروني غير مؤكد",
  "User.DuplicatedEmail": "هذا البريد مسجّل بالفعل",
  "User.UserNotFound": "المستخدم غير موجود",
  "User.CannotDeleteSelf": "لا يمكنك حذف حسابك نفسه",
  "Role.InvalidRoles": "أدوار غير صالحة",
  "Role.RoleNotFound": "الدور غير موجود",
  "Role.ProtectedRole": "هذا الدور مدمج ومحمي — لا يمكن حذفه أو تعديله",
  "Role.InvalidPermissions": "صلاحيات غير صالحة",
  "Role.DuplicatedRole": "اسم الدور مكرر",
  "Variable.NotFound": "المتغير غير موجود",
  "Variable.DuplicateKey": "مفتاح المتغير مكرر",
  "Variable.InvalidKey": "مفتاح المتغير غير صالح",
  "Variable.ReservedKey": "هذا المفتاح محجوز للنظام ولا يمكن استخدامه",
  "Variable.KeyInUseByFormula": "لا يمكن التعطيل — المفتاح مستخدم في معادلات",
  // Permanent-delete 409s: the delete handler shows extensions.errors[1]
  // verbatim (it names the blockers), these are fallbacks only.
  "Variable.InUseByProducts": "لا يمكن الحذف — المتغير مسند إلى منتجات",
  "Variable.ReferencedByInvoices": "لا يمكن الحذف — فواتير سابقة تشير إلى هذا المتغير، عطّله بدلًا من حذفه",
  "Variable.InUseByFormula": "لا يمكن الحذف — المتغير مستخدم في معادلات",
  "Variable.VariableInUse": "لا يمكن الحذف — المتغير مستخدم في معادلات",
  "Formula.VariableInUse": "لا يمكن الحذف — المتغير مستخدم في معادلات",
  "Product.NotFound": "المنتج غير موجود",
  "Product.DuplicateName": "اسم المنتج مكرر",
  "Product.VariableNotFound": "أحد المتغيرات غير موجود",
  "Item.NotFound": "الصنف غير موجود",
  "Item.ProductNotFound": "المنتج الأب غير موجود",
  "Item.PriceCannotBeNegative": "سعر البيع/الشراء لا يمكن أن يكون سالبًا",
  "Item.InvalidQuantityMultiplier": "مضاعف الكمية غير صالح — اختر كمية المنتج أو عدد الخطوط",
  "Item.PriceChangeNotAllowed": "لا تملك صلاحية تغيير أسعار الأصناف",
  "Formula.NotFound": "المعادلة غير موجودة",
  "Formula.ParseFailed": "تعذّر تحليل المعادلة",
  "Formula.ValidationFailed": "المعادلة غير صالحة",
  "Formula.EvaluationFailed": "تعذّر حساب المعادلة",
  "Invoice.NotFound": "الفاتورة غير موجودة",
  "Invoice.NotDraft": "العملية متاحة للمسودات فقط",
  "Invoice.AccessDenied": "لا تملك صلاحية الوصول إلى هذه الفاتورة",
  "Invoice.NoProducts": "لا يمكن الاعتماد — لا توجد أصناف",
  "Invoice.InvoiceProductNotFound": "بند المنتج غير موجود",
  "Invoice.InvoiceItemNotFound": "بند الصنف غير موجود",
  "Invoice.NumberGenerationFailed": "تعذّر توليد رقم الفاتورة",
};

export interface ParsedApiError {
  /** Machine code, e.g. Invoice.NotFound (if the API provided one). */
  code?: string;
  /** Human-readable Arabic message for toasts. */
  message: string;
  /** Field-level messages for form errors (validation problems). */
  fieldErrors?: Record<string, string[]>;
  status?: number;
}

/**
 * Raw server detail for application errors: `extensions.errors[1]` in
 * ProblemDetails (legacy flat `{ errors: [code, description] }` also read).
 * Used under the formula editors where the spec requires showing the server
 * message verbatim (it names the bad key for Formula.ValidationFailed).
 * Returns undefined when absent.
 */
export function getServerErrorDetail(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = axiosErrorData(error);
  const nested = extractDomainError(data);
  if (nested) {
    const description = nested[1];
    if (typeof description === "string" && description.trim()) return description;
  }
  return undefined;
}

function axiosErrorData(error: AxiosError): Record<string, unknown> | undefined {
  const data = (error as AxiosError<unknown>).response?.data;
  return typeof data === "object" && data != null ? (data as Record<string, unknown>) : undefined;
}

/**
 * Domain (ProblemDetails) errors carry the stable machine code in
 * `extensions.errors[0]` and the human message in `extensions.errors[1]`.
 * Older backends sent a flat `{ errors: [code, description] }` — still
 * accepted as a fallback. Returns undefined for field-validation shapes.
 */
function extractDomainError(data: Record<string, unknown> | undefined): string[] | undefined {
  if (!data) return undefined;
  const extensions = data.extensions;
  if (typeof extensions === "object" && extensions != null) {
    const nested = (extensions as Record<string, unknown>).errors;
    if (Array.isArray(nested)) return nested as string[];
  }
  if (Array.isArray(data.errors)) return data.errors as string[];
  return undefined;
}

/** Single place that understands both API error shapes. */
export function parseApiError(error: unknown): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    return { message: "حدث خطأ غير متوقع" };
  }
  const axiosError = error as AxiosError<unknown>;
  const status = axiosError.response?.status;
  const data = axiosError.response?.data;

  if (status === 429) {
    return { status, message: "طلبات كثيرة جدًا — انتظر قليلًا ثم حاول مجددًا" };
  }
  if (data == null) {
    return {
      status,
      message: axiosError.code === "ERR_NETWORK" || !axiosError.response
        ? "تعذّر الاتصال بالخادم — تحقق من الإنترنت"
        : "حدث خطأ غير متوقع",
    };
  }
  if (typeof data === "string") {
    // Some endpoints (e.g. revoke-refresh-token) return plain-text errors.
    return { status, message: data || "فشلت العملية" };
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    // Domain errors (ProblemDetails): extensions.errors = [code, description].
    // Legacy flat { errors: [code, description] } also accepted.
    const domain = extractDomainError(record);
    if (domain) {
      const [code, description] = domain;
      const title = typeof record.title === "string" ? record.title : "";
      return {
        status,
        code,
        message: (code && CODE_MESSAGES[code]) || description || title || "فشلت العملية",
      };
    }
    // FluentValidation: { errors: { field: [messages] } }
    if (record.errors != null && typeof record.errors === "object") {
      const fieldErrors = record.errors as Record<string, string[]>;
      const first = Object.values(fieldErrors).flat()[0];
      return {
        status,
        message: first || "تحقق من البيانات المدخلة",
        fieldErrors,
      };
    }
    if (typeof record.title === "string") {
      return { status, message: record.title };
    }
  }
  return { status, message: "فشلت العملية، يرجى المحاولة مجددًا" };
}

/**
 * POST /Auth/refresh returns a Result<AuthResponse> wrapper while
 * POST /Auth/login returns a bare AuthResponse — this quirk lives here only.
 */
export function unwrapAuthResponse(data: AuthResponse | ResultOfAuthResponse): AuthResponse {
  if (data != null && typeof data === "object" && "value" in data) {
    const value = (data as ResultOfAuthResponse).value;
    if (value?.token) return value;
    throw new Error("انتهت الجلسة، سجّل الدخول مجددًا");
  }
  return data as AuthResponse;
}

export type { AppProblemDetails, ValidationProblemDetails };
