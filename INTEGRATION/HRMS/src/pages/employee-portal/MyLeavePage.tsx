import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { SubmitLeaveRequestDialog } from '@/components/leave/SubmitLeaveRequestDialog'
import { LeaveDetailsSheet } from '@/components/leave/LeaveDetailsSheet'
import { useEmployeeLeaveBalances } from '@/hooks/useLeave'
import { useMyLeaveRequests, useMyPortalRealtimeAlerts, type MyLeaveRequest } from '@/hooks/useEmployeePortal'
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT } from '@/lib/leaveLabels'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MyLeavePage() {
  useMyPortalRealtimeAlerts()
  const { profile } = useAuth()
  const { data: balances, isLoading: isLoadingBalances } = useEmployeeLeaveBalances(profile?.employee_id ?? undefined)
  const { data: requests, isLoading, isError } = useMyLeaveRequests()

  const [submitOpen, setSubmitOpen] = React.useState(false)
  const [viewingRequestId, setViewingRequestId] = React.useState<string | null>(null)

  const columns: ColumnDef<MyLeaveRequest>[] = [
    { id: 'leave_type', header: 'Leave Type', accessorFn: (row) => row.leave_types.name },
    { id: 'start_date', header: 'Start Date', accessorFn: (row) => row.start_date, cell: ({ row }) => formatDate(row.original.start_date) },
    { id: 'end_date', header: 'End Date', accessorFn: (row) => row.end_date, cell: ({ row }) => formatDate(row.original.end_date) },
    { id: 'days', header: 'Days', accessorFn: (row) => Number(row.days_requested) },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={LEAVE_STATUS_VARIANT[row.original.status]}>{LEAVE_STATUS_LABEL[row.original.status]}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">My Leave</h2>
          <p className="text-sm text-muted-foreground">Check your leave balances and submit new requests.</p>
        </div>
        <Button onClick={() => setSubmitOpen(true)}>
          <Plus className="h-4 w-4" />
          Submit Leave Request
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {isLoadingBalances
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-6 w-12" />
                </CardContent>
              </Card>
            ))
          : balances?.map((b) => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{b.leave_types.name}</p>
                  <p className="font-display text-xl font-bold text-foreground">{Number(b.remaining_credits ?? 0)} Days</p>
                  <p className="text-xs text-muted-foreground">of {Number(b.total_credits)} total</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">Couldn't load your leave requests</p>
          <p className="text-sm text-muted-foreground">Please refresh the page or try again shortly.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={requests ?? []}
          isLoading={isLoading}
          density="compact"
          searchPlaceholder="Search..."
          emptyTitle="No leave requests yet"
          emptyDescription="Submit your first leave request using the button above."
          onRowClick={(row) => setViewingRequestId(row.id)}
        />
      )}

      <SubmitLeaveRequestDialog open={submitOpen} onOpenChange={setSubmitOpen} defaultEmployeeId={profile?.employee_id ?? undefined} />
      <LeaveDetailsSheet requestId={viewingRequestId} open={!!viewingRequestId} onOpenChange={(open) => !open && setViewingRequestId(null)} />
    </div>
  )
}
