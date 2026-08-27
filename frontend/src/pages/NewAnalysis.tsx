import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AudioLines, ShieldCheck, Sparkles } from "lucide-react"
import { AudioUpload, type UploadedAudio } from "@/components/AudioUpload"
import { AnalysisStepper } from "@/components/AnalysisStepper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { LOCATIONS } from "@/lib/locations"
import {
  ApiError,
  createSession,
  listMentors,
  listStudents,
  streamAnalysis,
  type AnalysisStage,
  type MentorSummary,
  type StudentSummary,
} from "@/lib/api"

type Phase = "form" | "analyzing" | "error"

export default function NewAnalysis() {
  const navigate = useNavigate()
  const [mentors, setMentors] = useState<MentorSummary[]>([])
  const [mentees, setMentees] = useState<StudentSummary[]>([])
  const [mentorsLoading, setMentorsLoading] = useState(false)
  const [menteesLoading, setMenteesLoading] = useState(false)
  // Cascade: location -> mentor -> mentee. Each step gates the next. When the
  // mentor panel ships, a signed-in mentor's own area/identity will preselect
  // the first two steps and this page will jump straight to the mentee picker.
  const [location, setLocation] = useState("")
  const [mentorId, setMentorId] = useState("")
  const [menteeId, setMenteeId] = useState("")
  const [uploaded, setUploaded] = useState<UploadedAudio | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>("form")
  const [stage, setStage] = useState<AnalysisStage | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Mentors are scoped to the chosen location (their `area`).
  useEffect(() => {
    if (!location) {
      setMentors([])
      setMentorId("")
      return
    }
    setMentorsLoading(true)
    setMentorId("")
    listMentors(undefined, location)
      .then(setMentors)
      .catch(() => setMentors([]))
      .finally(() => setMentorsLoading(false))
  }, [location])

  // Mentees are scoped to the selected mentor -- picking a mentor is the
  // gate for which mentees can be chosen, per the sheet's assignments.
  useEffect(() => {
    if (!mentorId) {
      setMentees([])
      setMenteeId("")
      return
    }
    setMenteesLoading(true)
    setMenteeId("")
    listStudents(undefined, mentorId)
      .then(setMentees)
      .catch(() => setMentees([]))
      .finally(() => setMenteesLoading(false))
  }, [mentorId])

  const canStart = !!uploaded && mentorId !== "" && menteeId !== "" && phase === "form"

  async function startAnalysis() {
    if (!uploaded || !mentorId || !menteeId) return
    setPhase("analyzing")
    setErrorMessage(null)
    setStage(null)

    try {
      let id = sessionId
      if (!id) {
        const created = await createSession({
          student_id: menteeId,
          mentor_id: mentorId,
          storage_key: uploaded.storageKey,
          audio_filename: uploaded.filename,
          audio_duration: uploaded.durationSeconds,
          content_type: uploaded.contentType,
        })
        id = created.id
        setSessionId(id)
      }

      await streamAnalysis(id, (event) => {
        if (event.type === "stage") {
          setStage(event.stage)
        } else if (event.type === "error") {
          setErrorMessage(event.message)
          setPhase("error")
        } else if (event.type === "done") {
          navigate(`/analyses/${event.result.id}`)
        }
      })
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
      setPhase("error")
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Analysis</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Upload a mentor-mentee recording to get started.</p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Session details</CardTitle>
          <CardDescription>Who this recording is for</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={phase !== "form"}
              required
            >
              <option value="" disabled>
                Select a location
              </option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
          </div>

          {location && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mentor">Mentor</Label>
              <Select
                id="mentor"
                value={mentorId}
                onChange={(e) => setMentorId(e.target.value)}
                disabled={phase !== "form"}
                loading={mentorsLoading}
                required
              >
                <option value="" disabled>
                  {mentorsLoading
                    ? "Loading mentors…"
                    : mentors.length
                      ? "Select a mentor"
                      : `No mentors in ${location} yet`}
                </option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {mentorId && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mentee">Mentee</Label>
            <Select
              id="mentee"
              value={menteeId}
              onChange={(e) => setMenteeId(e.target.value)}
              disabled={phase !== "form"}
              loading={menteesLoading}
              required
            >
              <option value="" disabled>
                {menteesLoading ? "Loading mentees…" : "Select a mentee"}
              </option>
              {mentees.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AudioLines className="h-4 w-4 text-[var(--muted-foreground)]" />
            Audio File
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
            Uploads go straight to secure temporary storage from your browser — good for long recordings. The
            recording is deleted automatically once analysis is saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AudioUpload
            onUploaded={(a) => {
              setUploaded(a)
              setSessionId(null)
            }}
            onCleared={() => {
              setUploaded(null)
              setSessionId(null)
            }}
          />
        </CardContent>
      </Card>

      {phase === "form" && (
        <Button variant="accent" className="mt-6 w-full" size="lg" disabled={!canStart} onClick={startAnalysis}>
          Analyze Conversation
        </Button>
      )}

      {(phase === "analyzing" || phase === "error") && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              {phase === "analyzing" ? "Analyzing your recording…" : "Analysis failed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisStepper stage={stage} hasError={phase === "error"} />
            {phase === "error" && (
              <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                <p className="text-sm text-[var(--destructive)]">{errorMessage}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  The uploaded recording is still safely staged — you can retry without uploading again.
                </p>
                <Button variant="outline" className="w-fit" onClick={startAnalysis}>
                  Retry analysis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
