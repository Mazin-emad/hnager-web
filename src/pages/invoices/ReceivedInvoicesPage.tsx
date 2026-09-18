import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { getReceivedInvoices, invoiceKeys } from "@/api/invoices";
import { parseApiError } from "@/api/errors";
import type { ReceivedInvoicePeriod, ReceivedInvoicesFilterRequest } from "@/api/types";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, RECEIVED_PERIOD_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
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
  const [senderInput, setSenderInput] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<ReceivedInvoicesFilterRequest>({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const listQuery = useQuery({
    queryKey: invoiceKeys.received(applied),
    queryFn: () => getReceivedInvoices(applied),
  });

  function apply() {
    const fromDate = toIso(fromLocal);
    const toDate = toIso(toLocal);
    setPage(1);
    setApplied({
      fromUserId: senderInput.trim() || undefined,
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
    setSenderInput("");
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
        subtitle="الفواتير التي شاركها معك مالكوها — عرض فقط"
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
          <div className="grid gap-3 md:grid-cols-3">
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
            <div className="space-y-1.5">
              <Label htmlFor="recv-sender">المرسِل (معرف المستخدم)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="recv-sender"
                  dir="ltr"
                  placeholder="sender user id"
                  value={senderInput}
                  onChange={(e) => setSenderInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && apply()}
                  className="tnum pe-9 text-left"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            الترشيح بالتاريخ والمرسِل يتم على وقت الاستلام (sharedAt) — لا على تاريخ إنشاء الفاتورة.
          </p>
          <div className="flex gap-2">
            <Button onClick={apply} className="bg-brand-800 hover:bg-brand-900">
              بحث
            </Button>
            <Button variant="outline" onClick={reset}>
              مسح
            </Button>
          </div>
        </CardContent>
      </Card>

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
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>العميل / المورد</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>تاريخ الفاتورة</TableHead>
                    <TableHead>تاريخ الاستلام</TableHead>
                    <TableHead>المالك / المرسِل</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">الإجمالي</TableHead>
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
                      <TableCell className="tnum font-semibold text-brand-800" dir="ltr">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell>{INVOICE_TYPE_LABELS[inv.invoiceType]}</TableCell>
                      <TableCell className="tnum">{fmtDate(inv.invoiceDate)}</TableCell>
                      <TableCell className="tnum">{fmtDateTime(inv.sharedAt)}</TableCell>
                      <TableCell className="tnum max-w-40 truncate text-xs" dir="ltr" title={inv.ownerUserId}>
                        {inv.ownerUserId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "Draft" ? "secondary" : "default"}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="tnum text-left font-semibold">
                        {fmtMoney(inv.grandTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span className="tnum">
              صفحة {page} من {totalPages} — الإجمالي {listQuery.data.totalCount}
            </span>
            <div className="flex gap-2">
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
