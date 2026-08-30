import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, CalendarDays, FileAudio, History, User2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { StatusBadge, MenteeStatusBadge, Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { isAdmin } from "@/lib/auth"
import {
  ApiError,
  getStudent,
  listMentors,
  reassignStudent,
  updateStudent,
  type MenteeStatus,
  type MentorSummary,
  type StudentDetail,
} from "@/lib/api"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

const STATUSES: MenteeStatus[] = ["active", "paused", "graduated", "dropped"]

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const admin = isAdmin()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (!id) return
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

      {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}

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
              <div className="flex gap-6 sm:gap-8">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{student.analysis_count}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Sessions</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{formatDate(student.last_analysis_at)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Last session</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Detail label="Grade / Std" value={student.std} />
            <Detail label="Gender" value={student.gender} />
            <Detail label="Area" value={student.area} />
            <Detail label="School" value={student.school} />
            <Detail label="Contact" value={student.contact} />
          </div>

          {admin && <AdminControls student={student} onChanged={load} />}

          {student.assignments.length > 0 && (
            <>
              <h2 className="mt-8 flex items-center gap-1.5 text-sm font-semibold text-[var(--muted-foreground)]">
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

          <h2 className="mt-8 text-sm font-semibold text-[var(--muted-foreground)]">Session history</h2>
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

function AdminControls({ student, onChanged }: { student: StudentDetail; onChanged: () => void }) {
  const [mentors, setMentors] = useState<MentorSummary[]>([])
  const [mentorId, setMentorId] = useState(student.primary_mentor_id ?? "")
  const [reason, setReason] = useState("")
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingMentor, setSavingMentor] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMentors().then(setMentors).catch(() => setMentors([]))
  }, [])

  const dirty = mentorId !== (student.primary_mentor_id ?? "")

  async function saveAssignment() {
    if (!dirty || reason.trim().length < 3) return
    setSavingMentor(true)
    setError(null)
    try {
      await reassignStudent(student.id, mentorId || null, reason.trim())
      setReason("")
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reassign.")
    } finally {
      setSavingMentor(false)
    }
  }

  async function changeStatus(next: MenteeStatus) {
    setSavingStatus(true)
    setError(null)
    try {
      await updateStudent(student.id, { status: next })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.")
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select
            value={student.status}
            loading={savingStatus}
            onChange={(e) => changeStatus(e.target.value as MenteeStatus)}
            className="sm:w-48"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Mentor</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={mentorId} onChange={(e) => setMentorId(e.target.value)} className="sm:w-56">
              <option value="">Unassigned</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.area ? ` · ${m.area}` : ""}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Reason for the change"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="sm:flex-1"
              disabled={!dirty}
            />
            <Button
              variant="accent"
              disabled={!dirty || savingMentor || reason.trim().length < 3}
              onClick={saveAssignment}
            >
              {savingMentor ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      </CardContent>
    </Card>
  )
}
