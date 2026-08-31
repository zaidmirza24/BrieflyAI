import { useEffect } from "react"

const BASE = "Mentor-Mentee Insights"

/** Sets `document.title` to `<title> · Mentor-Mentee Insights` while mounted. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE
    return () => {
      document.title = BASE
    }
  }, [title])
}
