import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Select } from "@/components/ui/select"
import { WizardSteps, useWizard } from "@/components/ui/wizard"
import { useToast } from "@/components/ui/toast"
import { slugFromName } from "@/components/mentors/MentorLogin"
import { LOCATIONS } from "@/lib/locations"
import { ApiError, createMentor, type MentorAccount } from "@/lib/api"

const STEPS = ["Details", "Login", "Review"]

export function AddMentorWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (credential?: MentorAccount) => void
}) {
  const toast = useToast()
  const w = useWizard(STEPS.length)

  const [name, setName] = useState("")
  const [area, setArea] = useState(LOCATIONS[0] as string)
  const [contact, setContact] = useState("")
  const [education, setEducation] = useState("")
  const [capacity, setCapacity] = useState("")

  const [wantLogin, setWantLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [password, setPassword] = useState("")

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveUsername = usernameEdited ? username : slugFromName(name)
  const loginIncomplete = wantLogin && (effectiveUsername.length < 3 || password.length < 8)
  const capacityNum = capacity.trim() ? Number(capacity) : null
  const capacityInvalid = capacityNum != null && (!Number.isInteger(capacityNum) || capacityNum < 1)

  const canNext =
    w.step === 0 ? name.trim().length > 0 && area && !capacityInvalid : w.step === 1 ? !loginIncomplete : true

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const created = await createMentor({
        name: name.trim(),
        area,
        contact: contact.trim() || null,
        education: education.trim() || null,
        capacity: capacityNum,
        username: wantLogin ? effectiveUsername : undefined,
        password: wantLogin ? password : undefined,
      })
      toast(`Mentor ${created.name} created`)
      onCreated(created.account ?? undefined)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the mentor.")
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Add mentor"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={w.isFirst ? onClose : w.back}>
            {w.isFirst ? "Cancel" : "Back"}
          </Button>
          {w.isLast ? (
            <Button variant="accent" size="sm" disabled={busy} onClick={submit}>
              {busy ? "Creating…" : "Create mentor"}
            </Button>
          ) : (
            <Button variant="accent" size="sm" disabled={!canNext} onClick={w.next}>
              Next
            </Button>
          )}
        </>
      }
    >
      <WizardSteps steps={STEPS} current={w.step} />

      {w.step === 0 && (
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Location">
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact (optional)">
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </Field>
            <Field label="Capacity (optional)">
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 10"
              />
            </Field>
          </div>
          <Field label="Education (optional)">
            <Input value={education} onChange={(e) => setEducation(e.target.value)} />
          </Field>
          {capacityInvalid && <p className="text-xs text-[var(--destructive)]">Capacity must be a positive whole number.</p>}
        </div>
      )}

      {w.step === 1 && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wantLogin} onChange={(e) => setWantLogin(e.target.checked)} />
            Create a sign-in login now
          </label>
          {wantLogin ? (
            <>
              <Field label="Username">
                <Input
                  value={effectiveUsername}
                  onChange={(e) => {
                    setUsernameEdited(true)
                    setUsername(e.target.value)
                  }}
                  placeholder="jane.doe"
                />
              </Field>
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </Field>
              {loginIncomplete && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Username needs 3+ characters and password 8+.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              You can provision a login later from the mentor's page.
            </p>
          )}
        </div>
      )}

      {w.step === 2 && (
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Name" value={name.trim()} />
          <Row label="Location" value={area} />
          {contact.trim() && <Row label="Contact" value={contact.trim()} />}
          {education.trim() && <Row label="Education" value={education.trim()} />}
          <Row label="Capacity" value={capacityNum != null ? String(capacityNum) : "No cap"} />
          <Row label="Login" value={wantLogin ? effectiveUsername : "Add later"} />
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
