import { cn } from "@/lib/utils"

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]", className)}>
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}
