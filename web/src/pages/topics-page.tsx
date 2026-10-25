import { NetworkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { InlineAdd } from "@/components/common/editing"
import { PageHeader } from "@/components/common/page"
import { TopicTree } from "@/components/shell/topic-tree"
import { Button } from "@/components/ui/button"
import { notebookActions } from "@/notebook/store"
import { href, navigate } from "@/state/router"

/** The tree on its own page: how the phone reaches topics and patterns */
export function TopicsPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader
        title={t("nav.topics")}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={href.graph} className="no-underline hover:no-underline">
                <NetworkIcon />
                {t("nav.graph")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={href.settings} className="no-underline hover:no-underline">
                {t("nav.settings")}
              </a>
            </Button>
          </>
        }
      >
        <p className="mt-1 text-14 text-muted-foreground">{t("topics.intro")}</p>
      </PageHeader>
      <div className="max-w-160 rounded-md border bg-background py-1">
        <TopicTree />
      </div>
      <InlineAdd
        className="mt-4 max-w-160"
        label={t("topic.add")}
        placeholder={t("topic.namePlaceholder")}
        onAdd={(name) => navigate(href.topic(notebookActions.addTopic(name, "concept", "gray")))}
      />
    </>
  )
}
