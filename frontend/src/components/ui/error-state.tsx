import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ErrorState({
  title = "Couldn't load this",
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--destructive-bg)] text-[var(--destructive)]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
        {description && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
