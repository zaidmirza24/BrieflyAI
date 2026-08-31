import { cn } from "@/lib/utils"
import type { AnalysisStage } from "@/lib/api"

type StepStatus = "pending" | "active" | "done" | "error"

interface Step {
  key: string
  label: string
}

const STEPS: Step[] = [
  { key: "uploaded", label: "Audio uploaded" },
  { key: "transcribing", label: "Transcription" },
  { key: "analyzing", label: "Analyzing conversation" },
  { key: "saving", label: "Saving insights" },
  { key: "deleting", label: "Removing temporary audio" },
]

export function stepStatesForStage(stage: AnalysisStage | null, hasError: boolean): Record<string, StepStatus> {
  const order = ["uploaded", "transcribing", "analyzing", "saving", "deleting"]
  const states: Record<string, StepStatus> = Object.fromEntries(order.map((k) => [k, "pending"]))
  states.uploaded = "done"

  const doneUpTo = (key: string) => {
    for (const k of order) {
      states[k] = "done"
      if (k === key) break
    }
  }

  switch (stage) {
    case "processing":
    case "transcribing":
      states.transcribing = "active"
      break
    case "transcribed":
      doneUpTo("transcribing")
      break
    case "analyzing":
      doneUpTo("transcribing")
      states.analyzing = "active"
      break
    case "analyzed":
      doneUpTo("analyzing")
      break
    case "saved":
      doneUpTo("analyzing")
      states.saving = "done"
      states.deleting = "active"
      break
    case "deleting":
      doneUpTo("analyzing")
      states.saving = "done"
      states.deleting = "active"
      break
    case "audio_deleted":
      doneUpTo("deleting")
      break
    default:
      break
  }

  if (hasError) {
    const activeKey = order.find((k) => states[k] === "active")
    if (activeKey) states[activeKey] = "error"
  }

  return states
}

function Icon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="animate-pop flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white text-[11px]">
        ✓
      </span>
    )
  }
  if (status === "active") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" />
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--destructive)] text-white text-[11px]">
        !
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
      <span className="h-2 w-2 rounded-full border border-[var(--muted-foreground)]" />
    </span>
  )
}

export function AnalysisStepper({ stage, hasError }: { stage: AnalysisStage | null; hasError: boolean }) {
  const states = stepStatesForStage(stage, hasError)
  const allDone = !hasError && STEPS.every((s) => states[s.key] === "done")
  return (
    <>
    <ol className="flex flex-col gap-3" aria-live="polite">
      {STEPS.map((step, i) => {
        const status = states[step.key]
        return (
          <li key={step.key} className="relative flex items-center gap-3">
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[9px] top-6 h-[calc(100%-0.25rem)] w-px",
                  status === "done" ? "bg-[var(--success)]" : "bg-[var(--border)]",
                )}
              />
            )}
            <Icon status={status} />
            <span
              className={cn(
                "text-sm",
                status === "pending" && "text-[var(--muted-foreground)]",
                status === "active" && "font-medium text-[var(--foreground)]",
                status === "done" && "text-[var(--foreground)]",
                status === "error" && "font-medium text-[var(--destructive)]",
              )}
            >
              {step.label}
              {status === "active" && "…"}
            </span>
          </li>
        )
      })}
    </ol>
    {allDone && (
      <div className="animate-rise mt-4 flex items-center gap-2 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-sm font-medium text-[var(--success)]">
        <span className="animate-pop flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white text-[11px]">
          ✓
        </span>
        All set — your insights are ready.
      </div>
    )}
    </>
  )
}
