import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, LOW_STOCK_THRESHOLD } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PESO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingBag, AlertTriangle, Wallet, Trophy, Receipt, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { todayRange } from "@/components/DateFilter";
import { format } from "date-fns";
import { storeDataQueryKeys } from "@/lib/storeData";
import { DataError } from "@/components/DataError";

type RecentSale = { id: string; total_amount: number; net_sales: number; net_profit: number; created_at: string };

type DashData = {
  stats: { sales: number; profit: number; count: number };
  topProducts: { name: string; qty: number }[];
  recent: RecentSale[];
};

async function fetchDashboard(storeId: string): Promise<DashData> {
  const range = todayRange();
  const startISO = range.start.toISOString();
  const endISO = range.end.toISOString();
  const salesRes = await (supabase as any).from("sales")
    .select("id,total_amount,net_sales,net_profit,created_at")
    .eq("store_id", storeId)
    .gte("created_at", startISO).lte("created_at", endISO)
    .order("created_at", { ascending: false });
  // Never report ₱0.00 sales because the query failed.
  if (salesRes.error) throw new Error(salesRes.error.message || "Today's sales could not be loaded.");
  const sales = salesRes.data || [];
  const saleIds = sales.map((s: any) => s.id);
  const itemsRes = saleIds.length
    ? await supabase.from("sale_items").select("product_name,quantity").in("sale_id", saleIds)
    : { data: [] as { product_name: string; quantity: number }[], error: null };
  if (itemsRes.error) throw new Error(itemsRes.error.message || "Today's sold items could not be loaded.");
  const items = itemsRes.data || [];
  const map = new Map<string, number>();
  items.forEach((i: any) => { map.set(i.product_name, (map.get(i.product_name) || 0) + i.quantity); });
  const topProducts = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
  return {
    stats: {
      sales: sales.reduce((s: number, x: any) => s + Number(x.net_sales), 0),
      profit: sales.reduce((s: number, x: any) => s + Number(x.net_profit), 0),
      count: sales.length,
    },
    topProducts,
    recent: sales.slice(0, 5) as RecentSale[],
  };
}

export default function Dashboard() {
  const { store, permissions } = useAuth();
  const {
    products,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts({ storeId: store?.id, safeOnly: permissions.isCashier });
  const qc = useQueryClient();
  const { data, isLoading, error: dashboardError, refetch: refetchDashboard } = useQuery({
    queryKey: store?.id ? storeDataQueryKeys.dashboard(store.id) : ["store-data", "none", "dashboard"],
    queryFn: () => fetchDashboard(store!.id),
    enabled: !!store?.id && permissions.canViewProfit,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!store?.id) return;
    const ch = supabase.channel(`dash-sales-${store.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "sales",
        filter: `store_id=eq.${store.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: storeDataQueryKeys.dashboard(store.id) });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, store?.id]);

  const stats = data?.stats ?? { sales: 0, profit: 0, count: 0 };
  const topProducts = data?.topProducts ?? [];
  const recent = data?.recent ?? [];
  const lowStock = useMemo(() => products.filter(p => p.stock <= LOW_STOCK_THRESHOLD), [products]);
  const showStatsSkeleton = isLoading && !data;
  const showProductsSkeleton = productsLoading && products.length === 0;

  const cards = [
    ...(permissions.canViewProfit ? [
      { label: "Today's Net Sales", value: PESO(stats.sales), icon: Wallet, gradient: "bg-gradient-primary" },
      { label: "Today's Net Profit", value: PESO(stats.profit), icon: TrendingUp, gradient: "bg-gradient-success" },
      { label: "Transactions Today", value: stats.count.toString(), icon: ShoppingBag, gradient: "bg-gradient-accent" },
    ] : []),
    { label: "Low Stock", value: lowStock.length.toString(), icon: AlertTriangle, gradient: "bg-gradient-to-br from-warning to-destructive" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Magandang araw! 👋</h1>
        <p className="text-muted-foreground mt-1">Quick overview of your store today</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {showStatsSkeleton
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-xl" />)
          : dashboardError && !data ? (
            <DataError
              className="col-span-full"
              title="Today's figures could not be loaded"
              error={dashboardError}
              context="dashboard.fetchDashboard"
              onRetry={() => void refetchDashboard()}
            />
          ) : cards.map(c => (
              <Card key={c.label} className={`${c.gradient} text-primary-foreground p-5 border-0 shadow-card hover:shadow-elevated transition-base`}>
                <div className="flex items-start justify-between mb-4"><c.icon className="w-6 h-6 opacity-90" /></div>
                <div className="text-2xl md:text-3xl font-bold leading-tight">{c.value}</div>
                <div className="text-xs md:text-sm opacity-90 mt-1">{c.label}</div>
              </Card>
            ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5 md:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-lg">Top Selling Today</h2>
          </div>
          {dashboardError && !data ? (
            <p className="py-8 text-center text-sm text-destructive">Today's best sellers could not be loaded.</p>
          ) : topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No sales yet today</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{i + 1}</div>
                  <span className="flex-1 font-medium truncate">{p.name}</span>
                  <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">{p.qty} sold</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 md:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="font-bold text-lg">Low Stock Alerts</h2>
          </div>
          {showProductsSkeleton ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : productsError && products.length === 0 ? (
            <DataError
              title="Stock levels could not be loaded"
              error={productsError}
              context="dashboard.useProducts"
              onRetry={() => void refetchProducts()}
            />
          ) : lowStock.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">All products are well stocked ✨</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 5).map(p => (
                <Link to="/inventory" key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 hover:bg-warning/20 transition-base">
                  <span className="flex-1 font-medium truncate">{p.name}</span>
                  <Badge className="bg-warning text-warning-foreground hover:bg-warning">{p.stock} left</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {permissions.canViewProfit && <Card className="p-5 md:p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Recent Transactions</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/transactions">View All Reports <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
        {showStatsSkeleton ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : dashboardError && !data ? (
          <p className="py-6 text-center text-sm text-destructive">Recent transactions could not be loaded.</p>
        ) : recent.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">No transactions yet today</p>
        ) : (
          <div className="space-y-2">
            {recent.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{format(new Date(s.created_at), "h:mm a")}</div>
                  <div className="text-xs text-muted-foreground font-mono">TXN-{s.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary tabular-nums">{PESO(s.net_sales)}</div>
                  <div className="text-xs text-success">+{PESO(s.net_profit)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>}
    </div>
  );
}
