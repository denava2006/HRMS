import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { generateReport } from '@/lib/reportGenerators'
import type { ReportFilters, ReportResult, ReportType } from '@/lib/reportTypes'
import type { ReportFormat } from '@/lib/database.types'

export function useReportDashboardStats() {
  return useQuery({
    queryKey: ['report-dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('generated_reports').select('report_type')
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data ?? []) counts[row.report_type] = (counts[row.report_type] ?? 0) + 1
      const total = data?.length ?? 0
      return {
        total,
        recruitment: counts.recruitment ?? 0,
        employee: counts.employee ?? 0,
        attendance: counts.attendance ?? 0,
        leave: counts.leave ?? 0,
        payroll: counts.payroll ?? 0,
        overall_hr: counts.overall_hr ?? 0,
      }
    },
  })
}

export function useExportHistory() {
  return useQuery({
    queryKey: ['report-export-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: async ({ reportType, filters }: { reportType: ReportType; filters: ReportFilters }) => generateReport(reportType, filters),
  })
}

export function useRecordReportExport() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async ({ result, format }: { result: ReportResult; format: ReportFormat }) => {
      const { data, error } = await supabase
        .from('generated_reports')
        .insert({
          report_type: result.reportType,
          format,
          filters: result.filters as unknown as Record<string, string>,
          generated_by: profile?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Report Exported',
        table_name: 'generated_reports',
        record_id: data.id,
        new_data: { report_type: result.reportType, format, filters: result.filters as unknown as Record<string, string> },
      })

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-export-history'] })
      queryClient.invalidateQueries({ queryKey: ['report-dashboard-stats'] })
    },
  })
}

export function useReportsRealtimeAlerts() {
  const queryClient = useQueryClient()
  React.useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['report-export-history'] })
      queryClient.invalidateQueries({ queryKey: ['report-dashboard-stats'] })
    }
    const channel = supabase
      .channel('generated-reports-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_reports' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
