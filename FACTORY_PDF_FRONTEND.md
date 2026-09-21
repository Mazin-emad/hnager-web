# Factory Invoice PDF — Frontend Integration Guide

A third PDF printing option was added to the backend: **Factory invoice (فاتورة مصنع)**.
It prints **item names + their total quantities only** — no prices, no invoice totals, nothing else.

All backend changes are backward compatible. `Full` and `WithoutItems` behavior is unchanged.

---

## 1. Endpoint (unchanged URL, new `mode` value)

```http
GET /api/v1/invoices/{id}/pdf?mode=Factory
```

| Piece | Type | Details |
|---|---|---|
| `id` | `string (GUID, UUID v4)` — route param | The invoice id, e.g. `3fa85f64-5717-4562-b3fc-2c963f66afa6`. Required. |
| `mode` | `string \| number` — query param, optional | PDF variant. Accepts the **enum name** (`Full`, `WithoutItems`, `Factory`) **or** its numeric value (`1`, `2`, `3`). ASP.NET Core model binding handles both. **Default when omitted = `Full`.** |
| Auth | `Authorization: Bearer <JWT>` header | Required, same as before. |
| Permission | `invoices:pdf` | Required, same as before. Owner, admin, or share-recipient may print; strangers get `403`/`404`. |
| Success response | `200 OK`, `Content-Type: application/pdf` | Binary PDF file (download it as a blob, do **not** parse as JSON). |
| Filename | `Content-Disposition: attachment; filename=...` | `"{InvoiceNumber}-factory.pdf"` (see §3). |

### The three modes

| `mode` value | Name sent by frontend | Arabic title in PDF | File suffix | Contents |
|---|---|---|---|---|
| `1` / `Full` (default) | `?mode=Full` (or omit `mode`) | فاتورة | `{InvoiceNumber}.pdf` | Complete invoice: header, products, full 5-column item table, totals, notes. **Unchanged.** |
| `2` / `WithoutItems` | `?mode=WithoutItems` | فاتورة | `{InvoiceNumber}-summary.pdf` | Product-level summary only, no item data. **Unchanged.** |
| **`3` / `Factory` (NEW)** | **`?mode=Factory`** | **فاتورة مصنع** | **`{InvoiceNumber}-factory.pdf`** | **Item names + total quantities only (see §2).** |

### Error for a bad `mode`

Anything other than `Full` / `WithoutItems` / `Factory` (or `1` / `2` / `3`) returns:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Invalid PDF mode. Supported values: Full, WithoutItems, Factory.",
  "status": 400,
  "code": "Invoice.InvalidPdfMode"
}
```

- `code` is `string`, always `"Invoice.InvalidPdfMode"` for this case.
- Other statuses are unchanged: `401` (no/invalid token), `403` (no `invoices:pdf` permission or not your invoice), `404` (invoice id not found).

---

## 2. Exactly what the Factory PDF contains

This is a fixed server-side layout. The frontend sends **no body and no extra params** — just `mode=Factory`.

**Header (minimal identification only):**

| Shown | Hidden |
|---|---|
| Title `فاتورة مصنع` | Invoice type (`النوع`) |
| Invoice number (`# INV-...`) | Status (`الحالة`) |
| Date (`التاريخ`, e.g. `12 سبتمبر 2026`) | Day (`اليوم`) |
| | Customer name (`العميل`) |
| | Sales rep (`مندوب المبيعات`) |

**Body — one block per product:**

- Product line shows **only** `ProductNameSnapshot` (`string`) — no `الكمية`, no `عدد الخطوط`, no `عدد العنابر`, no input values.
- Followed by a **2-column table**:

| Column (RTL) | Source field in `GET /api/v1/invoices/{id}` JSON | Type | Format |
|---|---|---|---|
| `الصنف` (item name) | `products[].items[].itemNameSnapshot` | `string` | as-is |
| `اجمالي العدد` (total quantity) | `products[].items[].quantitySnapshot` | `number (decimal)` | Western digits (`0-9`), up to 4 decimals, trailing zeros trimmed (`72.0000` → `72`) |

- Items with `isExcluded == true` (`boolean`) are **hidden** (same rule as Full mode).
- The raw fractional quantity (`itemQuantitySnapshot`) and the `العدد` column are **not** shown — only the ceiled total (`quantitySnapshot`).
- **No** unit price, **no** line total, **no** subtotal / discount / grand total, **no** notes.

**Footer:** unchanged (`تم الإنشاء في <date>`, `صفحة X من Y`). All digits in the document are Western (`0-9`).

> If the factory paper still shows a customer name or price after this update, the request did not use `mode=Factory` (or the backend deploy is stale) — the Factory template contains no such fields.

---

## 3. Response filename contract

| `mode` | Filename pattern | `InvoiceNumber` type | Example |
|---|---|---|---|
| `Full` | `{InvoiceNumber}.pdf` | `string` (e.g. `INV-2026-0001`) | `INV-2026-0001.pdf` |
| `WithoutItems` | `{InvoiceNumber}-summary.pdf` | `string` | `INV-2026-0001-summary.pdf` |
| `Factory` | `{InvoiceNumber}-factory.pdf` | `string` | `INV-2026-0001-factory.pdf` |

Prefer reading the real filename from the `Content-Disposition` response header, with the pattern above as fallback.

---

## 4. Frontend implementation

### 4.1 TypeScript enum + download helper

```ts
// Mirror of backend enum InvoicePdfMode (Entities/Enums.cs)
export enum InvoicePdfMode {
  Full = 1,
  WithoutItems = 2,
  Factory = 3, // NEW — فاتورة مصنع
}

export type InvoicePdfModeParam = keyof typeof InvoicePdfMode | InvoicePdfMode;
// Recommended: always send the NAME, e.g. "Factory", for readability.

const API_BASE = "https://<your-api-host>"; // e.g. http://localhost:5119

function pdfUrl(invoiceId: string, mode?: InvoicePdfModeParam): string {
  const id = encodeURIComponent(invoiceId); // invoiceId: string (GUID)
  // Omit the param entirely for Full, or send it explicitly — both work.
  return mode === undefined || mode === "Full" || mode === InvoicePdfMode.Full
    ? `${API_BASE}/api/v1/invoices/${id}/pdf`
    : `${API_BASE}/api/v1/invoices/${id}/pdf?mode=${encodeURIComponent(String(mode))}`;
}

export async function downloadInvoicePdf(
  invoiceId: string,          // string (GUID)
  mode: InvoicePdfModeParam = "Full",
  token: string,              // string (JWT)
): Promise<void> {
  const res = await fetch(pdfUrl(invoiceId, mode), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // 400 → invalid mode; 401 → login expired; 403 → no access; 404 → not found.
    // Error body is RFC-7807 problem+json: { title: string, status: number, code: string }
    const problem = await res.json().catch(() => null);
    throw new Error(problem?.title ?? `PDF download failed (${res.status})`);
  }

  const blob = await res.blob(); // MIME: application/pdf — keep as Blob, do not .json()
  const objectUrl = URL.createObjectURL(blob);

  // Prefer server filename; fallback to the client-side pattern.
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const fallbackSuffix =
    mode === "Factory" || mode === InvoicePdfMode.Factory ? "-factory" :
    mode === "WithoutItems" || mode === InvoicePdfMode.WithoutItems ? "-summary" : "";
  const fileName = match ? decodeURIComponent(match[1].trim()) : `invoice${fallbackSuffix}.pdf`;

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// Usage — the third print button:
await downloadInvoicePdf(invoiceId, "Factory", accessToken);       // or InvoicePdfMode.Factory
await downloadInvoicePdf(invoiceId, "Full", accessToken);          // existing button
await downloadInvoicePdf(invoiceId, "WithoutItems", accessToken);  // existing button
```

### 4.2 Suggested buttons (labels)

| Button | `mode` to send | Suggested label |
|---|---|---|
| Full invoice | `Full` (or omit param) | `طباعة الفاتورة` |
| Summary | `WithoutItems` | `طباعة ملخص` |
| **Factory (new)** | **`Factory`** | **`فاتورة مصنع`** |

### 4.3 Quick manual test (curl)

```bash
# Full (default)
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:5119/api/v1/invoices/<GUID>/pdf" -o full.pdf

# Summary
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:5119/api/v1/invoices/<GUID>/pdf?mode=WithoutItems" -o summary.pdf

# NEW — Factory (names + total quantities only)
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:5119/api/v1/invoices/<GUID>/pdf?mode=Factory" -o factory.pdf

# Numeric form also works
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:5119/api/v1/invoices/<GUID>/pdf?mode=3" -o factory.pdf
```

---

## 5. Backend changes (for reference — no frontend action needed)

| File | Change |
|---|---|
| `Invoice Calculator.api/Entities/Enums.cs` | `InvoicePdfMode` gained `Factory = 3` (+ XML doc). |
| `Invoice Calculator.api/Services/Invoices/InvoicePdfService.cs` | `ComposeHeader` now takes `mode`; Factory header = `فاتورة مصنع` + number + date only. `ComposeContent` has a Factory branch: product-name-only header + 2-column (`الصنف` \| `اجمالي العدد` from `QuantitySnapshot`) table; totals and notes sections are skipped in Factory mode. Full/WithoutItems paths untouched. |
| `Invoice Calculator.api/Controllers/InvoicesController.cs` | `GET /api/v1/invoices/{id}/pdf` filename suffix: `Factory → "-factory"` (switch; existing `"-summary"`/default unchanged). Mode validation (`Enum.IsDefined`) automatically accepts the new value. |
| `Invoice Calculator.api/Errors/InvoiceErrors.cs` | `InvalidPdfMode` message updated to `"Supported values: Full, WithoutItems, Factory."` |
| `Invoice Calculator.Tests/InvoicePdfServiceTests.cs` | Added `Generate_Factory_ProducesPdf_WithItemsOnly` test. |

No database migration (PDF mode is a query param only, nothing stored). No permission changes. No changes to `GET /api/v1/invoices/{id}` JSON.

---

## 6. Checklist for the frontend dev

- [ ] Add `Factory = 3` to the local `InvoicePdfMode` enum/type.
- [ ] Add a third print button `فاتورة مصنع` calling `GET /api/v1/invoices/{id}/pdf?mode=Factory`.
- [ ] Handle the response as `Blob` (`application/pdf`), filename `*-factory.pdf`.
- [ ] Keep existing `Full` / `WithoutItems` calls exactly as they are.
- [ ] Show the `Invoice.InvalidPdfMode` problem message if a `400` comes back (means a typo in `mode`).
