import type { ReactElement } from "react"
import type { TFunction } from "i18next"
import { XIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface FilterOption {
  key: string
  label: string
  /** How many items this choice would keep, given the other filters */
  count: number
}

/**
 * A menu of values to keep, each with its count. Several can be picked in a row: the menu
 * stays open. The problem table's funnels and the suggestion box both use it.
 */
export function FilterMenu({
  trigger,
  options,
  selected,
  onChange,
  clearLabel,
}: {
  trigger: ReactElement
  options: FilterOption[]
  selected: string[]
  onChange: (keys: string[]) => void
  clearLabel: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-48">
        {options.map((option) => {
          const checked = selected.includes(option.key)
          return (
            <DropdownMenuCheckboxItem
              key={option.key}
              checked={checked}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) =>
                onChange(
                  on === true ? [...selected, option.key] : selected.filter((k) => k !== option.key)
                )
              }
              className={cn("gap-4 text-13", !option.count && !checked && "text-faint")}
            >
              <span className="flex-1">{option.label}</span>
              <span className="font-mono text-11 text-muted-foreground">{option.count}</span>
            </DropdownMenuCheckboxItem>
          )
        })}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-13" onSelect={() => onChange([])}>
              <XIcon />
              {clearLabel}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Medium", "No level"; levels the app does not know ("advanced") are capitalised */
export function levelLabel(key: string, t: TFunction): string {
  if (key === "none") return t("problem.levelNone")
  if (["easy", "medium", "hard"].includes(key))
    return t(`problemLevel.${key}` as "problemLevel.easy")
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/** "LeetCode", or "Unknown" for a link that is not a URL */
export const platformLabel = (key: string, t: TFunction): string =>
  key === "none" ? t("problem.platformNone") : key
