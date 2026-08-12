import type { ReceiptData } from "@/components/ReceiptDialog";
import type { AppliedFee } from "@/lib/fees";
import type { PaymentMethod } from "@/lib/store";

/** Shown when a historical sale has no resolvable original processor. */
export const LEGACY_ATTRIBUTION = "Legacy/Unknown";

export type HistoricalSaleItem = {
  product_name: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
};

export type HistoricalSale = {
  id: string;
  created_at: string;
  created_by?: string | null;
  total_amount: number | string;
  subtotal?: number | string | null;
  fees?: AppliedFee[] | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  amount_tendered?: number | string | null;
  sale_items?: HistoricalSaleItem[] | null;
};

/**
 * Resolves the ORIGINAL processor of a stored sale.
 *
 * It never falls back to the signed-in user: an Admin or Manager reprinting a
 * Cashier's sale must not appear as the cashier. Unknown attribution is shown
 * as `Legacy/Unknown` instead.
 */
export function resolveProcessorName(
  createdBy: string | null | undefined,
  staffNames: Record<string, string>
): string {
  if (!createdBy) return LEGACY_ATTRIBUTION;
  const name = staffNames[createdBy];
  return name && name.trim() ? name.trim() : LEGACY_ATTRIBUTION;
}

const num = (value: number | string | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Rebuilds a receipt from the stored sale so a reprint shows exactly what was
 * recorded at the time: original number, date, processor, payment method and
 * reference, tendered amount, change, line items, fees and total.
 */
export function buildHistoricalReceipt(
  sale: HistoricalSale,
  options: { storeName: string; resolveCashier: (createdBy: string | null | undefined) => string }
): ReceiptData {
  const items = (sale.sale_items ?? []).map((item) => ({
    name: item.product_name,
    quantity: num(item.quantity),
    unit_price: num(item.unit_price),
    line_total: num(item.line_total),
  }));
  const total = num(sale.total_amount);
  const subtotal = sale.subtotal != null
    ? num(sale.subtotal)
    : items.reduce((sum, item) => sum + item.line_total, 0);
  const method = (sale.payment_method as PaymentMethod) || "cash";
  const tendered = method === "cash" && sale.amount_tendered != null ? num(sale.amount_tendered) : null;

  return {
    id: sale.id,
    createdAt: sale.created_at,
    storeName: options.storeName,
    cashier: options.resolveCashier(sale.created_by),
    items,
    subtotal,
    fees: Array.isArray(sale.fees) ? sale.fees : undefined,
    total,
    method,
    reference: sale.payment_reference ?? null,
    tendered,
    change: tendered != null ? tendered - total : null,
  };
}
