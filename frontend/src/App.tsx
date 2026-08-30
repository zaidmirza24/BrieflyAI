import { useEffect, useState } from "react"
import { Navigate, NavLink, Route, BrowserRouter, Routes, useLocation } from "react-router-dom"
import { IdCard, LayoutDashboard, LogOut, Menu, Moon, Plus, Sparkles, Sun, Users, X } from "lucide-react"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Students from "@/pages/Students"
import StudentProfile from "@/pages/StudentProfile"
import NewAnalysis from "@/pages/NewAnalysis"
import AnalysisView from "@/pages/AnalysisView"
import Mentors from "@/pages/Mentors"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isLoggedIn, isAdmin, clearCredentials } from "@/lib/auth"
import { getEffectiveTheme, setTheme, subscribeToSystemTheme, type Theme } from "@/lib/theme"

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/" replace />
  return <>{children}</>
}

function navItems() {
  const admin = isAdmin()
  return [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/students", label: admin ? "Mentees" : "My Mentees", icon: Users, end: false },
    ...(admin ? [{ to: "/mentors", label: "Mentors", icon: IdCard, end: false }] : []),
  ]
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
        <Sparkles className="h-4 w-4" />
      </div>
      {!compact && (
        <span className="text-sm font-semibold leading-tight tracking-tight">
          Mentor-Mentee
          <br />
          Insights
        </span>
      )}
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems().map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[var(--accent-bg)] text-[var(--accent-strong)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>(getEffectiveTheme)

  useEffect(() => subscribeToSystemTheme(() => setThemeState(getEffectiveTheme())), [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  )
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => {
        clearCredentials()
        window.location.href = "/login"
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[var(--muted)] lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-5">
          <Brand />
        </div>
        <div className="flex flex-1 flex-col justify-between p-3">
          <div className="flex flex-col gap-4">
            <NavLink to="/new" className={cn(buttonVariants({ variant: "accent" }), "w-full justify-start")}>
              <Plus className="h-4 w-4" />
              New Analysis
            </NavLink>
            <SidebarNav />
          </div>
          <div className="flex flex-col gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand compact />
        <NavLink
          to="/new"
          aria-label="New Analysis"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-strong)]"
        >
          <Plus className="h-4.5 w-4.5" />
        </NavLink>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[var(--surface)] shadow-[var(--shadow-lg)]">
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
              <Brand />
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col justify-between p-3">
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
              <div className="flex flex-col gap-1">
                <ThemeToggle />
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/students" element={<Protected><Students /></Protected>} />
        <Route path="/students/:id" element={<Protected><StudentProfile /></Protected>} />
        <Route path="/mentors" element={<RequireAdmin><AppShell><Mentors /></AppShell></RequireAdmin>} />
        <Route path="/new" element={<Protected><NewAnalysis /></Protected>} />
        <Route path="/analyses/:id" element={<Protected><AnalysisView /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
