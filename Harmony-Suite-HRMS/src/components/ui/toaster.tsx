import { useToast as useToastPrimitive } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts } = useToastPrimitive()

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[420px]">
      {toasts.map(({ id, title, description, variant }) => (
        <div
          key={id}
          className={`rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-full duration-300 ${
            variant === 'destructive'
              ? 'border-destructive bg-red-50 text-destructive'
              : variant === 'success'
                ? 'border-success bg-green-50 text-success'
                : 'border-border bg-white text-navy'
          }`}
        >
          {title && <p className="text-sm font-semibold">{title}</p>}
          {description && <p className="text-sm opacity-90">{description}</p>}
        </div>
      ))}
    </div>
  )
}
