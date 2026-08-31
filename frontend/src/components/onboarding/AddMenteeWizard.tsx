import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { WizardSteps, useWizard } from "@/components/ui/wizard"
import { useToast } from "@/components/ui/toast"
import { LOCATIONS } from "@/lib/locations"
import { ApiError, createStudent, listAllMentorsCached, type Gender, type MentorAdmin } from "@/lib/api"

const GENDER_LABEL: Record<string, string> = { M: "Male", F: "Female", O: "Other" }

export function AddMenteeWizard({
  admin,
  onClose,
  onCreated,
}: {
  admin: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useToast()
  const steps = admin ? ["Details", "Mentor", "Review"] : ["Details", "Review"]
  const w = useWizard(steps.length)

  const [name, setName] = useState("")
  const [gender, setGender] = useState<Gender | "">("")
  const [std, setStd] = useState("")
  const [school, setSchool] = useState("")
  const [contact, setContact] = useState("")
  const [area, setArea] = useState("")

  const [mentors, setMentors] = useState<MentorAdmin[]>([])
  const [mentorId, setMentorId] = useState("")
  const [reason, setReason] = useState("")

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (admin) listAllMentorsCached().then(setMentors).catch(() => setMentors([]))
  }, [admin])

  const isAssignStep = admin && w.step === 1
  const assignReasonNeeded = !!mentorId && reason.trim().length < 3
  const canNext =
    w.step === 0 ? name.trim().length > 0 : isAssignStep ? !assignReasonNeeded : true

  async function submit() {
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
        assignment_reason: admin && mentorId ? reason.trim() || "Assigned on intake" : undefined,
      })
      toast(`Mentee ${name.trim()} added`)
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the mentee.")
      setBusy(false)
    }
  }

  const target = mentors.find((m) => m.id === mentorId)

  return (
    <Dialog
      title="Add mentee"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={w.isFirst ? onClose : w.back}>
            {w.isFirst ? "Cancel" : "Back"}
          </Button>
          {w.isLast ? (
            <Button variant="accent" size="sm" disabled={busy || !name.trim()} onClick={submit}>
              {busy ? "Adding…" : "Add mentee"}
            </Button>
          ) : (
            <Button variant="accent" size="sm" disabled={!canNext} onClick={w.next}>
              Next
            </Button>
          )}
        </>
      }
    >
      <WizardSteps steps={steps} current={w.step} />

      {w.step === 0 && (
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender (optional)">
              <Select value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </Field>
            <Field label="Grade / Std (optional)">
              <Input value={std} onChange={(e) => setStd(e.target.value)} placeholder="9th" />
            </Field>
          </div>
          <Field label="School (optional)">
            <Input value={school} onChange={(e) => setSchool(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact (optional)">
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </Field>
            <Field label="Area (optional)">
              <Select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">—</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}

      {isAssignStep && (
        <div className="flex flex-col gap-3">
          <Field label="Assign a mentor">
            <Select value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
              <option value="">Leave unassigned for now</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.area ? ` · ${m.area}` : ""} · {m.mentee_count}
                  {m.capacity ? `/${m.capacity}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {mentorId && (
            <Field label="Reason">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Same area, has capacity" />
            </Field>
          )}
          <p className="text-xs text-[var(--muted-foreground)]">
            Unassigned mentees go into the Assignments queue.
          </p>
        </div>
      )}

      {w.isLast && (
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Name" value={name.trim()} />
          {gender && <Row label="Gender" value={GENDER_LABEL[gender]} />}
          {std.trim() && <Row label="Grade" value={std.trim()} />}
          {school.trim() && <Row label="School" value={school.trim()} />}
          {contact.trim() && <Row label="Contact" value={contact.trim()} />}
          {area.trim() && <Row label="Area" value={area.trim()} />}
          {admin && <Row label="Mentor" value={target ? target.name : "Unassigned"} />}
          {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}
        </div>
      )}
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--border)] py-1.5 last:border-0">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
