"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function EntryDeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const onDelete = () =>
    startTransition(async () => {
      if (!confirm("Delete this player entry?")) return
      const res = await fetch(`/api/scout/entries/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast?.error?.(body.error || "Delete failed")
        return
      }
      toast?.success?.("Deleted")
      router.refresh()
    })

  return (
    <Button variant="destructive" size="sm" disabled={isPending} onClick={onDelete}>
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  )
}
