import { FileText, Download, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useResumeSignedUrl } from '@/hooks/useRecruitment'

function extensionOf(path: string) {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

export function ResumeViewer({ resumePath }: { resumePath: string | null }) {
  const { data: signedUrl, isLoading, isError } = useResumeSignedUrl(resumePath)

  if (!resumePath) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No resume was attached to this application.</p>
      </div>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />
  }

  if (isError || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/40 py-10 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">Couldn't load the resume preview. Please try again.</p>
      </div>
    )
  }

  const extension = extensionOf(resumePath)
  const isPdf = extension === 'pdf'
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)

  return (
    <div className="flex flex-col gap-2">
      {isPdf ? (
        <iframe src={signedUrl} title="Resume preview" className="h-[480px] w-full rounded-lg border border-border" />
      ) : isImage ? (
        <img src={signedUrl} alt="Resume preview" className="max-h-[480px] w-full rounded-lg border border-border object-contain" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 py-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Preview not available for .{extension} files</p>
            <p className="text-xs text-muted-foreground">Open the file directly to view its contents.</p>
          </div>
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="self-start">
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
          Open in new tab
        </a>
      </Button>
    </div>
  )
}
