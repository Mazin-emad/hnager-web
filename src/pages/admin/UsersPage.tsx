import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import {
  createUser,
  listUsers,
  toggleUserStatus,
  unlockUser,
  updateUser,
  userKeys,
} from "@/api/users";
import { listRoles } from "@/api/roles";
import { parseApiError } from "@/api/errors";
import type { UserResponse } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { RequirePermission } from "@/auth/RequirePermission";
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

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const userSchema = z.object({
  firstName: z.string().min(3, "3 أحرف على الأقل").max(100),
  lastName: z.string().min(3, "3 أحرف على الأقل").max(100),
  email: z.string().min(1, "البريد مطلوب").email("بريد غير صالح"),
  password: z
    .string()
    .regex(PASSWORD_RULE, "8 أحرف على الأقل: كبير وصغير ورقم ورمز")
    .optional()
    .or(z.literal("")),
  roles: z.array(z.string()).min(1, "اختر دورًا واحدًا على الأقل"),
});

type UserValues = z.infer<typeof userSchema>;

function RoleCheckboxes({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (roles: string[]) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((role) => {
        const checked = value.includes(role);
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(checked ? value.filter((r) => r !== role) : [...value, role])}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              checked
                ? "border-brand-800 bg-brand-800 text-paper"
                : "border-border bg-card hover:border-brand-400"
            }`}
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}

function UserDialog({
  user,
  open,
  onOpenChange,
}: {
  user?: UserResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!user;
  const rolesQuery = useQuery({ queryKey: ["roles", "names"], queryFn: () => listRoles(true) });

  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      password: "",
      roles: user?.roles ?? [],
    },
  });

  const mutation = useMutation({
    mutationFn: (values: UserValues) => {
      if (isEdit) {
        return updateUser(user.id, {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          roles: values.roles,
        }).then(() => undefined);
      }
      return createUser({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password || "",
        roles: values.roles,
      }).then(() => undefined);
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم حفظ المستخدم" : "تم إنشاء المستخدم");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const roleNames = (rolesQuery.data ?? []).filter((r) => !r.isDeleted).map((r) => r.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل المستخدم" : "مستخدم جديد"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الأول</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الأخير</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" dir="ltr" className="text-left" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEdit && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" dir="ltr" autoComplete="new-password" className="text-left" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الأدوار</FormLabel>
                  <FormControl>
                    <RoleCheckboxes value={field.value} onChange={field.onChange} options={roleNames} />
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

export function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserResponse | undefined>(undefined);
  const [toggleTarget, setToggleTarget] = useState<UserResponse | null>(null);

  const usersQuery = useQuery({ queryKey: userKeys.all, queryFn: listUsers });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleUserStatus(id),
    onSuccess: () => {
      toast.success("تم تحديث حالة المستخدم");
      setToggleTarget(null);
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => unlockUser(id),
    onSuccess: () => {
      toast.success("تم فك القفل");
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const canEdit = hasPermission("users:update");

  return (
    <div>
      <PageHeader
        title="المستخدمون"
        subtitle="إدارة حسابات الموظفين وأدوارهم"
        actions={
          <RequirePermission permission="users:add">
            <Button
              className="bg-clay-600 hover:bg-clay-700"
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              مستخدم جديد
            </Button>
          </RequirePermission>
        }
      />

      <UserDialog
        key={editing?.id ?? "new"}
        user={editing}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(undefined);
        }}
      />

      {usersQuery.isPending ? (
        <TableSkeleton rows={6} cols={4} />
      ) : usersQuery.isError ? (
        <ErrorCard message={parseApiError(usersQuery.error).message} onRetry={() => usersQuery.refetch()} />
      ) : (usersQuery.data ?? []).length === 0 ? (
        <EmptyState title="لا يوجد مستخدمون" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الأدوار</TableHead>
                  <TableHead>الحالة</TableHead>
                  {canEdit && <TableHead className="w-36">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.firstName} {u.lastName}
                    </TableCell>
                    <TableCell className="tnum" dir="ltr">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isDisabled ? "destructive" : "default"}>
                        {u.isDisabled ? "معطّل" : "نشط"}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(u);
                              setDialogOpen(true);
                            }}
                            aria-label="تعديل"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToggleTarget(u)}
                            aria-label={u.isDisabled ? "تفعيل" : "تعطيل"}
                          >
                            <Power className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={unlockMutation.isPending}
                            onClick={() => unlockMutation.mutate(u.id)}
                            aria-label="فك القفل"
                            title="فك قفل الحساب"
                          >
                            <KeyRound className="size-4" />
                          </Button>
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
        title={toggleTarget?.isDisabled ? "تفعيل المستخدم؟" : "تعطيل المستخدم؟"}
        description={
          toggleTarget?.isDisabled
            ? "سيتمكن المستخدم من تسجيل الدخول مجددًا."
            : "لن يتمكن المستخدم المعطّل من تسجيل الدخول."
        }
        confirmLabel={toggleTarget?.isDisabled ? "تفعيل" : "تعطيل"}
        danger={!toggleTarget?.isDisabled}
        busy={toggleMutation.isPending}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget.id)}
      />
    </div>
  );
}
