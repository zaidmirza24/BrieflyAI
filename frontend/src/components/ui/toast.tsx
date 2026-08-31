import * as React from "react"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "success" | "error" | "info"
interface Toast {
  id: number
  message: string
  tone: Tone
}

const ToastContext = React.createContext<(message: string, tone?: Tone) => void>(() => {})

export function useToast() {
  return React.useContext(ToastContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const push = React.useCallback((message: string, tone: Tone = "success") => {
    const id = nextId++
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }, [])

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info
          return (
            <div
              key={t.id}
              className={cn(
                "animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-lg)]",
                t.tone === "success" && "border-[var(--success-border)] bg-[var(--success-bg)]",
                t.tone === "error" && "border-[var(--destructive-border)] bg-[var(--destructive-bg)]",
                t.tone === "info" && "border-[var(--border)]",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  t.tone === "success" && "text-[var(--success)]",
                  t.tone === "error" && "text-[var(--destructive)]",
                  t.tone === "info" && "text-[var(--muted-foreground)]",
                )}
              />
              <p className="flex-1 text-[var(--foreground)]">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-m-1 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
