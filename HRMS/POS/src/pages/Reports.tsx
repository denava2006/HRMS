import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, LOW_STOCK_THRESHOLD } from "@/lib/store";
import { PESO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DateFilter, todayRange, type DateRange } from "@/components/DateFilter";
import {
  Wallet, TrendingUp, ShoppingBag, Package,
  AlertTriangle, Trophy, Receipt, Printer, Coins,
} from "lucide-react";
import { format } from "date-fns";
import { storeDataQueryKeys } from "@/lib/storeData";
import { DataError } from "@/components/DataError";
import { LEGACY_ATTRIBUTION } from "@/lib/receipts";

type SaleRow = {
  id: string;
  total_amount: number;
  total_profit: number;
  gross_sales: number;
  net_sales: number;
  total_cogs: number;
  gross_profit: number;
  net_profit: number;
  store_paid_deductions: number;
  created_by: string | null;
  created_at: string;
  payment_method: string | null;
};

type ItemRow = { product_name: string; category_id: string | null; category_name: string; quantity: number; line_total: number; line_cogs: number | null; line_gross_profit: number | null };
const EMPTY_SALES: SaleRow[] = [];
const EMPTY_ITEMS: ItemRow[] = [];

async function fetchReport(range: DateRange, storeId: string) {
  const salesResult = await supabase.from("sales")
    .select("id,total_amount,total_profit,gross_sales,net_sales,total_cogs,gross_profit,net_profit,store_paid_deductions,created_by,created_at,payment_method")
    .eq("store_id", storeId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false });
  if (salesResult.error) throw salesResult.error;

  const sales = (salesResult.data || []) as SaleRow[];
  const saleIds = sales.map((sale) => sale.id);
  if (saleIds.length === 0) return { sales, items: [] as ItemRow[] };

  const itemsResult = await supabase.from("sale_items")
    .select("product_name,category_id,category_name,quantity,line_total,line_cogs,line_gross_profit")
    .in("sale_id", saleIds);
  if (itemsResult.error) throw itemsResult.error;
  return { sales, items: (itemsResult.data || []) as ItemRow[] };
}

export default function Reports() {
  const { store } = useAuth();
  const { products, error: productsError } = useProducts({ storeId: store?.id });
  const [range, setRange] = useState<DateRange>(() => todayRange());
  const rangeKey = `${range.start.toISOString()}_${range.end.toISOString()}`;
  const { data: reportData, isLoading, error: reportError, refetch: refetchReport } = useQuery({
    queryKey: store?.id
      ? storeDataQueryKeys.report(store.id, rangeKey)
      : ["store-data", "none", "reports", rangeKey],
    queryFn: () => fetchReport(range, store!.id),
    enabled: Boolean(store?.id),
    placeholderData: (previous) => previous,
  });
  const sales = reportData?.sales ?? EMPTY_SALES;
  const items = reportData?.items ?? EMPTY_ITEMS;
  const loading = isLoading && !reportData;

  const { data: staffNames = {}, error: staffNamesError } = useQuery({
    queryKey: store?.id ? ["store-data", store.id, "staff-names"] : ["store-data", "none", "staff-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_memberships")
        .select("user_id,display_name,role")
        .eq("store_id", store!.id);
      if (error) throw new Error(error.message || "Staff names could not be loaded.");
      return Object.fromEntries((data ?? []).map((member) => [
        member.user_id,
        member.display_name?.trim() || member.role,
      ])) as Record<string, string>;
    },
    enabled: Boolean(store?.id),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

  const totals = useMemo(() => {
    const grossSales = sales.reduce((sum, sale) => sum + Number(sale.gross_sales), 0);
    const netSales = sales.reduce((sum, sale) => sum + Number(sale.net_sales), 0);
    const cogs = sales.reduce((sum, sale) => sum + Number(sale.total_cogs), 0);
    const grossProfit = sales.reduce((sum, sale) => sum + Number(sale.gross_profit), 0);
    const netProfit = sales.reduce((sum, sale) => sum + Number(sale.net_profit), 0);
    const itemsSold = items.reduce((s, x) => s + Number(x.quantity), 0);
    const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    return { grossSales, netSales, cogs, grossProfit, netProfit, margin, count: sales.length, itemsSold };
  }, [sales, items]);

  const stockValue = useMemo(() => {
    const cost = products.reduce((s, p) => s + Number(p.buying_price) * Number(p.stock), 0);
    const retail = products.reduce((s, p) => s + Number(p.selling_price) * Number(p.stock), 0);
    const units = products.reduce((s, p) => s + Number(p.stock), 0);
    return { cost, retail, units, low: products.filter(p => p.stock <= LOW_STOCK_THRESHOLD).length };
  }, [products]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; revenue: number; profit: number }>();
    items.forEach((i) => {
      const cur = m.get(i.product_name) || { qty: 0, revenue: 0, profit: 0 };
      cur.qty += Number(i.quantity);
      cur.revenue += Number(i.line_total);
      cur.profit += Number(i.line_gross_profit ?? 0);
      m.set(i.product_name, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
  }, [items]);

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach(s => m.set(s.payment_method || "unknown", (m.get(s.payment_method || "unknown") || 0) + Number(s.net_sales)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);

  const byCategory = useMemo(() => {
    const grouped = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>();
    items.forEach((item) => {
      const key = item.category_id || `legacy:${item.category_name || "Uncategorized"}`;
      const current = grouped.get(key) || { name: item.category_name || "Uncategorized", quantity: 0, revenue: 0, profit: 0 };
      current.quantity += Number(item.quantity);
      current.revenue += Number(item.line_total);
      current.profit += Number(item.line_gross_profit ?? 0);
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
  }, [items]);

  const byCashier = useMemo(() => {
    const grouped = new Map<string, { sales: number; netSales: number; profit: number }>();
    sales.forEach((sale) => {
      const key = sale.created_by || "unknown";
      const current = grouped.get(key) || { sales: 0, netSales: 0, profit: 0 };
      current.sales += 1;
      current.netSales += Number(sale.net_sales);
      current.profit += Number(sale.net_profit);
      grouped.set(key, current);
    });
    return [...grouped.entries()].sort((a, b) => b[1].profit - a[1].profit);
  }, [sales]);

  const cards = [
    { label: "Gross Sales", value: PESO(totals.grossSales), icon: Wallet, gradient: "bg-gradient-primary" },
    { label: "Net Sales", value: PESO(totals.netSales), icon: ShoppingBag, gradient: "bg-gradient-accent" },
    { label: "COGS", value: PESO(totals.cogs), icon: Coins, gradient: "bg-gradient-to-br from-warning to-destructive" },
    { label: "Gross Profit", value: PESO(totals.grossProfit), icon: TrendingUp, gradient: "bg-gradient-success" },
    { label: "Net Profit", value: PESO(totals.netProfit), icon: TrendingUp, gradient: "bg-gradient-success" },
    { label: "Profit Margin", value: `${totals.margin.toFixed(1)}%`, icon: TrendingUp, gradient: "bg-gradient-primary" },
    { label: "Transactions", value: String(totals.count), icon: ShoppingBag, gradient: "bg-gradient-to-br from-warning to-destructive" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <header className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-xs text-muted-foreground">{range.label} · {format(range.start, "MMM d")} — {format(range.end, "MMM d, yyyy")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Print
        </Button>
      </header>

      <DateFilter value={range} onChange={setRange} />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-[110px] rounded-xl" />)}
        </div>
      ) : reportError && !reportData ? (
        <DataError
          title="This report could not be loaded"
          error={reportError}
          context="reports.fetchReport"
          onRetry={() => void refetchReport()}
        />
      ) : (
        <>
      {reportError && (
        <Card className="border-warning/30 bg-warning/10 p-3 text-sm">
          Showing the last report that loaded successfully — the newest refresh did not complete.
        </Card>
      )}
      {staffNamesError && (
        <Card className="border-warning/30 bg-warning/10 p-3 text-sm">
          Staff names could not be loaded, so cashier rows show their user ID instead.
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className={`${card.gradient} text-primary-foreground p-5 border-0 shadow-card`}>
            <card.icon className="mb-3 h-5 w-5 opacity-90" />
            <div className="text-xl font-bold leading-tight break-all md:text-2xl">{card.value}</div>
            <div className="mt-1 text-xs opacity-90">{card.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-lg">Top Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No sales in this period</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map(([name, d], i) => (
                <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground">{d.qty} sold · profit {PESO(d.profit)}</div>
                  </div>
                  <div className="font-bold tabular-nums text-sm">{PESO(d.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Revenue by Payment</h2>
          </div>
          {byMethod.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No sales in this period</p>
          ) : (
            <div className="space-y-2">
              {byMethod.map(([m, v]) => (
                <div key={m} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <span className="font-medium capitalize">{m}</span>
                  <span className="font-bold tabular-nums">{PESO(v)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 shadow-card">
        <h2 className="font-bold text-lg mb-4">Sales by Category</h2>
        {byCategory.length === 0 ? <p className="text-muted-foreground text-sm py-6 text-center">No category sales in this period</p> : (
          <div className="space-y-2">
            {byCategory.map((category) => (
              <div key={category.name} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-secondary p-3 text-sm">
                <div><div className="font-medium">{category.name}</div><div className="text-xs text-muted-foreground">{category.quantity} items · profit {PESO(category.profit)}</div></div>
                <div className="font-bold tabular-nums">{PESO(category.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 shadow-card">
        <h2 className="font-bold text-lg mb-4">Profit by Cashier</h2>
        {byCashier.length === 0 ? <p className="text-muted-foreground text-sm py-6 text-center">No cashier sales in this period</p> : (
          <div className="space-y-2">
            {byCashier.map(([userId, result]) => (
              <div key={userId} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-secondary p-3 text-sm">
                <div>
                  <div className="font-medium">{staffNames[userId] || (userId === "unknown" ? LEGACY_ATTRIBUTION : userId.slice(0, 8))}</div>
                  <div className="text-xs text-muted-foreground">{result.sales} transactions · net sales {PESO(result.netSales)}</div>
                </div>
                <div className="font-bold tabular-nums text-success">{PESO(result.profit)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Inventory Snapshot</h2>
        </div>
        {productsError && (
          <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Product data could not be loaded, so these stock figures are incomplete.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-secondary">
            <div className="text-xs text-muted-foreground">Products</div>
            <div className="text-lg font-bold">{products.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-secondary">
            <div className="text-xs text-muted-foreground">Units in stock</div>
            <div className="text-lg font-bold">{stockValue.units}</div>
          </div>
          <div className="p-3 rounded-lg bg-secondary">
            <div className="text-xs text-muted-foreground">Stock cost value</div>
            <div className="text-lg font-bold break-all">{PESO(stockValue.cost)}</div>
          </div>
          <div className="p-3 rounded-lg bg-secondary">
            <div className="text-xs text-muted-foreground">Stock retail value</div>
            <div className="text-lg font-bold break-all">{PESO(stockValue.retail)}</div>
          </div>
        </div>
        {stockValue.low > 0 && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span>{stockValue.low} product{stockValue.low === 1 ? "" : "s"} at or below low-stock threshold ({LOW_STOCK_THRESHOLD})</span>
          </div>
        )}
      </Card>

      <Card className="p-5 shadow-card">
        <h2 className="font-bold text-lg mb-4">All Transactions ({sales.length})</h2>
        {sales.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">No transactions in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">Receipt</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3 text-right">COGS</th>
                  <th className="py-2 pr-3 text-right">Gross Profit</th>
                  <th className="py-2 pr-3 text-right">Net Profit</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">TXN-{s.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-2 pr-3">{format(new Date(s.created_at), "MMM d, h:mm a")}</td>
                    <td className="py-2 pr-3"><Badge variant="secondary" className="capitalize">{s.payment_method || "—"}</Badge></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{PESO(s.total_cogs)}</td>
                    <td className="py-2 pr-3 text-right text-success tabular-nums">{PESO(s.gross_profit)}</td>
                    <td className="py-2 pr-3 text-right text-success tabular-nums">{PESO(s.net_profit)}</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">{PESO(s.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </>
      )}
    </div>
  );
}
