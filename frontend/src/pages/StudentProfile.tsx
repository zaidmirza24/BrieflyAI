import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, CalendarDays, FileAudio, History, Pencil, User2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { StatusBadge, MenteeStatusBadge, Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { AssignMenteeDialog } from "@/components/AssignMenteeDialog"
import { EditMenteeDialog } from "@/components/EditMenteeDialog"
import { isAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { usePageTitle } from "@/lib/usePageTitle"
import { ApiError, getStudent, updateStudent, type MenteeStatus, type StudentDetail } from "@/lib/api"

const STATUSES: MenteeStatus[] = ["active", "paused", "graduated", "dropped"]

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const admin = isAdmin()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  usePageTitle(student?.name ?? "Mentee")

  function load() {
    if (!id) return
    setError(null)
    getStudent(id)
      .then(setStudent)
      .catch(() => setError("Could not load this mentee."))
  }

  useEffect(load, [id])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/students"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Mentees
      </Link>

      {error && (
        <Card className="mt-4">
          <ErrorState description={error} onRetry={load} />
        </Card>
      )}

      {!student && !error && (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-3 pt-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-32" />
          </CardContent>
        </Card>
      )}

      {student && (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{student.name}</h1>
                  <MenteeStatusBadge status={student.status} />
                  {student.overdue && <Badge variant="warning">Overdue</Badge>}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <User2 className="h-3.5 w-3.5" />
                  Mentor: {student.mentor_name ?? "Unassigned"}
                </p>
              </div>
              <div className="flex items-center gap-6 sm:gap-8">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{student.analysis_count}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Sessions</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{formatDate(student.last_analysis_at)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Last session</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Detail label="Grade / Std" value={student.std} />
            <Detail label="Gender" value={student.gender} />
            <Detail label="Area" value={student.area} />
            <Detail label="School" value={student.school} />
            <Detail label="Contact" value={student.contact} />
            <Detail label="Intake date" value={formatDate(student.created_at)} />
          </div>

          {student.notes && (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
              <p className="text-xs text-[var(--muted-foreground)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap">{student.notes}</p>
            </div>
          )}

          {admin && <AdminControls student={student} onChanged={load} onChangeMentor={() => setShowAssign(true)} />}

          {student.assignments.length > 0 && (
            <>
              <h2 className="mt-8 flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
                <History className="h-4 w-4" />
                Assignment history
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {student.assignments.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="pt-4 text-sm">
                      <p>
                        <span className="text-[var(--muted-foreground)]">{a.from_mentor_name ?? "Unassigned"}</span>
                        {" → "}
                        <span className="font-medium">{a.to_mentor_name ?? "Unassigned"}</span>
                      </p>
                      {a.reason && <p className="mt-1 text-[var(--muted-foreground)]">“{a.reason}”</p>}
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDate(a.created_at)}
                        {a.by_username ? ` · by ${a.by_username}` : ""}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          <h2 className="mt-8 text-sm font-semibold text-[var(--foreground)]">Session history</h2>
          <div className="mt-3 flex flex-col gap-3">
            {student.sessions.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">No sessions yet.</p>
            )}
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
                        {s.mentor_name} · {s.audio_filename}
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

      {student && showAssign && (
        <AssignMenteeDialog
          student={{
            id: student.id,
            name: student.name,
            primary_mentor_id: student.primary_mentor_id,
            mentor_name: student.mentor_name,
          }}
          onClose={() => setShowAssign(false)}
          onDone={() => {
            setShowAssign(false)
            load()
          }}
        />
      )}

      {student && showEdit && (
        <EditMenteeDialog
          student={student}
          onClose={() => setShowEdit(false)}
          onDone={() => {
            setShowEdit(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 font-medium">{value || "—"}</p>
    </div>
  )
}

function AdminControls({
  student,
  onChanged,
  onChangeMentor,
}: {
  student: StudentDetail
  onChanged: () => void
  onChangeMentor: () => void
}) {
  const toast = useToast()
  const [savingStatus, setSavingStatus] = useState(false)
  const [optimisticStatus, setOptimisticStatus] = useState<MenteeStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function changeStatus(next: MenteeStatus) {
    const previous = student.status
    setOptimisticStatus(next) // reflect the choice instantly
    setSavingStatus(true)
    setError(null)
    try {
      await updateStudent(student.id, { status: next })
      toast("Status updated")
      onChanged()
    } catch (err) {
      setOptimisticStatus(previous) // roll back
      setError(err instanceof ApiError ? err.message : "Could not update status.")
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:gap-6">
        <div className="flex flex-col gap-1.5">
          <Label>
            Status
            {savingStatus && <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">Saving…</span>}
          </Label>
          <Select
            value={optimisticStatus ?? student.status}
            disabled={savingStatus}
            onChange={(e) => changeStatus(e.target.value as MenteeStatus)}
            className="sm:w-48"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Mentor</Label>
          <div className="flex items-center gap-3">
            <span className="text-sm">{student.mentor_name ?? "Unassigned"}</span>
            <Button variant="outline" size="sm" onClick={onChangeMentor}>
              Change mentor
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      </CardContent>
    </Card>
  )
}
