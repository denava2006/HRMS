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
import {
  type SalaryGrade,
  useSalaryGrades,
  useCreateSalaryGrade,
  useUpdateSalaryGrade,
  useDeleteSalaryGrade,
} from '@/hooks/useSalaryGrades'
import { useCurrency } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/lib/currency'

const MAX_SALARY = 100_000_000

// Plain digits with an optional 2-decimal remainder — deliberately excludes "+",
// "-", "e"/"E" (scientific notation), and any other symbol MoneyInput wouldn't
// otherwise produce.
const decimalAmount = /^\d+(\.\d{1,2})?$/

const amountField = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(decimalAmount, 'Numbers only, e.g. 25000 or 25000.50')
    .refine((v) => Number(v) <= MAX_SALARY, `${label} cannot exceed 100,000,000.00`)

const gradeSchema = z
  .object({
    grade_name: z.string().min(1, 'Grade name is required').max(50),
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
  const currency = useCurrency()
  const createGrade = useCreateSalaryGrade()
  const updateGrade = useUpdateSalaryGrade()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues>({ resolver: zodResolver(gradeSchema) })

  React.useEffect(() => {
    if (open) {
      reset({
        grade_name: grade?.grade_name ?? '',
        min_salary: grade ? String(grade.min_salary) : '',
        max_salary: grade ? String(grade.max_salary) : '',
      })
    }
  }, [open, grade, reset])

  const onSubmit = async (values: GradeFormValues) => {
    const payload = {
      grade_name: values.grade_name,
      min_salary: Number(values.min_salary),
      max_salary: Number(values.max_salary),
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
                    currency={currency}
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
                    currency={currency}
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
  const { data, isLoading } = useSalaryGrades()
  const currency = useCurrency()
  const deleteGrade = useDeleteSalaryGrade()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SalaryGrade | null>(null)
  const [deleting, setDeleting] = React.useState<SalaryGrade | null>(null)

  const columns: ColumnDef<SalaryGrade>[] = [
    { accessorKey: 'grade_name', header: 'Grade' },
    {
      accessorKey: 'min_salary',
      header: 'Minimum',
      cell: ({ row }) => <span className="font-mono">{formatMoney(row.original.min_salary, currency)}</span>,
    },
    {
      accessorKey: 'max_salary',
      header: 'Maximum',
      cell: ({ row }) => <span className="font-mono">{formatMoney(row.original.max_salary, currency)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
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
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New grade
          </Button>
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
