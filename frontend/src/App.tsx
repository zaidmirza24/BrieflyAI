import { Navigate, NavLink, Route, BrowserRouter, Routes } from "react-router-dom"
import { LayoutDashboard, LogOut, Plus, Sparkles, Users } from "lucide-react"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Students from "@/pages/Students"
import StudentProfile from "@/pages/StudentProfile"
import NewAnalysis from "@/pages/NewAnalysis"
import AnalysisView from "@/pages/AnalysisView"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isLoggedIn, clearCredentials } from "@/lib/auth"

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/students", label: "Students", icon: Users, end: false },
]

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--muted)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Mentor-Mentee Insights</span>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[var(--accent-bg)] text-[var(--accent-strong)]"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/new" className={buttonVariants({ variant: "accent", size: "sm" })}>
              <Plus className="h-3.5 w-3.5" />
              New Analysis
            </NavLink>
            <button
              onClick={() => {
                clearCredentials()
                window.location.href = "/login"
              }}
              className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
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
        <Route path="/new" element={<Protected><NewAnalysis /></Protected>} />
        <Route path="/analyses/:id" element={<Protected><AnalysisView /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
