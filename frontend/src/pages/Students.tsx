import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search, Users, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge, MenteeStatusBadge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LOCATIONS } from "@/lib/locations"
import { isAdmin } from "@/lib/auth"
import {
  ApiError,
  createStudent,
  listMentors,
  listStudents,
  type Gender,
  type MenteeStatus,
  type MentorSummary,
  type StudentSummary,
} from "@/lib/api"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

const STATUS_OPTIONS: { value: MenteeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "graduated", label: "Graduated" },
  { value: "dropped", label: "Dropped" },
]

export default function Students() {
  const admin = isAdmin()
  const [students, setStudents] = useState<StudentSummary[] | null>(null)
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [mentorId, setMentorId] = useState("")
  const [status, setStatus] = useState<MenteeStatus | "">("")
  const [mentors, setMentors] = useState<MentorSummary[]>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!admin) return
    setMentorId("")
    if (!location) {
      setMentors([])
      return
    }
    listMentors(undefined, location)
      .then(setMentors)
      .catch(() => setMentors([]))
  }, [location, admin])

  function reload() {
    setStudents(null)
    listStudents({
      query: query || undefined,
      area: admin && !mentorId ? location || undefined : undefined,
      mentorId: admin ? mentorId || undefined : undefined,
      status: status || undefined,
    }).then(setStudents)
  }

  useEffect(() => {
    const handle = setTimeout(reload, 200)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, location, mentorId, status, admin])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{admin ? "Mentees" : "My Mentees"}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {admin ? "Every mentee across the programme." : "The mentees assigned to you."}
          </p>
        </div>
        <Button variant="accent" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add mentee
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search mentees…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as MenteeStatus | "")}
          className="sm:w-36"
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {admin && (
          <>
            <Select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="sm:w-40"
              aria-label="Filter by location"
            >
              <option value="">All locations</option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
            <Select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className="sm:w-48"
              disabled={!location}
              aria-label="Filter by mentor"
            >
              <option value="">All mentors</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>

      <Card className="mt-4 overflow-hidden">
        {students === null && (
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3.5 w-24" />
              </li>
            ))}
          </ul>
        )}

        {students && students.length === 0 && (
          <EmptyState
            icon={Users}
            title={query || status || location ? "No mentees match" : "No mentees yet"}
            description={
              query || status || location ? "Try a different filter." : "Add your first mentee to get started."
            }
            action={
              <Button variant="accent" size="sm" onClick={() => setShowAdd(true)}>
                Add mentee
              </Button>
            }
          />
        )}

        {students && students.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  <th className="px-6 py-3 font-medium">Mentee</th>
                  <th className="px-6 py-3 font-medium">Mentor</th>
                  {admin && <th className="px-6 py-3 font-medium">Location</th>}
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Sessions</th>
                  <th className="px-6 py-3 font-medium">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {students.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-[var(--muted)]">
                    <td className="px-6 py-3.5">
                      <Link to={`/students/${s.id}`} className="font-medium text-[var(--foreground)] hover:underline">
                        {s.name}
                      </Link>
                      {s.std && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{s.std}</span>}
                    </td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">
                      {s.mentor_name ?? <span className="text-[var(--destructive)]">Unassigned</span>}
                    </td>
                    {admin && (
                      <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{s.area ?? s.mentor_area ?? "—"}</td>
                    )}
                    <td className="px-6 py-3.5">
                      <span className="flex items-center gap-1.5">
                        <MenteeStatusBadge status={s.status} />
                        {s.overdue && <Badge variant="warning">Overdue</Badge>}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{s.analysis_count}</td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{formatDate(s.last_analysis_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <AddMenteeDialog
          admin={admin}
          mentors={mentors}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function AddMenteeDialog({
  admin,
  mentors,
  onClose,
  onCreated,
}: {
  admin: boolean
  mentors: MentorSummary[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [gender, setGender] = useState<Gender | "">("")
  const [std, setStd] = useState("")
  const [school, setSchool] = useState("")
  const [contact, setContact] = useState("")
  const [area, setArea] = useState("")
  const [mentorId, setMentorId] = useState("")
  const [allMentors, setAllMentors] = useState<MentorSummary[]>(mentors)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (admin && allMentors.length === 0) {
      listMentors().then(setAllMentors).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createStudent({
        name: name.trim(),
        gender: gender || null,
        std: std.trim() || null,
        school: school.trim() || null,
        contact: contact.trim() || null,
        area: area.trim() || null,
        primary_mentor_id: admin && mentorId ? mentorId : undefined,
        assignment_reason: admin && mentorId ? "Assigned on intake" : undefined,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the mentee.")
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add mentee</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-gender">Gender</Label>
              <Select id="s-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-std">Grade / Std</Label>
              <Input id="s-std" value={std} onChange={(e) => setStd(e.target.value)} placeholder="9th" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-school">School (optional)</Label>
            <Input id="s-school" value={school} onChange={(e) => setSchool(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-contact">Contact (optional)</Label>
              <Input id="s-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-area">Area (optional)</Label>
              <Select id="s-area" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">—</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {admin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-mentor">Assign mentor (optional)</Label>
              <Select id="s-mentor" value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
                <option value="">Leave unassigned</option>
                {allMentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.area ? ` · ${m.area}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Cancel
            </button>
            <Button type="submit" variant="accent" size="sm" disabled={busy || !name.trim()}>
              {busy ? "Adding…" : "Add mentee"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
