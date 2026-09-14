import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createVariable,
  deleteVariable,
  listVariables,
  toggleVariableActive,
  updateVariable,
  variableKeys,
} from "@/api/variables";
import { parseApiError } from "@/api/errors";
import { LINES_COUNT_KEY, type VariableResponse } from "@/api/types";
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

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const variableSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(200),
  key: z
    .string()
    .min(1, "المفتاح مطلوب")
    .max(100)
    .regex(KEY_PATTERN, "حروف إنجليزية وأرقام و_ فقط، ويبدأ بحرف")
    // Reserved server-side for the invoice lines-count value (400 Variable.ReservedKey).
    .refine((k) => k.trim() !== LINES_COUNT_KEY, {
      message: `المفتاح ${LINES_COUNT_KEY} محجوز للنظام ولا يمكن استخدامه`,
    }),
  unit: z.string().max(100).optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  displayOrder: z.coerce.number().min(0, "لا يقل عن 0"),
});

type VariableValues = z.infer<typeof variableSchema>;

function VariableDialog({
  variable,
  open,
  onOpenChange,
}: {
  variable?: VariableResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!variable;
  const form = useForm<VariableValues>({
    resolver: zodResolver(variableSchema) as unknown as Resolver<VariableValues>,
    defaultValues: {
      name: variable?.name ?? "",
      key: variable?.key ?? "",
      unit: variable?.unit ?? "",
      description: variable?.description ?? "",
      displayOrder: variable?.displayOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: VariableValues) => {
      const clean = {
        name: values.name.trim(),
        unit: values.unit?.trim() ? values.unit.trim() : null,
        description: values.description?.trim() ? values.description.trim() : null,
        displayOrder: values.displayOrder,
      };
      return isEdit
        ? updateVariable(variable.id, clean)
        : createVariable({ ...clean, key: values.key.trim(), dataType: "Number" });
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم حفظ المتغير" : "تم إنشاء المتغير");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["variables"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل المتغير" : "متغير جديد"}</DialogTitle>
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
                    <Input {...field} placeholder="العرض" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المفتاح (يُستخدم في المعادلات)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      dir="ltr"
                      placeholder="width"
                      className="tnum text-left"
                      disabled={isEdit}
                    />
                  </FormControl>
                  <FormMessage />
                  {isEdit && (
                    <p className="text-xs text-muted-foreground">المفتاح ونوع البيانات لا يمكن تغييرهما.</p>
                  )}
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوحدة (اختياري)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="م" />
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
            </div>
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

export function VariablesPage() {
  const { isAdmin, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VariableResponse | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<VariableResponse | null>(null);

  const variablesQuery = useQuery({
    queryKey: variableKeys.all(!showInactive),
    queryFn: () => listVariables(!showInactive),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleVariableActive,
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      void queryClient.invalidateQueries({ queryKey: ["variables"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVariable(id),
    onSuccess: () => {
      toast.success("تم حذف المتغير");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["variables"] });
    },
    onError: (error) => {
      setDeleteTarget(null);
      toast.error(parseApiError(error).message);
    },
  });

  const canDelete = hasPermission("variables:delete");

  const variables = [...(variablesQuery.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div>
      <PageHeader
        title="المتغيرات"
        subtitle="مفاتيح الإدخال المستخدمة في معادلات الأصناف"
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
              متغير جديد
            </Button>
          ) : undefined
        }
      />

      <VariableDialog
        key={editing?.id ?? "new"}
        variable={editing}
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

      {variablesQuery.isPending ? (
        <TableSkeleton rows={6} cols={5} />
      ) : variablesQuery.isError ? (
        <ErrorCard message={parseApiError(variablesQuery.error).message} onRetry={() => variablesQuery.refetch()} />
      ) : variables.length === 0 ? (
        <EmptyState title="لا توجد متغيرات" hint="أنشئ أول متغير ليُستخدم في المعادلات" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المفتاح</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>الحالة</TableHead>
                  {(isAdmin || canDelete) && <TableHead className="w-32">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>
                      <code className="tnum rounded bg-muted px-2 py-0.5 text-xs" dir="ltr">
                        {v.key}
                      </code>
                    </TableCell>
                    <TableCell>{v.unit ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.isActive ? "default" : "secondary"}>
                        {v.isActive ? "نشط" : "معطّل"}
                      </Badge>
                    </TableCell>
                    {(isAdmin || canDelete) && (
                      <TableCell>
                        <div className="flex gap-1">
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditing(v);
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
                                onClick={() => toggleMutation.mutate(v.id)}
                                aria-label={v.isActive ? "تعطيل" : "تفعيل"}
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
                              onClick={() => setDeleteTarget(v)}
                              aria-label="حذف"
                              title="حذف المتغير"
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
        title="حذف المتغير؟"
        description={
          deleteTarget
            ? `سيُعطّل المتغير "${deleteTarget.name}" (${deleteTarget.key}) — حذف مرن (يبقى الصف، وحذف المعطّل مجددًا آمن). يُمنع التعطيل إذا كان المفتاح مستخدمًا في معادلة نشطة.`
            : undefined
        }
        confirmLabel="حذف"
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
