import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { invoiceKeys, shareInvoice, unshareInvoice } from "@/api/invoices";
import { listDirectory, listUsers, userKeys } from "@/api/users";
import { parseApiError } from "@/api/errors";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function errorCode(error: unknown): string | undefined {
  return parseApiError(error).code;
}

/**
 * Share dialog — anyone with access (owner, share recipient, Admin) plus the
 * `invoices:share` permission, on any status. Chains (A→B→C) are supported;
 * sharing never transfers ownership.
 * Recipient picker is backed by GET /api/Users/directory for ALL roles,
 * gated on `users:directory-read` (Member has it; Admin passes all checks).
 * The admin `GET /api/Users` listing is never used here. Directory returns
 * active users only.
 */
export function ShareInvoiceDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  invoiceNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canPickFromDirectory = hasPermission("users:directory-read");
  const [recipientId, setRecipientId] = useState("");
  const [unshareId, setUnshareId] = useState("");

  const directoryQuery = useQuery({
    queryKey: userKeys.directory,
    queryFn: listDirectory,
    enabled: open && canPickFromDirectory,
    // A 403 here is a server policy decision, not transient — don't hammer it.
    retry: false,
  });

  /**
   * Backend-workaround fallback: some deployments reject admins on
   * GET /api/Users/directory (403) even though the guide grants Admin the
   * `users:directory-read` permission. When the directory fails and the
   * current user may see the full admin listing (`users:read` — admins
   * only, never members), populate the picker from there instead so sharing
   * stays usable. The admin endpoint is never called for members.
   */
  const canUseAdminList = hasPermission("users:read");
  const adminListQuery = useQuery({
    queryKey: userKeys.all,
    queryFn: listUsers,
    enabled: open && directoryQuery.isError && canUseAdminList,
    retry: false,
  });

  const usingAdminFallback =
    directoryQuery.isError && canUseAdminList && adminListQuery.data !== undefined;
  const candidates = usingAdminFallback
    ? (adminListQuery.data ?? [])
        .filter((u) => u.id !== user?.id && !u.isDisabled)
        .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} — ${u.email}` }))
    : (directoryQuery.data ?? [])
        .filter((u) => u.id !== user?.id)
        .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} — ${u.userName}` }));
  const pickerLoading =
    directoryQuery.isPending ||
    (directoryQuery.isError && canUseAdminList && adminListQuery.isPending);
  // Surface the directory error only when there is no fallback path:
  // members without `users:read` genuinely can't pick a recipient.
  const pickerError =
    directoryQuery.isError && (!canUseAdminList || adminListQuery.isError)
      ? directoryQuery.error
      : undefined;

  function afterShareChange() {
    void queryClient.invalidateQueries({ queryKey: invoiceKeys.shares(invoiceId) });
    void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
    void queryClient.invalidateQueries({ queryKey: ["invoices", "received"] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  const shareMutation = useMutation({
    mutationFn: () => shareInvoice(invoiceId, { sharedWithUserId: recipientId.trim() }),
    onSuccess: (res) => {
      toast.success(`تمت مشاركة الفاتورة ${res.invoiceNumber}`);
      setRecipientId("");
      afterShareChange();
      onOpenChange(false);
    },
    onError: (error) => {
      const code = errorCode(error);
      const message = parseApiError(error).message;
      // 409 DuplicateShare is success-ish: the share already exists — inform and refresh.
      if (code === "Invoice.DuplicateShare") {
        toast.info(message);
        afterShareChange();
        onOpenChange(false);
        return;
      }
      toast.error(message);
    },
  });

  const unshareMutation = useMutation({
    mutationFn: () => unshareInvoice(invoiceId, unshareId.trim()),
    onSuccess: () => {
      toast.success("تم إلغاء المشاركة");
      setUnshareId("");
      afterShareChange();
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setRecipientId("");
          setUnshareId("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>مشاركة الفاتورة {invoiceNumber}</DialogTitle>
          <DialogDescription>
            المشاركة لا تنقل الملكية — تبقى الملكية للمالك الأصلي ويمكن إلغاء المشاركة في أي وقت.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {canPickFromDirectory ? (
            <div className="space-y-2">
              <Label>المستخدم المستلم</Label>
              <Select value={recipientId} onValueChange={(v) => setRecipientId(v as string)}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={pickerLoading ? "جارٍ تحميل دليل الأعضاء…" : "اختر المستخدم"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pickerError && (
                <p className="text-xs text-destructive">
                  {parseApiError(pickerError).message}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا تملك صلاحية عرض دليل الأعضاء — لا يمكنك اختيار مستلم.
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={() => shareMutation.mutate()}
              disabled={!recipientId.trim() || shareMutation.isPending}
              className="bg-brand-800 hover:bg-brand-900"
            >
              <Share2 className="size-4" />
              {shareMutation.isPending ? "جارٍ المشاركة…" : "مشاركة"}
            </Button>
          </DialogFooter>

          <div className="space-y-2 rounded-2xl bg-muted/50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <UserMinus className="size-4" />
              إلغاء مشاركة
            </p>
            {canPickFromDirectory ? (
              <>
                <Label>المستخدم المراد إلغاء مشاركته</Label>
                <div className="flex gap-2">
                  <Select value={unshareId} onValueChange={(v) => setUnshareId(v as string)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={pickerLoading ? "جارٍ تحميل دليل الأعضاء…" : "اختر المستخدم"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!unshareId.trim() || unshareMutation.isPending}
                    onClick={() => unshareMutation.mutate()}
                    className="text-destructive hover:text-destructive"
                  >
                    {unshareMutation.isPending ? "جارٍ الإلغاء…" : "إلغاء"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                لا تملك صلاحية عرض دليل الأعضاء — لا يمكنك اختيار مستخدم لإلغاء مشاركته.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              بعد الإلغاء يفقد المستخدم الوصول فورًا (يفرضها الخادم). اختيار مستخدم بلا مشاركة نشطة
              يعيد "هذه المشاركة غير موجودة".
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
