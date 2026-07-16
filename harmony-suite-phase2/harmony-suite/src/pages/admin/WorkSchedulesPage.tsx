import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { cn } from '@/lib/utils'
import {
  type WorkSchedule,
  useWorkSchedules,
  useCreateWorkSchedule,
  useUpdateWorkSchedule,
  useDeleteWorkSchedule,
} from '@/hooks/useWorkSchedules'
import { formatWorkingDays, formatScheduleTime } from '@/lib/attendanceCalculations'

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function ScheduleFormDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: WorkSchedule | null
}) {
  const isEdit = !!schedule
  const createSchedule = useCreateWorkSchedule()
  const updateSchedule = useUpdateWorkSchedule()

  const [name, setName] = React.useState('')
  const [workingDays, setWorkingDays] = React.useState<number[]>([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = React.useState('08:00')
  const [endTime, setEndTime] = React.useState('17:00')
  const [breakMinutes, setBreakMinutes] = React.useState('60')
  const [isDefault, setIsDefault] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setName(schedule?.name ?? '')
      setWorkingDays(schedule?.working_days ?? [1, 2, 3, 4, 5])
      setStartTime(schedule?.start_time?.slice(0, 5) ?? '08:00')
      setEndTime(schedule?.end_time?.slice(0, 5) ?? '17:00')
      setBreakMinutes(String(schedule?.break_minutes ?? 60))
      setIsDefault(schedule?.is_default ?? false)
      setErrors({})
    }
  }, [open, schedule])

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  const isPending = createSchedule.isPending || updateSchedule.isPending

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Name is required.'
    if (workingDays.length === 0) nextErrors.workingDays = 'Select at least one working day.'
    if (!startTime) nextErrors.startTime = 'Start time is required.'
    if (!endTime) nextErrors.endTime = 'End time is required.'
    if (startTime && endTime && startTime >= endTime) nextErrors.endTime = 'End time must be after start time.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const values = {
      name: name.trim(),
      working_days: workingDays,
      start_time: startTime,
      end_time: endTime,
      break_minutes: Number(breakMinutes) || 0,
      is_default: isDefault,
    }

    const onSuccess = () => onOpenChange(false)
    if (isEdit) {
      updateSchedule.mutate({ id: schedule.id, values }, { onSuccess })
    } else {
      createSchedule.mutate(values, { onSuccess })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit work schedule' : 'New work schedule'}</DialogTitle>
          <DialogDescription>Late, undertime, and overtime calculations use whichever schedule an employee is assigned.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule_name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="schedule_name" invalid={!!errors.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Day Shift" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Working Days <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'flex h-9 w-12 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                    workingDays.includes(d.value)
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-input bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {errors.workingDays && <p className="text-xs text-destructive">{errors.workingDays}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_time">Start Time</Label>
              <Input id="start_time" type="time" invalid={!!errors.startTime} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_time">End Time</Label>
              <Input id="end_time" type="time" invalid={!!errors.endTime} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="break_minutes">Break (minutes)</Label>
              <Input id="break_minutes" type="number" min="0" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Default schedule</span>
              <span className="text-xs text-muted-foreground">Used for employees with no schedule assigned.</span>
            </span>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={isPending} onClick={onSubmit}>
            {isEdit ? 'Save changes' : 'Create schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function WorkSchedulesPage() {
  const { data, isLoading } = useWorkSchedules()
  const deleteSchedule = useDeleteWorkSchedule()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<WorkSchedule | null>(null)
  const [deleting, setDeleting] = React.useState<WorkSchedule | null>(null)

  const columns: ColumnDef<WorkSchedule>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.original.name}</span>
          {row.original.is_default && <Badge variant="secondary">Default</Badge>}
        </div>
      ),
    },
    {
      id: 'working_days',
      header: 'Working Days',
      cell: ({ row }) => formatWorkingDays(row.original.working_days),
    },
    {
      id: 'hours',
      header: 'Hours',
      cell: ({ row }) => `${formatScheduleTime(row.original.start_time)} – ${formatScheduleTime(row.original.end_time)}`,
    },
    {
      accessorKey: 'break_minutes',
      header: 'Break',
      cell: ({ row }) => `${row.original.break_minutes} min`,
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
        <h2 className="font-display text-xl font-semibold text-foreground">Work Schedules</h2>
        <p className="text-sm text-muted-foreground">Working days, hours, and break time used to calculate late, undertime, and overtime.</p>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search schedules..."
        searchColumn="name"
        emptyTitle="No work schedules yet"
        toolbarAction={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New schedule
          </Button>
        }
      />

      <ScheduleFormDialog open={formOpen} onOpenChange={setFormOpen} schedule={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. Schedules still assigned to employees can't be deleted until reassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await deleteSchedule.mutateAsync(deleting.id)
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
