import { useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function useWizard(count: number) {
  const [step, setStep] = useState(0)
  return {
    step,
    isFirst: step === 0,
    isLast: step === count - 1,
    next: () => setStep((s) => Math.min(count - 1, s + 1)),
    back: () => setStep((s) => Math.max(0, s - 1)),
    goTo: (s: number) => setStep(Math.max(0, Math.min(count - 1, s))),
  }
}

export function WizardSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]",
                active && "border-[var(--accent)] text-[var(--accent-strong)]",
                !done && !active && "border-[var(--border)] text-[var(--muted-foreground)]",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-[var(--border)]" />}
          </li>
        )
      })}
    </ol>
  )
}
