import { describe, it, expect } from "vitest";
import { validateSubsetReassignment } from "@/lib/categories";

const available = ["p1", "p2", "p3"];

describe("validateSubsetReassignment", () => {
  it("accepts one selected product", () => {
    expect(validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "c2",
      selectedProductIds: ["p2"],
      availableProductIds: available,
    })).toEqual({ valid: true, message: "" });
  });

  it("accepts several selected products, including Select All", () => {
    expect(validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "c2",
      selectedProductIds: available,
      availableProductIds: available,
    }).valid).toBe(true);
  });

  it("rejects an empty selection instead of moving everything", () => {
    const result = validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "c2",
      selectedProductIds: [],
      availableProductIds: available,
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/at least one product/i);
  });

  it("rejects an identical source and replacement category", () => {
    const result = validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "c1",
      selectedProductIds: ["p1"],
      availableProductIds: available,
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/different replacement/i);
  });

  it("rejects a missing replacement category", () => {
    expect(validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "",
      selectedProductIds: ["p1"],
      availableProductIds: available,
    })).toMatchObject({ valid: false });
  });

  it("rejects a missing source category", () => {
    expect(validateSubsetReassignment({
      sourceCategoryId: null,
      replacementCategoryId: "c2",
      selectedProductIds: ["p1"],
      availableProductIds: available,
    })).toMatchObject({ valid: false });
  });

  it("rejects products that are no longer in the source category", () => {
    const result = validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "c2",
      selectedProductIds: ["p1", "moved-away"],
      availableProductIds: available,
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/no longer in this category/i);
  });

  it("treats duplicate selections as one product", () => {
    expect(validateSubsetReassignment({
      sourceCategoryId: "c1",
      replacementCategoryId: "c2",
      selectedProductIds: ["p1", "p1"],
      availableProductIds: available,
    }).valid).toBe(true);
  });
});
