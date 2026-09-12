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
  "Role.InvalidRoles": "أدوار غير صالحة",
  "Role.RoleNotFound": "الدور غير موجود",
  "Role.InvalidPermissions": "صلاحيات غير صالحة",
  "Role.DuplicatedRole": "اسم الدور مكرر",
  "Variable.NotFound": "المتغير غير موجود",
  "Variable.DuplicateKey": "مفتاح المتغير مكرر",
  "Variable.InvalidKey": "مفتاح المتغير غير صالح",
  "Variable.KeyInUseByFormula": "لا يمكن التعطيل — المفتاح مستخدم في معادلات",
  "Product.NotFound": "المنتج غير موجود",
  "Product.DuplicateName": "اسم المنتج مكرر",
  "Product.VariableNotFound": "أحد المتغيرات غير موجود",
  "Item.NotFound": "الصنف غير موجود",
  "Item.ProductNotFound": "المنتج الأب غير موجود",
  "Item.PriceCannotBeNegative": "السعر لا يمكن أن يكون سالبًا",
  "Formula.NotFound": "المعادلة غير موجودة",
  "Formula.ParseFailed": "تعذّر تحليل المعادلة",
  "Formula.ValidationFailed": "المعادلة غير صالحة",
  "Formula.EvaluationFailed": "تعذّر حساب المعادلة",
  "Invoice.NotFound": "الفاتورة غير موجودة",
  "Invoice.NotDraft": "العملية متاحة للمسودات فقط",
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
    // Application errors: { errors: [code, description] }
    if (Array.isArray(record.errors)) {
      const [code, description] = record.errors as string[];
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
