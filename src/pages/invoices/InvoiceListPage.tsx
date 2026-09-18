import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createInvoice,
  deleteInvoice,
  invoiceKeys,
  listInvoices,
} from "@/api/invoices";
import { parseApiError } from "@/api/errors";
import type {
  InvoiceFilters,
  InvoiceListItem,
  InvoiceStatus,
  InvoiceType,
} from "@/api/types";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  WEEKDAY_LABELS,
  counterpartyNameLabel,
} from "@/lib/labels";
import { fmtDate, fmtMoney, todayIso } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import {
  ConfirmAction,
  EmptyState,
  ErrorCard,
  PageHeader,
  TableSkeleton,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const PAGE_SIZE = 20;

const draftSchema = z.object({
  customerName: z.string().min(1, "الاسم مطلوب").max(300, "حد أقصى 300 حرف"),
  invoiceType: z.enum(["Sales", "Purchases", "Returns"], { message: "اختر نوع الفاتورة" }),
  salesRepName: z
    .string()
    .min(1, "اسم المندوب مطلوب")
    .max(300, "حد أقصى 300 حرف"),
  day: z.string().max(100).optional().or(z.literal("")),
  invoiceDate: z.string().min(1, "التاريخ مطلوب"),
  discountPercent: z.coerce
    .number()
    .min(0, "لا تقل عن 0")
    .max(100, "لا تزيد عن 100"),
  notes: z.string().max(1000, "حد أقصى 1000 حرف").optional().or(z.literal("")),
});

type DraftValues = z.infer<typeof draftSchema>;

const WEEKDAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function statusVariant(
  status: InvoiceStatus,
): "default" | "secondary" | "destructive" {
  if (status === "Finalized") return "default";
  if (status === "Draft") return "secondary";
  return "destructive";
}

export function InvoiceListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission("invoices:delete");
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(
    null,
  );

  const listQuery = useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => listInvoices(filters),
  });

  const form = useForm<DraftValues>({
    // z.coerce fields make the schema input type wider than the output;
    // the validated output is exactly DraftValues.
    resolver: zodResolver(draftSchema) as unknown as Resolver<DraftValues>,
    defaultValues: {
      customerName: "",
      invoiceType: "Sales",
      salesRepName: "",
      day: "",
      invoiceDate: todayIso(),
      discountPercent: 0,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      toast.success(`تم إنشاء المسودة ${invoice.invoiceNumber}`);
      setCreateOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      navigate(`/invoices/${invoice.id}`);
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      toast.success("تم حذف الفاتورة");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => {
      setDeleteTarget(null);
      // 403 Invoice.AccessDenied / 404 Invoice.NotFound map to Arabic in errors.ts.
      toast.error(parseApiError(error).message);
    },
  });

  function applySearch() {
    setFilters((f) => ({
      ...f,
      customerName: searchInput || undefined,
      page: 1,
    }));
  }

  // Drives the customer/supplier label switch in the create dialog.
  const watchedInvoiceType = form.watch("invoiceType");

  const totalPages = listQuery.data
    ? Math.max(
        1,
        Math.ceil(listQuery.data.totalCount / (filters.pageSize ?? PAGE_SIZE)),
      )
    : 1;

  return (
    <div>
      <PageHeader
        title="الفواتير"
        subtitle="إنشاء ومتابعة فواتير المبيعات والمشتريات"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button className="bg-clay-600 hover:bg-clay-700">
                  <FilePlus2 className="size-4" />
                  فاتورة جديدة
                </Button>
              }
            />
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>فاتورة جديدة (مسودة)</DialogTitle>
                <DialogDescription>
                  أدخل بيانات الفاتورة — ستضيف المنتجات في الخطوة التالية
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((values) =>
                    createMutation.mutate({
                      customerName: values.customerName.trim(),
                      invoiceType: values.invoiceType,
                      salesRepName: values.salesRepName.trim(),
                      day: values.day?.trim() ? values.day : null,
                      invoiceDate: values.invoiceDate,
                      discountPercent: values.discountPercent,
                      notes: values.notes?.trim() ? values.notes : null,
                    }),
                  )}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {counterpartyNameLabel(watchedInvoiceType)}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={counterpartyNameLabel(
                                watchedInvoiceType,
                              )}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="salesRepName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المندوب</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="اسم المندوب" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoiceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع الفاتورة</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر النوع" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(
                                Object.keys(
                                  INVOICE_TYPE_LABELS,
                                ) as InvoiceType[]
                              ).map((t) => (
                                <SelectItem key={t} value={t}>
                                  {INVOICE_TYPE_LABELS[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>التاريخ</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" className="tnum" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="day"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اليوم (اختياري)</FormLabel>
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر اليوم" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {WEEKDAYS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {WEEKDAY_LABELS[d]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="discountPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الخصم %</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              inputMode="decimal"
                              className="tnum"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ملاحظات (اختياري)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ملاحظات إضافية" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      className="bg-brand-800 hover:bg-brand-900"
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending
                        ? "جارٍ الإنشاء…"
                        : "إنشاء ومتابعة"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="بحث بالاسم…"
              className="pe-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  status: v as InvoiceFilters["status"],
                  page: 1,
                }))
              }
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {INVOICE_STATUS_LABELS[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Select
              value={filters.type ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  type: v as InvoiceFilters["type"],
                  page: 1,
                }))
              }
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {(Object.keys(INVOICE_TYPE_LABELS) as InvoiceType[]).map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {INVOICE_TYPE_LABELS[t]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateFrom: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="tnum"
              aria-label="من تاريخ"
            />
            <Input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateTo: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="tnum"
              aria-label="إلى تاريخ"
            />
            <Button
              onClick={applySearch}
              className="col-span-2 text-white bg-brand-800 hover:bg-brand-900 sm:col-span-1"
            >
              بحث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {listQuery.isPending ? (
        <TableSkeleton rows={6} cols={5} />
      ) : listQuery.isError ? (
        <ErrorCard
          message={parseApiError(listQuery.error).message}
          onRetry={() => listQuery.refetch()}
        />
      ) : listQuery.data.items.length === 0 ? (
        <EmptyState
          title="لا توجد فواتير مطابقة"
          hint="جرّب تعديل البحث أو أنشئ فاتورة جديدة"
          icon={<FileText className="size-6" />}
        />
      ) : (
        <>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>العميل / المورد</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">الإجمالي</TableHead>
                    {canDelete && (
                      <TableHead className="w-20">إجراءات</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data.items.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-brand-50"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      <TableCell
                        className="tnum font-semibold text-brand-800"
                        dir="ltr"
                      >
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell>
                        {INVOICE_TYPE_LABELS[inv.invoiceType]}
                      </TableCell>
                      <TableCell className="tnum">
                        {fmtDate(inv.invoiceDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(inv.status)}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="tnum text-left font-semibold">
                        {fmtMoney(inv.grandTotal)}
                      </TableCell>
                      {canDelete && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(inv)}
                            aria-label="حذف"
                            title="حذف الفاتورة (بأي حالة)"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span className="tnum">
              صفحة {filters.page ?? 1} من {totalPages} — الإجمالي{" "}
              {listQuery.data.totalCount}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                }
                aria-label="السابق"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                }
                aria-label="التالي"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmAction
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="حذف الفاتورة؟"
        description={
          deleteTarget
            ? `سيُحذف الفاتورة ${deleteTarget.invoiceNumber} نهائيًا بجميع بنودها (حذف نهائي) — الحذف متاح بأي حالة بما فيها المعتمدة.`
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
