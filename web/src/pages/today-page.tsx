import { useMemo } from "react"
import { useNow } from "@/lib/clock"
import { BookOpenIcon, LayersIcon, PlayIcon, RotateCcwIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LevelBar, OutcomeTag, TopicDot } from "@/components/common/badges"
import { PageHeader, Panel } from "@/components/common/page"
import { InboxQuickAdd } from "@/pages/inbox-page"
import { Button } from "@/components/ui/button"
import { dayKey } from "@/lib/dates"
import { dueText, durationText } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useLang, useNotebook, useSamples } from "@/notebook/hooks"
import {
  activityByDay,
  attemptsOf,
  getLive,
  inboxOf,
  liveValues,
  streakDays,
  todayTasks,
  topicStatus,
  topicsOf,
  weekActivity,
  type Task,
} from "@/notebook/logic"
import type { Notebook } from "@/notebook/schema"
import { href, navigate } from "@/state/router"

function StatTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-md border bg-card px-3.5 py-3">
      <div className="text-13 text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-mono text-24 leading-tight font-semibold", valueClass)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-12 text-muted-foreground">{sub}</div>}
    </div>
  )
}

function patternNames(nb: Notebook, ids: string[]) {
  return ids
    .map((id) => getLive(nb.patterns, id)?.name)
    .filter(Boolean)
    .join(", ")
}

function TaskRow({ task, nb }: { task: Task; nb: Notebook }) {
  const { t } = useTranslation()
  if (task.kind === "problem") {
    const { problem } = task
    const last = attemptsOf(nb, problem.id).at(-1)
    const topic = getLive(nb.topics, getLive(nb.patterns, problem.patternIds[0])?.topicId)
    return (
      <li className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
        <RotateCcwIcon className="size-4 shrink-0 text-warn" aria-hidden />
        <div className="min-w-0 flex-1">
          <a href={href.problem(problem.id)} className="font-medium">
            {problem.title}
          </a>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-12 text-muted-foreground">
            {topic && <TopicDot color={topic.color} />}
            <span>{patternNames(nb, problem.patternIds)}</span>
            <span>·</span>
            <span className={cn(task.overdue > 0 && "text-warn")}>{dueText(task.dueAt, t)}</span>
            {last && <OutcomeTag outcome={last.outcome} />}
          </div>
        </div>
        <span className="shrink-0 font-mono text-12 text-muted-foreground">
          {durationText(task.minutes, t)}
        </span>
      </li>
    )
  }
  const topic = getLive(nb.topics, task.pattern.topicId)
  return (
    <li className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      {task.kind === "cards" ? (
        <LayersIcon className="size-4 shrink-0 text-purple" aria-hidden />
      ) : (
        <BookOpenIcon className="size-4 shrink-0 text-link" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <a
          href={task.kind === "cards" ? href.review : href.pattern(task.pattern.id)}
          className="font-medium"
        >
          {task.kind === "cards"
            ? t("today.cardsTask", { count: task.cards.length })
            : t("today.continueTask", { name: task.pattern.name })}
        </a>
        <div className="flex flex-wrap items-center gap-x-2 text-12 text-muted-foreground">
          {topic && <TopicDot color={topic.color} />}
          <span>{task.kind === "cards" ? task.pattern.name : topic?.name}</span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-12 text-muted-foreground">
        {durationText(task.minutes, t)}
      </span>
    </li>
  )
}

const HEAT = ["bg-border", "bg-ok-fill/30", "bg-ok-fill/55", "bg-ok-fill/80", "bg-ok-fill"] as const

/** The last 20 weeks, one square per day, darker for more problems tried and cards reviewed */
function ActivityGrid({ activity, now }: { activity: Map<string, number>; now: number }) {
  const { t } = useTranslation()
  const weeks = 20
  const cells = useMemo(() => {
    const today = new Date(now)
    const end = new Date(today)
    end.setDate(end.getDate() + (6 - ((today.getDay() + 6) % 7))) // through Sunday
    const list: { key: string; count: number; future: boolean }[] = []
    const d = new Date(end)
    d.setDate(d.getDate() - weeks * 7 + 1)
    for (let i = 0; i < weeks * 7; i++) {
      const key = dayKey(d.getTime())
      list.push({ key, count: activity.get(key) ?? 0, future: d.getTime() > now })
      d.setDate(d.getDate() + 1)
    }
    return list
  }, [activity, now])
  const total = cells.reduce((sum, c) => sum + c.count, 0)
  const level = (n: number) => (n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4)

  return (
    <div>
      <div
        role="img"
        aria-label={t("today.activityLabel", { count: total, weeks })}
        className="grid grid-flow-col grid-rows-7 gap-0.75"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 10px))` }}
      >
        {cells.map((c) => (
          <span
            key={c.key}
            title={`${c.key}: ${c.count}`}
            className={cn(
              "size-2.5 rounded-[2px]",
              c.future ? "bg-transparent" : HEAT[level(c.count)]
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-12 text-muted-foreground">
        {t("today.activitySummary", { count: total, weeks })}
      </p>
    </div>
  )
}

export function TodayPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const nb = useNotebook()
  const now = useNow()
  const samples = useSamples()
  const tasks = todayTasks(nb, now, samples)
  const minutes = tasks.reduce((sum, task) => sum + task.minutes, 0)
  const activity = useMemo(() => activityByDay(nb), [nb])
  const reviewTasks = tasks.filter((x) => x.kind !== "continue")
  const overdue = reviewTasks.filter((x) => "overdue" in x && x.overdue > 0).length
  const solvedAlone = liveValues(nb.problems).filter((p) =>
    attemptsOf(nb, p.id).some((a) => a.outcome === "alone")
  ).length
  const inbox = inboxOf(nb)
  const date = new Date(now).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  })

  return (
    <>
      <PageHeader
        title={
          tasks.length
            ? t("today.title", { count: tasks.length, time: durationText(minutes, t) })
            : t("today.titleEmpty")
        }
        docTitle={t("nav.today")}
        crumbs={[{ label: date }]}
        actions={
          reviewTasks.length > 0 && (
            <Button onClick={() => navigate(href.review)}>
              <PlayIcon />
              {t("today.start")}
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <StatTile
          label={t("today.streak")}
          value={String(streakDays(activity, now))}
          sub={t("today.streakUnit")}
        />
        <StatTile
          label={t("today.due")}
          value={String(
            reviewTasks.reduce((n, x) => n + (x.kind === "cards" ? x.cards.length : 1), 0)
          )}
          sub={overdue ? t("today.overdue", { count: overdue }) : undefined}
          valueClass="text-warn"
        />
        <StatTile
          label={t("today.solvedAlone")}
          value={String(solvedAlone)}
          sub={t("today.solvedAloneUnit")}
          valueClass="text-ok"
        />
        <StatTile
          label={t("today.week")}
          value={String(weekActivity(activity, now))}
          sub={t("today.weekUnit")}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-start gap-4">
        <Panel title={t("today.tasks")} className="min-w-0 flex-[999_1_420px]">
          {tasks.length ? (
            <ul className="-mx-4 -my-3">
              {tasks.map((task) => (
                <TaskRow
                  key={
                    task.kind === "problem" ? task.problem.id : `${task.kind}-${task.pattern.id}`
                  }
                  task={task}
                  nb={nb}
                />
              ))}
            </ul>
          ) : (
            <p className="text-14 text-muted-foreground">{t("today.empty")}</p>
          )}
        </Panel>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Panel
            title={t("today.inbox", { count: inbox.length })}
            actions={
              <a href={href.inbox} className="text-13">
                {t("today.openInbox")}
              </a>
            }
          >
            <InboxQuickAdd compact />
            {inbox.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {inbox.slice(0, 3).map((item) => (
                  <li key={item.id} className="truncate text-13">
                    <a href={href.inbox}>{item.title || item.url}</a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("today.activity")}>
            <ActivityGrid activity={activity} now={now} />
          </Panel>
        </div>
      </div>

      <h2 className="mb-2.5 text-15 font-semibold">{t("today.topics")}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {topicsOf(nb).map((topic) => {
          const status = topicStatus(nb, topic.id, now, samples)
          return (
            <a
              key={topic.id}
              href={href.topic(topic.id)}
              className="block rounded-md border bg-card px-3.5 py-3 text-foreground no-underline hover:border-border-strong hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-center gap-2 font-semibold">
                <TopicDot color={topic.color} />
                <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                <span className="font-mono text-13 font-normal text-muted-foreground">
                  {status.pct}%
                </span>
              </div>
              <div className="my-2">
                <LevelBar byLevel={status.byLevel} />
              </div>
              <div className="font-mono text-12 text-muted-foreground">
                {t("topic.counts", {
                  done: status.byLevel[2] + status.byLevel[3],
                  total: status.total,
                  solved: status.solvedAlone,
                })}
              </div>
              <div className="truncate text-13 text-muted-foreground">
                {status.next
                  ? t("topic.next", { name: status.next.name })
                  : status.total
                    ? t("topic.allGotIt")
                    : t("topic.noPatterns")}
              </div>
            </a>
          )
        })}
      </div>
    </>
  )
}
