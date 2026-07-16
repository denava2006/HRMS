import * as React from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

function useLiveClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return now
}

export function WelcomeSection({ name, subtitle }: { name: string; subtitle: string }) {
  const now = useLiveClock()
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Welcome back, {name}.</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2.5 text-accent">
          <Clock className="h-4 w-4" />
          <div className="leading-tight">
            <p className="font-mono text-sm font-semibold">
              {now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs">{now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
