import { FileAudio, User2 } from "lucide-react"
import { ResultsPanel } from "@/components/ResultsPanel"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SessionDetail } from "@/lib/api"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

// "[00:01] SPEAKER_00: <text>" -- every line starts with a Latin timestamp
// prefix, so dir="auto" on the whole line always sees a Latin first
// character and never flips to RTL. Split the prefix out so RTL scripts
// (e.g. Urdu) in the spoken text render right-to-left on their own.
const LINE_PREFIX = /^(\[\d{1,2}:\d{2}\]\s*(?:[A-Za-z_]+\d*|[A-Za-z ]+):\s*)(.*)$/

function TranscriptLine({ line }: { line: string }) {
  const match = line.match(LINE_PREFIX)
  if (!match) return <div className="whitespace-pre-wrap">{line || " "}</div>
  const [, prefix, text] = match
  return (
    <div className="whitespace-pre-wrap">
      <span className="text-[var(--muted-foreground)]">{prefix}</span>
      <span dir="auto">{text}</span>
    </div>
  )
}

function Transcript({ transcript }: { transcript: string | null }) {
  if (!transcript) {
    return <p className="p-6 text-sm text-[var(--muted-foreground)]">No transcript available.</p>
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="thin-scroll max-h-[32rem] overflow-y-auto break-words font-mono text-[13px] leading-relaxed text-[var(--foreground)]">
          {transcript.split("\n").map((line, i) => (
            <TranscriptLine key={i} line={line} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalysisResult({ session }: { session: SessionDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{session.student_name}</h1>
            <StatusBadge status={session.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <User2 className="h-3.5 w-3.5" />
              Mentor: {session.mentor_name}
            </span>
            <span>{formatDate(session.created_at)}</span>
            <span className="inline-flex items-center gap-1.5">
              <FileAudio className="h-3.5 w-3.5" />
              {session.audio_filename}
            </span>
          </div>
        </div>
      </div>

      {session.status === "FAILED" && session.error && (
        <div className="rounded-[var(--radius)] border border-[var(--destructive-border)] bg-[var(--destructive-bg)] p-4 text-sm text-[var(--destructive)]">
          Analysis failed: {session.error}
        </div>
      )}

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>
        <TabsContent value="insights">
          {session.insights ? (
            <ResultsPanel insights={session.insights as never} />
          ) : (
            <p className="p-6 text-sm text-[var(--muted-foreground)]">No insights available yet.</p>
          )}
        </TabsContent>
        <TabsContent value="transcript">
          <Transcript transcript={session.transcript} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
