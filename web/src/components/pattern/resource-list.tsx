import { useId, useState } from "react"
import { ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { INPUT, NoteEditor, SELECT } from "@/components/common/editing"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isHttpUrl, toHref } from "@/notebook/ids"
import { useNotebook } from "@/notebook/hooks"
import { resourcesOf } from "@/notebook/logic"
import { RESOURCE_KINDS, type Pattern, type ResourceKind } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { guessResourceKind } from "@/pages/inbox-page"

function AddResourceForm({ pattern }: { pattern: Pattern }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<ResourceKind | "">("")
  const kindId = useId()
  const valid = isHttpUrl(url)

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        notebookActions.addResource({
          url: toHref(url),
          title,
          kind: kind || guessResourceKind(url),
          patternIds: [pattern.id],
        })
        setUrl("")
        setTitle("")
        setKind("")
      }}
    >
      <input
        aria-label={t("resource.url")}
        className={cn(INPUT, "flex-[2_1_220px]")}
        inputMode="url"
        value={url}
        placeholder={t("resource.urlPlaceholder")}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        aria-label={t("resource.title")}
        className={cn(INPUT, "flex-[2_1_180px]")}
        value={title}
        placeholder={t("resource.titlePlaceholder")}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label htmlFor={kindId} className="sr-only">
        {t("resource.kindLabel")}
      </label>
      <select
        id={kindId}
        className={SELECT}
        value={kind || (valid ? guessResourceKind(url) : "article")}
        onChange={(e) => setKind(e.target.value as ResourceKind)}
      >
        {RESOURCE_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`resourceKind.${k}`)}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={!valid}>
        <PlusIcon />
        {t("resource.add")}
      </Button>
    </form>
  )
}

export function ResourceList({ pattern }: { pattern: Pattern }) {
  const { t } = useTranslation()
  const resources = resourcesOf(useNotebook(), pattern.id)
  return (
    <>
      {resources.length ? (
        <ul className="space-y-3">
          {resources.map((r) => (
            <li key={r.id} className="rounded-md border px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Tag shape="pill" tone="neutral">
                  {t(`resourceKind.${r.kind}`)}
                </Tag>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1 font-medium"
                >
                  <span className="truncate">{r.title}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                </a>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("resource.unlink", { name: r.title })}
                  onClick={() => notebookActions.unlinkResource(r.id, pattern.id)}
                >
                  <XIcon />
                </Button>
              </div>
              <NoteEditor
                value={r.takeaway}
                label={t("resource.takeaway", { name: r.title })}
                placeholder={t("resource.takeawayPlaceholder")}
                emptyText={t("resource.takeawayEmpty")}
                onChange={(takeaway) => notebookActions.updateResource(r.id, { takeaway })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-14 text-faint">{t("resource.none")}</p>
      )}
      <AddResourceForm pattern={pattern} />
    </>
  )
}
