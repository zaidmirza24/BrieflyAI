import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FileAudio, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge, STATUS_LABEL } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import { LOCATIONS } from "@/lib/locations"
import { isAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { usePageTitle } from "@/lib/usePageTitle"
import {
  listMentors,
  listSessions,
  type MentorAdmin,
  type Page,
  type SessionStatus,
  type SessionSummary,
} from "@/lib/api"

const PAGE_SIZE = 20
const STATUSES: SessionStatus[] = ["UPLOADED", "PROCESSING", "TRANSCRIBED", "ANALYZED", "SAVED", "AUDIO_DELETED", "FAILED"]

export default function Analyses() {
  usePageTitle("Analyses")
  const admin = isAdmin()
  const navigate = useNavigate()

  const [data, setData] = useState<Page<SessionSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SessionStatus | "">("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [location, setLocation] = useState("")
  const [mentorId, setMentorId] = useState("")
  const [mentors, setMentors] = useState<MentorAdmin[]>([])

  useEffect(() => {
    if (!admin) return
    setMentorId("")
    if (!location) {
      setMentors([])
      return
    }
    listMentors(undefined, location).then(setMentors).catch(() => setMentors([]))
  }, [location, admin])

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1)
  }, [query, status, dateFrom, dateTo, location, mentorId])

  useEffect(() => {
    let cancelled = false
    // On the very first load `data` is null → skeleton. On later filter changes
    // the previous page stays on screen until the new one arrives.
    if (data === null) setError(null)
    const handle = setTimeout(() => {
      listSessions({
        page,
        pageSize: PAGE_SIZE,
        q: query || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        area: admin && !mentorId ? location || undefined : undefined,
        mentorId: admin ? mentorId || undefined : undefined,
      })
        .then((res) => {
          if (cancelled) return
          setData(res)
          setError(null)
        })
        .catch(() => {
          if (!cancelled) setError("Could not load analyses.")
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, status, dateFrom, dateTo, location, mentorId, admin, nonce])

  const filtersActive = !!(query || status || dateFrom || dateTo || location || mentorId)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyses</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {admin ? "Every mentoring call analysed across the programme." : "Every recording you've analysed."}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search mentee or filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as SessionStatus | "")}
          className="sm:w-40"
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </Select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
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

      {data && (
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          {data.total} {data.total === 1 ? "analysis" : "analyses"}
        </p>
      )}

      <Card className="mt-2 overflow-hidden">
        {error && data === null && (
          <ErrorState description={error} onRetry={() => setNonce((n) => n + 1)} />
        )}

        {!error && data === null && (
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-24" />
              </li>
            ))}
          </ul>
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            icon={FileAudio}
            title={filtersActive ? "No analyses match" : "No analyses yet"}
            description={filtersActive ? "Try a different filter." : "Analyse a recording to see it here."}
          />
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  <th className="px-6 py-3 font-medium">Mentee</th>
                  <th className="px-6 py-3 font-medium">Mentor</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Recording</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.items.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/analyses/${s.id}`)}
                    className="cursor-pointer transition-colors hover:bg-[var(--muted)]"
                  >
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/students/${s.student_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-[var(--foreground)] hover:underline"
                      >
                        {s.student_name}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{s.mentor_name}</td>
                    <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{formatDate(s.created_at)}</td>
                    <td className="max-w-[16rem] truncate px-6 py-3.5 text-[var(--muted-foreground)]">
                      {s.audio_filename}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} onPage={setPage} className="mt-6" />
      )}
    </div>
  )
}
