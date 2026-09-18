# Frontend Guide — Barns Count (عدد العنابر), Invoice Sharing, PDF Modes

Scope: backend changes only (no existing endpoint removed or renamed). Intended reader: an AI
frontend coding agent implementing the client updates.

Global conventions (unchanged, from `API.md`): base URLs `https://localhost:7283` /
`http://localhost:5119`; JSON is **camelCase**; **enums are serialized as strings**
(`"Sales"`, `"BarnsCount"`, `"Full"`, …); `DateOnly` is `"YYYY-MM-DD"`; `DateTimeOffset`
is ISO-8601; auth is `Authorization: Bearer {accessToken}`.

Application errors use `result.ToProblem()` shape: `{ type, title, status, errors: [code, description] }`
where `errors[0]` is the machine code (e.g. `"Invoice.DuplicateShare"`). FluentValidation
failures are plain ASP.NET **400** validation-problem responses. Empty successes are
**204 No Content**; creates return **201** with a `Location` header.

---

## 1. Enum changes (wire values are the exact strings below)

### 1.1 `ItemQuantityMultiplier` — one value ADDED
- Before: `"ProductQuantity" | "LinesCount"`
- After: `"ProductQuantity" | "LinesCount" | "BarnsCount"`
- Affects: item create/update `quantityMultiplier`, `ItemDetailResponse.quantityMultiplier`,
  `InvoiceItemResponse.quantityMultiplierTypeSnapshot`.
- Unknown/legacy values (e.g. `0`) are normalized server-side to `"ProductQuantity"`.

### 1.2 NEW `InvoicePdfMode`
`"Full" | "WithoutItems"` — query param of `GET /api/v1/invoices/{id}/pdf` (default `"Full"`).

### 1.3 NEW `ReceivedInvoicePeriod`
`"Last24Hours" | "Last7Days" | "Last30Days"` — query param `period` of
`GET /api/v1/invoices/received`. Any other string (or numeric garbage) → **400**.

---

## 2. عدد العنابر (Barns Count) changes

Barns Count behaves exactly like Lines Count: admin-configured formula, server-calculated,
never user input, snapshotted per invoice product, usable inside item formulas and as an
item multiplier. Arabic label: **عدد العنابر**.

### 2.1 `ProductDetailResponse` — 2 fields ADDED (nothing removed/renamed)
```
+ barnsCountExpression: string | null
+ barnsCountFormulaVersion: number
```
`null`/version `0` = no formula configured (calculation falls back to `1`).

### 2.2 NEW product formula endpoints (mirror the existing quantity/lines-count ones)
| Method | URL | Permission | Body | Response 200 |
|---|---|---|---|---|
| GET | `/api/v1/products/{id}/barns-count-formula` | `products:read` | — | `ProductBarnsCountFormulaResponse` |
| PUT | `/api/v1/products/{id}/barns-count-formula` | `products:update` (Admin) | `UpsertProductBarnsCountFormulaRequest` | `ProductBarnsCountFormulaResponse` |

```ts
interface UpsertProductBarnsCountFormulaRequest { expression: string; } // required, max 2000 chars
interface ProductBarnsCountFormulaResponse { productId: string; expression: string | null; version: number; }
```

### 2.3 Formula language rules (affect admin formula editors)
- **Item formulas** may now reference `BarnsCount` **and** `LinesCount` in addition to the
  product's variable keys. Validate/test endpoints are unchanged
  (`POST /api/v1/formulas/validate`, `POST /api/v1/formulas/evaluate`).
- **Product-level formulas** (quantity, lines-count, barns-count) may reference **only** the
  product's variable keys. Using `BarnsCount`/`LinesCount` there is rejected by the server
  (no client-side guess needed — surface the server error).
- **Variable keys**: `BarnsCount` is now reserved, exactly like `LinesCount`.
  `POST/PUT /api/v1/variables` rejects key `"BarnsCount"` (case-sensitive, ordinal).
  Key format stays `^[a-zA-Z][a-zA-Z0-9_]*$`, max 100.

### 2.4 Item multiplier — third option
`POST /api/v1/products/{productId}/items` and `PUT .../items/{id}` accept
`quantityMultiplier: "ProductQuantity" | "LinesCount" | "BarnsCount"`
(anything else → **400**). Displayed in `ItemDetailResponse.quantityMultiplier`.

### 2.5 Invoice detail — 3 fields ADDED per product entry
`InvoiceProductResponse` (inside `GET /api/v1/invoices/{id}` and all responses returning
`InvoiceDetailResponse`) gains, after the lines-count fields:
```
+ barnsCount: number
+ barnsCountFormulaSnapshot: string   // "" when no formula was configured; NEVER display as a formula
+ barnsCountFormulaVersion: number    // 0 when no formula was configured
```
Display `productNameSnapshot`, `productQuantity` (الكمية), `linesCount` (عدد الخطوط),
`barnsCount` (عدد العنابر). Do **not** render `*FormulaSnapshot` fields anywhere.

### 2.6 Calculation semantics (for correct display, not for client math)
- `itemQuantitySnapshot` (العدد) = raw fractional formula result — **never** rounded up.
- `rawTotalQuantitySnapshot` = quantity × selected multiplier (audit only).
- `quantitySnapshot` (اجمالي العدد) = `CEILING(rawTotal)` — the only ceiled value.
- `totalPriceSnapshot` = ceiled total × unit price.
- The frontend must **never** recompute these; always render snapshot fields.

---

## 3. Invoice sharing + received invoices (الفواتير المرسلة لي)

### 3.1 Share an invoice
```
POST /api/v1/invoices/{id}/share          Permission: invoices:share (Member + Admin)
Body: { "sharedWithUserId": "<Identity user id, required, max 450>" }
→ 200 InvoiceShareResponse
```
```ts
interface ShareInvoiceRequest { sharedWithUserId: string; }
interface InvoiceShareResponse {
  id: string; invoiceId: string; invoiceNumber: string;
  sharedWithUserId: string; sharedByUserId: string; sharedAt: string; // ISO
}
```
Rules enforced server-side: only the **owner** (or Admin) can share; no self-share;
recipient must exist and not be disabled; duplicates rejected; ownership never transfers;
email notification is fire-and-forget (no email data in any API response).

| Status | `errors[0]` code | Meaning |
|---|---|---|
| 403 | `Invoice.ShareNotAllowed` | not the owner (or ID manipulation) |
| 400 | `Invoice.ShareWithSelf` | sharing with yourself |
| 404 | `Invoice.NotFound` / `Invoice.RecipientNotFound` | invoice / recipient missing |
| 422 | `Invoice.RecipientInactive` | recipient disabled |
| 409 | `Invoice.DuplicateShare` | already shared with this user — treat as success-ish info, refresh UI |

### 3.2 Received invoices (new member section "الفواتير المرسلة لي")
```
GET /api/v1/invoices/received?fromUserId=&fromDate=&toDate=&period=&page=1&pageSize=20
Permission: invoices:received-read (Member + Admin)
→ 200 ReceivedInvoiceListResponse
```
- Filters apply to **`sharedAt`** (receipt time), not invoice creation date.
- `period`: `Last24Hours | Last7Days | Last30Days`. If explicit `fromDate`/`toDate`
  (ISO-8601) are also sent, the explicit bound wins for that bound.
- `fromUserId` = sharer/sender user id. `page >= 1`, `1 <= pageSize <= 100`,
  `fromDate <= toDate` (else **400**).
```ts
interface ReceivedInvoicesFilterRequest {
  fromUserId?: string; fromDate?: string; toDate?: string;
  period?: ReceivedInvoicePeriod; page?: number; pageSize?: number;
}
interface ReceivedInvoiceListResponse { items: ReceivedInvoiceResponse[]; totalCount: number; page: number; pageSize: number; }
interface ReceivedInvoiceResponse {
  shareId: string; invoiceId: string; invoiceNumber: string; customerName: string;
  invoiceType: InvoiceType; salesRepName: string; invoiceDate: string; // YYYY-MM-DD
  status: InvoiceStatus; grandTotal: number;
  ownerUserId: string; sharedByUserId: string; sharedAt: string; // ISO
}
```

### 3.3 Revoke a share
```
DELETE /api/v1/invoices/{id}/share/{sharedWithUserId}   Permission: invoices:share
→ 204 | 404 Invoice.ShareNotFound | 403 Invoice.ShareNotAllowed
```

### 3.4 Access matrix (must be mirrored in UI gating; backend always re-checks)
| Action | Owner | Share recipient | Other member | Admin |
|---|---|---|---|---|
| Read detail / print PDF | ✅ | ✅ | ❌ 403/404 | ✅ |
| Edit / add-remove products / recalc / finalize / delete / share / unshare | ✅ | ❌ 403 | ❌ | ✅ (per permission) |
| `GET /received` | own receipts | own receipts | own receipts | own receipts |

### 3.5 ⚠️ Known gap — recipient picker
There is **no new member-search endpoint**. The existing `GET /api/Users` (and
`GET /api/Users/{id}` → `UserResponse { id, firstName, lastName, email, isDisabled, roles }`)
requires `users:read`, which the **Member** role does **not** have (Admin only). Options:
(a) Admin-only picker via `GET /api/Users`; (b) member shares by pasting a user id;
(c) request a backend member-lookup endpoint. Do **not** work around this by exposing the
admin users endpoint to members client-side.

---

## 4. PDF printing — two modes
```
GET /api/v1/invoices/{id}/pdf?mode=Full            (default; filename {invoiceNumber}.pdf)
GET /api/v1/invoices/{id}/pdf?mode=WithoutItems    (filename {invoiceNumber}-summary.pdf)
Permission: invoices:pdf.  → application/pdf bytes. Invalid mode → 400 Invoice.InvalidPdfMode.
```
- `Full`: current layout + **عدد العنابر** in each product header; item table unchanged.
- `WithoutItems`: same header/totals, product-level info kept
  (name, الكمية, عدد الخطوط, عدد العنابر), **no item table or item-level data at all**.
- Both modes render stored snapshots only. Shapes consumed: `InvoiceDetailResponse` (unchanged
  except §2.5). Fetch with `responseType: 'blob'` (or `arraybuffer`) and honor
  `content-disposition` filename.
- Backend guarantees Western digits (`0-9`) for all numbers; keep Arabic labels as-is.

---

## 5. Added / removed / renamed / modified fields (complete)

| Location | Change |
|---|---|
| `ProductDetailResponse` | **+** `barnsCountExpression: string \| null`, `barnsCountFormulaVersion: number` |
| `InvoiceProductResponse` (in invoice detail) | **+** `barnsCount: number`, `barnsCountFormulaSnapshot: string`, `barnsCountFormulaVersion: number` |
| `ItemDetailResponse.quantityMultiplier`, item create/update bodies | **modified**: enum now includes `"BarnsCount"` |
| Variable `key` validation | **modified**: `"BarnsCount"` reserved (like `"LinesCount"`) |
| `GET .../pdf` | **modified**: new optional `mode` query param |
| NEW types | `InvoicePdfMode`, `ReceivedInvoicePeriod`, `UpsertProductBarnsCountFormulaRequest`, `ProductBarnsCountFormulaResponse`, `ShareInvoiceRequest`, `InvoiceShareResponse`, `ReceivedInvoicesFilterRequest`, `ReceivedInvoiceListResponse`, `ReceivedInvoiceResponse` |
| NEW permissions | `invoices:share`, `invoices:received-read` (Member role includes both; Admin has all) |
| Removed / renamed | **NONE** — all existing fields, routes, and behaviors are intact |

---

## 6. Exact TypeScript types (camelCase, as received over the wire)

```ts
type ItemQuantityMultiplier = 'ProductQuantity' | 'LinesCount' | 'BarnsCount';
type InvoicePdfMode = 'Full' | 'WithoutItems';
type ReceivedInvoicePeriod = 'Last24Hours' | 'Last7Days' | 'Last30Days';
type InvoiceType = 'Sales' | 'Purchases' | 'Returns';
type InvoiceStatus = 'Draft' | 'Finalized' | 'Cancelled';

interface ProductDetailResponse {
  id: string; name: string; description: string | null; isActive: boolean; displayOrder: number;
  quantityExpression: string | null; quantityFormulaVersion: number;
  linesCountExpression: string | null; linesCountFormulaVersion: number;
  barnsCountExpression: string | null; barnsCountFormulaVersion: number;   // NEW
  variables: ProductVariableResponse[]; items: ItemDetailResponse[];
}
interface UpsertProductBarnsCountFormulaRequest { expression: string; }
interface ProductBarnsCountFormulaResponse { productId: string; expression: string | null; version: number; }

interface InvoiceProductResponse {
  id: string; productId: string; productNameSnapshot: string; displayOrder: number;
  productQuantity: number; productQuantityFormulaSnapshot: string; productQuantityFormulaVersion: number;
  linesCount: number; linesCountFormulaSnapshot: string; linesCountFormulaVersion: number;
  barnsCount: number; barnsCountFormulaSnapshot: string; barnsCountFormulaVersion: number;  // NEW
  inputValues: InvoiceInputValueResponse[]; items: InvoiceItemResponse[];
}
// InvoiceDetailResponse, InvoiceSummaryResponse, InvoiceListResponse,
// InvoiceItemResponse, CreateItemRequest, UpdateItemRequest: shapes UNCHANGED
// (InvoiceItemResponse.quantityMultiplierTypeSnapshot now admits 'BarnsCount').
// Share/received interfaces: see §3.1–§3.2 verbatim.
interface ApiProblem { type: string; title: string; status: number; errors: [string, string]; }
```

---

## 7. What the frontend must change

**Forms**
- Product formula editor: add a third formula section **عدد العنابر** wired to the new
  GET/PUT `barns-count-formula` endpoints (same UX as quantity/lines-count, incl. version display).
- Item form: add `BarnsCount` (label عدد العنابر) to the multiplier dropdown.
- Variable form: reject key `BarnsCount` client-side (server also rejects).
- New **Share dialog** on invoice detail (owner only, Draft or any status — share works
  regardless of status): recipient user-id input (+ admin member picker per §3.5), shows
  409-duplicate as info, never offers sharing on received (non-owned) invoices.

**API services** (`invoicesApi`, `productsApi`)
- `getBarnsCountFormula(productId)`, `setBarnsCountFormula(productId, { expression })`.
- `shareInvoice(invoiceId, { sharedWithUserId })`, `getReceivedInvoices(params)`,
  `unshareInvoice(invoiceId, userId)`.
- `getInvoicePdf(invoiceId, mode: 'Full' | 'WithoutItems')` with blob handling + filename
  (`{invoiceNumber}.pdf` vs `{invoiceNumber}-summary.pdf`).

**React Query**
- Keys: `['products', id, 'barnsCountFormula']`, `['invoices', 'received', filters]`,
  `['invoices', id, 'shares']` (if share list cached).
- Invalidate: product detail + invoice builder preview after barns-formula set; `received`
  list after share/unshare; invoice detail after share (no data change, optional).

**UI**
- New nav/section **الفواتير المرسلة لي** (received list, server-paginated) with filters:
  preset chips (last 24h / 7 days / 30 days), custom date range, sender filter; columns:
  invoice number, owner/sender, invoice date, **sharedAt**, status, grand total.
- Invoice detail: show عدد العنابر per product; on received invoices render **read-only**
  (hide edit/recalc/finalize/delete/share buttons; show "shared with you" badge + owner).
- PDF buttons: two options — full invoice vs. without items.
- Error toasts keyed by `errors[0]`: `Invoice.DuplicateShare` (409), `Invoice.ShareNotAllowed`
  (403), `Invoice.RecipientNotFound` (404), `Invoice.RecipientInactive` (422),
  `Invoice.InvalidPdfMode` (400).

**State/auth**
- Gate share UI on ownership (`createdBy === currentUserId` or admin) **and** the
  `invoices:share` permission; gate received section on `invoices:received-read`.
  Backend is authoritative — UI gating is UX only.

## 8. Final checklist
- [ ] Multiplier dropdowns accept/send `"BarnsCount"`; invoice/product views render it.
- [ ] Product admin UI has quantity + lines-count + **barns-count** formula sections.
- [ ] Variable editor blocks `BarnsCount` key; item formula hints mention `BarnsCount`.
- [ ] Invoice detail renders `barnsCount` (عدد العنابر); no formula snapshots displayed.
- [ ] Share dialog → `POST share`; 409/403/404/422 handled; ownership never assumed transferred.
- [ ] "الفواتير المرسلة لي" page: server pagination + `period`/`fromDate`/`toDate`/`fromUserId`
      filters on `sharedAt`; read-only detail; PDF printable by recipient.
- [ ] Unshare action for owners; revoked recipients lose access (backend-enforced).
- [ ] PDF download supports `mode=Full|WithoutItems` with correct filenames.
- [ ] No client-side quantity/price math introduced; snapshot fields rendered as-is.
- [ ] Recipient picker gap (§3.5) resolved by product decision or backend follow-up.
