import * as React from 'react'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PosReportRange } from '@/components/pos/PosReportRange'
import { usePosReportPresets } from '@/hooks/usePosReports'
import {
  defaultPosReportRange,
  formatPosBusinessDateShort,
  type PosReportRange as Range,
} from '@/lib/posReports'
import {
  POS_AUDIT_ENTITY_LABEL,
  POS_AUDIT_PAGE_SIZE,
  describeAuditError,
  entityLabel,
  eventLabel,
  eventTypesFor,
  formatActorRole,
  formatChange,
  formatEventTime,
  pageCount,
  totalFrom,
  type AdminAuditEvent,
  type AuditSurface,
  type ManagerAuditEvent,
} from '@/lib/posAudit'
import type { PosAuditEntityType, PosAuditEventType } from '@/lib/enums'

/**
 * The audit log table, shared by the Manager and Administrator screens.
 *
 * The two surfaces read different RPCs with different declared results. This
 * component renders whichever it is given; it does not filter one contract down
 * into the other, because a rendering-time filter is not a confidentiality
 * boundary. The Manager RPC simply never returns the administrator columns.
 *
 * Event labels come from the taxonomy, not from a stored description, so a
 * label cannot carry text a writer improvised into a column.
 */

export interface AuditViewProps {
  surface: AuditSurface
  rows: (ManagerAuditEvent | AdminAuditEvent)[]
  isLoading: boolean
  isError: boolean
  error: unknown
  range: Range | undefined
  onRangeChange: (range: Range) => void
  page: number
  onPageChange: (page: number) => void
  eventType: PosAuditEventType | undefined
  onEventTypeChange: (value: PosAuditEventType | undefined) => void
  entityType: PosAuditEntityType | undefined
  onEntityTypeChange: (value: PosAuditEntityType | undefined) => void
  emptyMessage: string
  /** Rendered beside the filters — the branch or scope picker for this surface. */
  scopeControl?: React.ReactNode
  note: string
}

const ANY = '__any__'

function isAdminEvent(row: ManagerAuditEvent | AdminAuditEvent): row is AdminAuditEvent {
  return 'manager_visible' in row
}

export function PosAuditLogsView({
  surface,
  rows,
  isLoading,
  isError,
  error,
  range,
  onRangeChange,
  page,
  onPageChange,
  eventType,
  onEventTypeChange,
  entityType,
  onEntityTypeChange,
  emptyMessage,
  scopeControl,
  note,
}: AuditViewProps) {
  const { data: presets, isLoading: presetsLoading } = usePosReportPresets()

  // The default period comes from the database's own preset contract -- Month
  // to Date, resolved in Asia/Manila. Nothing here computes a day boundary from
  // the device clock.
  React.useEffect(() => {
    if (range || !presets?.length) return
    const fallback = defaultPosReportRange(presets)
    if (fallback) onRangeChange(fallback)
  }, [presets, range, onRangeChange])

  const total = totalFrom(rows)
  const pages = pageCount(total)
  const types = eventTypesFor(surface)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>

      <PosReportRange
        presets={presets ?? []}
        value={range}
        onChange={(next) => {
          onRangeChange(next)
          onPageChange(1)
        }}
        isLoading={presetsLoading}
        summaryNoun="changes"
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-5">
          {scopeControl}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-event-type">Event</Label>
            <Select
              value={eventType ?? ANY}
              onValueChange={(value) => {
                onEventTypeChange(value === ANY ? undefined : (value as PosAuditEventType))
                onPageChange(1)
              }}
            >
              <SelectTrigger className="w-60" id="audit-event-type" aria-label="Event">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Every event</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {eventLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-entity-type">What changed</Label>
            <Select
              value={entityType ?? ANY}
              onValueChange={(value) => {
                onEntityTypeChange(value === ANY ? undefined : (value as PosAuditEntityType))
                onPageChange(1)
              }}
            >
              <SelectTrigger className="w-52" id="audit-entity-type" aria-label="What changed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anything</SelectItem>
                {(Object.keys(POS_AUDIT_ENTITY_LABEL) as PosAuditEntityType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {entityLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {total} {total === 1 ? 'event' : 'events'} in total
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {describeAuditError(error)}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Who</TableHead>
                  {surface === 'admin' && <TableHead>Scope</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.event_id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-foreground">
                        {formatPosBusinessDateShort(row.business_date)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatEventTime(row.occurred_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {eventLabel(row.event_type)}
                        </span>
                        {isAdminEvent(row) && !row.manager_visible && (
                          <Badge variant="secondary">Admin only</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entityLabel(row.entity_type)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {row.entity_name ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-72 truncate">
                      {formatChange(row.old_value, row.new_value)}
                    </TableCell>
                    <TableCell>
                      <div className="text-foreground">{row.actor_name}</div>
                      {isAdminEvent(row) && (
                        <div className="text-xs text-muted-foreground">
                          {formatActorRole(row.actor_enterprise_role, row.actor_pos_role)}
                        </div>
                      )}
                    </TableCell>
                    {surface === 'admin' && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.branch_name ?? 'Enterprise-wide'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages} · {POS_AUDIT_PAGE_SIZE} per page
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
