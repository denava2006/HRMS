import * as React from 'react'
import { AlertTriangle, History, PackagePlus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useBranches } from '@/hooks/useBranches'
import {
  useAdjustStock,
  useBranchInventory,
  useBranchInventoryValuation,
  useBranchMovementsWithCost,
  useReceiveStock,
  useSetLowStockThreshold,
} from '@/hooks/usePosInventory'
import {
  ADJUSTMENT_REASONS,
  ADJUSTMENT_REASON_LABEL,
  MOVEMENT_LABEL,
  inventoryConcernRank,
  peso,
  projectedAverageCost,
  validateAdjustment,
  validateReceipt,
  type AdjustmentReason,
  type InventoryRow,
} from '@/lib/posInventory'

/**
 * Branch inventory, for an Administrator.
 *
 * Receiving and adjusting are Administrator-only in Phase 4. The intended flow
 * is that a POS Manager requests stock, an Administrator or FMS approves it,
 * and receiving follows -- so a manager gets visibility and a low-stock level,
 * not the ability to create inventory out of nothing.
 *
 * This is the only POS screen that shows cost. `average_unit_cost` is a
 * branch-level weighted average of what that branch actually holds; it is not
 * the enterprise product's default cost, and receiving here never changes that.
 */

function StockBadge({ row }: { row: InventoryRow }) {
  if (row.quantity_on_hand === 0) return <Badge variant="destructive">Out of stock</Badge>
  if (row.is_low_stock) {
    return (
      <Badge variant="warning">
        <AlertTriangle className="h-3 w-3" />
        Low
      </Badge>
    )
  }
  return <Badge variant="success">In stock</Badge>
}

function ReceiveDialog({
  branchId,
  row,
  currentAverage,
  onClose,
}: {
  branchId: string
  row: InventoryRow | null
  currentAverage: number
  onClose: () => void
}) {
  const receive = useReceiveStock()
  const [quantity, setQuantity] = React.useState('1')
  const [unitCost, setUnitCost] = React.useState('0')
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (row) {
      setQuantity('1')
      setUnitCost(String(currentAverage || 0))
      setNotes('')
    }
  }, [row, currentAverage])

  if (!row) return null

  const qty = Number(quantity)
  const cost = Number(unitCost)
  const errors = validateReceipt(qty, cost)
  const projected = projectedAverageCost(row.quantity_on_hand, currentAverage, qty, cost)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive {row.product_name}</DialogTitle>
          <DialogDescription>
            Records a delivery into this branch. Stock rises and the branch's average cost is
            recalculated.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="receive_quantity">Quantity received</Label>
              <Input
                id="receive_quantity"
                type="number"
                min={1}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="receive_cost">Unit cost</Label>
              <Input
                id="receive_cost"
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receive_notes">Notes</Label>
            <Textarea
              id="receive_notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — delivery reference, supplier, condition"
            />
          </div>

          {errors.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                {row.quantity_on_hand} → <strong>{row.quantity_on_hand + qty}</strong> units
              </p>
              <p className="mt-0.5">
                Branch average cost {peso(currentAverage)} → <strong>{peso(projected)}</strong>
              </p>
              <p className="mt-1.5">
                The enterprise product's default cost is unchanged — this is what this branch holds.
              </p>
            </div>
          )}

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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={receive.isPending}
            disabled={errors.length > 0}
            onClick={() =>
              receive.mutate(
                { branchId, productId: row.product_id, quantity: qty, unitCost: cost, notes },
                { onSuccess: onClose }
              )
            }
          >
            Receive stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdjustDialog({
  branchId,
  row,
  onClose,
}: {
  branchId: string
  row: InventoryRow | null
  onClose: () => void
}) {
  const adjust = useAdjustStock()
  const [change, setChange] = React.useState('0')
  const [reason, setReason] = React.useState<AdjustmentReason>('recount')
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (row) {
      setChange('0')
      setReason('recount')
      setNotes('')
    }
  }, [row])

  if (!row) return null

  const delta = Number(change)
  const errors = validateAdjustment(row.quantity_on_hand, delta, reason)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {row.product_name}</DialogTitle>
          <DialogDescription>
            Corrects the count without a delivery. The branch's average cost is left alone — nothing
            was bought.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="adjust_change">Change in units</Label>
              <Input
                id="adjust_change"
                type="number"
                step="1"
                value={change}
                onChange={(e) => setChange(e.target.value)}
                placeholder="-3"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(value) => setReason(value as AdjustmentReason)}>
                <SelectTrigger aria-label="Reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ADJUSTMENT_REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjust_notes">Notes</Label>
            <Textarea
              id="adjust_notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — what happened"
            />
          </div>

          {errors.length === 0 && delta !== 0 && (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {row.quantity_on_hand} → <strong>{row.quantity_on_hand + delta}</strong> units
            </p>
          )}

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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={adjust.isPending}
            disabled={errors.length > 0}
            onClick={() =>
              adjust.mutate(
                { branchId, productId: row.product_id, quantityChange: delta, reason, notes },
                { onSuccess: onClose }
              )
            }
          >
            Adjust stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PosInventoryPage() {
  const { data: branches, isLoading: branchesLoading } = useBranches()
  const [branchId, setBranchId] = React.useState('')
  const [receiveFor, setReceiveFor] = React.useState<InventoryRow | null>(null)
  const [adjustFor, setAdjustFor] = React.useState<InventoryRow | null>(null)
  const [showHistory, setShowHistory] = React.useState(false)

  const activeBranches = React.useMemo(() => (branches ?? []).filter((b) => b.is_active), [branches])
  React.useEffect(() => {
    if (!branchId && activeBranches.length > 0) setBranchId(activeBranches[0].id)
  }, [branchId, activeBranches])

  const { data: rows, isLoading } = useBranchInventory(branchId || undefined)
  const { data: valuation } = useBranchInventoryValuation(branchId || undefined)
  const { data: movements } = useBranchMovementsWithCost(branchId || undefined, showHistory)
  const setThreshold = useSetLowStockThreshold()

  const averageFor = (productId: string) =>
    valuation?.find((v) => v.product_id === productId)?.average_unit_cost ?? 0

  const sorted = React.useMemo(
    () =>
      [...(rows ?? [])].sort(
        (a, b) =>
          inventoryConcernRank(a) - inventoryConcernRank(b) ||
          a.product_name.localeCompare(b.product_name)
      ),
    [rows]
  )

  const totalValue = (valuation ?? []).reduce(
    (sum, v) => sum + v.quantity_on_hand * v.average_unit_cost,
    0
  )

  if (branchesLoading) return <Skeleton className="h-64 w-full" />

  if (activeBranches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          There are no active branches yet. Add one under Branches first.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Inventory</h2>
          <p className="text-sm text-muted-foreground">
            What each branch holds, and what it cost that branch. Stock moves only by receiving or
            adjusting it — never by editing a number.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-56" aria-label="Branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowHistory((open) => !open)}>
            <History className="h-4 w-4" />
            {showHistory ? 'Hide history' : 'History'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This branch carries no products yet. Assign some under Products first.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 py-4">
              <div>
                <p className="text-xs text-muted-foreground">Products carried</p>
                <p className="font-display text-lg font-semibold text-foreground">{sorted.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low or out of stock</p>
                <p className="font-display text-lg font-semibold text-foreground">
                  {sorted.filter((r) => r.is_low_stock).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stock value at this branch</p>
                <p className="font-display text-lg font-semibold text-foreground">{peso(totalValue)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>On hand</TableHead>
                  <TableHead>Low at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Avg. unit cost</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const average = averageFor(row.product_id)
                  return (
                    <TableRow key={row.product_id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{row.product_name}</span>
                          <span className="text-xs text-muted-foreground">{row.category_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{row.quantity_on_hand}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          className="h-8 w-20"
                          aria-label={`Low-stock level for ${row.product_name}`}
                          defaultValue={row.low_stock_threshold}
                          onBlur={(e) => {
                            const next = Number(e.target.value)
                            if (Number.isInteger(next) && next >= 0 && next !== row.low_stock_threshold) {
                              setThreshold.mutate({
                                branchId,
                                productId: row.product_id,
                                threshold: next,
                              })
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <StockBadge row={row} />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {peso(average)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {peso(row.quantity_on_hand * average)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Receive ${row.product_name}`}
                            onClick={() => setReceiveFor(row)}
                          >
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Adjust ${row.product_name}`}
                            onClick={() => setAdjustFor(row)}
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {showHistory && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-5">
            <div>
              <h3 className="font-medium text-foreground">Movement history</h3>
              <p className="text-sm text-muted-foreground">
                Every change to this branch's stock, and who made it.
              </p>
            </div>
            {(movements ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing has moved at this branch yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Unit cost</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(movements ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{m.product_name}</TableCell>
                        <TableCell>
                          <Badge variant={m.quantity_change > 0 ? 'success' : 'muted'}>
                            {MOVEMENT_LABEL[m.movement_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {m.stock_before} → {m.stock_after}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {m.unit_cost === null ? '—' : peso(m.unit_cost)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.actor_name ?? 'Unknown'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ReceiveDialog
        branchId={branchId}
        row={receiveFor}
        currentAverage={receiveFor ? averageFor(receiveFor.product_id) : 0}
        onClose={() => setReceiveFor(null)}
      />
      <AdjustDialog branchId={branchId} row={adjustFor} onClose={() => setAdjustFor(null)} />
    </div>
  )
}
