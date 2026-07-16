import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Hourglass, CheckCircle2, XCircle, Users2, CalendarDays, Wallet, MoreHorizontal, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SubmitLeaveRequestDialog } from '@/components/leave/SubmitLeaveRequestDialog'
import { ApproveLeaveDialog } from '@/components/leave/ApproveLeaveDialog'
import { RejectLeaveDialog } from '@/components/leave/RejectLeaveDialog'
import { LeaveDetailsSheet } from '@/components/leave/LeaveDetailsSheet'
import { useLeaveRequests, useLeaveStats, useLeaveTypes, useLeaveRealtimeAlerts, type LeaveRequest } from '@/hooks/useLeave'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT } from '@/lib/leaveLabels'
import type { LeaveRequestStatus } from '@/lib/database.types'

const ALL = 'all'

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeekISODate(): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonthISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function endOfMonthISODate(): string {
  const d = new Date()
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

type QuickRange = 'today' | 'this_week' | 'this_month' | 'custom'

function rangeForQuickFilter(range: QuickRange): { from: string; to: string } {
  const today = todayISODate()
  if (range === 'this_week') return { from: startOfWeekISODate(), to: today }
  if (range === 'this_month') return { from: startOfMonthISODate(), to: endOfMonthISODate() }
  return { from: today, to: today }
}

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  index,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  isLoading: boolean
  index: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {isLoading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className="font-display text-xl font-bold text-foreground">{value}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function LeavePage() {
  useLeaveRealtimeAlerts()

  const [quickRange, setQuickRange] = React.useState<QuickRange>('this_month')
  const [customFrom, setCustomFrom] = React.useState(startOfMonthISODate())
  const [customTo, setCustomTo] = React.useState(endOfMonthISODate())
  const { from: rangeFrom, to: rangeTo } = quickRange === 'custom' ? { from: customFrom, to: customTo } : rangeForQuickFilter(quickRange)

  const { data: requests, isLoading, isError } = useLeaveRequests(rangeFrom, rangeTo)
  const { data: stats, isLoading: statsLoading } = useLeaveStats()
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const { data: leaveTypes } = useLeaveTypes()

  const [departmentFilter, setDepartmentFilter] = React.useState(ALL)
  const [positionFilter, setPositionFilter] = React.useState(ALL)
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] = React.useState(ALL)

  const [submitDialogOpen, setSubmitDialogOpen] = React.useState(false)
  const [approvingRequest, setApprovingRequest] = React.useState<LeaveRequest | null>(null)
  const [rejectingRequest, setRejectingRequest] = React.useState<LeaveRequest | null>(null)
  const [viewingRequestId, setViewingRequestId] = React.useState<string | null>(null)

  const filteredPositions = React.useMemo(
    () => (departmentFilter === ALL ? positions : positions?.filter((p) => p.department_id === departmentFilter)),
    [positions, departmentFilter]
  )

  const rows = React.useMemo(() => {
    if (!requests) return []
    return requests.filter((r) => {
      if (departmentFilter !== ALL && r.employees.department_id !== departmentFilter) return false
      if (positionFilter !== ALL && r.employees.position_id !== positionFilter) return false
      if (leaveTypeFilter !== ALL && r.leave_type_id !== leaveTypeFilter) return false
      if (statusFilter !== ALL && r.status !== statusFilter) return false
      return true
    })
  }, [requests, departmentFilter, positionFilter, leaveTypeFilter, statusFilter])

  const columns: ColumnDef<LeaveRequest>[] = [
    {
      id: '_searchText',
      accessorFn: (row) => [row.employees.employee_number, row.employees.first_name, row.employees.last_name, row.employees.email].filter(Boolean).join(' ').toLowerCase(),
      header: () => null,
      cell: () => null,
    },
    {
      id: 'employee_id',
      header: 'Employee ID',
      accessorFn: (row) => row.employees.employee_number,
      cell: ({ row }) => <span className="font-mono text-sm text-foreground">{row.original.employees.employee_number}</span>,
    },
    {
      id: 'name',
      header: 'Employee Name',
      accessorFn: (row) => `${row.employees.first_name} ${row.employees.last_name}`,
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.employees.first_name} {row.original.employees.last_name}
        </span>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      accessorFn: (row) => row.employees.departments?.name ?? '',
      cell: ({ row }) => (row.original.employees.departments?.name ? <Badge variant="secondary">{row.original.employees.departments.name}</Badge> : '—'),
    },
    {
      id: 'leave_type',
      header: 'Leave Type',
      accessorFn: (row) => row.leave_types.name,
    },
    {
      id: 'leave_dates',
      header: 'Leave Dates',
      accessorFn: (row) => row.start_date,
      cell: ({ row }) => `${formatDate(row.original.start_date)} – ${formatDate(row.original.end_date)}`,
    },
    {
      id: 'days_requested',
      header: 'Total Days',
      accessorFn: (row) => row.days_requested,
      cell: ({ row }) => Number(row.original.days_requested),
    },
    {
      id: 'submitted',
      header: 'Submitted Date',
      accessorFn: (row) => row.created_at,
      cell: ({ row }) => formatDate(row.original.created_at.slice(0, 10)),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={LEAVE_STATUS_VARIANT[row.original.status]}>{LEAVE_STATUS_LABEL[row.original.status]}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewingRequestId(row.original.id)}>View</DropdownMenuItem>
            {row.original.status === 'pending' && (
              <>
                <DropdownMenuItem onClick={() => setApprovingRequest(row.original)}>Approve</DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => setRejectingRequest(row.original)}>
                  Reject
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Leave Management</h2>
          <p className="text-sm text-muted-foreground">Review, approve, and track leave requests for every employee.</p>
        </div>
        <Button onClick={() => setSubmitDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Submit Leave Request
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Pending Requests" value={stats?.pendingCount ?? 0} icon={Hourglass} isLoading={statsLoading} index={0} />
        <StatCard label="Approved Leaves" value={stats?.approvedCount ?? 0} icon={CheckCircle2} isLoading={statsLoading} index={1} />
        <StatCard label="Rejected Leaves" value={stats?.rejectedCount ?? 0} icon={XCircle} isLoading={statsLoading} index={2} />
        <StatCard label="Currently On Leave" value={stats?.currentlyOnLeaveCount ?? 0} icon={Users2} isLoading={statsLoading} index={3} />
        <StatCard label="Requests This Month" value={stats?.thisMonthCount ?? 0} icon={CalendarDays} isLoading={statsLoading} index={4} />
        <StatCard label="Total Credits Used" value={stats?.totalCreditsUsed ?? 0} icon={Wallet} isLoading={statsLoading} index={5} />
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">Couldn't load leave requests</p>
          <p className="text-sm text-muted-foreground">Please refresh the page or try again shortly.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          density="compact"
          searchPlaceholder="Search by name, employee ID, or email..."
          searchColumn="_searchText"
          emptyTitle="No leave requests for this range"
          emptyDescription="Submit a leave request to get started."
          toolbarAction={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={quickRange} onValueChange={(v) => setQuickRange(v as QuickRange)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              {quickRange === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36" />
                </div>
              )}
              <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPositionFilter(ALL) }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All positions</SelectItem>
                  {filteredPositions?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Leave Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All leave types</SelectItem>
                  {leaveTypes?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {(Object.entries(LEAVE_STATUS_LABEL) as [LeaveRequestStatus, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
      )}

      <SubmitLeaveRequestDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen} />
      <ApproveLeaveDialog open={!!approvingRequest} onOpenChange={(open) => !open && setApprovingRequest(null)} request={approvingRequest} />
      <RejectLeaveDialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)} request={rejectingRequest} />
      <LeaveDetailsSheet requestId={viewingRequestId} open={!!viewingRequestId} onOpenChange={(open) => !open && setViewingRequestId(null)} />
    </div>
  )
}
