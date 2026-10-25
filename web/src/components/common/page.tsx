import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LABEL } from "@/components/section"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  href?: string
}

/** Breadcrumb, title and the page's main actions; also names the browser tab */
export function PageHeader({
  title,
  crumbs = [],
  actions,
  children,
  docTitle,
}: {
  title: ReactNode
  crumbs?: Crumb[]
  actions?: ReactNode
  children?: ReactNode
  /** Browser tab title when `title` is not plain text */
  docTitle?: string
}) {
  const { t } = useTranslation()
  const tabTitle = docTitle ?? (typeof title === "string" ? title : "")

  useEffect(() => {
    document.title = tabTitle ? `${tabTitle} · ${t("app.title")}` : t("app.title")
  }, [tabTitle, t])

  return (
    <header className="mb-6">
      {crumbs.length > 0 && (
        <nav
          aria-label={t("nav.breadcrumb")}
          className="mb-1 font-mono text-12 text-muted-foreground"
        >
          {crumbs.map((crumb, i) => (
            <span key={i}>
              {i > 0 && (
                <span className="mx-1.5 text-faint" aria-hidden>
                  ›
                </span>
              )}
              {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : crumb.label}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="flex min-w-0 flex-[1_1_16rem] items-center gap-2 text-24 leading-tight font-semibold">
          {title}
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** A titled block of a page, on a card */
export function Panel({
  title,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn("rounded-md border bg-card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          {title && <h2 className={cn(LABEL, "flex-1")}>{title}</h2>}
          {actions}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

/** A numbered section of a document page: ## 1. Recognition */
export function DocSection({
  title,
  hint,
  actions,
  children,
  id,
}: {
  title: string
  hint?: string
  actions?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section id={id} className="scroll-mt-4 border-t pt-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-15 font-semibold">{title}</h2>
        {hint && <p className="min-w-0 flex-1 text-12 text-faint">{hint}</p>}
        {actions}
      </div>
      {children}
    </section>
  )
}
