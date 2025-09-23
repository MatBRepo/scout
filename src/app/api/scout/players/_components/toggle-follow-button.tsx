"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function ToggleFollowButton({
  playerId,
  initiallyFollowing,
}: {
  playerId: string
  initiallyFollowing: boolean
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const follow = () =>
    start(async () => {
      const res = await fetch(`/api/scout/follow?player_id=${encodeURIComponent(playerId)}`, { method: "POST" })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        toast.error(b.error || "Could not add")
        return
      }
      toast.success("Added to My Players")
      router.refresh()
    })

  const unfollow = () =>
    start(async () => {
      const res = await fetch(`/api/scout/follow?player_id=${encodeURIComponent(playerId)}`, { method: "DELETE" })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        toast.error(b.error || "Could not remove")
        return
      }
      toast.success("Removed from My Players")
      router.refresh()
    })

  if (initiallyFollowing) {
    return (
      <Button variant="outline" disabled={pending} onClick={unfollow}>
        {pending ? "Removing…" : "Remove from My Players"}
      </Button>
    )
  }
  return (
    <Button disabled={pending} onClick={follow}>
      {pending ? "Adding…" : "Add to My Players"}
    </Button>
  )
}
