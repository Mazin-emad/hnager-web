# Frontend Guide — Recent API Changes (Sales/Purchase Prices + Delete Endpoints)

Base URL: `/api/v1`. All endpoints require `Authorization: Bearer <JWT>` plus the
permission listed per endpoint (403 when the permission is missing).

## 0. How errors look (applies to every endpoint below)

**Domain errors** (unknown id, business-rule violation, missing price permission, …)
return `ProblemDetails` with the machine-readable code inside
`extensions.errors[0]` and the human message in `extensions.errors[1]`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  "title": "Not Found",
  "status": 404,
  "extensions": { "errors": ["Item.NotFound", "Item not found."] }
}
```

Branch on `extensions.errors[0]` (stable code), show `extensions.errors[1]` to the user.

**Field-validation errors** (empty name, negative price, bad GUID, …) return the
framework default `400` shape:

```json
{ "status": 400, "errors": { "salesPrice": ["Sales price cannot be negative."] } }
```

---

## 1. BREAKING — Items now have TWO prices: `salesPrice` + `purchasePrice`

`unitPrice` no longer exists on any item request/response. Every occurrence is
replaced by two independent decimals (precision `decimal(18,4)` — send numbers,
never strings):

| Field (JSON) | Type | Rules | Meaning |
|---|---|---|---|
| `salesPrice` | number ≥ 0 | required on create/update | سعر البيع — used for **Sales** and **Returns** invoices |
| `purchasePrice` | number ≥ 0 | required on create/update | سعر الشراء — used for **Purchase** invoices |

The backend picks the price from the invoice type. The frontend **never sends a
price on any invoice request** (`AddInvoiceProductRequest` has no price field)
and **never decides** which price applies.

### 1.1 `GET /api/v1/products/{productId}/items` → 200 (also embedded in product detail / configuration responses)

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Glass",
    "code": "GL-01",
    "salesPrice": 120.5,
    "purchasePrice": 100.0,
    "isActive": true,
    "displayOrder": 0,
    "formula": {
      "id": "...", "itemId": "...",
      "expression": "width * height", "version": 1, "isActive": true
    }
  }
]
```

`formula` is `null` when none is configured. Errors: `404 Item.ProductNotFound`.

### 1.2 `GET /api/v1/products/{productId}/items/{id}` → 200

Same object as §1.1. Errors: `404 Item.NotFound`.

### 1.3 `POST /api/v1/products/{productId}/items` (permission `items:add`, Admin)

Request body — **both prices are required**:

```json
{ "name": "Glass", "code": "GL-01", "salesPrice": 120.5, "purchasePrice": 100.0, "displayOrder": 0 }
```

| Field | Rules |
|---|---|
| `name` | required, max 200 |
| `code` | optional, max 100 |
| `salesPrice` | required, ≥ 0 |
| `purchasePrice` | required, ≥ 0 |
| `displayOrder` | ≥ 0 |

Success: `201` + `ItemDetailResponse` (§1.1), `Location` → `GET …/items/{id}`.
Errors: `404 Item.ProductNotFound` · `400 Item.PriceCannotBeNegative`
(`extensions.errors[0]`, message *"Item sales/purchase price cannot be negative."*)
· `400` field validation.

### 1.4 `PUT /api/v1/products/{productId}/items/{id}` (permission `items:update`, Admin)

Body: same as §1.3. The two prices are **independent** — changing one never
touches the other. Success: `200` + `ItemDetailResponse`.

Errors: `404 Item.NotFound` · `400` price/validation ·
`403 Item.PriceChangeNotAllowed` (*"You do not have permission to change item
prices."*) — returned when **either** price differs and the caller lacks the
extra `items:update-price` permission. Renaming/reordering with unchanged prices
works without that permission.

### 1.5 Invoice lines — `unitPriceSnapshot` is now the *resolved* price

`InvoiceItemResponse` keeps the same shape, but `unitPriceSnapshot` is the price
the backend resolved for that invoice's type:

- `invoiceType: 1 (Sales)` or `3 (Returns)` → `unitPriceSnapshot` = item's `salesPrice`
- `invoiceType: 2 (Purchases)` → `unitPriceSnapshot` = item's `purchasePrice`

```json
{
  "id": "...", "itemId": "...", "isExcluded": false,
  "itemNameSnapshot": "Glass",
  "unitPriceSnapshot": 120.5,
  "formulaSnapshot": "width * height", "formulaVersion": 1,
  "formulaResultSnapshot": 50,
  "quantitySnapshot": 100,
  "totalPriceSnapshot": 12050.0,
  "displayOrder": 0
}
```

Rules the UI must reflect:

- Stored invoices keep their old `unitPriceSnapshot` when an admin later changes
  catalog prices — until the user presses **Recalculate** (`POST
  /api/v1/invoices/{id}/recalculate`), which re-resolves from current pricing.
- Changing the invoice **type** via `PUT /api/v1/invoices/{id}` immediately
  re-prices every line from current catalog pricing (quantities/formulas
  untouched) and refreshes totals — a switched Sales→Purchase invoice shows
  purchase prices without needing Recalculate.
- The PDF prints only `unitPriceSnapshot` (single "السعر" column) — never both prices.

### 1.6 Enum values (unchanged, for reference)

`InvoiceType`: `1 = Sales (مبيعات)`, `2 = Purchases (مشتريات)`, `3 = Returns (مرتجعات)`.
`InvoiceStatus`: `1 = Draft`, `2 = Finalized`, `3 = Cancelled`.

### 1.7 Migration note

Existing items were backfilled with `purchasePrice = salesPrice`. Until an admin
sets distinct purchase prices, purchase invoices total exactly like sales
invoices. Consider showing a hint/badge in the item form when both prices are equal.

---

## 2. NEW — Delete endpoints (all hard deletes unless noted)

All return `204 No Content` with an empty body on success. A second delete of the
same id returns `404` (not idempotent — except variables, see §2.7).

### 2.1 `DELETE /api/v1/invoices/{id}` (permission `invoices:delete`)

Deletes header + product/item lines (cascade). **Any status is deletable,
including Finalized.** Ownership still applies: members can only delete their own
invoices.

- Success: `204`, empty body
- `404 Invoice.NotFound` (*"Invoice not found."*) — unknown id
- `403 Invoice.AccessDenied` (*"You are not allowed to access this invoice."*) — another user's invoice

### 2.2 `DELETE /api/v1/products/{id}` (permission `products:delete`, Admin)

Hard-deletes the product; dependent items → formulas and product-variable links
cascade.

- Success: `204`, empty body
- `404 Product.NotFound`

### 2.3 `DELETE /api/v1/products/{productId}/items/{id}` (permission `items:delete`, Admin)

Hard-deletes the item **and its 1:1 formula row**. Historical invoices are
unaffected (they keep full snapshots).

- Success: `204`, empty body
- `404 Item.NotFound` (also when `productId` doesn't match / product missing)

### 2.4 `DELETE /api/v1/items/{itemId}/formula` (permission `formulas:delete`, Admin)

Deletes only the formula row; the owning item stays in place (it will then be
skipped in calculations until a new formula is added).

- Success: `204`, empty body
- `404 Formula.NotFound` (*"Formula not found."*) — item has no formula

### 2.5 `DELETE /api/v1/roles/{id}` (permission `roles:delete`, Admin)

Hard-deletes the role and invalidates sessions of its members (they must re-login).

- Success: `204`, empty body
- `404 Role.RoleNotFound` (*"Role is not found"*)
- `403 Role.ProtectedRole` (*"The built-in Admin role cannot be renamed or disabled."*) — built-in roles

### 2.6 `DELETE /api/v1/users/{id}` (permission `users:delete`, Admin)

Hard-deletes the user. Self-delete is forbidden.

- Success: `204`, empty body
- `404 User.UserNotFound` (*"User is not found"*)
- `403 User.CannotDeleteSelf` (*"You cannot delete your own account."*)

### 2.7 `DELETE /api/v1/variables/{id}` (permission `variables:delete`, Admin)

**Soft delete** (sets `isActive = false`, never removes the row — formula ASTs and
invoice snapshots reference variable keys). **Idempotent**: deleting an already
inactive variable still returns `204`.

- Success: `204`, empty body
- `404 Variable.NotFound` (*"Variable not found."*)
- `409 Variable.KeyInUseByFormula` (*"Cannot deactivate or delete this variable because it is referenced by one or more active formulas."*)

---

## 3. NEW permissions (gate UI buttons/menus with these)

| Permission string | Unlocks |
|---|---|
| `invoices:delete` | §2.1 |
| `products:delete` | §2.2 |
| `items:delete` | §2.3 |
| `formulas:delete` | §2.4 |
| `roles:delete` | §2.5 |
| `users:delete` | §2.6 |
| `variables:delete` | §2.7 |

Unchanged but relevant: `items:update-price` (required to change either item
price, §1.4). `invoices:delete` is included in the invoice permission set alongside
`invoices:read/add/update/recalculate/finalize/pdf`.

---

## 4. Frontend checklist

1. Item form: replace the single price input with **two** inputs (`salesPrice`,
   `purchasePrice`); both required, ≥ 0; Arabic labels سعر البيع / سعر الشراء.
2. Item list/detail/product-configuration views: render both prices; drop `unitPrice`.
3. Invoice builder/detail/PDF preview: keep showing the single `unitPriceSnapshot`
   per line — no changes needed except knowing it now follows the invoice type.
4. After `PUT /api/v1/invoices/{id}` that changes `invoiceType`: re-fetch the
   invoice (backend already repriced the lines) instead of keeping local totals.
5. Add delete buttons calling §2.1–§2.7 with `204` handling; confirm dialogs for
   hard deletes; special-case `403 Role.ProtectedRole`, `403
   User.CannotDeleteSelf`, and `409 Variable.KeyInUseByFormula` with friendly messages.
6. Handle the error envelope in §0: read `extensions.errors[0]` for codes
   (`Item.PriceChangeNotAllowed`, `Item.PriceCannotBeNegative`, `Invoice.AccessDenied`, …).
