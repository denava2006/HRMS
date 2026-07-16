import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, FileText, FileSpreadsheet, FileType, Loader2, Sparkles } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ReportChartCard } from '@/components/reports/ReportChartCard'
import { toast } from '@/components/ui/sonner'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import { useLeaveTypes } from '@/hooks/useLeave'
import { useGenerateReport, useRecordReportExport } from '@/hooks/useReports'
import { downloadReportAsDocx, downloadReportAsExcel } from '@/lib/reportExport'
import { APPLICATION_STATUS_LABEL } from '@/lib/applicationStatusLabels'
import { ATTENDANCE_STATUS_LABEL } from '@/lib/attendanceLabels'
import { EMPLOYMENT_STATUS_LABEL } from '@/lib/employeeLabels'
import { LEAVE_STATUS_LABEL } from '@/lib/leaveLabels'
import { PAYROLL_STATUS_LABEL } from '@/lib/payrollLabels'
import {
  ALL_FILTER,
  REPORT_TYPE_DESCRIPTION,
  REPORT_TYPE_LABEL,
  REPORT_TYPES,
  defaultReportFilters,
  type ReportFilters,
  type ReportResult,
  type ReportRow,
  type ReportType,
} from '@/lib/reportTypes'

export default function GenerateReportPage() {
  const navigate = useNavigate()
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const { data: leaveTypes } = useLeaveTypes()

  const [reportType, setReportType] = React.useState<ReportType>('employee')
  const [filters, setFilters] = React.useState<ReportFilters>(defaultReportFilters())
  const [result, setResult] = React.useState<ReportResult | null>(null)

  const generateMutation = useGenerateReport()
  const recordExportMutation = useRecordReportExport()

  const filteredPositions = React.useMemo(
    () => (filters.departmentId === ALL_FILTER ? positions : positions?.filter((p) => p.department_id === filters.departmentId)),
    [positions, filters.departmentId]
  )

  function setFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (filters.dateFrom > filters.dateTo) {
      toast.error('The start date must be before the end date.')
      return
    }
    try {
      const generated = await generateMutation.mutateAsync({ reportType, filters })
      setResult(generated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate report.')
    }
  }

  async function handleExportExcel() {
    if (!result) return
    await downloadReportAsExcel(result)
    await recordExportMutation.mutateAsync({ result, format: 'excel' })
    toast.success('Report exported to Excel.')
  }

  async function handleExportDocx() {
    if (!result) return
    await downloadReportAsDocx(result)
    await recordExportMutation.mutateAsync({ result, format: 'docx' })
    toast.success('Report exported to Word.')
  }

  async function handleExportPdf() {
    if (!result) return
    await recordExportMutation.mutateAsync({ result, format: 'pdf' })
    navigate('/dashboard/reports/print', { state: { result } })
  }

  const columns: ColumnDef<ReportRow>[] = result
    ? result.columns.map((col) => ({
        id: col.key,
        header: col.header,
        accessorKey: col.key,
      }))
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate('/dashboard/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Generate Report</h2>
          <p className="text-sm text-muted-foreground">Select a report type, apply filters, then generate a preview.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Report Type & Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5 lg:col-span-3">
              <Label>Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(v) => {
                  setReportType(v as ReportType)
                  setResult(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {REPORT_TYPE_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{REPORT_TYPE_DESCRIPTION[reportType]}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Date From</Label>
              <Input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date To</Label>
              <Input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
            </div>
            <div />

            <div className="flex flex-col gap-1.5">
              <Label>Department</Label>
              <Select value={filters.departmentId} onValueChange={(v) => { setFilter('departmentId', v); setFilter('positionId', ALL_FILTER) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All departments</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Position</Label>
              <Select value={filters.positionId} onValueChange={(v) => setFilter('positionId', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All positions</SelectItem>
                  {filteredPositions?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reportType === 'recruitment' && (
              <div className="flex flex-col gap-1.5">
                <Label>Application Status</Label>
                <Select value={filters.applicationStatus} onValueChange={(v) => setFilter('applicationStatus', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    {Object.entries(APPLICATION_STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === 'employee' && (
              <div className="flex flex-col gap-1.5">
                <Label>Employment Status</Label>
                <Select value={filters.employmentStatus} onValueChange={(v) => setFilter('employmentStatus', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    {Object.entries(EMPLOYMENT_STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === 'attendance' && (
              <div className="flex flex-col gap-1.5">
                <Label>Attendance Status</Label>
                <Select value={filters.attendanceStatus} onValueChange={(v) => setFilter('attendanceStatus', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    {Object.entries(ATTENDANCE_STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === 'leave' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Leave Type</Label>
                  <Select value={filters.leaveTypeId} onValueChange={(v) => setFilter('leaveTypeId', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>All leave types</SelectItem>
                      {leaveTypes?.map((lt) => (
                        <SelectItem key={lt.id} value={lt.id}>
                          {lt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Leave Status</Label>
                  <Select value={filters.leaveStatus} onValueChange={(v) => setFilter('leaveStatus', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                      {Object.entries(LEAVE_STATUS_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {reportType === 'payroll' && (
              <div className="flex flex-col gap-1.5">
                <Label>Payroll Status</Label>
                <Select value={filters.payrollStatus} onValueChange={(v) => setFilter('payrollStatus', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    {Object.entries(PAYROLL_STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {result.summary.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                ))}
              </div>

              {result.charts.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {result.charts.map((chart) => (
                    <ReportChartCard key={chart.title} chart={chart} />
                  ))}
                </div>
              )}

              <DataTable
                columns={columns}
                data={result.rows}
                density="compact"
                searchPlaceholder="Search results..."
                emptyTitle="No records match these filters"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Export</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExportPdf} disabled={recordExportMutation.isPending}>
                <FileText className="h-4 w-4" />
                Export as PDF
              </Button>
              <Button variant="outline" onClick={handleExportExcel} disabled={recordExportMutation.isPending}>
                <FileSpreadsheet className="h-4 w-4" />
                Export as Excel
              </Button>
              <Button variant="outline" onClick={handleExportDocx} disabled={recordExportMutation.isPending}>
                <FileType className="h-4 w-4" />
                Export as Word
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
