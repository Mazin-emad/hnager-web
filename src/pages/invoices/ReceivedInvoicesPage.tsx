import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { getReceivedInvoices, invoiceKeys } from "@/api/invoices";
import { parseApiError } from "@/api/errors";
import type { ReceivedInvoicePeriod, ReceivedInvoicesFilterRequest } from "@/api/types";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, RECEIVED_PERIOD_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { useInvoiceViewPrefs } from "@/lib/invoiceViewPrefs";
import { InvoiceViewToggle } from "@/components/invoices/InvoiceViewToggle";
import { EmptyState, ErrorCard, PageHeader, TableSkeleton } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const PERIODS: ReceivedInvoicePeriod[] = ["Last24Hours", "Last7Days", "Last30Days"];

/** datetime-local value -> ISO-8601 for the API. Empty -> undefined. */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function ReceivedInvoicesPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ReceivedInvoicePeriod | undefined>(undefined);
  const [fromLocal, setFromLocal] = useState("");
  const [toLocal, setToLocal] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<ReceivedInvoicesFilterRequest>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [viewPrefs, setViewPrefs] = useInvoiceViewPrefs();
  const brief = viewPrefs.briefDetails;
  // Same user-chosen brief field set as the owner's list; only the columns
  // this screen actually has (incl. owner/sharedAt) can render.
  const briefSet = new Set(viewPrefs.briefFields);

  const listQuery = useQuery({
    queryKey: invoiceKeys.received(applied),
    queryFn: () => getReceivedInvoices(applied),
  });

  function apply() {
    const fromDate = toIso(fromLocal);
    const toDate = toIso(toLocal);
    setPage(1);
    setApplied({
      fromDate,
      toDate,
      // Explicit bounds win per bound — if the user typed a custom range,
      // drop the preset period so it can't override the explicit dates.
      period: fromDate || toDate ? undefined : period,
      page: 1,
      pageSize: PAGE_SIZE,
    });
    if (fromDate || toDate) setPeriod(undefined);
  }

  function reset() {
    setPeriod(undefined);
    setFromLocal("");
    setToLocal("");
    setPage(1);
    setApplied({ page: 1, pageSize: PAGE_SIZE });
  }

  function gotoPage(next: number) {
    setPage(next);
    setApplied((f) => ({ ...f, page: next }));
  }

  const totalPages = listQuery.data
    ? Math.max(1, Math.ceil(listQuery.data.totalCount / (applied.pageSize ?? PAGE_SIZE)))
    : 1;

  return (
    <div>
      <PageHeader
        title="الفواتير المرسلة لي"
        subtitle="الفواتير التي شاركها معك الآخرون — يمكنك تعديلها كما يعدّلها المالك (الحذف للمالك فقط)"
      />

      <Card className="mb-4">
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={period == null && !fromLocal && !toLocal ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPeriod(undefined);
                setFromLocal("");
                setToLocal("");
              }}
            >
              الكل
            </Button>
            {PERIODS.map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriod(p);
                  setFromLocal("");
                  setToLocal("");
                }}
                className={cn(period === p && "bg-brand-800 hover:bg-brand-900")}
              >
                {RECEIVED_PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="recv-from">من تاريخ الاستلام</Label>
              <Input
                id="recv-from"
                type="datetime-local"
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
                className="tnum"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recv-to">إلى تاريخ الاستلام</Label>
              <Input
                id="recv-to"
                type="datetime-local"
                value={toLocal}
                onChange={(e) => setToLocal(e.target.value)}
                className="tnum"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Button onClick={apply} className="flex-1 bg-brand-800 hover:bg-brand-900 lg:flex-none">
                بحث
              </Button>
              <Button variant="outline" onClick={reset} className="flex-1 lg:flex-none">
                مسح
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            الترشيح بالتاريخ يتم على وقت الاستلام (sharedAt) — لا على تاريخ إنشاء الفاتورة.
          </p>
        </CardContent>
      </Card>

      {/* Brief-details switch (display control; the field set lives in settings) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={viewPrefs.briefDetails}
            onChange={(e) => setViewPrefs({ briefDetails: e.target.checked })}
            className="size-4 accent-brand-800"
          />
          تفاصيل مختصرة (الحقول المختارة في الإعدادات — بدون الرقم)
        </label>
      </div>

      {listQuery.isPending ? (
        <TableSkeleton rows={6} cols={6} />
      ) : listQuery.isError ? (
        <ErrorCard
          message={parseApiError(listQuery.error).message}
          onRetry={() => listQuery.refetch()}
        />
      ) : listQuery.data.items.length === 0 ? (
        <EmptyState
          title="لا توجد فواتير مرسلة لك"
          hint="عندما يشارك أحدهم فاتورة معك ستظهر هنا"
          icon={<Inbox className="size-6" />}
        />
      ) : (
        <>
          {viewPrefs.viewMode === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listQuery.data.items.map((inv) => (
                <Card
                  key={inv.shareId}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() =>
                    navigate(
                      `/invoices/${inv.invoiceId}?received=1&owner=${encodeURIComponent(inv.ownerUserId)}&sharedAt=${encodeURIComponent(inv.sharedAt)}`,
                    )
                  }
                >
                  <CardContent className="space-y-3 pt-6">
                    {brief ? (
                      <>
                        {briefSet.has("customerName") && (
                          <p className="min-w-0 truncate font-semibold">{inv.customerName}</p>
                        )}
                        {(briefSet.has("type") || briefSet.has("status")) && (
                          <div className="flex flex-wrap gap-1.5">
                            {briefSet.has("type") && (
                              <Badge variant="outline" className="shrink-0">
                                {INVOICE_TYPE_LABELS[inv.invoiceType]}
                              </Badge>
                            )}
                            {briefSet.has("status") && (
                              <Badge
                                variant={inv.status === "Draft" ? "secondary" : "default"}
                                className="shrink-0"
                              >
                                {INVOICE_STATUS_LABELS[inv.status]}
                              </Badge>
                            )}
                          </div>
                        )}
                        {briefSet.has("invoiceDate") && (
                          <p className="tnum text-sm text-muted-foreground">
                            الفاتورة: {fmtDate(inv.invoiceDate)}
                          </p>
                        )}
                        {briefSet.has("sharedAt") && (
                          <p className="tnum text-sm text-muted-foreground">
                            الاستلام: {fmtDateTime(inv.sharedAt)}
                          </p>
                        )}
                        {briefSet.has("owner") && (
                          <p className="tnum truncate text-xs text-muted-foreground" dir="ltr" title={inv.ownerUserId}>
                            {inv.ownerUserId}
                          </p>
                        )}
                        {briefSet.has("grandTotal") && (
                          <p className="tnum text-xl font-bold text-brand-900">
                            {fmtMoney(inv.grandTotal)}
                          </p>
                        )}
                        {!briefSet.has("customerName") &&
                          !briefSet.has("type") &&
                          !briefSet.has("status") &&
                          !briefSet.has("invoiceDate") &&
                          !briefSet.has("sharedAt") &&
                          !briefSet.has("owner") &&
                          !briefSet.has("grandTotal") && (
                            <p className="text-sm text-muted-foreground">
                              اختر حقلًا واحدًا على الأقل للتفاصيل المختصرة من الإعدادات.
                            </p>
                          )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate font-semibold">{inv.customerName}</p>
                          <Badge variant="outline" className="shrink-0">
                            {INVOICE_TYPE_LABELS[inv.invoiceType]}
                          </Badge>
                        </div>
                        <p className="tnum text-sm text-muted-foreground">
                          الفاتورة: {fmtDate(inv.invoiceDate)}
                        </p>
                        <p className="tnum text-sm text-muted-foreground">
                          الاستلام: {fmtDateTime(inv.sharedAt)}
                        </p>
                        <p className="tnum truncate text-xs text-muted-foreground" dir="ltr" title={inv.ownerUserId}>
                          {inv.ownerUserId}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="tnum text-xl font-bold text-brand-900">
                            {fmtMoney(inv.grandTotal)}
                          </p>
                          <Badge variant={inv.status === "Draft" ? "secondary" : "default"}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!brief && <TableHead>رقم الفاتورة</TableHead>}
                    {(!brief || briefSet.has("customerName")) && <TableHead>العميل / المورد</TableHead>}
                    {(!brief || briefSet.has("type")) && <TableHead>النوع</TableHead>}
                    {(!brief || briefSet.has("invoiceDate")) && <TableHead>تاريخ الفاتورة</TableHead>}
                    {(!brief || briefSet.has("sharedAt")) && <TableHead>تاريخ الاستلام</TableHead>}
                    {(!brief || briefSet.has("owner")) && <TableHead>المالك / المرسِل</TableHead>}
                    {(!brief || briefSet.has("status")) && <TableHead>الحالة</TableHead>}
                    {(!brief || briefSet.has("grandTotal")) && (
                      <TableHead className="text-left">الإجمالي</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data.items.map((inv) => (
                    <TableRow
                      key={inv.shareId}
                      className="cursor-pointer hover:bg-brand-50"
                      onClick={() =>
                        navigate(
                          `/invoices/${inv.invoiceId}?received=1&owner=${encodeURIComponent(inv.ownerUserId)}&sharedAt=${encodeURIComponent(inv.sharedAt)}`,
                        )
                      }
                    >
                      {!brief && (
                        <TableCell className="tnum font-semibold text-brand-800" dir="ltr">
                          {inv.invoiceNumber}
                        </TableCell>
                      )}
                      {(!brief || briefSet.has("customerName")) && <TableCell>{inv.customerName}</TableCell>}
                      {(!brief || briefSet.has("type")) && (
                        <TableCell>{INVOICE_TYPE_LABELS[inv.invoiceType]}</TableCell>
                      )}
                      {(!brief || briefSet.has("invoiceDate")) && (
                        <TableCell className="tnum">{fmtDate(inv.invoiceDate)}</TableCell>
                      )}
                      {(!brief || briefSet.has("sharedAt")) && (
                        <TableCell className="tnum">{fmtDateTime(inv.sharedAt)}</TableCell>
                      )}
                      {(!brief || briefSet.has("owner")) && (
                        <TableCell className="tnum max-w-40 truncate text-xs" dir="ltr" title={inv.ownerUserId}>
                          {inv.ownerUserId}
                        </TableCell>
                      )}
                      {(!brief || briefSet.has("status")) && (
                        <TableCell>
                          <Badge variant={inv.status === "Draft" ? "secondary" : "default"}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </Badge>
                        </TableCell>
                      )}
                      {(!brief || briefSet.has("grandTotal")) && (
                        <TableCell className="tnum text-left font-semibold">
                          {fmtMoney(inv.grandTotal)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="tnum">
              صفحة {page} من {totalPages} — الإجمالي {listQuery.data.totalCount}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <InvoiceViewToggle
                value={viewPrefs.viewMode}
                onChange={(viewMode) => setViewPrefs({ viewMode })}
              />
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => gotoPage(page - 1)}
                aria-label="السابق"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => gotoPage(page + 1)}
                aria-label="التالي"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
