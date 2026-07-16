import { CheckCircle2, Wrench } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAttendanceRecord, useAttendanceAuditLog } from '@/hooks/useAttendance'
import { ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUS_VARIANT } from '@/lib/attendanceLabels'
import { formatMinutesAsDuration, formatHoursAsDuration } from '@/lib/attendanceCalculations'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

function TimelineStep({ label, timestamp }: { label: string; timestamp: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(timestamp)}</p>
      </div>
    </li>
  )
}

export function AttendanceDetailsSheet({
  recordId,
  open,
  onOpenChange,
}: {
  recordId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: record, isLoading } = useAttendanceRecord(recordId ?? undefined)
  const { data: auditLog } = useAttendanceAuditLog(recordId ?? undefined)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {isLoading || !record ? (
          <SheetBody>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="mt-4 h-64 w-full" />
          </SheetBody>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {record.employees.first_name} {record.employees.last_name}
              </SheetTitle>
              <SheetDescription>{formatDate(record.attendance_date)}</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee Information</h3>
                  <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3">
                    <Field label="Employee ID" value={record.employees.employee_number} />
                    <Field label="Employee Name" value={`${record.employees.first_name} ${record.employees.last_name}`} />
                    <Field label="Department" value={record.employees.departments?.name ?? ''} />
                    <Field label="Position" value={record.employees.positions?.title ?? ''} />
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Information</h3>
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant={ATTENDANCE_STATUS_VARIANT[record.status]}>{ATTENDANCE_STATUS_LABEL[record.status]}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Date" value={formatDate(record.attendance_date)} />
                      <Field label="Working Hours" value={formatHoursAsDuration(Number(record.working_hours))} />
                      <Field label="Time In" value={formatDateTime(record.time_in)} />
                      <Field label="Time Out" value={formatDateTime(record.time_out)} />
                      <Field label="Late" value={formatMinutesAsDuration(record.late_minutes)} />
                      <Field label="Undertime" value={formatMinutesAsDuration(record.undertime_minutes)} />
                      <Field label="Overtime" value={formatMinutesAsDuration(record.overtime_minutes)} />
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Timeline</h3>
                  <ol className="flex flex-col gap-4">
                    {record.time_in && <TimelineStep label="Time In Recorded" timestamp={record.time_in} />}
                    {record.time_out && <TimelineStep label="Working Hours, Late, Undertime & Overtime Calculated" timestamp={record.time_out} />}
                    {record.time_out && <TimelineStep label="Attendance Saved" timestamp={record.time_out} />}
                    {!record.time_in && !record.time_out && <TimelineStep label="Attendance Saved" timestamp={record.created_at} />}
                  </ol>
                </section>

                {auditLog && auditLog.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correction History</h3>
                    <ol className="flex flex-col gap-4">
                      {auditLog.map((entry) => (
                        <li key={entry.id} className="flex gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                            <Wrench className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{entry.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(entry.created_at)}
                              {entry.actor?.full_name ? ` · ${entry.actor.full_name}` : ''}
                            </p>
                            {(entry.new_data as { reason?: string } | null)?.reason && (
                              <p className="mt-1 text-xs text-muted-foreground">Reason: {(entry.new_data as { reason?: string }).reason}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
