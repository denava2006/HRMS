import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  POS_REPORT_PRESET_KEYS,
  POS_REPORT_PRESET_LABEL,
  formatPosReportPeriod,
  isPosReportPresetKey,
  rangeFromPreset,
  validatePosReportRange,
  type PosReportPreset,
  type PosReportRange,
} from '@/lib/posReports'

export function PosReportRange({
  presets,
  value,
  onChange,
  isLoading = false,
  // What the range is showing. The picker is shared with the audit log, where
  // "completed sales" would be plainly wrong.
  summaryNoun = 'completed sales',
}: {
  presets: PosReportPreset[]
  value: PosReportRange | undefined
  onChange: (range: PosReportRange) => void
  isLoading?: boolean
  summaryNoun?: string
}) {
  const [draft, setDraft] = React.useState<PosReportRange | undefined>(value)

  React.useEffect(() => setDraft(value), [value])

  const rangeError = draft ? validatePosReportRange(draft) : null
  const presetMap = new Map(
    presets
      .filter((preset) => isPosReportPresetKey(preset.preset))
      .map((preset) => [preset.preset, preset] as const)
  )

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex flex-wrap items-center gap-2" aria-label="Report date presets">
          {isLoading
            ? [0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-9 w-24" />)
            : POS_REPORT_PRESET_KEYS.map((key) => {
                const preset = presetMap.get(key)
                return (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={value?.kind === key ? 'default' : 'outline'}
                    disabled={!preset}
                    aria-pressed={value?.kind === key}
                    onClick={() => {
                      if (!preset) return
                      const next = rangeFromPreset(preset)
                      if (next) {
                        setDraft(next)
                        onChange(next)
                      }
                    }}
                  >
                    {POS_REPORT_PRESET_LABEL[key]}
                  </Button>
                )
              })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-52 flex-1 flex-col gap-1.5">
            <Label htmlFor="pos-report-from">From</Label>
            <Input
              id="pos-report-from"
              type="date"
              value={draft?.dateFrom ?? ''}
              onChange={(event) =>
                setDraft({
                  dateFrom: event.target.value,
                  dateTo: draft?.dateTo ?? '',
                  kind: 'custom',
                })
              }
            />
          </div>
          <div className="flex min-w-52 flex-1 flex-col gap-1.5">
            <Label htmlFor="pos-report-to">To</Label>
            <Input
              id="pos-report-to"
              type="date"
              value={draft?.dateTo ?? ''}
              onChange={(event) =>
                setDraft({
                  dateFrom: draft?.dateFrom ?? '',
                  dateTo: event.target.value,
                  kind: 'custom',
                })
              }
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!draft || !!rangeError || draft.kind !== 'custom'}
            onClick={() => draft && onChange(draft)}
          >
            Apply custom range
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Maximum 366 days. Business dates use Asia/Manila.
        </p>

        {draft && rangeError ? (
          <p role="alert" className="text-sm text-destructive">
            {rangeError}
          </p>
        ) : value ? (
          <p className="text-xs text-muted-foreground">
            Showing {summaryNoun} for {formatPosReportPeriod(value)}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
