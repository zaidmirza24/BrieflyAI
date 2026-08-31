import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { LOCATIONS } from "@/lib/locations"
import { ApiError, updateMentor, type MentorAdmin } from "@/lib/api"

export function EditMentorDialog({
  mentor,
  onClose,
  onDone,
}: {
  mentor: MentorAdmin
  onClose: () => void
  onDone: (updated: MentorAdmin) => void
}) {
  const toast = useToast()
  const [name, setName] = useState(mentor.name)
  const [area, setArea] = useState(mentor.area ?? (LOCATIONS[0] as string))
  const [gender, setGender] = useState(mentor.gender ?? "")
  const [contact, setContact] = useState(mentor.contact ?? "")
  const [education, setEducation] = useState(mentor.education ?? "")
  const [capacity, setCapacity] = useState(mentor.capacity != null ? String(mentor.capacity) : "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capacityNum = capacity.trim() ? Number(capacity) : null
  const capacityInvalid = capacityNum != null && (!Number.isInteger(capacityNum) || capacityNum < 1)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !area.trim() || capacityInvalid) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateMentor(mentor.id, {
        name: name.trim(),
        area: area.trim(),
        gender: (gender || undefined) as string | undefined,
        contact: contact.trim() || undefined,
        education: education.trim() || undefined,
        capacity: capacityNum,
      })
      toast("Mentor updated")
      onDone(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.")
      setBusy(false)
    }
  }

  const knownArea =
    LOCATIONS.includes(area as (typeof LOCATIONS)[number]) || !area
      ? LOCATIONS
      : ([...LOCATIONS, area] as string[])

  return (
    <Dialog
      title={`Edit ${mentor.name}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-mentor-form"
            variant="accent"
            size="sm"
            disabled={busy || !name.trim() || capacityInvalid}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="edit-mentor-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              {knownArea.map((loc) => (
                <option key={loc} value={loc as string}>
                  {loc}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gender">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Capacity">
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="No cap"
            />
          </Field>
        </div>
        <Field label="Education">
          <Input value={education} onChange={(e) => setEducation(e.target.value)} />
        </Field>
        {capacityInvalid && (
          <p className="text-xs text-[var(--destructive)]">Capacity must be a positive whole number.</p>
        )}
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
