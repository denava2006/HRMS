import * as React from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/useSystemSettings'
import { CURRENCY_LABEL, parseCurrencyCode, type CurrencyCode } from '@/lib/currency'

export default function SettingsPage() {
  const { data, isLoading } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const [companyName, setCompanyName] = React.useState('')
  const [currency, setCurrency] = React.useState<CurrencyCode>('PHP')

  React.useEffect(() => {
    if (data) {
      setCompanyName(data.company_name ?? '')
      setCurrency(parseCurrencyCode(data.currency))
    }
  }, [data])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateSettings.mutateAsync({ company_name: companyName, currency })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">System Settings</h2>
        <p className="text-sm text-muted-foreground">Organization-wide defaults used across Harmony Suite.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            These values are referenced by reports, payslips, and dashboard formatting. The system uses your browser's
            local time automatically — there's no timezone to configure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company_name">Company name</Label>
                <Input
                  id="company_name"
                  placeholder="Your Company Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CURRENCY_LABEL) as [CurrencyCode, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applies to Salary Grades, recommended salaries, and every other monetary value across the system.
                </p>
              </div>
              <Button type="submit" className="mt-2 w-fit" loading={updateSettings.isPending}>
                <Save className="h-4 w-4" />
                Save settings
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
