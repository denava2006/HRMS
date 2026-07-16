import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_CHROME, SEQUENTIAL_BLUE, type ChartDatum } from '@/lib/reportPalette'

const AXIS_STYLE = { fontSize: 12, fill: CHART_CHROME.mutedInk }

function EmptyChartState() {
  return <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No data for the selected filters.</p>
}

export function ReportBarChart({ data }: { data: ChartDatum[] }) {
  if (!data.length) return <EmptyChartState />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke={CHART_CHROME.gridline} />
        <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={{ stroke: CHART_CHROME.axis }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: CHART_CHROME.surface, border: `1px solid ${CHART_CHROME.gridline}`, borderRadius: 8, fontSize: 13 }} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? SEQUENTIAL_BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ReportLineChart({ data }: { data: ChartDatum[] }) {
  if (!data.length) return <EmptyChartState />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke={CHART_CHROME.gridline} />
        <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={{ stroke: CHART_CHROME.axis }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: CHART_CHROME.surface, border: `1px solid ${CHART_CHROME.gridline}`, borderRadius: 8, fontSize: 13 }} />
        <Line type="monotone" dataKey="value" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={{ r: 3, fill: SEQUENTIAL_BLUE }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

const SLICE_LABEL_MIN_PERCENT = 0.05

export function ReportPieChart({ data, doughnut }: { data: ChartDatum[]; doughnut?: boolean }) {
  if (!data.length) return <EmptyChartState />
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={doughnut ? 60 : 0}
          outerRadius={95}
          paddingAngle={2}
          label={({ value }) => (total > 0 && value / total >= SLICE_LABEL_MIN_PERCENT ? `${Math.round((value / total) * 100)}%` : '')}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke={CHART_CHROME.surface} strokeWidth={2} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, color: CHART_CHROME.secondaryInk }} />
        <Tooltip contentStyle={{ background: CHART_CHROME.surface, border: `1px solid ${CHART_CHROME.gridline}`, borderRadius: 8, fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
