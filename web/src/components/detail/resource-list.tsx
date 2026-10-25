import { useTranslation } from "react-i18next"
import { LINK_ROW } from "@/components/section"
import { RESOURCE_TONE, Tag } from "@/components/tag"
import { useLocalize } from "@/content/localize"
import type { Resource } from "@/content/schema"

export function ResourceList({ resources }: { resources: Resource[] }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  return (
    <ul>
      {resources.map((resource, i) => (
        <li key={`${resource.url}#${i}`} className={LINK_ROW}>
          <Tag
            shape="pill"
            tone={RESOURCE_TONE[resource.type]}
            className="min-w-19 shrink-0 text-center"
          >
            {t(`resource.${resource.type}`)}
          </Tag>
          <a
            className="min-w-0 flex-1"
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {localize(resource.title)}
          </a>
        </li>
      ))}
    </ul>
  )
}
