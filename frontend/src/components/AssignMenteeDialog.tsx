import { useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { ApiError, listMentors, reassignStudent, type MentorAdmin } from "@/lib/api"

export function AssignMenteeDialog({
  student,
  mode = "reassign",
  onClose,
  onDone,
}: {
  student: { id: string; name: string; primary_mentor_id: string | null; mentor_name: string | null }
  mode?: "reassign" | "unassign"
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [mentors, setMentors] = useState<MentorAdmin[]>([])
  const [mentorId, setMentorId] = useState(mode === "unassign" ? "" : student.primary_mentor_id ?? "")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMentors().then(setMentors).catch(() => setMentors([]))
  }, [])

  const target = useMemo(() => mentors.find((m) => m.id === mentorId) ?? null, [mentors, mentorId])
  const dirty = mentorId !== (student.primary_mentor_id ?? "")
  const overCapacity = !!target && target.capacity != null && target.mentee_count >= target.capacity
  const canSave = dirty && !busy && reason.trim().length >= 3

  async function submit() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      await reassignStudent(student.id, mentorId || null, reason.trim())
      toast(
        mentorId
          ? `${student.name} assigned to ${target?.name ?? "mentor"}`
          : `${student.name} returned to the unassigned queue`,
      )
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the assignment.")
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={mode === "unassign" ? `Unassign ${student.name}` : `Change mentor — ${student.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" size="sm" disabled={!canSave} onClick={submit}>
            {busy ? "Saving…" : "Save change"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md bg-[var(--muted)] px-2 py-1 text-[var(--muted-foreground)]">
            {student.mentor_name ?? "Unassigned"}
          </span>
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="rounded-md bg-[var(--accent-bg)] px-2 py-1 font-medium text-[var(--accent-strong)]">
            {mentorId ? target?.name ?? "…" : "Unassigned"}
          </span>
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-mentor">Mentor</Label>
          <Select id="assign-mentor" value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
            <option value="">Unassigned (return to queue)</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.area ? ` · ${m.area}` : ""} · {m.mentee_count}
                {m.capacity ? `/${m.capacity}` : ""}
              </option>
            ))}
          </Select>
          {overCapacity && (
            <p className="text-xs text-[var(--warning)]">
              {target?.name} is at or above their capacity ({target?.mentee_count}/{target?.capacity}).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-reason">Reason</Label>
          <Input
            id="assign-reason"
            placeholder="Why is this changing?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)]">Recorded in the mentee's assignment history.</p>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      </div>
    </Dialog>
  )
}
