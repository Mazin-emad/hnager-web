# Prompt — Web Frontend: Backend Update (Lines Count + Delete Permissions + PDF ordering)

Three backend changes are already implemented, tested (97/97 passing), and deployed to the database. Use this as ground truth — do not re-implement backend logic, only update the frontend to match.

## 1. Lines Count (عدد الخطوط) — derived value

`LinesCount` is calculated server-side, never a manual input.

- **New admin endpoints** for managing a product's lines-count formula:
  - `GET /api/v1/products/{id}/lines-count-formula` → `{ productId, expression, version }`
  - `PUT /api/v1/products/{id}/lines-count-formula` with body `{ expression }` → same response shape
  - Add a UI for this wherever the quantity-formula editor already exists for a product (same pattern, second field).
- **`ProductDetailResponse`** now also returns `linesCountExpression` and `linesCountFormulaVersion` — surface these anywhere the product's quantity formula is already shown.
- **`InvoiceProductResponse`** now also returns `linesCount`, `linesCountFormulaSnapshot`, `linesCountFormulaVersion` — display **`linesCount` only**, never the formula/snapshot fields, next to the product's quantity in the invoice detail/builder screen.
- **Item formulas** (Formula Builder, validate/evaluate) now accept a new reserved, case-sensitive variable key: **`LinesCount`**. Add it to the list of available variables shown in the item formula editor, alongside the product's own variables. It must **not** be offered as an option in the product's quantity-formula or lines-count-formula editors (those only accept product variables — the API will reject `LinesCount` there with `400`).
- **Variable creation form**: block the user from creating a variable with key `LinesCount` client-side (in addition to the server's `400 Variable.ReservedKey`) — validate this before submit, not just on error response.
- **Invoice add-product/recalculate flow**: `linesCount` now comes back from the server as part of the response — don't try to compute or input it client-side. No change needed to call order.

## 2. Delete actions (permission-gated)

Seven new delete endpoints, each requiring a specific permission claim (already exists per-role; check the current user's `permissions` claim, not their role name, to decide whether to show a delete button):

| Endpoint | Permission | Notes |
|---|---|---|
| `DELETE /api/Users/{id}` | `users:delete` | User can't delete themselves — handle `403 User.CannotDeleteSelf` with a clear message |
| `DELETE /api/Roles/{id}` | `roles:delete` | Built-in Admin/Member roles are protected — handle `403 Role.ProtectedRole` |
| `DELETE /api/v1/products/{id}` | `products:delete` | Soft delete |
| `DELETE /api/v1/products/{productId}/items/{id}` | `items:delete` | Soft delete |
| `DELETE /api/v1/variables/{id}` | `variables:delete` | Soft delete; blocked if variable is in use by any formula — surface that error clearly |
| `DELETE /api/v1/items/{itemId}/formula` | `formulas:delete` | Hard delete (config-only row; invoice snapshots are unaffected) |
| `DELETE /api/v1/invoices/{id}` | `invoices:delete` | **Draft-only** — handle `422 Invoice.NotDraft`; a Member can only delete invoices they created — handle `403 Invoice.AccessDenied` |

All return `204` on success. Add delete buttons/menu actions to each corresponding list/detail screen (Users, Roles, Products, Items, Variables, item Formula editor, Invoices), each gated on the relevant permission, and add confirmation dialogs before calling delete given these are destructive actions (even though most are soft deletes server-side, the UI should still confirm).

## 3. Invoice PDF item-table order (FYI, no action required on the PDF itself)

The server-generated PDF's item table is now ordered: **الصنف → العدد → اجمالي العدد → السعر → السعر الإجمالي**, with no status column and excluded lines hidden entirely (this is presentation-only, server-side, no API/DTO change). Worth a quick check that the **on-screen** invoice items table you already built matches this same column order/labels for consistency between screen and printed PDF — it should already, since this matches the earlier column-order request, but confirm.

## After implementing

Do a pass logged in as both Admin and Member to confirm delete buttons appear/disappear correctly per permission, and that the Lines Count fields display correctly on both the product catalog side and the invoice side.
