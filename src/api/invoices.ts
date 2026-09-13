import { api } from "./client";
import type {
  AddInvoiceProductRequest,
  CreateInvoiceRequest,
  InvoiceDetailResponse,
  InvoiceFilters,
  PagedInvoices,
  UpdateInvoiceHeaderRequest,
} from "./types";

export const invoiceKeys = {
  list: (filters: InvoiceFilters) => ["invoices", filters] as const,
  detail: (id: string) => ["invoices", id] as const,
};

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
): Promise<InvoiceDetailResponse> {
  const res = await api.put<InvoiceDetailResponse>(`/api/v1/invoices/${id}`, body);
  return res.data;
}

export async function addInvoiceProduct(
  id: string,
  body: AddInvoiceProductRequest,
): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>(`/api/v1/invoices/${id}/products`, body);
  return res.data;
}

export async function removeInvoiceProduct(id: string, invoiceProductId: string): Promise<void> {
  await api.delete(`/api/v1/invoices/${id}/products/${invoiceProductId}`);
}

export async function toggleInvoiceItemExcluded(
  id: string,
  invoiceProductId: string,
  invoiceItemId: string,
): Promise<void> {
  await api.patch(
    `/api/v1/invoices/${id}/products/${invoiceProductId}/items/${invoiceItemId}/exclude`,
  );
}

export async function recalculateInvoice(id: string): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>(`/api/v1/invoices/${id}/recalculate`);
  return res.data;
}

export async function finalizeInvoice(id: string): Promise<InvoiceDetailResponse> {
  const res = await api.post<InvoiceDetailResponse>(`/api/v1/invoices/${id}/finalize`);
  return res.data;
}

/** Shared PDF fetch (blob) — used by both download and print so the API call isn't duplicated. */
export async function fetchInvoicePdfBlob(id: string): Promise<Blob> {
  const res = await api.get(`/api/v1/invoices/${id}/pdf`, { responseType: "blob" });
  return new Blob([res.data], { type: "application/pdf" });
}

export async function downloadInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
  const blob = await fetchInvoicePdfBlob(id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${invoiceNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
