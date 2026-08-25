import { describe, it, expect } from "vitest";
import {
  buildHistoricalReceipt,
  LEGACY_ATTRIBUTION,
  resolveProcessorName,
  type HistoricalSale,
} from "@/lib/receipts";

const staffNames = {
  "cashier-1": "Ana Cruz",
  "admin-1": "Owner Admin",
};

const cashierSale: HistoricalSale = {
  id: "5f1e2d3c-0000-4000-8000-000000000000",
  created_at: "2026-07-15T02:30:00.000Z",
  created_by: "cashier-1",
  total_amount: "168.00",
  subtotal: "160.00",
  fees: [{ name: "Service fee", type: "percent", value: 5, amount: 8 }],
  payment_method: "cash",
  payment_reference: null,
  amount_tendered: "200.00",
  sale_items: [
    { product_name: "Coca-Cola 1.5L", quantity: 2, unit_price: "75.00", line_total: "150.00" },
    { product_name: "Bottled Water", quantity: 1, unit_price: "10.00", line_total: "10.00" },
  ],
};

describe("resolveProcessorName", () => {
  it("resolves the original processor from the store roster", () => {
    expect(resolveProcessorName("cashier-1", staffNames)).toBe("Ana Cruz");
  });

  it("falls back to Legacy/Unknown when attribution is missing", () => {
    expect(resolveProcessorName(null, staffNames)).toBe(LEGACY_ATTRIBUTION);
    expect(resolveProcessorName(undefined, staffNames)).toBe(LEGACY_ATTRIBUTION);
    expect(resolveProcessorName("deleted-user", staffNames)).toBe(LEGACY_ATTRIBUTION);
    expect(resolveProcessorName("blank-name", { "blank-name": "   " })).toBe(LEGACY_ATTRIBUTION);
  });
});

describe("buildHistoricalReceipt", () => {
  it("reprints the original transaction exactly", () => {
    const receipt = buildHistoricalReceipt(cashierSale, {
      storeName: "Aling Nena Store",
      resolveCashier: (createdBy) => resolveProcessorName(createdBy, staffNames),
    });

    expect(receipt.id).toBe(cashierSale.id);
    expect(receipt.createdAt).toBe("2026-07-15T02:30:00.000Z");
    expect(receipt.cashier).toBe("Ana Cruz");
    expect(receipt.method).toBe("cash");
    expect(receipt.subtotal).toBe(160);
    expect(receipt.fees).toEqual([{ name: "Service fee", type: "percent", value: 5, amount: 8 }]);
    expect(receipt.total).toBe(168);
    expect(receipt.tendered).toBe(200);
    expect(receipt.change).toBe(32);
    expect(receipt.items).toEqual([
      { name: "Coca-Cola 1.5L", quantity: 2, unit_price: 75, line_total: 150 },
      { name: "Bottled Water", quantity: 1, unit_price: 10, line_total: 10 },
    ]);
  });

  it("keeps the original payment method and reference for online payments", () => {
    const receipt = buildHistoricalReceipt(
      { ...cashierSale, payment_method: "gcash", payment_reference: "9182736450", amount_tendered: null },
      { storeName: "Aling Nena Store", resolveCashier: (id) => resolveProcessorName(id, staffNames) }
    );
    expect(receipt.method).toBe("gcash");
    expect(receipt.reference).toBe("9182736450");
    expect(receipt.tendered).toBeNull();
    expect(receipt.change).toBeNull();
  });

  it("does not attribute a Cashier's sale to the Admin who reprints it", () => {
    const receipt = buildHistoricalReceipt(cashierSale, {
      storeName: "Aling Nena Store",
      // An Admin is signed in, but attribution still comes from created_by.
      resolveCashier: (createdBy) => resolveProcessorName(createdBy, staffNames),
    });
    expect(receipt.cashier).toBe("Ana Cruz");
    expect(receipt.cashier).not.toBe("Owner Admin");
  });

  it("shows Legacy/Unknown for sales recorded before attribution existed", () => {
    const receipt = buildHistoricalReceipt(
      { ...cashierSale, created_by: null },
      { storeName: "Aling Nena Store", resolveCashier: (id) => resolveProcessorName(id, staffNames) }
    );
    expect(receipt.cashier).toBe(LEGACY_ATTRIBUTION);
  });

  it("derives the subtotal from line items when the sale has none stored", () => {
    const receipt = buildHistoricalReceipt(
      { ...cashierSale, subtotal: null, fees: null },
      { storeName: "Aling Nena Store", resolveCashier: () => LEGACY_ATTRIBUTION }
    );
    expect(receipt.subtotal).toBe(160);
  });

  it("never exposes COGS, buying cost or profit on a receipt", () => {
    const cashierRow = {
      ...cashierSale,
      // Shape returned by get_my_transactions: no financial fields at all.
      created_by: undefined,
    } as HistoricalSale;
    const receipt = buildHistoricalReceipt(cashierRow, {
      storeName: "Aling Nena Store",
      resolveCashier: () => "Ana Cruz",
    });

    const serialized = JSON.stringify(receipt);
    for (const field of ["cogs", "buying_price", "gross_profit", "net_profit", "total_profit", "unit_cost", "profit"]) {
      expect(serialized).not.toContain(field);
    }
    expect(Object.keys(receipt).sort()).toEqual([
      "cashier", "change", "createdAt", "fees", "id", "items",
      "method", "reference", "storeName", "subtotal", "tendered", "total",
    ]);
  });
});
