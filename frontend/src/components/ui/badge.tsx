import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
        accent: "border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]",
        success: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]",
        destructive: "border-[var(--destructive-border)] bg-[var(--destructive-bg)] text-[var(--destructive)]",
        warning: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  UPLOADED: "neutral",
  PROCESSING: "accent",
  TRANSCRIBED: "accent",
  ANALYZED: "accent",
  SAVED: "success",
  AUDIO_DELETED: "success",
  FAILED: "destructive",
}

export const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Uploaded",
  PROCESSING: "Processing",
  TRANSCRIBED: "Transcribed",
  ANALYZED: "Analyzed",
  SAVED: "Saved",
  AUDIO_DELETED: "Complete",
  FAILED: "Failed",
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
}

const MENTEE_STATUS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  graduated: { label: "Graduated", variant: "accent" },
  dropped: { label: "Dropped", variant: "neutral" },
}

export function MenteeStatusBadge({ status }: { status: string }) {
  const s = MENTEE_STATUS[status] ?? { label: status, variant: "neutral" as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}
