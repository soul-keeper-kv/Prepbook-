import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface Option<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  /** Accessible name of the group */
  label: string
  className?: string
}

/** Pick one of n (filter, theme, language, AI mode): joined buttons, the chosen one filled. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={value}
      // Radix sends "" when the chosen button is pressed again; keep the current choice
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className={cn("rounded-sm font-mono shadow-none", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          title={option.title}
          className="h-6.5 min-w-0 cursor-pointer border-border-strong px-2.5 text-12 font-normal text-muted-foreground first:rounded-l-sm last:rounded-r-sm hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
