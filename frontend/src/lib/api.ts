import { clearCredentials, getAuthHeader } from "./auth"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader = getAuthHeader()
  const headers = new Headers(options.headers)
  if (authHeader) headers.set("Authorization", authHeader)

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    clearCredentials()
    window.location.href = "/login"
    throw new ApiError(401, "Session expired. Please log in again.")
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // non-JSON error body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
}

export interface PresignResponse {
  upload_url: string
  storage_key: string
  content_type: string | null
  expires_in_seconds: number
}

export async function presignUpload(file: File): Promise<PresignResponse> {
  return api.post<PresignResponse>("/api/uploads/presign", {
    filename: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
  })
}

/**
 * Uploads `file` directly to storage using a presigned PUT URL (XHR, not
 * fetch, so we get real upload progress events). Retries transient network
 * failures a couple of times before giving up -- long uploads on flaky
 * connections are the whole point of doing this client-side.
 */
function putOnce(
  uploadUrl: string,
  file: File,
  contentType: string | null,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`))
      }
    }

    xhr.onerror = () => reject(new Error("Upload failed due to a network error."))
    xhr.ontimeout = () => reject(new Error("Upload timed out."))
    xhr.timeout = 30 * 60 * 1000 // 30 min ceiling for very long recordings

    xhr.send(file)
  })
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string | null,
  onProgress: (fraction: number) => void,
  maxAttempts = 3,
): Promise<void> {
  let lastError: unknown
  for (let attemptsLeft = maxAttempts; attemptsLeft > 0; attemptsLeft--) {
    try {
      await putOnce(uploadUrl, file, contentType, onProgress)
      return
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed.")
}

export async function confirmUpload(storageKey: string): Promise<{ exists: boolean; size_bytes: number | null }> {
  return api.get(`/api/uploads/${storageKey}/confirm`)
}

export type SessionStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "TRANSCRIBED"
  | "ANALYZED"
  | "SAVED"
  | "AUDIO_DELETED"
  | "FAILED"

export interface SessionCreated {
  id: string
  status: SessionStatus
}

export interface SessionDetail {
  id: string
  student_id: string
  student_name: string
  mentor_id: string
  mentor_name: string
  audio_filename: string
  audio_duration: number | null
  transcription_backend: string
  status: SessionStatus
  error: string | null
  transcript: string | null
  insights: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export async function createSession(payload: {
  student_name: string
  mentor_name: string
  storage_key: string
  audio_filename: string
  audio_duration: number | null
  content_type: string | null
}): Promise<SessionCreated> {
  return api.post<SessionCreated>("/api/sessions", payload)
}

export async function getSession(id: string): Promise<SessionDetail> {
  return api.get<SessionDetail>(`/api/sessions/${id}`)
}

export type AnalysisStage =
  | "processing"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "analyzed"
  | "saved"
  | "deleting"
  | "audio_deleted"

export type AnalysisEvent =
  | { type: "stage"; stage: AnalysisStage }
  | { type: "done"; result: SessionDetail }
  | { type: "error"; message: string }

/**
 * Opens the SSE stream for POST /api/sessions/{id}/analyze. fetch()'s
 * ReadableStream (not EventSource, which can't POST) is read incrementally
 * so stage events arrive as the pipeline actually progresses.
 */
export async function streamAnalysis(sessionId: string, onEvent: (event: AnalysisEvent) => void): Promise<void> {
  const authHeader = getAuthHeader()
  const headers = new Headers()
  if (authHeader) headers.set("Authorization", authHeader)

  const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST", headers })
  if (res.status === 401) {
    clearCredentials()
    window.location.href = "/login"
    return
  }
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `Request failed (${res.status})` })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""
    for (const raw of events) {
      const line = raw.split("\n").find((l) => l.startsWith("data: "))
      if (!line) continue
      try {
        onEvent(JSON.parse(line.slice("data: ".length)))
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

export interface SessionSummary {
  id: string
  student_name: string
  mentor_name: string
  audio_filename: string
  status: SessionStatus
  created_at: string
}

export interface DashboardSummary {
  total_students: number
  total_analyses: number
  recent_analyses: SessionSummary[]
}

export interface StudentSummary {
  id: string
  name: string
  mentor_name: string | null
  analysis_count: number
  last_analysis_at: string | null
}

export interface StudentDetail extends StudentSummary {
  sessions: SessionSummary[]
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>("/api/dashboard/summary")
}

export async function listStudents(query?: string): Promise<StudentSummary[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ""
  return api.get<StudentSummary[]>(`/api/students${qs}`)
}

export async function getStudent(id: string): Promise<StudentDetail> {
  return api.get<StudentDetail>(`/api/students/${id}`)
}
