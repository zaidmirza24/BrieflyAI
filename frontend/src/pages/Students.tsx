import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search, Users } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { listStudents, type StudentSummary } from "@/lib/api"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function Students() {
  const [students, setStudents] = useState<StudentSummary[] | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handle = setTimeout(() => {
      listStudents(query || undefined).then(setStudents)
    }, 200)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Every student you've analyzed a mentor session for.
          </p>
        </div>
        <Link to="/new" className={buttonVariants({ variant: "accent" })}>
          <Plus className="h-4 w-4" />
          New Analysis
        </Link>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          placeholder="Search students…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {students === null && (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {students && students.length === 0 && (
          <EmptyState
            icon={Users}
            title={query ? "No students match your search" : "No students yet"}
            description={query ? "Try a different name." : "Run your first analysis to see students here."}
            action={
              !query ? (
                <Link to="/new" className={buttonVariants({ variant: "accent", size: "sm" })}>
                  New Analysis
                </Link>
              ) : undefined
            }
          />
        )}

        {students && students.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Mentor</th>
                  <th className="px-6 py-3 font-medium">Analyses</th>
                  <th className="px-6 py-3 font-medium">Last Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {students.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-[var(--muted)]">
                    <td className="px-6 py-3.5">
                      <Link to={`/students/${s.id}`} className="font-medium text-[var(--foreground)] hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{s.mentor_name ?? "—"}</td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{s.analysis_count}</td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{formatDate(s.last_analysis_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
