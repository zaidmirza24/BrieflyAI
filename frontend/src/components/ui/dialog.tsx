import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFocusTrap } from "@/lib/useFocusTrap"

const SIZE: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
}

let dialogCount = 0

export function Dialog({
  title,
  description,
  size = "md",
  onClose,
  footer,
  children,
}: {
  title: string
  description?: string
  size?: "sm" | "md" | "lg" | "xl"
  onClose: () => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const titleId = React.useId()
  const descId = React.useId()
  const containerRef = useFocusTrap<HTMLDivElement>(onClose)

  React.useEffect(() => {
    dialogCount++
    document.body.style.overflow = "hidden"
    return () => {
      dialogCount--
      if (dialogCount === 0) document.body.style.overflow = ""
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          // Bottom sheet on phones, centred modal from `sm` up.
          "relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] focus:outline-none sm:my-8 sm:max-h-[calc(100vh-4rem)] sm:rounded-xl",
          SIZE[size],
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
