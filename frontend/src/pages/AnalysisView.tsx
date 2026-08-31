import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { AnalysisResult } from "@/components/AnalysisResult"
import { AnalysisStepper } from "@/components/AnalysisStepper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { usePageTitle } from "@/lib/usePageTitle"
import { ApiError, getSession, type AnalysisStage, type SessionDetail, type SessionStatus } from "@/lib/api"

const TERMINAL: SessionStatus[] = ["SAVED", "AUDIO_DELETED", "FAILED"]

// Map a persisted session status onto the closest in-flight stepper stage so a
// page refresh mid-analysis still shows meaningful progress.
const STATUS_STAGE: Partial<Record<SessionStatus, AnalysisStage>> = {
  PROCESSING: "transcribing",
  TRANSCRIBED: "transcribed",
  ANALYZED: "analyzing",
}

export default function AnalysisView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  usePageTitle(session ? `${session.student_name} · Analysis` : "Analysis")

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setSession(null)
    setError(null)

    function tick() {
      getSession(id!)
        .then((data) => {
          if (cancelled) return
          setSession(data)
          if (!TERMINAL.includes(data.status)) {
            pollRef.current = setTimeout(tick, 4000)
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load this analysis.")
        })
    }
    tick()

    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [id])

  const inProgress = session && !TERMINAL.includes(session.status)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mt-4">
        {error && (
          <Card>
            <ErrorState description={error} onRetry={() => window.location.reload()} />
          </Card>
        )}

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

        {inProgress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base" as="h2">
                {session!.status === "FAILED" ? "Analysis failed" : "Analysing this recording…"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisStepper stage={STATUS_STAGE[session!.status] ?? null} hasError={false} />
              <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                This keeps updating automatically — you can safely leave and come back.
              </p>
            </CardContent>
          </Card>
        )}

        {session && !inProgress && <AnalysisResult session={session} />}
      </div>
    </div>
  )
}
