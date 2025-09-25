// src/app/admin/layout.tsx
import type { ReactNode } from "react"
import { AppSidebar } from "@/components/nav/AppSidebar"
import { Topbar } from "@/components/nav/Topbar"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        {/* Topbar visible on all breakpoints */}
        <Topbar />
        <main className="flex-1 bg-gradient-to-br from-primary/10 via-muted to-background">
          <div className="mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}


