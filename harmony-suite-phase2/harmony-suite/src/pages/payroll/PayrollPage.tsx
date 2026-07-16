import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Users2, TrendingUp, TrendingDown, Wallet, FileCheck, Plus, MoreHorizontal, PlayCircle } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { CreatePayrollPeriodDialog } from '@/components/payroll/CreatePayrollPeriodDialog'
import { AdjustPayrollRecordDialog } from '@/components/payroll/AdjustPayrollRecordDialog'
import { PayrollDetailsSheet } from '@/components/payroll/PayrollDetailsSheet'
import {
  usePayrollPeriods,
  usePayrollRecords,
  usePayrollPeriodStats,
  useGeneratePayroll,
  useReviewPayroll,
  useReleasePayroll,
  usePayrollRealtimeAlerts,
  type PayrollRecord,
} from '@/hooks/usePayroll'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import { PAYROLL_STATUS_LABEL, PAYROLL_STATUS_VARIANT, PAYROLL_FREQUENCY_LABEL } from '@/lib/payrollLabels'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'
import { formatMoney, type CurrencyCode } from '@/lib/currency'

const ALL = 'all'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  index,
}: {
  label: string
  value: string
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
            {isLoading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="font-display text-xl font-bold text-foreground">{value}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function PayrollPage() {
  usePayrollRealtimeAlerts()

  const { data: periods, isLoading: periodsLoading } = usePayrollPeriods()
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectedPeriodId && periods && periods.length > 0) {
      setSelectedPeriodId(periods[0].id)
    }
  }, [periods, selectedPeriodId])

  const selectedPeriod = periods?.find((p) => p.id === selectedPeriodId) ?? null

  const { data: records, isLoading: recordsLoading, isError } = usePayrollRecords(selectedPeriodId ?? undefined)
  const { data: stats, isLoading: statsLoading } = usePayrollPeriodStats(selectedPeriodId ?? undefined)
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()

  const generatePayroll = useGeneratePayroll()
  const reviewPayroll = useReviewPayroll()
  const releasePayroll = useReleasePayroll()

  const [departmentFilter, setDepartmentFilter] = React.useState(ALL)
  const [positionFilter, setPositionFilter] = React.useState(ALL)
  const [employmentTypeFilter, setEmploymentTypeFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] = React.useState(ALL)

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [adjustingRecord, setAdjustingRecord] = React.useState<PayrollRecord | null>(null)
  const [viewingRecordId, setViewingRecordId] = React.useState<string | null>(null)
  const [reviewConfirmOpen, setReviewConfirmOpen] = React.useState(false)
  const [releaseConfirmOpen, setReleaseConfirmOpen] = React.useState(false)

  const filteredPositions = React.useMemo(
    () => (departmentFilter === ALL ? positions : positions?.filter((p) => p.department_id === departmentFilter)),
    [positions, departmentFilter]
  )

  const rows = React.useMemo(() => {
    if (!records) return []
    return records.filter((r) => {
      if (departmentFilter !== ALL && r.employees.department_id !== departmentFilter) return false
      if (positionFilter !== ALL && r.employees.position_id !== positionFilter) return false
      if (employmentTypeFilter !== ALL && r.employees.employment_type !== employmentTypeFilter) return false
      if (statusFilter !== ALL && r.status !== statusFilter) return false
      return true
    })
  }, [records, departmentFilter, positionFilter, employmentTypeFilter, statusFilter])

  const columns: ColumnDef<PayrollRecord>[] = [
    {
      id: '_searchText',
      accessorFn: (row) => [row.employees.employee_number, row.employees.first_name, row.employees.last_name].filter(Boolean).join(' ').toLowerCase(),
      header: () => null,
      cell: () => null,
    },
    {
      id: 'name',
      header: 'Employee Name',
      accessorFn: (row) => `${row.employees.first_name} ${row.employees.last_name}`,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">
            {row.original.employees.first_name} {row.original.employees.last_name}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.employees.employee_number}</p>
        </div>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      accessorFn: (row) => row.employees.departments?.name ?? '',
      cell: ({ row }) => (row.original.employees.departments?.name ? <Badge variant="secondary">{row.original.employees.departments.name}</Badge> : '—'),
    },
    {
      id: 'basic_salary',
      header: 'Basic Salary',
      accessorFn: (row) => row.basic_salary,
      cell: ({ row }) => formatMoney(Number(row.original.basic_salary), row.original.currency as CurrencyCode),
    },
    {
      id: 'gross_salary',
      header: 'Gross Salary',
      accessorFn: (row) => row.gross_salary,
      cell: ({ row }) => formatMoney(Number(row.original.gross_salary), row.original.currency as CurrencyCode),
    },
    {
      id: 'total_deductions',
      header: 'Deductions',
      accessorFn: (row) => row.total_deductions,
      cell: ({ row }) => formatMoney(Number(row.original.total_deductions), row.original.currency as CurrencyCode),
    },
    {
      id: 'net_salary',
      header: 'Net Salary',
      accessorFn: (row) => row.net_salary,
      cell: ({ row }) => <span className="font-medium text-foreground">{formatMoney(Number(row.original.net_salary), row.original.currency as CurrencyCode)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={PAYROLL_STATUS_VARIANT[row.original.status]}>{PAYROLL_STATUS_LABEL[row.original.status]}</Badge>,
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
            <DropdownMenuItem onClick={() => setViewingRecordId(row.original.id)}>View</DropdownMenuItem>
            {row.original.status !== 'released' && (
              <DropdownMenuItem onClick={() => setAdjustingRecord(row.original)}>Adjust Payroll</DropdownMenuItem>
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
          <h2 className="font-display text-xl font-semibold text-foreground">Payroll Management</h2>
          <p className="text-sm text-muted-foreground">Compute, review, and release payroll for every employee.</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Payroll Period
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedPeriodId ?? ''} onValueChange={setSelectedPeriodId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={periodsLoading ? 'Loading periods…' : 'Select a payroll period'} />
          </SelectTrigger>
          <SelectContent>
            {periods?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {formatDate(p.period_start)} – {formatDate(p.period_end)} ({PAYROLL_FREQUENCY_LABEL[p.frequency]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPeriod && <Badge variant={PAYROLL_STATUS_VARIANT[selectedPeriod.status]}>{PAYROLL_STATUS_LABEL[selectedPeriod.status]}</Badge>}
      </div>

      {!selectedPeriod ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">No payroll periods yet</p>
          <p className="text-sm text-muted-foreground">Create a payroll period to get started.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Payroll Period"
              value={`${formatDate(selectedPeriod.period_start)} – ${formatDate(selectedPeriod.period_end)}`}
              icon={Wallet}
              isLoading={false}
              index={0}
            />
            <StatCard label="Employees Included" value={String(stats?.employeesIncluded ?? 0)} icon={Users2} isLoading={statsLoading} index={1} />
            <StatCard label="Gross Payroll" value={formatMoney(stats?.grossPayroll ?? 0, 'PHP')} icon={TrendingUp} isLoading={statsLoading} index={2} />
            <StatCard label="Total Deductions" value={formatMoney(stats?.totalDeductions ?? 0, 'PHP')} icon={TrendingDown} isLoading={statsLoading} index={3} />
            <StatCard label="Total Net Payroll" value={formatMoney(stats?.totalNetPayroll ?? 0, 'PHP')} icon={Wallet} isLoading={statsLoading} index={4} />
            <StatCard label="Payslips Released" value={String(stats?.payslipsReleased ?? 0)} icon={FileCheck} isLoading={statsLoading} index={5} />
          </div>

          {records && records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <p className="font-medium text-foreground">Payroll hasn't been generated for this period yet</p>
              <p className="text-sm text-muted-foreground">
                Employee records, attendance, and leave will be retrieved automatically.
              </p>
              <Button loading={generatePayroll.isPending} onClick={() => generatePayroll.mutate({ periodId: selectedPeriod.id })}>
                <PlayCircle className="h-4 w-4" />
                Generate Payroll
              </Button>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
              <p className="font-medium text-foreground">Couldn't load payroll records</p>
              <p className="text-sm text-muted-foreground">Please refresh the page or try again shortly.</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={recordsLoading}
              density="compact"
              searchPlaceholder="Search by name, employee ID, or department..."
              searchColumn="_searchText"
              emptyTitle="No payroll records match these filters"
              toolbarAction={
                <div className="flex flex-wrap items-center gap-2">
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
                  <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Employment Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All types</SelectItem>
                      {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
                      {(Object.entries(PAYROLL_STATUS_LABEL) as [keyof typeof PAYROLL_STATUS_LABEL, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPeriod.status === 'draft' && (
                    <Button variant="outline" size="sm" loading={reviewPayroll.isPending} onClick={() => setReviewConfirmOpen(true)}>
                      Review &amp; Approve
                    </Button>
                  )}
                  {selectedPeriod.status === 'reviewed' && (
                    <Button size="sm" loading={releasePayroll.isPending} onClick={() => setReleaseConfirmOpen(true)}>
                      Release Payroll
                    </Button>
                  )}
                </div>
              }
            />
          )}
        </>
      )}

      <CreatePayrollPeriodDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreated={setSelectedPeriodId} />
      <AdjustPayrollRecordDialog open={!!adjustingRecord} onOpenChange={(open) => !open && setAdjustingRecord(null)} record={adjustingRecord} />
      <PayrollDetailsSheet recordId={viewingRecordId} open={!!viewingRecordId} onOpenChange={(open) => !open && setViewingRecordId(null)} />

      <AlertDialog open={reviewConfirmOpen} onOpenChange={setReviewConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this payroll for release?</AlertDialogTitle>
            <AlertDialogDescription>
              This confirms the salary computation, attendance, leave, and deductions are correct for all {stats?.employeesIncluded ?? 0} employees. You
              can still adjust individual records afterward if needed — any adjustment returns this payroll to draft for re-approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedPeriod) reviewPayroll.mutate({ periodId: selectedPeriod.id })
                setReviewConfirmOpen(false)
              }}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={releaseConfirmOpen} onOpenChange={setReleaseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release this payroll?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates a payslip for every employee in this period and marks all records as released. Released payroll records become read-only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedPeriod) releasePayroll.mutate({ periodId: selectedPeriod.id })
                setReleaseConfirmOpen(false)
              }}
            >
              Release Payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
