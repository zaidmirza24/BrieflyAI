import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Last line of defence: a render-time exception anywhere below this point shows
 * a recoverable card instead of unmounting the whole app to a blank page.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Kept simple on purpose — wire a real logger here if one is added.
    console.error("Unhandled UI error:", error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)] px-4">
        <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-lg)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--destructive-bg)] text-[var(--destructive)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-base font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <Button variant="accent" className="mt-5 w-full" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>
      </div>
    )
  }
}
