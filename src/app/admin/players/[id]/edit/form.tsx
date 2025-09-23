"use client"
import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AdminPlayerForm({ player }: { player: any }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [state, setState] = useState({
    full_name: player.full_name,
    date_of_birth: player.date_of_birth,
    main_position: player.main_position ?? "",
    current_club_name: player.current_club_name ?? "",
    current_club_country: player.current_club_country ?? "",
    current_club_tier: player.current_club_tier ?? 1,
    transfermarkt_url: player.transfermarkt_url ?? "",
    image_url: player.image_url ?? "",
  })

  const save = () => {
    start(async () => {
      const res = await fetch(`/api/admin/players/${player.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      })
      if (!res.ok) {
        const b = await res.json().catch(()=>({}))
        toast.error(b.error || "Update failed")
        return
      }
      toast.success("Saved")
      router.push("/admin/players")
    })
  }

  const remove = () => {
    if (!confirm("Delete this player?")) return
    start(async () => {
      const res = await fetch(`/api/admin/players/${player.id}`, { method: "DELETE" })
      if (!res.ok) {
        const b = await res.json().catch(()=>({}))
        toast.error(b.error || "Delete failed")
        return
      }
      toast.success("Deleted")
      router.push("/admin/players")
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Edit Player</h1>
      <Card className="p-6 grid gap-4">
        {Object.entries({
          full_name: "Full name *",
          date_of_birth: "Date of birth *",
          main_position: "Main position",
          current_club_name: "Current club",
          current_club_country: "Country",
          current_club_tier: "Tier",
          transfermarkt_url: "Transfermarkt URL",
          image_url: "Image URL"
        }).map(([k, label]) => (
          <div className="grid gap-2" key={k}>
            <Label>{label}</Label>
            <Input
              type={k === "date_of_birth" ? "date" : k === "current_club_tier" ? "number" : "text"}
              value={String((state as any)[k] ?? "")}
              onChange={(e)=> setState(s => ({ ...s, [k]: k==="current_club_tier" ? Number(e.target.value) : e.target.value }))}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <Button onClick={save} disabled={isPending || !state.full_name || !state.date_of_birth}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button onClick={remove} variant="destructive" disabled={isPending}>Delete</Button>
        </div>
      </Card>
    </div>
  )
}
