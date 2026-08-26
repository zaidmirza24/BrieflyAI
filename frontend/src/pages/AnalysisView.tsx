import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { AnalysisResult } from "@/components/AnalysisResult"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, getSession, type SessionDetail } from "@/lib/api"

export default function AnalysisView() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setSession(null)
    setError(null)
    getSession(id)
      .then(setSession)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this analysis."))
  }, [id])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/students"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </Link>

      <div className="mt-4">
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        {!error && !session && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
            </div>

            <Skeleton className="h-9 w-48 rounded-lg" />

            <Skeleton className="h-24 w-full" />

            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-28" />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        {session && <AnalysisResult session={session} />}
      </div>
    </div>
  )
}
