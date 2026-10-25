import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

// Tabs drawn like VS Code's editor tabs: the open tab has an accent line on top and the same
// background as its content, the others sit on the darker tab bar. Built on Radix Tabs, so
// keyboard navigation and ARIA roles come for free.

export const FileTabs = TabsPrimitive.Root
export const FileTabsContent = TabsPrimitive.Content

export function FileTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex min-w-0 overflow-x-auto", className)} {...props} />
}

export function FileTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "flex cursor-pointer items-center gap-2 border-t-2 border-r border-t-transparent whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[state=active]:border-t-primary data-[state=active]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/** The coloured mark before a tab's name, like a file icon */
export function TabIcon({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("font-mono text-11 font-bold", className)} aria-hidden>
      {children}
    </span>
  )
}
