import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Image as ImageIcon, MoreHorizontal, Package, Plus, Store, Upload } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useBranches } from '@/hooks/useBranches'
import {
  useBranchProducts,
  usePosCategories,
  usePosProducts,
  useProductImageUrls,
  useRemoveProductImage,
  useSaveProduct,
  useSetBranchAvailability,
  useSetBranchCarries,
  useUploadProductImage,
} from '@/hooks/usePosCatalogue'
import {
  PRODUCT_STATUSES,
  PRODUCT_STATUS_HINT,
  PRODUCT_STATUS_LABEL,
  peso,
  validateProduct,
  type Product,
} from '@/lib/posCatalogue'
import type { PosProductStatus } from '@/lib/enums'

/**
 * The product master.
 *
 * A product is one enterprise record, not one record per branch. "Cola 1.5L"
 * has a single id whatever branch sells it, which is what lets later phases
 * report across branches, transfer stock, and purchase through FMS without
 * matching products by name.
 *
 * What varies by branch lives in pos_branch_products: whether the branch
 * carries the product, and optionally a different price.
 *
 * There is no stock here. Availability means "this branch carries it", never
 * "there is stock" -- Phase 4 owns quantity, together with the ledger that
 * keeps it honest.
 */

function ProductDialog({
  open,
  onOpenChange,
  product,
  products,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  products: Product[]
}) {
  const save = useSaveProduct()
  const { data: categories } = usePosCategories()
  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [sellingPrice, setSellingPrice] = React.useState('0')
  const [unitCost, setUnitCost] = React.useState('0')
  const [status, setStatus] = React.useState<PosProductStatus>('draft')

  const activeCategories = (categories ?? []).filter((c) => c.is_active)

  React.useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setCategoryId(product?.category_id ?? activeCategories[0]?.id ?? '')
    setSellingPrice(String(product?.default_selling_price ?? 0))
    setUnitCost(String(product?.default_unit_cost ?? 0))
    setStatus(product?.status ?? 'draft')
    // activeCategories is derived; depending on it would reset the form on every
    // query refetch and discard what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product])

  const draft = {
    name,
    categoryId,
    sellingPrice: Number(sellingPrice),
    unitCost: Number(unitCost),
  }
  const errors = validateProduct(draft, products, product?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>
            One record for the whole enterprise. Branches choose whether to carry it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product_name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product_name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cola 1.5L"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger aria-label="Category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="product_price">Default selling price</Label>
              <Input
                id="product_price"
                type="number"
                min={0}
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="product_cost">Unit cost</Label>
              <Input
                id="product_cost"
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Administrators only. Never shown to POS staff.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as PosProductStatus)}>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PRODUCT_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{PRODUCT_STATUS_HINT[status]}</p>
          </div>

          {errors.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              {errors.map((error) => (
                <li key={error} className="text-xs text-destructive">
                  {error}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={errors.length > 0}
            onClick={() =>
              save.mutate({ id: product?.id, ...draft, status }, { onSuccess: () => onOpenChange(false) })
            }
          >
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BranchesDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data: branches } = useBranches()
  const { data: branchProducts } = useBranchProducts()
  const setCarries = useSetBranchCarries()
  const setAvailability = useSetBranchAvailability()

  if (!product) return null
  const activeBranches = (branches ?? []).filter((b) => b.is_active)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Branches carrying {product.name}</DialogTitle>
          <DialogDescription>
            Adding a branch means it carries this product. It does not give the branch any stock.
            To stop selling it somewhere, switch it off — removing it is only possible while the
            branch has no stock history.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {activeBranches.map((branch) => {
            const row = (branchProducts ?? []).find(
              (bp) => bp.branch_id === branch.id && bp.product_id === product.id
            )
            const carries = !!row
            return (
              <div
                key={branch.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{branch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {carries
                      ? row?.is_available
                        ? 'Carried and offered'
                        : 'Carried, paused by the branch'
                      : 'Not carried'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {carries && (
                    <Switch
                      checked={!!row?.is_available}
                      aria-label={`Offer at ${branch.name}`}
                      onCheckedChange={(isAvailable) =>
                        setAvailability.mutate({
                          branchId: branch.id,
                          productId: product.id,
                          isAvailable,
                        })
                      }
                    />
                  )}
                  <Button
                    variant={carries ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setCarries.mutate({
                        branchId: branch.id,
                        productId: product.id,
                        carries: !carries,
                      })
                    }
                  >
                    {/* "Stop carrying" rather than "Remove": once the branch has
                        received anything, the database refuses the delete to
                        keep the inventory history, and the error explains that
                        switching it off is the operational answer. */}
                    {carries ? 'Stop carrying' : 'Add'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImageDialog({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const upload = useUploadProductImage()
  const remove = useRemoveProductImage()
  // Read the product from the live list rather than holding the row that was
  // captured when the dialog opened: uploading invalidates the query, and a
  // captured copy would keep reporting the old image_path, so the new image
  // would not appear until the dialog was closed and opened again.
  const { data: products } = usePosProducts()
  const product = (products ?? []).find((p) => p.id === productId) ?? null
  const { data: urls } = useProductImageUrls([product?.image_path])
  const fileRef = React.useRef<HTMLInputElement>(null)

  if (!product) return null
  const url = product.image_path ? urls?.[product.image_path] : undefined

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name} image</DialogTitle>
          <DialogDescription>
            Stored privately. Shown through a short-lived signed link, never a public URL.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-4">
          <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            {url ? (
              <img src={url} alt={product.name} className="h-36 w-36 object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">No image</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label="Product image file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  upload.mutate({
                    productId: product.id,
                    file,
                    previousPath: product.image_path,
                  })
                }
                e.target.value = ''
              }}
            />
            <Button variant="outline" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {product.image_path ? 'Replace image' : 'Upload image'}
            </Button>
            {product.image_path && (
              <Button
                variant="ghost"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { productId: product.id, path: product.image_path! },
                    { onSuccess: onClose }
                  )
                }
              >
                Remove image
              </Button>
            )}
            <p className="max-w-xs text-xs text-muted-foreground">PNG, JPEG or WebP, under 5MB.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PosProductsPage() {
  const { data: products, isLoading } = usePosProducts()
  const { data: categories } = usePosCategories()
  const { data: branchProducts } = useBranchProducts()
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [branchesFor, setBranchesFor] = React.useState<Product | null>(null)
  const [imageFor, setImageFor] = React.useState<string | null>(null)

  const list = products ?? []
  const categoryName = (id: string) => (categories ?? []).find((c) => c.id === id)?.name ?? 'Uncategorised'
  const branchCount = (productId: string) =>
    (branchProducts ?? []).filter((bp) => bp.product_id === productId).length

  const columns: ColumnDef<Product>[] = [
    {
      id: '_search',
      accessorFn: (row) => `${row.name} ${categoryName(row.category_id)}`,
    },
    {
      id: 'name',
      header: 'Product',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{categoryName(row.original.category_id)}</span>
        </div>
      ),
    },
    {
      id: 'price',
      header: 'Selling price',
      cell: ({ row }) => <span className="text-foreground">{peso(row.original.default_selling_price)}</span>,
    },
    {
      id: 'cost',
      header: 'Unit cost',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{peso(row.original.default_unit_cost)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === 'active'
              ? 'success'
              : row.original.status === 'draft'
                ? 'warning'
                : 'muted'
          }
        >
          {PRODUCT_STATUS_LABEL[row.original.status]}
        </Badge>
      ),
    },
    {
      id: 'branches',
      header: 'Branches',
      cell: ({ row }) => {
        const count = branchCount(row.original.id)
        return (
          <span className="text-sm text-muted-foreground">
            {count === 0 ? 'None' : `${count} branch${count === 1 ? '' : 'es'}`}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${row.original.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImageFor(row.original.id)}>Image</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBranchesFor(row.original)}>Branches</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Products</h2>
        <p className="text-sm text-muted-foreground">
          One record per product for the whole enterprise. Branches choose which to carry, and may be
          given their own price.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Carrying a product at a branch does not give it stock, and does not make it sellable on its own.
          Inventory arrives in a later phase — until then a branch catalogue describes intent, not what is
          on the shelf.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        searchColumn="_search"
        searchPlaceholder="Search by product or category..."
        emptyTitle="No products yet"
        emptyDescription="Add the first product to start building the catalogue."
        toolbarAction={
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New product
          </Button>
        }
      />

      <ProductDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        product={editing}
        products={list}
      />
      <BranchesDialog product={branchesFor} onClose={() => setBranchesFor(null)} />
      <ImageDialog productId={imageFor} onClose={() => setImageFor(null)} />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Store className="h-3.5 w-3.5" />
        Stock, restocking and selling are later phases. This screen owns catalogue identity only.
      </p>
    </div>
  )
}
