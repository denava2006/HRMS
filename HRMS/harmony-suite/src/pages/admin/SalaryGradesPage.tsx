import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/MoneyInput'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { canApproveWork } from '@/lib/roles'
import {
  type SalaryGrade,
  useSalaryGrades,
  useCreateSalaryGrade,
  useUpdateSalaryGrade,
  useDeleteSalaryGrade,
} from '@/hooks/useSalaryGrades'
import { formatMoney } from '@/lib/currency'
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_TYPE_SHORT_LABEL,
  EMPLOYMENT_TYPE_VARIANT,
} from '@/lib/jobPostingLabels'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const MAX_SALARY = 999_999_999_999
const MAX_SALARY_TEXT = '999,999,999,999.00'

// Plain digits with an optional 2-decimal remainder — deliberately excludes "+",
// "-", "e"/"E" (scientific notation), and any other symbol MoneyInput wouldn't
// otherwise produce.
const decimalAmount = /^\d+(\.\d{1,2})?$/

const amountField = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(decimalAmount, 'Numbers only, e.g. 25000 or 25000.50')
    .refine((v) => Number(v) <= MAX_SALARY, `${label} cannot exceed ${MAX_SALARY_TEXT}`)

const gradeSchema = z
  .object({
    grade_name: z.string().min(1, 'Grade name is required').max(50),
    employment_type: z.enum(['regular', 'part_time']),
    min_salary: amountField('Minimum salary').refine((v) => Number(v) > 0, 'Minimum salary must be greater than zero'),
    max_salary: amountField('Maximum salary'),
  })
  .refine((v) => Number(v.min_salary) <= Number(v.max_salary), {
    message: 'Minimum salary cannot exceed the maximum salary',
    path: ['min_salary'],
  })
  .refine((v) => Number(v.max_salary) >= Number(v.min_salary), {
    message: 'Maximum salary cannot be lower than the minimum salary',
    path: ['max_salary'],
  })
type GradeFormValues = z.infer<typeof gradeSchema>

function GradeFormDialog({
  open,
  onOpenChange,
  grade,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  grade?: SalaryGrade | null
}) {
  const isEdit = !!grade
  const createGrade = useCreateSalaryGrade()
  const updateGrade = useUpdateSalaryGrade()
  const { data: allGrades } = useSalaryGrades()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues>({ resolver: zodResolver(gradeSchema) })

  React.useEffect(() => {
    if (open) {
      reset({
        grade_name: grade?.grade_name ?? '',
        employment_type: grade?.employment_type ?? 'regular',
        min_salary: grade ? String(grade.min_salary) : '',
        max_salary: grade ? String(grade.max_salary) : '',
      })
    }
  }, [open, grade, reset])

  const onSubmit = async (values: GradeFormValues) => {
    const payload = {
      grade_name: values.grade_name,
      employment_type: values.employment_type,
      min_salary: Number(values.min_salary),
      max_salary: Number(values.max_salary),
    }

    // A grade ladder has to partition salaries, not double-claim them: if two
    // bands both cover ₱27,000, the range check the job offer form runs is
    // answering a question with two right answers. The database enforces this
    // too (salary_grades_no_overlap) — checking here names the grade that
    // clashes instead of surfacing a constraint violation.
    // Scoped to the same employment type: a part-time band and a regular band
    // may cover identical amounts, because they're never offered to the same
    // person. The database's exclusion constraint is scoped the same way.
    const clash = (allGrades ?? []).find(
      (g) =>
        g.id !== grade?.id &&
        g.employment_type === payload.employment_type &&
        payload.min_salary <= g.max_salary &&
        payload.max_salary >= g.min_salary
    )
    if (clash) {
      setError('min_salary', {
        message: `This range overlaps ${clash.grade_name}, another ${EMPLOYMENT_TYPE_SHORT_LABEL[payload.employment_type]} grade (${formatMoney(clash.min_salary)} – ${formatMoney(clash.max_salary)}).`,
      })
      return
    }

    if (isEdit) {
      await updateGrade.mutateAsync({ id: grade.id, values: payload })
    } else {
      await createGrade.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit salary grade' : 'New salary grade'}</DialogTitle>
          <DialogDescription>Defines the pay range an employee's basic salary must fall within.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grade_name">
              Grade name <span className="text-destructive">*</span>
            </Label>
            <Input id="grade_name" invalid={!!errors.grade_name} {...register('grade_name')} placeholder="e.g. Grade 5" />
            {errors.grade_name && <p className="text-xs text-destructive">{errors.grade_name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grade_employment_type">
              Employment Type <span className="text-destructive">*</span>
            </Label>
            {/* Decides who this band can be assigned to. Two bands of different
              * types may cover the same amounts; two of the same type may not. */}
            <Controller
              control={control}
              name="employment_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="grade_employment_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {EMPLOYMENT_TYPE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min_salary">
                Minimum <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="min_salary"
                render={({ field }) => (
                  <MoneyInput
                    id="min_salary"
                    invalid={!!errors.min_salary}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.min_salary && <p className="text-xs text-destructive">{errors.min_salary.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max_salary">
                Maximum <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="max_salary"
                render={({ field }) => (
                  <MoneyInput
                    id="max_salary"
                    invalid={!!errors.max_salary}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.max_salary && <p className="text-xs text-destructive">{errors.max_salary.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Create grade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function SalaryGradesPage() {
  const { profile } = useAuth()
  const canManage = canApproveWork(profile?.role)
  const { data, isLoading } = useSalaryGrades()
  const deleteGrade = useDeleteSalaryGrade()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SalaryGrade | null>(null)
  const [deleting, setDeleting] = React.useState<SalaryGrade | null>(null)

  const columns: ColumnDef<SalaryGrade>[] = [
    { accessorKey: 'grade_name', header: 'Grade' },
    {
      id: 'employment_type',
      header: 'Employment Type',
      cell: ({ row }) => (
        <Badge variant={EMPLOYMENT_TYPE_VARIANT[row.original.employment_type]}>
          {EMPLOYMENT_TYPE_SHORT_LABEL[row.original.employment_type]}
        </Badge>
      ),
    },
    {
      accessorKey: 'min_salary',
      header: 'Minimum',
      cell: ({ row }) => <span className="font-mono">{formatMoney(row.original.min_salary)}</span>,
    },
    {
      accessorKey: 'max_salary',
      header: 'Maximum',
      cell: ({ row }) => <span className="font-mono">{formatMoney(row.original.max_salary)}</span>,
    },
    {
      id: 'actions',
      header: '',
      // Salary grades are HR Manager territory — HR Staff has read-only access,
      // matching the salary_grades_manager_manage policy in the database.
      cell: ({ row }) =>
        !canManage ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original)
                setFormOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem destructive onClick={() => setDeleting(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Salary Grades</h2>
        <p className="text-sm text-muted-foreground">Pay ranges assigned to positions and employees.</p>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search grades..."
        searchColumn="grade_name"
        emptyTitle="No salary grades yet"
        toolbarAction={
          !canManage ? (
            <Badge variant="muted">View only — salary grades are managed by HR Managers</Badge>
          ) : (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New grade
          </Button>
          )
        }
      />

      <GradeFormDialog open={formOpen} onOpenChange={setFormOpen} grade={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.grade_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Grades assigned to employees can't be deleted until those are reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await deleteGrade.mutateAsync(deleting.id)
                setDeleting(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
