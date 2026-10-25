import { useState } from "react"
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FIELD } from "@/components/common/editing"
import { Markdown } from "@/components/common/markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { dueText } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useNotebook } from "@/notebook/hooks"
import { cardDueAt, cardsOf } from "@/notebook/logic"
import type { Card, Pattern } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"

function CardForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { question: string; answer: string }
  submitLabel: string
  onSubmit: (question: string, answer: string) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState(initial?.question ?? "")
  const [answer, setAnswer] = useState(initial?.answer ?? "")
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!question.trim()) return
        onSubmit(question.trim(), answer)
        if (!initial) {
          setQuestion("")
          setAnswer("")
        }
      }}
    >
      <Textarea
        aria-label={t("card.question")}
        className={cn(FIELD, "min-h-10")}
        value={question}
        placeholder={t("card.questionPlaceholder")}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <Textarea
        aria-label={t("card.answer")}
        className={cn(FIELD, "min-h-20")}
        value={answer}
        placeholder={t("card.answerPlaceholder")}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" variant={initial ? "default" : "outline"} disabled={!question.trim()}>
          {!initial && <PlusIcon />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("confirm.cancel")}
          </Button>
        )}
      </div>
    </form>
  )
}

function CardRow({ card, now }: { card: Card; now: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <li className="rounded-md border px-3 py-2.5">
        <CardForm
          initial={card}
          submitLabel={t("edit.save")}
          onSubmit={(question, answer) => {
            notebookActions.updateCard(card.id, { question, answer })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }
  return (
    <li className="rounded-md border px-3 py-2.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium whitespace-pre-line">{card.question}</p>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-expanded={open}
          aria-label={open ? t("card.hide") : t("card.show")}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("card.edit")}
          onClick={() => setEditing(true)}
        >
          <PencilIcon />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("card.delete")}
          onClick={() => notebookActions.deleteCard(card.id)}
        >
          <Trash2Icon />
        </Button>
      </div>
      {open && (
        <div className="mt-2 border-t pt-2">
          {card.answer.trim() ? (
            <Markdown text={card.answer} />
          ) : (
            <p className="text-14 text-faint">{t("review.noAnswer")}</p>
          )}
        </div>
      )}
      <p className="mt-1 font-mono text-11 text-faint">
        {t("card.nextReview", { when: dueText(cardDueAt(card), t, now) })}
        {card.reviews.length > 0 && ` · ${t("card.reviewed", { count: card.reviews.length })}`}
      </p>
    </li>
  )
}

export function CardList({ pattern, now }: { pattern: Pattern; now: number }) {
  const { t } = useTranslation()
  const cards = cardsOf(useNotebook(), pattern.id)
  return (
    <>
      {cards.length ? (
        <ul className="mb-3 space-y-2">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} now={now} />
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-14 text-faint">{t("card.none")}</p>
      )}
      <CardForm
        submitLabel={t("card.add")}
        onSubmit={(question, answer) => notebookActions.addCard(pattern.id, question, answer)}
      />
    </>
  )
}
