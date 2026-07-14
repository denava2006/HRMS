export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'hr'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'hr'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      hr_staff: {
        Row: {
          id: string
          user_id: string
          full_name: string
          email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          email: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['hr_staff']['Insert']>
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['departments']['Insert']>
      }
      salary_grades: {
        Row: {
          id: string
          grade_level: string
          base_salary: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          grade_level: string
          base_salary: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['salary_grades']['Insert']>
      }
      positions: {
        Row: {
          id: string
          title: string
          department_id: string
          salary_grade_id: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          department_id: string
          salary_grade_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['positions']['Insert']>
      }
      system_settings: {
        Row: {
          id: string
          key: string
          value: string
          description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          description?: string | null
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
      job_postings: {
        Row: {
          id: string
          title: string
          department_id: string
          position_id: string
          description: string
          requirements: string | null
          is_active: boolean
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          department_id: string
          position_id: string
          description: string
          requirements?: string | null
          is_active?: boolean
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['job_postings']['Insert']>
      }
      applicants: {
        Row: {
          id: string
          job_posting_id: string
          full_name: string
          email: string
          phone: string | null
          address: string | null
          resume_url: string | null
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_posting_id: string
          full_name: string
          email: string
          phone?: string | null
          address?: string | null
          resume_url?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['applicants']['Insert']>
      }
      interviews: {
        Row: {
          id: string
          applicant_id: string
          interview_type: string
          scheduled_at: string | null
          conducted_at: string | null
          interviewer_id: string | null
          result: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          interview_type: string
          scheduled_at?: string | null
          conducted_at?: string | null
          interviewer_id?: string | null
          result?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['interviews']['Insert']>
      }
      job_offers: {
        Row: {
          id: string
          applicant_id: string
          salary: number
          start_date: string
          status: string
          sent_at: string | null
          responded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          salary: number
          start_date: string
          status?: string
          sent_at?: string | null
          responded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['job_offers']['Insert']>
      }
      employment_contracts: {
        Row: {
          id: string
          applicant_id: string
          job_offer_id: string
          contract_url: string | null
          status: string
          prepared_at: string | null
          signed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          job_offer_id: string
          contract_url?: string | null
          status?: string
          prepared_at?: string | null
          signed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['employment_contracts']['Insert']>
      }
      employees: {
        Row: {
          id: string
          employee_id: string
          applicant_id: string | null
          user_id: string | null
          full_name: string
          email: string
          phone: string | null
          department_id: string
          position_id: string
          employment_status: string
          hire_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          applicant_id?: string | null
          user_id?: string | null
          full_name: string
          email: string
          phone?: string | null
          department_id: string
          position_id: string
          employment_status?: string
          hire_date: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      employee_documents: {
        Row: {
          id: string
          employee_id: string
          document_type: string
          file_url: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          document_type: string
          file_url: string
          uploaded_at?: string
        }
        Update: Partial<Database['public']['Tables']['employee_documents']['Insert']>
      }
      attendance: {
        Row: {
          id: string
          employee_id: string
          date: string
          time_in: string | null
          time_out: string | null
          working_hours: number
          late_minutes: number
          undertime_minutes: number
          overtime_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          date: string
          time_in?: string | null
          time_out?: string | null
          working_hours?: number
          late_minutes?: number
          undertime_minutes?: number
          overtime_hours?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }
      leave_requests: {
        Row: {
          id: string
          employee_id: string
          leave_type: string
          start_date: string
          end_date: string
          days_requested: number
          reason: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          leave_type: string
          start_date: string
          end_date: string
          days_requested: number
          reason?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['leave_requests']['Insert']>
      }
      leave_balances: {
        Row: {
          id: string
          employee_id: string
          leave_type: string
          total_credits: number
          used_credits: number
          remaining_credits: number
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          leave_type: string
          total_credits?: number
          used_credits?: number
          remaining_credits?: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['leave_balances']['Insert']>
      }
      payroll_periods: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          status?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['payroll_periods']['Insert']>
      }
      payroll: {
        Row: {
          id: string
          payroll_period_id: string
          employee_id: string
          basic_salary: number
          allowances: number
          gross_salary: number
          deductions: number
          net_salary: number
          status: string
          payslip_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payroll_period_id: string
          employee_id: string
          basic_salary: number
          allowances?: number
          gross_salary: number
          deductions?: number
          net_salary: number
          status?: string
          payslip_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['payroll']['Insert']>
      }
      payroll_items: {
        Row: {
          id: string
          payroll_id: string
          item_type: string
          description: string
          amount: number
        }
        Insert: {
          id?: string
          payroll_id: string
          item_type: string
          description: string
          amount: number
        }
        Update: Partial<Database['public']['Tables']['payroll_items']['Insert']>
      }
      reports: {
        Row: {
          id: string
          report_type: string
          title: string
          filters: Json
          file_url: string | null
          export_format: string
          generated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_type: string
          title: string
          filters?: Json
          file_url?: string | null
          export_format: string
          generated_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['reports']['Insert']>
      }
      database_backups: {
        Row: {
          id: string
          file_url: string | null
          backup_type: string
          status: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          file_url?: string | null
          backup_type: string
          status?: string
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['database_backups']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
