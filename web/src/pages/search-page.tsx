import { useState } from "react"
import { useTranslation } from "react-i18next"
import { INPUT } from "@/components/common/editing"
import { PageHeader } from "@/components/common/page"
import { Tag, type Tone } from "@/components/tag"
import { useNotebook } from "@/notebook/hooks"
import { search, type SearchHit } from "@/notebook/logic"
import { href } from "@/state/router"

const KIND_TONE: Record<SearchHit["kind"], Tone> = {
  topic: "purple",
  pattern: "link",
  problem: "ok",
  resource: "neutral",
}

function hitHref(hit: SearchHit): string {
  switch (hit.kind) {
    case "topic":
      return href.topic(hit.id)
    case "pattern":
      return href.pattern(hit.id)
    case "problem":
      return href.problem(hit.id)
    case "resource":
      return hit.patternId ? href.pattern(hit.patternId) : hit.url
  }
}

/** Search every note: pattern sections, problems and attempts, material read. Accents optional. */
export function SearchPage() {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [query, setQuery] = useState("")
  const hits = search(nb, query)

  return (
    <>
      <PageHeader title={t("nav.search")} />
      <input
        autoFocus
        type="search"
        aria-label={t("search.label")}
        className={`${INPUT} mb-4 h-10 max-w-160 text-15`}
        value={query}
        placeholder={t("search.placeholder")}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() &&
        (hits.length ? (
          <ul className="max-w-160 rounded-md border bg-card">
            {hits.map((hit) => (
              <li
                key={`${hit.kind}-${hit.id}`}
                className="flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0"
              >
                <Tag tone={KIND_TONE[hit.kind]}>{t(`search.kind.${hit.kind}`)}</Tag>
                <a href={hitHref(hit)} className="min-w-0 flex-1 truncate">
                  {hit.title}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-14 text-faint">{t("search.none")}</p>
        ))}
      {!query.trim() && <p className="text-13 text-faint">{t("search.hint")}</p>}
    </>
  )
}
