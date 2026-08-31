import { Link } from "react-router-dom"
import { Compass } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { usePageTitle } from "@/lib/usePageTitle"

export default function NotFound() {
  usePageTitle("Page not found")
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
        <Compass className="h-5 w-5" />
      </div>
      <h1 className="mt-4 text-lg font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        That link doesn't point anywhere in the app.
      </p>
      <Link to="/" className={`${buttonVariants({ variant: "accent" })} mt-5`}>
        Back to dashboard
      </Link>
    </div>
  )
}
