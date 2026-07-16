export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
          middle_name: string | null
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
          middle_name?: string | null
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
          middle_name?: string | null
          phone?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      application_history: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          event: string
          id: string
          notes: string | null
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          event: string
          id?: string
          notes?: string | null
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          event?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          job_posting_id: string
          notes: string | null
          rejection_reason: string | null
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
          rejection_reason?: string | null
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
          rejection_reason?: string | null
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
      deployment_records: {
        Row: {
          application_id: string
          assigned_branch: string | null
          created_at: string
          deployed_by: string | null
          deployment_date: string
          id: string
          remarks: string | null
          reporting_manager: string | null
          reporting_time: string | null
          updated_at: string
          work_location: string | null
        }
        Insert: {
          application_id: string
          assigned_branch?: string | null
          created_at?: string
          deployed_by?: string | null
          deployment_date: string
          id?: string
          remarks?: string | null
          reporting_manager?: string | null
          reporting_time?: string | null
          updated_at?: string
          work_location?: string | null
        }
        Update: {
          application_id?: string
          assigned_branch?: string | null
          created_at?: string
          deployed_by?: string | null
          deployment_date?: string
          id?: string
          remarks?: string | null
          reporting_manager?: string | null
          reporting_time?: string | null
          updated_at?: string
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployment_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_records_deployed_by_fkey"
            columns: ["deployed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      employee_history: {
        Row: {
          actor_id: string | null
          created_at: string
          employee_id: string
          event: string
          id: string
          notes: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          employee_id: string
          event: string
          id?: string
          notes?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          employee_id?: string
          event?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          application_id: string | null
          basic_salary: number
          benefits: string | null
          birth_date: string | null
          civil_status: string | null
          created_at: string
          currency: string
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
          middle_name: string | null
          nationality: string | null
          phone: string | null
          photo_url: string | null
          position_id: string | null
          probation_period: string | null
          salary_grade_id: string | null
          updated_at: string
          work_schedule_id: string | null
        }
        Insert: {
          address?: string | null
          application_id?: string | null
          basic_salary?: number
          benefits?: string | null
          birth_date?: string | null
          civil_status?: string | null
          created_at?: string
          currency?: string
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
          middle_name?: string | null
          nationality?: string | null
          phone?: string | null
          photo_url?: string | null
          position_id?: string | null
          probation_period?: string | null
          salary_grade_id?: string | null
          updated_at?: string
          work_schedule_id?: string | null
        }
        Update: {
          address?: string | null
          application_id?: string | null
          basic_salary?: number
          benefits?: string | null
          birth_date?: string | null
          civil_status?: string | null
          created_at?: string
          currency?: string
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
          middle_name?: string | null
          nationality?: string | null
          phone?: string | null
          photo_url?: string | null
          position_id?: string | null
          probation_period?: string | null
          salary_grade_id?: string | null
          updated_at?: string
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
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
          {
            foreignKeyName: "employees_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          additional_notes: string | null
          company_policies: string | null
          contract_file_url: string | null
          created_at: string
          id: string
          job_offer_id: string
          signed_at: string | null
          signed_by: string | null
          signing_notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          terms: string | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          company_policies?: string | null
          contract_file_url?: string | null
          created_at?: string
          id?: string
          job_offer_id: string
          signed_at?: string | null
          signed_by?: string | null
          signing_notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          company_policies?: string | null
          contract_file_url?: string | null
          created_at?: string
          id?: string
          job_offer_id?: string
          signed_at?: string | null
          signed_by?: string | null
          signing_notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
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
          {
            foreignKeyName: "employment_contracts_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          holiday_type: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          holiday_type: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          holiday_type?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          application_id: string
          created_at: string
          final_remarks: string | null
          id: string
          interview_notes: string | null
          interview_type: Database["public"]["Enums"]["interview_type"]
          interviewer_id: string | null
          location: string | null
          meeting_link: string | null
          mode: string | null
          overall_impression: string | null
          rating_communication: number | null
          rating_confidence: number | null
          rating_culture_fit: number | null
          rating_experience: number | null
          rating_leadership: number | null
          rating_problem_solving: number | null
          rating_technical_evaluation: number | null
          rating_technical_skills: number | null
          recommended_salary: number | null
          rejection_reason: string | null
          remarks: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          final_remarks?: string | null
          id?: string
          interview_notes?: string | null
          interview_type: Database["public"]["Enums"]["interview_type"]
          interviewer_id?: string | null
          location?: string | null
          meeting_link?: string | null
          mode?: string | null
          overall_impression?: string | null
          rating_communication?: number | null
          rating_confidence?: number | null
          rating_culture_fit?: number | null
          rating_experience?: number | null
          rating_leadership?: number | null
          rating_problem_solving?: number | null
          rating_technical_evaluation?: number | null
          rating_technical_skills?: number | null
          recommended_salary?: number | null
          rejection_reason?: string | null
          remarks?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          final_remarks?: string | null
          id?: string
          interview_notes?: string | null
          interview_type?: Database["public"]["Enums"]["interview_type"]
          interviewer_id?: string | null
          location?: string | null
          meeting_link?: string | null
          mode?: string | null
          overall_impression?: string | null
          rating_communication?: number | null
          rating_confidence?: number | null
          rating_culture_fit?: number | null
          rating_experience?: number | null
          rating_leadership?: number | null
          rating_problem_solving?: number | null
          rating_technical_evaluation?: number | null
          rating_technical_skills?: number | null
          recommended_salary?: number | null
          rejection_reason?: string | null
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
          additional_compensation: string | null
          application_id: string
          benefits: string | null
          created_at: string
          currency: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          notes: string | null
          offer_date: string
          prepared_by: string | null
          probation_period: string | null
          proposed_salary: number
          responded_at: string | null
          salary_grade_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
          working_days: string | null
          working_hours: string | null
        }
        Insert: {
          additional_compensation?: string | null
          application_id: string
          benefits?: string | null
          created_at?: string
          currency?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          notes?: string | null
          offer_date?: string
          prepared_by?: string | null
          probation_period?: string | null
          proposed_salary: number
          responded_at?: string | null
          salary_grade_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
          working_days?: string | null
          working_hours?: string | null
        }
        Update: {
          additional_compensation?: string | null
          application_id?: string
          benefits?: string | null
          created_at?: string
          currency?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          notes?: string | null
          offer_date?: string
          prepared_by?: string | null
          probation_period?: string | null
          proposed_salary?: number
          responded_at?: string | null
          salary_grade_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
          working_days?: string | null
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_salary_grade_id_fkey"
            columns: ["salary_grade_id"]
            isOneToOne: false
            referencedRelation: "salary_grades"
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
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          supporting_document_url: string | null
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
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          supporting_document_url?: string | null
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
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          supporting_document_url?: string | null
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
          is_paid: boolean
          name: string
        }
        Insert: {
          created_at?: string
          default_credits?: number
          id?: string
          is_paid?: boolean
          name: string
        }
        Update: {
          created_at?: string
          default_credits?: number
          id?: string
          is_paid?: boolean
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
          frequency: string
          id: string
          pay_date: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payroll_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          pay_date?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payroll_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency?: string
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
          absent_days: number
          basic_salary: number
          created_at: string
          currency: string
          days_present: number
          employee_id: string
          gross_salary: number
          holiday_pay: number
          id: string
          late_deduction: number
          late_minutes: number
          leave_deduction: number
          net_salary: number
          notes: string | null
          other_deductions: number
          overtime_hours: number
          overtime_pay: number
          paid_leave_days: number
          payroll_period_id: string
          released_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          total_allowances: number
          total_deductions: number
          undertime_deduction: number
          undertime_minutes: number
          unpaid_leave_days: number
          updated_at: string
          working_days: number
        }
        Insert: {
          absent_days?: number
          basic_salary?: number
          created_at?: string
          currency?: string
          days_present?: number
          employee_id: string
          gross_salary?: number
          holiday_pay?: number
          id?: string
          late_deduction?: number
          late_minutes?: number
          leave_deduction?: number
          net_salary?: number
          notes?: string | null
          other_deductions?: number
          overtime_hours?: number
          overtime_pay?: number
          paid_leave_days?: number
          payroll_period_id: string
          released_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_allowances?: number
          total_deductions?: number
          undertime_deduction?: number
          undertime_minutes?: number
          unpaid_leave_days?: number
          updated_at?: string
          working_days?: number
        }
        Update: {
          absent_days?: number
          basic_salary?: number
          created_at?: string
          currency?: string
          days_present?: number
          employee_id?: string
          gross_salary?: number
          holiday_pay?: number
          id?: string
          late_deduction?: number
          late_minutes?: number
          leave_deduction?: number
          net_salary?: number
          notes?: string | null
          other_deductions?: number
          overtime_hours?: number
          overtime_pay?: number
          paid_leave_days?: number
          payroll_period_id?: string
          released_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_allowances?: number
          total_deductions?: number
          undertime_deduction?: number
          undertime_minutes?: number
          unpaid_leave_days?: number
          updated_at?: string
          working_days?: number
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
          payslip_number: string
          released_at: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          payroll_record_id: string
          payslip_number?: string
          released_at?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          payroll_record_id?: string
          payslip_number?: string
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
          activated_at: string | null
          avatar_url: string | null
          created_at: string
          created_by: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          invited_at: string | null
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          employee_id?: string | null
          full_name: string
          id: string
          invited_at?: string | null
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_employee"
            columns: ["employee_id"]
            isOneToOne: true
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
      work_schedules: {
        Row: {
          break_minutes: number
          created_at: string
          end_time: string
          id: string
          is_default: boolean
          name: string
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          end_time: string
          id?: string
          is_default?: boolean
          name: string
          start_time: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          break_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          is_default?: boolean
          name?: string
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_employee_number: { Args: never; Returns: string }
      generate_payslip_number: { Args: never; Returns: string }
      is_active_staff: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      submit_job_application: {
        Args: {
          p_address: string
          p_cover_letter?: string
          p_email: string
          p_first_name: string
          p_job_posting_id: string
          p_last_name: string
          p_middle_name?: string
          p_phone: string
          p_resume_path: string
        }
        Returns: {
          applicant_id: string
          application_id: string
        }[]
      }
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
        | "deployed"
      attendance_status:
        | "present"
        | "absent"
        | "late"
        | "on_leave"
        | "holiday"
        | "half_day"
        | "rest_day"
        | "official_business"
        | "work_from_home"
      contract_status: "draft" | "printed" | "signed"
      employment_status:
        | "active"
        | "probationary"
        | "regular"
        | "contractual"
        | "temporary"
        | "on_leave"
        | "resigned"
        | "terminated"
        | "retired"
      employment_type: "full_time" | "part_time"
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
      user_role: "admin" | "hr_staff" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "inactive"],
      application_status: [
        "submitted",
        "under_review",
        "qualified",
        "rejected",
        "interview_scheduled",
        "offered",
        "hired",
        "closed",
        "deployed",
      ],
      attendance_status: [
        "present",
        "absent",
        "late",
        "on_leave",
        "holiday",
        "half_day",
        "rest_day",
        "official_business",
        "work_from_home",
      ],
      contract_status: ["draft", "printed", "signed"],
      employment_status: [
        "active",
        "probationary",
        "regular",
        "contractual",
        "temporary",
        "on_leave",
        "resigned",
        "terminated",
        "retired",
      ],
      employment_type: ["full_time", "part_time"],
      interview_status: [
        "scheduled",
        "passed",
        "failed",
        "completed",
        "cancelled",
      ],
      interview_type: ["initial", "final"],
      job_posting_status: ["draft", "open", "closed"],
      leave_request_status: ["pending", "approved", "rejected", "cancelled"],
      offer_status: ["pending", "accepted", "declined"],
      payroll_status: ["draft", "reviewed", "released"],
      report_format: ["pdf", "docx", "excel"],
      user_role: ["admin", "hr_staff", "employee"],
    },
  },
} as const

// Convenience aliases used throughout the app.
export type UserRole = Enums<"user_role">
export type AccountStatus = Enums<"account_status">
export type InterviewType = Enums<"interview_type">
export type InterviewStatus = Enums<"interview_status">
export type EmploymentStatus = Enums<"employment_status">
export type AttendanceStatus = Enums<"attendance_status">
export type LeaveRequestStatus = Enums<"leave_request_status">
export type PayrollStatus = Enums<"payroll_status">
export type ReportFormat = Enums<"report_format">
