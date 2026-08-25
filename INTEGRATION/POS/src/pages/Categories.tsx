import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, Edit, Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  createCategory, deleteCategory, updateCategory,
  reassignCategoryProductsSubset, reorderCategory, setCategoryActive,
  useCategories, useCategoryProductCounts, useCategoryProducts, useRefreshCategories,
  validateSubsetReassignment, type CategoryInput, type ProductCategory,
} from "@/lib/categories";
import { Checkbox } from "@/components/ui/checkbox";
import { DataError } from "@/components/DataError";
import { logTechnicalError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const EMPTY: CategoryInput = { name: "", description: "", color: null, icon: "", is_active: true, sort_order: 0 };

export default function Categories() {
  const { store, permissions } = useAuth();
  const { data = [], isLoading, error, refetch: refetchCategories } = useCategories(store?.id, false);
  const { data: counts = {}, error: countsError } = useCategoryProductCounts(store?.id);
  const refresh = useRefreshCategories(store?.id);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<ProductCategory | "new" | null>(null);
  const [form, setForm] = useState<CategoryInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<{ category: ProductCategory; mode: "reassign" | "delete" } | null>(null);
  const [replacement, setReplacement] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  const reassigning = action?.mode === "reassign" ? action.category : null;
  const {
    data: categoryProducts = [],
    isLoading: productsLoading,
    error: productsError,
  } = useCategoryProducts(store?.id, reassigning?.id ?? null);

  // A product moved out (or archived) elsewhere must not stay selected.
  useEffect(() => {
    const available = new Set(categoryProducts.map((product) => product.id));
    setSelectedProductIds((current) => {
      const next = current.filter((id) => available.has(id));
      return next.length === current.length ? current : next;
    });
  }, [categoryProducts]);

  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return categoryProducts;
    return categoryProducts.filter((product) => product.name.toLowerCase().includes(term));
  }, [categoryProducts, productSearch]);

  const selectedSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);
  const replacementName = data.find((item) => item.id === replacement)?.name ?? "";
  const visibleSelectedCount = visibleProducts.filter((product) => selectedSet.has(product.id)).length;
  const allVisibleSelected = visibleProducts.length > 0 && visibleSelectedCount === visibleProducts.length;

  const toggleProduct = (id: string) => {
    setSelectedProductIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const selectAllVisible = () => {
    setSelectedProductIds((current) => [...new Set([...current, ...visibleProducts.map((p) => p.id)])]);
  };

  const closeAction = () => {
    setAction(null);
    setReplacement("");
    setSelectedProductIds([]);
    setProductSearch("");
  };

  const filtered = useMemo(() => data.filter((category) => {
    const term = search.trim().toLowerCase();
    return (!term || `${category.name} ${category.description ?? ""}`.toLowerCase().includes(term))
      && (status === "all" || (status === "active" ? category.is_active : !category.is_active));
  }), [data, search, status]);

  const openForm = (category?: ProductCategory) => {
    setEditing(category ?? "new");
    setForm(category ? {
      name: category.name, description: category.description, color: category.color,
      icon: category.icon, is_active: category.is_active, sort_order: category.sort_order,
    } : { ...EMPTY, sort_order: data.length });
  };

  const save = async () => {
    if (!store || !form.name.trim()) return toast.error("Category name is required");
    setSaving(true);
    try {
      if (editing === "new") await createCategory(store.id, form);
      else if (editing) await updateCategory(editing.id, form);
      await refresh({ products: editing !== "new" });
      setEditing(null);
      toast.success(editing === "new" ? "Category created" : "Category updated");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Category could not be saved");
    } finally { setSaving(false); }
  };

  const setActive = async (category: ProductCategory, active: boolean) => {
    if (category.normalized_name === "general" || statusChangingId) return;
    setStatusChangingId(category.id);
    try {
      await setCategoryActive(category.id, active);
      await refresh();
      toast.success(active ? "Category restored" : "Category archived");
    } catch (archiveError) {
      logTechnicalError(`categories.${active ? "restore" : "archive"}`, archiveError);
      toast.error(`Category could not be ${active ? "restored" : "archived"}. Please try again.`);
    } finally { setStatusChangingId(null); }
  };

  const move = async (category: ProductCategory, direction: -1 | 1) => {
    if (!store || reorderingId) return;
    setReorderingId(category.id);
    try {
      await reorderCategory(store.id, category.id, direction);
      await refresh();
      toast.success("Category order updated");
    } catch (moveError) {
      logTechnicalError("categories.reorder", moveError);
      try {
        await refresh();
      } catch (refreshError) {
        logTechnicalError("categories.reorderRecovery", refreshError);
      }
      toast.error("Category could not be reordered. Please try again.");
    } finally { setReorderingId(null); }
  };

  const completeAction = async () => {
    if (!store || !action) return;
    if (action.mode === "reassign") {
      const check = validateSubsetReassignment({
        sourceCategoryId: action.category.id,
        replacementCategoryId: replacement,
        selectedProductIds,
        availableProductIds: categoryProducts.map((product) => product.id),
      });
      if (!check.valid) {
        toast.error(check.message);
        return;
      }
    } else if ((counts[action.category.id] ?? 0) > 0 && !replacement) {
      toast.error("Choose a replacement category");
      return;
    }
    setSaving(true);
    try {
      if (action.mode === "reassign") {
        const moved = await reassignCategoryProductsSubset(
          store.id, action.category.id, replacement, selectedProductIds
        );
        toast.success(`${moved} product${moved === 1 ? "" : "s"} moved to ${replacementName || "the new category"}`);
      } else {
        const moved = await deleteCategory(store.id, action.category.id, replacement || null);
        toast.success(moved ? `Category deleted after reassigning ${moved} products` : "Category deleted");
      }
      // Categories, counts, the picker list and the POS/inventory product
      // caches all refetch here, so the move shows up without a page reload.
      // Refresh while the dialog is still open, so the picker query is active
      // and actually refetches. A refresh failure must not be reported as a
      // failed move — the move is already committed.
      try {
        await refresh({ products: true });
      } catch (refreshError) {
        logTechnicalError("categories.refreshAfterAction", refreshError);
        toast.warning("Saved", { description: "Some lists are still refreshing." });
      }
      closeAction();
    } catch (actionError) {
      logTechnicalError("categories.completeAction", actionError);
      toast.error(actionError instanceof Error ? actionError.message : "Category action failed");
    } finally { setSaving(false); }
  };

  if (!store) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold md:text-3xl">Categories</h1><p className="text-sm text-muted-foreground">Customize product groups for {store.name}.</p></div>
        <Button onClick={() => openForm()} className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" /> Add Category</Button>
      </header>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search categories…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
      </Card>
      {isLoading && <Card className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading categories…</Card>}
      {error && (
        <DataError
          title="Categories could not be loaded"
          error={error}
          context="categories.useCategories"
          onRetry={() => void refetchCategories()}
        />
      )}
      {countsError && !error && (
        <Card className="border-warning/30 bg-warning/10 p-3 text-sm">
          Product counts could not be loaded, so the numbers below may be incomplete.
        </Card>
      )}
      {!isLoading && !error && filtered.length === 0 && <Card className="p-10 text-center text-muted-foreground">No categories match this view.</Card>}
      <div className="grid gap-3">
        {filtered.map((category) => {
          const general = category.normalized_name === "general";
          return (
            <Card key={category.id} className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-1 h-5 w-5 shrink-0 rounded-full border" style={{ backgroundColor: category.color ?? "transparent" }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{category.icon && `${category.icon} `}{category.name}</h2><Badge variant={category.is_active ? "default" : "secondary"}>{category.is_active ? "Active" : "Archived"}</Badge>{general && <Badge variant="outline">Required</Badge>}</div>
                    <p className="text-sm text-muted-foreground">{category.description || "No description"} · {counts[category.id] ?? 0} products</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="icon" variant="ghost" title="Move up" disabled={Boolean(reorderingId)} onClick={() => void move(category, -1)}>{reorderingId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button>
                  <Button size="icon" variant="ghost" title="Move down" disabled={Boolean(reorderingId)} onClick={() => void move(category, 1)}>{reorderingId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDown className="h-4 w-4" />}</Button>
                  <Button size="sm" variant="outline" onClick={() => openForm(category)}><Edit className="mr-1 h-4 w-4" /> Edit</Button>
                  {!general && (category.is_active
                    ? <Button size="sm" variant="outline" disabled={Boolean(statusChangingId)} onClick={() => void setActive(category, false)}>{statusChangingId === category.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Archive className="mr-1 h-4 w-4" />} Archive</Button>
                    : <Button size="sm" variant="outline" disabled={Boolean(statusChangingId)} onClick={() => void setActive(category, true)}>{statusChangingId === category.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />} Restore</Button>)}
                  {(counts[category.id] ?? 0) > 0 && !general && <Button size="sm" variant="outline" onClick={() => setAction({ category, mode: "reassign" })}>Reassign</Button>}
                  {permissions.isAdmin && !general && <Button size="icon" variant="ghost" className="text-destructive" title="Delete" onClick={() => setAction({ category, mode: "delete" })}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editing === "new" ? "Add Category" : "Edit Category"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Name</Label><Input maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Description (optional)</Label><Textarea maxLength={500} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Color (optional)</Label><Input type="color" value={form.color ?? "#64748b"} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div><div><Label>Icon (optional)</Label><Input maxLength={50} placeholder="e.g. ☕" value={form.icon ?? ""} onChange={(event) => setForm({ ...form, icon: event.target.value })} /></div></div>
            <div><Label>Sort order</Label><Input type="number" min={0} value={form.sort_order ?? 0} onChange={(event) => setForm({ ...form, sort_order: Math.max(0, Number(event.target.value) || 0) })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !form.name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !saving) closeAction(); }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{action?.mode === "delete" ? "Delete category?" : "Move products to another category"}</AlertDialogTitle>
            <AlertDialogDescription>
              {action && (action.mode === "delete"
                ? `${action.category.name} has ${counts[action.category.id] ?? 0} assigned products. Deletion is permanent, and every remaining product moves to the replacement category.`
                : `Pick a replacement category, then choose exactly which products leave ${action.category.name}. Products you do not select stay where they are.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {action && (action.mode === "reassign" || (counts[action.category.id] ?? 0) > 0) && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Replacement category</Label>
                <Select value={replacement} onValueChange={setReplacement}>
                  <SelectTrigger><SelectValue placeholder="Choose replacement category" /></SelectTrigger>
                  <SelectContent>
                    {data.filter((item) => item.is_active && item.id !== action.category.id).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {action.mode === "reassign" && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">Products in {action.category.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button" variant="ghost" size="sm"
                        disabled={visibleProducts.length === 0 || allVisibleSelected}
                        onClick={selectAllVisible}
                      >
                        Select All{productSearch.trim() ? " shown" : ""}
                      </Button>
                      <Button
                        type="button" variant="ghost" size="sm"
                        disabled={selectedProductIds.length === 0}
                        onClick={() => setSelectedProductIds([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search products in this category…"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                    />
                  </div>

                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-md bg-secondary/40 p-2">
                    {productsLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
                      </div>
                    ) : productsError ? (
                      <p className="p-3 text-sm text-destructive">
                        Products could not be loaded: {productsError instanceof Error ? productsError.message : "Please try again in a moment."}
                      </p>
                    ) : visibleProducts.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {categoryProducts.length === 0 ? "This category has no products." : "No products match this search."}
                      </p>
                    ) : visibleProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-background"
                      >
                        <Checkbox
                          checked={selectedSet.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                          aria-label={`Select ${product.name}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{product.name}</span>
                        {product.is_archived && <Badge variant="outline" className="shrink-0">Archived</Badge>}
                        <span className="shrink-0 text-xs text-muted-foreground">{product.stock} in stock</span>
                      </label>
                    ))}
                  </div>

                  <p className="text-sm">
                    <span className="font-semibold">{selectedProductIds.length}</span> of {categoryProducts.length} selected
                    {selectedProductIds.length > 0 && replacementName && (
                      <span className="text-muted-foreground">
                        {" "}· moving to <span className="font-medium text-foreground">{replacementName}</span>
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void completeAction(); }}
              disabled={saving || (action?.mode === "reassign" && (selectedProductIds.length === 0 || !replacement))}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action?.mode === "delete"
                ? "Delete safely"
                : `Move ${selectedProductIds.length} product${selectedProductIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
