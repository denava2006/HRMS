import { useMemo, useRef, useState } from "react";
import { useProducts, LOW_STOCK_THRESHOLD, checkout, type CartItem, type Product, type PaymentMethod } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PESO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, X, Banknote, Smartphone, Landmark, Wallet, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { ReceiptDialog, buildReceipt, type ReceiptData } from "@/components/ReceiptDialog";
import { usePosCategories } from "@/lib/categories";
import { computeFees, round2, sumFees, type Fee } from "@/lib/fees";
import { useQueryClient } from "@tanstack/react-query";
import { refreshAfterCheckout } from "@/lib/storeData";
import { DataError } from "@/components/DataError";
import {
  cartToCheckoutItems,
  checkoutFingerprint,
  nextCheckoutAttempt,
  type CheckoutAttempt,
} from "@/lib/checkoutAttempt";
import {
  getPaymentReferenceRule,
  requiresPaymentReference,
  sanitizePaymentReferenceInput,
  validatePaymentReference,
} from "@/lib/paymentValidation";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "gcash", label: "GCash", icon: Smartphone },
  { value: "maya", label: "Maya", icon: Wallet },
  { value: "bank", label: "Bank", icon: Landmark },
];

const MAX_CASH = 999_999_999_999_999;

export default function POS() {
  const queryClient = useQueryClient();
  const { store, permissions, membership, user } = useAuth();
  const { products, error: productsError, refetch: refetchProducts } = useProducts({
    storeId: store?.id,
    safeOnly: permissions.isCashier,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const referenceRule = getPaymentReferenceRule(method);
  const referenceRequired = requiresPaymentReference(method);
  const validation = validatePaymentReference(method, reference);
  const [tendered, setTendered] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const checkoutAttemptRef = useRef<CheckoutAttempt | null>(null);
  const checkoutInFlightRef = useRef(false);

  const { data: categoryRecords = [] } = usePosCategories(store?.id);
  const categories = useMemo(() => [{ id: "all", name: "All" }, ...categoryRecords], [categoryRecords]);

  const filtered = useMemo(() => products.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase());
    const mc = category === "all" || p.category_id === category;
    return ms && mc;
  }), [products, search, category]);

  const cartQty = (id: string) => cart.find(x => x.product.id === id)?.quantity ?? 0;

  /**
   * One tap on a product card adds one unit. Quantities are adjusted in the
   * cart, so the grid stays a fast list of things to tap rather than a set of
   * tiny steppers. The database is still the authority on stock — this only
   * stops the cashier building a cart that is guaranteed to be rejected.
   */
  const addOne = (p: Product) => {
    if (p.stock === 0) { toast.error(`${p.name} is out of stock`); return; }
    if (cartQty(p.id) >= p.stock) {
      toast.error(`Only ${p.stock} of ${p.name} in stock — all of them are already in the cart`);
      return;
    }
    setCart(current => {
      const existing = current.find(x => x.product.id === p.id);
      // Re-snapshot the product so the cart carries the latest price and stock.
      return existing
        ? current.map(x => (x.product.id === p.id ? { ...x, product: p, quantity: x.quantity + 1 } : x))
        : [...current, { product: p, quantity: 1 }];
    });
  };

  /**
   * Cart +/-. The cap is read from the LIVE product list, not from the snapshot
   * stored in the cart line, so the cart and the grid never disagree about how
   * much stock is left after a restock or another till's sale lands.
   */
  const updateQty = (id: string, delta: number) => {
    const live = products.find(p => p.id === id);
    const stock = live?.stock ?? 0;
    const current = cartQty(id);
    const next = current + delta;
    if (next > 0 && next > stock) {
      toast.error(`Only ${stock} of ${live?.name ?? "this product"} in stock`);
      return;
    }
    setCart(c => c.flatMap(x => {
      if (x.product.id !== id) return [x];
      if (next <= 0) return [];
      return [{ ...x, product: live ?? x.product, quantity: next }];
    }));
  };

  // Each line is rounded before it is summed, matching how secure_checkout
  // accumulates gross_sales. The total shown here must be the exact amount the
  // database will charge, or an exact cash tender gets rejected as short.
  const subtotal = round2(cart.reduce((s, c) => s + round2(Number(c.product.selling_price) * c.quantity), 0));
  const appliedFees = useMemo(() => computeFees(subtotal, (store?.fees as Fee[] | null) ?? []), [subtotal, store]);
  const feesTotal = sumFees(appliedFees);
  const total = round2(subtotal + feesTotal);
  const totalQty = cart.reduce((s, c) => s + c.quantity, 0);
  const change = method === "cash" && tendered ? round2(Number(tendered) - total) : 0;

  const openPayment = () => {
    if (cart.length === 0) return;
    setMethod("cash");
    setReference("");
    setTendered("");
    setPayOpen(true);
  };

  const handleMethodChange = (nextMethod: PaymentMethod) => {
    setMethod(nextMethod);
    // Re-run the new method's input restriction so a GCash reference cannot
    // leak characters into a bank reference (or vice versa).
    setReference((current) => (nextMethod === "cash" ? "" : sanitizePaymentReferenceInput(nextMethod, current)));
  };

  const confirmPayment = async () => {
    if (checkoutInFlightRef.current) return;
    if (method === "cash") {
      if (!tendered.trim()) { toast.error("Enter the amount of cash received"); return; }
      if (Number(tendered) < total) { toast.error("Cash received is less than total"); return; }
    }
    if (referenceRequired && !validation.valid) {
      toast.error(validation.message || "Reference number is invalid");
      return;
    }
    checkoutInFlightRef.current = true;
    setSubmitting(true);
    const snapshot = cart;
    const localTotal = total;
    const localTendered = method === "cash" ? Number(tendered) : null;
    // Trimmed once here so the fingerprint, the RPC and the receipt all agree.
    const localRef = referenceRequired ? validation.normalized : null;
    const localMethod = method;
    const fingerprint = checkoutFingerprint({
      storeId: store?.id ?? null,
      items: cartToCheckoutItems(snapshot),
      method: localMethod,
      reference: localRef,
      amountTendered: localTendered,
    });
    checkoutAttemptRef.current = nextCheckoutAttempt(
      checkoutAttemptRef.current,
      fingerprint,
      () => crypto.randomUUID()
    );
    const checkoutKey = checkoutAttemptRef.current.key;
    try {
      if (!store) throw new Error("No store");
      const sale = await checkout(snapshot, store.id, {
        method: localMethod,
        reference: localRef,
        amount_tendered: localTendered,
        checkout_key: checkoutKey,
      });
      const trustedSubtotal = Number(sale.subtotal ?? subtotal);
      const trustedFees = Array.isArray(sale.fees) ? sale.fees : appliedFees;
      const trustedTotal = Number(sale.total_amount ?? localTotal);
      setReceipt(buildReceipt({
        sale: { id: sale.id, created_at: sale.created_at },
        cart: snapshot,
        subtotal: trustedSubtotal,
        fees: trustedFees,
        total: trustedTotal,
        method: localMethod,
        reference: localRef,
        tendered: localTendered,
        storeName: store.name,
        cashier: membership?.display_name || user?.email || undefined,
      }));
      checkoutAttemptRef.current = null;
      setCart([]);
      setPayOpen(false);
      try {
        await refreshAfterCheckout(queryClient, store.id);
      } catch (refreshError) {
        if (import.meta.env.DEV) {
          console.error("Sale completed, but checkout data refresh failed", refreshError);
        }
        toast.warning("Sale completed", {
          description: "Some displayed data is still refreshing. Your sale was saved and will not be charged again.",
        });
      }
      toast.success("Sale recorded 🎉", { description: `Total: ${PESO(localTotal)}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout could not be completed");
    } finally {
      checkoutInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Point of Sale</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="lg" className="lg:hidden bg-gradient-accent relative shadow-pop">
                <ShoppingCart className="w-5 h-5 mr-1" />
                {totalQty > 0 && <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground">{totalQty}</Badge>}
                Cart
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
              <SheetHeader className="p-5 border-b"><SheetTitle>Cart</SheetTitle></SheetHeader>
              <CartContent cart={cart} updateQty={updateQty} setCart={setCart} total={total} totalQty={totalQty} onCheckout={openPayment} submitting={submitting} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-9 h-12 text-base" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {categories.map(c => (
            <Button
              key={c.id}
              variant={category === c.id ? "default" : "outline"}
              size="sm"
              className={cn("rounded-full shrink-0 h-9 px-4", category === c.id && "bg-gradient-primary shadow-sm")}
              onClick={() => setCategory(c.id)}
            >
              {"color" in c && c.color && <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />}
              {c.name}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {productsError && products.length === 0 && (
            <DataError
              className="mb-3"
              title="Products could not be loaded"
              error={productsError}
              context="pos.useProducts"
              onRetry={() => void refetchProducts()}
            />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(p => {
              const inCartQty = cartQty(p.id);
              // What is still addable: stock minus what this cart already holds.
              const remaining = p.stock - inCartQty;
              const outOfStock = p.stock === 0;
              const allInCart = !outOfStock && remaining <= 0;
              const disabled = outOfStock || allInCart;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addOne(p)}
                  disabled={disabled}
                  aria-label={
                    outOfStock ? `${p.name}, out of stock`
                      : allInCart ? `${p.name}, all ${p.stock} already in cart`
                      : `Add one ${p.name}, ${PESO(p.selling_price)}, ${remaining} left`
                  }
                  className={cn(
                    "group relative bg-card rounded-xl p-3 shadow-card border flex flex-col text-left",
                    "transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    disabled
                      ? "opacity-50 cursor-not-allowed border-border"
                      : "border-border hover:border-primary/50 hover:shadow-elevated active:scale-[0.97] cursor-pointer",
                    inCartQty > 0 && !disabled && "border-primary/40"
                  )}
                >
                  {inCartQty > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[22px] h-[22px] px-1 rounded-full bg-gradient-accent text-accent-foreground text-[11px] font-bold tabular-nums flex items-center justify-center shadow-pop">
                      {inCartQty}
                    </span>
                  )}
                  <ProductImage src={p.image_url} name={p.name} className="aspect-square rounded-lg mb-2" iconSize="w-7 h-7" />
                  <h3 className="font-semibold text-sm leading-tight mb-0.5 line-clamp-2 min-h-[2.2em]">{p.name}</h3>
                  <p className="text-[11px] text-muted-foreground mb-1.5 truncate">{p.category}</p>
                  <div className="mt-auto flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-bold text-primary text-sm break-all leading-tight">{PESO(p.selling_price)}</span>
                    {outOfStock ? (
                      <Badge variant="destructive" className="text-[10px] shrink-0">Out</Badge>
                    ) : allInCart ? (
                      <Badge variant="destructive" className="text-[10px] shrink-0">All in cart</Badge>
                    ) : remaining <= LOW_STOCK_THRESHOLD ? (
                      <Badge className="bg-warning text-warning-foreground text-[10px] hover:bg-warning shrink-0">{remaining} left</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{remaining} left</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && !(productsError && products.length === 0) && (
            <p className="text-center text-muted-foreground py-12">No products found</p>
          )}
        </div>
      </div>

      <aside className="hidden lg:flex w-96 flex-col bg-card border-l border-border shadow-elevated">
        <div className="p-5 border-b flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg flex-1">Cart</h2>
          {totalQty > 0 && <Badge variant="secondary">{totalQty} items</Badge>}
        </div>
        <CartContent cart={cart} updateQty={updateQty} setCart={setCart} total={total} totalQty={totalQty} onCheckout={openPayment} submitting={submitting} />
      </aside>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary/40 px-4 py-3 space-y-1">
              {appliedFees.length > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{PESO(subtotal)}</span>
                  </div>
                  {appliedFees.map((f, i) => (
                    <div key={i} className="flex justify-between text-sm text-muted-foreground">
                      <span>{f.name}{f.type === "percent" ? ` (${f.value}%)` : ""}</span>
                      <span className="tabular-nums">{PESO(f.amount)}</span>
                    </div>
                  ))}
                  <div className="h-px bg-border my-1" />
                </>
              )}
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="text-2xl font-bold text-primary tabular-nums">{PESO(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const active = method === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleMethodChange(opt.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-semibold transition-base",
                      active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    )}
                  >
                    <Icon className="w-4 h-4" /> {opt.label}
                  </button>
                );
              })}
            </div>

            {method === "cash" ? (
              <div className="space-y-2">
                <Label htmlFor="tendered">Cash received <span className="text-destructive">*</span></Label>
                <Input
                  id="tendered"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={tendered}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "" || (Number(v) >= 0 && Number(v) <= MAX_CASH)) setTendered(v);
                  }}
                  max={MAX_CASH}
                  min={0}
                  required
                  autoFocus
                  className="h-12 text-lg font-bold tabular-nums"
                />
                {tendered && Number(tendered) >= total && (
                  <p className="text-sm font-semibold text-success break-all">Change: {PESO(change)}</p>
                )}
                {tendered && Number(tendered) < total && (
                  <p className="text-sm text-destructive break-all">Short by {PESO(total - Number(tendered))}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-secondary/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Scan to pay with {method.toUpperCase()}
                  </p>
                  {store?.payment_qr_url ? (
                    <img
                      src={store.payment_qr_url}
                      alt={`${method} QR code`}
                      className="w-44 h-44 rounded-lg bg-white p-2 shadow-sm object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-lg bg-white p-3 text-center text-slate-500 shadow-sm">
                      <QrCode className="h-16 w-16" />
                      <span className="text-xs font-medium">Ask an Admin to add one in Payment QR / QRPh</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Customer scans this with their {method.toUpperCase()} app, then enter the reference number below.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ref">Reference number <span className="text-destructive">*</span></Label>
                  <Input
                    id="ref"
                    placeholder={referenceRule?.placeholder ?? "Reference"}
                    inputMode={referenceRule?.inputMode ?? "text"}
                    autoComplete="off"
                    minLength={validation.minLength}
                    maxLength={validation.maxLength}
                    aria-invalid={reference.length > 0 && !validation.valid}
                    aria-describedby="ref-help"
                    value={reference}
                    onChange={(event) => setReference(sanitizePaymentReferenceInput(method, event.target.value))}
                  />
                  <div className="flex items-start justify-between gap-3 text-xs">
                    <span
                      id="ref-help"
                      className={cn(
                        reference.length > 0 && !validation.valid ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {reference.length > 0 && !validation.valid
                        ? validation.message
                        : referenceRule?.hint ?? "Enter the reference shown by the payment app or bank."}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        validation.valid ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      {validation.normalized.length}/{validation.maxLength}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmPayment}
              disabled={submitting || (referenceRequired && !validation.valid)}
              className="bg-gradient-success shadow-pop"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptDialog data={receipt} open={!!receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function CartContent({ cart, updateQty, setCart, total, totalQty, onCheckout, submitting }: {
  cart: CartItem[]; updateQty: (id: string, d: number) => void;
  setCart: (c: CartItem[]) => void; total: number; totalQty: number;
  onCheckout: () => void; submitting: boolean;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p>Cart is empty</p>
            <p className="text-xs mt-1">Tap a product to add</p>
          </div>
        ) : cart.map(c => (
          <Card key={c.product.id} className="p-3 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <ProductImage src={c.product.image_url} name={c.product.name} className="w-10 h-10 rounded-md shrink-0" iconSize="w-4 h-4" />
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-sm truncate">{c.product.name}</h4>
                <p className="text-xs text-muted-foreground">{PESO(c.product.selling_price)} each</p>
              </div>
              <button onClick={() => setCart(cart.filter(x => x.product.id !== c.product.id))} className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQty(c.product.id, -1)}><Minus className="w-3 h-3" /></Button>
                <span className="w-8 text-center font-bold tabular-nums">{c.quantity}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQty(c.product.id, +1)}><Plus className="w-3 h-3" /></Button>
              </div>
              <span className="font-bold tabular-nums">{PESO(Number(c.product.selling_price) * c.quantity)}</span>
            </div>
          </Card>
        ))}
      </div>
      <div className="border-t p-4 space-y-3 bg-secondary/30">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">Total ({totalQty} items)</span>
          <span className="text-2xl font-bold text-primary tabular-nums">{PESO(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={cart.length === 0} onClick={() => setCart([])}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
          <Button size="lg" disabled={cart.length === 0 || submitting} onClick={onCheckout} className="bg-gradient-success shadow-pop h-12 text-base font-bold">
            <CheckCircle2 className="w-5 h-5 mr-1" /> Checkout
          </Button>
        </div>
      </div>
    </>
  );
}
