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
  "Role.ProtectedRole": "هذا الدور محمي ولا يمكن حذفه",
  "Role.InvalidPermissions": "صلاحيات غير صالحة",
  "Role.DuplicatedRole": "اسم الدور مكرر",
  "Variable.NotFound": "المتغير غير موجود",
  "Variable.DuplicateKey": "مفتاح المتغير مكرر",
  "Variable.InvalidKey": "مفتاح المتغير غير صالح",
  "Variable.ReservedKey": "هذا المفتاح محجوز للنظام ولا يمكن استخدامه",
  "Variable.KeyInUseByFormula": "لا يمكن التعطيل — المفتاح مستخدم في معادلات",
  "Variable.InUseByFormula": "لا يمكن الحذف — المتغير مستخدم في معادلات",
  "Variable.VariableInUse": "لا يمكن الحذف — المتغير مستخدم في معادلات",
  "Formula.VariableInUse": "لا يمكن الحذف — المتغير مستخدم في معادلات",
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
  "Invoice.AccessDenied": "لا تملك صلاحية حذف هذه الفاتورة",
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
 * Raw server detail for application errors: `errors[1]` in
 * `{ errors: [code, description] }`. Used under the formula editors where the
 * spec requires showing the server message verbatim (it names the bad key for
 * Formula.ValidationFailed). Returns undefined when absent.
 */
export function getServerErrorDetail(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = axiosErrorData(error);
  if (data && Array.isArray(data.errors)) {
    const description = (data.errors as unknown[])[1];
    if (typeof description === "string" && description.trim()) return description;
  }
  return undefined;
}

function axiosErrorData(error: AxiosError): Record<string, unknown> | undefined {
  const data = (error as AxiosError<unknown>).response?.data;
  return typeof data === "object" && data != null ? (data as Record<string, unknown>) : undefined;
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
