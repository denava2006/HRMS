import type { QueryClient } from "@tanstack/react-query";
import { refreshProductCaches } from "@/lib/store";

export const storeDataQueryKeys = {
  store: (storeId: string) => ["store-data", storeId] as const,
  transactions: (storeId: string) => ["store-data", storeId, "transactions"] as const,
  transactionList: (storeId: string, accessScope: string, rangeKey: string) =>
    ["store-data", storeId, "transactions", accessScope, rangeKey] as const,
  dashboard: (storeId: string) => ["store-data", storeId, "dashboard"] as const,
  reports: (storeId: string) => ["store-data", storeId, "reports"] as const,
  report: (storeId: string, rangeKey: string) =>
    ["store-data", storeId, "reports", rangeKey] as const,
  inventoryMovements: (storeId: string) =>
    ["store-data", storeId, "inventory-movements"] as const,
};

/** Refresh every already-known frontend view affected by a successful checkout. */
export async function refreshAfterCheckout(queryClient: QueryClient, storeId: string) {
  await queryClient.invalidateQueries({
    queryKey: storeDataQueryKeys.store(storeId),
    refetchType: "none",
  });

  await Promise.all([
    refreshProductCaches(storeId),
    queryClient.refetchQueries({
      queryKey: storeDataQueryKeys.store(storeId),
      type: "all",
    }, { throwOnError: true }),
  ]);
}
