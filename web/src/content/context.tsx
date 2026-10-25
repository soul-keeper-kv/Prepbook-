import { createContext, useContext, type ReactNode } from "react"
import type { Content } from "@/content/load"

const ContentContext = createContext<Content | null>(null)

export function ContentProvider({ content, children }: { content: Content; children: ReactNode }) {
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
}

export function useContent(): Content {
  const content = useContext(ContentContext)
  if (!content) throw new Error("useContent must be used inside <ContentProvider>")
  return content
}
