import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, PauseCircle, UserRoundPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { MenteeStatusBadge, Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { AssignMenteeDialog } from "@/components/AssignMenteeDialog"
import { LOCATIONS } from "@/lib/locations"
import {
  ApiError,
  bulkAssignStudents,
  getAttentionSummary,
  listMentors,
  listStudents,
  type AttentionSummary,
  type MentorAdmin,
  type StudentSummary,
} from "@/lib/api"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: number | null
  tone: "default" | "warning" | "danger"
}) {
  const color =
    tone === "danger"
      ? "text-[var(--destructive)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : "text-[var(--foreground)]"
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--muted)]">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <p className={`text-xl font-semibold tracking-tight ${color}`}>{value === null ? "—" : value}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      </div>
    </Card>
  )
}

export default function Assignments() {
  const [mode, setMode] = useState<"queue" | "by-mentor">("queue")
  const [attention, setAttention] = useState<AttentionSummary | null>(null)

  function loadAttention() {
    getAttentionSummary().then(setAttention).catch(() => setAttention(null))
  }
  useEffect(loadAttention, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 pb-28">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Place unassigned mentees, or move mentees between mentors. Every change is recorded with a reason.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={UserRoundPlus} label="Unassigned" value={attention?.unassigned ?? null} tone="danger" />
        <StatCard icon={AlertTriangle} label="Overdue for a session" value={attention?.overdue ?? null} tone="warning" />
        <StatCard icon={PauseCircle} label="Paused" value={attention?.paused ?? null} tone="default" />
      </div>

      <div className="mt-6 inline-flex rounded-lg border border-[var(--border)] p-0.5 text-sm">
        {(["queue", "by-mentor"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === m
                ? "bg-[var(--accent-bg)] text-[var(--accent-strong)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
          >
            {m === "queue" ? "Unassigned queue" : "By mentor"}
          </button>
        ))}
      </div>

      {mode === "queue" ? (
        <UnassignedQueue onChanged={loadAttention} />
      ) : (
        <ByMentor onChanged={loadAttention} />
      )}
    </div>
  )
}

function UnassignedQueue({ onChanged }: { onChanged: () => void }) {
  const toast = useToast()
  const [queue, setQueue] = useState<StudentSummary[] | null>(null)
  const [location, setLocation] = useState("")
  const [mentors, setMentors] = useState<MentorAdmin[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mentorId, setMentorId] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    setQueue(null)
    listStudents({ unassigned: true, area: location || undefined })
      .then(setQueue)
      .catch(() => setError("Could not load the unassigned queue."))
    onChanged()
  }

  useEffect(reload, [location])

  useEffect(() => {
    setMentorId("")
    if (!location) {
      setMentors([])
      return
    }
    listMentors(undefined, location).then(setMentors).catch(() => setMentors([]))
  }, [location])

  useEffect(() => {
    if (!queue) return
    const ids = new Set(queue.map((s) => s.id))
    setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))))
  }, [queue])

  const allSelected = useMemo(
    () => !!queue && queue.length > 0 && queue.every((s) => selected.has(s.id)),
    [queue, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function assign() {
    if (!mentorId || selected.size === 0 || reason.trim().length < 3) return
    setBusy(true)
    setError(null)
    try {
      const res = await bulkAssignStudents([...selected], mentorId, reason.trim())
      toast(
        `Assigned ${res.assigned} mentee${res.assigned === 1 ? "" : "s"}` +
          (res.skipped.length ? `, skipped ${res.skipped.length}` : ""),
      )
      setSelected(new Set())
      setReason("")
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign the mentees.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="sm:w-48"
          aria-label="Filter by location"
        >
          <option value="">All locations</option>
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </Select>
      </div>

      <Card className="mt-4 overflow-hidden">
        {queue === null && (
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-40" />
              </li>
            ))}
          </ul>
        )}

        {queue && queue.length === 0 && (
          <EmptyState
            icon={Users}
            title="Nothing waiting"
            description={location ? `Every mentee in ${location} has a mentor.` : "Every mentee has a mentor."}
          />
        )}

        {queue && queue.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set(queue.map((s) => s.id)) : new Set())}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Mentee</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {queue.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-[var(--muted)]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.name}`}
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/students/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{s.std ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{s.area ?? "—"}</td>
                  <td className="px-4 py-3">
                    <MenteeStatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className="sm:w-56"
              aria-label="Assign to mentor"
            >
              <option value="">{location ? "Select a mentor" : "Pick a location first"}</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.mentee_count}
                  {m.capacity ? `/${m.capacity}` : ""}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="sm:flex-1"
            />
            <Button variant="accent" disabled={busy || !mentorId || reason.trim().length < 3} onClick={assign}>
              {busy ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function ByMentor({ onChanged }: { onChanged: () => void }) {
  const [location, setLocation] = useState("")
  const [mentors, setMentors] = useState<MentorAdmin[]>([])
  const [mentorId, setMentorId] = useState("")
  const [roster, setRoster] = useState<StudentSummary[] | null>(null)
  const [assigning, setAssigning] = useState<{ student: StudentSummary; mode: "reassign" | "unassign" } | null>(null)

  useEffect(() => {
    setMentorId("")
    setRoster(null)
    if (!location) {
      setMentors([])
      return
    }
    listMentors(undefined, location).then(setMentors).catch(() => setMentors([]))
  }, [location])

  function loadRoster() {
    if (!mentorId) {
      setRoster(null)
      return
    }
    setRoster(null)
    listStudents({ mentorId }).then(setRoster).catch(() => setRoster([]))
  }
  useEffect(loadRoster, [mentorId])

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={location} onChange={(e) => setLocation(e.target.value)} className="sm:w-48" aria-label="Location">
          <option value="">Select a location</option>
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </Select>
        <Select
          value={mentorId}
          onChange={(e) => setMentorId(e.target.value)}
          className="sm:w-56"
          disabled={!location}
          aria-label="Mentor"
        >
          <option value="">{location ? "Select a mentor" : "Pick a location first"}</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.mentee_count}
              {m.capacity ? `/${m.capacity}` : ""}
            </option>
          ))}
        </Select>
      </div>

      {mentorId && (
        <Card className="mt-4 overflow-hidden">
          {roster === null && (
            <ul className="divide-y divide-[var(--border)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="px-6 py-4">
                  <Skeleton className="h-4 w-40" />
                </li>
              ))}
            </ul>
          )}
          {roster && roster.length === 0 && (
            <EmptyState icon={Users} title="No mentees" description="This mentor has no mentees assigned." />
          )}
          {roster && roster.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-6 py-3 font-medium">Mentee</th>
                    <th className="px-6 py-3 font-medium">Grade</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Last session</th>
                    <th className="px-6 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {roster.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-[var(--muted)]">
                      <td className="px-6 py-3.5">
                        <Link to={`/students/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{s.std ?? "—"}</td>
                      <td className="px-6 py-3.5">
                        <span className="flex items-center gap-1.5">
                          <MenteeStatusBadge status={s.status} />
                          {s.overdue && <Badge variant="warning">Overdue</Badge>}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{formatDate(s.last_analysis_at)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setAssigning({ student: s, mode: "reassign" })}>
                            Reassign
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setAssigning({ student: s, mode: "unassign" })}>
                            Unassign
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {assigning && (
        <AssignMenteeDialog
          student={{
            id: assigning.student.id,
            name: assigning.student.name,
            primary_mentor_id: assigning.student.primary_mentor_id,
            mentor_name: assigning.student.mentor_name,
          }}
          mode={assigning.mode}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null)
            loadRoster()
            onChanged()
          }}
        />
      )}
    </>
  )
}
