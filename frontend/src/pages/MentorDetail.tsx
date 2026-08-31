import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, KeyRound, Pencil, Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { Avatar } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Badge, MenteeStatusBadge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { CredentialCard, ProvisionLoginDialog } from "@/components/mentors/MentorLogin"
import { EditMentorDialog } from "@/components/mentors/EditMentorDialog"
import { AssignMenteeDialog } from "@/components/AssignMenteeDialog"
import { formatDate } from "@/lib/utils"
import { usePageTitle } from "@/lib/usePageTitle"
import {
  ApiError,
  getMentor,
  listStudents,
  resetMentorAccount,
  type MentorAccount,
  type MentorAdmin,
  type StudentSummary,
} from "@/lib/api"

export default function MentorDetail() {
  const { id } = useParams<{ id: string }>()
  const [mentor, setMentor] = useState<MentorAdmin | null>(null)
  const [roster, setRoster] = useState<StudentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credential, setCredential] = useState<MentorAccount | null>(null)
  const [showProvision, setShowProvision] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [assigning, setAssigning] = useState<{ student: StudentSummary; mode: "reassign" | "unassign" } | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setError(null)
    getMentor(id).then(setMentor).catch(() => setError("Could not load this mentor."))
    listStudents({ mentorId: id }).then(setRoster).catch(() => setRoster([]))
  }, [id])

  useEffect(load, [load])

  usePageTitle(mentor?.name ?? "Mentor")

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <Link
        to="/mentors"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Mentors
      </Link>

      {error && (
        <Card className="mt-4">
          <ErrorState description={error} onRetry={load} />
        </Card>
      )}
      {credential && <CredentialCard account={credential} onDismiss={() => setCredential(null)} />}

      {!mentor && !error && (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-3 pt-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-32" />
          </CardContent>
        </Card>
      )}

      {mentor && (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-5 pt-6">
              <div className="flex items-start gap-4">
                <Avatar name={mentor.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold">{mentor.name}</h1>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {mentor.education || "Mentor"}
                    {mentor.contact ? ` · ${mentor.contact}` : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Info label="Location" value={mentor.area ?? "—"} />
                <Info label="Gender" value={mentor.gender ?? "—"} />
                <Info label="Contact" value={mentor.contact ?? "—"} />
                <Info label="Education" value={mentor.education ?? "—"} />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>Active mentees</span>
                  <span>
                    {mentor.mentee_count}
                    {mentor.capacity ? ` / ${mentor.capacity}` : " · no cap"}
                  </span>
                </div>
                <Progress value={mentor.capacity ? mentor.mentee_count / mentor.capacity : 0} />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
                <span className="text-sm text-[var(--muted-foreground)]">Login</span>
                {mentor.account_username ? (
                  <>
                    <Badge variant="success">{mentor.account_username}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setCredential(await resetMentorAccount(mentor.id))
                        } catch (err) {
                          setError(err instanceof ApiError ? err.message : "Could not reset the password.")
                        }
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset password
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowProvision(true)}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Create login
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <h2 className="mt-8 flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
            <Users className="h-4 w-4" />
            Mentees ({roster?.length ?? 0})
          </h2>

          <Card className="mt-3 overflow-hidden">
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
              <EmptyState icon={Users} title="No mentees assigned" description="Assign mentees from the Assignments page." />
            )}
            {roster && roster.length > 0 && (
              <>
                {/* Mobile: stacked cards. Desktop (sm+): full table. */}
                <ul className="divide-y divide-[var(--border)] sm:hidden">
                  {roster.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/students/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                          {s.std && (
                            <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">{s.std}</span>
                          )}
                        </Link>
                        <MenteeStatusBadge status={s.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                        {s.school && <span className="truncate">{s.school}</span>}
                        <span>Last: {formatDate(s.last_analysis_at)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAssigning({ student: s, mode: "reassign" })}>
                          Reassign
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setAssigning({ student: s, mode: "unassign" })}>
                          Unassign
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      <th className="px-6 py-3 font-medium">Mentee</th>
                      <th className="px-6 py-3 font-medium">Grade</th>
                      <th className="px-6 py-3 font-medium">School</th>
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
                        <td className="max-w-[12rem] truncate px-6 py-3.5 text-[var(--muted-foreground)]">
                          {s.school ?? "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="flex items-center gap-1.5">
                            <MenteeStatusBadge status={s.status} />
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[var(--muted-foreground)]">{formatDate(s.last_analysis_at)}</td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssigning({ student: s, mode: "reassign" })}
                            >
                              Reassign
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssigning({ student: s, mode: "unassign" })}
                            >
                              Unassign
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {showProvision && mentor && (
        <ProvisionLoginDialog
          mentor={mentor}
          onClose={() => setShowProvision(false)}
          onCreated={(acc) => {
            setShowProvision(false)
            setCredential(acc)
            load()
          }}
        />
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
            load()
          }}
        />
      )}

      {showEdit && mentor && (
        <EditMentorDialog
          mentor={mentor}
          onClose={() => setShowEdit(false)}
          onDone={(updated) => {
            setShowEdit(false)
            setMentor(updated)
          }}
        />
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  )
}
