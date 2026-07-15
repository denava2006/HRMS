import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group rounded-lg border border-border bg-card text-foreground shadow-lg animate-[toast-in_180ms_ease-out]',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          success: '!border-success/30 [&_[data-icon]]:text-success',
          error: '!border-destructive/30 [&_[data-icon]]:text-destructive',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from 'sonner'
