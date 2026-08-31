import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { setSession } from "@/lib/auth"
import { usePageTitle } from "@/lib/usePageTitle"
import { ApiError, login } from "@/lib/api"

export default function Login() {
  usePageTitle("Sign in")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login(username, password)
      setSession(res.token, res.role, res.username)
      navigate("/")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid username or password.")
      } else {
        setError("Could not reach the server. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--brand-gradient)] text-white shadow-[var(--shadow-md)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Mentor-Mentee Insights</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Welcome back — sign in to pick up where you left off.</p>
        </div>

        <Card className="shadow-[var(--shadow-lg)]">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
              <Button type="submit" variant="accent" disabled={loading} className="mt-2">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
