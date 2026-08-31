import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | "…")[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  if (start > 2) out.push("…")
  for (let i = start; i <= end; i++) out.push(i)
  if (end < pages - 1) out.push("…")
  out.push(pages)
  return out
}

export function Pagination({
  page,
  pages,
  onPage,
  className,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
  className?: string
}) {
  if (pages <= 1) return null
  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--border)] px-2 text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none hover:bg-[var(--muted)]"
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <button className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pageWindow(page, pages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-[var(--muted-foreground)]">
            …
          </span>
        ) : (
          <button
            key={p}
            className={cn(btn, p === page && "border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]")}
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
