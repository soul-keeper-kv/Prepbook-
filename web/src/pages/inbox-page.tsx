import { useId, useState } from "react"
import { ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { INPUT, SELECT } from "@/components/common/editing"
import { PageHeader } from "@/components/common/page"
import { PatternPicker } from "@/components/common/pattern-picker"
import { Button } from "@/components/ui/button"
import { useContent } from "@/content/context"
import { timeAgo } from "@/lib/time"
import { isHttpUrl, toHref } from "@/notebook/ids"
import { useLang, useNotebook } from "@/notebook/hooks"
import { inboxOf } from "@/notebook/logic"
import { RESOURCE_KINDS, type InboxItem, type ResourceKind } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { lookupUrl } from "@/notebook/suggestions"
import { href, navigate } from "@/state/router"

export const PROBLEM_LEVELS = ["easy", "medium", "hard"] as const

export function guessResourceKind(url: string): ResourceKind {
  const host = (() => {
    try {
      return new URL(toHref(url)).hostname
    } catch {
      return ""
    }
  })()
  if (/youtube\.com$|youtu\.be$|vimeo\.com$/.test(host)) return "video"
  if (/^docs\.|developer\.|\.readthedocs\.io$/.test(host)) return "docs"
  if (/coursera|udemy|educative|edx/.test(host)) return "course"
  return "article"
}

/** Paste a link, file it later: the first step of Find -> Solve -> Note -> Review */
export function InboxQuickAdd({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const content = useContent()
  const nb = useNotebook()
  const lang = useLang()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const urlId = useId()
  const known = url.trim() && isHttpUrl(url) ? lookupUrl(content, nb, toHref(url), lang) : null

  function add() {
    if (!url.trim()) return
    notebookActions.addInbox(toHref(url), title || known?.title || "")
    setUrl("")
    setTitle("")
    toast.success(t("inbox.added"))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
      className="space-y-2"
    >
      <label htmlFor={urlId} className="sr-only">
        {t("inbox.url")}
      </label>
      <div className="flex gap-2">
        <input
          id={urlId}
          className={INPUT}
          inputMode="url"
          value={url}
          placeholder={t("inbox.urlPlaceholder")}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          type="submit"
          disabled={!url.trim()}
          aria-label={compact ? t("inbox.add") : undefined}
        >
          <PlusIcon />
          {!compact && t("inbox.add")}
        </Button>
      </div>
      {!compact && (
        <input
          aria-label={t("inbox.title")}
          className={INPUT}
          value={title}
          placeholder={known?.title || t("inbox.titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      {known && (
        <p className="text-12 text-muted-foreground">
          {t("inbox.known", { title: known.title, level: known.level || "—" })}
        </p>
      )}
    </form>
  )
}

function FileForm({
  item,
  mode,
  onClose,
}: {
  item: InboxItem
  mode: "problem" | "resource"
  onClose: () => void
}) {
  const { t } = useTranslation()
  const content = useContent()
  const nb = useNotebook()
  const lang = useLang()
  const match = lookupUrl(content, nb, item.url, lang)
  const [title, setTitle] = useState(item.title || match?.title || "")
  const [level, setLevel] = useState(match?.level ?? "")
  const [kind, setKind] = useState<ResourceKind>(() => guessResourceKind(item.url))
  const [patternIds, setPatternIds] = useState<string[]>(match?.patternId ? [match.patternId] : [])
  const levelId = useId()
  const kindId = useId()

  function save() {
    if (mode === "problem") {
      const id = notebookActions.fileAsProblem(item.id, { url: item.url, title, level, patternIds })
      toast.success(t("inbox.filedProblem"), {
        action: { label: t("inbox.open"), onClick: () => navigate(href.problem(id)) },
      })
    } else {
      notebookActions.fileAsResource(item.id, { url: item.url, title, kind, patternIds })
      toast.success(t("inbox.filedResource"))
    }
    onClose()
  }

  return (
    <form
      className="mt-2.5 space-y-3 rounded-md border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <input
        aria-label={t("inbox.title")}
        className={INPUT}
        value={title}
        placeholder={t("inbox.titlePlaceholder")}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {mode === "problem" ? (
          <>
            <label htmlFor={levelId} className="text-13">
              {t("problem.level")}
            </label>
            <select
              id={levelId}
              className={SELECT}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">—</option>
              {PROBLEM_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`problemLevel.${l}`)}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor={kindId} className="text-13">
              {t("resource.kindLabel")}
            </label>
            <select
              id={kindId}
              className={SELECT}
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
            >
              {RESOURCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`resourceKind.${k}`)}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <PatternPicker value={patternIds} onChange={setPatternIds} label={t("inbox.patterns")} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!patternIds.length}>
          {t("inbox.save")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("confirm.cancel")}
        </Button>
        {!patternIds.length && <span className="text-12 text-faint">{t("inbox.pickPattern")}</span>}
      </div>
    </form>
  )
}

function InboxRow({ item }: { item: InboxItem }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<"problem" | "resource" | null>(null)
  return (
    <li className="border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 font-medium"
          >
            <span className="truncate">{item.title || item.url}</span>
            <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
          </a>
          <div className="truncate font-mono text-12 text-faint">
            {item.title ? `${item.url} · ` : ""}
            {timeAgo(item.createdAt, t)}
          </div>
          {item.note && <p className="mt-1 text-13 text-muted-foreground">{item.note}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={mode === "problem" ? "default" : "outline"}
            onClick={() => setMode(mode === "problem" ? null : "problem")}
          >
            {t("inbox.asProblem")}
          </Button>
          <Button
            size="sm"
            variant={mode === "resource" ? "default" : "outline"}
            onClick={() => setMode(mode === "resource" ? null : "resource")}
          >
            {t("inbox.asResource")}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("inbox.delete", { name: item.title || item.url })}
            onClick={() => notebookActions.deleteInbox(item.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      {mode && <FileForm key={mode} item={item} mode={mode} onClose={() => setMode(null)} />}
    </li>
  )
}

export function InboxPage() {
  const { t } = useTranslation()
  const nb = useNotebook()
  const items = inboxOf(nb)
  return (
    <>
      <PageHeader title={t("nav.inbox")}>
        <p className="mt-1 text-14 text-muted-foreground">{t("inbox.intro")}</p>
      </PageHeader>
      <div className="mb-6 max-w-160">
        <InboxQuickAdd />
      </div>
      {items.length ? (
        <ul className="rounded-md border bg-card px-4">
          {items.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-14 text-faint">{t("inbox.empty")}</p>
      )}
    </>
  )
}
