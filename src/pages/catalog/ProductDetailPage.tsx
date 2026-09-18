import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Power,
  Sigma,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createItem,
  deleteItem,
  deleteProduct,
  getProduct,
  listItems,
  productKeys,
  setProductVariables,
  toggleItemActive,
  toggleProductActive,
  updateItem,
} from "@/api/products";
import { listVariables, variableKeys } from "@/api/variables";
import { parseApiError } from "@/api/errors";
import type { AssignedProductVariable, ItemDetailResponse } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { FormulaEditor } from "@/components/formula/FormulaEditor";
import { BarnsCountFormulaEditor } from "@/components/formula/BarnsCountFormulaEditor";
import { LinesCountFormulaEditor } from "@/components/formula/LinesCountFormulaEditor";
import { QuantityFormulaEditor } from "@/components/formula/QuantityFormulaEditor";
import {
  ConfirmAction,
  EmptyState,
  ErrorCard,
  PageHeader,
  TableSkeleton,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney } from "@/lib/format";
import { QUANTITY_MULTIPLIER_LABELS } from "@/lib/labels";

const itemSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(200),
  code: z.string().max(100).optional().or(z.literal("")),
  salesPrice: z.coerce.number().min(0, "سعر البيع لا يكون سالبًا"),
  purchasePrice: z.coerce.number().min(0, "سعر الشراء لا يكون سالبًا"),
  quantityMultiplier: z.enum(["ProductQuantity", "LinesCount", "BarnsCount"], {
    message: "اختر مضاعف الكمية",
  }),
  displayOrder: z.coerce.number().min(0, "لا يقل عن 0"),
});

type ItemValues = z.infer<typeof itemSchema>;

// ── Items ───────────────────────────────────────────────────────────────────

function ItemDialog({
  productId,
  item,
  open,
  onOpenChange,
}: {
  productId: string;
  item?: ItemDetailResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = !!item;
  // Changing either price needs the extra `items:update-price` permission
  // (403 Item.PriceChangeNotAllowed). Renaming/reordering with unchanged
  // prices works without it — so lock the price inputs instead of the form.
  const canChangePrice = !isEdit || hasPermission("items:update-price");
  const form = useForm<ItemValues>({
    resolver: zodResolver(itemSchema) as unknown as Resolver<ItemValues>,
    defaultValues: {
      name: item?.name ?? "",
      code: item?.code ?? "",
      salesPrice: item?.salesPrice ?? 0,
      purchasePrice: item?.purchasePrice ?? 0,
      quantityMultiplier: item?.quantityMultiplier ?? "ProductQuantity",
      displayOrder: item?.displayOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ItemValues) => {
      // Without items:update-price the backend rejects ANY price diff
      // (403 Item.PriceChangeNotAllowed) — resend the stored prices so a
      // rename/reorder still succeeds.
      const body = {
        name: values.name.trim(),
        code: values.code?.trim() ? values.code.trim() : null,
        salesPrice: canChangePrice ? values.salesPrice : (item?.salesPrice ?? values.salesPrice),
        purchasePrice: canChangePrice ? values.purchasePrice : (item?.purchasePrice ?? values.purchasePrice),
        quantityMultiplier: values.quantityMultiplier,
        displayOrder: values.displayOrder,
      };
      return isEdit
        ? updateItem(productId, item.id, body)
        : createItem(productId, body);
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم حفظ الصنف" : "تم إنشاء الصنف");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["products", productId] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الصنف" : "صنف جديد"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="زجاج" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكود (اختياري)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        placeholder="GL-01"
                        className="tnum text-left"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الترتيب</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="tnum"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salesPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سعر البيع</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        className="tnum"
                        disabled={!canChangePrice}
                        title={canChangePrice ? undefined : "تغيير السعر يتطلب صلاحية items:update-price"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سعر الشراء</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        className="tnum"
                        disabled={!canChangePrice}
                        title={canChangePrice ? undefined : "تغيير السعر يتطلب صلاحية items:update-price"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="quantityMultiplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>مضاعف الكمية</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر مضاعف الكمية" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ProductQuantity">كمية المنتج (Product quantity)</SelectItem>
                      <SelectItem value="LinesCount">عدد الخطوط (Lines count)</SelectItem>
                      <SelectItem value="BarnsCount">عدد العنابر (Barns count)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    يحدد ما يُضرب به العدد (بعد التقريب لأعلى) لحساب إجمالي العدد.
                  </p>
                </FormItem>
              )}
            />
            {isEdit && !canChangePrice && (
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                لا تملك صلاحية تغيير الأسعار — يمكنك تعديل الاسم والترتيب فقط.
              </p>
            )}
            {form.watch("salesPrice") === form.watch("purchasePrice") && (
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                تنبيه: سعر البيع يساوي سعر الشراء — حدّث سعر الشراء إذا كان مختلفًا عن سعر البيع.
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-brand-800 hover:bg-brand-900"
              >
                {mutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canDeleteProduct = hasPermission("products:delete");
  const canDeleteItem = hasPermission("items:delete");

  const [showInactiveItems, setShowInactiveItems] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<
    ItemDetailResponse | undefined
  >(undefined);
  const [formulaItem, setFormulaItem] = useState<ItemDetailResponse | null>(
    null,
  );
  const [deleteItemTarget, setDeleteItemTarget] = useState<ItemDetailResponse | null>(null);
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);

  // Variable-assignment draft (admin editing state)
  const [draftVars, setDraftVars] = useState<AssignedProductVariable[] | null>(
    null,
  );
  const [varsDirty, setVarsDirty] = useState(false);
  const [addVarId, setAddVarId] = useState("");

  const productQuery = useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => getProduct(id),
    enabled: !!id,
  });
  const itemsQuery = useQuery({
    queryKey: productKeys.items(id, !showInactiveItems),
    queryFn: () => listItems(id, !showInactiveItems),
    enabled: !!id,
  });
  // Active-only catalog: disabled variables must never be selectable for
  // new product assignments (nor for new formula chips derived below).
  // Already-assigned variables stay visible everywhere (historical data).
  const catalogQuery = useQuery({
    queryKey: variableKeys.all(true),
    queryFn: () => listVariables(true),
  });

  useEffect(() => {
    if (productQuery.data && draftVars == null) {
      setDraftVars(
        [...productQuery.data.variables].sort(
          (a, b) => a.displayOrder - b.displayOrder,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery.data]);

  const toggleProductMutation = useMutation({
    mutationFn: () => toggleProductActive(id),
    onSuccess: () => {
      toast.success("تم تحديث حالة المنتج");
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const toggleItemMutation = useMutation({
    mutationFn: (itemId: string) => toggleItemActive(id, itemId),
    onSuccess: () => {
      toast.success("تم تحديث حالة الصنف");
      void queryClient.invalidateQueries({ queryKey: ["products", id] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(id, itemId),
    onSuccess: () => {
      toast.success("تم حذف الصنف");
      setDeleteItemTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["products", id] });
    },
    onError: (error) => {
      setDeleteItemTarget(null);
      toast.error(parseApiError(error).message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      toast.success("تم حذف المنتج");
      setDeleteProductOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/products");
    },
    onError: (error) => {
      setDeleteProductOpen(false);
      toast.error(parseApiError(error).message);
    },
  });

  const saveVarsMutation = useMutation({
    mutationFn: () =>
      setProductVariables(id, {
        variables: (draftVars ?? []).map((v, index) => ({
          variableId: v.variableId,
          isRequired: v.isRequired,
          displayOrder: index,
        })),
      }),
    onSuccess: () => {
      toast.success("تم حفظ متغيرات المنتج");
      setVarsDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  function moveVar(index: number, dir: -1 | 1) {
    setDraftVars((vars) => {
      if (!vars) return vars;
      const next = [...vars];
      const target = index + dir;
      if (target < 0 || target >= next.length) return vars;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setVarsDirty(true);
  }

  if (!id) return <ErrorCard message="رقم المنتج غير صالح" />;
  if (productQuery.isPending) return <TableSkeleton rows={8} cols={3} />;
  if (productQuery.isError || !productQuery.data) {
    return (
      <ErrorCard
        message={parseApiError(productQuery.error).message}
        onRetry={() => productQuery.refetch()}
      />
    );
  }

  const product = productQuery.data;
  const items = [...(itemsQuery.data ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const assignedIds = new Set((draftVars ?? []).map((v) => v.variableId));
  const unassigned = (catalogQuery.data ?? []).filter(
    (v) => !assignedIds.has(v.id),
  );
  // Catalog is active-only, so this is the set of variables selectable in
  // new formulas. Unknown while the catalog loads → editors fall back to all.
  const activeVariableIds = new Set((catalogQuery.data ?? []).map((v) => v.id));

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={product.description || "تفاصيل المنتج وأصنافه ومعادلاته"}
        actions={
          <>
            <Badge variant={product.isActive ? "default" : "secondary"}>
              {product.isActive ? "نشط" : "معطّل"}
            </Badge>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                disabled={toggleProductMutation.isPending}
                onClick={() => toggleProductMutation.mutate()}
              >
                <Power className="size-4" />
                {product.isActive ? "تعطيل" : "تفعيل"}
              </Button>
            )}
            {canDeleteProduct && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteProductOpen(true)}
              >
                <Trash2 className="size-4" />
                حذف المنتج
              </Button>
            )}
          </>
        }
      />

      {/* Variables assignment */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">متغيرات المنتج</CardTitle>
          {isAdmin && varsDirty && (
            <Button
              size="sm"
              disabled={saveVarsMutation.isPending}
              onClick={() => saveVarsMutation.mutate()}
              className="bg-brand-800 hover:bg-brand-900"
            >
              {saveVarsMutation.isPending ? "جارٍ الحفظ…" : "حفظ المتغيرات"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {(draftVars ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              لا توجد متغيرات مسندة لهذا المنتج.
            </p>
          )}
          {(draftVars ?? []).map((v, index) => {
            return (
              <div
                key={v.variableId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
              >
                <span className="tnum text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{v.name}</p>
                  <p className="tnum text-xs text-muted-foreground" dir="ltr">
                    {v.key}
                    {v.unit ? ` · ${v.unit}` : ""}
                  </p>
                </div>
                {isAdmin ? (
                  <>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={v.isRequired}
                        onChange={(e) => {
                          setDraftVars(
                            (vars) =>
                              vars?.map((x) =>
                                x.variableId === v.variableId
                                  ? { ...x, isRequired: e.target.checked }
                                  : x,
                              ) ?? null,
                          );
                          setVarsDirty(true);
                        }}
                        className="size-4 accent-brand-800"
                      />
                      مطلوب
                    </label>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={index === 0}
                        onClick={() => moveVar(index, -1)}
                        aria-label="تحريك لأعلى"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={index === (draftVars?.length ?? 1) - 1}
                        onClick={() => moveVar(index, 1)}
                        aria-label="تحريك لأسفل"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => {
                          setDraftVars(
                            (vars) =>
                              vars?.filter(
                                (x) => x.variableId !== v.variableId,
                              ) ?? null,
                          );
                          setVarsDirty(true);
                        }}
                        aria-label="إزالة"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  v.isRequired && <Badge variant="outline">مطلوب</Badge>
                )}
              </div>
            );
          })}
          {isAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={addVarId}
                onValueChange={(v) => setAddVarId(v as string)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      catalogQuery.isPending
                        ? "جارٍ تحميل المتغيرات…"
                        : "إضافة متغير من الكتالوج"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {unassigned.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!addVarId}
                onClick={() => {
                  const found = (catalogQuery.data ?? []).find(
                    (v) => v.id === addVarId,
                  );
                  if (!found) return;
                  setDraftVars((vars) => [
                    ...(vars ?? []),
                    {
                      variableId: found.id,
                      name: found.name,
                      key: found.key,
                      dataType: found.dataType,
                      unit: found.unit,
                      isRequired: true,
                      displayOrder: vars?.length ?? 0,
                    },
                  ]);
                  setAddVarId("");
                  setVarsDirty(true);
                }}
              >
                <Plus className="size-4" />
                إضافة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quantity formula (backend-calculated product quantity) */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">معادلة الكمية</CardTitle>
          {product.quantityFormulaVersion > 0 && (
            <Badge variant="secondary" className="tnum" dir="ltr">
              v{product.quantityFormulaVersion}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <QuantityFormulaEditor
            productId={id}
            variables={[...product.variables].sort(
              (a, b) => a.displayOrder - b.displayOrder,
            )}
            activeVariableIds={activeVariableIds}
            readOnly={!isAdmin}
          />
        </CardContent>
      </Card>

      {/* Lines-count formula (backend-calculated lines count / عدد الخطوط) */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">معادلة عدد الخطوط</CardTitle>
          {product.linesCountFormulaVersion > 0 && (
            <Badge variant="secondary" className="tnum" dir="ltr">
              v{product.linesCountFormulaVersion}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <LinesCountFormulaEditor
            productId={id}
            variables={[...product.variables].sort(
              (a, b) => a.displayOrder - b.displayOrder,
            )}
            activeVariableIds={activeVariableIds}
            readOnly={!isAdmin}
          />
        </CardContent>
      </Card>

      {/* Barns-count formula (backend-calculated barns count / عدد العنابر) */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">معادلة عدد العنابر</CardTitle>
          {product.barnsCountFormulaVersion > 0 && (
            <Badge variant="secondary" className="tnum" dir="ltr">
              v{product.barnsCountFormulaVersion}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <BarnsCountFormulaEditor
            productId={id}
            variables={[...product.variables].sort(
              (a, b) => a.displayOrder - b.displayOrder,
            )}
            activeVariableIds={activeVariableIds}
            readOnly={!isAdmin}
          />
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">الأصناف</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactiveItems((v) => !v)}
            >
              {showInactiveItems ? "إخفاء المعطّلة" : "عرض المعطّلة"}
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                className="bg-clay-600 hover:bg-clay-700"
                onClick={() => {
                  setEditingItem(undefined);
                  setItemDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                صنف جديد
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {itemsQuery.isPending ? (
            <div className="p-6">
              <TableSkeleton rows={4} cols={4} />
            </div>
          ) : itemsQuery.isError ? (
            <div className="p-6">
              <ErrorCard
                message={parseApiError(itemsQuery.error).message}
                onRetry={() => itemsQuery.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="لا توجد أصناف"
                hint="أضف أول صنف ثم عرّف معادلته"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead className="text-left">سعر البيع</TableHead>
                    <TableHead className="text-left">سعر الشراء</TableHead>
                    <TableHead>مضاعف الكمية</TableHead>
                    <TableHead>المعادلة</TableHead>
                    <TableHead>الحالة</TableHead>
                    {(isAdmin || canDeleteItem) && <TableHead className="w-40">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.name}</p>
                        {item.code && (
                          <p
                            className="tnum text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {item.code}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="tnum text-left">
                        {fmtMoney(item.salesPrice)}
                      </TableCell>
                      <TableCell className="tnum text-left">
                        {fmtMoney(item.purchasePrice)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {QUANTITY_MULTIPLIER_LABELS[item.quantityMultiplier] ?? item.quantityMultiplier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.formula ? (
                          <span className="flex items-center gap-1.5">
                            <code
                              className="tnum max-w-48 truncate rounded bg-brand-100 px-2 py-0.5 font-mono text-xs text-brand-900"
                              dir="ltr"
                              title={item.formula.expression}
                            >
                              {item.formula.expression}
                            </code>
                            <span className="tnum text-xs text-muted-foreground">
                              v{item.formula.version}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            بلا معادلة
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.isActive ? "default" : "secondary"}
                        >
                          {item.isActive ? "نشط" : "معطّل"}
                        </Badge>
                      </TableCell>
                      {(isAdmin || canDeleteItem) && (
                        <TableCell>
                          <div className="flex gap-1">
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setItemDialogOpen(true);
                                  }}
                                  aria-label="تعديل"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setFormulaItem(item)}
                                  aria-label="المعادلة"
                                  title="تحرير المعادلة"
                                >
                                  <Sigma className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={toggleItemMutation.isPending}
                                  onClick={() => toggleItemMutation.mutate(item.id)}
                                  aria-label={item.isActive ? "تعطيل" : "تفعيل"}
                                >
                                  <Power className="size-4" />
                                </Button>
                              </>
                            )}
                            {canDeleteItem && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteItemTarget(item)}
                                aria-label="حذف"
                                title="حذف الصنف"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ItemDialog
        key={editingItem?.id ?? "new"}
        productId={id}
        item={editingItem}
        open={itemDialogOpen}
        onOpenChange={(o) => {
          setItemDialogOpen(o);
          if (!o) setEditingItem(undefined);
        }}
      />

      <Dialog
        open={formulaItem != null}
        onOpenChange={(o) => !o && setFormulaItem(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>معادلة الصنف</DialogTitle>
          </DialogHeader>
          {formulaItem && (
            <FormulaEditor
              key={formulaItem.id}
              productId={id}
              itemId={formulaItem.id}
              itemName={formulaItem.name}
              variables={[...(productQuery.data?.variables ?? [])].sort(
                (a, b) => a.displayOrder - b.displayOrder,
              )}
              activeVariableIds={activeVariableIds}
              onSaved={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["products", id],
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={deleteItemTarget != null}
        onOpenChange={(o) => !o && setDeleteItemTarget(null)}
        title="حذف الصنف؟"
        description={
          deleteItemTarget ? `سيُحذف الصنف "${deleteItemTarget.name}" نهائيًا مع معادلته (حذف نهائي). لقطات الفواتير السابقة لا تتأثر.` : undefined
        }
        confirmLabel="حذف"
        danger
        busy={deleteItemMutation.isPending}
        onConfirm={() => deleteItemTarget && deleteItemMutation.mutate(deleteItemTarget.id)}
      />
      <ConfirmAction
        open={deleteProductOpen}
        onOpenChange={setDeleteProductOpen}
        title="حذف المنتج؟"
        description={`سيُحذف المنتج "${product.name}" نهائيًا مع أصنافه ومعادلاتها (حذف نهائي).`}
        confirmLabel="حذف"
        danger
        busy={deleteProductMutation.isPending}
        onConfirm={() => deleteProductMutation.mutate()}
      />
    </div>
  );
}
