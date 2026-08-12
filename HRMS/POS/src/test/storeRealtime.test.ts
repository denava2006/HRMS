import { describe, it, expect } from "vitest";
import { applyRealtimeProductChange, shouldShowProductInCache, type Product } from "@/lib/store";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Coca-Cola 1.5L",
  category: "Beverages",
  category_id: "c1",
  stock: 10,
  buying_price: 55,
  selling_price: 75,
  image_url: null,
  is_archived: false,
  is_deleted: false,
  store_id: "store-a",
  ...overrides,
});

describe("shouldShowProductInCache", () => {
  it("requires is_deleted = false, is_archived = false and a matching store", () => {
    expect(shouldShowProductInCache({ is_deleted: false, is_archived: false, store_id: "store-a" }, "store-a")).toBe(true);
    expect(shouldShowProductInCache({ is_deleted: true, is_archived: false, store_id: "store-a" }, "store-a")).toBe(false);
    expect(shouldShowProductInCache({ is_deleted: false, is_archived: true, store_id: "store-a" }, "store-a")).toBe(false);
    expect(shouldShowProductInCache({ is_deleted: false, is_archived: false, store_id: "store-b" }, "store-a")).toBe(false);
    expect(shouldShowProductInCache({ is_deleted: false, is_archived: false, store_id: "store-a" }, null)).toBe(false);
  });
});

describe("applyRealtimeProductChange", () => {
  it("removes an archived product immediately", () => {
    const list = [product()];
    const next = applyRealtimeProductChange(
      list,
      { eventType: "UPDATE", new: product({ is_archived: true }), old: product() },
      "store-a"
    );
    expect(next).toHaveLength(0);
  });

  it("never lets an archived product reappear through a later event", () => {
    let list: Product[] = [];
    for (const event of ["INSERT", "UPDATE", "UPDATE"] as const) {
      list = applyRealtimeProductChange(list, { eventType: event, new: product({ is_archived: true }), old: null }, "store-a");
    }
    expect(list).toHaveLength(0);
  });

  it("brings a restored product back", () => {
    const archived = product({ is_archived: true });
    const empty = applyRealtimeProductChange([], { eventType: "UPDATE", new: archived, old: null }, "store-a");
    const restored = applyRealtimeProductChange(
      empty,
      { eventType: "UPDATE", new: product({ is_archived: false }), old: archived },
      "store-a"
    );
    expect(restored).toHaveLength(1);
    expect(restored[0].is_archived).toBe(false);
    expect(restored[0].buying_price).toBe(55);
  });

  it("keeps soft-deleted products hidden even after a later update", () => {
    let list = [product()];
    list = applyRealtimeProductChange(list, { eventType: "UPDATE", new: product({ is_deleted: true }), old: product() }, "store-a");
    expect(list).toHaveLength(0);
    list = applyRealtimeProductChange(list, { eventType: "UPDATE", new: product({ is_deleted: true, stock: 3 }), old: null }, "store-a");
    expect(list).toHaveLength(0);
  });

  it("ignores products belonging to another store", () => {
    const next = applyRealtimeProductChange(
      [],
      { eventType: "INSERT", new: product({ id: "other", store_id: "store-b" }), old: null },
      "store-a"
    );
    expect(next).toHaveLength(0);
  });

  it("applies stock updates in place and keeps the list sorted on insert", () => {
    const updated = applyRealtimeProductChange(
      [product()],
      { eventType: "UPDATE", new: product({ stock: 4 }), old: product() },
      "store-a"
    );
    expect(updated[0].stock).toBe(4);

    const inserted = applyRealtimeProductChange(
      updated,
      { eventType: "INSERT", new: product({ id: "p2", name: "Bottled Water" }), old: null },
      "store-a"
    );
    expect(inserted.map((p) => p.name)).toEqual(["Bottled Water", "Coca-Cola 1.5L"]);
  });

  it("removes a hard-deleted row", () => {
    const next = applyRealtimeProductChange(
      [product()],
      { eventType: "DELETE", new: null, old: { id: "p1" } },
      "store-a"
    );
    expect(next).toHaveLength(0);
  });
});
