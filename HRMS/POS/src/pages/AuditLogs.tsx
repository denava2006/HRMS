import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ScrollText } from "lucide-react";
import { DataError } from "@/components/DataError";

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
};

const labels: Record<string, string> = {
  staff_created: "Staff created",
  staff_role_changed: "Staff role changed",
  staff_activated: "Staff activated",
  staff_deactivated: "Staff deactivated",
  staff_password_reset: "Staff password reset",
  product_created: "Product created",
  product_edited: "Product edited",
  // Distinct stock stories. `stock_adjusted` now only means a manual change;
  // rows recorded before the audit-clarity migration keep their old label.
  stock_adjusted: "Stock adjusted manually",
  sale_stock_deducted: "Stock deducted by sale",
  stock_restocked: "Stock added by restock",
  inventory_restocked: "Restock recorded",
  inventory_adjusted: "Manual stock adjustment recorded",
  product_archived: "Product archived",
  product_soft_deleted: "Product removed",
  // The database action name predates the Settings page being dissolved; it is
  // written by the store-update trigger, which now means branch configuration.
  settings_changed: "Branch settings changed",
  sale_completed: "Sale completed",
  category_created: "Category created",
  category_edited: "Category edited",
  category_archived: "Category archived",
  category_restored: "Category restored",
  category_reordered: "Category reordered",
  category_deleted: "Category deleted",
  category_products_reassigned: "Products moved to another category",
};

const descriptions: Record<string, string> = {
  stock_adjusted: "Someone changed stock by hand (count correction, damage, expiry).",
  sale_stock_deducted: "Stock went down automatically because a sale was completed.",
  stock_restocked: "Stock went up because new inventory was purchased.",
  sale_completed: "A checkout finished and the sale was recorded.",
};

export default function AuditLogs() {
  const { store, membership } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_type, entity_id, old_values, new_values, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error: queryError }: { data: AuditLog[] | null; error: Error | null }) => {
        if (cancelled) return;
        // An unreadable log must not look like an empty log.
        if (queryError) setError(queryError);
        else { setError(null); setLogs(data ?? []); }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadToken, store]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) =>
      `${labels[log.action] ?? log.action} ${log.entity_type} ${log.entity_id ?? ""}`.toLowerCase().includes(term)
    );
  }, [logs, search]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          {membership?.role === "manager" ? "Operational activity for your store." : "Administrative and operational activity for your store."}
        </p>
      </header>
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action or entity…" className="pl-9" />
        </div>
      </Card>
      {loading ? (
        <Card className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></Card>
      ) : error ? (
        <DataError
          title="Audit records could not be loaded"
          error={error}
          context="auditLogs.query"
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ScrollText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No audit records found.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{labels[log.action] ?? log.action.split("_").join(" ")}</div>
                  {descriptions[log.action] && (
                    <div className="text-xs text-muted-foreground mt-0.5">{descriptions[log.action]}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleString()} · User {log.user_id?.slice(0, 8) ?? "system"}
                  </div>
                </div>
                <Badge variant="secondary">{log.entity_type}</Badge>
              </div>
              {log.entity_id && <div className="mt-2 text-[10px] font-mono text-muted-foreground">ID: {log.entity_id}</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
