import * as React from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/useSystemSettings'

const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'company_name', label: 'Company name', placeholder: 'Your Company Name' },
  { key: 'timezone', label: 'Timezone', placeholder: 'Asia/Manila' },
  { key: 'currency', label: 'Currency', placeholder: 'PHP' },
]

export default function SettingsPage() {
  const { data, isLoading } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const [values, setValues] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (data) setValues(data)
  }, [data])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateSettings.mutateAsync(values)
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
          <CardDescription>These values are referenced by reports, payslips, and dashboard formatting.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {FIELDS.map((f) => (
                <Skeleton key={f.key} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              {FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
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
