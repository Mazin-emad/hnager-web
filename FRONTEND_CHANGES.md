# Backend Changes — Product Quantity Formula (Frontend Guide)

## What changed (one paragraph)

Product Quantity is now **calculated by the backend**, never typed by the user.
Each product has a **Quantity Formula** (e.g. `Length * Width / 100`) managed by Admin.
When a product is added to an invoice, the backend evaluates that formula from the
entered variable values and stores the result as `productQuantity` on the invoice.
Item quantities and prices then derive from it. The frontend must **not** send,
input, or edit any quantity — it only displays what the backend returns.

## Calculation cheat sheet

```text
productQuantity   = QuantityFormula(variable values)          ← Stage 1
quantitySnapshot  = formulaResultSnapshot × productQuantity   ← Stage 2 (per item)
totalPrice        = quantitySnapshot × unitPriceSnapshot      ← Stage 3 (per item)
```

---

## New endpoints

### `GET /api/v1/products/{id}/quantity-formula`

**Use it:** on the product settings/edit page to show the current formula (prefill the editor).

**Auth:** any authenticated user (`products:read`).

**Response — 200:**

```json
{ "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "expression": "Length * Width / 100", "version": 2 }
```

- `expression: null`, `version: 0` → **no formula configured yet** (show empty editor + hint like "No quantity formula set — quantity defaults to 1").
- **Errors:** `404 Product.NotFound`.

### `PUT /api/v1/products/{id}/quantity-formula`

**Use it:** Admin "Save formula" button on the product settings page.

**Auth:** Admin (`products:update`).

**Request:**

```json
{ "expression": "Length * Width / 100" }
```

- `expression`: required, max 2000 chars, may reference **only variables assigned to this product**.
  Tip: offer the product's variable keys as insertable chips/buttons to avoid typos.

**Response — 200:** same shape as GET (with bumped `version` if the text changed; saving identical text keeps the version).

**Errors:**

| Status | Meaning | Frontend action |
|--------|---------|-----------------|
| `400` validation | Empty / >2000 chars | Inline field error |
| `400 Formula.ParseFailed` | Syntax error | Show `errors[1]` message under the editor |
| `400 Formula.ValidationFailed` | Unknown variable referenced | Show `errors[1]` — it names the bad key; suggest assigning that variable to the product first |
| `404 Product.NotFound` | Bad product id | — |

**Suggested UX:** validate-as-you-type via existing `POST /api/v1/formulas/validate`
(`{ expression, productId }` → `{ isValid, errorMessage }`), then save with PUT.

---

## Changed models

### `ProductDetailResponse` (GET product, GET configuration) — 2 new fields

```json
{
  "id": "...", "name": "Barn", "description": "...", "isActive": true, "displayOrder": 0,
  "quantityExpression": "Length * Width / 100",
  "quantityFormulaVersion": 2,
  "variables": [ ... ],
  "items": [ ... ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `quantityExpression` | `string \| null` | `null` = never configured |
| `quantityFormulaVersion` | `number` | `0` = never configured; increments on each real change |

### `InvoiceProductResponse` (inside invoice detail) — 3 new fields

```json
{
  "id": "...", "productId": "...", "productNameSnapshot": "Barn", "displayOrder": 0,
  "productQuantity": 50,
  "productQuantityFormulaSnapshot": "Length * Width / 100",
  "productQuantityFormulaVersion": 1,
  "inputValues": [ ... ],
  "items": [ ... ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `productQuantity` | `number` (4dp) | **Display it** (e.g. product header badge: "Qty: 50"). Read-only. |
| `productQuantityFormulaSnapshot` | `string` | Formula text used for this invoice; `""` if none was set at the time. Tooltip/audit display. |
| `productQuantityFormulaVersion` | `number` | `0` if none was set. Audit display. |

### `InvoiceItemResponse` — 1 new field + 1 changed meaning

```json
{
  "id": "...", "itemId": "...", "isExcluded": false, "itemNameSnapshot": "Wire",
  "unitPriceSnapshot": 25, "formulaSnapshot": "NumberOfLines / 10", "formulaVersion": 1,
  "formulaResultSnapshot": 2,
  "quantitySnapshot": 100,
  "totalPriceSnapshot": 2500,
  "displayOrder": 0
}
```

| Field | Meaning |
|-------|---------|
| `formulaResultSnapshot` (**new**, 4dp) | Raw item-formula result, *before* the product-quantity multiplier. Show as "formula result" if you want a breakdown. |
| `quantitySnapshot` (⚠️ meaning changed) | Now the **total billable quantity** (`formulaResult × productQuantity`). This is the "Quantity" column. |
| `totalPriceSnapshot` | Unchanged: `quantitySnapshot × unitPriceSnapshot`. |

### What did NOT change

- `POST /api/v1/invoices/{id}/products` request: still only `{ productId, inputValues }`.
  **Do not add a quantity input** to the invoice builder — the backend has no such field and ignores unknown ones.
- Exclusion toggle, recalculate, finalize, totals: same contracts.

---

## Migration notes for old data

- Products created before this feature: `quantityExpression: null`, `quantityFormulaVersion: 0`. Prompt Admin to set a formula; until then their invoices compute with quantity `1`.
- Old invoice lines: `productQuantity: 1`, `formulaResultSnapshot: 0` (backfilled placeholder).
  If you render a "formula result" column, `0` on pre-feature invoices means "not recorded", not a real zero.
  Recalculating a Draft repopulates it correctly.

## Integration checklist

- [ ] Product settings page: formula editor + variable-key chips + live validate + save via PUT; show `version`.
- [ ] Invoice builder: no quantity input; after add-product, display `productQuantity` from the response.
- [ ] Invoice view: Quantity column = `quantitySnapshot`; optional breakdown tooltip `formulaResultSnapshot × productQuantity`.
- [ ] Show `Formula.ParseFailed` / `Formula.ValidationFailed` messages (`errors[1]`) under the formula editor.
- [ ] Handle `quantityExpression: null` (never configured) with an empty state, not an error.
