import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PESO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, TrendingUp, Calendar, Printer } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { DateFilter, todayRange, type DateRange } from "@/components/DateFilter";
import { useAuth } from "@/lib/auth";
import { ReceiptDialog, type ReceiptData } from "@/components/ReceiptDialog";
import type { AppliedFee } from "@/lib/fees";
import { storeDataQueryKeys } from "@/lib/storeData";
import { buildHistoricalReceipt, LEGACY_ATTRIBUTION, resolveProcessorName } from "@/lib/receipts";
import { DataError } from "@/components/DataError";

type Sale = {
  id: string;
  total_amount: number;
  total_profit?: number;
  gross_sales?: number;
  net_sales?: number;
  total_cogs?: number;
  gross_profit?: number;
  net_profit?: number;
  store_paid_deductions?: number;
  created_at: string;
  payment_method: string;
  payment_reference: string | null;
  amount_tendered?: number | null;
  fees?: AppliedFee[] | null;
  subtotal?: number | null;
  created_by?: string | null;
  sale_items: { id: string; product_name: string; quantity: number; unit_price: number; line_total: number; line_profit?: number; line_cogs?: number | null; line_gross_profit?: number | null }[];
};

const METHOD_STYLES: Record<string, string> = {
  cash: "bg-success/10 text-success border-success/20",
  gcash: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  maya: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  bank: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

async function fetchSales(range: DateRange, storeId: string, cashierOnly: boolean): Promise<Sale[]> {
  if (cashierOnly) {
    const { data, error } = await supabase.rpc("get_my_transactions", {
      _store_id: storeId,
      _start_at: range.start.toISOString(),
      _end_at: range.end.toISOString(),
      _limit_count: 200,
    });
    // A network, authorization or database failure must never look like
    // "no sales today" — surface it so the error state renders instead.
    if (error) throw new Error(error.message || "Transactions could not be loaded.");
    return (data ?? []) as unknown as Sale[];
  }
  const { data, error } = await supabase
    .from("sales")
    .select("*, sale_items(*)")
    .eq("store_id", storeId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message || "Transactions could not be loaded.");
  return (data ?? []) as unknown as Sale[];
}

/**
 * Every staff member who has ever been assigned to this store, active or not,
 * so a historical sale still resolves to the person who processed it.
 */
async function fetchStaffNames(storeId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("store_memberships")
    .select("user_id, display_name, role")
    .eq("store_id", storeId);
  if (error) throw new Error(error.message || "Staff names could not be loaded.");
  return Object.fromEntries((data ?? []).map((row) => [
    row.user_id,
    row.display_name?.trim() || `${row.role[0].toUpperCase()}${row.role.slice(1)}`,
  ]));
}

export default function Transactions() {
  const qc = useQueryClient();
  const { store, membership, permissions, user } = useAuth();
  const [range, setRange] = useState<DateRange>(() => todayRange());
  const rangeKey = `${range.start.toISOString()}_${range.end.toISOString()}`;
  const accessScope = permissions.isCashier ? `cashier:${user?.id ?? "unknown"}` : "management";
  const { data: sales = [], isLoading, error: salesError, refetch: refetchSales } = useQuery({
    queryKey: store?.id
      ? storeDataQueryKeys.transactionList(store.id, accessScope, rangeKey)
      : ["store-data", "none", "transactions", accessScope, rangeKey],
    queryFn: () => fetchSales(range, store!.id, permissions.isCashier),
    enabled: !!store?.id,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const loading = isLoading && sales.length === 0;

  const { data: cashierNames = {}, error: staffNamesError } = useQuery({
    queryKey: store?.id ? ["store-data", store.id, "staff-names"] : ["store-data", "none", "staff-names"],
    queryFn: () => fetchStaffNames(store!.id),
    enabled: Boolean(store?.id) && !permissions.isCashier,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!store?.id) return;
    const ch = supabase.channel(`tx-sales-${store.id}-${accessScope}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sales",
        filter: `store_id=eq.${store.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: storeDataQueryKeys.transactions(store.id) });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [accessScope, qc, store?.id]);

  const totalRevenue = sales.reduce((s, x) => s + Number(x.net_sales ?? x.subtotal ?? x.total_amount), 0);
  const totalCogs = permissions.canViewProfit
    ? sales.reduce((sum, sale) => sum + Number(sale.total_cogs ?? 0), 0)
    : 0;
  const totalProfit = permissions.canViewProfit
    ? sales.reduce((sum, sale) => sum + Number(sale.net_profit ?? sale.total_profit ?? 0), 0)
    : 0;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  /**
   * Attribution for a reprint. Cashiers only ever receive their own sales from
   * get_my_transactions, so their own name is correct there. Admins and
   * Managers always get the ORIGINAL processor — never themselves.
   */
  const resolveCashier = useCallback((createdBy: string | null | undefined) => {
    if (permissions.isCashier) {
      return membership?.display_name?.trim() || user?.email || LEGACY_ATTRIBUTION;
    }
    return resolveProcessorName(createdBy, cashierNames);
  }, [cashierNames, membership?.display_name, permissions.isCashier, user?.email]);

  const openReceipt = (sale: Sale) => {
    setReceipt(buildHistoricalReceipt(sale, {
      storeName: store?.name || "Store",
      resolveCashier,
    }));
  };

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{permissions.isCashier ? "My Transactions" : "Transaction History"}</h1>
        <p className="text-muted-foreground text-sm">{sales.length} sales — {range.label}</p>
      </div>

      <DateFilter value={range} onChange={setRange} />

      {staffNamesError && (
        <Card className="border-warning/30 bg-warning/10 p-3 text-sm">
          Staff names could not be loaded, so sales show as “{LEGACY_ATTRIBUTION}”. Every other detail is accurate.
        </Card>
      )}

      {salesError && sales.length > 0 && (
        <Card className="border-warning/30 bg-warning/10 p-3 text-sm">
          Showing the last results that loaded successfully — the newest refresh did not complete.
        </Card>
      )}

      <div className={`grid gap-3 ${permissions.canViewProfit ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
        <Card className="p-4 bg-gradient-primary text-primary-foreground shadow-card">
          <Receipt className="w-5 h-5 mb-2 opacity-90" />
          <div className="text-xl md:text-2xl font-bold">{sales.length}</div>
          <div className="text-xs opacity-90">Transactions</div>
        </Card>
        <Card className="p-4 bg-gradient-accent text-accent-foreground shadow-card">
          <Calendar className="w-5 h-5 mb-2 opacity-90" />
          <div className="text-xl md:text-2xl font-bold">{PESO(totalRevenue)}</div>
          <div className="text-xs opacity-90">Revenue</div>
        </Card>
        {permissions.canViewProfit && (
          <Card className="p-4 bg-gradient-accent text-accent-foreground shadow-card">
            <Calendar className="w-5 h-5 mb-2 opacity-90" />
            <div className="text-xl md:text-2xl font-bold">{PESO(totalCogs)}</div>
            <div className="text-xs opacity-90">COGS</div>
          </Card>
        )}
        {permissions.canViewProfit && (
          <Card className="p-4 bg-gradient-success text-success-foreground shadow-card">
            <TrendingUp className="w-5 h-5 mb-2 opacity-90" />
            <div className="text-xl md:text-2xl font-bold">{PESO(totalProfit)}</div>
            <div className="text-xs opacity-90">Net Profit</div>
          </Card>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : salesError && sales.length === 0 ? (
          <DataError
            title="Transactions could not be loaded"
            error={salesError}
            context="transactions.fetchSales"
            onRetry={() => void refetchSales()}
          />
        ) : sales.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            No transactions for {range.label}
          </Card>
        ) : sales.map(sale => (
          <Card key={sale.id} className="shadow-card overflow-hidden">
            <Collapsible>
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-secondary/40 transition-base text-left">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{format(new Date(sale.created_at), "MMM d, yyyy · h:mm a")}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-foreground/80">TXN-{sale.id.slice(0, 8).toUpperCase()}</span>
                    <span>· {sale.sale_items.length} items</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${METHOD_STYLES[sale.payment_method] || METHOD_STYLES.other}`}>
                      {sale.payment_method || "cash"}
                    </span>
                    {sale.payment_reference && <span className="font-mono text-[10px]">{sale.payment_reference}</span>}
                    {!permissions.isCashier && (
                      <span>· Processed by {resolveProcessorName(sale.created_by, cashierNames)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 mr-3">
                  <div className="font-bold text-primary tabular-nums">{PESO(sale.total_amount)}</div>
                  {permissions.canViewProfit && <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-[10px]">+{PESO(sale.net_profit ?? sale.total_profit ?? 0)}</Badge>}
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t bg-secondary/20 px-4 py-3">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium pb-2">Item</th>
                        <th className="text-center font-medium pb-2">Qty</th>
                        <th className="text-right font-medium pb-2">Price</th>
                        <th className="text-right font-medium pb-2">Total</th>
                        {permissions.canViewProfit && <th className="text-right font-medium pb-2">COGS</th>}
                        {permissions.canViewProfit && <th className="text-right font-medium pb-2">Gross Profit</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sale.sale_items.map(item => (
                        <tr key={item.id} className="border-t border-border/50">
                          <td className="py-2 font-medium">{item.product_name}</td>
                          <td className="py-2 text-center">{item.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{PESO(item.unit_price)}</td>
                          <td className="py-2 text-right tabular-nums font-semibold">{PESO(item.line_total)}</td>
                          {permissions.canViewProfit && <td className="py-2 text-right tabular-nums">{PESO(item.line_cogs ?? 0)}</td>}
                          {permissions.canViewProfit && <td className="py-2 text-right tabular-nums text-success">{PESO(item.line_gross_profit ?? item.line_profit ?? 0)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-end mt-3">
                    <Button size="sm" variant="outline" onClick={() => openReceipt(sale)}>
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> View Receipt
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
      <ReceiptDialog data={receipt} open={!!receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
