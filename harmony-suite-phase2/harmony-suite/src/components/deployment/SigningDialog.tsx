import * as React from 'react'
import { FileText, Upload, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useRecordContractSigning, validateContractFile } from '@/hooks/useDeployment'

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SigningDialog({
  open,
  onOpenChange,
  applicationId,
  contractId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  contractId: string
}) {
  const { profile } = useAuth()
  const recordSigning = useRecordContractSigning()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [signedAt, setSignedAt] = React.useState('')
  const [signingNotes, setSigningNotes] = React.useState('')
  const [contractFile, setContractFile] = React.useState<File | null>(null)
  const [fileError, setFileError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSignedAt(todayISODate())
      setSigningNotes('')
      setContractFile(null)
      setFileError(null)
    }
  }, [open])

  const handleFile = (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    const validationError = validateContractFile(picked)
    if (validationError) {
      setContractFile(null)
      setFileError(validationError)
      return
    }
    setContractFile(picked)
    setFileError(null)
  }

  const onSubmit = () => {
    recordSigning.mutate(
      {
        applicationId,
        contractId,
        signedAt: new Date(signedAt).toISOString(),
        signingNotes: signingNotes.trim() || undefined,
        contractFile: contractFile ?? undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Contract Signing</DialogTitle>
          <DialogDescription>Confirm the contract has been signed by the applicant.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signed_at">
              Signing Date <span className="text-destructive">*</span>
            </Label>
            <Input id="signed_at" type="date" max={todayISODate()} value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Signed By</Label>
            <Input value={profile?.full_name ?? ''} disabled />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Contract File (optional)</Label>
            {contractFile ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-card px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-secondary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{contractFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(contractFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setContractFile(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Remove selected file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors',
                  'border-input hover:border-secondary/50',
                  fileError && 'border-destructive'
                )}
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  <span className="font-medium text-secondary">Click to upload</span> the signed copy
                </p>
                <p className="text-xs text-muted-foreground">PDF, JPG, or PNG — max 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files)}
                />
              </div>
            )}
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signing_notes">Notes</Label>
            <Textarea id="signing_notes" value={signingNotes} onChange={(e) => setSigningNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={recordSigning.isPending} onClick={onSubmit}>
            Record Signing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
