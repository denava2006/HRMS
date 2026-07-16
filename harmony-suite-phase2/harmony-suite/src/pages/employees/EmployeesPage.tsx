import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Users, UserCheck, GraduationCap, BadgeCheck, UserX, Eye, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEmployees, useEmployeeStats, type Employee } from '@/hooks/useEmployees'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'
import { EMPLOYMENT_STATUS_LABEL, EMPLOYMENT_STATUS_VARIANT } from '@/lib/employeeLabels'
import type { EmploymentStatus } from '@/lib/database.types'

const ALL = 'all'

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="font-display text-xl font-bold text-foreground">{value}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const { data: employees, isLoading, isError } = useEmployees()
  const { data: stats, isLoading: statsLoading } = useEmployeeStats()
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()

  const [departmentFilter, setDepartmentFilter] = React.useState(ALL)
  const [positionFilter, setPositionFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] = React.useState(ALL)
  const [typeFilter, setTypeFilter] = React.useState(ALL)
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')

  const filteredPositions = React.useMemo(
    () => (departmentFilter === ALL ? positions : positions?.filter((p) => p.department_id === departmentFilter)),
    [positions, departmentFilter]
  )

  const rows = React.useMemo(() => {
    if (!employees) return []
    return employees.filter((emp) => {
      if (departmentFilter !== ALL && emp.department_id !== departmentFilter) return false
      if (positionFilter !== ALL && emp.position_id !== positionFilter) return false
      if (statusFilter !== ALL && emp.employment_status !== statusFilter) return false
      if (typeFilter !== ALL && emp.employment_type !== typeFilter) return false
      if (dateFrom && emp.hire_date < dateFrom) return false
      if (dateTo && emp.hire_date > dateTo) return false
      return true
    })
  }, [employees, departmentFilter, positionFilter, statusFilter, typeFilter, dateFrom, dateTo])

  const columns: ColumnDef<Employee>[] = [
    {
      id: '_searchText',
      accessorFn: (row) => [row.employee_number, row.first_name, row.last_name, row.email].filter(Boolean).join(' ').toLowerCase(),
      header: () => null,
      cell: () => null,
    },
    {
      id: 'employee_number',
      header: 'Employee ID',
      accessorFn: (row) => row.employee_number,
      cell: ({ row }) => <span className="font-mono text-sm text-foreground">{row.original.employee_number}</span>,
    },
    {
      id: 'name',
      header: 'Employee Name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.first_name} {row.original.last_name}
        </span>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      accessorFn: (row) => row.departments?.name ?? '',
      cell: ({ row }) => (row.original.departments?.name ? <Badge variant="secondary">{row.original.departments.name}</Badge> : '—'),
    },
    {
      id: 'position',
      header: 'Position',
      accessorFn: (row) => row.positions?.title ?? '',
      cell: ({ row }) => row.original.positions?.title ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'employment_type',
      header: 'Employment Type',
      accessorFn: (row) => EMPLOYMENT_TYPE_LABEL[row.employment_type],
    },
    {
      id: 'employment_status',
      header: 'Employment Status',
      accessorFn: (row) => EMPLOYMENT_STATUS_LABEL[row.employment_status],
      cell: ({ row }) => (
        <Badge variant={EMPLOYMENT_STATUS_VARIANT[row.original.employment_status]}>
          {EMPLOYMENT_STATUS_LABEL[row.original.employment_status]}
        </Badge>
      ),
    },
    {
      id: 'hire_date',
      header: 'Date Hired',
      accessorFn: (row) => row.hire_date,
      cell: ({ row }) => formatDate(row.original.hire_date),
    },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/dashboard/employees/${row.original.id}`)
          }}
        >
          <Eye className="h-4 w-4" />
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Employee Management</h2>
          <p className="text-sm text-muted-foreground">The single source of truth for every employee record.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/employees/new')}>
          <Plus className="h-4 w-4" />
          Create Employee
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Employees" value={stats?.total ?? 0} icon={Users} isLoading={statsLoading} index={0} />
        <StatCard label="Active Employees" value={stats?.active ?? 0} icon={UserCheck} isLoading={statsLoading} index={1} />
        <StatCard label="Probationary Employees" value={stats?.probationary ?? 0} icon={GraduationCap} isLoading={statsLoading} index={2} />
        <StatCard label="Regular Employees" value={stats?.regular ?? 0} icon={BadgeCheck} isLoading={statsLoading} index={3} />
        <StatCard label="Inactive Employees" value={stats?.inactive ?? 0} icon={UserX} isLoading={statsLoading} index={4} />
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">Couldn't load employee records</p>
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
          emptyTitle="No employees yet"
          emptyDescription="Create your first employee record to get started."
          onRowClick={(row) => navigate(`/dashboard/employees/${row.id}`)}
          toolbarAction={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPositionFilter(ALL) }}>
                <SelectTrigger className="w-40">
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
                <SelectTrigger className="w-40">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {(Object.entries(EMPLOYMENT_STATUS_LABEL) as [EmploymentStatus, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Type" />
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
              <div className="flex items-center gap-1.5">
                <Label htmlFor="hired_from" className="sr-only">
                  Hired from
                </Label>
                <Input id="hired_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                <span className="text-sm text-muted-foreground">to</span>
                <Input id="hired_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
              </div>
            </div>
          }
        />
      )}
    </div>
  )
}
