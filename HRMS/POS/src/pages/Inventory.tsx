import { useEffect, useMemo, useState } from "react";
import { useProducts, LOW_STOCK_THRESHOLD, saveProduct, softDeleteProduct, archiveProduct, restockProduct, adjustProductStock, type Product } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PESO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, PackagePlus, Archive, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { ProductImage } from "@/components/ProductImage";
import { ImageUploader } from "@/components/ImageUploader";
import { CategorySelect } from "@/components/CategorySelect";
import { useCategories } from "@/lib/categories";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { storeDataQueryKeys } from "@/lib/storeData";
import { DataError } from "@/components/DataError";

const DEFAULT: Partial<Product> = { name: "", category: "General", category_id: "", stock: 0, buying_price: 0, selling_price: 0, image_url: null };

export default function Inventory() {
  const { store, permissions } = useAuth();
  const queryClient = useQueryClient();
  const { products, setProducts, refetch, error: productsError } = useProducts({ storeId: store?.id });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [stockDialog, setStockDialog] = useState<Product | null>(null);
  const [stockAdd, setStockAdd] = useState(1);
  const [restockCost, setRestockCost] = useState(0);
  const [stockNotes, setStockNotes] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState<"adjustment" | "damaged" | "expired" | "correction">("adjustment");
  const [inventorySaving, setInventorySaving] = useState(false);
  /** Stock as it was when the edit dialog opened, to detect a sale mid-edit. */
  const [stockWhenOpened, setStockWhenOpened] = useState<number | null>(null);
  const { data: categoryRecords = [] } = useCategories(store?.id, false);
  const { data: movements = [], error: movementsError } = useQuery({
    queryKey: store?.id
      ? storeDataQueryKeys.inventoryMovements(store.id)
      : ["store-data", "none", "inventory-movements"],
    enabled: Boolean(store?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inventory_movements")
        .select("id,product_id,movement_type,quantity_change,stock_before,stock_after,unit_cost,total_cost,notes,created_at")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Array<{
        id: string; product_id: string; movement_type: string; quantity_change: number;
        stock_before: number; stock_after: number; unit_cost: number; total_cost: number;
        notes: string | null; created_at: string;
      }>;
    },
  });

  const categories = useMemo(() => [{ id: "all", name: "All Categories" }, ...categoryRecords.map(({ id, name }) => ({ id, name }))], [categoryRecords]);

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category_id === categoryFilter;
    return matchSearch && matchCat;
  }), [products, search, categoryFilter]);

  /**
   * The live row for the product being edited. A sale, restock or adjustment
   * that lands while the dialog is open changes stock underneath it, so the
   * dialog always reads stock from the live cache instead of its own snapshot.
   */
  const editingLive = editing?.id ? products.find((product) => product.id === editing.id) ?? null : null;
  const editingStock = editingLive?.stock ?? editing?.stock ?? 0;
  const stockMovedWhileEditing =
    Boolean(editing?.id) && stockWhenOpened !== null && editingLive !== null && editingLive.stock !== stockWhenOpened;
  const editingRowGone = Boolean(editing?.id) && editingLive === null;

  const openEdit = (product: Product) => {
    setEditing(product);
    setStockWhenOpened(product.stock);
  };

  const openCreate = () => {
    setEditing(DEFAULT);
    setStockWhenOpened(null);
  };

  // Keep prices/name being typed, but never let the dialog imply the old stock.
  useEffect(() => {
    if (!editing?.id || !editingLive) return;
    setEditing((current) =>
      current && current.id === editingLive.id && current.stock !== editingLive.stock
        ? { ...current, stock: editingLive.stock }
        : current
    );
  }, [editing?.id, editingLive]);

  const handleSave = async () => {
    if (!editing?.name?.trim()) { toast.error("Name is required"); return; }
    if (!editing.category_id) { toast.error("Category is required"); return; }
    try {
      await saveProduct({ ...(editing as any), store_id: store?.id });
      await refetch();
      if (store) await queryClient.invalidateQueries({ queryKey: storeDataQueryKeys.inventoryMovements(store.id) });
      toast.success(editing.id ? "Product updated" : "Product added");
      setEditing(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string, name: string) => {
    const prev = products;
    setProducts(p => p.filter(x => x.id !== id)); // optimistic
    try { await softDeleteProduct(id); toast.success(`${name} deleted`); }
    catch (e: any) { setProducts(prev); toast.error(e.message); }
  };

  const handleArchive = async (id: string, name: string) => {
    const prev = products;
    setProducts((current) => current.filter((product) => product.id !== id));
    try {
      await archiveProduct(id);
      toast.success(`${name} archived`);
    } catch (error) {
      setProducts(prev);
      toast.error(error instanceof Error ? error.message : "Product could not be archived");
    }
  };

  const handleAddStock = async () => {
    if (!stockDialog || !store || stockAdd <= 0 || restockCost < 0) return;
    setInventorySaving(true);
    try {
      await restockProduct(store.id, stockDialog.id, stockAdd, restockCost, stockNotes);
      await queryClient.invalidateQueries({ queryKey: storeDataQueryKeys.inventoryMovements(store.id) });
      toast.success(`Restocked ${stockAdd} units of ${stockDialog.name}`);
      setStockDialog(null); setStockAdd(1); setStockNotes("");
    } catch (e: any) { toast.error(e.message); }
    finally { setInventorySaving(false); }
  };

  const handleAdjustment = async () => {
    if (!adjustDialog || !store || adjustQuantity === 0) return;
    setInventorySaving(true);
    try {
      await adjustProductStock(store.id, adjustDialog.id, adjustQuantity, adjustReason, stockNotes);
      await queryClient.invalidateQueries({ queryKey: storeDataQueryKeys.inventoryMovements(store.id) });
      toast.success(`Adjusted ${adjustDialog.name} stock`);
      setAdjustDialog(null); setAdjustQuantity(0); setStockNotes("");
    } catch (e: any) { toast.error(e.message); }
    finally { setInventorySaving(false); }
  };

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">{products.length} products</p>
        </div>
        <Button size="lg" className="bg-gradient-primary shadow-pop" onClick={openCreate}>
          <Plus className="w-5 h-5 mr-1" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-col sm:flex-row gap-3 shadow-card">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9 h-11" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="sm:w-48 h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {productsError && (
        <DataError
          title="Products could not be loaded"
          error={productsError}
          context="inventory.useProducts"
          onRetry={() => void refetch()}
        />
      )}

      {/* Product table (desktop) */}
      <Card className="hidden md:block overflow-hidden shadow-card">
        <table className="w-full">
          <thead className="bg-secondary text-secondary-foreground">
            <tr className="text-left text-sm">
              <th className="px-5 py-3 font-semibold">Product</th>
              <th className="px-5 py-3 font-semibold">Category</th>
              <th className="px-5 py-3 font-semibold text-right">Buy</th>
              <th className="px-5 py-3 font-semibold text-right">Sell</th>
              <th className="px-5 py-3 font-semibold text-right">Capital</th>
              <th className="px-5 py-3 font-semibold text-right">Potential Profit</th>
              <th className="px-5 py-3 font-semibold text-center">Stock</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-border hover:bg-secondary/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImage src={p.image_url} name={p.name} className="w-12 h-12 rounded-md shrink-0" iconSize="w-4 h-4" />
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{p.category}</td>
                <td className="px-5 py-3 text-right tabular-nums">{PESO(p.buying_price)}</td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold">{PESO(p.selling_price)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{PESO(Number(p.buying_price) * p.stock)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-success">{PESO((Number(p.selling_price) - Number(p.buying_price)) * p.stock)}</td>
                <td className="px-5 py-3 text-center">
                  <StockBadge stock={p.stock} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Restock" onClick={() => { setStockDialog(p); setStockAdd(1); setRestockCost(Number(p.buying_price)); setStockNotes(""); }}><PackagePlus className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" title="Adjust stock" onClick={() => { setAdjustDialog(p); setAdjustQuantity(0); setAdjustReason("adjustment"); setStockNotes(""); }}><SlidersHorizontal className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                    {permissions.isAdmin && <Button size="sm" variant="ghost" title="Archive" onClick={() => void handleArchive(p.id, p.name)}><Archive className="w-4 h-4" /></Button>}
                    {permissions.isAdmin && <DeleteBtn onConfirm={() => handleDelete(p.id, p.name)} name={p.name} />}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">No products found</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-2">
        {filtered.map(p => (
          <Card key={p.id} className="p-4 shadow-card">
            <div className="flex gap-3 mb-2">
              <ProductImage src={p.image_url} name={p.name} className="w-14 h-14 rounded-md shrink-0" iconSize="w-5 h-5" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  <StockBadge stock={p.stock} />
                </div>
                <p className="text-xs text-muted-foreground">{p.category}</p>
              </div>
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-muted-foreground">Buy {PESO(p.buying_price)}</span>
              <span className="font-semibold">Sell {PESO(p.selling_price)}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-3">
              <span>Capital {PESO(Number(p.buying_price) * p.stock)}</span>
              <span>Potential {PESO((Number(p.selling_price) - Number(p.buying_price)) * p.stock)}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setStockDialog(p); setStockAdd(1); setRestockCost(Number(p.buying_price)); setStockNotes(""); }}>Restock</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdjustDialog(p); setAdjustQuantity(0); setAdjustReason("adjustment"); setStockNotes(""); }}><SlidersHorizontal className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>Edit</Button>
              {permissions.isAdmin && <Button size="sm" variant="outline" onClick={() => void handleArchive(p.id, p.name)}><Archive className="w-4 h-4" /></Button>}
              {permissions.isAdmin && <DeleteBtn onConfirm={() => handleDelete(p.id, p.name)} name={p.name} />}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No products found</p>}
      </div>

      <Card className="p-5 shadow-card">
        <h2 className="font-bold text-lg mb-4">Recent Inventory Movements</h2>
        {movementsError ? (
          <DataError
            title="Inventory movements could not be loaded"
            error={movementsError}
            context="inventory.movements"
          />
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No inventory movements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Product</th>
                  <th className="py-2 text-left">Movement</th>
                  <th className="py-2 text-right">Quantity</th>
                  <th className="py-2 text-right">Stock</th>
                  <th className="py-2 text-right">Unit Cost</th>
                  <th className="py-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{format(new Date(movement.created_at), "MMM d, h:mm a")}</td>
                    <td className="py-2 pr-3">{products.find((product) => product.id === movement.product_id)?.name || "Archived product"}</td>
                    <td className="py-2 pr-3 capitalize">{movement.movement_type.split("_").join(" ")}</td>
                    <td className="py-2 text-right tabular-nums">{movement.quantity_change > 0 ? "+" : ""}{movement.quantity_change}</td>
                    <td className="py-2 text-right tabular-nums">{movement.stock_before} → {movement.stock_after}</td>
                    <td className="py-2 text-right tabular-nums">{PESO(movement.unit_cost)}</td>
                    <td className="py-2 text-right tabular-nums">{PESO(movement.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setStockWhenOpened(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {editingRowGone && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  This product was archived or removed elsewhere. Close this dialog and refresh the list before editing it.
                </p>
              )}
              {stockMovedWhileEditing && (
                <p className="rounded-lg bg-warning/10 p-3 text-sm">
                  Stock changed from <span className="font-semibold">{stockWhenOpened}</span> to{" "}
                  <span className="font-semibold">{editingStock}</span> while this dialog was open — most likely a sale.
                  Saving here only updates the details below; it never writes stock.
                </p>
              )}
              <Field label="Name"><Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Category">
                {store && <CategorySelect storeId={store.id} value={editing.category_id} currentName={editing.category} canCreate={permissions.canManageCategories} onChange={(category_id, category) => setEditing({ ...editing, category_id, category })} />}
              </Field>
              {store && <ImageUploader storeId={store.id} value={editing.image_url} onChange={(url) => setEditing({ ...editing, image_url: url })} />}
              <div className="grid grid-cols-3 gap-3">
                <Field label={editing.id ? "Stock (use Restock/Adjust)" : "Initial stock"}>
                  <Input
                    type="number"
                    min={0}
                    disabled={Boolean(editing.id)}
                    value={editing.id ? editingStock : editing.stock ?? 0}
                    onChange={e => setEditing({ ...editing, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </Field>
                <Field label="Buy ₱"><Input type="number" min={0} step="0.01" value={editing.buying_price ?? 0} onChange={e => setEditing({ ...editing, buying_price: parseFloat(e.target.value) || 0 })} /></Field>
                <Field label="Sell ₱"><Input type="number" min={0} step="0.01" value={editing.selling_price ?? 0} onChange={e => setEditing({ ...editing, selling_price: parseFloat(e.target.value) || 0 })} /></Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setStockWhenOpened(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={editingRowGone} className="bg-gradient-primary">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trusted restock dialog */}
      <Dialog open={!!stockDialog} onOpenChange={(open) => !open && !inventorySaving && setStockDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restock — {stockDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Current stock: <span className="font-bold">{stockDialog?.stock}</span></Label>
            <Field label="Quantity purchased"><Input type="number" min={1} value={stockAdd} onChange={e => setStockAdd(Math.max(1, parseInt(e.target.value) || 1))} className="h-12 text-lg" /></Field>
            <Field label="Purchase unit cost"><Input type="number" min={0} step="0.01" value={restockCost} onChange={e => setRestockCost(Math.max(0, Number(e.target.value) || 0))} /></Field>
            <p className="text-sm text-muted-foreground">New total: {(stockDialog?.stock ?? 0) + stockAdd}</p>
            <p className="text-sm text-muted-foreground">Purchase cost: {PESO(stockAdd * restockCost)}. The database calculates the new weighted-average unit cost.</p>
            <Field label="Notes (optional)"><Input maxLength={500} value={stockNotes} onChange={e => setStockNotes(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialog(null)} disabled={inventorySaving}>Cancel</Button>
            <Button onClick={handleAddStock} disabled={inventorySaving} className="bg-gradient-success">{inventorySaving ? "Saving…" : "Restock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustDialog} onOpenChange={(open) => !open && !inventorySaving && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock — {adjustDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Current stock: <span className="font-bold">{adjustDialog?.stock}</span></Label>
            <Field label="Quantity change (negative removes stock)">
              <Input type="number" value={adjustQuantity} onChange={e => setAdjustQuantity(parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Reason">
              <Select value={adjustReason} onValueChange={(value) => setAdjustReason(value as typeof adjustReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">Count adjustment</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes (optional)"><Input maxLength={500} value={stockNotes} onChange={e => setStockNotes(e.target.value)} /></Field>
            <p className="text-sm text-muted-foreground">Resulting stock: {(adjustDialog?.stock ?? 0) + adjustQuantity}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)} disabled={inventorySaving}>Cancel</Button>
            <Button onClick={handleAdjustment} disabled={inventorySaving || adjustQuantity === 0 || (adjustDialog?.stock ?? 0) + adjustQuantity < 0}>
              {inventorySaving ? "Saving…" : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge className="bg-destructive text-destructive-foreground">Out</Badge>;
  if (stock <= LOW_STOCK_THRESHOLD) return <Badge className="bg-warning text-warning-foreground hover:bg-warning">{stock} low</Badge>;
  return <Badge variant="secondary">{stock}</Badge>;
}

function DeleteBtn({ onConfirm, name }: { onConfirm: () => void; name: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" title="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This product will be hidden but preserved for transaction history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
