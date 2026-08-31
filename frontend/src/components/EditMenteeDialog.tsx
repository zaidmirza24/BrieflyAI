import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { LOCATIONS } from "@/lib/locations"
import { ApiError, updateStudent, type Gender, type StudentDetail } from "@/lib/api"

export function EditMenteeDialog({
  student,
  onClose,
  onDone,
}: {
  student: StudentDetail
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(student.name)
  const [gender, setGender] = useState<Gender | "">(student.gender ?? "")
  const [std, setStd] = useState(student.std ?? "")
  const [school, setSchool] = useState(student.school ?? "")
  const [contact, setContact] = useState(student.contact ?? "")
  const [area, setArea] = useState(student.area ?? "")
  const [notes, setNotes] = useState(student.notes ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await updateStudent(student.id, {
        name: name.trim(),
        gender: gender || null,
        std: std.trim() || null,
        school: school.trim() || null,
        contact: contact.trim() || null,
        area: area.trim() || null,
        notes: notes.trim() || null,
      })
      toast("Mentee details updated")
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.")
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Edit ${student.name}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-mentee-form" variant="accent" size="sm" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="edit-mentee-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Gender">
            <Select value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </Select>
          </Field>
          <Field label="Grade / Std">
            <Input value={std} onChange={(e) => setStd(e.target.value)} placeholder="9th" />
          </Field>
        </div>
        <Field label="School">
          <Input value={school} onChange={(e) => setSchool(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contact">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Area">
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">—</option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
              {area && !LOCATIONS.includes(area as (typeof LOCATIONS)[number]) && (
                <option value={area}>{area}</option>
              )}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
        </Field>
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      </form>
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
