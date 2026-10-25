import { useState } from "react"
import { useNow } from "@/lib/clock"
import { EyeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { OutcomeTag, TopicDot } from "@/components/common/badges"
import { Markdown } from "@/components/common/markdown"
import { PageHeader, Panel } from "@/components/common/page"
import { Button } from "@/components/ui/button"
import { dueText } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useNotebook } from "@/notebook/hooks"
import { cardDueAt, dueCards, dueProblems, getLive } from "@/notebook/logic"
import { GRADES, type Card, type Grade } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { href } from "@/state/router"

const GRADE_STYLE: Record<Grade, string> = {
  forgot: "border-destructive/50 hover:bg-danger-bg",
  fuzzy: "border-warn/50 hover:bg-warn-bg",
  solid: "border-ok-fill/60 hover:bg-ok-bg",
}

/** Days until the card comes back if graded this way now */
function nextInDays(card: Card, grade: Grade): number {
  const now = new Date().toISOString()
  const next = cardDueAt({ ...card, reviews: [...card.reviews, { at: now, grade }] })
  return Math.round((Date.parse(next) - Date.parse(now)) / 86_400_000)
}

/** One card at a time: recall the answer aloud, then reveal what I wrote and grade myself */
function CardDrill({ cards }: { cards: Card[] }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const card = cards[0]
  if (!card) {
    return (
      <p className="text-14 text-muted-foreground">
        {done ? t("review.cardsDone", { count: done }) : t("review.noCards")}
      </p>
    )
  }
  const pattern = getLive(nb.patterns, card.patternId)
  const topic = getLive(nb.topics, pattern?.topicId)

  function grade(g: Grade) {
    notebookActions.gradeCard(card!.id, g)
    setRevealed(false)
    setDone((n) => n + 1)
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-12 text-muted-foreground">
        {topic && <TopicDot color={topic.color} />}
        {pattern && <a href={href.pattern(pattern.id)}>{pattern.name}</a>}
        <span className="ml-auto font-mono">{t("review.left", { count: cards.length })}</span>
      </div>
      <p className="mb-3 text-15 font-semibold whitespace-pre-line">{card.question}</p>
      {revealed ? (
        <>
          <div className="mb-4 rounded-md border bg-background px-3.5 py-3">
            {card.answer.trim() ? (
              <Markdown text={card.answer} />
            ) : (
              <p className="text-14 text-faint">{t("review.noAnswer")}</p>
            )}
          </div>
          <p className="mb-2 text-13 text-muted-foreground">{t("review.gradePrompt")}</p>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => grade(g)}
                className={cn(
                  "flex min-h-11 min-w-28 cursor-pointer flex-col items-center justify-center rounded-md border px-3 py-1.5 text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  GRADE_STYLE[g]
                )}
              >
                <span className="font-medium">{t(`grade.${g}`)}</span>
                <span className="font-mono text-11 text-muted-foreground">
                  {t("review.nextIn", { count: nextInDays(card, g) })}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <Button onClick={() => setRevealed(true)}>
          <EyeIcon />
          {t("review.reveal")}
        </Button>
      )}
    </div>
  )
}

export function ReviewPage() {
  const { t } = useTranslation()
  const nb = useNotebook()
  const now = useNow()
  const problems = dueProblems(nb, now)
  const cards = dueCards(nb, now).map((d) => d.card)

  return (
    <>
      <PageHeader title={t("nav.review")}>
        <p className="mt-1 text-14 text-muted-foreground">{t("review.intro")}</p>
      </PageHeader>
      <div className="flex flex-wrap items-start gap-4">
        <Panel
          title={t("review.problems", { count: problems.length })}
          className="min-w-0 flex-[1_1_380px]"
        >
          {problems.length ? (
            <ul className="-my-1">
              {problems.map(({ problem, dueAt, last, overdue }) => (
                <li
                  key={problem.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <a href={href.problem(problem.id)} className="font-medium">
                      {problem.title}
                    </a>
                    <div className="flex flex-wrap items-center gap-2 text-12 text-muted-foreground">
                      <span className={cn(overdue > 0 && "text-warn")}>
                        {dueText(dueAt, t, now)}
                      </span>
                      {last && (
                        <>
                          <span>·</span>
                          <span>{t("review.lastTime")}</span>
                          <OutcomeTag outcome={last.outcome} />
                        </>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`${href.problem(problem.id)}`}
                      className="no-underline hover:no-underline"
                    >
                      {t("review.redo")}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-14 text-muted-foreground">{t("review.noProblems")}</p>
          )}
        </Panel>
        <Panel
          title={t("review.cards", { count: cards.length })}
          className="min-w-0 flex-[1_1_380px]"
        >
          <CardDrill cards={cards} />
        </Panel>
      </div>
      <p className="mt-4 text-12 text-faint">{t("review.rules")}</p>
    </>
  )
}
