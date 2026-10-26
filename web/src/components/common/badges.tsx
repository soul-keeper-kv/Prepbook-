import { CircleCheckIcon, CircleDashedIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tag, type Tone } from "@/components/tag"
import type { Level } from "@/notebook/logic"
import type { Outcome, TopicColor } from "@/notebook/schema"
import { cn } from "@/lib/utils"

// Small marks shared by every screen: a topic's colour dot, a pattern's level, how an
// attempt went. Class names are written out in full so Tailwind finds them.

const TOPIC_BG: Record<TopicColor, string> = {
  blue: "bg-topic-blue",
  orange: "bg-topic-orange",
  teal: "bg-topic-teal",
  purple: "bg-topic-purple",
  green: "bg-topic-green",
  pink: "bg-topic-pink",
  gray: "bg-topic-gray",
}

export function TopicDot({ color, className }: { color: TopicColor; className?: string }) {
  return (
    <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", TOPIC_BG[color], className)} />
  )
}

export const LEVEL_TONE: Record<Level, Tone> = { 0: "neutral", 1: "link", 2: "ok", 3: "ok" }

export function LevelTag({ level, className }: { level: Level; className?: string }) {
  const { t } = useTranslation()
  return (
    <Tag tone={LEVEL_TONE[level]} className={className}>
      {t(`level.${level}`)}
    </Tag>
  )
}

/** Three bars that fill up with the level, plus its name for screen readers */
export function LevelMeter({ level, className }: { level: Level; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      role="img"
      aria-label={t(`level.${level}`)}
      title={t(`level.${level}`)}
      className={cn("inline-flex shrink-0 items-end gap-0.5", className)}
    >
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            "w-1 rounded-[1px]",
            step === 1 ? "h-1.5" : step === 2 ? "h-2.5" : "h-3.5",
            level >= step ? (level === 1 ? "bg-link" : "bg-ok-fill") : "bg-border-strong"
          )}
        />
      ))}
    </span>
  )
}

export const OUTCOME_TONE: Record<Outcome | "todo", Tone> = {
  alone: "ok",
  hint: "warn",
  solution: "danger",
  todo: "neutral",
}

export function OutcomeTag({
  outcome,
  className,
}: {
  outcome: Outcome | "todo"
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Tag shape="pill" tone={OUTCOME_TONE[outcome]} className={className}>
      {t(`outcome.${outcome}`)}
    </Tag>
  )
}

/** Whether a problem is done yet, and how its latest attempt went: derived, never set by hand */
export function ProblemStatusTag({ outcome }: { outcome: Outcome | "todo" }) {
  const { t } = useTranslation()
  const Icon = outcome === "todo" ? CircleDashedIcon : CircleCheckIcon
  return (
    <Tag
      tone={OUTCOME_TONE[outcome]}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-13 font-semibold"
    >
      <Icon className="size-3.5" aria-hidden />
      {t(`problemStatus.${outcome}`)}
    </Tag>
  )
}

const OUTCOME_BAR: Record<Outcome | "todo", string> = {
  alone: "bg-ok-fill",
  hint: "bg-warn",
  solution: "bg-destructive",
  todo: "bg-border-strong",
}

/** One segment per problem, by how its latest attempt went */
export function OutcomeBar({ counts }: { counts: Record<Outcome | "todo", number> }) {
  const { t } = useTranslation()
  const order = ["alone", "hint", "solution", "todo"] as const
  const label = order
    .filter((o) => counts[o])
    .map((o) => `${counts[o]} ${t(`outcome.${o}`)}`)
    .join(", ")
  if (!label) return null
  return (
    <div role="img" aria-label={label} className="flex h-2 gap-0.5">
      {order.map((o) =>
        counts[o] ? (
          <span
            key={o}
            className={cn("rounded-[2px]", OUTCOME_BAR[o])}
            style={{ flexGrow: counts[o] }}
          />
        ) : null
      )}
    </div>
  )
}

const LEVEL_SEGMENT = ["bg-border-strong", "bg-link", "bg-ok-fill", "bg-ok"] as const

/** A topic's patterns by level: mastered, got it, learning, not started */
export function LevelBar({ byLevel }: { byLevel: [number, number, number, number] }) {
  const { t } = useTranslation()
  const total = byLevel.reduce((a, b) => a + b, 0)
  const label = ([3, 2, 1, 0] as const)
    .filter((l) => byLevel[l])
    .map((l) => `${byLevel[l]} ${t(`level.${l}`)}`)
    .join(", ")
  return (
    <div role="img" aria-label={label || t("level.none")} className="flex h-1.5 gap-0.5">
      {total === 0 ? (
        <span className="flex-1 rounded-full bg-border-strong" />
      ) : (
        ([3, 2, 1, 0] as const).map((l) =>
          byLevel[l] ? (
            <span
              key={l}
              className={cn("rounded-full", LEVEL_SEGMENT[l])}
              style={{ flexGrow: byLevel[l] }}
            />
          ) : null
        )
      )}
    </div>
  )
}

export function LevelBadgeForProblemLevel({ level }: { level: string }) {
  if (!level) return null
  const tone: Tone =
    level === "easy" ? "ok" : level === "medium" ? "warn" : level === "hard" ? "danger" : "neutral"
  return (
    <Tag shape="pill" tone={tone}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </Tag>
  )
}
