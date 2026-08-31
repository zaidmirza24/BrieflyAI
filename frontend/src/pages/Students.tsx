import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge, MenteeStatusBadge } from "@/components/ui/badge"
import { AddMenteeWizard } from "@/components/onboarding/AddMenteeWizard"
import { AssignMenteeDialog } from "@/components/AssignMenteeDialog"
import { LOCATIONS } from "@/lib/locations"
import { isAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { usePageTitle } from "@/lib/usePageTitle"
import { listMentors, listStudents, type MenteeStatus, type MentorSummary, type StudentSummary } from "@/lib/api"

const STATUS_OPTIONS: { value: MenteeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "graduated", label: "Graduated" },
  { value: "dropped", label: "Dropped" },
]

export default function Students() {
  usePageTitle(isAdmin() ? "Mentees" : "My Mentees")
  const admin = isAdmin()
  const [students, setStudents] = useState<StudentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [mentorId, setMentorId] = useState("")
  const [status, setStatus] = useState<MenteeStatus | "">("")
  const [mentors, setMentors] = useState<MentorSummary[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [assigning, setAssigning] = useState<StudentSummary | null>(null)

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
    // Keep the current rows visible while refiltering; only the first load
    // (students === null) shows the skeleton.
    setError(null)
    listStudents({
      query: query || undefined,
      area: admin && !mentorId ? location || undefined : undefined,
      mentorId: admin ? mentorId || undefined : undefined,
      status: status || undefined,
    })
      .then(setStudents)
      .catch(() => setError("Could not load mentees."))
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
        {error && <ErrorState description={error} onRetry={reload} />}

        {!error && students === null && (
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3.5 w-24" />
              </li>
            ))}
          </ul>
        )}

        {!error && students && students.length === 0 && (
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

        {!error && students && students.length > 0 && (
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
                  {admin && <th className="px-6 py-3 font-medium" />}
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
                    {admin && (
                      <td className="px-6 py-3.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setAssigning(s)}>
                          {s.primary_mentor_id ? "Reassign" : "Assign"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <AddMenteeWizard
          admin={admin}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            reload()
          }}
        />
      )}

      {assigning && (
        <AssignMenteeDialog
          student={{
            id: assigning.id,
            name: assigning.name,
            primary_mentor_id: assigning.primary_mentor_id,
            mentor_name: assigning.mentor_name,
          }}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
