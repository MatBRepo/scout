"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function AdminSyncButton({ playerId }: { playerId: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await fetch(`/api/admin/transfermarkt/sync?player_id=${encodeURIComponent(playerId)}`, { method: "POST" })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            toast.error(body.error || "Sync failed")
            return
          }
          toast.success("Synchronized")
          router.refresh()
        })
      }
      title="Synchronize this player from Transfermarkt"
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Syncing…" : "Sync now"}
    </Button>
  )
}
