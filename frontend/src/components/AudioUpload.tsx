import { useCallback, useRef, useState } from "react"
import { CheckCircle2, FileAudio, UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ApiError, confirmUpload, presignUpload, uploadToPresignedUrl } from "@/lib/api"
import { cn, formatBytes, formatDuration } from "@/lib/utils"

type Status = "idle" | "ready" | "uploading" | "confirming" | "done" | "error"

export interface UploadedAudio {
  storageKey: string
  filename: string
  sizeBytes: number
  durationSeconds: number | null
  contentType: string | null
}

interface Props {
  onUploaded: (audio: UploadedAudio) => void
  onCleared: () => void
}

export function AudioUpload({ onUploaded, onCleared }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = useCallback((f: File) => {
    const MAX_BYTES = 500 * 1024 * 1024 // 500 MB — generous for a long recording
    if (f.size > MAX_BYTES) {
      setStatus("error")
      setError(`That file is ${formatBytes(f.size)}. The limit is 500 MB — please trim or compress the recording.`)
      return
    }
    setFile(f)
    setStatus("ready")
    setProgress(0)
    setError(null)
    setDuration(null)
    onCleared()

    // Read duration client-side; no backend round trip needed for this.
    const audioEl = document.createElement("audio")
    audioEl.preload = "metadata"
    audioEl.onloadedmetadata = () => {
      if (Number.isFinite(audioEl.duration)) setDuration(audioEl.duration)
      URL.revokeObjectURL(audioEl.src)
    }
    audioEl.src = URL.createObjectURL(f)
  }, [onCleared])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  async function startUpload() {
    if (!file) return
    setError(null)
    try {
      setStatus("uploading")
      setProgress(0)
      const presign = await presignUpload(file)

      await uploadToPresignedUrl(presign.upload_url, file, presign.content_type, setProgress)

      setStatus("confirming")
      const confirmation = await confirmUpload(presign.storage_key)
      if (!confirmation.exists) {
        throw new Error("Upload finished but the file could not be verified in storage. Please try again.")
      }

      setStatus("done")
      onUploaded({
        storageKey: presign.storage_key,
        filename: file.name,
        sizeBytes: file.size,
        durationSeconds: duration,
        contentType: presign.content_type,
      })
    } catch (err) {
      setStatus("error")
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed.")
    }
  }

  function reset() {
    setFile(null)
    setDuration(null)
    setStatus("idle")
    setProgress(0)
    setError(null)
    onCleared()
    if (inputRef.current) inputRef.current.value = ""
  }

  if (!file) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
            dragActive
              ? "border-[var(--accent)] bg-[var(--accent-bg)]"
              : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-bg)]/40",
          )}
        >
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              dragActive ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]",
            )}
          >
            <UploadCloud className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-[var(--foreground)]">
            Drag and drop your audio recording here
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            or click to browse — MP3, WAV, M4A, AAC, OGG, FLAC (max 500 MB)
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.webm,.flac"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pickFile(f)
            }}
          />
        </button>
        {status === "error" && error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)]">
            <FileAudio className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {formatBytes(file.size)}
              {duration !== null && ` · ${formatDuration(duration)}`}
            </p>
          </div>
        </div>
        {status !== "uploading" && status !== "confirming" && (
          <button
            onClick={reset}
            className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {(status === "uploading" || status === "confirming") && (
        <div className="mt-4 flex flex-col gap-2">
          <Progress value={progress} />
          <p className="text-xs text-[var(--muted-foreground)]">
            {status === "uploading" ? `Uploading… ${Math.round(progress * 100)}%` : "Verifying upload…"}
          </p>
        </div>
      )}

      {status === "done" && (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4" />
          Uploaded successfully
        </p>
      )}

      {status === "error" && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-[var(--destructive)]">{error}</p>
          <Button variant="outline" size="sm" onClick={startUpload} className="w-fit">
            Retry upload
          </Button>
        </div>
      )}

      {status === "ready" && (
        <Button variant="accent" onClick={startUpload} className="mt-4">
          Upload Audio
        </Button>
      )}
    </div>
  )
}
