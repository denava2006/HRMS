import * as React from 'react'
import { ArrowDown, ArrowUp, Lock, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  usePosCategories,
  usePosProducts,
  useDeleteCategory,
  useReorderCategory,
  useSaveCategory,
  useSetCategoryActive,
} from '@/hooks/usePosCatalogue'
import { isGeneralCategory, validateCategory, type Category } from '@/lib/posCatalogue'

/**
 * The product category taxonomy.
 *
 * Global, not per branch. Products are enterprise-level, and a product has
 * exactly one category, so a branch-scoped taxonomy could not describe them.
 * That also means renaming a category here changes it for every branch --
 * which is why this screen is Administrator-only, unlike the standalone POS
 * where a store manager could edit their own store's list.
 */

function CategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  categories: Category[]
}) {
  const save = useSaveCategory()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setDescription(category?.description ?? '')
    setColor(category?.color ?? '')
  }, [open, category])

  const errors = validateCategory({ name, description, color }, categories, category?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Categories are shared by every branch. Renaming one changes it everywhere.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category_name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category_name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Drinks"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category_description">Description</Label>
            <Textarea
              id="category_description"
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category_color">Colour</Label>
            <Input
              id="category_color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#1D6FA5"
            />
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
              save.mutate(
                { id: category?.id, name, description, color },
                { onSuccess: () => onOpenChange(false) }
              )
            }
          >
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCategoryDialog({
  category,
  categories,
  productCount,
  onClose,
}: {
  category: Category | null
  categories: Category[]
  productCount: number
  onClose: () => void
}) {
  const remove = useDeleteCategory()
  const [replacementId, setReplacementId] = React.useState('')

  React.useEffect(() => {
    if (category) setReplacementId('')
  }, [category])

  if (!category) return null

  // pos_products.category_id is NOT NULL, so a category holding products cannot
  // simply vanish -- the RPC refuses without somewhere to put them.
  const options = categories.filter((c) => c.id !== category.id && c.is_active)
  const needsReplacement = productCount > 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {category.name}?</DialogTitle>
          <DialogDescription>
            {needsReplacement
              ? productCount === 1
                ? '1 product uses this category. Choose where it should go.'
                : `${productCount} products use this category. Choose where they should go.`
              : 'This category has no products. Deleting it cannot be undone.'}
          </DialogDescription>
        </DialogHeader>
        {needsReplacement && (
          <div className="flex flex-col gap-1.5">
            <Label>Move products to</Label>
            <Select value={replacementId} onValueChange={setReplacementId}>
              <SelectTrigger aria-label="Replacement category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={remove.isPending}
            disabled={needsReplacement && !replacementId}
            onClick={() =>
              remove.mutate(
                { id: category.id, replacementId: needsReplacement ? replacementId : null },
                { onSuccess: onClose }
              )
            }
          >
            Delete category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PosCategoriesPage() {
  const { data: categories, isLoading } = usePosCategories()
  const { data: products } = usePosProducts()
  const reorder = useReorderCategory()
  const setActive = useSetCategoryActive()
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Category | null>(null)

  const list = categories ?? []
  const countFor = (categoryId: string) =>
    (products ?? []).filter((p) => p.category_id === categoryId).length

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Product Categories</h2>
          <p className="text-sm text-muted-foreground">
            One taxonomy shared by every branch. The order here is the order a till shows them in.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          New category
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {list.map((category, index) => {
          const general = isGeneralCategory(category)
          const count = countFor(category.id)
          return (
            <Card key={category.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex flex-1 items-center gap-3">
                  <div
                    className="h-8 w-8 shrink-0 rounded-lg border border-border"
                    style={category.color ? { backgroundColor: category.color } : undefined}
                    aria-hidden
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{category.name}</span>
                      {general && (
                        <Badge variant="secondary">
                          <Lock className="h-3 w-3" />
                          Permanent
                        </Badge>
                      )}
                      {!category.is_active && <Badge variant="muted">Archived</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {count} product{count === 1 ? '' : 's'}
                      {category.description ? ` · ${category.description}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Move ${category.name} up`}
                    disabled={index === 0}
                    onClick={() => reorder.mutate({ id: category.id, direction: -1 })}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Move ${category.name} down`}
                    disabled={index === list.length - 1}
                    onClick={() => reorder.mutate({ id: category.id, direction: 1 })}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${category.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(category)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      {/* General is the guaranteed home for orphaned products,
                          so it can be neither archived nor deleted. The database
                          refuses too -- this only avoids offering it. */}
                      {!general && (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              setActive.mutate({ id: category.id, isActive: !category.is_active })
                            }
                          >
                            {category.is_active ? 'Archive' : 'Restore'}
                          </DropdownMenuItem>
                          <DropdownMenuItem destructive onClick={() => setDeleting(category)}>
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        category={editing}
        categories={list}
      />

      <DeleteCategoryDialog
        category={deleting}
        categories={list}
        productCount={deleting ? countFor(deleting.id) : 0}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
