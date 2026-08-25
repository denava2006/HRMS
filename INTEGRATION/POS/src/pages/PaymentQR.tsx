/**
 * Payment QR / QRPh — Admin module.
 *
 * Today this configures a MANUAL payment QR: the Admin uploads a static QR
 * image, the cashier shows it at checkout, and the cashier types the reference
 * the customer reads back. That reference is never verified against the payment
 * provider — it is an operator's note, not proof of payment.
 *
 * This module is the intended home for PayMongo QRPh configuration. When that
 * lands, the boundary must be:
 *
 *   - The PayMongo SECRET key never appears in this file, in any file under
 *     src/, in .env.local, or in any value reachable by the browser. Vite
 *     inlines every VITE_* variable into the shipped bundle, so a secret placed
 *     there is public. It belongs in Edge Function secrets
 *     (`npx supabase secrets set PAYMONGO_SECRET_KEY=...`), read server-side via
 *     Deno.env, exactly as SUPABASE_SERVICE_ROLE_KEY already is in
 *     supabase/functions/_shared/staff-auth.ts.
 *   - QRPh payment intents are created by an Edge Function, which authenticates
 *     the caller's store membership the way manage-staff-user already does.
 *   - The browser receives display-safe data only: QR image URL, checkout URL,
 *     payment status and provider reference.
 *   - A sale is marked paid only after PayMongo confirms it, by webhook or by a
 *     server-side status check. A cashier typing a reference must never be
 *     sufficient for a verified payment.
 *   - Verified QRPh payments stay a distinct payment path from the manual QR
 *     below, so reporting can tell confirmed money from asserted money.
 *
 * None of that is implemented yet, and this module deliberately does not call
 * PayMongo. See the "Payment QR / QRPh" section of README.md.
 */
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Loader2, QrCode, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { logTechnicalError, userFacingError } from "@/lib/errors";

export default function PaymentQR() {
  const { store, refreshStore } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const currentUrl = store?.payment_qr_url || null;

  const handleFile = async (file: File) => {
    if (!store) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setBusy(true);
    try {
      // The upload path must be qr/<store_id>/<uuid>.<ext>. The storage policy
      // reads foldername(name)[2] and requires it to parse as this store's
      // UUID, so a flat "qr/<store_id>-<timestamp>.png" name has no second
      // segment and is rejected by RLS. The extension is sanitised because it
      // becomes part of the object path.
      const ext = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase() || "png";
      const path = `qr/${store.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const { error } = await supabase.from("stores").update({ payment_qr_url: data.publicUrl }).eq("id", store.id);
      if (error) throw error;
      await refreshStore();
      toast.success("Payment QR updated");
    } catch (uploadError) {
      logTechnicalError("paymentQr.upload", uploadError);
      toast.error(userFacingError(uploadError, "The payment QR could not be uploaded. Please try again."));
    } finally { setBusy(false); }
  };

  const removeQR = async () => {
    if (!store) return;
    setBusy(true);
    const { error } = await supabase.from("stores").update({ payment_qr_url: null }).eq("id", store.id);
    setBusy(false);
    if (error) {
      logTechnicalError("paymentQr.remove", error);
      return toast.error(userFacingError(error, "The payment QR could not be removed. Please try again."));
    }
    await refreshStore();
    toast.success("Payment QR removed");
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Payment QR / QRPh</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How customers pay {store?.name} by e-wallet or bank transfer.
        </p>
      </header>

      {/* ---------------- Manual QR: the behaviour that exists today --------------- */}
      <Card className="p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">Manual payment QR</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your own GCash, Maya or bank QR. It appears at checkout when the customer picks an
              e-payment method.
            </p>
          </div>
          <Badge variant={currentUrl ? "default" : "secondary"}>{currentUrl ? "Active" : "Not set"}</Badge>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-secondary/20 p-6">
          <div className="w-56 h-56 rounded-xl bg-white p-3 shadow-sm flex items-center justify-center">
            {currentUrl ? (
              <img src={currentUrl} alt="Your payment QR" className="w-full h-full object-contain" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-slate-500">
                <QrCode className="h-20 w-20" />
                <span className="text-sm font-medium">Upload your payment QR</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {currentUrl ? "Your custom QR is active." : "No payment QR uploaded yet."}
          </p>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button disabled={busy} onClick={() => fileRef.current?.click()} className="bg-gradient-primary shadow-pop">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              {currentUrl ? "Replace QR" : "Upload QR"}
            </Button>
            {currentUrl && (
              <Button variant="outline" disabled={busy} onClick={removeQR} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
          <p>
            A manual QR is <span className="font-semibold">not verified</span>. The cashier types the
            reference the customer reads out, and the system records it as entered — nothing checks it
            against GCash, Maya or the bank. Reconcile these against your provider statements.
          </p>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <QrCode className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Use the QR from your bank or e-wallet app. Make sure it is clear and high resolution so
            customers can scan it easily. Images up to 5MB.
          </p>
        </div>
      </Card>

      {/* ------------- PayMongo QRPh: reserved, deliberately not wired up ---------- */}
      <Card className="p-5 md:p-6 space-y-4 border-dashed">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Verified QRPh via PayMongo
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              One QRPh code that GCash, Maya and QRPh-capable bank apps can all scan, with payment
              confirmed by the provider instead of typed by the cashier.
            </p>
          </div>
          <Badge variant="secondary">Not configured</Badge>
        </div>

        <div className="rounded-lg bg-secondary/40 p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">What changes when this is switched on</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>QRPh codes are generated per sale by the server, not uploaded once by hand.</li>
            <li>A sale is marked paid only after PayMongo confirms it — never on a typed reference.</li>
            <li>Verified payments stay separate from manual ones, so reports can tell them apart.</li>
            <li>The manual QR above remains available as a fallback.</li>
          </ul>
          <p className="pt-1">
            Setup will ask for your PayMongo keys. The secret key is stored as an Edge Function
            secret on this computer and is never sent to the browser.
          </p>
        </div>

        <Button variant="outline" disabled className="w-full sm:w-auto">
          Connect PayMongo — coming soon
        </Button>
      </Card>
    </div>
  );
}
