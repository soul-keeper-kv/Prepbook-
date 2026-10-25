import { useId, useState, type KeyboardEvent, type ReactNode } from "react"
import { CheckIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Markdown } from "@/components/common/markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export const FIELD =
  "rounded-sm border-border-strong bg-code px-2.5 py-2 text-14 shadow-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary md:text-14 dark:bg-code"

export const INPUT =
  "h-8 w-full min-w-0 rounded-sm border border-border-strong bg-code px-2.5 text-14 outline-none placeholder:text-faint focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"

export const SELECT =
  "h-8 cursor-pointer rounded-sm border border-border-strong bg-code px-2 text-13 outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"

/** Tab inserts 4 spaces in code; Shift+Tab still moves focus out */
export function insertTab(
  e: KeyboardEvent<HTMLTextAreaElement>,
  onChange: (value: string) => void
) {
  if (e.key !== "Tab" || e.shiftKey) return
  e.preventDefault()
  const el = e.currentTarget
  el.setRangeText("    ", el.selectionStart, el.selectionEnd, "end")
  onChange(el.value)
}

/** A name shown as text, turned into an input by its pencil button */
export function EditableText({
  value,
  onSave,
  label,
  className,
  inputClassName,
  children,
}: {
  value: string
  onSave: (value: string) => void
  /** Accessible name of the input and of the pencil button */
  label: string
  className?: string
  inputClassName?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)

  function save() {
    if (draft !== null && draft.trim() && draft.trim() !== value) onSave(draft.trim())
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <form
        className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          autoFocus
          aria-label={label}
          className={cn(INPUT, inputClassName)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
        />
      </form>
    )
  }
  return (
    <span className={cn("group/edit flex min-w-0 items-center gap-1.5", className)}>
      {children ?? <span className="min-w-0 truncate">{value}</span>}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("edit.rename", { name: label })}
        title={t("edit.rename", { name: label })}
        className="opacity-60 group-hover/edit:opacity-100 focus-visible:opacity-100"
        onClick={() => setDraft(value)}
      >
        <PencilIcon />
      </Button>
    </span>
  )
}

/**
 * Markdown notes: shown rendered, edited in a textarea after "Edit". Saved on every
 * keystroke, like the rest of the app (the store debounces the Drive upload).
 */
export function NoteEditor({
  value,
  onChange,
  label,
  placeholder,
  emptyText,
  mono = false,
  startEditing = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  /** Shown instead of the notes while they are empty */
  emptyText?: string
  mono?: boolean
  startEditing?: boolean
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(startEditing)
  const id = useId()

  if (editing) {
    return (
      <div className="space-y-1.5">
        <Textarea
          id={id}
          autoFocus={!startEditing}
          aria-label={label}
          className={cn(
            FIELD,
            "min-h-24",
            mono && "font-mono text-13 leading-[1.6] [tab-size:4] md:text-13"
          )}
          wrap={mono ? "off" : undefined}
          spellCheck={!mono}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => insertTab(e, onChange)}
        />
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => setEditing(false)}>
            <CheckIcon />
            {t("edit.done")}
          </Button>
          <span className="text-12 text-faint">{t("edit.markdownHint")}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="group/note relative">
      {value.trim() ? (
        <Markdown text={value} />
      ) : (
        <p className="text-14 text-faint">{emptyText ?? placeholder}</p>
      )}
      <Button
        size="xs"
        variant="outline"
        className="mt-2"
        aria-label={t("edit.editNamed", { name: label })}
        onClick={() => setEditing(true)}
      >
        <PencilIcon />
        {value.trim() ? t("edit.edit") : t("edit.write")}
      </Button>
    </div>
  )
}

/** One text field and an Add button: new phase, new pattern, new topic */
export function InlineAdd({
  label,
  placeholder,
  onAdd,
  className,
}: {
  label: string
  placeholder: string
  onAdd: (name: string) => void
  className?: string
}) {
  const [name, setName] = useState("")
  return (
    <form
      className={cn("flex items-center gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onAdd(name.trim())
        setName("")
      }}
    >
      <input
        aria-label={label}
        className={INPUT}
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="outline" disabled={!name.trim()}>
        <PlusIcon />
        {label}
      </Button>
    </form>
  )
}
