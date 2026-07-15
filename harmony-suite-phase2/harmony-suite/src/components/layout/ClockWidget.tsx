import * as React from 'react'

/** Global live clock (Part 8) — current time, date, and day of week, all from
 * the browser's local time, ticking every second with no manual refresh. */
export function ClockWidget() {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="hidden flex-col items-end leading-tight md:flex">
      <span className="font-mono text-sm font-medium text-foreground">{time}</span>
      <span className="text-xs text-muted-foreground">{date}</span>
    </div>
  )
}
