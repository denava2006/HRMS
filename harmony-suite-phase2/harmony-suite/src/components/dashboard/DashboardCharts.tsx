import { ReportBarChart, ReportLineChart, ReportPieChart } from '@/components/reports/charts/ReportCharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useAttendanceTrendChart,
  useHiringTrendChart,
  useLeaveDistributionChart,
  useRecruitmentStatusChart,
} from '@/hooks/useDashboard'
import { assignCategoricalColors, SEQUENTIAL_BLUE } from '@/lib/reportPalette'
import { Skeleton } from '@/components/ui/skeleton'

function ChartCard({ title, isLoading, children }: { title: string; isLoading: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{isLoading ? <Skeleton className="h-64 w-full" /> : children}</CardContent>
    </Card>
  )
}

export function DashboardCharts() {
  const recruitment = useRecruitmentStatusChart()
  const attendance = useAttendanceTrendChart()
  const hiring = useHiringTrendChart()
  const leave = useLeaveDistributionChart()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Recruitment Status" isLoading={recruitment.isLoading}>
        <ReportPieChart data={assignCategoricalColors(recruitment.data ?? [])} doughnut />
      </ChartCard>
      <ChartCard title="Attendance Trend (Past Week)" isLoading={attendance.isLoading}>
        <ReportBarChart data={(attendance.data ?? []).map((d) => ({ ...d, color: SEQUENTIAL_BLUE }))} />
      </ChartCard>
      <ChartCard title="Hiring Trend" isLoading={hiring.isLoading}>
        <ReportLineChart data={(hiring.data ?? []).map((d) => ({ ...d, color: SEQUENTIAL_BLUE }))} />
      </ChartCard>
      <ChartCard title="Leave Distribution" isLoading={leave.isLoading}>
        <ReportPieChart data={assignCategoricalColors(leave.data ?? [])} />
      </ChartCard>
    </div>
  )
}
