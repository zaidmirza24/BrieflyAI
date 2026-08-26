const STORAGE_KEY = "insightder_auth"

export function getAuthHeader(): string | null {
  const token = localStorage.getItem(STORAGE_KEY)
  return token ? `Basic ${token}` : null
}

export function setCredentials(username: string, password: string) {
  localStorage.setItem(STORAGE_KEY, btoa(`${username}:${password}`))
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY)
}

export function isLoggedIn(): boolean {
  return getAuthHeader() !== null
}
