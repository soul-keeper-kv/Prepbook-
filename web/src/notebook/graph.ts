import {
  attemptsOf,
  getLive,
  liveValues,
  patternStatus,
  patternsOfTopic,
  topicsOf,
  type Level,
  type SampleTexts,
} from "@/notebook/logic"
import type { Notebook, TopicColor } from "@/notebook/schema"

// Nodes and links of the graph view, like Obsidian's: topics, patterns and problems, joined
// by what the notebook says (in a topic, learn first, related, practised by).

export type GraphNodeKind = "topic" | "pattern" | "problem"
export type GraphLinkKind = "topic" | "requires" | "related" | "problem"

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  name: string
  color: TopicColor
  level: Level
  /** Drawn area: topics are big, patterns grow with their problems */
  size: number
}

export interface GraphLink {
  source: string
  target: string
  kind: GraphLinkKind
}

export interface GraphOptions {
  /** Topics left out of the graph */
  hiddenTopics: string[]
  showProblems: boolean
}

export function buildGraph(nb: Notebook, options: GraphOptions, now: number, samples: SampleTexts) {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const shown = new Set<string>()

  for (const topic of topicsOf(nb)) {
    if (options.hiddenTopics.includes(topic.id)) continue
    nodes.push({
      id: topic.id,
      kind: "topic",
      name: topic.name,
      color: topic.color,
      level: 0,
      size: 8,
    })
    for (const pattern of patternsOfTopic(nb, topic.id)) {
      const status = patternStatus(nb, pattern, now, samples)
      nodes.push({
        id: pattern.id,
        kind: "pattern",
        name: pattern.name,
        color: topic.color,
        level: status.level,
        size: 2 + Math.min(status.problems, 12) * 0.5,
      })
      shown.add(pattern.id)
      links.push({ source: topic.id, target: pattern.id, kind: "topic" })
    }
  }

  const relatedSeen = new Set<string>()
  for (const id of shown) {
    const pattern = getLive(nb.patterns, id)
    if (!pattern) continue
    for (const req of pattern.requires) {
      if (shown.has(req)) links.push({ source: req, target: id, kind: "requires" })
    }
    for (const rel of pattern.related) {
      const key = [id, rel].sort().join("|")
      if (shown.has(rel) && !relatedSeen.has(key)) {
        relatedSeen.add(key)
        links.push({ source: id, target: rel, kind: "related" })
      }
    }
  }

  if (options.showProblems) {
    for (const problem of liveValues(nb.problems)) {
      const patterns = problem.patternIds.filter((p) => shown.has(p))
      if (!patterns.length) continue
      const last = attemptsOf(nb, problem.id).at(-1)
      nodes.push({
        id: problem.id,
        kind: "problem",
        name: problem.title,
        color: "gray",
        level: !last ? 0 : last.outcome === "alone" ? 2 : 1,
        size: 1,
      })
      for (const p of patterns) links.push({ source: p, target: problem.id, kind: "problem" })
    }
  }
  return { nodes, links }
}
