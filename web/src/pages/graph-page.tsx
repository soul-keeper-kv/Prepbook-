import { useEffect, useMemo, useRef, useState } from "react"
import { useNow } from "@/lib/clock"
import ForceGraph2D, { type NodeObject } from "react-force-graph-2d"
import { useTranslation } from "react-i18next"
import { TopicDot } from "@/components/common/badges"
import { PageHeader } from "@/components/common/page"
import { Checkbox } from "@/components/ui/checkbox"
import { useThemeStore } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { buildGraph, type GraphLink, type GraphNode } from "@/notebook/graph"
import { useNotebook, useSamples } from "@/notebook/hooks"
import { topicsOf } from "@/notebook/logic"
import { TOPIC_COLORS, type TopicColor } from "@/notebook/schema"
import { href, navigate } from "@/state/router"

// Obsidian-style graph of the notebook, drawn on a canvas by react-force-graph-2d (d3-force).
// The canvas cannot read Tailwind classes, so the colours are read from the theme's CSS
// variables and read again when the theme changes.

interface Palette {
  background: string
  text: string
  muted: string
  line: string
  topic: Record<TopicColor, string>
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    background: v("--card"),
    text: v("--foreground"),
    muted: v("--muted-foreground"),
    line: v("--border-strong"),
    topic: Object.fromEntries(TOPIC_COLORS.map((c) => [c, v(`--topic-${c}`)])) as Record<
      TopicColor,
      string
    >,
  }
}

/** #rrggbb with an alpha: faint for patterns not started, solid once got */
function withAlpha(hex: string, alpha: number) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x ?? "0", 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const LEVEL_ALPHA = [0.35, 0.65, 1, 1] as const

type Node = NodeObject<GraphNode>

export default function GraphPage() {
  const { t } = useTranslation()
  const nb = useNotebook()
  const theme = useThemeStore((s) => s.resolved)
  const now = useNow()
  const [hiddenTopics, setHiddenTopics] = useState<string[]>([])
  const [showProblems, setShowProblems] = useState(true)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const height = Math.max(360, Math.round(window.innerHeight * 0.65))

  // Read again whenever the theme switches
  const palette = useMemo(() => {
    void theme
    return readPalette()
  }, [theme])
  const samples = useSamples()
  const data = useMemo(
    () => buildGraph(nb, { hiddenTopics, showProblems }, now, samples),
    [nb, hiddenTopics, showProblems, now, samples]
  )

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const nodeColor = (n: Node) =>
    n.kind === "problem"
      ? withAlpha(palette.topic.gray, n.level ? 0.8 : 0.4)
      : withAlpha(palette.topic[n.color], n.kind === "topic" ? 1 : LEVEL_ALPHA[n.level])

  return (
    <>
      <PageHeader title={t("nav.graph")}>
        <p className="mt-1 text-14 text-muted-foreground">{t("graph.intro")}</p>
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {topicsOf(nb).map((topic) => {
          const on = !hiddenTopics.includes(topic.id)
          return (
            <button
              key={topic.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setHiddenTopics((h) => (on ? [...h, topic.id] : h.filter((id) => id !== topic.id)))
              }
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-13 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-border-strong" : "border-dashed text-faint"
              )}
            >
              <TopicDot color={topic.color} className={cn(!on && "opacity-40")} />
              {topic.name}
            </button>
          )
        })}
        <label className="flex cursor-pointer items-center gap-2 text-13">
          <Checkbox checked={showProblems} onCheckedChange={(c) => setShowProblems(c === true)} />
          {t("graph.showProblems")}
        </label>
      </div>
      <div
        ref={box}
        role="img"
        aria-label={t("graph.label", {
          patterns: data.nodes.filter((n) => n.kind === "pattern").length,
        })}
        className="overflow-hidden rounded-md border"
      >
        <ForceGraph2D<GraphNode, GraphLink>
          graphData={data}
          width={width}
          height={height}
          backgroundColor={palette.background}
          nodeRelSize={4}
          nodeVal={(n) => n.size}
          nodeLabel={(n) => n.name}
          nodeColor={nodeColor}
          linkColor={(l) => (l.kind === "requires" ? palette.muted : palette.line)}
          linkLineDash={(l) => (l.kind === "related" ? [3, 3] : null)}
          linkWidth={(l) => (l.kind === "requires" ? 1.5 : 1)}
          linkDirectionalArrowLength={(l) => (l.kind === "requires" ? 5 : 0)}
          linkDirectionalArrowRelPos={1}
          cooldownTicks={120}
          onNodeClick={(n) => {
            if (n.kind === "topic") navigate(href.topic(n.id))
            else if (n.kind === "pattern") navigate(href.pattern(n.id))
            else navigate(href.problem(n.id))
          }}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(n, ctx, scale) => {
            // Labels like Obsidian: topics always, patterns once zoomed a little, problems late
            const minScale = n.kind === "topic" ? 0 : n.kind === "pattern" ? 1.2 : 2.5
            if (scale < minScale || n.x === undefined || n.y === undefined) return
            const size = (n.kind === "topic" ? 13 : 11) / scale
            ctx.font = `${n.kind === "topic" ? "600 " : ""}${size}px system-ui, sans-serif`
            ctx.textAlign = "center"
            ctx.textBaseline = "top"
            ctx.fillStyle = n.kind === "problem" ? palette.muted : palette.text
            ctx.fillText(n.name, n.x, n.y + Math.sqrt(n.size) * 4 + 2 / scale)
          }}
        />
      </div>
      <p className="mt-2 text-12 text-faint">{t("graph.legend")}</p>
    </>
  )
}
