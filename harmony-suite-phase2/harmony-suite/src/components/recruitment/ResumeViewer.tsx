import { FileText, Download, ExternalLink, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useResumeSignedUrl } from '@/hooks/useRecruitment'

function extensionOf(path: string) {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

/** What a browser can render inline. PDFs and images work in an iframe or img
 * tag; Word documents have no native renderer in any browser, which is why
 * they get an explanation rather than an empty frame. */
const INLINE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const WORD_EXTENSIONS = ['doc', 'docx']

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
  const isImage = INLINE_IMAGE_EXTENSIONS.includes(extension)
  const isWord = WORD_EXTENSIONS.includes(extension)
  const canPreviewInline = isPdf || isImage

  return (
    <div className="flex flex-col gap-2">
      {isPdf ? (
        <iframe src={signedUrl} title="Resume preview" className="h-[480px] w-full rounded-lg border border-border" />
      ) : isImage ? (
        <img src={signedUrl} alt="Resume preview" className="max-h-[480px] w-full rounded-lg border border-border object-contain" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 py-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div className="max-w-md">
            <p className="text-sm font-medium text-foreground">
              {isWord ? "Word documents can't be previewed in the browser" : `Preview not available for .${extension} files`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isWord
                ? 'No browser renders .doc or .docx inline. Opening it below will show it in a new tab if your browser can handle the type, and download it otherwise.'
                : 'Open the file below to view its contents.'}
            </p>
          </div>
        </div>
      )}

      {/* target="_blank" is a request, not a guarantee: the browser opens the
        * file inline when it can render the type and downloads it when it
        * can't. The label says which to expect instead of promising one and
        * doing the other — which is what made the old "Open in new tab" read
        * as broken for Word files. */}
      <Button asChild variant="outline" size="sm" className="self-start">
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          {canPreviewInline ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {canPreviewInline ? 'Open in new tab' : 'Open or download'}
        </a>
      </Button>
    </div>
  )
}
