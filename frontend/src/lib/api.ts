import { clearCredentials, getAuthHeader } from "./auth"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let redirectingToLogin = false

function handleSessionExpired() {
  if (redirectingToLogin) return
  redirectingToLogin = true
  clearCredentials()
  window.location.href = "/login"
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader = getAuthHeader()
  const headers = new Headers(options.headers)
  if (authHeader) headers.set("Authorization", authHeader)

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    handleSessionExpired()
    throw new ApiError(401, "Session expired. Please log in again.")
  }

  if (!res.ok) {
    let message =
      res.status >= 500
        ? "Something went wrong on our end. Please try again in a moment."
        : "That didn't go through. Please check your details and try again."
    try {
      const body = await res.json()
      if (typeof body?.detail === "string" && body.detail) message = body.detail
    } catch {
      // non-JSON error body, keep the friendly default
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
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
}

export interface LoginResponse {
  token: string
  role: "admin" | "mentor"
  username: string
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  // Deliberately not routed through `request()` — a 401 here means "wrong
  // password", not "session expired", so it must not trigger the redirect.
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    let message = "Could not sign in. Please try again."
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // keep default
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<LoginResponse>
}

export interface Me {
  username: string
  role: "admin" | "mentor"
  mentor_id: string | null
  mentor_name: string | null
  area: string | null
}

export async function getMe(): Promise<Me> {
  return api.get<Me>("/api/auth/me")
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
  student_id: string
  mentor_id: string
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
export async function streamAnalysis(
  sessionId: string,
  onEvent: (event: AnalysisEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const authHeader = getAuthHeader()
  const headers = new Headers()
  if (authHeader) headers.set("Authorization", authHeader)

  const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST", headers, signal })
  if (res.status === 401) {
    handleSessionExpired()
    return
  }
  if (!res.ok || !res.body) {
    onEvent({
      type: "error",
      message:
        res.status >= 500
          ? "The analysis service is busy right now. Your recording is safe — please retry in a moment."
          : "We couldn't start the analysis. Please try again.",
    })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
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
  } catch (err) {
    // A caller-triggered abort (navigating away) is expected — stay quiet.
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
    onEvent({ type: "error", message: "The connection was interrupted. You can retry the analysis." })
  }
}

export interface SessionSummary {
  id: string
  student_id: string
  student_name: string
  mentor_id: string
  mentor_name: string
  audio_filename: string
  status: SessionStatus
  created_at: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export async function listSessions(
  opts: {
    page?: number
    pageSize?: number
    q?: string
    status?: SessionStatus
    dateFrom?: string
    dateTo?: string
    mentorId?: string
    studentId?: string
    area?: string
  } = {},
): Promise<Page<SessionSummary>> {
  const params = new URLSearchParams()
  if (opts.page) params.set("page", String(opts.page))
  if (opts.pageSize) params.set("page_size", String(opts.pageSize))
  if (opts.q) params.set("q", opts.q)
  if (opts.status) params.set("status", opts.status)
  if (opts.dateFrom) params.set("date_from", opts.dateFrom)
  if (opts.dateTo) params.set("date_to", opts.dateTo)
  if (opts.mentorId) params.set("mentor_id", opts.mentorId)
  if (opts.studentId) params.set("student_id", opts.studentId)
  if (opts.area) params.set("area", opts.area)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return api.get<Page<SessionSummary>>(`/api/sessions${qs}`)
}

export interface DashboardSummary {
  total_students: number
  total_analyses: number
  recent_analyses: SessionSummary[]
}

export type MenteeStatus = "active" | "paused" | "graduated" | "dropped"
export type Gender = "M" | "F" | "O"

export interface StudentSummary {
  id: string
  name: string
  gender: Gender | null
  contact: string | null
  std: string | null
  school: string | null
  area: string | null
  status: MenteeStatus
  notes: string | null
  primary_mentor_id: string | null
  mentor_name: string | null
  mentor_area: string | null
  analysis_count: number
  last_analysis_at: string | null
  created_at: string | null
}

export interface Assignment {
  id: string
  student_id: string
  from_mentor_id: string | null
  from_mentor_name: string | null
  to_mentor_id: string | null
  to_mentor_name: string | null
  reason: string | null
  by_username: string | null
  created_at: string
}

export interface StudentDetail extends StudentSummary {
  sessions: SessionSummary[]
  assignments: Assignment[]
}

export interface MenteeProfileInput {
  gender?: Gender | null
  contact?: string | null
  std?: string | null
  school?: string | null
  area?: string | null
  notes?: string | null
}

export interface AttentionSummary {
  unassigned: number
  paused: number
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>("/api/dashboard/summary")
}

export async function listStudents(
  opts: {
    query?: string
    mentorId?: string
    area?: string
    status?: MenteeStatus
    unassigned?: boolean
  } = {},
): Promise<StudentSummary[]> {
  const params = new URLSearchParams()
  if (opts.query) params.set("q", opts.query)
  if (opts.mentorId) params.set("mentor_id", opts.mentorId)
  if (opts.area) params.set("area", opts.area)
  if (opts.status) params.set("status", opts.status)
  if (opts.unassigned) params.set("unassigned", "true")
  const qs = params.toString() ? `?${params.toString()}` : ""
  return api.get<StudentSummary[]>(`/api/students${qs}`)
}

export async function getStudent(id: string): Promise<StudentDetail> {
  return api.get<StudentDetail>(`/api/students/${id}`)
}

export async function getAttentionSummary(): Promise<AttentionSummary> {
  return api.get<AttentionSummary>("/api/students/attention")
}

export async function createStudent(payload: {
  name: string
  status?: MenteeStatus
  primary_mentor_id?: string | null
  assignment_reason?: string | null
} & MenteeProfileInput): Promise<StudentSummary> {
  const result = await api.post<StudentSummary>("/api/students", payload)
  if (payload.primary_mentor_id) invalidateMentorsCache()
  return result
}

export async function updateStudent(
  id: string,
  payload: ({ name?: string; status?: MenteeStatus } & MenteeProfileInput),
): Promise<StudentSummary> {
  return api.patch<StudentSummary>(`/api/students/${id}`, payload)
}

export async function reassignStudent(
  id: string,
  primaryMentorId: string | null,
  reason: string,
): Promise<StudentSummary> {
  const result = await api.patch<StudentSummary>(`/api/students/${id}/assignment`, {
    primary_mentor_id: primaryMentorId,
    reason,
  })
  invalidateMentorsCache() // mentee_count changed
  return result
}

export interface BulkAssignResult {
  assigned: number
  skipped: string[]
}

export async function bulkAssignStudents(
  studentIds: string[],
  primaryMentorId: string,
  reason: string,
): Promise<BulkAssignResult> {
  const result = await api.post<BulkAssignResult>("/api/students/assign", {
    student_ids: studentIds,
    primary_mentor_id: primaryMentorId,
    reason,
  })
  invalidateMentorsCache()
  return result
}

export interface MentorSummary {
  id: string
  name: string
  area: string | null
}

export interface MentorAdmin extends MentorSummary {
  gender: string | null
  contact: string | null
  education: string | null
  capacity: number | null
  mentee_count: number
  account_username: string | null
}

export async function getMentor(id: string): Promise<MentorAdmin> {
  return api.get<MentorAdmin>(`/api/mentors/${id}`)
}

export async function listMentors(query?: string, area?: string): Promise<MentorAdmin[]> {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (area) params.set("area", area)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return api.get<MentorAdmin[]>(`/api/mentors${qs}`)
}

// The full, unscoped mentor list is small and rarely changes but is needed by
// every assign/reassign dialog. Memoise it and drop the cache whenever a mentor
// or an assignment is mutated.
let allMentorsCache: Promise<MentorAdmin[]> | null = null

export function listAllMentorsCached(): Promise<MentorAdmin[]> {
  if (!allMentorsCache) {
    allMentorsCache = listMentors().catch((err) => {
      allMentorsCache = null
      throw err
    })
  }
  return allMentorsCache
}

export function invalidateMentorsCache() {
  allMentorsCache = null
}

export interface MentorCreated extends MentorSummary {
  account: MentorAccount | null
}

export async function createMentor(payload: {
  name: string
  area: string
  gender?: string | null
  contact?: string | null
  education?: string | null
  capacity?: number | null
  username?: string
  password?: string
}): Promise<MentorCreated> {
  const result = await api.post<MentorCreated>("/api/mentors", payload)
  invalidateMentorsCache()
  return result
}

export async function updateMentor(
  id: string,
  payload: Partial<{
    name: string
    area: string
    gender: string
    contact: string
    education: string
    capacity: number | null
  }>,
): Promise<MentorAdmin> {
  const result = await api.patch<MentorAdmin>(`/api/mentors/${id}`, payload)
  invalidateMentorsCache()
  return result
}

export interface MentorAccount {
  username: string
  temp_password: string
}

export async function createMentorAccount(
  mentorId: string,
  username: string,
  password?: string,
): Promise<MentorAccount> {
  return api.post<MentorAccount>(`/api/mentors/${mentorId}/account`, {
    username,
    password: password || undefined,
  })
}

export async function resetMentorAccount(mentorId: string): Promise<MentorAccount> {
  return api.post<MentorAccount>(`/api/mentors/${mentorId}/account/reset`)
}
