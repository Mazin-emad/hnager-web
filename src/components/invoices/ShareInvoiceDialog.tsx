import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { invoiceKeys, shareInvoice, unshareInvoice } from "@/api/invoices";
import { listUsers, userKeys } from "@/api/users";
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
import { Input } from "@/components/ui/input";
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
 * Share dialog — owner only, works on any status.
 * Recipient picker (§3.5 product decision): admins get a member picker via
 * GET /api/Users; members paste the recipient user id manually.
 * Never offered on received (non-owned) invoices — the caller hides it there.
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
  const canPickUsers = hasPermission("users:read");
  const [recipientId, setRecipientId] = useState("");
  const [unshareId, setUnshareId] = useState("");

  const usersQuery = useQuery({
    queryKey: userKeys.all,
    queryFn: listUsers,
    enabled: open && canPickUsers,
  });

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

  const candidates = (usersQuery.data ?? []).filter((u) => u.id !== user?.id);

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
            المشاركة لا تنقل الملكية — تبقى أنت مالك الفاتورة ويمكنك إلغاء المشاركة في أي وقت.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {canPickUsers ? (
            <div className="space-y-2">
              <Label>المستخدم المستلم</Label>
              <Select value={recipientId} onValueChange={(v) => setRecipientId(v as string)}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={usersQuery.isPending ? "جارٍ تحميل المستخدمين…" : "اختر المستخدم"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {u.email}
                      {u.isDisabled ? " (معطّل)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usersQuery.isError && (
                <p className="text-xs text-destructive">
                  {parseApiError(usersQuery.error).message}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="share-user-id">أو الصق معرف المستخدم (user id)</Label>
                <Input
                  id="share-user-id"
                  dir="ltr"
                  placeholder="user id"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="tnum text-left"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="share-user-id">معرف المستخدم المستلم (user id)</Label>
              <Input
                id="share-user-id"
                dir="ltr"
                placeholder="الصق معرف المستخدم هنا"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="tnum text-left"
              />
              <p className="text-xs text-muted-foreground">
                لا تملك صلاحية البحث عن المستخدمين — الصق معرف المستلم الذي حصلت عليه منه مباشرة.
              </p>
            </div>
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
            <Label htmlFor="unshare-user-id">معرف المستخدم المراد إلغاء مشاركته</Label>
            <div className="flex gap-2">
              <Input
                id="unshare-user-id"
                dir="ltr"
                placeholder="user id"
                value={unshareId}
                onChange={(e) => setUnshareId(e.target.value)}
                className="tnum flex-1 text-left"
              />
              <Button
                variant="outline"
                disabled={!unshareId.trim() || unshareMutation.isPending}
                onClick={() => unshareMutation.mutate()}
                className="text-destructive hover:text-destructive"
              >
                {unshareMutation.isPending ? "جارٍ الإلغاء…" : "إلغاء"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              بعد الإلغاء يفقد المستخدم الوصول فورًا (يفرضها الخادم).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
