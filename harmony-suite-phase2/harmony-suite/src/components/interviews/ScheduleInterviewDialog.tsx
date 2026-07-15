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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useHrAccounts } from '@/hooks/useHrAccounts'
import { useScheduleInterview } from '@/hooks/useInterviews'
import type { InterviewType } from '@/lib/database.types'
import { INTERVIEW_TYPE_LABEL } from '@/lib/interviewLabels'

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  stage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  stage: InterviewType
}) {
  const { data: hrAccounts } = useHrAccounts()
  const scheduleInterview = useScheduleInterview()

  const [scheduledAt, setScheduledAt] = React.useState('')
  const [interviewerId, setInterviewerId] = React.useState('')
  const [mode, setMode] = React.useState<'online' | 'face_to_face' | ''>('')
  const [meetingLink, setMeetingLink] = React.useState('')
  const [location, setLocation] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setScheduledAt('')
      setInterviewerId('')
      setMode('')
      setMeetingLink('')
      setLocation('')
      setNotes('')
      setErrors({})
    }
  }, [open])

  const activeInterviewers = hrAccounts?.filter((a) => a.status === 'active') ?? []

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!scheduledAt) nextErrors.scheduledAt = 'Date and time are required.'
    if (!interviewerId) nextErrors.interviewerId = 'Select an interviewer.'
    if (!mode) nextErrors.mode = 'Select an interview type.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    scheduleInterview.mutate(
      {
        applicationId,
        stage,
        scheduledAt: new Date(scheduledAt).toISOString(),
        interviewerId,
        mode: mode as 'online' | 'face_to_face',
        meetingLink: meetingLink.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule {INTERVIEW_TYPE_LABEL[stage]}</DialogTitle>
          <DialogDescription>Set the date, interviewer, and format for this interview.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduled_at">
              Date &amp; time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              invalid={!!errors.scheduledAt}
              value={scheduledAt}
              onChange={(e) => {
                setScheduledAt(e.target.value)
                if (errors.scheduledAt) setErrors((prev) => ({ ...prev, scheduledAt: '' }))
              }}
            />
            {errors.scheduledAt && <p className="text-xs text-destructive">{errors.scheduledAt}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interviewer">
              Interviewer <span className="text-destructive">*</span>
            </Label>
            <Select
              value={interviewerId}
              onValueChange={(v) => {
                setInterviewerId(v)
                if (errors.interviewerId) setErrors((prev) => ({ ...prev, interviewerId: '' }))
              }}
            >
              <SelectTrigger id="interviewer" invalid={!!errors.interviewerId}>
                <SelectValue placeholder="Select interviewer" />
              </SelectTrigger>
              <SelectContent>
                {activeInterviewers.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.interviewerId && <p className="text-xs text-destructive">{errors.interviewerId}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mode">
              Interview Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as 'online' | 'face_to_face')
                if (errors.mode) setErrors((prev) => ({ ...prev, mode: '' }))
              }}
            >
              <SelectTrigger id="mode" invalid={!!errors.mode}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="face_to_face">Face-to-face</SelectItem>
              </SelectContent>
            </Select>
            {errors.mode && <p className="text-xs text-destructive">{errors.mode}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting_link">Meeting Link (optional)</Label>
              <Input
                id="meeting_link"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office / room" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule_notes">Notes</Label>
            <Textarea id="schedule_notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={scheduleInterview.isPending} onClick={onSubmit}>
            Schedule {INTERVIEW_TYPE_LABEL[stage]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
