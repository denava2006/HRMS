// Auto-generated from the live Supabase schema via the Supabase MCP
// `generate_typescript_types` tool. Regenerate after every future migration:
//   supabase gen types typescript --project-id tmvdiqeluqyretmemwsr > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applicants: {
        Row: {
          address: string | null
          cover_letter: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          resume_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cover_letter?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cover_letter?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          job_posting_id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          job_posting_id: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          job_posting_id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          employee_id: string
          id: string
          late_minutes: number
          overtime_minutes: number
          status: Database["public"]["Enums"]["attendance_status"]
          time_in: string | null
          time_out: string | null
          undertime_minutes: number
          updated_at: string
          working_hours: number
        }
        Insert: {
          attendance_date: string
          created_at?: string
          employee_id: string
          id?: string
          late_minutes?: number
          overtime_minutes?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          time_in?: string | null
          time_out?: string | null
          undertime_minutes?: number
          updated_at?: string
          working_hours?: number
        }
        Update: {
          attendance_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          late_minutes?: number
          overtime_minutes?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          time_in?: string | null
          time_out?: string | null
          undertime_minutes?: number
          updated_at?: string
          working_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          document_type: string
          employee_id: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          document_type: string
          employee_id: string
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          document_type?: string
          employee_id?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          application_id: string | null
          basic_salary: number
          birth_date: string | null
          created_at: string
          department_id: string | null
          email: string
          employee_number: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          gender: string | null
          hire_date: string
          id: string
          last_name: string
          phone: string | null
          photo_url: string | null
          position_id: string | null
          salary_grade_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          application_id?: string | null
          basic_salary?: number
          birth_date?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employee_number?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          gender?: string | null
          hire_date?: string
          id?: string
          last_name: string
          phone?: string | null
          photo_url?: string | null
          position_id?: string | null
          salary_grade_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          application_id?: string | null
          basic_salary?: number
          birth_date?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employee_number?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          gender?: string | null
          hire_date?: string
          id?: string
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          position_id?: string | null
          salary_grade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_salary_grade_id_fkey"
            columns: ["salary_grade_id"]
            isOneToOne: false
            referencedRelation: "salary_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          contract_file_url: string | null
          created_at: string
          id: string
          job_offer_id: string
          signed_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          contract_file_url?: string | null
          created_at?: string
          id?: string
          job_offer_id: string
          signed_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          contract_file_url?: string | null
          created_at?: string
          id?: string
          job_offer_id?: string
          signed_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          created_at: string
          file_url: string | null
          filters: Json | null
          format: Database["public"]["Enums"]["report_format"]
          generated_by: string | null
          id: string
          report_type: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          filters?: Json | null
          format: Database["public"]["Enums"]["report_format"]
          generated_by?: string | null
          id?: string
          report_type: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          filters?: Json | null
          format?: Database["public"]["Enums"]["report_format"]
          generated_by?: string | null
          id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          application_id: string
          created_at: string
          id: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          interviewer_id: string | null
          location: string | null
          mode: string | null
          remarks: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          interviewer_id?: string | null
          location?: string | null
          mode?: string | null
          remarks?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          interview_type?: Database["public"]["Enums"]["interview_type"]
          interviewer_id?: string | null
          location?: string | null
          mode?: string | null
          remarks?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          application_id: string
          created_at: string
          id: string
          offer_date: string
          proposed_salary: number
          responded_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          offer_date?: string
          proposed_salary: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          offer_date?: string
          proposed_salary?: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          closing_date: string | null
          created_at: string
          date_posted: string | null
          department_id: string
          description: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          position_id: string
          posted_by: string | null
          requirements: string | null
          status: Database["public"]["Enums"]["job_posting_status"]
          title: string
          updated_at: string
          vacancies: number
        }
        Insert: {
          closing_date?: string | null
          created_at?: string
          date_posted?: string | null
          department_id: string
          description: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          position_id: string
          posted_by?: string | null
          requirements?: string | null
          status?: Database["public"]["Enums"]["job_posting_status"]
          title: string
          updated_at?: string
          vacancies?: number
        }
        Update: {
          closing_date?: string | null
          created_at?: string
          date_posted?: string | null
          department_id?: string
          description?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          position_id?: string
          posted_by?: string | null
          requirements?: string | null
          status?: Database["public"]["Enums"]["job_posting_status"]
          title?: string
          updated_at?: string
          vacancies?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          employee_id: string
          id: string
          leave_type_id: string
          remaining_credits: number | null
          total_credits: number
          updated_at: string
          used_credits: number
          year: number
        }
        Insert: {
          employee_id: string
          id?: string
          leave_type_id: string
          remaining_credits?: number | null
          total_credits?: number
          updated_at?: string
          used_credits?: number
          year: number
        }
        Update: {
          employee_id?: string
          id?: string
          leave_type_id?: string
          remaining_credits?: number | null
          total_credits?: number
          updated_at?: string
          used_credits?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string
          default_credits: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_credits?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_credits?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      payroll_line_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          item_type: string
          label: string
          payroll_record_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          item_type: string
          label: string
          payroll_record_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          item_type?: string
          label?: string
          payroll_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_line_items_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pay_date: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payroll_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pay_date?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payroll_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pay_date?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payroll_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          basic_salary: number
          created_at: string
          employee_id: string
          gross_salary: number
          id: string
          late_deduction: number
          leave_deduction: number
          net_salary: number
          other_deductions: number
          payroll_period_id: string
          released_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          total_allowances: number
          total_deductions: number
          undertime_deduction: number
          updated_at: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          employee_id: string
          gross_salary?: number
          id?: string
          late_deduction?: number
          leave_deduction?: number
          net_salary?: number
          other_deductions?: number
          payroll_period_id: string
          released_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_allowances?: number
          total_deductions?: number
          undertime_deduction?: number
          updated_at?: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          employee_id?: string
          gross_salary?: number
          id?: string
          late_deduction?: number
          leave_deduction?: number
          net_salary?: number
          other_deductions?: number
          payroll_period_id?: string
          released_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_allowances?: number
          total_deductions?: number
          undertime_deduction?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          payroll_record_id: string
          released_at: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          payroll_record_id: string
          released_at?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          payroll_record_id?: string
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          department_id: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          employee_id?: string | null
          full_name: string
          id: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_grades: {
        Row: {
          created_at: string
          grade_name: string
          id: string
          max_salary: number
          min_salary: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_name: string
          id?: string
          max_salary: number
          min_salary: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_name?: string
          id?: string
          max_salary?: number
          min_salary?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_employee_number: { Args: never; Returns: string }
      is_active_staff: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      account_status: "active" | "inactive"
      application_status:
        | "submitted"
        | "under_review"
        | "qualified"
        | "rejected"
        | "interview_scheduled"
        | "offered"
        | "hired"
        | "closed"
      attendance_status: "present" | "absent" | "late" | "on_leave" | "holiday"
      contract_status: "draft" | "printed" | "signed"
      employment_status:
        | "active"
        | "on_leave"
        | "suspended"
        | "resigned"
        | "terminated"
      employment_type: "full_time" | "part_time" | "contract" | "internship"
      interview_status:
        | "scheduled"
        | "passed"
        | "failed"
        | "completed"
        | "cancelled"
      interview_type: "initial" | "final"
      job_posting_status: "draft" | "open" | "closed"
      leave_request_status: "pending" | "approved" | "rejected" | "cancelled"
      offer_status: "pending" | "accepted" | "declined"
      payroll_status: "draft" | "reviewed" | "released"
      report_format: "pdf" | "docx" | "excel"
      user_role: "admin" | "hr_staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[TableName] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName] extends { Insert: infer I } ? I : never

export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName] extends { Update: infer U } ? U : never

export type Enums<EnumName extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][EnumName]

// Convenience aliases used throughout the app.
export type UserRole = Enums<"user_role">
export type AccountStatus = Enums<"account_status">
