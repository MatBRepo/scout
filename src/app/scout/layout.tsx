import type { ReactNode } from "react"
import { AppSidebar } from "@/components/nav/AppSidebar"
import { Topbar } from "@/components/nav/Topbar"

export default function ScoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
