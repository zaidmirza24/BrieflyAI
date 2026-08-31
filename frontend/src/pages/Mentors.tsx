import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { IdCard, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CredentialCard } from "@/components/mentors/MentorLogin"
import { AddMentorWizard } from "@/components/onboarding/AddMentorWizard"
import { LOCATIONS } from "@/lib/locations"
import { listMentors, type MentorAccount, type MentorAdmin } from "@/lib/api"

export default function Mentors() {
  const [mentors, setMentors] = useState<MentorAdmin[] | null>(null)
  const [query, setQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [credential, setCredential] = useState<MentorAccount | null>(null)

  function reload() {
    listMentors(query || undefined, locationFilter || undefined)
      .then(setMentors)
      .catch(() => setError("Could not load mentors."))
  }

  useEffect(() => {
    setMentors(null)
    const handle = setTimeout(reload, 200)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locationFilter])

  const withoutLogin = useMemo(() => mentors?.filter((m) => !m.account_username).length ?? 0, [mentors])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentors</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Manage mentors, their location, and their sign-in access.
            {mentors && withoutLogin > 0 ? ` ${withoutLogin} without a login.` : ""}
          </p>
        </div>
        <Button variant="accent" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add mentor
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}
      {credential && <CredentialCard account={credential} onDismiss={() => setCredential(null)} />}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input placeholder="Search mentors…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
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
      </div>

      {mentors === null && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="mt-4 h-2 w-full" />
            </Card>
          ))}
        </div>
      )}

      {mentors && mentors.length === 0 && (
        <Card className="mt-4">
          <EmptyState
            icon={IdCard}
            title={query || locationFilter ? "No mentors match" : "No mentors yet"}
            description={query || locationFilter ? "Try a different filter." : "Add your first mentor to get started."}
          />
        </Card>
      )}

      {mentors && mentors.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => (
            <MentorCard key={m.id} mentor={m} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddMentorWizard
          onClose={() => setShowAdd(false)}
          onCreated={(cred) => {
            setShowAdd(false)
            reload()
            if (cred) setCredential(cred)
          }}
        />
      )}
    </div>
  )
}

function MentorCard({ mentor }: { mentor: MentorAdmin }) {
  const cap = mentor.capacity ?? null
  const ratio = cap ? mentor.mentee_count / cap : 0
  return (
    <Link to={`/mentors/${mentor.id}`}>
      <Card className="flex h-full flex-col gap-4 p-4 transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)]/30">
        <div className="flex items-start gap-3">
          <Avatar name={mentor.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{mentor.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{mentor.area ?? "No location"}</p>
          </div>
          {mentor.account_username ? (
            <Badge variant="success">Login</Badge>
          ) : (
            <Badge variant="warning">No login</Badge>
          )}
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Mentees</span>
            <span>
              {mentor.mentee_count}
              {cap ? ` / ${cap}` : " · no cap"}
            </span>
          </div>
          {cap ? (
            <Progress value={ratio} className="mt-1.5" />
          ) : (
            <div className="mt-1.5 h-2 w-full rounded-full bg-[var(--muted)]" />
          )}
        </div>

        {mentor.contact && <p className="text-xs text-[var(--muted-foreground)]">{mentor.contact}</p>}
      </Card>
    </Link>
  )
}
