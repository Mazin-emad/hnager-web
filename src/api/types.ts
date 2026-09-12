// ── Exact shapes from API.md (Invoice Calculator API) ──────────────────────
// JSON uses camelCase. Enums are serialized as strings.
// Dates: DateOnly as YYYY-MM-DD, datetimes ISO-8601.

export type InvoiceType = "Sales" | "Purchases" | "Returns";
export type InvoiceStatus = "Draft" | "Finalized" | "Cancelled";
export type VariableType = "Number";

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiration: string;
}

export interface RefreshTokenRequest {
  token: string;
  refreshToken: string;
}

/** POST /Auth/refresh returns this wrapper instead of a bare AuthResponse. */
export interface ResultOfAuthResponse {
  isSuccess: boolean;
  isFailure: boolean;
  error: { code: string; description: string; statusCodes: number[] | null };
  value: AuthResponse;
}

// ── Account ─────────────────────────────────────────────────────────────────

export interface ProfileResponse {
  email: string;
  userName: string;
  firstName: string;
  lastName: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ── Users ───────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isDisabled: boolean;
  roles: string[];
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: string[];
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

// ── Roles ───────────────────────────────────────────────────────────────────

export interface RoleListItem {
  id: string;
  name: string;
  isDeleted: boolean;
}

export interface RoleDetailResponse {
  id: string;
  name: string;
  isDeleted: boolean;
  permissions: string[];
}

export interface RoleRequest {
  name: string;
  permissions: string[];
}

// ── Variables ───────────────────────────────────────────────────────────────

export interface VariableResponse {
  id: string;
  name: string;
  key: string;
  dataType: VariableType;
  unit: string | null;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface CreateVariableRequest {
  name: string;
  key: string;
  dataType: VariableType;
  unit?: string | null;
  description?: string | null;
  displayOrder: number;
}

/** Key and dataType cannot be changed on update. */
export interface UpdateVariableRequest {
  name: string;
  unit?: string | null;
  description?: string | null;
  displayOrder: number;
}

// ── Products & items ────────────────────────────────────────────────────────

export interface ProductSummaryResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  activeItemCount: number;
}

export interface CreateProductRequest {
  name: string;
  description?: string | null;
  displayOrder: number;
}

export type UpdateProductRequest = CreateProductRequest;

export interface ProductVariableEntry {
  variableId: string;
  isRequired: boolean;
  displayOrder: number;
}

export interface SetProductVariablesRequest {
  variables: ProductVariableEntry[];
}

/**
 * One assigned variable on a product detail/configuration response.
 * The documented contract guarantees variableId/isRequired/displayOrder;
 * the API also embeds variable display data (key/name/unit) — both are
 * optional here so the UI can fall back to the variables catalog.
 */
export interface AssignedProductVariable {
  variableId: string;
  variableKey?: string;
  variableName?: string;
  unit?: string | null;
  isRequired: boolean;
  displayOrder: number;
}

export interface ItemDetailResponse {
  id: string;
  productId: string;
  name: string;
  code: string | null;
  unitPrice: number;
  isActive: boolean;
  displayOrder: number;
  formula: FormulaResponse | null;
}

export interface ProductDetailResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  variables: AssignedProductVariable[];
  items: ItemDetailResponse[];
}

export interface CreateItemRequest {
  name: string;
  code?: string | null;
  unitPrice: number;
  displayOrder: number;
}

export type UpdateItemRequest = CreateItemRequest;

// ── Formulas ────────────────────────────────────────────────────────────────

export interface FormulaResponse {
  id: string;
  itemId: string;
  expression: string;
  version: number;
  isActive: boolean;
}

export interface UpsertFormulaRequest {
  expression: string;
  productId: string;
}

export interface ValidateFormulaRequest {
  expression: string;
  productId: string;
}

export interface ValidateFormulaResponse {
  isValid: boolean;
  errorMessage: string | null;
}

export interface EvaluateFormulaRequest {
  expression: string;
  productId: string;
  sampleValues: Record<string, number>;
}

export interface EvaluateFormulaResponse {
  result: number;
}

// ── Invoices ────────────────────────────────────────────────────────────────

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceType: InvoiceType;
  salesRepName: string;
  invoiceDate: string;
  status: InvoiceStatus;
  grandTotal: number;
}

export interface PagedInvoices {
  items: InvoiceListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface InvoiceFilters {
  customerName?: string;
  status?: InvoiceStatus | "all";
  type?: InvoiceType | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceInputValue {
  variableKey: string;
  variableName: string;
  value: number;
}

export interface InvoiceItemSnapshot {
  id: string;
  itemId: string;
  isExcluded: boolean;
  itemNameSnapshot: string;
  unitPriceSnapshot: number;
  formulaSnapshot: string | null;
  formulaVersion: number | null;
  quantitySnapshot: number;
  totalPriceSnapshot: number;
  displayOrder: number;
}

export interface InvoiceProductBlock {
  id: string;
  productId: string;
  productNameSnapshot: string;
  displayOrder: number;
  inputValues: InvoiceInputValue[];
  items: InvoiceItemSnapshot[];
}

export interface InvoiceDetailResponse {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceType: InvoiceType;
  salesRepName: string;
  day: string | null;
  invoiceDate: string;
  status: InvoiceStatus;
  notes: string | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  createdAt: string;
  finalizedAt: string | null;
  products: InvoiceProductBlock[];
}

export interface CreateInvoiceRequest {
  customerName: string;
  invoiceType: InvoiceType;
  salesRepName: string;
  day?: string | null;
  invoiceDate: string;
  discountPercent: number;
  notes?: string | null;
}

export type UpdateInvoiceHeaderRequest = CreateInvoiceRequest;

export interface ProductInputValueRequest {
  variableKey: string;
  value: number;
}

export interface AddInvoiceProductRequest {
  productId: string;
  inputValues: ProductInputValueRequest[];
}

// ── Shared error shapes ─────────────────────────────────────────────────────

/** Application errors (result.ToProblem()): errors[0] = code, errors[1] = description. */
export interface AppProblemDetails {
  type?: string;
  title: string;
  status: number;
  errors: [string, string] | string[];
}

/** FluentValidation / ASP.NET validation problems. */
export interface ValidationProblemDetails {
  type?: string;
  title: string;
  status: number;
  errors: Record<string, string[]>;
}
