import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Small labels: "tag" is square (Theory / Review due), "pill" is round
// (resource type, difficulty). Class names are written out in full so Tailwind finds them.
const TONES = {
  link: "bg-info-bg text-link",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-destructive",
  purple: "bg-purple-bg text-purple",
  neutral: "bg-muted text-muted-foreground",
} as const

export type Tone = keyof typeof TONES

const LEVEL_TONE: Record<string, Tone> = {
  easy: "ok",
  medium: "warn",
  hard: "danger",
  advanced: "danger",
  expert: "danger",
}

export const levelTone = (level: string): Tone => LEVEL_TONE[level.toLowerCase()] ?? "neutral"

interface TagProps {
  tone: Tone
  shape?: "tag" | "pill"
  className?: string
  children: ReactNode
}

export function Tag({ tone, shape = "tag", className, children }: TagProps) {
  return (
    <span
      className={cn(
        "inline-block py-px font-mono text-11 leading-[1.6] whitespace-nowrap",
        shape === "pill" ? "rounded-full px-2" : "rounded-[3px] px-1.5",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
