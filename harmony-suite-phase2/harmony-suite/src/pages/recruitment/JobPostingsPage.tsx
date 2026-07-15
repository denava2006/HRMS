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
import { Textarea } from '@/components/ui/textarea'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
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
  type JobPosting,
  useJobPostings,
  useCreateJobPosting,
  useUpdateJobPosting,
  useDeleteJobPosting,
} from '@/hooks/useJobPostings'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import type { Enums } from '@/lib/database.types'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'

type JobPostingStatus = Enums<'job_posting_status'>

const STATUS_LABEL: Record<JobPostingStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
}

const STATUS_VARIANT: Record<JobPostingStatus, BadgeProps['variant']> = {
  draft: 'outline',
  open: 'success',
  closed: 'muted',
}

/** Local calendar date (not UTC) in YYYY-MM-DD form, matching what a date input's own picker considers "today". */
function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const jobPostingSchema = z.object({
  department_id: z.string().min(1, 'Select a department'),
  position_id: z.string().min(1, 'Select a position'),
  description: z.string().min(1, 'Description is required').max(5000),
  requirements: z.string().max(5000).optional(),
  employment_type: z.enum(['full_time', 'part_time']),
  vacancies: z
    .string()
    .min(1, 'Vacancies is required')
    .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, 'Must be at least 1'),
  status: z.enum(['draft', 'open', 'closed']),
  closing_date: z
    .string()
    .optional()
    .refine((v) => !v || v >= todayISODate(), 'Closing date cannot be in the past'),
})
type JobPostingFormValues = z.infer<typeof jobPostingSchema>

function JobPostingFormDialog({
  open,
  onOpenChange,
  posting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  posting?: JobPosting | null
}) {
  const isEdit = !!posting
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const createPosting = useCreateJobPosting()
  const updatePosting = useUpdateJobPosting()
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobPostingFormValues>({ resolver: zodResolver(jobPostingSchema) })

  const selectedDepartmentId = watch('department_id')
  const filteredPositions = React.useMemo(
    () => positions?.filter((p) => p.department_id === selectedDepartmentId) ?? [],
    [positions, selectedDepartmentId]
  )

  React.useEffect(() => {
    if (open) {
      reset({
        department_id: posting?.department_id ?? '',
        position_id: posting?.position_id ?? '',
        description: posting?.description ?? '',
        requirements: posting?.requirements ?? '',
        employment_type: posting?.employment_type ?? 'full_time',
        vacancies: posting ? String(posting.vacancies) : '1',
        status: posting?.status ?? 'draft',
        closing_date: posting?.closing_date ?? '',
      })
    }
  }, [open, posting, reset])

  const onSubmit = async (values: JobPostingFormValues) => {
    const payload = {
      department_id: values.department_id,
      position_id: values.position_id,
      description: values.description,
      requirements: values.requirements?.trim() ? values.requirements : null,
      employment_type: values.employment_type,
      vacancies: Number(values.vacancies),
      status: values.status,
      closing_date: values.closing_date ? values.closing_date : null,
    }
    if (isEdit) {
      await updatePosting.mutateAsync({ id: posting.id, values: payload, wasOpen: posting.status === 'open' })
    } else {
      await createPosting.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{isEdit ? 'Edit job posting' : 'New job posting'}</DialogTitle>
          <DialogDescription>Postings marked "Open" are visible to applicants once published.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Department <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="department_id"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        setValue('position_id', '')
                      }}
                    >
                      <SelectTrigger invalid={!!errors.department_id}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.department_id && <p className="text-xs text-destructive">{errors.department_id.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Position <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="position_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!selectedDepartmentId}>
                      <SelectTrigger invalid={!!errors.position_id}>
                        <SelectValue placeholder={selectedDepartmentId ? 'Select' : 'Pick a department first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredPositions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.position_id && <p className="text-xs text-destructive">{errors.position_id.message}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea id="description" invalid={!!errors.description} {...register('description')} rows={3} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea id="requirements" {...register('requirements')} placeholder="Optional" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Employment type</Label>
                <Controller
                  control={control}
                  name="employment_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
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
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vacancies">
                  Vacancies <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vacancies"
                  type="number"
                  min={1}
                  step={1}
                  className="font-mono"
                  invalid={!!errors.vacancies}
                  {...register('vacancies')}
                />
                {errors.vacancies && <p className="text-xs text-destructive">{errors.vacancies.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="closing_date">Closing date</Label>
                <Input
                  id="closing_date"
                  type="date"
                  min={todayISODate()}
                  invalid={!!errors.closing_date}
                  {...register('closing_date')}
                />
                {errors.closing_date && <p className="text-xs text-destructive">{errors.closing_date.message}</p>}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Create posting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function JobPostingsPage() {
  const { data, isLoading, isError, error } = useJobPostings()
  const updatePosting = useUpdateJobPosting()
  const deletePosting = useDeleteJobPosting()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<JobPosting | null>(null)
  const [deleting, setDeleting] = React.useState<JobPosting | null>(null)

  const setStatus = (posting: JobPosting, status: JobPostingStatus) => {
    updatePosting.mutate({
      id: posting.id,
      wasOpen: posting.status === 'open',
      values: {
        department_id: posting.department_id,
        position_id: posting.position_id,
        description: posting.description,
        requirements: posting.requirements,
        employment_type: posting.employment_type,
        vacancies: posting.vacancies,
        status,
        closing_date: posting.closing_date,
      },
    })
  }

  const columns: ColumnDef<JobPosting>[] = [
    {
      id: 'department',
      header: 'Department',
      accessorFn: (row) => row.departments?.name ?? '',
      cell: ({ row }) =>
        row.original.departments?.name ? <Badge variant="secondary">{row.original.departments.name}</Badge> : '—',
    },
    {
      id: 'position',
      header: 'Position Name',
      accessorFn: (row) => row.positions?.title ?? '',
    },
    {
      accessorKey: 'employment_type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{EMPLOYMENT_TYPE_LABEL[row.original.employment_type]}</Badge>,
    },
    {
      accessorKey: 'vacancies',
      header: 'Vacancies',
      cell: ({ row }) => <span className="font-mono">{row.original.vacancies}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>,
    },
    {
      accessorKey: 'closing_date',
      header: 'Closing date',
      cell: ({ row }) =>
        row.original.closing_date ? (
          new Date(row.original.closing_date + 'T00:00:00').toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
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
            {row.original.status === 'draft' && (
              <DropdownMenuItem onClick={() => setStatus(row.original, 'open')}>Publish</DropdownMenuItem>
            )}
            {row.original.status === 'open' && (
              <DropdownMenuItem onClick={() => setStatus(row.original, 'closed')}>Close posting</DropdownMenuItem>
            )}
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
        <h2 className="font-display text-xl font-semibold text-foreground">Job Postings</h2>
        <p className="text-sm text-muted-foreground">Open roles available for applicants to apply to.</p>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">Couldn't load job postings</p>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Please try again.'}</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          searchPlaceholder="Search postings..."
          searchColumn="position"
          emptyTitle="No job postings yet"
          emptyDescription="Create a posting once you have at least one department and position set up."
          toolbarAction={
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New posting
            </Button>
          }
        />
      )}

      <JobPostingFormDialog open={formOpen} onOpenChange={setFormOpen} posting={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.positions?.title ?? 'this posting'}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Postings with applications on file can't be deleted — close them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await deletePosting.mutateAsync(deleting.id)
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
