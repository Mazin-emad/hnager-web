import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  deleteProduct,
  listProducts,
  productKeys,
  toggleProductActive,
  updateProduct,
} from "@/api/products";
import { parseApiError } from "@/api/errors";
import type { ProductSummaryResponse } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { ConfirmAction, EmptyState, ErrorCard, PageHeader, TableSkeleton } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const productSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(200),
  description: z.string().max(500).optional().or(z.literal("")),
  displayOrder: z.coerce.number().min(0, "لا يقل عن 0"),
});

type ProductValues = z.infer<typeof productSchema>;

function ProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product?: ProductSummaryResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!product;
  const form = useForm<ProductValues>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductValues>,
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      displayOrder: product?.displayOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProductValues) => {
      const body = {
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
        displayOrder: values.displayOrder,
      };
      return isEdit ? updateProduct(product.id, body) : createProduct(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم حفظ المنتج" : "تم إنشاء المنتج");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل المنتج" : "منتج جديد"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="شباك ألومنيوم" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف (اختياري)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="وصف مختصر" />
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
                    <Input {...field} type="number" min={0} inputMode="numeric" className="tnum" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} className="bg-brand-800 hover:bg-brand-900">
                {mutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductSummaryResponse | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProductSummaryResponse | null>(null);

  const productsQuery = useQuery({
    queryKey: productKeys.all(!showInactive),
    queryFn: () => listProducts(!showInactive),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleProductActive,
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      toast.success("تم حذف المنتج");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      setDeleteTarget(null);
      toast.error(parseApiError(error).message);
    },
  });

  const canDelete = hasPermission("products:delete");

  const products = [...(productsQuery.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div>
      <PageHeader
        title="المنتجات"
        subtitle="كتالوج المنتجات وأصنافها ومعادلاتها"
        actions={
          isAdmin ? (
            <Button
              className="bg-clay-600 hover:bg-clay-700"
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              منتج جديد
            </Button>
          ) : undefined
        }
      />

      <ProductDialog
        key={editing?.id ?? "new"}
        product={editing}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(undefined);
        }}
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant={showInactive ? "default" : "outline"} size="sm" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? "إخفاء المعطّلة" : "عرض المعطّلة أيضًا"}
        </Button>
      </div>

      {productsQuery.isPending ? (
        <TableSkeleton rows={6} cols={4} />
      ) : productsQuery.isError ? (
        <ErrorCard message={parseApiError(productsQuery.error).message} onRetry={() => productsQuery.refetch()} />
      ) : products.length === 0 ? (
        <EmptyState title="لا توجد منتجات" hint="أنشئ أول منتج ثم أضف أصنافه ومعادلاته" icon={<Package className="size-6" />} />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead className="text-left">الأصناف النشطة</TableHead>
                    <TableHead>الحالة</TableHead>
                    {(isAdmin || canDelete) && <TableHead className="w-32">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-brand-50"
                    onClick={() => navigate(`/products/${p.id}`)}
                  >
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="tnum text-left">{p.activeItemCount}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "نشط" : "معطّل"}
                      </Badge>
                    </TableCell>
                    {(isAdmin || canDelete) && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditing(p);
                                  setDialogOpen(true);
                                }}
                                aria-label="تعديل"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={toggleMutation.isPending}
                                onClick={() => toggleMutation.mutate(p.id)}
                                aria-label={p.isActive ? "تعطيل" : "تفعيل"}
                              >
                                <Power className="size-4" />
                              </Button>
                            </>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(p)}
                              aria-label="حذف"
                              title="حذف المنتج"
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
          </CardContent>
        </Card>
      )}

      <ConfirmAction
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="حذف المنتج؟"
        description={
          deleteTarget ? `سيُحذف المنتج "${deleteTarget.name}" نهائيًا مع أصنافه ومعادلاتها (حذف نهائي).` : undefined
        }
        confirmLabel="حذف"
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
