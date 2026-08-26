import { createContext, useContext, useState } from "react"
import { cn } from "@/lib/utils"

interface TabsContext {
  value: string
  setValue: (v: string) => void
}

const Ctx = createContext<TabsContext | null>(null)

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string
  children: React.ReactNode
  className?: string
}) {
  const [value, setValue] = useState(defaultValue)
  return (
    <Ctx.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs")
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-sm)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("TabsContent must be used within Tabs")
  if (ctx.value !== value) return null
  return <div className="mt-4">{children}</div>
}
