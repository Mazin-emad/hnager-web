import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** TEMPORARY visual-contrast harness — deleted before publish. */
export function VisualPage() {
  const [params] = useSearchParams();
  const demo = params.get("d") ?? "form";

  if (demo === "confirm") {
    return (
      <div className="min-h-svh bg-paper p-8">
        <p className="mb-4">صفحة خلفية للتباين — نص تجريبي خلف النافذة</p>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>اعتماد الفاتورة؟</AlertDialogTitle>
              <AlertDialogDescription>
                بعد الاعتماد لا يمكن تعديل الفاتورة نهائيًا. تأكد من مراجعة البنود.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction>اعتماد</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (demo === "select") {
    return (
      <div className="flex min-h-svh flex-col items-center gap-6 bg-paper p-8 pt-24">
        <Select defaultOpen>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="اختر النوع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Sales">مبيعات</SelectItem>
            <SelectItem value="Purchases">مشتريات</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu defaultOpen>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold">اسم المستخدم</p>
                <p className="text-xs text-muted-foreground">user@example.com</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>حسابي</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">تسجيل الخروج</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-paper p-8">
      <p className="mb-4">صفحة خلفية للتباين — نص تجريبي خلف النافذة</p>
      <Dialog open>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>فاتورة جديدة (مسودة)</DialogTitle>
            <DialogDescription>
              أدخل بيانات الفاتورة — ستضيف المنتجات في الخطوة التالية
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="v-customer">اسم العميل</Label>
              <Input id="v-customer" placeholder="اسم العميل" defaultValue="عميل تجريبي" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-date">التاريخ</Label>
              <Input id="v-date" type="date" defaultValue="2026-09-12" className="tnum" />
            </div>
            <div className="space-y-2">
              <Label>نوع الفاتورة</Label>
              <Select defaultValue="Sales">
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales">مبيعات</SelectItem>
                  <SelectItem value="Purchases">مشتريات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-discount">الخصم %</Label>
              <Input
                id="v-discount"
                type="number"
                inputMode="decimal"
                defaultValue="10"
                className="tnum"
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-brand-800 hover:bg-brand-900">إنشاء ومتابعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
