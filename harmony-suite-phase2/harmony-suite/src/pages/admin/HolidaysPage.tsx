import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { type Holiday, useHolidays, useCreateHoliday, useUpdateHoliday, useDeleteHoliday } from '@/hooks/useHolidays'
import { HOLIDAY_TYPE_LABEL } from '@/lib/attendanceLabels'

function HolidayFormDialog({
  open,
  onOpenChange,
  holiday,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  holiday?: Holiday | null
}) {
  const isEdit = !!holiday
  const createHoliday = useCreateHoliday()
  const updateHoliday = useUpdateHoliday()

  const [name, setName] = React.useState('')
  const [holidayDate, setHolidayDate] = React.useState('')
  const [holidayType, setHolidayType] = React.useState('regular')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setName(holiday?.name ?? '')
      setHolidayDate(holiday?.holiday_date ?? '')
      setHolidayType(holiday?.holiday_type ?? 'regular')
      setErrors({})
    }
  }, [open, holiday])

  const isPending = createHoliday.isPending || updateHoliday.isPending

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Name is required.'
    if (!holidayDate) nextErrors.holidayDate = 'Date is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const values = { name: name.trim(), holiday_date: holidayDate, holiday_type: holidayType }
    const onSuccess = () => onOpenChange(false)
    if (isEdit) {
      updateHoliday.mutate({ id: holiday.id, values }, { onSuccess })
    } else {
      createHoliday.mutate(values, { onSuccess })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit holiday' : 'New holiday'}</DialogTitle>
          <DialogDescription>Attendance status automatically adjusts to Holiday on this date.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="holiday_name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="holiday_name" invalid={!!errors.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Year's Day" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday_date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input id="holiday_date" type="date" invalid={!!errors.holidayDate} value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
              {errors.holidayDate && <p className="text-xs text-destructive">{errors.holidayDate}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={holidayType} onValueChange={setHolidayType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HOLIDAY_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={isPending} onClick={onSubmit}>
            {isEdit ? 'Save changes' : 'Add holiday'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function HolidaysPage() {
  const { data, isLoading } = useHolidays()
  const deleteHoliday = useDeleteHoliday()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Holiday | null>(null)
  const [deleting, setDeleting] = React.useState<Holiday | null>(null)

  const columns: ColumnDef<Holiday>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'holiday_date',
      header: 'Date',
      cell: ({ row }) => new Date(`${row.original.holiday_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    },
    {
      accessorKey: 'holiday_type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="secondary">{HOLIDAY_TYPE_LABEL[row.original.holiday_type]}</Badge>,
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
        <h2 className="font-display text-xl font-semibold text-foreground">Holiday Calendar</h2>
        <p className="text-sm text-muted-foreground">Regular, special, and company holidays. Attendance status adjusts automatically on these dates.</p>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search holidays..."
        searchColumn="name"
        emptyTitle="No holidays added yet"
        toolbarAction={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New holiday
          </Button>
        }
      />

      <HolidayFormDialog open={formOpen} onOpenChange={setFormOpen} holiday={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await deleteHoliday.mutateAsync(deleting.id)
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
