import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportBarChart, ReportLineChart, ReportPieChart } from '@/components/reports/charts/ReportCharts'
import type { ReportChartSpec } from '@/lib/reportTypes'

export function ReportChartCard({ chart }: { chart: ReportChartSpec }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold text-foreground">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chart.kind === 'bar' && <ReportBarChart data={chart.data} />}
        {chart.kind === 'line' && <ReportLineChart data={chart.data} />}
        {chart.kind === 'pie' && <ReportPieChart data={chart.data} />}
        {chart.kind === 'doughnut' && <ReportPieChart data={chart.data} doughnut />}
      </CardContent>
    </Card>
  )
}
