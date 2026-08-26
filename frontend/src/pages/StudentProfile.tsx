import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, CalendarDays, FileAudio, User2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getStudent, type StudentDetail } from "@/lib/api"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getStudent(id)
      .then(setStudent)
      .catch(() => setError("Could not load this student."))
  }, [id])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/students"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </Link>

      {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}

      {!student && !error && (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-32" />
              </div>
              <div className="flex gap-6 sm:gap-8">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Skeleton className="mt-8 h-4 w-32" />
          <div className="mt-3 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3.5 w-44" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {student && (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold">{student.name}</h1>
                {student.mentor_name && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                    <User2 className="h-3.5 w-3.5" />
                    Mentor: {student.mentor_name}
                  </p>
                )}
              </div>
              <div className="flex gap-6 sm:gap-8">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{student.analysis_count}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Total Analyses</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{formatDate(student.last_analysis_at)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Last Analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2 className="mt-8 text-sm font-semibold text-[var(--muted-foreground)]">Session History</h2>
          <div className="mt-3 flex flex-col gap-3">
            {student.sessions.map((s) => (
              <Link key={s.id} to={`/analyses/${s.id}`}>
                <Card className="transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)]/40">
                  <CardContent className="flex items-center justify-between gap-4 pt-6">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <CalendarDays className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                        {formatDate(s.created_at)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--muted-foreground)]">
                        <FileAudio className="h-3.5 w-3.5 shrink-0" />
                        Mentor-Mentee Session · {s.audio_filename}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={s.status} />
                      <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
