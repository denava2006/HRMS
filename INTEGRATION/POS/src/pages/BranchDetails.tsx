/**
 * Branch Details — Admin module.
 *
 * Edits the branch's own record on `stores`: display name, owner name, phone
 * and address. These appear on the printed receipt and in the sidebar, so they
 * are operational data rather than app preferences.
 *
 * Currency is intentionally not editable here. The branch is fixed to the
 * currency it was created with; changing it would reinterpret every stored
 * amount without converting any of them.
 *
 * Only an active Admin of this branch can save. That is enforced by the
 * "Admins update assigned stores" RLS policy, not by hiding the form.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Store as StoreIcon, User, Phone, MapPin, Mail, Check, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { getCurrency } from "@/lib/currencies";
import { logTechnicalError, userFacingError } from "@/lib/errors";

export default function BranchDetails() {
  const { store, user, refreshStore } = useAuth();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const currency = getCurrency(store?.currency);

  useEffect(() => {
    if (store) {
      setName(store.name || "");
      setOwner(store.owner_name || "");
      setPhone(store.phone || "");
      setAddress(store.address || "");
    }
  }, [store]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("stores")
      .update({
        name: name.trim(),
        owner_name: owner.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", store.id);
    setBusy(false);
    if (error) {
      logTechnicalError("branchDetails.save", error);
      return toast.error(userFacingError(error, "Branch details could not be saved. Please try again."));
    }
    await refreshStore();
    toast.success("Branch details updated");
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Branch Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The name, contact and address printed on this branch's receipts.
        </p>
      </header>

      <Card className="p-5 md:p-6">
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Account Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={user?.email || ""} readOnly disabled className="pl-10 h-11 cursor-not-allowed bg-secondary/40" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Branch Name</Label>
            <div className="relative">
              <StoreIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={name} onChange={e => setName(e.target.value)} className="pl-10 h-11" placeholder="Your branch name" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Owner Name <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={owner} onChange={e => setOwner(e.target.value)} className="pl-10 h-11" placeholder="Enter owner name" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Phone Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="pl-10 h-11" placeholder="Enter phone number" inputMode="tel" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Textarea value={address} onChange={e => setAddress(e.target.value)} className="pl-10 min-h-[90px]" placeholder="Enter branch address" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Currency</Label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 h-11 text-sm">
              <span>{currency.flag}</span>
              <span className="font-medium">{currency.code}</span>
              <span className="text-muted-foreground">({currency.symbol})</span>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-0.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Fixed for this branch. Every recorded amount is stored in this currency, so switching
              it would relabel past sales without converting them.
            </p>
          </div>

          <Button type="submit" disabled={busy || !name.trim()} className="w-full h-11 bg-gradient-primary shadow-pop">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save Branch Details</>}
          </Button>
        </form>
      </Card>
    </div>
  );
}
