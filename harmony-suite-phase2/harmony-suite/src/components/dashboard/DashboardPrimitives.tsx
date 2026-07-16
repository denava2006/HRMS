import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function DashboardSectionCard({
  title,
  icon: Icon,
  onClick,
  action,
  children,
  className,
}: {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(onClick && 'cursor-pointer transition-shadow hover:shadow-md', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="h-4 w-4 text-accent" />}
          {title}
        </CardTitle>
        {action ?? (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />)}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function MiniStat({ label, value, isLoading }: { label: string; value: number | string; isLoading?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? <Skeleton className="mt-1 h-6 w-10" /> : <p className="font-display text-lg font-bold text-foreground">{value}</p>}
    </div>
  )
}

export function DashboardEmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>
}

export function DashboardListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
