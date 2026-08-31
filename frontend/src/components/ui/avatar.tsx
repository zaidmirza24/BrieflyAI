import { cn } from "@/lib/utils"

const PALETTE = [
  "bg-[var(--accent-bg)] text-[var(--accent-strong)]",
  "bg-[var(--success-bg)] text-[var(--success)]",
  "bg-[var(--warning-bg)] text-[var(--warning)]",
  "bg-[var(--muted)] text-[var(--foreground)]",
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return Math.abs(h)
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm"
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        dims,
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}
