import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { refreshProductCaches } from "@/lib/store";

// Remove these untyped client casts after the pending category migration is
// reviewed, applied, and src/integrations/supabase/types.ts is regenerated.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProductCategory = {
  id: string;
  store_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
};

export type CategoryInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type CategoryProduct = {
  id: string;
  name: string;
  category_id: string;
  is_archived: boolean;
  stock: number;
  selling_price: number;
};

export const categoryQueryKeys = {
  all: ["categories"] as const,
  store: (storeId: string) => ["categories", storeId] as const,
  list: (storeId: string, activeOnly: boolean) => ["categories", storeId, "list", activeOnly] as const,
  pos: (storeId: string) => ["categories", storeId, "pos"] as const,
  counts: (storeId: string) => ["categories", storeId, "product-counts"] as const,
  products: (storeId: string, categoryId: string) =>
    ["categories", storeId, "category-products", categoryId] as const,
};

export function useCategories(storeId?: string | null, activeOnly = false) {
  return useQuery({
    queryKey: storeId ? categoryQueryKeys.list(storeId, activeOnly) : categoryQueryKeys.all,
    enabled: Boolean(storeId),
    queryFn: async () => {
      if (!storeId) return [];
      const query = (supabase as any)
        .from("product_categories")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order")
        .order("name");
      if (activeOnly) query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw new Error(error.message || "Categories could not be loaded.");
      return (data ?? []) as ProductCategory[];
    },
  });
}

export function usePosCategories(storeId?: string | null) {
  return useQuery({
    queryKey: storeId ? categoryQueryKeys.pos(storeId) : categoryQueryKeys.all,
    enabled: Boolean(storeId),
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await (supabase as any).rpc("get_pos_categories", { _store_id: storeId });
      if (error) throw new Error(error.message || "Category options could not be loaded.");
      return (data ?? []) as Pick<ProductCategory, "id" | "name" | "color" | "icon" | "sort_order">[];
    },
  });
}

export function useCategoryProductCounts(storeId?: string | null) {
  return useQuery({
    queryKey: storeId ? categoryQueryKeys.counts(storeId) : categoryQueryKeys.all,
    enabled: Boolean(storeId),
    queryFn: async () => {
      if (!storeId) return {};
      const { data, error } = await (supabase as any)
        .from("products")
        .select("category_id")
        .eq("store_id", storeId);
      if (error) throw new Error(error.message || "Category counts could not be loaded.");
      const counts: Record<string, number> = {};
      for (const product of data ?? []) {
        counts[product.category_id] = (counts[product.category_id] ?? 0) + 1;
      }
      return counts;
    },
  });
}

/** Products currently assigned to one category — the selective-move picker. */
export function useCategoryProducts(storeId?: string | null, categoryId?: string | null) {
  return useQuery({
    queryKey: storeId && categoryId ? categoryQueryKeys.products(storeId, categoryId) : categoryQueryKeys.all,
    enabled: Boolean(storeId && categoryId),
    queryFn: async () => {
      if (!storeId || !categoryId) return [];
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id,name,category_id,is_archived,stock,selling_price")
        .eq("store_id", storeId)
        .eq("category_id", categoryId)
        .eq("is_deleted", false)
        .order("name");
      if (error) throw new Error(error.message || "Products in this category could not be loaded.");
      return (data ?? []) as CategoryProduct[];
    },
  });
}

export function useRefreshCategories(storeId?: string | null) {
  const client = useQueryClient();
  return async (options: { products?: boolean } = {}) => {
    if (!storeId) return;
    await client.invalidateQueries({ queryKey: categoryQueryKeys.store(storeId), refetchType: "none" });
    await Promise.all([
      client.refetchQueries({ queryKey: categoryQueryKeys.store(storeId), type: "all" }),
      options.products ? refreshProductCaches(storeId) : Promise.resolve(),
    ]);
  };
}

export async function createCategory(storeId: string, input: CategoryInput) {
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .insert({
      store_id: storeId,
      name: input.name.trim(),
      description: input.description ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProductCategory;
}

export async function updateCategory(id: string, input: CategoryInput) {
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .update({
      name: input.name.trim(),
      description: input.description ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ProductCategory;
}

export async function setCategoryActive(categoryId: string, isActive: boolean) {
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .update({ is_active: isActive })
    .eq("id", categoryId)
    .select()
    .single();
  if (error) throw error;
  return data as ProductCategory;
}

export async function deleteCategory(storeId: string, categoryId: string, replacementId?: string | null) {
  const { data, error } = await (supabase as any).rpc("delete_product_category", {
    _store_id: storeId,
    _category_id: categoryId,
    _replacement_category_id: replacementId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Moves EVERY product out of a category. Kept because delete_product_category
 * relies on the same server-side behaviour; the Categories UI uses
 * reassignCategoryProductsSubset so nothing moves unless it was selected.
 */
export async function reassignCategory(storeId: string, categoryId: string, replacementId: string) {
  const { data, error } = await (supabase as any).rpc("reassign_category_products", {
    _store_id: storeId,
    _category_id: categoryId,
    _replacement_category_id: replacementId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Client-side mirror of the preconditions enforced by
 * public.reassign_category_products_subset. The database remains the authority;
 * this only produces a clear message before a doomed round trip.
 */
export function validateSubsetReassignment(input: {
  sourceCategoryId?: string | null;
  replacementCategoryId?: string | null;
  selectedProductIds: string[];
  availableProductIds: string[];
}): { valid: boolean; message: string } {
  if (!input.sourceCategoryId) return { valid: false, message: "Choose a source category" };
  if (!input.replacementCategoryId) return { valid: false, message: "Choose a replacement category" };
  if (input.sourceCategoryId === input.replacementCategoryId) {
    return { valid: false, message: "Choose a different replacement category" };
  }
  const unique = new Set(input.selectedProductIds);
  if (unique.size === 0) return { valid: false, message: "Select at least one product to move" };
  const available = new Set(input.availableProductIds);
  for (const id of unique) {
    if (!available.has(id)) {
      return { valid: false, message: "Some selected products are no longer in this category. Refresh and try again." };
    }
  }
  return { valid: true, message: "" };
}

/** Moves only the selected products. Never falls back to "move everything". */
export async function reassignCategoryProductsSubset(
  storeId: string,
  categoryId: string,
  replacementId: string,
  productIds: string[]
) {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) throw new Error("Select at least one product to move");
  const { data, error } = await (supabase as any).rpc("reassign_category_products_subset", {
    _store_id: storeId,
    _category_id: categoryId,
    _replacement_category_id: replacementId,
    _product_ids: unique,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function reorderCategory(storeId: string, categoryId: string, direction: -1 | 1) {
  const { data, error } = await (supabase as any).rpc("reorder_product_category", {
    _store_id: storeId,
    _category_id: categoryId,
    _direction: direction,
  });
  if (error) throw error;
  return Number(data);
}
