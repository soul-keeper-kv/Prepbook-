import { useTranslation } from "react-i18next"
import { CodeTemplates } from "@/components/detail/code-templates"
import { InlineText, Paragraphs } from "@/components/inline-text"
import { BulletList, EmptyNote, Section } from "@/components/section"
import { ResourceList } from "@/components/detail/resource-list"
import { useLocalize } from "@/content/localize"
import type { Example, Item } from "@/content/schema"

export function LearnTab({ item }: { item: Item }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const keyPoints = localize(item.keyPoints) ?? []
  const examples = localize(item.examples) ?? []
  const pitfalls = localize(item.pitfalls) ?? []
  const templates = item.template ?? []
  const resources = (item.resources ?? []).filter((r) => r.type !== "practice")

  const hasContent =
    item.description ||
    keyPoints.length ||
    examples.length ||
    templates.length ||
    item.complexity ||
    pitfalls.length ||
    resources.length
  if (!hasContent) return <EmptyNote>{t("learn.empty")}</EmptyNote>

  return (
    <>
      {item.description && (
        <Section title={t("block.description")}>
          <Paragraphs text={localize(item.description)} />
        </Section>
      )}
      {keyPoints.length > 0 && (
        <Section title={t("block.keyPoints")}>
          <BulletList
            items={keyPoints.map((x, i) => (
              <InlineText key={i} text={localize(x)} />
            ))}
          />
        </Section>
      )}
      {examples.length > 0 && (
        <Section title={t("block.examples")}>
          <div className="space-y-2">
            {examples.map((example, i) => (
              <ExampleCard key={i} example={example} />
            ))}
          </div>
        </Section>
      )}
      {templates.length > 0 && (
        <Section title={t("block.template")}>
          <CodeTemplates templates={templates} />
        </Section>
      )}
      {item.complexity && (
        <Section title={t("block.complexity")}>
          <p>
            <InlineText text={localize(item.complexity)} />
          </p>
        </Section>
      )}
      {pitfalls.length > 0 && (
        <Section title={t("block.pitfalls")}>
          <BulletList
            items={pitfalls.map((x, i) => (
              <InlineText key={i} text={localize(x)} />
            ))}
          />
        </Section>
      )}
      {resources.length > 0 && (
        <Section title={t("block.resources")}>
          <ResourceList resources={resources} />
        </Section>
      )}
    </>
  )
}

// Drawn like a terminal: input/output labels in the keyword colour, values in the editor colour
function ExampleCard({ example }: { example: Example }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const rows = [
    [t("example.input"), localize(example.input)],
    [t("example.output"), localize(example.output)],
  ] as const

  return (
    <div className="rounded-md border bg-code px-3.5 py-2.5">
      {example.title && (
        <div className="mb-1 text-14 font-semibold">
          <InlineText text={localize(example.title)} />
        </div>
      )}
      {rows.map(([label, value]) =>
        value ? (
          <div key={label} className="flex items-baseline gap-2 font-mono text-13 [&+&]:mt-0.5">
            <span className="w-13 shrink-0 text-syn-keyword">{label}</span>
            <code className="break-words whitespace-pre-wrap text-code-foreground">{value}</code>
          </div>
        ) : null
      )}
      {example.explain && (
        <p className="mt-1.5 text-13 text-muted-foreground">
          <InlineText text={localize(example.explain)} />
        </p>
      )}
    </div>
  )
}
