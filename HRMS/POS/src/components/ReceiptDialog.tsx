import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Receipt as ReceiptIcon } from "lucide-react";
import { PESO } from "@/lib/format";
import type { CartItem, PaymentMethod } from "@/lib/store";
import type { AppliedFee } from "@/lib/fees";

export type ReceiptData = {
  id: string;
  createdAt: string;
  storeName: string;
  cashier?: string;
  items: { name: string; quantity: number; unit_price: number; line_total: number }[];
  subtotal?: number;
  fees?: AppliedFee[];
  total: number;
  method: PaymentMethod;
  reference?: string | null;
  tendered?: number | null;
  change?: number | null;
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank Transfer",
  other: "Other",
};

export function buildReceipt(opts: {
  sale: { id: string; created_at: string };
  cart: CartItem[];
  total: number;
  subtotal?: number;
  fees?: AppliedFee[];
  method: PaymentMethod;
  reference?: string | null;
  tendered?: number | null;
  storeName: string;
  cashier?: string;
}): ReceiptData {
  const change = opts.method === "cash" && opts.tendered != null ? opts.tendered - opts.total : null;
  return {
    id: opts.sale.id,
    createdAt: opts.sale.created_at,
    storeName: opts.storeName,
    cashier: opts.cashier,
    items: opts.cart.map(c => ({
      name: c.product.name,
      quantity: c.quantity,
      unit_price: Number(c.product.selling_price),
      line_total: Number(c.product.selling_price) * c.quantity,
    })),
    subtotal: opts.subtotal,
    fees: opts.fees,
    total: opts.total,
    method: opts.method,
    reference: opts.reference ?? null,
    tendered: opts.tendered ?? null,
    change,
  };
}

export function ReceiptDialog({ data, open, onClose }: { data: ReceiptData | null; open: boolean; onClose: () => void }) {
  if (!data) return null;
  const shortId = `TXN-${data.id.slice(0, 8).toUpperCase()}`;
  const dateStr = new Date(data.createdAt).toLocaleString("en-PH", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  const handlePrint = () => {
    const node = document.getElementById("receipt-printable");
    if (!node) return;
    const w = window.open("", "PRINT", "height=600,width=400");
    if (!w) return;
    w.document.write(`<html><head><title>${shortId}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .muted { color: #555; font-size: 11px; }
        .bold { font-weight: 700; }
        .lg { font-size: 16px; }
        hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { vertical-align: top; padding: 2px 0; }
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 font-bold">
            <ReceiptIcon className="w-5 h-5 text-success" /> Receipt
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div id="receipt-printable" className="px-5 py-4 text-sm">
          <div className="center" style={{ textAlign: "center" }}>
            <div className="bold lg" style={{ fontWeight: 700, fontSize: 16 }}>{data.storeName.toUpperCase()}</div>
            <div className="muted" style={{ color: "#555", fontSize: 11 }}>Powered by SariSync POS</div>
          </div>
          <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "10px 0" }} />
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted" style={{ color: "#555" }}>Receipt</span>
            <span className="bold" style={{ fontWeight: 700 }}>{shortId}</span>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted" style={{ color: "#555" }}>Date</span>
            <span>{dateStr}</span>
          </div>
          {data.cashier && (
            <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted" style={{ color: "#555" }}>Cashier</span>
              <span>{data.cashier}</span>
            </div>
          )}
          <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "10px 0" }} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ padding: "3px 0" }}>
                    <div className="bold" style={{ fontWeight: 600 }}>{it.name}</div>
                    <div className="muted" style={{ color: "#555", fontSize: 11 }}>{it.quantity} × {PESO(it.unit_price)}</div>
                  </td>
                  <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 700 }}>{PESO(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "10px 0" }} />
          {data.fees && data.fees.length > 0 && (
            <>
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted" style={{ color: "#555" }}>Subtotal</span>
                <span className="tabular-nums">{PESO(data.subtotal ?? data.total)}</span>
              </div>
              {data.fees.map((f, i) => (
                <div key={i} className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted" style={{ color: "#555" }}>
                    {f.name}{f.type === "percent" ? ` (${f.value}%)` : ""}
                  </span>
                  <span className="tabular-nums">{PESO(f.amount)}</span>
                </div>
              ))}
            </>
          )}
          <div className="row bold lg" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, marginTop: 6 }}>
            <span>TOTAL</span>
            <span style={{ color: "#0a9d4a" }}>{PESO(data.total)}</span>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span className="muted" style={{ color: "#555" }}>Payment</span>
            <span>{METHOD_LABEL[data.method]}</span>
          </div>
          {data.method === "cash" && data.tendered != null && (
            <>
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted" style={{ color: "#555" }}>Cash</span>
                <span>{PESO(data.tendered)}</span>
              </div>
              <div className="row bold" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Change</span>
                <span>{PESO(Math.max(0, data.change || 0))}</span>
              </div>
            </>
          )}
          {data.reference && (
            <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted" style={{ color: "#555" }}>Ref #</span>
              <span style={{ fontFamily: "monospace" }}>{data.reference}</span>
            </div>
          )}
          <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "10px 0" }} />
          <div className="center muted" style={{ textAlign: "center", color: "#555", fontSize: 11 }}>
            Thank you for your purchase!<br />Please keep this receipt for returns.
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t bg-secondary/30">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1 bg-gradient-success shadow-pop" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
