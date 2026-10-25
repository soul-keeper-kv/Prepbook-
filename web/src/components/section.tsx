import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Small uppercase caption, like the panel titles in VS Code's side bar (EXPLORER, OUTLINE) */
export const LABEL =
  "font-mono text-11 font-semibold tracking-[.08em] text-muted-foreground uppercase"

/** A block of the detail dialog, titled like a Markdown heading: ## DESCRIPTION */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={cn(LABEL, "mb-2 before:text-syn-keyword before:content-['##_']")}>{title}</h3>
      {children}
    </section>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-14 text-faint">{children}</p>
}

/** Markdown-style "-" bullets */
export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li
          key={i}
          className="relative pl-4 before:absolute before:left-0.5 before:font-mono before:text-syn-keyword before:content-['-']"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

/** One row of a link list (resources, problems) */
export const LINK_ROW = "flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b py-1.75"
