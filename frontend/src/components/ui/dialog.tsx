import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZE: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
}

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
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative my-8 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]",
          SIZE[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
