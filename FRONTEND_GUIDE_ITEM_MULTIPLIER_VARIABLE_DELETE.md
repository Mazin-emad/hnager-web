# Frontend Guide — Item Quantity Multiplier + Ceiling & Variable Permanent Delete

Base URL: `/api/v1`. All endpoints require `Authorization: Bearer <JWT>` plus the
permission listed per endpoint (missing permission → `403`, see §0).
Two features changed; both are **breaking** for old clients — read §1.5 and §2.5.

## 0. How errors look (applies to every endpoint below)

**Domain errors** (unknown id, business-rule violation, …) return `ProblemDetails`
with the machine-readable code in `extensions.errors[0]` and the human message in
`extensions.errors[1]`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  "title": "Conflict",
  "status": 409,
  "extensions": { "errors": ["Variable.InUseByProducts", "Cannot delete this variable because it is assigned to the following products: Product A, Product B. Unassign it from these products first, or deactivate the variable instead."] }
}
```

Branch on `extensions.errors[0]` (stable code), show `extensions.errors[1]` to the user.

**Field-validation errors** (empty name, negative price, bad enum, …) return the
framework default `400` shape:

```json
{ "status": 400, "errors": { "quantityMultiplier": ["Quantity multiplier must be ProductQuantity or LinesCount."] } }
```

**Enum serialization:** all enums are serialized as **strings** (e.g.
`"ProductQuantity"`, `"Sales"`). Requests also accept the documented names;
sending an undefined value fails validation.

**Decimals:** send numbers, never strings. Quantities are `decimal(18,4)`,
money totals are `decimal(18,2)`.

---

## 1. BREAKING — Items: ceiling + configurable quantity multiplier

### 1.1 The calculation (what the numbers mean)

For every item the backend now computes:

```text
raw               = item formula result (may be fractional, e.g. 2.3)
itemQuantity      = CEILING(raw)                      → 2.3 → 3, 3.0 → 3, 4.7 → 5
multiplierValue   = productQuantity OR linesCount (per item config)
totalQuantity     = itemQuantity × multiplierValue
totalPrice        = totalQuantity × unit price (sales or purchase, by invoice type)
```

Worked example (`productQuantity = 50`, `linesCount = 20`, raw `= 2.3`):

| Item | Multiplier config | العدد (quantity) | إجمالي العدد (total) |
|---|---|---|---|
| Item A | `ProductQuantity` | 3 | 3 × 50 = 150 |
| Item B | `LinesCount` | 3 | 3 × 20 = 60 |

### 1.2 The new enum

| JSON value | Numeric | Meaning |
|---|---|---|
| `"ProductQuantity"` | 1 | `totalQuantity = itemQuantity × productQuantity` (default) |
| `"LinesCount"` | 2 | `totalQuantity = itemQuantity × linesCount` |

### 1.3 Item responses — new `quantityMultiplier` field

`GET /products/{productId}/items`, `GET /products/{productId}/items/{id}`,
and the items embedded in product detail / configuration responses now include
`quantityMultiplier`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Glass",
  "code": "GL-01",
  "salesPrice": 120.5,
  "purchasePrice": 100.0,
  "quantityMultiplier": "ProductQuantity",
  "isActive": true,
  "displayOrder": 0,
  "formula": {
    "id": "...", "itemId": "...",
    "expression": "width * height", "version": 1, "isActive": true
  }
}
```

`formula` is `null` when none is configured. Nothing else on this object changed.

### 1.4 Create / update item — `quantityMultiplier` is required

`POST /products/{productId}/items` (permission `items:add`, Admin):

```json
{
  "name": "Glass",
  "code": "GL-01",
  "salesPrice": 120.5,
  "purchasePrice": 100.0,
  "quantityMultiplier": "ProductQuantity",
  "displayOrder": 0
}
```

`PUT /products/{productId}/items/{id}` (permission `items:update`, Admin) takes
the same body. Field rules:

| Field | Rules |
|---|---|
| `name` | required, max 200 |
| `code` | optional, max 100 |
| `salesPrice` | required, ≥ 0 |
| `purchasePrice` | required, ≥ 0 |
| `quantityMultiplier` | **required**, must be `"ProductQuantity"` or `"LinesCount"` |
| `displayOrder` | ≥ 0 |

Recommended UI: a dropdown / radio labeled e.g. “Quantity multiplier” with options
“Product quantity” (`ProductQuantity`) and “Lines count” (`LinesCount`).

Responses: create → `201` + full item object (§1.3) with `Location` header;
update → `200` + full item object. The existing price rule on update is unchanged:
changing either price without the extra `items:update-price` permission returns
`403 Item.PriceChangeNotAllowed`.

Errors:

| Status | Code (`extensions.errors[0]`) | When |
|---|---|---|
| 404 | `Item.ProductNotFound` / `Item.NotFound` | bad product / item id |
| 400 | `Item.PriceCannotBeNegative` | negative price |
| 400 | `Item.InvalidQuantityMultiplier` | multiplier missing or not one of the two allowed values (also surfaced as field validation) |
| 400 | field validation | name/code/price/displayOrder violations |
| 403 | `Item.PriceChangeNotAllowed` | (update only) price changed without `items:update-price` |

### 1.5 Invoice lines — three new snapshot fields

`InvoiceItemResponse` (inside invoice detail / product lines) now looks like this:

```json
{
  "id": "...", "itemId": "...", "isExcluded": false,
  "itemNameSnapshot": "Glass",
  "unitPriceSnapshot": 120.5,
  "formulaSnapshot": "width * height", "formulaVersion": 1,
  "formulaResultSnapshot": 2.3,
  "itemQuantitySnapshot": 3,
  "quantityMultiplierTypeSnapshot": "ProductQuantity",
  "multiplierValueSnapshot": 50,
  "quantitySnapshot": 150,
  "totalPriceSnapshot": 3750,
  "displayOrder": 0
}
```

Field semantics — **use exactly these for display**:

| Field | Meaning | Show in UI/PDF? |
|---|---|---|
| `formulaResultSnapshot` | raw formula result (fractional, audit only) | **No** — never display |
| `itemQuantitySnapshot` | `CEILING(raw)` | **Yes** — العدد |
| `quantityMultiplierTypeSnapshot` | which multiplier was used | **No** (config detail) |
| `multiplierValueSnapshot` | the multiplier value used (product qty or lines count) | **No** (config detail) |
| `quantitySnapshot` | total quantity (`itemQuantity × multiplier`) | **Yes** — إجمالي العدد |
| `unitPriceSnapshot` | resolved price (sales for Sales/Returns, purchase for Purchases) | **Yes** — السعر |
| `totalPriceSnapshot` | line total | **Yes** — السعر الاجمالي |

The product header still carries the calculated `productQuantity` and `linesCount`
(الكمية / عدد الخطوط). Never display `formulaSnapshot`, any formula expression,
or the multiplier config — they are internal details. Invoice create / recalculate
request bodies are **unchanged** (no price, no quantity, no multiplier is ever sent
on invoice requests).

### 1.6 Migration checklist for old clients

1. Item create/update forms **must** send `quantityMultiplier` — omitting it is a
   `400` (there is no silent default over the wire).
2. Invoice tables must render العدد from `itemQuantitySnapshot`, **not** from
   `formulaResultSnapshot` (which is now the unrounded raw value).
3. Expect `quantityMultiplierTypeSnapshot` / `multiplierValueSnapshot` on every
   line — store them if you cache invoices, ignore them for display.

---

## 2. BREAKING — `DELETE /variables/{id}` is now a permanent delete

### 2.1 Two operations (keep both in the UI)

| Operation | Endpoint | Effect |
|---|---|---|
| Deactivate / reactivate | `PATCH /api/v1/variables/{id}/toggle-active` | flips `isActive`; reversible; refused while an **active** formula references the key |
| **Permanent delete** | `DELETE /api/v1/variables/{id}` | physically removes the row; only when nothing references it (see §2.3) |

Suggested UI: `Edit` · `Activate/Deactivate` · `Delete (permanent)` — the delete
action needs a confirm dialog warning that it cannot be undone.

### 2.2 `DELETE /api/v1/variables/{id}` (permission `variables:delete`, Admin)

**Params:** `id` (path, GUID). **Body:** none.

- Success: `204`, empty body.
- Deleting an already-deleted/unknown id: `404 Variable.NotFound`.
- No permission (member, or unauthenticated): `403` — enforced by the backend
  regardless of what the UI shows.

### 2.3 When deletion is refused (409) — show the message, it names the blockers

| Status | Code | When | Example message |
|---|---|---|---|
| 409 | `Variable.InUseByProducts` | variable is assigned to products | `Cannot delete this variable because it is assigned to the following products: Product A, Product B. Unassign it from these products first, or deactivate the variable instead.` |
| 409 | `Variable.KeyInUseByFormula` | variable is referenced by any item, quantity, or lines-count formula | `Cannot delete this variable because it is referenced by: item formula 'Glass' of product 'Window'; quantity formula of product 'Door'. Remove these references first, or deactivate the variable instead.` |
| 409 | `Variable.ReferencedByInvoices` | historical invoice snapshots reference it (snapshots are immutable, so this is final — offer deactivation) | `Cannot delete this variable because historical invoices reference it. Invoice snapshots are immutable — deactivate the variable instead.` |
| 404 | `Variable.NotFound` | unknown id (incl. already deleted) | `Variable not found.` |

Recommended UX: on `409`, keep the variable and display `extensions.errors[1]`
verbatim — it already lists what the admin must clean up (unassign the variable
on the product page, edit/remove the listed formulas, or fall back to
deactivation). Do **not** pre-check dependencies client-side; the backend is the
source of truth and the checks are cheap to attempt.

### 2.4 What deletion never touches

A successful delete removes **only** the variable row. Products, items, formulas,
invoices, and invoice snapshots are never cascade-deleted (FKs are `Restrict`);
historical invoices keep rendering from their snapshots, and no formula can be
left with a dangling reference (that's exactly what the 409s prevent).

### 2.5 Migration checklist for old clients

1. Stop treating `DELETE /variables/{id}` as idempotent deactivation: success now
   means the row is gone, and repeating it returns `404` — refresh the list and
   drop the row from local state on `204`.
2. Handle the two new `409` codes (`Variable.InUseByProducts`,
   `Variable.ReferencedByInvoices`) wherever you already handle
   `Variable.KeyInUseByFormula`.
3. The toggle-active endpoint is unchanged — no client changes needed there.

---

## 3. Quick reference — what changed and where

| Area | Change | Frontend action |
|---|---|---|
| Item create/update body | + required `quantityMultiplier` (`"ProductQuantity"`/`"LinesCount"`) | add dropdown, always send |
| Item responses (incl. embedded in products) | + `quantityMultiplier` | render in admin forms |
| Invoice line responses | + `itemQuantitySnapshot`, `quantityMultiplierTypeSnapshot`, `multiplierValueSnapshot`; `formulaResultSnapshot` is now raw | render العدد from `itemQuantitySnapshot`; hide the rest |
| Invoice requests | unchanged | none |
| `DELETE /variables/{id}` | permanent delete; new 409s; repeat → 404 | update delete flow + error handling |
| `PATCH /variables/{id}/toggle-active` | unchanged | none |
| Permissions | unchanged (`items:add/update`, `variables:delete`, …) | none |
