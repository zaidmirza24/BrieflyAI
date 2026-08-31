import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { ApiError, createMentorAccount, type MentorAccount } from "@/lib/api"

export function slugFromName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32)
}

export function CredentialCard({ account, onDismiss }: { account: MentorAccount; onDismiss: () => void }) {
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

export function ProvisionLoginDialog({
  mentor,
  onClose,
  onCreated,
}: {
  mentor: { id: string; name: string }
  onClose: () => void
  onCreated: (acc: MentorAccount) => void
}) {
  const [username, setUsername] = useState(slugFromName(mentor.name))
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
    <Dialog
      title={`Create login — ${mentor.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="provision-login-form"
            variant="accent"
            size="sm"
            disabled={busy || username.trim().length < 3 || passwordInvalid}
          >
            {busy ? "Creating…" : "Create login"}
          </Button>
        </>
      }
    >
      <form id="provision-login-form" onSubmit={submit} className="flex flex-col gap-3">
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
      </form>
    </Dialog>
  )
}
