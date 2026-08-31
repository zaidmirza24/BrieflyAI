import { cn } from "@/lib/utils"

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]", className)}>
      <div
        className="h-full rounded-full bg-[image:var(--accent-gradient)] shadow-[0_0_12px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}
