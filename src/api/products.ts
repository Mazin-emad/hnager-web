import { api } from "./client";
import type {
  CreateItemRequest,
  CreateProductRequest,
  ItemDetailResponse,
  LinesCountFormulaResponse,
  ProductDetailResponse,
  ProductSummaryResponse,
  QuantityFormulaResponse,
  SetProductVariablesRequest,
  UpdateItemRequest,
  UpdateProductRequest,
  UpsertLinesCountFormulaRequest,
  UpsertQuantityFormulaRequest,
} from "./types";

export const productKeys = {
  all: (activeOnly: boolean) => ["products", activeOnly] as const,
  detail: (id: string) => ["products", id] as const,
  configuration: (id: string) => ["products", id, "configuration"] as const,
  quantityFormula: (id: string) => ["products", id, "quantity-formula"] as const,
  linesCountFormula: (id: string) => ["products", id, "lines-count-formula"] as const,
  items: (productId: string, activeOnly: boolean) =>
    ["products", productId, "items", activeOnly] as const,
};

export async function listProducts(activeOnly = false): Promise<ProductSummaryResponse[]> {
  const res = await api.get<ProductSummaryResponse[]>("/api/v1/products", {
    params: { activeOnly },
  });
  return res.data;
}

export async function getProduct(id: string): Promise<ProductDetailResponse> {
  const res = await api.get<ProductDetailResponse>(`/api/v1/products/${id}`);
  return res.data;
}

/** Active-only view of the product — feeds the invoice builder. */
export async function getProductConfiguration(id: string): Promise<ProductDetailResponse> {
  const res = await api.get<ProductDetailResponse>(`/api/v1/products/${id}/configuration`);
  return res.data;
}

export async function createProduct(body: CreateProductRequest): Promise<ProductSummaryResponse> {
  const res = await api.post<ProductSummaryResponse>("/api/v1/products", body);
  return res.data;
}

export async function updateProduct(
  id: string,
  body: UpdateProductRequest,
): Promise<ProductSummaryResponse> {
  const res = await api.put<ProductSummaryResponse>(`/api/v1/products/${id}`, body);
  return res.data;
}

/** Hard delete (items → formulas and product-variable links cascade). Requires `products:delete`. 204 empty body; second delete 404. */
export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/api/v1/products/${id}`);
}

export async function toggleProductActive(id: string): Promise<void> {
  await api.patch(`/api/v1/products/${id}/toggle-active`);
}

export async function setProductVariables(
  id: string,
  body: SetProductVariablesRequest,
): Promise<void> {
  await api.put(`/api/v1/products/${id}/variables`, body);
}

/** Current quantity formula for the product settings page (prefill the editor). */
export async function getQuantityFormula(id: string): Promise<QuantityFormulaResponse> {
  const res = await api.get<QuantityFormulaResponse>(`/api/v1/products/${id}/quantity-formula`);
  return res.data;
}

/** Admin "Save formula" — returns the saved shape with bumped version on real change. */
export async function updateQuantityFormula(
  id: string,
  body: UpsertQuantityFormulaRequest,
): Promise<QuantityFormulaResponse> {
  const res = await api.put<QuantityFormulaResponse>(
    `/api/v1/products/${id}/quantity-formula`,
    body,
  );
  return res.data;
}

/** Current lines-count formula for the product settings page (prefill the editor). */
export async function getLinesCountFormula(id: string): Promise<LinesCountFormulaResponse> {
  const res = await api.get<LinesCountFormulaResponse>(`/api/v1/products/${id}/lines-count-formula`);
  return res.data;
}

/** Admin "Save formula" — returns the saved shape with bumped version on real change. */
export async function updateLinesCountFormula(
  id: string,
  body: UpsertLinesCountFormulaRequest,
): Promise<LinesCountFormulaResponse> {
  const res = await api.put<LinesCountFormulaResponse>(
    `/api/v1/products/${id}/lines-count-formula`,
    body,
  );
  return res.data;
}

export async function listItems(
  productId: string,
  activeOnly = false,
): Promise<ItemDetailResponse[]> {
  const res = await api.get<ItemDetailResponse[]>(`/api/v1/products/${productId}/items`, {
    params: { activeOnly },
  });
  return res.data;
}

export async function getItem(productId: string, id: string): Promise<ItemDetailResponse> {
  const res = await api.get<ItemDetailResponse>(`/api/v1/products/${productId}/items/${id}`);
  return res.data;
}

export async function createItem(
  productId: string,
  body: CreateItemRequest,
): Promise<ItemDetailResponse> {
  const res = await api.post<ItemDetailResponse>(`/api/v1/products/${productId}/items`, body);
  return res.data;
}

export async function updateItem(
  productId: string,
  id: string,
  body: UpdateItemRequest,
): Promise<ItemDetailResponse> {
  const res = await api.put<ItemDetailResponse>(
    `/api/v1/products/${productId}/items/${id}`,
    body,
  );
  return res.data;
}

export async function toggleItemActive(productId: string, id: string): Promise<void> {
  await api.patch(`/api/v1/products/${productId}/items/${id}/toggle-active`);
}

/** Hard delete of the item and its 1:1 formula row (historical invoices keep snapshots). Requires `items:delete`. 204 empty body; second delete 404. */
export async function deleteItem(productId: string, id: string): Promise<void> {
  await api.delete(`/api/v1/products/${productId}/items/${id}`);
}
