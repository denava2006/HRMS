import * as React from 'react'
import { ChevronLeft, ChevronRight, Printer, Receipt as ReceiptIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { SaleReceipt } from '@/components/pos/SaleReceipt'
import { usePosTransactions, useSaleDetail } from '@/hooks/usePosTransactions'
import {
  PAGE_SIZE,
  SALE_STATUS_LABEL,
  describeTransactionError,
  pageCount,
  paymentLabel,
  peso,
  summarise,
  totalFrom,
  type DateRange,
  type TransactionScope,
} from '@/lib/posTransactions'

/**
 * The transaction list, shared by the POS portal and the back office.
 *
 * One component because the three audiences differ only in which read path they
 * use and which columns are worth showing -- not in what a sale is. What each
 * may see is decided by the database, so this cannot widen anyone's scope by
 * rendering an extra column.
 *
 * No cost appears here, and none could: the RPCs behind it declare none.
 */

export interface BranchOption {
  id: string
  name: string
}

export function PosTransactionsView({
  scope,
  branches,
  branchId,
  onBranchChange,
  allowAllBranches = false,
  showCashier = true,
  showBranch = false,
  emptyMessage,
}: {
  scope: TransactionScope
  branches?: BranchOption[]
  branchId?: string
  onBranchChange?: (id: string) => void
  /** Admin only: an "every branch" option. */
  allowAllBranches?: boolean
  showCashier?: boolean
  showBranch?: boolean
  emptyMessage: string
}) {
  const [range, setRange] = React.useState<DateRange>({ from: '', to: '' })
  const [page, setPage] = React.useState(1)
  const [openSale, setOpenSale] = React.useState<string | null>(null)

  // A changed filter invalidates the page you were on.
  React.useEffect(() => {
    setPage(1)
  }, [range.from, range.to, branchId, scope])

  // "all" is the Select's own value for the every-branch option, not a branch
  // id; the RPC takes null for that.
  const queryBranchId = branchId === 'all' ? undefined : branchId

  const { data: rows, isLoading, isError, error } = usePosTransactions({
    scope,
    branchId: queryBranchId,
    range,
    page,
  })

  const list = rows ?? []
  const total = totalFrom(list)
  const pages = pageCount(total, PAGE_SIZE)
  const stats = summarise(list)

  const { data: receipt, isLoading: receiptLoading, isError: receiptError, error: receiptErr } =
    useSaleDetail(openSale)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {branches && branches.length > 0 && onBranchChange && (
          <div className="flex flex-col gap-1.5">
            <Label>Branch</Label>
            <Select value={branchId ?? ''} onValueChange={onBranchChange}>
              <SelectTrigger className="w-52" aria-label="Branch">
                <SelectValue placeholder="Choose a branch" />
              </SelectTrigger>
              <SelectContent>
                {allowAllBranches && <SelectItem value="all">Every branch</SelectItem>}
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx_from">From</Label>
          <Input
            id="tx_from"
            type="date"
            className="w-40"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx_to">To</Label>
          <Input
            id="tx_to"
            type="date"
            className="w-40"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        {(range.from || range.to) && (
          <Button variant="ghost" onClick={() => setRange({ from: '', to: '' })}>
            Clear dates
          </Button>
        )}
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {describeTransactionError(error)}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 py-4">
              <div>
                <p className="text-xs text-muted-foreground">Sales on this page</p>
                <p className="font-display text-lg font-semibold text-foreground">{stats.sales}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items sold</p>
                <p className="font-display text-lg font-semibold text-foreground">{stats.units}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taken</p>
                <p className="font-display text-lg font-semibold text-foreground">{peso(stats.taken)}</p>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">{total} in total</div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Receipt</TableHead>
                  {showBranch && <TableHead>Branch</TableHead>}
                  {showCashier && <TableHead>Cashier</TableHead>}
                  <TableHead>Items</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.sale_id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.sale_id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    {showBranch && <TableCell className="text-sm">{row.branch_name}</TableCell>}
                    {showCashier && <TableCell className="text-sm">{row.cashier_name}</TableCell>}
                    <TableCell className="tabular-nums">{row.item_count}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Badge variant="outline">{paymentLabel(row.payment_method)}</Badge>
                        {row.payment_reference && (
                          <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {row.payment_reference}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums font-medium text-foreground">
                      {peso(row.total_amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Receipt for ${row.sale_id.slice(0, 8).toUpperCase()}`}
                          onClick={() => setOpenSale(row.sale_id)}
                        >
                          <ReceiptIcon className="h-4 w-4" />
                          Receipt
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!openSale} onOpenChange={(open) => !open && setOpenSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
            <DialogDescription>
              Printed as it was on the day — from the sale's own snapshots, not today's prices.
            </DialogDescription>
          </DialogHeader>

          {receiptLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : receiptError ? (
            <p className="py-8 text-center text-sm text-destructive">
              {describeTransactionError(receiptErr)}
            </p>
          ) : receipt ? (
            <div id="printable-receipt">
              <SaleReceipt receipt={receipt} />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {SALE_STATUS_LABEL[receipt.status as 'completed'] ?? receipt.status}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSale(null)}>
              Close
            </Button>
            <Button disabled={!receipt} onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
