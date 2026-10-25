import { z } from "zod"

// Progress: ticks, solved problems, notes and code. Saved in localStorage (dsa_progress_v3),
// in the Drive file and in "Export progress" files, always in this shape:
//   items:  { [itemId]: { done, doneAt, notes, code, checks: { [checkId]: true }, reviews: [isoDate] } }
//   solved: { [problemUrl]: isoDate }   a problem listed under several items counts once
//
// Only the outer shape is strict (items and solved must be objects). Inside, each value is
// checked on its own and a wrong one is dropped: rejecting the whole copy over one bad field
// (a hand-edited file, say) would leave this device with empty progress, which the next sync
// could upload over the Drive file.

const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined)

/** Stands in for the date of a solved mark that has none */
const UNKNOWN_DATE = new Date(0).toISOString()

// Loose: fields written by a newer version of the app survive a round trip through this one
export const ItemProgressSchema = z.looseObject({
  done: lenient(z.boolean()),
  doneAt: lenient(z.string()),
  notes: lenient(z.string()),
  code: lenient(z.string()),
  checks: lenient(z.record(z.string(), z.boolean())),
  reviews: lenient(z.array(z.string())),
})

// Extra top-level fields (savedAt, exportedAt) are dropped on parse
export const ProgressSchema = z.object({
  items: z.record(z.string(), ItemProgressSchema.catch({})),
  solved: z.record(z.string(), z.string().catch(UNKNOWN_DATE)),
})

export type ItemProgress = z.infer<typeof ItemProgressSchema>
export type Progress = z.infer<typeof ProgressSchema>
