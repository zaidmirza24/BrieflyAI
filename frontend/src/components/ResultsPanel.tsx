import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Handshake,
  Lightbulb,
  Sparkles,
  Target,
  User2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StudyHours {
  current: number | null
  target: number | null
  unit: string
  mentioned: boolean
}

interface Insights {
  summary: string | null
  school_name: string | null
  student_participation: string | null
  tuition_status: string | null
  study_hours: StudyHours | null
  current_routine: string | null
  goals: string[]
  challenges: string[]
  mentor_advice: string[]
  mentee_commitments: string[]
  action_items: string[]
  important_points: string[]
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--foreground)]">
        {value ?? <span className="text-[var(--muted-foreground)]">Not mentioned</span>}
      </dd>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  items,
  variant = "default",
}: {
  title: string
  icon: LucideIcon
  items: string[]
  variant?: "default" | "accent"
}) {
  const accent = variant === "accent"
  return (
    <Card className={accent ? "border-[var(--accent-border)] bg-[var(--accent-bg)]" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={accent ? "h-4 w-4 text-[var(--accent-strong)]" : "h-4 w-4 text-[var(--muted-foreground)]"} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className={accent ? "mt-0.5 text-[var(--accent-strong)]" : "mt-0.5 text-[var(--border-strong)]"}>
                  {accent ? <CheckCircle2 className="h-3.5 w-3.5" /> : "•"}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Not mentioned</p>
        )}
      </CardContent>
    </Card>
  )
}

export function ResultsPanel({ insights }: { insights: Insights }) {
  const studyHours = insights.study_hours

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-[var(--accent-border)] bg-gradient-to-br from-[var(--accent-bg)] to-[var(--surface)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">
            <Sparkles className="h-4 w-4" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-[var(--foreground)]">
          {insights.summary ?? <span className="text-[var(--muted-foreground)]">Not mentioned</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <User2 className="h-4 w-4 text-[var(--muted-foreground)]" />
            Student Profile / Participation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Student participation" value={insights.student_participation} />
            <Field label="School" value={insights.school_name} />
            <Field label="Tuition status" value={insights.tuition_status} />
            <Field label="Current routine" value={insights.current_routine} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Study hours
              </dt>
              <dd className="mt-1 text-sm text-[var(--foreground)]">
                {studyHours?.mentioned ? (
                  `${studyHours.current ?? "?"}${studyHours.target ? ` → ${studyHours.target}` : ""} ${studyHours.unit.replace(/_/g, " ")}`
                ) : (
                  <span className="text-[var(--muted-foreground)]">Not mentioned</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard title="Goals" icon={Target} items={insights.goals} />
        <SectionCard title="Challenges" icon={AlertTriangle} items={insights.challenges} />
        <SectionCard title="Mentor Advice" icon={Lightbulb} items={insights.mentor_advice} />
        <SectionCard title="Mentee Commitments" icon={Handshake} items={insights.mentee_commitments} />
      </div>

      <SectionCard title="Action Items" icon={CheckCircle2} items={insights.action_items} variant="accent" />
      <SectionCard title="Important Points" icon={ClipboardList} items={insights.important_points} />
    </div>
  )
}
