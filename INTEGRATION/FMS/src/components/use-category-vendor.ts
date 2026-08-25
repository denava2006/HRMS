"use client";

import { useMemo, useState } from "react";

export interface CategoryOption {
  id: string;
  name: string;
}

/** A vendor plus the expense categories it supplies (empty = supplies anything). */
export interface VendorOption extends CategoryOption {
  categoryIds: string[];
}

// -----------------------------------------------------------------------------
// The rules, kept as pure functions so they can be exercised directly.
// -----------------------------------------------------------------------------

/** Categories a vendor supplies. A vendor with none supplies anything. */
export function categoriesForVendor(
  categories: CategoryOption[],
  vendor: VendorOption | null,
): CategoryOption[] {
  const supplied = vendor?.categoryIds ?? [];
  return supplied.length ? categories.filter((c) => supplied.includes(c.id)) : categories;
}

/** Vendors that serve a category, including the general suppliers. */
export function vendorsForCategory(
  vendors: VendorOption[],
  categoryId: string,
): VendorOption[] {
  if (!categoryId) return vendors;
  return vendors.filter(
    (v) => v.categoryIds.length === 0 || v.categoryIds.includes(categoryId),
  );
}

/** The vendor that should stay selected after a category is chosen ("" clears). */
export function reconcileVendor(
  vendors: VendorOption[],
  vendorId: string,
  nextCategoryId: string,
): string {
  if (!nextCategoryId || !vendorId) return vendorId;
  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor || vendor.categoryIds.length === 0) return vendorId;
  return vendor.categoryIds.includes(nextCategoryId) ? vendorId : "";
}

/**
 * The category that should stay selected after a vendor is chosen. An
 * incompatible category is cleared; a vendor supplying exactly one category
 * fills it in, since there is nothing left to choose.
 */
export function reconcileCategory(
  vendors: VendorOption[],
  nextVendorId: string,
  categoryId: string,
): string {
  const supplied = vendors.find((v) => v.id === nextVendorId)?.categoryIds ?? [];
  if (supplied.length === 0) return categoryId; // general supplier
  if (categoryId && supplied.includes(categoryId)) return categoryId;
  return supplied.length === 1 ? supplied[0] : "";
}

/**
 * Keeps the Category and Vendor selects in step, in both directions:
 *
 *   pick a category -> only the suppliers that serve it remain
 *   pick a vendor   -> only the categories it supplies remain
 *
 * A vendor with no categories is a general supplier: it stays available
 * everywhere and never restricts the category list.
 *
 * Whenever one choice invalidates the other, the stale one is cleared rather
 * than left showing a pairing that no longer makes sense — and if a vendor
 * supplies exactly one category, that category is filled in automatically,
 * since there is nothing to choose.
 */
export function useCategoryVendor(
  categories: CategoryOption[],
  vendors: VendorOption[],
  defaults: { categoryId?: string; vendorId?: string } = {},
) {
  const [categoryId, setCategoryId] = useState(defaults.categoryId ?? "");
  const [vendorId, setVendorId] = useState(defaults.vendorId ?? "");

  const selectedVendor = vendors.find((v) => v.id === vendorId) ?? null;
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  const visibleCategories = useMemo(
    () => categoriesForVendor(categories, selectedVendor),
    [categories, selectedVendor],
  );

  const visibleVendors = useMemo(
    () => vendorsForCategory(vendors, categoryId),
    [vendors, categoryId],
  );

  function chooseCategory(next: string) {
    setCategoryId(next);
    setVendorId(reconcileVendor(vendors, vendorId, next));
  }

  function chooseVendor(next: string) {
    setVendorId(next);
    setCategoryId(reconcileCategory(vendors, next, categoryId));
  }

  return {
    categoryId,
    vendorId,
    visibleCategories,
    visibleVendors,
    selectedVendor,
    selectedCategory,
    chooseCategory,
    chooseVendor,
    /** True when the vendor choice is currently narrowing the category list. */
    categoriesFiltered: (selectedVendor?.categoryIds.length ?? 0) > 0,
  };
}
