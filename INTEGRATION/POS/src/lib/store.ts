import { useEffect, useCallback, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Product = {
  id: string;
  name: string;
  category: string;
  category_id: string;
  stock: number;
  buying_price: number;
  selling_price: number;
  image_url: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  store_id: string;
};

export type CartItem = { product: Product; quantity: number };

export type SaleItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  line_profit: number;
  unit_cost_snapshot?: number | null;
  line_cogs?: number | null;
  line_gross_profit?: number | null;
};

export type PaymentMethod = "cash" | "gcash" | "maya" | "bank" | "other";

export type Sale = {
  id: string;
  total_amount: number;
  total_profit: number;
  gross_sales?: number;
  net_sales?: number;
  total_cogs?: number;
  gross_profit?: number;
  store_paid_deductions?: number;
  net_profit?: number;
  created_at: string;
  payment_method?: PaymentMethod;
  payment_reference?: string | null;
  amount_tendered?: number | null;
  subtotal?: number | null;
  fees?: any[] | null;
  created_by?: string | null;
  sale_items?: SaleItem[];
};

export const LOW_STOCK_THRESHOLD = 5;

/* ----------------- Per-store products store (active only) ----------------- */
const EMPTY: Product[] = [];
const stateByStore = new Map<string, Product[]>();
const loadedByStore = new Map<string, boolean>();
const loadingByStore = new Map<string, boolean>();
/** Last load failure per cache key, so pages can tell "empty" from "failed". */
const errorByStore = new Map<string, Error | null>();
const listeners = new Set<() => void>();
let realtimeStoreId: string | null = null;
let realtimeChannel: any = null;

const cacheKey = (storeId: string, safeOnly = false) => `${storeId}:${safeOnly ? "pos" : "full"}`;
const getList = (key: string): Product[] => stateByStore.get(key) || EMPTY;
const setList = (key: string, list: Product[]) => { stateByStore.set(key, list); };

let snapshotVersion = 0;
const emit = () => { snapshotVersion++; listeners.forEach(l => l()); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

const sortByName = (arr: Product[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name));

/**
 * A product is visible in the cache only when it is not deleted, not archived,
 * and belongs to the signed-in store. Realtime uses the same rule as the
 * initial load, so an archived product cannot come back through a live event.
 */
export function shouldShowProductInCache(product: Pick<Product, "is_deleted" | "is_archived" | "store_id">, storeId: string | null) {
  return !product.is_deleted && !product.is_archived && Boolean(storeId) && product.store_id === storeId;
}

export type ProductRealtimeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Product | null;
  old: Partial<Product> | null;
};

/** Pure reducer for a Realtime `products` event. Exported so it can be tested. */
export function applyRealtimeProductChange(
  list: Product[],
  event: ProductRealtimeEvent,
  storeId: string | null
): Product[] {
  const newRow = event.new;
  const oldRow = event.old;

  if (event.eventType === "DELETE") {
    return oldRow?.id ? list.filter((p) => p.id !== oldRow.id) : list;
  }
  if (!newRow) return list;

  const existing = list.find((p) => p.id === newRow.id) ?? null;

  if (!shouldShowProductInCache(newRow, storeId)) {
    // Archived, soft-deleted, or another store's product: drop it immediately.
    return existing ? list.filter((p) => p.id !== newRow.id) : list;
  }

  const merged: Product = {
    ...newRow,
    buying_price: Number(newRow.buying_price ?? existing?.buying_price ?? 0),
    is_archived: Boolean(newRow.is_archived),
  };
  return existing
    ? list.map((p) => (p.id === merged.id ? merged : p))
    : sortByName([...list, merged]);
}

async function loadProducts(storeId: string, safeOnly = false, throwOnError = false) {
  const key = cacheKey(storeId, safeOnly);
  if (loadedByStore.get(key) || loadingByStore.get(key)) return;
  loadingByStore.set(key, true);
  const result = safeOnly
    ? await (supabase as any).rpc("get_pos_products", { _store_id: storeId })
    : await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_deleted", false)
        .eq("is_archived", false)
        .order("name");
  const { data, error } = result;
  loadingByStore.set(key, false);
  if (error) {
    // Keep the failure visible instead of silently showing an empty catalog.
    errorByStore.set(key, error instanceof Error ? error : new Error(String(error?.message ?? error)));
    emit();
    toast.error(error.message);
    if (throwOnError) throw error;
    return;
  }
  const list = safeOnly
    ? (data || []).map((product: any) => ({ ...product, buying_price: 0, is_archived: false }))
    : (data || []);
  setList(key, list as Product[]);
  loadedByStore.set(key, true);
  errorByStore.set(key, null);
  emit();
}

function startRealtime(storeId: string) {
  if (realtimeStoreId === storeId && realtimeChannel) return;
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeStoreId = storeId;
  realtimeChannel = supabase
    .channel(`products-${storeId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `store_id=eq.${storeId}` }, (payload) => {
      const key = cacheKey(storeId);
      setList(key, applyRealtimeProductChange(getList(key), {
        eventType: payload.eventType as ProductRealtimeEvent["eventType"],
        new: (payload.new as Product) ?? null,
        old: (payload.old as Partial<Product>) ?? null,
      }, storeId));
      emit();
    })
    .subscribe();
}

/** Resets all in-memory store state — call on sign out. */
export function resetProductCache() {
  stateByStore.clear();
  loadedByStore.clear();
  loadingByStore.clear();
  errorByStore.clear();
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  realtimeStoreId = null;
  emit();
}

/** Refetches any product views already loaded for a store. */
export async function refreshProductCaches(storeId: string) {
  const modes = [false, true].filter((safeOnly) => {
    const key = cacheKey(storeId, safeOnly);
    return stateByStore.has(key) || loadedByStore.has(key);
  });
  for (const safeOnly of modes) {
    loadedByStore.set(cacheKey(storeId, safeOnly), false);
  }
  await Promise.all(modes.map((safeOnly) => loadProducts(storeId, safeOnly, true)));
}


export function useProducts(opts: { storeId?: string | null; safeOnly?: boolean } = {}) {
  const storeId = opts.storeId ?? null;
  const safeOnly = opts.safeOnly ?? false;
  const key = storeId ? cacheKey(storeId, safeOnly) : null;

  useEffect(() => {
    if (!storeId) return;
    if (!safeOnly) startRealtime(storeId);
    loadProducts(storeId, safeOnly);
  }, [safeOnly, storeId]);

  const getSnapshot = useCallback(() => {
    void snapshotVersion;
    if (!storeId) return EMPTY;
    return getList(cacheKey(storeId, safeOnly));
  }, [safeOnly, storeId]);

  const getErrorSnapshot = useCallback(() => {
    void snapshotVersion;
    return key ? errorByStore.get(key) ?? null : null;
  }, [key]);

  const products = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const error = useSyncExternalStore(subscribe, getErrorSnapshot, getErrorSnapshot);

  const setProducts = useCallback(
    (updater: Product[] | ((prev: Product[]) => Product[])) => {
      if (!key) return;
      const next = typeof updater === "function"
        ? (updater as (p: Product[]) => Product[])(getList(key))
        : updater;
      setList(key, next);
      emit();
    },
    [key]
  );

  const refetch = useCallback(async () => {
    if (!storeId || !key) return;
    loadedByStore.set(key, false);
    await loadProducts(storeId, safeOnly);
  }, [key, safeOnly, storeId]);

  return { products, loading: key ? !loadedByStore.get(key) : false, error, refetch, setProducts };
}

export async function saveProduct(p: Partial<Product> & { name: string; store_id?: string }) {
  if (!p.category_id) throw new Error("Select a category");
  if (p.id) {
    const { error } = await (supabase as any).from("products").update({
      name: p.name, category_id: p.category_id,
      buying_price: p.buying_price, selling_price: p.selling_price,
      image_url: p.image_url ?? null,
    }).eq("id", p.id);
    if (error) throw error;
  } else {
    if (!p.store_id) throw new Error("Missing store");
    const { error } = await (supabase as any).from("products").insert({
      name: p.name,
      category_id: p.category_id,
      stock: p.stock ?? 0,
      buying_price: p.buying_price ?? 0,
      selling_price: p.selling_price ?? 0,
      image_url: p.image_url ?? null,
      store_id: p.store_id,
    });
    if (error) throw error;
  }
}

/** Soft delete — hides product but preserves it for transaction history. */
export async function softDeleteProduct(id: string) {
  const { error } = await supabase.from("products").update({ is_deleted: true }).eq("id", id);
  if (error) throw error;
}

export async function archiveProduct(id: string) {
  const { error } = await supabase.from("products").update({ is_archived: true }).eq("id", id);
  if (error) throw error;
}

/**
 * Manual restock. Deliberately the narrowest possible operation: a quantity, a
 * unit cost and a note.
 *
 * Suppliers, purchase orders, supplier bills and accounts payable belong to the
 * FMS, not to this POS — do not grow this into a purchasing workflow. When FMS
 * becomes the source of restocking purchases it drives this same RPC, which
 * gains optional reference arguments so an FMS receipt is distinguishable from
 * a manual correction. See "System boundary: POS vs FMS" in README.md.
 */
export async function restockProduct(
  storeId: string,
  productId: string,
  quantity: number,
  purchaseUnitCost: number,
  notes?: string
) {
  const { data, error } = await (supabase as any).rpc("restock_product", {
    _store_id: storeId,
    _product_id: productId,
    _quantity: quantity,
    _purchase_unit_cost: purchaseUnitCost,
    _notes: notes?.trim() || null,
  });
  if (error) throw error;
  await refreshProductCaches(storeId);
  return data as Product;
}

export async function adjustProductStock(
  storeId: string,
  productId: string,
  quantityChange: number,
  reason: "adjustment" | "damaged" | "expired" | "correction",
  notes?: string
) {
  const { data, error } = await (supabase as any).rpc("adjust_product_stock", {
    _store_id: storeId,
    _product_id: productId,
    _quantity_change: quantityChange,
    _reason: reason,
    _notes: notes?.trim() || null,
  });
  if (error) throw error;
  await refreshProductCaches(storeId);
  return data as Product;
}

export async function checkout(
  cart: CartItem[],
  storeId: string,
  payment: { method: PaymentMethod; reference?: string | null; amount_tendered?: number | null; checkout_key: string }
): Promise<Sale> {
  if (!payment.checkout_key) throw new Error("Checkout key is required.");
  const { data, error } = await supabase.rpc("checkout_sale", {
    _store_id: storeId,
    _items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
    _payment_method: payment.method,
    _payment_reference: payment.reference ?? null,
    _amount_tendered: payment.amount_tendered ?? null,
    _checkout_key: payment.checkout_key,
  });
  if (error) throw error;
  if (!data) throw new Error("Checkout did not return a sale.");
  return data as unknown as Sale;
}
