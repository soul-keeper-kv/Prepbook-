import { ItemDialog } from "@/components/detail/item-dialog"
import { PageFooter } from "@/components/layout/page-footer"
import { PageHeader } from "@/components/layout/page-header"
import { Stats } from "@/components/layout/stats"
import { Toolbar } from "@/components/layout/toolbar"
import { TopBar } from "@/components/layout/top-bar"
import { PhaseList } from "@/components/roadmap/phase-list"
import { Toaster } from "@/components/ui/sonner"

export function App() {
  return (
    <>
      <main className="mx-auto max-w-190 px-4 pt-8 pb-16">
        <TopBar />
        <PageHeader />
        <Stats />
        <Toolbar />
        <PhaseList />
        <PageFooter />
      </main>
      <ItemDialog />
      <Toaster position="bottom-center" />
    </>
  )
}
