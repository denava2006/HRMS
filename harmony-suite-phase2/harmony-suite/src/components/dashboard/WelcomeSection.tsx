import { Card, CardContent } from '@/components/ui/card'

/** The live clock that used to sit on the right of this card was a second copy
 * of the one in the top bar, ticking beside it. Only the greeting remains. */
export function WelcomeSection({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="font-display text-xl font-semibold text-foreground">Welcome back, {name}.</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
