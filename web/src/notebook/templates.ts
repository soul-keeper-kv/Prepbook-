import type { Lang } from "@/i18n/languages"
import type { TopicColor, TopicKind } from "@/notebook/schema"

/**
 * The note sections of a pattern page, by the kind of topic it belongs to. Problems done,
 * material read and interview questions are listed below them on every kind; they come from
 * the problems, resources and cards linked to the pattern, not from these sections.
 */
export const SECTION_TEMPLATES = {
  dsa: ["recognition", "idea", "template", "pitfalls"],
  concept: ["what", "how", "when", "pitfalls"],
  design: ["requirements", "estimates", "design", "deepDive", "tradeoffs"],
  story: ["situation", "task", "action", "result", "questions"],
} as const satisfies Record<TopicKind, readonly string[]>

export type SectionKey = (typeof SECTION_TEMPLATES)[TopicKind][number]

/** Sections whose text is mostly code: their editor is monospace */
export const CODE_SECTIONS: ReadonlySet<string> = new Set(["template"])

interface DefaultTopic {
  id: string
  name: Record<Lang, string>
  kind: TopicKind
  color: TopicColor
}

// Fixed ids: two devices starting fresh get the same six topics, not twelve
export const DEFAULT_TOPICS: DefaultTopic[] = [
  { id: "t_dsa", name: { vi: "DSA", en: "DSA" }, kind: "dsa", color: "blue" },
  { id: "t_java", name: { vi: "Java Core", en: "Java Core" }, kind: "concept", color: "orange" },
  {
    id: "t_db",
    name: { vi: "Database & SQL", en: "Database & SQL" },
    kind: "concept",
    color: "teal",
  },
  {
    id: "t_sd",
    name: { vi: "System Design", en: "System Design" },
    kind: "design",
    color: "purple",
  },
  {
    id: "t_spring",
    name: { vi: "Spring Boot", en: "Spring Boot" },
    kind: "concept",
    color: "green",
  },
  {
    id: "t_behavioral",
    name: { vi: "Hành vi (STAR)", en: "Behavioral (STAR)" },
    kind: "story",
    color: "pink",
  },
]

/** The topic the old DSA roadmap's suggestions belong to */
export const DSA_TOPIC_ID = "t_dsa"
