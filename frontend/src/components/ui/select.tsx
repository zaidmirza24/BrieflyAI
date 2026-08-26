import * as React from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  loading?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, loading, disabled, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-9 text-sm text-[var(--foreground)] outline-none [color-scheme:light] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {loading ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--muted-foreground)]" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
      )}
    </div>
  ),
)
Select.displayName = "Select"
