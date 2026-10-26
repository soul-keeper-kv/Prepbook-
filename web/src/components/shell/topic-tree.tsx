import { useEffect, useMemo, useState } from "react"
import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  type DragTarget,
  type ItemInstance,
} from "@headless-tree/core"
import { useTree } from "@headless-tree/react"
import { ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LevelMeter, TopicDot } from "@/components/common/badges"
import { useNow } from "@/lib/clock"
import { KEYS, storage } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { useNotebook } from "@/notebook/hooks"
import {
  getLive,
  patternStatus,
  patternsOf,
  phaseOfPattern,
  phasesOf,
  topicsOf,
  type Level,
} from "@/notebook/logic"
import type { Notebook, TopicColor } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { href, navigate, useRoute } from "@/state/router"

// The sidebar tree, like Obsidian's file explorer: topic > phase > pattern. Dragging a row
// reorders the roadmap (or moves a pattern to another phase or topic). Built on Headless
// Tree, which brings keyboard navigation and the ARIA tree roles; the rows are drawn here.

const ROOT = "root"

type Node =
  | { kind: "root"; id: string }
  | { kind: "topic"; id: string; name: string; color: TopicColor }
  | { kind: "phase"; id: string; name: string; topicId: string }
  | { kind: "pattern"; id: string; name: string; topicId: string; level: Level; due: number }

interface Model {
  nodes: Map<string, Node>
  children: Map<string, string[]>
}

function buildModel(nb: Notebook, now: number): Model {
  const nodes = new Map<string, Node>([[ROOT, { kind: "root", id: ROOT }]])
  const children = new Map<string, string[]>()
  const topics = topicsOf(nb)
  children.set(
    ROOT,
    topics.map((t) => t.id)
  )
  for (const topic of topics) {
    nodes.set(topic.id, { kind: "topic", id: topic.id, name: topic.name, color: topic.color })
    const phases = phasesOf(nb, topic.id)
    const loose = patternsOf(nb, topic.id, null)
    children.set(topic.id, [...phases.map((p) => p.id), ...loose.map((p) => p.id)])
    for (const phase of phases) {
      nodes.set(phase.id, { kind: "phase", id: phase.id, name: phase.name, topicId: topic.id })
      const patterns = patternsOf(nb, topic.id, phase.id)
      children.set(
        phase.id,
        patterns.map((p) => p.id)
      )
    }
    for (const pattern of [...loose, ...phases.flatMap((ph) => patternsOf(nb, topic.id, ph.id))]) {
      const status = patternStatus(nb, pattern, now)
      nodes.set(pattern.id, {
        kind: "pattern",
        id: pattern.id,
        name: pattern.name,
        topicId: topic.id,
        level: status.level,
        due: status.due,
      })
    }
  }
  return { nodes, children }
}

function readExpanded(): string[] {
  const saved = storage.get(KEYS.treeExpanded)
  return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []
}

const insertionIndex = (target: DragTarget<Node>, fallback: number) =>
  "childIndex" in target ? target.insertionIndex : fallback

export function TopicTree({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const route = useRoute()
  const now = useNow()
  const model = useMemo(() => buildModel(nb, now), [nb, now])
  const [expanded, setExpanded] = useState<string[]>(readExpanded)
  const updateExpanded = (next: string[]) => setExpanded(next)

  useEffect(() => {
    storage.set(KEYS.treeExpanded, expanded)
  }, [expanded])

  // Opening a pattern or topic from elsewhere opens its folders in the tree, once per
  // navigation (adjusting state while rendering, as React recommends over an effect)
  const activeId = route.name === "pattern" || route.name === "topic" ? route.id : null
  const [revealed, setRevealed] = useState<string | null>(null)
  if (activeId !== revealed) {
    setRevealed(activeId)
    const pattern = activeId ? getLive(nb.patterns, activeId) : undefined
    const wanted = pattern
      ? [pattern.topicId, phaseOfPattern(nb, pattern)].filter((x): x is string => Boolean(x))
      : activeId
        ? [activeId]
        : []
    const missing = wanted.filter((id) => !expanded.includes(id))
    if (missing.length) setExpanded([...expanded, ...missing])
  }

  function canDrop(items: ItemInstance<Node>[], target: DragTarget<Node>): boolean {
    const dragged = items[0]?.getItemData()
    const parent = target.item.getItemData()
    if (!dragged || items.length !== 1) return false
    switch (dragged.kind) {
      case "topic":
        return parent.kind === "root" && "childIndex" in target
      case "phase":
        return parent.kind === "topic" && parent.id === dragged.topicId
      case "pattern":
        return parent.kind === "phase" || parent.kind === "topic"
      default:
        return false
    }
  }

  function onDrop(items: ItemInstance<Node>[], target: DragTarget<Node>) {
    const dragged = items[0]?.getItemData()
    const parent = target.item.getItemData()
    if (!dragged) return
    const siblings = model.children.get(parent.id) ?? []
    if (dragged.kind === "topic") {
      notebookActions.moveTopic(dragged.id, insertionIndex(target, siblings.length))
    } else if (dragged.kind === "phase" && parent.kind === "topic") {
      notebookActions.movePhase(dragged.id, insertionIndex(target, siblings.length))
    } else if (dragged.kind === "pattern" && parent.kind === "phase") {
      notebookActions.movePattern(
        dragged.id,
        parent.topicId,
        parent.id,
        insertionIndex(target, siblings.length)
      )
    } else if (dragged.kind === "pattern" && parent.kind === "topic") {
      // A topic lists its phases first, then the patterns in no phase
      const phases = siblings.filter((id) => model.nodes.get(id)?.kind === "phase").length
      const index = Math.max(0, insertionIndex(target, siblings.length) - phases)
      notebookActions.movePattern(dragged.id, parent.id, null, index)
    }
  }

  const tree = useTree<Node>({
    rootItemId: ROOT,
    state: { expandedItems: expanded },
    setExpandedItems: (updater) =>
      updateExpanded(typeof updater === "function" ? updater(expanded) : updater),
    getItemName: (item) => {
      const node = item.getItemData()
      return node.kind === "root" ? "" : node.name
    },
    isItemFolder: (item) => item.getItemData().kind !== "pattern",
    dataLoader: {
      getItem: (id) => model.nodes.get(id) ?? { kind: "root", id },
      getChildren: (id) => model.children.get(id) ?? [],
    },
    onPrimaryAction: (item) => {
      const node = item.getItemData()
      if (node.kind === "topic") navigate(href.topic(node.id))
      else if (node.kind === "pattern") navigate(href.pattern(node.id))
      else return
      onNavigate?.()
    },
    canReorder: true,
    canDrag: (items) => items.length === 1,
    canDrop,
    onDrop,
    indent: 12,
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature],
  })

  useEffect(() => {
    tree.rebuildTree()
  }, [model, expanded, tree])

  return (
    <div {...tree.getContainerProps(t("tree.label"))} className="relative outline-none">
      {tree.getItems().map((item) => {
        const node = item.getItemData()
        if (node.kind === "root") return null
        const level = item.getItemMeta().level
        const active = node.id === activeId
        const count = node.kind === "phase" ? (model.children.get(node.id)?.length ?? 0) : null
        // Long names are cut to fit the sidebar: hovering shows the whole name (and, for a
        // pattern, its level and what is due)
        const tooltip =
          node.kind === "pattern"
            ? [
                node.name,
                t(`level.${node.level}`),
                node.due ? t("tree.due", { count: node.due }) : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : node.kind === "phase"
              ? `${node.name} · ${t("tree.patterns", { count: count ?? 0 })}`
              : node.name
        return (
          <div
            {...item.getProps()}
            key={item.getId()}
            title={tooltip}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 pr-2 text-13 outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              active && "bg-info-bg text-link hover:bg-info-bg",
              item.isUnorderedDragTarget() && "bg-info-bg"
            )}
            style={{ paddingLeft: 6 + level * 12 }}
          >
            {item.isFolder() ? (
              <ChevronRightIcon
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform duration-100",
                  item.isExpanded() && "rotate-90"
                )}
              />
            ) : (
              <span className="w-3.5 shrink-0" aria-hidden />
            )}
            {node.kind === "topic" && <TopicDot color={node.color} />}
            {node.kind === "pattern" && <LevelMeter level={node.level} />}
            <span
              className={cn("min-w-0 flex-1 truncate", node.kind === "topic" && "font-semibold")}
            >
              {node.name}
            </span>
            {node.kind === "pattern" && node.due > 0 && (
              <span className="font-mono text-11 text-warn">{node.due}</span>
            )}
            {count !== null && <span className="font-mono text-11 text-faint">{count}</span>}
          </div>
        )
      })}
      <div style={tree.getDragLineStyle()} className="h-0.5 bg-primary" />
    </div>
  )
}
