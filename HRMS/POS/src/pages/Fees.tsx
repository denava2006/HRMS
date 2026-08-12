/**
 * Additional Fees — Admin module.
 *
 * These fees are stored on `stores.fees` and applied at checkout. The database
 * is the authority: `public.secure_checkout` re-reads the store's fee list and
 * recomputes every amount server-side, so editing this page cannot change what
 * a past sale was charged, and a modified client cannot invent a fee.
 *
 * `src/lib/fees.ts` mirrors that arithmetic exactly — enabled fees with a
 * positive value and a known type, each amount rounded to 2 decimals before it
 * is summed — so the total the cashier sees is the total the database charges.
 * If the two ever drift, the till rejects an exact cash tender as short.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { computeFees, sumFees, type Fee, newFeeId } from "@/lib/fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Percent, Coins, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCurrency } from "@/lib/currencies";
import { PESO } from "@/lib/format";
import type { Json } from "@/integrations/supabase/types";

/** Sample basket used only to preview what the configured fees would add. */
const PREVIEW_SUBTOTAL = 100;

export default function Fees() {
  const { store, refreshStore } = useAuth();
  const [fees, setFees] = useState<Fee[]>([]);
  const [saving, setSaving] = useState(false);
  const symbol = getCurrency(store?.currency).symbol;

  useEffect(() => {
    setFees((store?.fees as Fee[] | null) ?? []);
  }, [store]);

  const add = () =>
    setFees((f) => [
      ...f,
      { id: newFeeId(), name: "", type: "percent", value: 0, enabled: true },
    ]);

  const update = (id: string, patch: Partial<Fee>) =>
    setFees((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const remove = (id: string) => setFees((f) => f.filter((x) => x.id !== id));

  const save = async () => {
    if (!store) return;
    for (const f of fees) {
      if (!f.name.trim()) return toast.error("Every fee needs a name");
      if (Number(f.value) < 0) return toast.error("Fee value can't be negative");
    }
    setSaving(true);
    const { error } = await supabase
      .from("stores")
      // Fee[] is structurally valid JSON; the generated column type is Json.
      .update({ fees: fees as unknown as Json })
      .eq("id", store.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshStore();
    toast.success("Fees saved");
  };

  const presets = [
    { name: "VAT", type: "percent" as const, value: 12 },
    { name: "Service Charge", type: "percent" as const, value: 10 },
    { name: "Delivery Fee", type: "fixed" as const, value: 50 },
  ];

  const addPreset = (p: { name: string; type: "percent" | "fixed"; value: number }) => {
    if (fees.some((f) => f.name.toLowerCase() === p.name.toLowerCase())) {
      return toast.error(`${p.name} already added`);
    }
    setFees((f) => [...f, { id: newFeeId(), enabled: true, ...p }]);
  };

  // Previewed with the same helper checkout uses, so this cannot drift from it.
  const previewFees = computeFees(PREVIEW_SUBTOTAL, fees);
  const previewTotal = PREVIEW_SUBTOTAL + sumFees(previewFees);
  const activeCount = fees.filter((f) => f.enabled && Number(f.value) > 0).length;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Additional Fees</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Charges like VAT or a service fee, added automatically at checkout for {store?.name}.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p.name} variant="outline" size="sm" onClick={() => addPreset(p)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {p.name} ({p.type === "percent" ? `${p.value}%` : `${symbol}${p.value}`})
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {fees.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No additional fees yet. Add one below or pick a preset above.
          </Card>
        )}
        {fees.map((f) => (
          <Card key={f.id} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Input
                value={f.name}
                onChange={(e) => update(f.id, { name: e.target.value })}
                placeholder="Fee name (e.g. VAT)"
                className="font-semibold"
              />
              <Switch checked={f.enabled} onCheckedChange={(v) => update(f.id, { enabled: v })} />
              <Button variant="ghost" size="icon" onClick={() => remove(f.id)} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => update(f.id, { type: "percent" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 text-sm py-2 font-semibold",
                    f.type === "percent" ? "bg-primary text-primary-foreground" : "bg-card"
                  )}
                >
                  <Percent className="w-3.5 h-3.5" /> %
                </button>
                <button
                  type="button"
                  onClick={() => update(f.id, { type: "fixed" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 text-sm py-2 font-semibold",
                    f.type === "fixed" ? "bg-primary text-primary-foreground" : "bg-card"
                  )}
                >
                  <Coins className="w-3.5 h-3.5" /> Fixed
                </button>
              </div>
              <div>
                <Label className="sr-only">Value</Label>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={f.value}
                    onChange={(e) => update(f.id, { value: Number(e.target.value) || 0 })}
                    className="pr-10 text-right font-bold tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {f.type === "percent" ? "%" : symbol}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={add} className="flex-1">
          <Plus className="w-4 h-4 mr-1" /> Add fee
        </Button>
        <Button onClick={save} disabled={saving} className="flex-1 bg-gradient-primary shadow-pop">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      {activeCount > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="font-semibold text-sm">Preview on a {PESO(PREVIEW_SUBTOTAL)} sale</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{PESO(PREVIEW_SUBTOTAL)}</span>
            </div>
            {previewFees.map((f, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>{f.name || "Unnamed fee"}{f.type === "percent" ? ` (${f.value}%)` : ""}</span>
                <span className="tabular-nums">{PESO(f.amount)}</span>
              </div>
            ))}
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="tabular-nums text-primary">{PESO(previewTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Enabled fees apply to every new sale. Changes never affect sales already recorded — each
          sale stores the fees that were charged at the time. Disabling a fee is safer than deleting
          it if you may need it again.
        </p>
      </div>
    </div>
  );
}
