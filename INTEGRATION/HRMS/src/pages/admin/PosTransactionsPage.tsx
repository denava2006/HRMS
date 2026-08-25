import * as React from 'react'
import { Info } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { PosTransactionsView } from '@/components/pos/PosTransactionsView'

/**
 * Transaction history for the Administrator, inside the back office.
 *
 * This is an operational module -- what was sold, to whom it was rung up by,
 * what was paid, and the receipt. It shows no cost, no COGS and no margin, and
 * not because they are hidden: `get_admin_transactions` does not declare them.
 * The sale tables themselves remain Administrator-readable, but this screen
 * never queries them, so a future edit here cannot surface valuation by
 * accident.
 *
 * Profit and cost analysis belong to Reports and to FMS, where the accounting
 * treatment of customer-paid fees can be settled properly.
 */
export default function AdminPosTransactionsPage() {
  const { data: branches } = useBranches()
  const [branchId, setBranchId] = React.useState('all')

  const options = React.useMemo(
    () => (branches ?? []).filter((b) => b.is_active).map((b) => ({ id: b.id, name: b.name })),
    [branches]
  )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">POS Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Every sale across the business, with its receipt as it was printed.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          An operational view: what was sold and what was paid. Cost, margin and profit are not shown
          here — they belong to reporting, once their accounting treatment is settled.
        </p>
      </div>

      <PosTransactionsView
        scope="admin"
        branches={options}
        branchId={branchId}
        onBranchChange={setBranchId}
        allowAllBranches
        showCashier
        showBranch
        emptyMessage="No sales have been recorded yet."
      />
    </div>
  )
}
