import { useTranslation } from "react-i18next"
import { CodeBlock } from "@/components/code-block"
import { CopyButton } from "@/components/copy-button"
import {
  FileTabs,
  FileTabsContent,
  FileTabsList,
  FileTabsTrigger,
  TabIcon,
} from "@/components/file-tabs"
import { codeFile, codeLangLabel } from "@/content/code-langs"
import { codeText, useLocalize } from "@/content/localize"
import type { Template } from "@/content/schema"
import { uiActions, useUiStore } from "@/state/ui"

/**
 * Several languages in one editor frame, as in VS Code: each language is a file tab
 * (solution.py, Solution.java...). The chosen language is remembered for every item.
 */
export function CodeTemplates({ templates }: { templates: Template[] }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const codeLang = useUiStore((s) => s.codeLang)
  const active = templates.some((tpl) => tpl.lang === codeLang)
    ? codeLang
    : (templates[0]?.lang ?? "")
  const code = (tpl: Template) => codeText(localize(tpl.code))
  const activeTemplate = templates.find((tpl) => tpl.lang === active)

  return (
    <FileTabs
      value={active}
      onValueChange={uiActions.setCodeLang}
      className="overflow-hidden rounded-md border border-border-strong"
    >
      <div className="flex items-stretch bg-code-bar">
        <FileTabsList aria-label={t("block.template")}>
          {templates.map((tpl) => {
            const file = codeFile(tpl.lang)
            return (
              <FileTabsTrigger
                key={tpl.lang}
                value={tpl.lang}
                aria-label={codeLangLabel(tpl.lang)}
                className="gap-1.5 border-r-border bg-code-tab px-3 py-1.5 font-mono text-12 data-[state=active]:bg-code"
              >
                <TabIcon className={file.iconClass}>{file.icon}</TabIcon>
                {file.name}
              </FileTabsTrigger>
            )
          })}
        </FileTabsList>
        {activeTemplate && <CopyButton text={code(activeTemplate)} className="ml-auto" />}
      </div>
      {templates.map((tpl) => (
        <FileTabsContent key={tpl.lang} value={tpl.lang} className="outline-none">
          <CodeBlock code={code(tpl)} lang={tpl.lang} />
        </FileTabsContent>
      ))}
    </FileTabs>
  )
}
