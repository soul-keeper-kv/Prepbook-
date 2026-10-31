import { useState } from "react"
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MarkdownInline } from "@/components/common/markdown"
import { LABEL } from "@/components/section"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { QuizQuestion } from "@/notebook/lesson"

/**
 * Recognition practice: one question at a time; picking an option shows at once whether it
 * was right, and why. Nothing is saved: it is practice, not a level.
 */
export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null))
  const question = questions[index]
  if (!question) return null
  const choice = picked[index] ?? null
  const answered = picked.filter((p) => p !== null).length
  const right = picked.filter((p, i) => p === questions[i]?.answer).length

  function pick(option: number) {
    setPicked((list) => list.map((p, i) => (i === index ? option : p)))
  }

  return (
    <section className="rounded-md border bg-background px-3 py-2.5" aria-label={t("quiz.title")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3">
        <h4 className={cn(LABEL, "flex-1")}>{t("quiz.title")}</h4>
        <span className="font-mono text-12 text-muted-foreground">
          {t("quiz.progress", { n: index + 1, total: questions.length, right, answered })}
        </span>
      </div>
      <p className="mb-2 text-14 font-medium">
        <MarkdownInline text={question.question} />
      </p>
      <div role="radiogroup" aria-label={question.question} className="grid gap-1.5">
        {question.options.map((option, i) => {
          const state =
            choice === null
              ? "idle"
              : i === question.answer
                ? "right"
                : i === choice
                  ? "wrong"
                  : "idle"
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={choice === i}
              disabled={choice !== null}
              onClick={() => pick(i)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-left text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:cursor-pointer enabled:hover:bg-muted max-md:min-h-11",
                state === "right" && "border-ok bg-ok-bg",
                state === "wrong" && "border-destructive bg-danger-bg"
              )}
            >
              {state === "right" ? (
                <CheckIcon aria-hidden className="size-4 shrink-0 text-ok" />
              ) : state === "wrong" ? (
                <XIcon aria-hidden className="size-4 shrink-0 text-destructive" />
              ) : (
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full border border-border-strong"
                />
              )}
              <span className="min-w-0 flex-1">
                <MarkdownInline text={option} />
              </span>
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="mt-2 text-13 empty:hidden">
        {choice !== null && (
          <>
            <strong className={choice === question.answer ? "text-ok" : "text-destructive"}>
              {choice === question.answer ? t("quiz.right") : t("quiz.wrong")}
            </strong>{" "}
            <MarkdownInline text={question.why} />
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          size="xs"
          variant="outline"
          className="max-md:h-11"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          {t("quiz.prev")}
        </Button>
        <Button
          size="xs"
          variant={choice !== null ? "default" : "outline"}
          className="max-md:h-11"
          disabled={index === questions.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          {t("quiz.next")}
        </Button>
        {answered === questions.length && (
          <Button
            size="xs"
            variant="ghost"
            className="max-md:h-11"
            onClick={() => {
              setPicked(questions.map(() => null))
              setIndex(0)
            }}
          >
            <RotateCcwIcon />
            {t("quiz.again")}
          </Button>
        )}
      </div>
    </section>
  )
}
