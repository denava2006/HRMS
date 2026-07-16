import * as React from 'react'
import { FileText, Upload, X, Download, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import {
  useEmployeeDocuments,
  useEmployeeDocumentSignedUrl,
  useUploadEmployeeDocument,
  useReplaceEmployeeDocument,
  useDeleteEmployeeDocument,
  validateEmployeeDocumentFile,
} from '@/hooks/useEmployees'
import { DOCUMENT_TYPE_OPTIONS } from '@/lib/employeeLabels'

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function DocumentRow({
  doc,
  onReplace,
  onDelete,
}: {
  doc: {
    id: string
    document_type: string
    file_url: string
    uploaded_at: string
    uploader: { full_name: string } | null
  }
  onReplace: (documentId: string, documentType: string, previousPath: string, file: File) => void
  onDelete: (documentId: string, path: string) => void
}) {
  const { data: signedUrl } = useEmployeeDocumentSignedUrl(doc.file_url)
  const replaceInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{doc.document_type}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(doc.uploaded_at)}
            {doc.uploader?.full_name ? ` · Uploaded by ${doc.uploader.full_name}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" disabled={!signedUrl} onClick={() => signedUrl && window.open(signedUrl, '_blank')}>
          <Download className="h-3.5 w-3.5" />
          View
        </Button>
        <Button variant="ghost" size="sm" onClick={() => replaceInputRef.current?.click()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Replace
        </Button>
        <input
          ref={replaceInputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const error = validateEmployeeDocumentFile(file)
            if (error) {
              window.alert(error)
              return
            }
            onReplace(doc.id, doc.document_type, doc.file_url, file)
            e.target.value = ''
          }}
        />
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(doc.id, doc.file_url)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function EmployeeDocumentsTab({ employeeId }: { employeeId: string }) {
  const { data: documents, isLoading } = useEmployeeDocuments(employeeId)
  const uploadDocument = useUploadEmployeeDocument()
  const replaceDocument = useReplaceEmployeeDocument()
  const deleteDocument = useDeleteEmployeeDocument()

  const [documentType, setDocumentType] = React.useState<string>(DOCUMENT_TYPE_OPTIONS[0])
  const [file, setFile] = React.useState<File | null>(null)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; path: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    const error = validateEmployeeDocumentFile(picked)
    setFileError(error)
    setFile(error ? null : picked)
  }

  const onUpload = () => {
    if (!file) return
    uploadDocument.mutate(
      { employeeId, documentType, file },
      {
        onSuccess: () => {
          setFile(null)
          setFileError(null)
          if (inputRef.current) inputRef.current.value = ''
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <Label>Upload a document</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPE_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" disabled={!file} loading={uploadDocument.isPending} onClick={onUpload}>
            Upload
          </Button>
        </div>

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
              onClick={() => setFile(null)}
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
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors',
              'border-input hover:border-secondary/50',
              fileError && 'border-destructive'
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-foreground">
              <span className="font-medium text-secondary">Click to upload</span> a file
            </p>
            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, or PNG — max 10 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files)}
            />
          </div>
        )}
        {fileError && <p className="text-xs text-destructive">{fileError}</p>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents && documents.length > 0 ? (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onReplace={(documentId, docType, previousPath, newFile) =>
                replaceDocument.mutate({ documentId, employeeId, previousPath, documentType: docType, file: newFile })
              }
              onDelete={(documentId, path) => setDeleteTarget({ id: documentId, path })}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteDocument.mutate({ documentId: deleteTarget.id, employeeId, path: deleteTarget.path })
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
