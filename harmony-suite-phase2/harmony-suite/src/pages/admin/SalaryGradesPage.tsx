import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const MAX_SALARY = 100_000_000

// Plain digits with an optional 2-decimal remainder (while the field is focused
// and being typed into) or Philippine-style comma-grouped thousands (what it's
// reformatted to on blur) — deliberately excludes "+", "-", "e"/"E" (scientific
// notation) and any other symbol a number input would otherwise accept.
const decimalAmount = /^\d+(\.\d{1,2})?$|^\d{1,3}(,\d{3})*(\.\d{1,2})?$/

const amountField = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(decimalAmount, 'Numbers only, e.g. 25,000 or 25,000.50')
    .transform((v) => v.replace(/,/g, ''))
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

/** Strips everything but digits and a single decimal point, capped at 2 decimal places, as the user types. */
function sanitizeAmountInput(raw: string): string {
  const digitsAndDot = raw.replace(/[^0-9.]/g, '')
  const firstDot = digitsAndDot.indexOf('.')
  if (firstDot === -1) return digitsAndDot
  const wholePart = digitsAndDot.slice(0, firstDot)
  const fractionPart = digitsAndDot.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  return `${wholePart}.${fractionPart}`
}

/** Philippine-style thousands grouping, applied once focus leaves the field — e.g. "100000" -> "100,000". */
function formatAmountDisplay(raw: string): string {
  if (!raw) return raw
  const [wholePart, fractionPart] = raw.split('.')
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fractionPart !== undefined ? `${grouped}.${fractionPart}` : grouped
}

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues>({ resolver: zodResolver(gradeSchema) })
  const minSalaryField = register('min_salary')
  const maxSalaryField = register('max_salary')

  React.useEffect(() => {
    if (open) {
      reset({
        grade_name: grade?.grade_name ?? '',
        min_salary: grade ? formatAmountDisplay(String(grade.min_salary)) : '',
        max_salary: grade ? formatAmountDisplay(String(grade.max_salary)) : '',
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
                Minimum (\u20b1) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="min_salary"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="font-mono"
                invalid={!!errors.min_salary}
                {...minSalaryField}
                onChange={(e) => {
                  e.target.value = sanitizeAmountInput(e.target.value)
                  minSalaryField.onChange(e)
                }}
                onFocus={(e) => {
                  e.target.value = e.target.value.replace(/,/g, '')
                }}
                onBlur={(e) => {
                  e.target.value = formatAmountDisplay(e.target.value)
                  minSalaryField.onBlur(e)
                }}
              />
              {errors.min_salary && <p className="text-xs text-destructive">{errors.min_salary.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max_salary">
                Maximum (\u20b1) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="max_salary"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="font-mono"
                invalid={!!errors.max_salary}
                {...maxSalaryField}
                onChange={(e) => {
                  e.target.value = sanitizeAmountInput(e.target.value)
                  maxSalaryField.onChange(e)
                }}
                onFocus={(e) => {
                  e.target.value = e.target.value.replace(/,/g, '')
                }}
                onBlur={(e) => {
                  e.target.value = formatAmountDisplay(e.target.value)
                  maxSalaryField.onBlur(e)
                }}
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
  const deleteGrade = useDeleteSalaryGrade()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SalaryGrade | null>(null)
  const [deleting, setDeleting] = React.useState<SalaryGrade | null>(null)

  const columns: ColumnDef<SalaryGrade>[] = [
    { accessorKey: 'grade_name', header: 'Grade' },
    {
      accessorKey: 'min_salary',
      header: 'Minimum',
      cell: ({ row }) => <span className="font-mono">{peso.format(row.original.min_salary)}</span>,
    },
    {
      accessorKey: 'max_salary',
      header: 'Maximum',
      cell: ({ row }) => <span className="font-mono">{peso.format(row.original.max_salary)}</span>,
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
