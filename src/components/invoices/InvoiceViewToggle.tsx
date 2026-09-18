import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvoiceViewMode } from "@/lib/invoiceViewPrefs";

/** Display control shared by both invoice lists — lives next to pagination. */
export function InvoiceViewToggle({
  value,
  onChange,
}: {
  value: InvoiceViewMode;
  onChange: (mode: InvoiceViewMode) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
      <Button
        variant={value === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("table")}
        aria-label="عرض جدول"
      >
        <List className="size-4" />
        جدول
      </Button>
      <Button
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("cards")}
        aria-label="عرض بطاقات"
      >
        <LayoutGrid className="size-4" />
        بطاقات
      </Button>
    </div>
  );
}
