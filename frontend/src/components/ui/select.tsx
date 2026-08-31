import * as React from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  loading?: boolean
  loadingText?: string
}

const baseField =
  "flex h-10 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-9 text-sm text-[var(--foreground)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, loading, loadingText = "Loading…", disabled, ...props }, ref) => {
    if (loading) {
      return (
        <div className="relative">
          <div
            className={cn(
              baseField,
              "items-center gap-2 text-[var(--muted-foreground)] cursor-progress select-none",
              className,
            )}
            aria-busy="true"
            role="status"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
            {loadingText}
          </div>
        </div>
      )
    }

    return (
      <div className="relative">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            baseField,
            // Theme the native popup as far as browsers allow.
            "[color-scheme:inherit] [&_option]:bg-[var(--surface)] [&_option]:text-[var(--foreground)] [&_optgroup]:bg-[var(--surface)] [&_optgroup]:text-[var(--muted-foreground)]",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
      </div>
    )
  },
)
Select.displayName = "Select"
