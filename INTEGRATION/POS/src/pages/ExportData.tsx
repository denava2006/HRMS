import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Receipt, ArrowLeftRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateFilter, todayRange, type DateRange } from "@/components/DateFilter";
import { logTechnicalError, userFacingError } from "@/lib/errors";

type Counts = { products: number; sales: number; items: number };

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type ExportKey = "products" | "sales" | "items";

export default function ExportData() {
  const { store } = useAuth();
  const [counts, setCounts] = useState<Counts>({ products: 0, sales: 0, items: 0 });
  const [countsError, setCountsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<ExportKey | null>(null);
  const [range, setRange] = useState<DateRange>(() => todayRange());

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      const [p, s, i] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("is_deleted", false),
        supabase.from("sales").select("id", { count: "exact", head: true }).eq("store_id", store.id),
        supabase.from("sale_items").select("id, sales!inner(store_id)", { count: "exact", head: true }).eq("sales.store_id", store.id),
      ]);
      if (cancelled) return;
      const failure = p.error || s.error || i.error;
      if (failure) {
        // Do not present a failed count as "0 records available to export".
        logTechnicalError("settingsExport.counts", failure);
        setCountsError(userFacingError(failure));
        return;
      }
      setCountsError(null);
      setCounts({ products: p.count || 0, sales: s.count || 0, items: i.count || 0 });
    })();
    return () => { cancelled = true; };
  }, [store]);

  const exportProducts = async () => {
    if (!store) return;
    setBusy("products");
    const { data, error } = await (supabase as any).from("products").select("name,category,category_id,stock,buying_price,selling_price,is_demo,created_at").eq("store_id", store.id).eq("is_deleted", false).order("name");
    setBusy(null);
    if (error) return toast.error(error.message);
    download(`products-${Date.now()}.csv`, toCSV(data || []));
    toast.success(`Exported ${data?.length || 0} products`);
  };

  const exportSales = async (r: DateRange) => {
    if (!store) return;
    setBusy("sales");
    const { data, error } = await supabase.from("sales")
      .select("id,created_at,subtotal,fees,total_amount,total_profit,payment_method,payment_reference,amount_tendered")
      .eq("store_id", store.id)
      .gte("created_at", r.start.toISOString())
      .lte("created_at", r.end.toISOString())
      .order("created_at", { ascending: false });
    setBusy(null);
    if (error) return toast.error(error.message);
    const rows = (data || []).map((s: any) => {
      const feeSummary = Array.isArray(s.fees)
        ? s.fees.map((f: any) => `${f.name}: ${Number(f.amount).toFixed(2)}`).join(" | ")
        : "";
      return {
        receipt: `TXN-${String(s.id).slice(0, 8).toUpperCase()}`,
        date: new Date(s.created_at).toLocaleString(),
        subtotal: s.subtotal ?? "",
        fees: feeSummary,
        total: s.total_amount,
        profit: s.total_profit,
        payment_method: s.payment_method,
        reference: s.payment_reference ?? "",
        cash_tendered: s.amount_tendered ?? "",
      };
    });
    download(`sales-${r.label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.csv`, toCSV(rows));
    toast.success(`Exported ${rows.length} sales (${r.label})`);
  };

  const exportItems = async (r: DateRange) => {
    if (!store) return;
    setBusy("items");
    const { data, error } = await supabase.from("sale_items")
      .select("product_name,quantity,unit_price,line_total,line_profit,sales!inner(id,created_at,store_id,payment_method)")
      .eq("sales.store_id", store.id)
      .gte("sales.created_at", r.start.toISOString())
      .lte("sales.created_at", r.end.toISOString());
    setBusy(null);
    if (error) return toast.error(error.message);
    const flat = (data || []).map((row: any) => ({
      receipt: `TXN-${String(row.sales?.id || "").slice(0, 8).toUpperCase()}`,
      sale_date: new Date(row.sales?.created_at).toLocaleString(),
      payment_method: row.sales?.payment_method,
      product_name: row.product_name,
      quantity: row.quantity,
      unit_price: row.unit_price,
      line_total: row.line_total,
      line_profit: row.line_profit,
    }));
    download(`sale-items-${r.label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.csv`, toCSV(flat));
    toast.success(`Exported ${flat.length} line items (${r.label})`);
  };

  const handleClick = (key: ExportKey) => {
    if (key === "products") return exportProducts();
    setPending(key);
  };

  const runPending = async () => {
    if (!pending) return;
    const r = range;
    const k = pending;
    setPending(null);
    if (k === "sales") await exportSales(r);
    else if (k === "items") await exportItems(r);
  };

  const printAll = () => window.print();

  const rows = [
    { key: "products" as const, label: "Export Products", desc: "All products with categories and stock", count: counts.products, icon: Package, color: "bg-primary/15 text-primary" },
    { key: "sales" as const, label: "Export Sales", desc: "Sales totals with payment details — pick date range", count: counts.sales, icon: Receipt, color: "bg-success/15 text-success" },
    { key: "items" as const, label: "Export Sale Items", desc: "Line items for every sale — pick date range", count: counts.items, icon: ArrowLeftRight, color: "bg-purple-500/15 text-purple-500" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Export Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download this branch's records as CSV for backup, accounting, or analysis.
        </p>
      </header>

      {countsError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Record counts could not be loaded, so the numbers below are unknown — they are not zero. {countsError}
        </p>
      )}

      <div className="space-y-3">
        {rows.map(r => {
          const Icon = r.icon;
          const loading = busy === r.key;
          return (
            <button
              key={r.key}
              onClick={() => handleClick(r.key)}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card text-left hover:bg-secondary/40 transition-base disabled:opacity-60"
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", r.color)}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
                <div className="text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded bg-secondary">{countsError ? "—" : r.count}</div>
              </div>
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Download className="w-5 h-5 text-muted-foreground" />}
            </button>
          );
        })}
      </div>

      <Button variant="outline" onClick={printAll} className="w-full mt-5">
        Print current page
      </Button>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select date range</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Choose which period of data to export.</p>
          <div className="py-2">
            <DateFilter value={range} onChange={setRange} />
            <p className="text-xs text-muted-foreground mt-3">Currently: <span className="font-semibold text-foreground">{range.label}</span></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={runPending} className="bg-gradient-primary shadow-pop">
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
