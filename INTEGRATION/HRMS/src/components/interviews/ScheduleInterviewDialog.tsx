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
import { useAuth } from '@/contexts/AuthContext'
import { useScheduleInterview } from '@/hooks/useInterviews'
import { useBranches, useWorkLocations } from '@/hooks/useBranches'
import type { InterviewType } from '@/lib/enums'
import { INTERVIEW_TYPE_LABEL } from '@/lib/interviewLabels'
import { isValidMeetingLink } from '@/lib/meetingLink'

/** Local calendar datetime (not UTC) in the format a datetime-local input expects. */
function nowLocalDatetimeValue(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
  const { profile } = useAuth()
  const scheduleInterview = useScheduleInterview()
  const { data: branches } = useBranches()
  const { data: workLocations } = useWorkLocations()

  // "Branch · Location" labels — interviews.location is free text, so the
  // readable label is what gets stored and shown to the applicant.
  const locationOptions = React.useMemo(() => {
    const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]))
    return (workLocations ?? []).map((l) =>
      l.branch_id && branchName.has(l.branch_id) ? `${branchName.get(l.branch_id)} · ${l.name}` : l.name
    )
  }, [branches, workLocations])

  const [scheduledAt, setScheduledAt] = React.useState('')
  const [mode, setMode] = React.useState<'online' | 'face_to_face' | ''>('')
  const [meetingLink, setMeetingLink] = React.useState('')
  const [location, setLocation] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [minDatetime, setMinDatetime] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setScheduledAt('')
      setMode('')
      setMeetingLink('')
      setLocation('')
      setNotes('')
      setErrors({})
      setMinDatetime(nowLocalDatetimeValue())
    }
  }, [open])

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!scheduledAt) {
      nextErrors.scheduledAt = 'Date and time are required.'
    } else if (new Date(scheduledAt) < new Date()) {
      nextErrors.scheduledAt = 'Interview cannot be scheduled in the past.'
    }
    if (!mode) nextErrors.mode = 'Select an interview type.'
    if (mode === 'online') {
      const link = meetingLink.trim()
      if (!link) {
        nextErrors.meetingLink = 'A meeting link is required for online interviews.'
      } else if (!isValidMeetingLink(link)) {
        // "htts:12534gsdg" was previously accepted and sent straight to the
        // applicant, who would only discover it was broken at interview time.
        nextErrors.meetingLink = 'Enter a full meeting link starting with https:// (e.g. https://meet.google.com/abc-defg-hij).'
      }
    }
    if (mode === 'face_to_face' && !location.trim()) {
      nextErrors.location = 'A location is required for face-to-face interviews.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    scheduleInterview.mutate(
      {
        applicationId,
        stage,
        scheduledAt: new Date(scheduledAt).toISOString(),
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
          <DialogDescription>Set the date and format for this interview.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduled_at">
              Date &amp; time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              min={minDatetime}
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
            <Label>Assigned Interviewer</Label>
            <Input value={profile?.full_name ?? ''} disabled />
            <p className="text-xs text-muted-foreground">
              You automatically become the assigned interviewer for this interview.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mode">
              Interview Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as 'online' | 'face_to_face')
                // Clear whichever field no longer applies so a stale value from
                // before switching mode can never be saved as the "current" one.
                setMeetingLink('')
                setLocation('')
                setErrors((prev) => ({ ...prev, mode: '', meetingLink: '', location: '' }))
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

          {mode === 'online' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting_link">
                Meeting Link <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meeting_link"
                invalid={!!errors.meetingLink}
                value={meetingLink}
                onChange={(e) => {
                  setMeetingLink(e.target.value)
                  if (errors.meetingLink) setErrors((prev) => ({ ...prev, meetingLink: '' }))
                }}
                placeholder="https://..."
              />
              {errors.meetingLink && <p className="text-xs text-destructive">{errors.meetingLink}</p>}
            </div>
          )}

          {mode === 'face_to_face' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">
                Location <span className="text-destructive">*</span>
              </Label>
              {/* Picked from the branches and work locations Admin maintains,
                * so an interview venue is always a real place rather than
                * whatever each interviewer happened to type. */}
              <Select
                value={location}
                onValueChange={(v) => {
                  setLocation(v)
                  if (errors.location) setErrors((prev) => ({ ...prev, location: '' }))
                }}
              >
                <SelectTrigger id="location" invalid={!!errors.location}>
                  <SelectValue placeholder={locationOptions.length ? 'Select a location' : 'No work locations configured'} />
                </SelectTrigger>
                <SelectContent>
                  {locationOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>
          )}

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
