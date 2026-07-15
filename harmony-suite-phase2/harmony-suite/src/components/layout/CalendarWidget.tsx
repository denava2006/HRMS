import * as React from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useUpcomingEvents } from '@/hooks/useUpcomingEvents'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** A grid of weeks for the given month, padded with nulls so every week has 7 slots. */
function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array.from({ length: firstDay.getDay() }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(new Date(year, month, day))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

/** Global calendar widget (Part 7) — today, current month, and every module's
 * upcoming dated items (currently just Interview Management; Deployment,
 * Leave, and Payroll can extend useUpcomingEvents and this will pick them up
 * automatically since it only ever renders generic CalendarEvent entries). */
export function CalendarWidget() {
  const today = new Date()
  const [viewDate, setViewDate] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const { data: events } = useUpcomingEvents()

  const eventDates = React.useMemo(() => (events ?? []).map((e) => new Date(e.date)), [events])
  const hasEvent = (d: Date) => eventDates.some((ed) => isSameDay(ed, d))

  const weeks = getMonthMatrix(viewDate.getFullYear(), viewDate.getMonth())
  const monthLabel = viewDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">{today.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-foreground">{monthLabel}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1 flex flex-col gap-1">
          {weeks.map((week, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {week.map((d, j) => (
                <div key={j} className="flex flex-col items-center">
                  {d ? (
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                        isSameDay(d, today) ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground'
                      )}
                    >
                      {d.getDate()}
                    </div>
                  ) : (
                    <div className="h-7 w-7" />
                  )}
                  {d && hasEvent(d) && <span className="-mt-1 h-1 w-1 rounded-full bg-accent" />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {events && events.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</p>
            <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
              {events.slice(0, 6).map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">{e.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(e.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
