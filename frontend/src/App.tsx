import { useEffect, useState } from "react"
import { Navigate, NavLink, Route, BrowserRouter, Routes, useLocation } from "react-router-dom"
import { ClipboardList, FileAudio, IdCard, LayoutDashboard, LogOut, Menu, Moon, Plus, Sparkles, Sun, Users, X } from "lucide-react"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Students from "@/pages/Students"
import StudentProfile from "@/pages/StudentProfile"
import NewAnalysis from "@/pages/NewAnalysis"
import AnalysisView from "@/pages/AnalysisView"
import Analyses from "@/pages/Analyses"
import Mentors from "@/pages/Mentors"
import MentorDetail from "@/pages/MentorDetail"
import Assignments from "@/pages/Assignments"
import NotFound from "@/pages/NotFound"
import { buttonVariants } from "@/components/ui/button"
import { ToastProvider } from "@/components/ui/toast"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { cn } from "@/lib/utils"
import { useFocusTrap } from "@/lib/useFocusTrap"
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
    { to: "/analyses", label: "Analyses", icon: FileAudio, end: false },
    ...(admin
      ? [
          { to: "/assignments", label: "Assignments", icon: ClipboardList, end: false },
          { to: "/mentors", label: "Mentors", icon: IdCard, end: false },
        ]
      : []),
  ]
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--brand-gradient)] text-white shadow-[var(--shadow-sm)]">
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
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {navItems().map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
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
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
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
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        className,
      )}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  )
}

function MobileDrawer({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <div className="fixed inset-0 z-30 lg:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[var(--surface)] shadow-[var(--shadow-lg)] focus:outline-none"
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
          <Brand />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-between p-3">
          <SidebarNav onNavigate={onClose} />
          <div className="flex flex-col gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[var(--muted)] lg:flex lg:h-screen lg:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-[var(--shadow-lg)]"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:h-screen lg:sticky lg:top-0">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-5">
          <Brand />
        </div>
        <div className="flex flex-1 flex-col justify-between overflow-y-auto p-3">
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
          aria-expanded={mobileNavOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand compact />
        <NavLink
          to="/new"
          aria-label="New Analysis"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Plus className="h-4.5 w-4.5" />
        </NavLink>
      </header>

      {mobileNavOpen && <MobileDrawer onClose={() => setMobileNavOpen(false)} />}

      <main id="main" className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        {children}
      </main>
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
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/students" element={<Protected><Students /></Protected>} />
            <Route path="/students/:id" element={<Protected><StudentProfile /></Protected>} />
            <Route path="/analyses" element={<Protected><Analyses /></Protected>} />
            <Route path="/assignments" element={<RequireAdmin><AppShell><Assignments /></AppShell></RequireAdmin>} />
            <Route path="/mentors" element={<RequireAdmin><AppShell><Mentors /></AppShell></RequireAdmin>} />
            <Route path="/mentors/:id" element={<RequireAdmin><AppShell><MentorDetail /></AppShell></RequireAdmin>} />
            <Route path="/new" element={<Protected><NewAnalysis /></Protected>} />
            <Route path="/analyses/:id" element={<Protected><AnalysisView /></Protected>} />
            <Route path="*" element={<Protected><NotFound /></Protected>} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}
