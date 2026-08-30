const TOKEN_KEY = "insightder_token"
const ROLE_KEY = "insightder_role"
const USERNAME_KEY = "insightder_username"

export type Role = "admin" | "mentor"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getAuthHeader(): string | null {
  const token = getToken()
  return token ? `Bearer ${token}` : null
}

export function getRole(): Role | null {
  const r = localStorage.getItem(ROLE_KEY)
  return r === "admin" || r === "mentor" ? r : null
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY)
}

export function setSession(token: string, role: string, username: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
  localStorage.setItem(USERNAME_KEY, username)
}

export function clearCredentials() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

export function isLoggedIn(): boolean {
  return getToken() !== null
}

export function isAdmin(): boolean {
  return getRole() === "admin"
}
