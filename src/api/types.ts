// ── Exact shapes from API.md (Invoice Calculator API) ──────────────────────
// JSON uses camelCase. Enums are serialized as strings.
// Dates: DateOnly as YYYY-MM-DD, datetimes ISO-8601.

export type InvoiceType = "Sales" | "Purchases";
export type InvoiceStatus = "Draft" | "Finalized" | "Cancelled";
export type VariableType = "Number";

/**
 * Item quantity multiplier — controls how an item's ceiling-rounded quantity
 * scales to the billable total: `totalQuantity = CEILING(raw) × multiplier`.
 * - `ProductQuantity`: multiply by the product quantity (default)
 * - `LinesCount`: multiply by the lines count
 * Serialized as strings over the wire.
 */
export type QuantityMultiplier = "ProductQuantity" | "LinesCount";

/**
 * Reserved, case-sensitive variable key computed server-side for item
 * formulas. Never assignable to a product variable and never accepted by
 * the product quantity/lines-count formula endpoints (400 there).
 */
export const LINES_COUNT_KEY = "LinesCount";

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
 * Exact server shape (confirmed): embedded name/key/dataType/unit.
 */
export interface AssignedProductVariable {
  variableId: string;
  name: string;
  key: string;
  dataType: VariableType;
  unit: string | null;
  isRequired: boolean;
  displayOrder: number;
}

export interface ItemDetailResponse {
  id: string;
  productId: string;
  name: string;
  code: string | null;
  /** سعر البيع — used for Sales invoices. Required, ≥ 0. */
  salesPrice: number;
  /** سعر الشراء — used for Purchase invoices. Required, ≥ 0. */
  purchasePrice: number;
  /**
   * Which value scales the ceiling-rounded item quantity to the billable
   * total (`ProductQuantity` or `LinesCount`). Required on create/update.
   */
  quantityMultiplier: QuantityMultiplier;
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
  /** Quantity formula text; null = never configured (invoices compute with 1). */
  quantityExpression: string | null;
  /** 0 = never configured; increments on each real change. */
  quantityFormulaVersion: number;
  /** Lines-count formula text; null = never configured. */
  linesCountExpression: string | null;
  /** 0 = never configured; increments on each real change. */
  linesCountFormulaVersion: number;
  variables: AssignedProductVariable[];
  items: ItemDetailResponse[];
}

export interface CreateItemRequest {
  name: string;
  code?: string | null;
  /** سعر البيع — required, ≥ 0. */
  salesPrice: number;
  /** سعر الشراء — required, ≥ 0. */
  purchasePrice: number;
  /** Required — must be "ProductQuantity" or "LinesCount" (omitting it is a 400). */
  quantityMultiplier: QuantityMultiplier;
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

// ── Product quantity formula (backend-calculated product quantity) ──────────

/** GET /api/v1/products/{id}/quantity-formula. expression null + version 0 = never configured. */
export interface QuantityFormulaResponse {
  productId: string;
  expression: string | null;
  version: number;
}

/** PUT /api/v1/products/{id}/quantity-formula. May reference only assigned variables. */
export interface UpsertQuantityFormulaRequest {
  expression: string;
}

// ── Product lines-count formula (backend-calculated lines count) ────────────

/** GET /api/v1/products/{id}/lines-count-formula. expression null + version 0 = never configured. */
export interface LinesCountFormulaResponse {
  productId: string;
  expression: string | null;
  version: number;
}

/** PUT /api/v1/products/{id}/lines-count-formula. May reference only assigned variables. */
export interface UpsertLinesCountFormulaRequest {
  expression: string;
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
  /**
   * Backend-resolved price for the invoice's type (single "السعر" column):
   * salesPrice for Sales, purchasePrice for Purchases.
   * Stale until Recalculate or an invoice-type change re-prices the lines.
   */
  unitPriceSnapshot: number;
  formulaSnapshot: string | null;
  formulaVersion: number | null;
  /**
   * Raw item-formula result (fractional, e.g. 2.3). Audit-only —
   * never display this in the UI or PDF.
   */
  formulaResultSnapshot: number;
  /**
   * CEILING(formulaResultSnapshot) — the rounded per-unit quantity.
   * Display this as العدد. Optional for tolerance toward cached
   * pre-feature payloads (which lack it); render "—" when absent.
   */
  itemQuantitySnapshot?: number;
  /**
   * Which multiplier was applied for this line. Internal/audit-only —
   * never display.
   */
  quantityMultiplierTypeSnapshot?: QuantityMultiplier;
  /**
   * The multiplier value used (product quantity or lines count).
   * Internal/audit-only — never display.
   */
  multiplierValueSnapshot?: number;
  /**
   * Total billable quantity = itemQuantitySnapshot × multiplier value.
   * Display this as إجمالي العدد.
   */
  quantitySnapshot: number;
  totalPriceSnapshot: number;
  displayOrder: number;
}

export interface InvoiceProductBlock {
  id: string;
  productId: string;
  productNameSnapshot: string;
  displayOrder: number;
  /** Backend-evaluated QuantityFormula(variable values). Read-only display. */
  productQuantity: number;
  /** Formula text used for this invoice; "" if none was set at the time. */
  productQuantityFormulaSnapshot: string;
  /** 0 if no formula was set at the time. */
  productQuantityFormulaVersion: number;
  /** Backend-evaluated LinesCountFormula(variable values). Read-only display. */
  linesCount: number;
  /** Formula text used for this invoice; "" if none was set at the time. */
  linesCountFormulaSnapshot: string;
  /** 0 if no formula was set at the time. */
  linesCountFormulaVersion: number;
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

/** Application errors (ProblemDetails): code = extensions.errors[0], message = extensions.errors[1]. */
export interface AppProblemDetails {
  type?: string;
  title: string;
  status: number;
  extensions?: { errors?: [string, string] | string[] };
  /** Legacy flat shape (pre-change backend): errors[0] = code, errors[1] = description. */
  errors?: [string, string] | string[];
}

/** FluentValidation / ASP.NET validation problems. */
export interface ValidationProblemDetails {
  type?: string;
  title: string;
  status: number;
  errors: Record<string, string[]>;
}
