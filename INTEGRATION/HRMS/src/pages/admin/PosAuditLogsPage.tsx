import * as React from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PosAuditLogsView } from '@/components/pos/PosAuditLogsView'
import { useBranches } from '@/hooks/useBranches'
import { useAdminAuditEvents } from '@/hooks/usePosAudit'
import type { AdminBranchScope } from '@/lib/posAudit'
import type { PosReportRange } from '@/lib/posReports'
import type { PosAuditEntityType, PosAuditEventType } from '@/lib/enums'

/**
 * The POS audit log for the Administrator, inside the back office.
 *
 * Everything a Manager sees, plus POS access administration and enterprise
 * catalogue changes, with the actor's enterprise and POS roles recorded
 * separately.
 *
 * Enterprise-wide events carry no branch. They are reachable under "All POS" or
 * the explicit "Enterprise-wide" scope, and are never filed under a branch they
 * did not happen at -- a product created once for the whole business did not
 * happen at Cavite merely because Cavite carries it today.
 *
 * Still no cost, COGS or margin: a buying-cost change is recorded as a fact,
 * never as a number. Financial history belongs to Reports and to FMS.
 */
export default function AdminPosAuditLogsPage() {
  const { data: branches } = useBranches()

  const [scope, setScope] = React.useState<AdminBranchScope>('all')
  const [range, setRange] = React.useState<PosReportRange | undefined>()
  const [page, setPage] = React.useState(1)
  const [eventType, setEventType] = React.useState<PosAuditEventType | undefined>()
  const [entityType, setEntityType] = React.useState<PosAuditEntityType | undefined>()

  const options = React.useMemo(
    () => (branches ?? []).filter((b) => b.is_active).map((b) => ({ id: b.id, name: b.name })),
    [branches]
  )

  const query = useAdminAuditEvents({
    surface: 'admin',
    scope,
    range,
    eventType,
    entityType,
    page,
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">POS Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Every POS configuration, catalogue and access change across the business.
        </p>
      </div>

      <PosAuditLogsView
        surface="admin"
        rows={query.data ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        range={range}
        onRangeChange={setRange}
        page={page}
        onPageChange={setPage}
        eventType={eventType}
        onEventTypeChange={setEventType}
        entityType={entityType}
        onEntityTypeChange={setEntityType}
        emptyMessage="No POS changes were recorded in that period."
        scopeControl={
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-scope">Scope</Label>
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value as AdminBranchScope)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-56" id="audit-scope" aria-label="Scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All POS</SelectItem>
                <SelectItem value="global">Enterprise-wide only</SelectItem>
                {options.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        note={
          'An operational and administrative record. Sales and stock movements are not repeated ' +
          'here — Transactions and Inventory already hold them. Cost and margin are not shown: a ' +
          'buying-cost change is recorded as a fact, and the figures belong to Reports.'
        }
      />
    </div>
  )
}
