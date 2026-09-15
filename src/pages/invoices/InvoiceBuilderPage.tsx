import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BadgeCheck,
  Calculator,
  Download,
  Eye,
  EyeOff,
  FileDown,
  PackagePlus,
  Pencil,
  Receipt,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addInvoiceProduct,
  deleteInvoice,
  downloadInvoicePdf,
  fetchInvoicePdfBlob,
  finalizeInvoice,
  getInvoice,
  invoiceKeys,
  recalculateInvoice,
  removeInvoiceProduct,
  toggleInvoiceItemExcluded,
  updateInvoiceHeader,
} from "@/api/invoices";
import { getProductConfiguration, listProducts, productKeys } from "@/api/products";
import { parseApiError } from "@/api/errors";
import type { AddInvoiceProductRequest, InvoiceDetailResponse, InvoiceType } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, WEEKDAY_LABELS, counterpartyLabel, counterpartyNameLabel } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from "@/lib/format";
import { ConfirmAction, EmptyState, ErrorCard, PageHeader, TableSkeleton } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
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

const headerSchema = z.object({
  customerName: z.string().min(1, "الاسم مطلوب").max(300),
  invoiceType: z.enum(["Sales", "Purchases"]),
  salesRepName: z.string().min(1, "اسم المندوب مطلوب").max(300),
  day: z.string().max(100).optional().or(z.literal("")),
  invoiceDate: z.string().min(1, "التاريخ مطلوب"),
  discountPercent: z.coerce.number().min(0).max(100),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

type HeaderValues = z.infer<typeof headerSchema>;
const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function includedItemCount(invoice: InvoiceDetailResponse): number {
  return invoice.products.flatMap((p) => p.items).filter((i) => !i.isExcluded).length;
}

/** Safari (desktop + iOS) is unreliable with hidden-iframe PDF printing. */
function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
}

/**
 * Last-resort fallback: open an already-fetched PDF object URL in a new tab.
 * Returns false when the popup was blocked (caller should toast instead).
 */
function openPdfInNewTab(url: string | null): boolean {
  if (!url) return false;
  const tab = window.open(url, "_blank");
  if (!tab) return false;
  // Keep the URL alive while the user prints manually from the viewer.
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  return true;
}

// ── Add-product dialog ──────────────────────────────────────────────────────

function AddProductDialog({ invoiceId }: { invoiceId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const productsQuery = useQuery({
    queryKey: productKeys.all(true),
    queryFn: () => listProducts(true),
    enabled: open,
  });
  const configQuery = useQuery({
    queryKey: productKeys.configuration(productId),
    queryFn: () => getProductConfiguration(productId),
    enabled: open && !!productId,
  });

  const addMutation = useMutation({
    // Locked to the API contract: AddInvoiceProductRequest requires
    // { productId, inputValues: [{ variableKey, value }] } — omitting
    // inputValues is a type error, not a silent runtime drop.
    mutationFn: (body: AddInvoiceProductRequest) =>
      addInvoiceProduct(invoiceId, body),
    onSuccess: () => {
      toast.success("تمت إضافة المنتج");
      setOpen(false);
      setProductId("");
      setValues({});
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const variables = useMemo(
    () => [...(configQuery.data?.variables ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [configQuery.data],
  );

  function submit() {
    if (!productId) return;
    const missing = variables.filter((v) => v.isRequired && (values[v.variableId] ?? "").trim() === "");
    if (missing.length > 0) {
      toast.error(`أدخل القيم المطلوبة: ${missing.map((v) => v.name).join("، ")}`);
      return;
    }
    const inputValues = variables
      .filter((v) => (values[v.variableId] ?? "").trim() !== "")
      .map((v) => ({
        variableKey: v.key,
        value: Number(values[v.variableId]),
      }))
      .filter((iv) => !Number.isNaN(iv.value));
    addMutation.mutate({ productId, inputValues });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setProductId("");
          setValues({});
        }
      }}
    >
      <DialogTrigger
        render={
          <Button className="bg-clay-600 hover:bg-clay-700">
            <PackagePlus className="size-4" />
            إضافة منتج
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة منتج للفاتورة</DialogTitle>
          <DialogDescription>اختر المنتج ثم أدخل قيم المتغيرات ليتم الحساب</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>المنتج</Label>
            <Select
              value={productId}
              onValueChange={(v) => {
                setProductId(v as string);
                setValues({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={productsQuery.isPending ? "جارٍ التحميل…" : "اختر المنتج"} />
              </SelectTrigger>
              <SelectContent>
                {(productsQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {configQuery.isPending && productId && <TableSkeleton rows={3} cols={2} />}
          {configQuery.isError && (
            <ErrorCard
              message={parseApiError(configQuery.error).message}
              onRetry={() => configQuery.refetch()}
            />
          )}
          {configQuery.data && variables.length === 0 && (
            <p className="text-sm text-muted-foreground">هذا المنتج بلا متغيرات — سيُضاف مباشرة.</p>
          )}
          {variables.map((v) => (
            <div key={v.variableId} className="space-y-2">
              <Label htmlFor={`var-${v.variableId}`}>
                {v.name}
                {v.isRequired && <span className="text-destructive"> *</span>}
                {v.unit && <span className="text-xs text-muted-foreground"> ({v.unit})</span>}
              </Label>
              <Input
                id={`var-${v.variableId}`}
                type="number"
                step="any"
                inputMode="decimal"
                dir="ltr"
                className="tnum text-left"
                placeholder="0"
                value={values[v.variableId] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, [v.variableId]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={!productId || addMutation.isPending}
            className="bg-brand-800 hover:bg-brand-900"
          >
            {addMutation.isPending ? "جارٍ الإضافة…" : "إضافة وحساب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit-header dialog ──────────────────────────────────────────────────────

function EditHeaderDialog({ invoice }: { invoice: InvoiceDetailResponse }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<HeaderValues>({
    resolver: zodResolver(headerSchema) as unknown as Resolver<HeaderValues>,
    defaultValues: {
      customerName: invoice.customerName,
      invoiceType: invoice.invoiceType,
      salesRepName: invoice.salesRepName,
      day: invoice.day ?? "",
      invoiceDate: invoice.invoiceDate,
      discountPercent: invoice.discountPercent,
      notes: invoice.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: HeaderValues) =>
      updateInvoiceHeader(invoice.id, {
        customerName: values.customerName.trim(),
        invoiceType: values.invoiceType,
        salesRepName: values.salesRepName.trim(),
        day: values.day?.trim() ? values.day : null,
        invoiceDate: values.invoiceDate,
        discountPercent: values.discountPercent,
        notes: values.notes?.trim() ? values.notes : null,
      }),
    onSuccess: (updated) => {
      const typeChanged = updated.invoiceType !== invoice.invoiceType;
      // The backend re-prices every line from current catalog pricing when
      // the type changes — never trust locally-held totals; use the fresh
      // server response (and refetch to be safe).
      queryClient.setQueryData(invoiceKeys.detail(invoice.id), updated);
      toast.success(
        typeChanged
          ? "تم حفظ بيانات الفاتورة وأُعيد تسعير البنود حسب النوع الجديد"
          : "تم حفظ بيانات الفاتورة",
      );
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoice.id) });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            تعديل البيانات
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>تعديل بيانات الفاتورة</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{counterpartyNameLabel(form.watch("invoiceType"))}</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
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
                    <FormLabel>النوع</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(INVOICE_TYPE_LABELS) as InvoiceType[]).map((t) => (
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
                    <FormLabel>اليوم</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
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
                      <Input {...field} type="number" min={0} max={100} step="any" inputMode="decimal" className="tnum" />
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
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Input {...field} />
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

// ── Page ────────────────────────────────────────────────────────────────────

export function InvoiceBuilderPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canDeleteInvoice = hasPermission("invoices:delete");
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);

  const invoiceQuery = useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => getInvoice(id),
    enabled: !!id,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });

  const excludeMutation = useMutation({
    mutationFn: ({ productId, itemId }: { productId: string; itemId: string }) =>
      toggleInvoiceItemExcluded(id, productId, itemId),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const removeMutation = useMutation({
    mutationFn: (invoiceProductId: string) => removeInvoiceProduct(id, invoiceProductId),
    onSuccess: () => {
      toast.success("تم حذف المنتج من الفاتورة");
      setRemoveTarget(null);
      void invalidate();
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateInvoice(id),
    onSuccess: () => {
      toast.success("تمت إعادة الحساب");
      void invalidate();
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeInvoice(id),
    onSuccess: () => {
      toast.success("تم اعتماد الفاتورة");
      setFinalizeOpen(false);
      void invalidate();
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(id),
    onSuccess: () => {
      toast.success("تم حذف الفاتورة");
      setDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      navigate("/invoices");
    },
    onError: (error) => {
      setDeleteOpen(false);
      // 403 Invoice.AccessDenied / 404 Invoice.NotFound map to Arabic in errors.ts.
      toast.error(parseApiError(error).message);
    },
  });

  async function handlePdf(invoice: InvoiceDetailResponse) {
    setPdfBusy(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      toast.success("تم تنزيل ملف PDF");
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function handlePrint(invoice: InvoiceDetailResponse) {
    // Safari is unreliable with hidden-iframe printing — send those users
    // straight to the built-in PDF viewer so they can print manually.
    if (isSafariBrowser()) {
      await handlePrintViaTab(invoice, null);
      return;
    }
    setPrintBusy(true);
    let url: string | null = null;
    let iframe: HTMLIFrameElement | null = null;
    // Safety net: never leave a hidden iframe / object URL behind if
    // afterprint doesn't fire (browser quirk) — the dialog is long gone by then.
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (url) URL.revokeObjectURL(url);
      url = null;
      iframe?.remove();
      iframe = null;
    };
    try {
      const blob = await fetchInvoicePdfBlob(invoice.id);
      url = URL.createObjectURL(blob);
      iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      await new Promise<void>((resolve, reject) => {
        if (!iframe) {
          reject(new Error("تعذّرت الطباعة"));
          return;
        }
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error("تعذّرت الطباعة"));
      });
      const frameWindow = iframe.contentWindow;
      if (!frameWindow) throw new Error("تعذّرت الطباعة");
      frameWindow.onafterprint = cleanup;
      fallbackTimer = setTimeout(cleanup, 60_000);
      frameWindow.focus();
      frameWindow.print();
    } catch {
      // iframe printing failed (or was blocked) — fall back to a new tab
      // with the already-fetched PDF instead of failing silently.
      const opened = openPdfInNewTab(url);
      cleanup();
      if (!opened) toast.error("تعذّرت الطباعة — اسمح بالنوافذ المنبثقة ثم حاول مجددًا");
    } finally {
      setPrintBusy(false);
    }
  }

  /**
   * Safari path (and iframe-failure fallback): open the fetched PDF in a new
   * tab so the user prints from the browser's built-in PDF viewer.
   * When `presetTab` is provided it must come from the synchronous click
   * handler, otherwise popup blockers may refuse the new tab.
   */
  async function handlePrintViaTab(invoice: InvoiceDetailResponse, presetTab: Window | null) {
    setPrintBusy(true);
    const tab = presetTab ?? window.open("", "_blank");
    if (!tab) {
      setPrintBusy(false);
      toast.error("تعذّر فتح نافذة جديدة — اسمح بالنوافذ المنبثقة ثم حاول مجددًا");
      return;
    }
    try {
      const blob = await fetchInvoicePdfBlob(invoice.id);
      const url = URL.createObjectURL(blob);
      tab.location.href = url;
      // Keep the URL alive while the user prints manually from the viewer.
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    } catch (error) {
      tab.close();
      toast.error(parseApiError(error).message);
    } finally {
      setPrintBusy(false);
    }
  }

  if (!id) return <ErrorCard message="رقم الفاتورة غير صالح" />;
  if (invoiceQuery.isPending) return <TableSkeleton rows={8} cols={3} />;
  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <ErrorCard
        message={parseApiError(invoiceQuery.error).message}
        onRetry={() => invoiceQuery.refetch()}
      />
    );
  }

  const invoice = invoiceQuery.data;
  const isDraft = invoice.status === "Draft";
  const included = includedItemCount(invoice);
  const canFinalize = isDraft && included > 0;

  return (
    <div>
      <PageHeader
        title={`فاتورة ${invoice.invoiceNumber}`}
        subtitle={`${INVOICE_TYPE_LABELS[invoice.invoiceType]} — ${invoice.customerName}`}
        actions={
          <>
            <Badge variant={isDraft ? "secondary" : "default"} className="text-sm">
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
            {isDraft && <AddProductDialog invoiceId={invoice.id} />}
            <Button
              variant="outline"
              onClick={() => handlePdf(invoice)}
              disabled={pdfBusy}
            >
              <FileDown className="size-4" />
              {pdfBusy ? "جارٍ التجهيز…" : "PDF"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePrint(invoice)}
              disabled={printBusy}
            >
              <Printer className="size-4" />
              {printBusy ? "جارٍ التجهيز…" : "طباعة"}
            </Button>
            {canDeleteInvoice && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                حذف الفاتورة
              </Button>
            )}
          </>
        }
      />

      {/* Header card */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">بيانات الفاتورة</CardTitle>
          {isDraft && <EditHeaderDialog invoice={invoice} />}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted-foreground">{counterpartyLabel(invoice.invoiceType)}</dt><dd className="font-semibold">{invoice.customerName}</dd></div>
            <div><dt className="text-muted-foreground">المندوب</dt><dd className="font-semibold">{invoice.salesRepName}</dd></div>
            <div><dt className="text-muted-foreground">النوع</dt><dd className="font-semibold">{INVOICE_TYPE_LABELS[invoice.invoiceType]}</dd></div>
            <div><dt className="text-muted-foreground">التاريخ</dt><dd className="tnum font-semibold">{fmtDate(invoice.invoiceDate)}{invoice.day ? ` — ${WEEKDAY_LABELS[invoice.day] ?? invoice.day}` : ""}</dd></div>
            <div><dt className="text-muted-foreground">الإنشاء</dt><dd className="tnum">{fmtDateTime(invoice.createdAt)}</dd></div>
            {invoice.finalizedAt && <div><dt className="text-muted-foreground">الاعتماد</dt><dd className="tnum">{fmtDateTime(invoice.finalizedAt)}</dd></div>}
            {invoice.notes && <div className="sm:col-span-2"><dt className="text-muted-foreground">ملاحظات</dt><dd>{invoice.notes}</dd></div>}
          </dl>
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-brand-50 p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">الإجمالي الفرعي</p>
              <p className="tnum text-lg font-bold text-brand-900">{fmtMoney(invoice.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الخصم <span className="tnum">({fmtNum(invoice.discountPercent)}%)</span></p>
              <p className="tnum text-lg font-bold text-clay-700">{fmtMoney(invoice.discountAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الإجمالي النهائي</p>
              <p className="tnum text-xl font-bold text-brand-950">{fmtMoney(invoice.grandTotal)}</p>
            </div>
          </div>
          {isDraft && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending}
              >
                <Calculator className="size-4" />
                {recalcMutation.isPending ? "جارٍ الحساب…" : "إعادة حساب"}
              </Button>
              <Button
                onClick={() => setFinalizeOpen(true)}
                disabled={!canFinalize}
                className="bg-brand-800 hover:bg-brand-900"
                title={included === 0 ? "أضف صنفًا واحدًا على الأقل قبل الاعتماد" : undefined}
              >
                <BadgeCheck className="size-4" />
                اعتماد الفاتورة
              </Button>
              {included === 0 && (
                <p className="w-full text-xs text-muted-foreground">
                  لا يمكن الاعتماد قبل إضافة منتج يحوي صنفًا واحدًا غير مستبعد على الأقل.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product blocks */}
      {invoice.products.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات بعد"
          hint={isDraft ? "أضف أول منتج مع قيم المتغيرات ليتم حساب الأصناف تلقائيًا" : "هذه الفاتورة بلا بنود"}
          icon={<Receipt className="size-6" />}
        />
      ) : (
        <div className="space-y-4">
          {[...invoice.products]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((block) => (
              <Card key={block.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{block.productNameSnapshot}</CardTitle>
                    <Badge
                      variant="secondary"
                      className="tnum"
                      title={
                        block.productQuantityFormulaSnapshot
                          ? `معادلة الكمية (v${block.productQuantityFormulaVersion}): ${block.productQuantityFormulaSnapshot}`
                          : "لا توجد معادلة كمية — الكمية 1"
                      }
                    >
                      الكمية: {fmtNum(block.productQuantity)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="tnum"
                      title={
                        block.linesCountFormulaSnapshot
                          ? `معادلة عدد الخطوط (v${block.linesCountFormulaVersion}): ${block.linesCountFormulaSnapshot}`
                          : "لا توجد معادلة لعدد الخطوط"
                      }
                    >
                      عدد الخطوط: {fmtNum(block.linesCount)}
                    </Badge>
                  </div>
                  {isDraft && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoveTarget(block.id)}
                    >
                      <Trash2 className="size-4" />
                      حذف المنتج
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {block.inputValues.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {block.inputValues.map((iv) => (
                        <Badge key={iv.variableKey} variant="outline" className="tnum" dir="ltr">
                          {iv.variableKey}: {fmtNum(iv.value)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الصنف</TableHead>
                          <TableHead className="text-left">عدد</TableHead>
                          <TableHead className="text-left">اجمالي العدد</TableHead>
                          <TableHead className="text-left" title="السعر المحسوم لنوع هذه الفاتورة: سعر البيع للمبيعات، وسعر الشراء للمشتريات">السعر</TableHead>
                          <TableHead className="text-left">السعر الإجمالي</TableHead>
                          {isDraft && <TableHead className="w-24">الحالة</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...block.items]
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((item) => (
                            <TableRow key={item.id} className={item.isExcluded ? "opacity-50" : undefined}>
                              <TableCell>
                                <p className="font-medium">{item.itemNameSnapshot}</p>
                              </TableCell>
                              {/* العدد = CEILING(raw). Never render formulaResultSnapshot
                                  (raw, audit-only), formulaSnapshot, or the multiplier
                                  snapshots — they are internal details. */}
                              <TableCell
                                className="tnum text-left"
                                title="العدد بعد التقريب لأعلى"
                              >
                                {item.itemQuantitySnapshot != null
                                  ? fmtNum(item.itemQuantitySnapshot)
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className="tnum text-left"
                                title="إجمالي العدد"
                              >
                                {fmtNum(item.quantitySnapshot)}
                              </TableCell>
                              <TableCell className="tnum text-left">{fmtMoney(item.unitPriceSnapshot)}</TableCell>
                              <TableCell className="tnum text-left font-semibold">
                                {fmtMoney(item.totalPriceSnapshot)}
                              </TableCell>
                              {isDraft && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      excludeMutation.mutate({ productId: block.id, itemId: item.id })
                                    }
                                    title={item.isExcluded ? "إعادة التضمين" : "استبعاد من الإجمالي"}
                                  >
                                    {item.isExcluded ? (
                                      <EyeOff className="size-4 text-muted-foreground" />
                                    ) : (
                                      <Eye className="size-4 text-brand-700" />
                                    )}
                                    {item.isExcluded ? "مستبعد" : "مضمّن"}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => handlePdf(invoice)} disabled={pdfBusy}>
          <Download className="size-4" />
          {pdfBusy ? "جارٍ التجهيز…" : "تنزيل PDF"}
        </Button>
        <Button variant="outline" onClick={() => handlePrint(invoice)} disabled={printBusy}>
          <Printer className="size-4" />
          {printBusy ? "جارٍ التجهيز…" : "طباعة"}
        </Button>
      </div>

      <ConfirmAction
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        title="اعتماد الفاتورة؟"
        description="بعد الاعتماد لا يمكن تعديل الفاتورة نهائيًا."
        confirmLabel="اعتماد"
        busy={finalizeMutation.isPending}
        onConfirm={() => finalizeMutation.mutate()}
      />
      <ConfirmAction
        open={removeTarget != null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="حذف المنتج من الفاتورة؟"
        description="سيُحذف البند وتُعاد حساب الإجماليات."
        confirmLabel="حذف"
        danger
        busy={removeMutation.isPending}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget)}
      />
      <ConfirmAction
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف الفاتورة؟"
        description="سيُحذف الفاتورة نهائيًا بجميع بنودها (حذف نهائي) — الحذف متاح بأي حالة بما فيها المعتمدة."
        confirmLabel="حذف"
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
