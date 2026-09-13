import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  roleKeys,
  toggleRoleStatus,
  updateRole,
} from "@/api/roles";
import { parseApiError } from "@/api/errors";
import type { RoleListItem } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { RequirePermission } from "@/auth/RequirePermission";
import { KNOWN_PERMISSIONS, permissionLabel } from "@/lib/labels";
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

const roleSchema = z.object({
  name: z.string().min(3, "3 أحرف على الأقل").max(200),
  permissions: z.array(z.string()).min(1, "اختر صلاحية واحدة على الأقل"),
});

type RoleValues = z.infer<typeof roleSchema>;

function PermissionCheckboxes({
  value,
  onChange,
}: {
  value: string[];
  onChange: (permissions: string[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {KNOWN_PERMISSIONS.map((p) => {
        const checked = value.includes(p);
        return (
          <label
            key={p}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              checked ? "border-brand-800 bg-brand-50" : "border-border hover:border-brand-400"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...value, p] : value.filter((x) => x !== p),
                )
              }
              className="size-4 accent-brand-800"
            />
            {permissionLabel(p)}
          </label>
        );
      })}
    </div>
  );
}

function RoleDialog({
  role,
  open,
  onOpenChange,
}: {
  role?: RoleListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!role;

  const detailQuery = useQuery({
    queryKey: roleKeys.detail(role?.id ?? ""),
    queryFn: () => getRole(role!.id),
    enabled: open && isEdit && !!role,
  });

  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    values: isEdit
      ? {
          name: detailQuery.data?.name ?? role?.name ?? "",
          permissions: detailQuery.data?.permissions ?? [],
        }
      : { name: "", permissions: [] },
  });

  const mutation = useMutation({
    mutationFn: (values: RoleValues) => {
      const body = { name: values.name.trim(), permissions: values.permissions };
      return isEdit
        ? updateRole(role!.id, body).then(() => undefined)
        : createRole(body).then(() => undefined);
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم حفظ الدور" : "تم إنشاء الدور");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الدور" : "دور جديد"}</DialogTitle>
        </DialogHeader>
        {isEdit && detailQuery.isPending ? (
          <TableSkeleton rows={4} cols={2} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الدور</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="مبيعات" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الصلاحيات</FormLabel>
                    <FormControl>
                      <PermissionCheckboxes value={field.value} onChange={field.onChange} />
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
        )}
      </DialogContent>
    </Dialog>
  );
}

function RolePermissions({ id }: { id: string }) {
  const detailQuery = useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => getRole(id),
  });
  if (detailQuery.isPending) return <span className="text-xs text-muted-foreground">…</span>;
  if (detailQuery.isError || !detailQuery.data) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {detailQuery.data.permissions.map((p) => (
        <Badge key={p} variant="outline" className="text-xs">
          {permissionLabel(p)}
        </Badge>
      ))}
    </div>
  );
}

export function RolesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [includeDisabled, setIncludeDisabled] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleListItem | undefined>(undefined);
  const [toggleTarget, setToggleTarget] = useState<RoleListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleListItem | null>(null);

  const rolesQuery = useQuery({
    queryKey: roleKeys.all(includeDisabled),
    queryFn: () => listRoles(includeDisabled),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleRoleStatus(id),
    onSuccess: () => {
      toast.success("تم تحديث حالة الدور");
      setToggleTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      toast.success("تم حذف الدور");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      setDeleteTarget(null);
      // 403 Role.ProtectedRole maps to a clear Arabic message in errors.ts.
      toast.error(parseApiError(error).message);
    },
  });

  const canEdit = hasPermission("roles:update");
  const canDelete = hasPermission("roles:delete");

  return (
    <div>
      <PageHeader
        title="الأدوار"
        subtitle="الأدوار وصلاحياتها — الكتابة للإدارة"
        actions={
          <RequirePermission permission="roles:add">
            <Button
              className="bg-clay-600 hover:bg-clay-700"
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              دور جديد
            </Button>
          </RequirePermission>
        }
      />

      <RoleDialog
        key={editing?.id ?? "new"}
        role={editing}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(undefined);
        }}
      />

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={includeDisabled ? "default" : "outline"}
          size="sm"
          onClick={() => setIncludeDisabled((v) => !v)}
        >
          {includeDisabled ? "إخفاء المحذوفة" : "عرض المحذوفة أيضًا"}
        </Button>
      </div>

      {rolesQuery.isPending ? (
        <TableSkeleton rows={5} cols={3} />
      ) : rolesQuery.isError ? (
        <ErrorCard message={parseApiError(rolesQuery.error).message} onRetry={() => rolesQuery.refetch()} />
      ) : (rolesQuery.data ?? []).length === 0 ? (
        <EmptyState title="لا توجد أدوار" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الدور</TableHead>
                  <TableHead>الصلاحيات</TableHead>
                  <TableHead>الحالة</TableHead>
                  {(canEdit || canDelete) && <TableHead className="w-28">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesQuery.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="max-w-md">
                      <RolePermissions id={r.id} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.isDeleted ? "destructive" : "default"}>
                        {r.isDeleted ? "محذوف" : "نشط"}
                      </Badge>
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell>
                        <div className="flex gap-1">
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditing(r);
                                  setDialogOpen(true);
                                }}
                                aria-label="تعديل"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setToggleTarget(r)}
                                aria-label={r.isDeleted ? "استعادة" : "حذف"}
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
                              onClick={() => setDeleteTarget(r)}
                              aria-label="حذف"
                              title="حذف الدور"
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
        open={toggleTarget != null}
        onOpenChange={(o) => !o && setToggleTarget(null)}
        title={toggleTarget?.isDeleted ? "استعادة الدور؟" : "حذف الدور؟"}
        confirmLabel={toggleTarget?.isDeleted ? "استعادة" : "حذف"}
        danger={!toggleTarget?.isDeleted}
        busy={toggleMutation.isPending}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget.id)}
      />

      <ConfirmAction
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="حذف الدور؟"
        description={
          deleteTarget
            ? `سيُحذف الدور "${deleteTarget.name}" — الأدوار المدمجة (Admin/Member) محمية ولا يمكن حذفها.`
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
