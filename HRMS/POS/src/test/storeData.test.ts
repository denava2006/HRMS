import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshProductCaches } = vi.hoisted(() => ({
  refreshProductCaches: vi.fn(async () => undefined),
}));

vi.mock("@/lib/store", () => ({
  refreshProductCaches,
}));

import { refreshAfterCheckout, storeDataQueryKeys } from "@/lib/storeData";

describe("checkout data refresh", () => {
  beforeEach(() => {
    refreshProductCaches.mockClear();
  });

  it("refetches inactive queries for only the completed sale's store", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const storeA = "store-a";
    const storeB = "store-b";
    const fetchA = vi.fn()
      .mockResolvedValueOnce([{ id: "old-sale" }])
      .mockResolvedValueOnce([{ id: "old-sale" }, { id: "new-sale" }]);
    const fetchB = vi.fn().mockResolvedValue([{ id: "other-store-sale" }]);

    const storeAKey = storeDataQueryKeys.transactionList(
      storeA,
      "management",
      "today",
    );
    const storeBKey = storeDataQueryKeys.transactionList(
      storeB,
      "management",
      "today",
    );

    await client.fetchQuery({ queryKey: storeAKey, queryFn: fetchA });
    await client.fetchQuery({ queryKey: storeBKey, queryFn: fetchB });

    await refreshAfterCheckout(client, storeA);

    expect(refreshProductCaches).toHaveBeenCalledOnce();
    expect(refreshProductCaches).toHaveBeenCalledWith(storeA);
    expect(fetchA).toHaveBeenCalledTimes(2);
    expect(fetchB).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(storeAKey)).toEqual([
      { id: "old-sale" },
      { id: "new-sale" },
    ]);
  });
});
