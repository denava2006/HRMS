import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { MoneyInput } from '@/components/MoneyInput'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import { useSalaryGrades } from '@/hooks/useSalaryGrades'
import { useUpdateEmployee, type Employee } from '@/hooks/useEmployees'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'
import { CURRENCY_LABEL, type CurrencyCode } from '@/lib/currency'
import { EMPLOYMENT_STATUS_LABEL } from '@/lib/employeeLabels'
import type { EmploymentStatus } from '@/lib/database.types'

export function EditEmploymentInfoDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
}) {
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const { data: salaryGrades } = useSalaryGrades()
  const updateEmployee = useUpdateEmployee()

  const [departmentId, setDepartmentId] = React.useState('')
  const [positionId, setPositionId] = React.useState('')
  const [employmentType, setEmploymentType] = React.useState<'full_time' | 'part_time'>('full_time')
  const [employmentStatus, setEmploymentStatus] = React.useState<EmploymentStatus>('active')
  const [salaryGradeId, setSalaryGradeId] = React.useState('')
  const [basicSalary, setBasicSalary] = React.useState('')
  const [currency, setCurrency] = React.useState<CurrencyCode>('PHP')
  const [hireDate, setHireDate] = React.useState('')
  const [probationPeriod, setProbationPeriod] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setDepartmentId(employee.department_id ?? '')
      setPositionId(employee.position_id ?? '')
      setEmploymentType(employee.employment_type)
      setEmploymentStatus(employee.employment_status)
      setSalaryGradeId(employee.salary_grade_id ?? '')
      setBasicSalary(String(employee.basic_salary))
      setCurrency((employee.currency as CurrencyCode) ?? 'PHP')
      setHireDate(employee.hire_date)
      setProbationPeriod(employee.probation_period ?? '')
      setErrors({})
    }
  }, [open, employee])

  const filteredPositions = React.useMemo(
    () => positions?.filter((p) => p.department_id === departmentId),
    [positions, departmentId]
  )

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!departmentId) nextErrors.departmentId = 'Department is required.'
    if (!positionId) nextErrors.positionId = 'Position is required.'
    if (!basicSalary || Number(basicSalary) <= 0) nextErrors.basicSalary = 'Basic salary is required.'
    if (!hireDate) nextErrors.hireDate = 'Date hired is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    updateEmployee.mutate(
      {
        id: employee.id,
        values: {
          department_id: departmentId,
          position_id: positionId,
          employment_type: employmentType,
          employment_status: employmentStatus,
          salary_grade_id: salaryGradeId || null,
          basic_salary: Number(basicSalary),
          currency,
          hire_date: hireDate,
          probation_period: probationPeriod.trim() || null,
        },
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employment Information</DialogTitle>
          <DialogDescription>Changes are reflected immediately on the employee profile.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Department</Label>
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v)
                  setPositionId('')
                }}
              >
                <SelectTrigger invalid={!!errors.departmentId}>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && <p className="text-xs text-destructive">{errors.departmentId}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Position</Label>
              <Select value={positionId} onValueChange={setPositionId} disabled={!departmentId}>
                <SelectTrigger invalid={!!errors.positionId}>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPositions?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.positionId && <p className="text-xs text-destructive">{errors.positionId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Employment Type</Label>
              <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as 'full_time' | 'part_time')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Employment Status</Label>
              <Select value={employmentStatus} onValueChange={(v) => setEmploymentStatus(v as EmploymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(EMPLOYMENT_STATUS_LABEL) as [EmploymentStatus, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Salary Grade (optional)</Label>
              <Select value={salaryGradeId} onValueChange={setSalaryGradeId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {salaryGrades?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.grade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_hire_date">Date Hired</Label>
              <Input id="edit_hire_date" type="date" invalid={!!errors.hireDate} value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              {errors.hireDate && <p className="text-xs text-destructive">{errors.hireDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_basic_salary">Basic Salary</Label>
              <MoneyInput id="edit_basic_salary" currency={currency} invalid={!!errors.basicSalary} value={basicSalary} onValueChange={setBasicSalary} />
              {errors.basicSalary && <p className="text-xs text-destructive">{errors.basicSalary}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CURRENCY_LABEL) as [CurrencyCode, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_probation">Probation Period</Label>
              <Input id="edit_probation" autoComplete="off" placeholder="e.g. 6 months" value={probationPeriod} onChange={(e) => setProbationPeriod(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={updateEmployee.isPending} onClick={onSubmit}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
