import * as React from 'react'
import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useBranches } from '@/hooks/useBranches'
import { PosTransactionsView } from '@/components/pos/PosTransactionsView'
import { managerBranchIds } from '@/lib/portals'

/**
 * Transaction history in the POS portal.
 *
 * A cashier sees their own sales and nothing else -- not their colleagues', not
 * even at the same branch. `get_my_transactions` has no cashier parameter, so
 * that is not a rule the interface enforces; it is a request that cannot be
 * made.
 *
 * A POS Manager gets a second tab for the branches they manage, showing every
 * cashier's sales there. Manager authority is per branch: somebody who manages
 * Cavite and cashes up at Main Office sees all of Cavite and only their own
 * sales at Main Office. That is why the branch list here comes from
 * `managerBranchIds` rather than from every branch they can reach.
 */
export default function PosTransactionsPage() {
  const { posAccess } = useAuth()
  const { data: branches } = useBranches()

  const managed = React.useMemo(() => {
    const ids = managerBranchIds(posAccess)
    return (branches ?? []).filter((b) => ids.includes(b.id)).map((b) => ({ id: b.id, name: b.name }))
  }, [branches, posAccess])

  const [branchId, setBranchId] = React.useState('')
  React.useEffect(() => {
    if (!branchId && managed.length > 0) setBranchId(managed[0].id)
  }, [branchId, managed])

  const isManager = managed.length > 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Transactions</h2>
        <p className="text-sm text-muted-foreground">
          {isManager
            ? 'Your own sales, and everything sold at the branches you manage.'
            : 'Every sale you have rung up.'}
        </p>
      </div>

      {!isManager ? (
        <PosTransactionsView
          scope="mine"
          showCashier={false}
          showBranch
          emptyMessage="You have not rung up a sale yet."
        />
      ) : (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My sales</TabsTrigger>
            <TabsTrigger value="branch">Branch</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            <PosTransactionsView
              scope="mine"
              showCashier={false}
              showBranch
              emptyMessage="You have not rung up a sale yet."
            />
          </TabsContent>

          <TabsContent value="branch" className="mt-4 flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Only the branches you manage appear here. At a branch where you work a till rather
                than manage it, you see your own sales on the other tab.
              </p>
            </div>
            {managed.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  You do not manage a branch.
                </CardContent>
              </Card>
            ) : (
              <PosTransactionsView
                scope="branch"
                branches={managed}
                branchId={branchId}
                onBranchChange={setBranchId}
                showCashier
                emptyMessage="Nothing has been sold at this branch yet."
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
