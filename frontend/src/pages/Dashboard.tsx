import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, FileAudio, Plus, Sparkles, Users } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { isAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { usePageTitle } from "@/lib/usePageTitle"
import {
  getAttentionSummary,
  getDashboardSummary,
  type AttentionSummary,
  type DashboardSummary,
} from "@/lib/api"

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <Card interactive>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[image:var(--accent-gradient)] text-white shadow-[var(--shadow-sm)]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  usePageTitle("Dashboard")
  const admin = isAdmin()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [attention, setAttention] = useState<AttentionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setError(null)
    getDashboardSummary()
      .then(setSummary)
      .catch(() => setError("Could not load dashboard data."))
    getAttentionSummary().then(setAttention).catch(() => setAttention(null))
  }

  useEffect(load, [])

  const attentionTotal = attention
    ? attention.unassigned + attention.overdue + attention.paused
    : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Here's where things stand</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your mentor-mentee sessions and progress, all in one place.
          </p>
        </div>
        <Link to="/new" className={buttonVariants({ variant: "accent" })}>
          <Plus className="h-4 w-4" />
          New Analysis
        </Link>
      </div>

      {error && (
        <Card className="mt-6">
          <ErrorState description={error} onRetry={load} />
        </Card>
      )}

      {!summary && !error && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-6 w-10" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-6 py-3.5">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3.5 w-44" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {summary && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard icon={Users} label="Total Students" value={summary.total_students} />
            <StatCard icon={FileAudio} label="Total Analyses" value={summary.total_analyses} />
          </div>

          {attention && attentionTotal > 0 && (
            <Card className="mt-4 border-[var(--warning-border)] bg-[var(--warning-bg)]/30">
              <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                  <p className="text-sm">
                    {admin && attention.unassigned > 0 && (
                      <span className="font-medium">{attention.unassigned} unassigned</span>
                    )}
                    {admin && attention.unassigned > 0 && (attention.overdue > 0 || attention.paused > 0) && " · "}
                    {attention.overdue > 0 && <span>{attention.overdue} overdue for a session</span>}
                    {attention.overdue > 0 && attention.paused > 0 && " · "}
                    {attention.paused > 0 && <span>{attention.paused} paused</span>}
                  </p>
                </div>
                {admin && (
                  <Link
                    to="/assignments"
                    className="text-sm font-medium text-[var(--accent)] hover:underline"
                  >
                    Go to Assignments
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-sm font-semibold">Recent Analyses</h2>
              <Link to="/analyses" className="text-sm text-[var(--accent)] hover:underline">
                View all analyses
              </Link>
            </div>
            {summary.recent_analyses.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="You're ready to get started"
                description="Upload your first mentor-mentee recording and insights will show up right here."
                action={
                  <Link to="/new" className={buttonVariants({ variant: "accent", size: "sm" })}>
                    New Analysis
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {summary.recent_analyses.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/analyses/${a.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-[var(--muted)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.student_name}</p>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          Mentor: {a.mentor_name} · {formatDate(a.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
