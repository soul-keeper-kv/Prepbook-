---
name: prep-ui
description: UI design rules for this interview-prep study app (web/ and the Android build of it). Use when designing, mocking up, building or reviewing any screen or component — Today/home, Inbox, topic roadmap, pattern page, problem attempt log, review queue, graph view, tree view — or when picking colours, type, icons, layout, density or UI copy for the app.
---

# prep-ui

Design rules for the app in `web/` (the Android app in `mobile/` packs the same build).
Read this before drawing a mockup or writing a screen, so every screen looks like one app.

**Status (2026-10-26):** the first version is built on branch `feat/pattern-notebook`:
- the data model (`web/src/notebook/`) and Drive sync with three-way merge
- carrying over the old roadmap progress
- every screen below except the ones listed as later
- pages live in `web/src/pages/`, components in `web/src/components/{shell,common,pattern,problem}/`

**Not built yet (later):**
- images and diagrams
- blind recognition practice
- a solving timer
- the mistake log across patterns
- Obsidian-vault export
- sharing a link from the phone into the Inbox
- per-topic section templates beyond the four kinds

Say so plainly when asked; do not describe them as working. Before changing the data model
or a settled rule, ask.

Mockups: https://claude.ai/artifact/2YeqxRgKmTPUi12qejw52o — A/B/C style options, and
the chosen direction ("Đã chọn: C + B, màu VS Code") with the Pattern page. The mockups
load web fonts and use raw hex; the real app must not (see Visual language).

## What the app is

A personal study notebook for interview prep across several topics (DSA, Java, Database,
System Design, Spring, Behavioral). It is **not** a content library: the user finds
material and problems, solves them, then writes notes in the app. Everything is organised
**by pattern**.

The loop every screen serves: **Find → Solve → Note → Review.**

Structure:

```
Topic → Phase → Pattern (ordered, may require another pattern first)
Pattern ↔ Problem       many-to-many; the same URL is one problem
Problem → Attempt[]     date, minutes, outcome, mistake tags, code, note
Pattern → Resources, note sections, Q&A cards
```

- **Roadmap** = the user-ordered phases and patterns of a topic.
- **Progress is derived, never ticked by hand** (except pure-theory patterns, which have
  no problems). Each pattern has 4 levels, worked out in `notebook/logic.ts`:

  | Level | When |
  | --- | --- |
  | Not started | Nothing yet |
  | Learning | Has notes or problems |
  | Got it | 3 problems solved alone |
  | Mastered | 3 problems solved alone again in a review (≥ 7 days after the first try) and nothing overdue |

  A review more than 7 days overdue drops the pattern one level.
- **Attempt outcome** has 3 values: solved alone / needed a hint / read the solution.
  Redo after 1 day (solution), 3 days (hint), growing gaps (alone).
- The old roadmap in `web/data/` is a **suggestion source only**: shown in a "Suggestions
  from the old DSA roadmap" box, added to a pattern only when the user clicks.

## Screens

Chosen direction: **home in the "Daily Drill" style (C), topic and pattern pages in the
"Handbook" style (B), painted with the existing VS Code palette.**

**App shell.** Left sidebar + main area.
Sidebar, top to bottom:
1. app name
2. search button (Ctrl K)
3. nav: Today, Inbox (count badge), Review (count due), Mock interview
4. "Topics and patterns" tree
5. sync status pinned at the bottom

Main content is capped at 1080px wide (`max-w-270`). Below 768px (`md`) the sidebar is
hidden and a **bottom bar** with Today, Inbox, Review, Topics, Search takes its place. The
tree then lives on the Topics page.

**Today (home).** The top heading states today's load ("5 tasks, about 2h 20m"), with a
primary "Start session" button and a secondary "Mock interview" button. Below it:
- the session queue: checkbox rows showing topic dot, type, meta and an estimate
- the review list: overdue items first
- the Inbox preview
- one card per topic: level meter, counts, "Next: …"

Stats stay few and honest (streak, due count, solved count). No badges or points.

**Inbox.** Paste a link (problem or material). Each item can be filed under one or more
patterns later. Suggest a pattern from the URL when it matches a known problem.

**Topic page.** The roadmap is drawn as a vertical path. Each phase is a node: filled
when every pattern in it is Got it or better, ringed while in progress, hollow when not
started. The current phase is open and lists its patterns, each with a level and a
problem count.

**Pattern page.** A document with numbered sections, plus an aside holding Suggestions
and Related patterns. The DSA section template, in order:
1. Recognition (signals in the problem statement)
2. Idea and template code (tabs per language)
3. Pitfalls I hit, each linked to the problem where it happened
4. Problems done: a table of problem, level, outcome and redo date. The row due today is
   highlighted.
5. Material read: link plus "what I took away"
6. My interview questions: answer aloud first, then reveal

Above the sections sits a mastery strip: a segmented bar of the outcomes plus a plain
sentence ("Got it: solved 3 of the last 5 alone").

Other topics get their own template. Proposed, not settled:
- System Design: Requirements → Estimates → Design → Deep dive → Trade-offs
- Behavioral: a STAR story bank mapped to common questions

**Problem detail.** It has three parts:
- an attempt form: outcome, minutes, mistakes, note, code
- the attempt history, newest first, each with its outcome tag, minutes, mistake tags,
  code and note
- a "Stuck?" panel with solution links and AI prompts

Under the title, `ProblemStatusTag` shows the status derived from the attempts: "Not done
yet", or "Solved · alone / with a hint / read the solution" by the latest attempt, then the
attempt count and the redo date. There is no hand-set status.

The breadcrumb row holds a Back button and `‹ n / N ›` arrows. The arrows step through the
problem table of the pattern the problem was opened from (`lastPatternId` in `state/ui.ts`)
and replace the history entry, so Back returns to where the problems were opened from.

Later: a timer that fills in the minutes.

**Review queue.** Due problems and Q&A cards across all topics. Cards are drilled one at a
time: answer aloud, reveal, then grade Forgot / Fuzzy / Solid. Later: blind mode, which
hides the pattern name until the user has guessed it.

**Tree view (sidebar)** is like Obsidian's file explorer:
- Topic → Phase → Pattern, with drag to reorder (the drag order is the roadmap order)
- inline "New pattern" at the end of each phase
- VS Code tree look: 22–26px rows, indent guides, chevrons, counts in mono on the right

**Graph view** is like Obsidian's graph, with these nodes and edges:
- nodes are patterns, problems, resources and topics
- edges link pattern↔problem, pattern prerequisites, related patterns and note links

Node colour = topic, size = number of problems, and opacity/ring = mastery level. Filters:
topic, hide problems. Clicking a node opens its page. The Pattern page can show a
**local graph** (1–2 hops).

Libraries (installed):
- graph: `react-force-graph-2d` (canvas, force layout), lazy-loaded by `pages/graph-page.tsx`
- tree: `@headless-tree/react` + `@headless-tree/core` (headless, so it takes the app's own
  Tailwind styling; it has drag and drop), in `components/shell/topic-tree.tsx`

The graph canvas cannot read Tailwind classes. Read the colour tokens with
`getComputedStyle(document.documentElement)` and redraw when the theme changes.

Free extra from Obsidian (proposed): export notes as an Obsidian vault, meaning one `.md`
per pattern or problem with YAML frontmatter and `[[wikilinks]]`. Opening that folder in
Obsidian gives its graph, backlinks and search with no extra code.

## Visual language

The palette is VS Code Light Modern / Dark Modern, defined once in `web/src/index.css`.
Use its Tailwind tokens; **never write a hex value in a component.**

| Use | Token / class |
| --- | --- |
| Page, sidebar | `bg-background` (sidebar: `bg-muted` or `bg-card` against it) |
| Text, secondary, faint | `text-foreground`, `text-muted-foreground`, `text-faint` |
| Lines | `border-border`, `border-border-strong` |
| Primary action, links, focus | `bg-primary`, `text-link`, `ring-ring` |
| Selected tree row | `bg-info-bg text-link` |
| Code | `bg-code`, `bg-code-bar`, Shiki (Light+ / Dark+) via `components/code-block.tsx` |

Status colours use the `Tag` tones in `web/src/components/tag.tsx`:

| Meaning | Tone |
| --- | --- |
| Solved alone, Easy | `ok` |
| Needed a hint, Medium, review due | `warn` |
| Read the solution, Hard, overdue | `danger` |
| Not done / not started | `neutral` |
| Theory / Learning | `link` |
| Q&A card | `purple` |

Mastery is shown as a 4-step meter plus its text label. Never rely on colour alone.

**Topic colours** are the `--topic-{blue,orange,teal,purple,green,pink,gray}` tokens in
`index.css` (light and dark values, both text-safe). Use them through `TopicDot` in
`components/common/badges.tsx`, which also holds `LevelTag`, `LevelMeter`, `OutcomeTag`,
`OutcomeBar` and `LevelBar`.

Type and shape:
- **Fonts: system only.** `font-sans` and `font-mono` from `index.css`, because the app
  must work offline and in the Android WebView. No Google Fonts.
- **Sizes:** `text-11 … text-24` from `index.css`. Body line-height is 1.6. Mono is for
  counts, dates, durations and code.
- **Radius:** `rounded-sm/md/lg` from `--radius`. Tags are square (3px); pills are fully
  round.
- **Density:**
  - desktop: dense like VS Code (tree rows 22–26px, list rows 34–44px)
  - phone: every touch target ≥ 44px
- **Icons:** `lucide-react` only, stroke style. No emoji. The `❯ ~/…` prompt in the top
  bar is the app's one decorative flourish.
- **Light and dark** are both first-class. Check every new screen in both.
- **Avoid:** gradient backgrounds, cards with a coloured left border, heavy shadows.

## Components

- Reuse `web/src/components/ui/` (shadcn on Radix, restyled to VS Code): alert-dialog,
  button, checkbox, collapsible, dialog, progress, sonner, textarea, toggle-group, toggle.
- Reuse the app components in `web/src/components/`: `Tag`, `Segmented`, `Section`,
  `CodeBlock`, `CopyButton`, `FileTabs`, `ConfirmDialog`, `InlineText`.
- To add a shadcn component: `npx shadcn@latest add <name>`, then change
  `import { cn } from "cn"` to `import { cn } from "@/lib/utils"`.
- State lives in Zustand stores (`progress/store.ts`, `state/ui.ts`). Components read it
  through selectors; they do not hold their own copy.

## Copy and i18n

- Every user-visible string goes through i18next. Add the key to **both**
  `web/src/i18n/locales/vi.json` and `en.json` (a test checks the key sets match).
- Vietnamese is the default language.
- Technical terms stay in English inside Vietnamese copy (Sliding Window, Index,
  Medium).
- **User-written content is single-language:** notes, titles and links are stored as
  typed, never as `{ vi, en }`.
- **Tone:** short and concrete. Say what will happen ("Redo after 3 days"), not generic
  praise.

## Accessibility (also for mockups)

- Use real `<button>`, `<a href>` and `<input>` + `<label>`. Put `aria-label` on
  icon-only buttons.
- Text contrast must be ≥ 4.5:1, including 11–12px grey labels, in both themes.
- Tables sit in an `overflow-x-auto` box. Rows wrap instead of overflowing at phone width.
- Focus must be visible (`focus-visible:ring-2 ring-ring`).

## Rules that hold the data together

- **Never read the clock while rendering.** Use `useNow()` from `lib/clock.ts`.
- **Never edit a notebook object in place.** `notebook/logic.ts` caches lookups per notebook
  object. Every change goes through `notebookActions` in `notebook/store.ts`.
- **Deleting marks an entity `deleted`; it never removes it.** Otherwise the other device's
  copy brings it back on sync.
- **A long text that loses a merge becomes a Conflict.** Show conflicts with
  `ConflictList`, near the entity they belong to.

## Open questions — ask, do not decide

1. Images and diagrams. Proposed: separate Drive files, never inside the notebook JSON.
2. Blind recognition practice: whether it should count towards "Mastered".
3. The Obsidian-vault export format.
