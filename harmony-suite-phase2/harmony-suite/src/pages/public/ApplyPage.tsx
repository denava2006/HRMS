import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, FileText, Upload, X, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'
import {
  usePublicJobPosting,
  useSubmitApplication,
  isAcceptingApplications,
  validateResumeFile,
} from '@/hooks/usePublicCareers'

// Letters with single spaces, hyphens, or apostrophes between them — no digits,
// no other symbols, and no leading/trailing or doubled-up separators.
const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/
const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100)
    .regex(nameRegex, `${label} can only contain letters, spaces, hyphens, and apostrophes`)

// Philippine mobile numbers only: exactly 11 digits, starting with 09.
const phoneRegex = /^09\d{9}$/

const applicationSchema = z.object({
  firstName: nameField('First name'),
  lastName: nameField('Last name'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(phoneRegex, 'Enter a valid Philippine mobile number (11 digits, starting with 09)'),
  address: z.string().trim().min(1, 'Address is required').max(500),
  coverLetter: z.string().max(2000, 'Cover letter cannot exceed 2,000 characters').optional(),
})
type ApplicationFormValues = z.infer<typeof applicationSchema>

/** Strips everything but digits and caps the length at 11, as the user types —
 * so letters, +, -, /, *, ., (), and spaces can never even be entered. */
function sanitizePhoneInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 11)
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ResumeDropzone({
  file,
  onSelect,
  error,
}: {
  file: File | null
  onSelect: (file: File | null, error: string | null) => void
  error: string | null
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = React.useState(false)

  const handleFiles = (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    const validationError = validateResumeFile(picked)
    onSelect(validationError ? null : picked, validationError)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="resume">
        Resume / CV <span className="text-destructive">*</span>
      </Label>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-card px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-secondary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null, null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove selected resume"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragActive ? 'border-secondary bg-secondary/5' : 'border-input hover:border-secondary/50',
            error && 'border-destructive'
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-foreground">
            <span className="font-medium text-secondary">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX — max 5 MB</p>
          <input
            ref={inputRef}
            id="resume"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ApplyPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-6 h-8 w-2/3" />
      <Skeleton className="mt-8 h-96 w-full" />
    </div>
  )
}

export default function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { data: posting, isLoading } = usePublicJobPosting(jobId)
  const submitApplication = useSubmitApplication()

  const [resumeFile, setResumeFile] = React.useState<File | null>(null)
  const [resumeError, setResumeError] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({ resolver: zodResolver(applicationSchema) })
  const phoneField = register('phone')

  if (isLoading) return <ApplyPageSkeleton />

  if (!posting) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Briefcase className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Job posting not found</h1>
        <Button asChild>
          <Link to="/careers">Browse open positions</Link>
        </Button>
      </div>
    )
  }

  if (!isAcceptingApplications(posting)) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Briefcase className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Applications Closed</h1>
        <p className="max-w-md text-muted-foreground">
          "{posting.positions?.title ?? 'This position'}" is no longer accepting applications. Take a look at our
          other open roles.
        </p>
        <Button asChild>
          <Link to="/careers">Browse open positions</Link>
        </Button>
      </div>
    )
  }

  const onSubmit = async (values: ApplicationFormValues) => {
    setSubmitError(null)
    if (!resumeFile) {
      setResumeError('Please attach your resume to continue.')
      return
    }

    try {
      await submitApplication.mutateAsync({
        jobPostingId: posting.id,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        address: values.address,
        coverLetter: values.coverLetter,
        resumeFile,
      })
      navigate('/careers/application-success', {
        replace: true,
        state: { jobTitle: posting.positions?.title },
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl px-4 py-16 sm:px-6"
    >
      <Link
        to={`/careers/${posting.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job details
      </Link>

      <div className="mt-6">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Apply for this role</h1>
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-1.5 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {posting.departments?.name && <Badge variant="secondary">{posting.departments.name}</Badge>}
              <Badge variant="outline">{EMPLOYMENT_TYPE_LABEL[posting.employment_type]}</Badge>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {posting.positions?.title ?? 'Open Position'}
            </p>
          </CardContent>
        </Card>
      </div>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">
              First name <span className="text-destructive">*</span>
            </Label>
            <Input id="firstName" invalid={!!errors.firstName} {...register('firstName')} placeholder="Juan" />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">
              Last name <span className="text-destructive">*</span>
            </Label>
            <Input id="lastName" invalid={!!errors.lastName} {...register('lastName')} placeholder="Dela Cruz" />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">
            Email address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            invalid={!!errors.email}
            {...register('email')}
            placeholder="juan.delacruz@email.com"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">
            Phone number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            invalid={!!errors.phone}
            {...phoneField}
            onChange={(e) => {
              e.target.value = sanitizePhoneInput(e.target.value)
              phoneField.onChange(e)
            }}
            placeholder="09XXXXXXXXX"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address">
            Address <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="address"
            invalid={!!errors.address}
            {...register('address')}
            placeholder="Street, City, Province"
            rows={2}
          />
          {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
        </div>

        <ResumeDropzone
          file={resumeFile}
          error={resumeError}
          onSelect={(file, error) => {
            setResumeFile(file)
            setResumeError(error)
          }}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coverLetter">Cover letter</Label>
          <Textarea
            id="coverLetter"
            invalid={!!errors.coverLetter}
            maxLength={2000}
            {...register('coverLetter')}
            placeholder="Tell us why you're a great fit for this role (optional)"
            rows={5}
          />
          {errors.coverLetter && <p className="text-xs text-destructive">{errors.coverLetter.message}</p>}
        </div>

        <Button type="submit" size="lg" className="mt-2" loading={isSubmitting || submitApplication.isPending}>
          {isSubmitting || submitApplication.isPending ? 'Submitting application…' : 'Submit Application'}
        </Button>
      </form>
    </motion.div>
  )
}
