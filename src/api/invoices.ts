import axios from "axios";
import { api } from "./client";
import type {
  AddInvoiceProductRequest,
  CreateInvoiceRequest,
  InvoiceDetailResponse,
  InvoiceFilters,
  InvoicePdfMode,
  InvoiceShareResponse,
  PagedInvoices,
  ReceivedInvoiceListResponse,
  ReceivedInvoicesFilterRequest,
  ShareInvoiceRequest,
  UpdateInvoiceHeaderRequest,
} from "./types";

export const invoiceKeys = {
  list: (filters: InvoiceFilters) => ["invoices", filters] as const,
  detail: (id: string) => ["invoices", id] as const,
  shares: (id: string) => ["invoices", id, "shares"] as const,
  received: (filters: ReceivedInvoicesFilterRequest) =>
    ["invoices", "received", filters] as const,
};

/**
 * Builds the optimistic-concurrency header from the last fetched `rowVersion`.
 * Omitted when absent (backward compatible — the server skips the check).
 */
function ifMatchHeaders(rowVersion?: string): Record<string, string> {
  return rowVersion ? { "If-Match": rowVersion } : {};
}

function toParams(filters: InvoiceFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.customerName?.trim()) params.CustomerName = filters.customerName.trim();
  if (filters.status && filters.status !== "all") params.Status = filters.status;
  if (filters.type && filters.type !== "all") params.Type = filters.type;
  if (filters.dateFrom) params.DateFrom = filters.dateFrom;
  if (filters.dateTo) params.DateTo = filters.dateTo;
  params.Page = filters.page ?? 1;
  params.PageSize = filters.pageSize ?? 20;
  return params;
}

export async function listInvoices(filters: InvoiceFilters): Promise<PagedInvoices> {
  const res = await api.get<PagedInvoices>("/api/v1/invoices", { params: toParams(filters) });
  return res.data;
}

export async function getInvoice(id: string): Promise<InvoiceDetailResponse> {
  const res = await api.get<InvoiceDetailResponse>(`/api/v1/invoices/${id}`);
  return res.data;
}

export async function createInvoice(body: CreateInvoiceRequest): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>("/api/v1/invoices", body);
  return res.data;
}

export async function updateInvoiceHeader(
  id: string,
  body: UpdateInvoiceHeaderRequest,
  rowVersion?: string,
): Promise<InvoiceDetailResponse> {
  const res = await api.put<InvoiceDetailResponse>(`/api/v1/invoices/${id}`, body, {
    headers: ifMatchHeaders(rowVersion),
  });
  return res.data;
}

export async function addInvoiceProduct(
  id: string,
  body: AddInvoiceProductRequest,
  rowVersion?: string,
): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>(`/api/v1/invoices/${id}/products`, body, {
    headers: ifMatchHeaders(rowVersion),
  });
  return res.data;
}

export async function removeInvoiceProduct(
  id: string,
  invoiceProductId: string,
  rowVersion?: string,
): Promise<void> {
  await api.delete(`/api/v1/invoices/${id}/products/${invoiceProductId}`, {
    headers: ifMatchHeaders(rowVersion),
  });
}

export async function toggleInvoiceItemExcluded(
  id: string,
  invoiceProductId: string,
  invoiceItemId: string,
  rowVersion?: string,
): Promise<void> {
  await api.patch(
    `/api/v1/invoices/${id}/products/${invoiceProductId}/items/${invoiceItemId}/exclude`,
    undefined,
    { headers: ifMatchHeaders(rowVersion) },
  );
}

export async function recalculateInvoice(
  id: string,
  rowVersion?: string,
): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>(
    `/api/v1/invoices/${id}/recalculate`,
    undefined,
    { headers: ifMatchHeaders(rowVersion) },
  );
  return res.data;
}

export async function finalizeInvoice(
  id: string,
  rowVersion?: string,
): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>(
    `/api/v1/invoices/${id}/finalize`,
    undefined,
    { headers: ifMatchHeaders(rowVersion) },
  );
  return res.data;
}

/**
 * Hard delete (header + product/item lines cascade). Requires `invoices:delete`.
 * Any status is deletable, including Finalized. Ownership still applies:
 * a Member deleting someone else's invoice fails with `403 Invoice.AccessDenied`.
 * Returns 204 with an empty body; a second delete returns 404.
 */
export async function deleteInvoice(id: string, rowVersion?: string): Promise<void> {
  await api.delete(`/api/v1/invoices/${id}`, { headers: ifMatchHeaders(rowVersion) });
}

/** Shared PDF fetch (blob) — used by both download and print so the API call isn't duplicated. */
export async function fetchInvoicePdfBlob(
  id: string,
  mode: InvoicePdfMode = "Full",
): Promise<Blob> {
  return (await fetchInvoicePdf(id, mode)).blob;
}

interface FetchedInvoicePdf {
  blob: Blob;
  /** Filename from the `Content-Disposition` response header, when present. */
  serverFileName: string | null;
}

async function fetchInvoicePdf(id: string, mode: InvoicePdfMode): Promise<FetchedInvoicePdf> {
  let res;
  try {
    res = await api.get<Blob>(`/api/v1/invoices/${id}/pdf`, {
      params: { mode },
      responseType: "blob",
    });
  } catch (error) {
    throw await withParsedBlobError(error);
  }
  return {
    blob: new Blob([res.data], { type: "application/pdf" }),
    serverFileName: parseContentDispositionFileName(res.headers?.["content-disposition"]),
  };
}

/**
 * Parses `attachment; filename=...` / `filename*=UTF-8''...` (RFC 5987).
 * Returns null when absent or unparseable (caller falls back to the pattern).
 */
function parseContentDispositionFileName(header: unknown): string | null {
  if (typeof header !== "string" || !header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  if (!match) return null;
  const raw = match[1].trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * PDF failures arrive as `application/problem+json` inside a Blob
 * (responseType: 'blob'), which parseApiError() can't read. Swap the parsed
 * JSON back onto the response so toasts show the mapped Arabic message
 * (e.g. 400 Invoice.InvalidPdfMode) instead of a generic failure.
 */
async function withParsedBlobError(error: unknown): Promise<unknown> {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        if (text && error.response) error.response.data = JSON.parse(text);
      } catch {
        // Keep the raw blob — parseApiError() falls back to a generic message.
      }
    }
  }
  return error;
}

function pdfFileName(invoiceNumber: string, mode: InvoicePdfMode): string {
  const suffix =
    mode === "Factory" ? "-factory" : mode === "WithoutItems" ? "-summary" : "";
  return `${invoiceNumber}${suffix}.pdf`;
}

export async function downloadInvoicePdf(
  id: string,
  invoiceNumber: string,
  mode: InvoicePdfMode = "Full",
): Promise<void> {
  const { blob, serverFileName } = await fetchInvoicePdf(id, mode);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  // Prefer the server filename (Content-Disposition); fall back to the pattern.
  anchor.download = serverFileName ?? pdfFileName(invoiceNumber, mode);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Back-compat alias used by print paths — always the full invoice. */
export async function getInvoicePdf(id: string, mode: InvoicePdfMode = "Full"): Promise<Blob> {
  return fetchInvoicePdfBlob(id, mode);
}

// ── Sharing ─────────────────────────────────────────────────────────────────

/** Share an invoice. Anyone with access (owner, recipient, Admin) + `invoices:share`, any status. */
export async function shareInvoice(
  id: string,
  body: ShareInvoiceRequest,
): Promise<InvoiceShareResponse> {
  const res = await api.post<InvoiceShareResponse>(`/api/v1/invoices/${id}/share`, body);
  return res.data;
}

/** Revoke a share: owner/Admin (any grant), the granting user, or the recipient. 204 empty body. */
export async function unshareInvoice(id: string, sharedWithUserId: string): Promise<void> {
  await api.delete(`/api/v1/invoices/${id}/share/${encodeURIComponent(sharedWithUserId)}`);
}

function toReceivedParams(
  filters: ReceivedInvoicesFilterRequest,
): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.fromUserId?.trim()) params.fromUserId = filters.fromUserId.trim();
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.period) params.period = filters.period;
  params.page = filters.page ?? 1;
  params.pageSize = filters.pageSize ?? 20;
  return params;
}

/** Invoices shared with the current user. Filters apply to `sharedAt` (receipt time). */
export async function getReceivedInvoices(
  filters: ReceivedInvoicesFilterRequest,
): Promise<ReceivedInvoiceListResponse> {
  const res = await api.get<ReceivedInvoiceListResponse>("/api/v1/invoices/received", {
    params: toReceivedParams(filters),
  });
  return res.data;
}
