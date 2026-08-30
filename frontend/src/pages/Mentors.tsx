import { useEffect, useMemo, useState } from "react"
import { Check, Copy, IdCard, KeyRound, Plus, Search, UserPlus, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { LOCATIONS } from "@/lib/locations"
import {
  ApiError,
  createMentor,
  createMentorAccount,
  listMentors,
  resetMentorAccount,
  updateMentor,
  type MentorAccount,
  type MentorAdmin,
} from "@/lib/api"

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CredentialCard({ account, onDismiss }: { account: MentorAccount; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)
  const line = `username: ${account.username}\npassword: ${account.temp_password}`
  return (
    <Card className="mt-4 border-[var(--success)] bg-[var(--success)]/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Login created — copy it now</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            This password is shown once and is not stored. Hand it to the mentor over a private channel.
          </p>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm">
            <span className="text-[var(--muted-foreground)]">username</span>
            <span>{account.username}</span>
            <span className="text-[var(--muted-foreground)]">password</span>
            <span>{account.temp_password}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(line)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default function Mentors() {
  const [mentors, setMentors] = useState<MentorAdmin[] | null>(null)
  const [query, setQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [accountFor, setAccountFor] = useState<MentorAdmin | null>(null)
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

      <Card className="mt-4 overflow-hidden">
        {mentors === null && (
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-6 py-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
              </li>
            ))}
          </ul>
        )}

        {mentors && mentors.length === 0 && (
          <EmptyState
            icon={IdCard}
            title={query || locationFilter ? "No mentors match" : "No mentors yet"}
            description={query || locationFilter ? "Try a different filter." : "Add your first mentor to get started."}
          />
        )}

        {mentors && mentors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  <th className="px-6 py-3 font-medium">Mentor</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Mentees</th>
                  <th className="px-6 py-3 font-medium">Login</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {mentors.map((m) => (
                  <MentorRow
                    key={m.id}
                    mentor={m}
                    onChanged={reload}
                    onProvision={() => setAccountFor(m)}
                    onReset={async () => {
                      try {
                        setCredential(await resetMentorAccount(m.id))
                      } catch (err) {
                        setError(err instanceof ApiError ? err.message : "Could not reset the password.")
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <AddMentorDialog
          onClose={() => setShowAdd(false)}
          onCreated={(cred) => {
            setShowAdd(false)
            reload()
            if (cred) setCredential(cred)
          }}
        />
      )}

      {accountFor && (
        <ProvisionLoginDialog
          mentor={accountFor}
          onClose={() => setAccountFor(null)}
          onCreated={(acc) => {
            setAccountFor(null)
            setCredential(acc)
            reload()
          }}
        />
      )}
    </div>
  )
}

function MentorRow({
  mentor,
  onChanged,
  onProvision,
  onReset,
}: {
  mentor: MentorAdmin
  onChanged: () => void
  onProvision: () => void
  onReset: () => void
}) {
  const [savingArea, setSavingArea] = useState(false)
  const knownLocations = LOCATIONS.includes(mentor.area as (typeof LOCATIONS)[number])
    ? LOCATIONS
    : [...LOCATIONS, mentor.area].filter(Boolean) as string[]

  return (
    <tr className="align-middle transition-colors hover:bg-[var(--muted)]">
      <td className="px-6 py-3.5">
        <p className="font-medium text-[var(--foreground)]">{mentor.name}</p>
        {mentor.contact && <p className="text-xs text-[var(--muted-foreground)]">{mentor.contact}</p>}
      </td>
      <td className="px-6 py-3.5">
        <Select
          value={mentor.area ?? ""}
          loading={savingArea}
          aria-label={`Location for ${mentor.name}`}
          className="h-9 w-36"
          onChange={async (e) => {
            setSavingArea(true)
            try {
              await updateMentor(mentor.id, { area: e.target.value })
              onChanged()
            } finally {
              setSavingArea(false)
            }
          }}
        >
          {knownLocations.map((loc) => (
            <option key={loc} value={loc as string}>
              {loc}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{mentor.mentee_count}</td>
      <td className="px-6 py-3.5">
        {mentor.account_username ? (
          <span className="font-mono text-xs text-[var(--foreground)]">{mentor.account_username}</span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">No login</span>
        )}
      </td>
      <td className="px-6 py-3.5 text-right">
        {mentor.account_username ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            <KeyRound className="h-3.5 w-3.5" />
            Reset password
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onProvision}>
            <UserPlus className="h-3.5 w-3.5" />
            Create login
          </Button>
        )}
      </td>
    </tr>
  )
}

function slugFromName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32)
}

function AddMentorDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (credential?: MentorAccount) => void
}) {
  const [name, setName] = useState("")
  const [area, setArea] = useState(LOCATIONS[0] as string)
  const [contact, setContact] = useState("")
  const [education, setEducation] = useState("")
  const [username, setUsername] = useState("")
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep the username in sync with the name until the admin edits it directly.
  const effectiveUsername = usernameEdited ? username : slugFromName(name)
  const wantsLogin = effectiveUsername.length > 0 || password.length > 0
  const loginIncomplete = wantsLogin && (effectiveUsername.length < 3 || password.length < 8)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await createMentor({
        name: name.trim(),
        area,
        contact: contact.trim() || null,
        education: education.trim() || null,
        username: wantsLogin ? effectiveUsername : undefined,
        password: wantsLogin ? password : undefined,
      })
      onCreated(created.account ?? undefined)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the mentor.")
      setBusy(false)
    }
  }

  return (
    <Overlay title="Add mentor" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-name">Name</Label>
          <Input id="m-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-area">Location</Label>
          <Select id="m-area" value={area} onChange={(e) => setArea(e.target.value)}>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-contact">Contact (optional)</Label>
          <Input id="m-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-edu">Education (optional)</Label>
          <Input id="m-edu" value={education} onChange={(e) => setEducation(e.target.value)} />
        </div>

        <div className="mt-1 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            Login (optional — leave blank to add later)
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-user">Username</Label>
              <Input
                id="m-user"
                value={effectiveUsername}
                onChange={(e) => {
                  setUsernameEdited(true)
                  setUsername(e.target.value)
                }}
                placeholder="jane.doe"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-pass">Password</Label>
              <PasswordInput
                id="m-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Cancel
          </button>
          <Button type="submit" variant="accent" size="sm" disabled={busy || !name.trim() || loginIncomplete}>
            {busy ? "Adding…" : "Add mentor"}
          </Button>
        </div>
      </form>
    </Overlay>
  )
}

function ProvisionLoginDialog({
  mentor,
  onClose,
  onCreated,
}: {
  mentor: MentorAdmin
  onClose: () => void
  onCreated: (acc: MentorAccount) => void
}) {
  const suggested = mentor.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32)
  const [username, setUsername] = useState(suggested)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordInvalid = password.length > 0 && password.length < 8

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await createMentorAccount(mentor.id, username.trim(), password || undefined))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the login.")
      setBusy(false)
    }
  }

  return (
    <Overlay title={`Create login — ${mentor.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-user">Username</Label>
          <Input id="acc-user" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
          <p className="text-xs text-[var(--muted-foreground)]">
            3–32 characters: letters, digits, dot, dash, underscore.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-pass">Password</Label>
          <PasswordInput
            id="acc-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to generate one"
            autoComplete="new-password"
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            At least 8 characters. If left blank, a one-time password is generated on save.
          </p>
        </div>
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Cancel
          </button>
          <Button
            type="submit"
            variant="accent"
            size="sm"
            disabled={busy || username.trim().length < 3 || passwordInvalid}
          >
            {busy ? "Creating…" : "Create login"}
          </Button>
        </div>
      </form>
    </Overlay>
  )
}
