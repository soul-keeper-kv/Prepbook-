import { ClipboardPasteIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Markdown } from "@/components/common/markdown"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Pattern } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { withNote, type SuggestedNote } from "@/notebook/suggestions"

/** The section a suggested note goes into, and the note's own name */
export function useNoteLabels(note: SuggestedNote) {
  const { t } = useTranslation()
  const section = t(`section.${note.key}.title` as "section.idea.title")
  // Suggested pitfalls are common ones; the section is for the user's own
  return { section, label: note.key === "pitfalls" ? t("suggest.pitfallsLabel") : section }
}

/** Copies a suggested note below what its section already holds, with Undo */
export function useCopyNote(pattern: Pattern, note: SuggestedNote) {
  const { t } = useTranslation()
  const { section } = useNoteLabels(note)
  return () => {
    const before = pattern.sections[note.key] ?? ""
    notebookActions.setSection(pattern.id, note.key, withNote(before, note.text))
    toast.success(t("suggest.noteCopiedTo", { section }), {
      action: {
        label: t("suggest.undo"),
        onClick: () => notebookActions.setSection(pattern.id, note.key, before),
      },
    })
  }
}

/** A suggested note to read, with Copy in */
export function NoteDialog({
  pattern,
  note,
  open,
  onOpenChange,
}: {
  pattern: Pattern
  note: SuggestedNote
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { section, label } = useNoteLabels(note)
  const copy = useCopyNote(pattern, note)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Only the note scrolls: the title and the Copy button stay in view on a phone */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 rounded-lg border border-border-strong bg-card ring-0 sm:max-w-180">
        <DialogHeader>
          <DialogTitle className="text-15 font-semibold">
            {t("suggest.noteTitle", { name: label })}
          </DialogTitle>
          <DialogDescription className="text-13">
            {t("suggest.noteHint", { section })}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto text-14">
          <Markdown text={note.text} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("suggest.close")}</Button>
          </DialogClose>
          {!note.copied && (
            <Button
              onClick={() => {
                copy()
                onOpenChange(false)
              }}
            >
              <ClipboardPasteIcon />
              {t("suggest.copy")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
