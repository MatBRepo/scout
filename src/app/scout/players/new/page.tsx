// src/app/scout/players/new/page.tsx
"use client"

import { useEffect, useMemo, useRef, useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

import {
  Calendar, CheckCircle2, Image as ImageIcon, Link2, Upload, XCircle,
  Plus, X, Globe2, Footprints, Phone, Mail, UserRound, Building2, Flag,
  Loader2, ExternalLink,
} from "lucide-react"

const POSITIONS = ["GK","RB","CB","LB","RWB","LWB","DM","CM","AM","RW","LW","CF","ST"] as const
const FEET = ["left", "right", "both"] as const

type Candidate = {
  tm_id: string
  name: string
  profile_url?: string
  image_url?: string
  date_of_birth?: string
  position_main?: string
  dominant_foot?: string
  height_cm?: number
  weight_kg?: number
  country_of_birth?: string
  current_club_name?: string
}

function TagInput({
  label, placeholder, values, setValues, description,
}: {
  label: string
  placeholder?: string
  values: string[]
  setValues: (arr: string[]) => void
  description?: string
}) {
  const [val, setVal] = useState("")
  const add = () => {
    const v = val.trim()
    if (!v) return
    if (!values.includes(v)) setValues([...values, v])
    setVal("")
  }
  const remove = (tag: string) => setValues(values.filter(t => t !== tag))
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        />
        <Button type="button" variant="secondary" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {!!values.length && (
        <div className="flex flex-wrap gap-2">
          {values.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button type="button" aria-label="remove" onClick={() => remove(tag)}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewPlayerPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, start] = useTransition()

  // ===== FORM STATE =====
  // required
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  // optional - identity
  const [dob, setDob] = useState("")
  const [height, setHeight] = useState<string>("")
  const [weight, setWeight] = useState<string>("")
  const [countryOfBirth, setCountryOfBirth] = useState("")
  const [hasEU, setHasEU] = useState(false)

  // club
  const [club, setClub] = useState("")
  const [clubCountry, setClubCountry] = useState("")
  const [clubTier, setClubTier] = useState<string>("")

  // positions
  const [mainPos, setMainPos] = useState("")
  const [altPositions, setAltPositions] = useState<string[]>([])
  const [dominantFoot, setDominantFoot] = useState<string>("")

  // language + contacts
  const [englishSpeaks, setEnglishSpeaks] = useState(false)
  const [englishLevel, setEnglishLevel] = useState("")
  const [phoneNo, setPhoneNo] = useState("")
  const [email, setEmail] = useState("")
  const [facebookUrl, setFacebookUrl] = useState("")
  const [instagramUrl, setInstagramUrl] = useState("")

  // links
  const [tm, setTm] = useState("")
  const [videoUrls, setVideoUrls] = useState<string[]>([])
  const [tmId, setTmId] = useState<string | null>(null)

  // contract/agency/coach
  const [contractStatus, setContractStatus] = useState("")
  const [contractUntil, setContractUntil] = useState("")
  const [agency, setAgency] = useState("")
  const [coachContact, setCoachContact] = useState("")

  // career stats
  const [clubsLast5, setClubsLast5] = useState<string>("")
  const [leaguesJson, setLeaguesJson] = useState("")
  const [appearances, setAppearances] = useState<string>("")
  const [minutes, setMinutes] = useState<string>("")
  const [natCaps, setNatCaps] = useState(false)
  const [natMinutes, setNatMinutes] = useState<string>("")
  const [goals, setGoals] = useState<string>("")
  const [assists, setAssists] = useState<string>("")
  const [dribbles, setDribbles] = useState<string>("")
  const [injuries3y, setInjuries3y] = useState<string>("")

  // opinion
  const [opinion, setOpinion] = useState("")

  // image
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // TM state
  const [tmQuerying, setTmQuerying] = useState(false)
  const [tmCandidates, setTmCandidates] = useState<Candidate[]>([])
  const [tmModalOpen, setTmModalOpen] = useState(false)
  const [tmChosen, setTmChosen] = useState<Candidate | null>(null)

  // ===== DERIVED =====
  const fullName = useMemo(() => `${firstName.trim()} ${lastName.trim()}`.trim(), [firstName, lastName])

  const tmValid = useMemo(() => {
    if (!tm) return true
    try { return new URL(tm).hostname.includes("transfermarkt") } catch { return false }
  }, [tm])

  const emailValid = useMemo(() => {
    if (!email.trim()) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }, [email])

  const isSaveDisabled = useMemo(() => {
    if (!firstName.trim() || !lastName.trim()) return true
    if (!tmValid) return true
    if (!emailValid) return true
    return isPending
  }, [firstName, lastName, tmValid, emailValid, isPending])

  // ===== REFS (for click-to-focus checklist) =====
  const refs = {
    date_of_birth: useRef<HTMLInputElement | null>(null),
    height_cm: useRef<HTMLInputElement | null>(null),
    weight_kg: useRef<HTMLInputElement | null>(null),
    country_of_birth: useRef<HTMLInputElement | null>(null),
    current_club_name: useRef<HTMLInputElement | null>(null),
    current_club_country: useRef<HTMLInputElement | null>(null),
    current_club_tier: useRef<HTMLInputElement | null>(null),
    main_position: useRef<HTMLInputElement | null>(null),
    dominant_foot: useRef<HTMLButtonElement | null>(null), // SelectTrigger is a button
    transfermarkt_url: useRef<HTMLInputElement | null>(null),
  }

  const scrollToField = (key: keyof typeof refs) => {
    const el = refs[key].current
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    ;(el as any).focus?.()
  }

  // ===== FILE UPLOAD =====
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const uploadImage = async (): Promise<{ url?: string; path?: string; error?: string }> => {
    if (!file) return {}
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${user.id}/entries/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from("players").upload(path, file, {
      upsert: false, cacheControl: "3600",
    })
    if (upErr) return { error: upErr.message }
    const { data } = supabase.storage.from("players").getPublicUrl(path)
    return { url: data.publicUrl, path }
  }

  // ===== TM HELPERS =====
  function normName(s: string) {
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
  }

  function computeMissingKeys() {
    const wanted: Record<string, string> = {
      date_of_birth: dob,
      height_cm: height,
      weight_kg: weight,
      country_of_birth: countryOfBirth,
      current_club_name: club,
      current_club_country: clubCountry,
      current_club_tier: clubTier,
      main_position: mainPos,
      dominant_foot: dominantFoot,
      transfermarkt_url: tm,
    }
    return Object.entries(wanted)
      .filter(([, v]) => !String(v ?? "").trim())
      .map(([k]) => k)
  }

  function prefillFromTm(candidate: Candidate) {
    setTmId(candidate?.tm_id ?? null)
    if (candidate?.profile_url) setTm(candidate.profile_url)
    if (candidate?.date_of_birth) setDob(candidate.date_of_birth)
    if (candidate?.height_cm) setHeight(String(candidate.height_cm))
    if (candidate?.weight_kg) setWeight(String(candidate.weight_kg))
    if (candidate?.position_main) setMainPos(candidate.position_main)
    if (candidate?.dominant_foot) setDominantFoot(candidate.dominant_foot)
    if (candidate?.current_club_name) setClub(candidate.current_club_name)
    if (candidate?.country_of_birth) setCountryOfBirth(candidate.country_of_birth)
  }

  async function searchTransfermarktBySurname(surname: string, first?: string) {
    setTmQuerying(true)
    try {
      const url = `/api/tm/player/search?q=${encodeURIComponent(surname)}${first ? `&first=${encodeURIComponent(first)}` : ""}`
      const res = await fetch(url, { cache: "no-store" })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || "TM search failed")

      const items: Candidate[] = j?.items || []
      setTmCandidates(items)

      const fullTyped = [first, surname].filter(Boolean).join(" ")
      const exactMatches = items.filter(p => normName(p.name) === normName(fullTyped))

      if (exactMatches.length === 1) {
        const m = exactMatches[0]
        setTmChosen(m)
        setTmModalOpen(false)
        toast.success("Found on Transfermarkt", {
          description: `${m.name}${m.date_of_birth ? ` · DoB ${m.date_of_birth}` : ""}${m.current_club_name ? ` · ${m.current_club_name}` : ""}`,
          action: {
            label: "Prefill",
            onClick: () => {
              prefillFromTm(m)
              toast.success("Prefilled from Transfermarkt", { description: m.name })
            },
          },
          duration: 7000,
        })
      } else if (items.length > 0) {
        setTmModalOpen(true)
        toast.message("Transfermarkt: candidates found", {
          description: `${items[0].name}${items[0].date_of_birth ? ` · DoB ${items[0].date_of_birth}` : ""}${items[0].current_club_name ? ` · ${items[0].current_club_name}` : ""}`,
          action: { label: "Open list", onClick: () => setTmModalOpen(true) },
          duration: 6000,
        })
      } else {
        setTmChosen(null)
        setTmModalOpen(false)
      }
    } catch (e: any) {
      toast.error(e?.message || "Transfermarkt search unavailable – continue manually.")
      setTmCandidates([])
      setTmChosen(null)
      setTmModalOpen(false)
    } finally {
      setTmQuerying(false)
    }
  }

  // Trigger TM search gently once both names are present
  useEffect(() => {
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (fn.length < 1 || ln.length < 2) {
      setTmQuerying(false); setTmModalOpen(false); setTmCandidates([]); setTmChosen(null)
      return
    }
    setTmQuerying(true)
    const t = window.setTimeout(() => searchTransfermarktBySurname(ln, fn), 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName])

  // Cmd/Ctrl+S -> save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (!isSaveDisabled) submit()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isSaveDisabled]) // submit is stable below

  // ===== SUBMIT =====
  const submit = useCallback(() => {
    start(async () => {
      if (!firstName.trim() || !lastName.trim()) {
        toast.error("First name and Last name are required.")
        return
      }
      if (!tmValid) { toast.error("Transfermarkt link looks invalid."); return }
      if (!emailValid) { toast.error("E-mail looks invalid."); return }

      // upload image if present
      let image_url: string | undefined
      let image_path: string | undefined
      if (file) {
        const up = await uploadImage()
        if (up.error) { toast.error(`Upload failed: ${up.error}`); return }
        image_url = up.url
        image_path = up.path
      }

      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
        date_of_birth: dob || null,
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
        country_of_birth: countryOfBirth || null,
        has_eu_passport: hasEU,
        current_club_name: club || null,
        current_club_country: clubCountry || null,
        current_club_tier: clubTier ? Number(clubTier) : null,
        main_position: mainPos || null,
        alt_positions: altPositions,
        dominant_foot: dominantFoot || null,
        english_speaks: englishSpeaks,
        english_level: englishLevel || null,
        contact_phone: phoneNo || null,
        contact_email: email || null,
        facebook_url: facebookUrl || null,
        instagram_url: instagramUrl || null,
        transfermarkt_url: tm || null,
        transfermarkt_player_id: tmId,
        video_urls: videoUrls,
        contract_status: contractStatus || null,
        contract_until: contractUntil || null,
        agency: agency || null,
        coach_contact: coachContact || null,
        clubs_last5: clubsLast5 ? Number(clubsLast5) : null,
        leagues: leaguesJson ? leaguesJson : null,
        appearances: appearances ? Number(appearances) : null,
        minutes: minutes ? Number(minutes) : null,
        national_team_caps: natCaps,
        national_team_minutes: natMinutes ? Number(natMinutes) : null,
        goals_last_season: goals ? Number(goals) : null,
        assists_last_season: assists ? Number(assists) : null,
        dribbles_last_season: dribbles ? Number(dribbles) : null,
        injuries_last_3y: injuries3y ? Number(injuries3y) : null,
        opinion: opinion || null,
        image_url,
        image_path,
      }

      const res = await fetch("/api/scout/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let body: any = {}
      try { body = await res.json() } catch {}

      if (!res.ok) {
        toast.error(body?.error || `Failed to save (${res.status})`)
        if (res.status === 401) router.push("/login?redirect_to=/scout/players/new")
        return
      }

      toast.success("Player submitted", {
        description: fullName,
        action: {
          label: "Open list",
          onClick: () => router.push("/scout/players"),
        },
      })
      router.push("/scout/players")
    })
  }, [
    firstName,lastName,tmValid,emailValid,file,fullName,dob,height,weight,countryOfBirth,hasEU,
    club,clubCountry,clubTier,mainPos,altPositions,dominantFoot,englishSpeaks,englishLevel,
    phoneNo,email,facebookUrl,instagramUrl,tm,tmId,videoUrls,contractStatus,contractUntil,
    agency,coachContact,clubsLast5,leaguesJson,appearances,minutes,natCaps,natMinutes,
    goals,assists,dribbles,injuries3y,opinion,router
  ])

  // ===== LAYOUT =====
  return (
    <div className="w-full p-4 md:p-8 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Add Player</h1>
          <p className="text-sm text-muted-foreground">Quickly add a new player and optionally prefill from Transfermarkt.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          Required: First name, Last name
        </div>
      </div>

      {/* Two-column layout: form + checklist */}
      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        {/* LEFT: MAIN FORM */}
        <Card className="p-6 space-y-6 rounded-2xl">
          {/* Section 1: Identity + TM */}
          <div className="space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Identity</div>
                <p className="text-xs text-muted-foreground">Start with name — we’ll try to find a profile for you.</p>
              </div>
              {/* TM status chip */}
              <div className="text-xs text-muted-foreground">
                {!tmQuerying && tmCandidates.length > 0 && (
                  <span>
                    Found {tmCandidates.length} result{tmCandidates.length > 1 ? "s" : ""} on Transfermarkt.{" "}
                    <button className="underline" type="button" onClick={() => setTmModalOpen(true)}>
                      Review
                    </button>
                  </span>
                )}
                {tmQuerying && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><UserRound className="h-4 w-4" /> First name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Robert" />
              </div>
              <div className="grid gap-2">
                <Label>Last name *</Label>
                <div className="relative">
                  <Input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Lewandowski"
                    className={tmQuerying ? "pr-8" : undefined}
                  />
                  {tmQuerying && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Date of birth</Label>
                <Input ref={refs.date_of_birth} type="date" value={dob} onChange={e => setDob(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Height (cm)</Label>
                <Input ref={refs.height_cm} type="number" inputMode="numeric" value={height} onChange={e => setHeight(e.target.value)} placeholder="183" />
              </div>
              <div className="grid gap-2">
                <Label>Weight (kg)</Label>
                <Input ref={refs.weight_kg} type="number" inputMode="numeric" value={weight} onChange={e => setWeight(e.target.value)} placeholder="78" />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2"><Flag className="h-4 w-4" /> Country of birth</Label>
                <Input ref={refs.country_of_birth} value={countryOfBirth} onChange={e => setCountryOfBirth(e.target.value)} placeholder="Poland" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Citizenship & English */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label>EU Passport</Label>
                <p className="text-xs text-muted-foreground">Has EU citizenship?</p>
              </div>
              <Switch checked={hasEU} onCheckedChange={setHasEU} />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label>Speaks English</Label>
                <p className="text-xs text-muted-foreground">Simple yes/no</p>
              </div>
              <Switch checked={englishSpeaks} onCheckedChange={setEnglishSpeaks} />
            </div>
            <div className="grid gap-2">
              <Label>English level</Label>
              <Input value={englishLevel} onChange={e => setEnglishLevel(e.target.value)} placeholder="A2 / B1 / B2 / C1" />
            </div>
          </div>

          <Separator />

          {/* Section 3: Club & League */}
          <div className="space-y-4">
            <div className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Current Club
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Club name</Label>
                <Input ref={refs.current_club_name} value={club} onChange={e => setClub(e.target.value)} placeholder="Wisła Kraków" />
              </div>
              <div className="grid gap-2">
                <Label>Club country</Label>
                <Input ref={refs.current_club_country} value={clubCountry} onChange={e => setClubCountry(e.target.value)} placeholder="Poland" />
              </div>
              <div className="grid gap-2">
                <Label>League level</Label>
                <Input ref={refs.current_club_tier} type="number" inputMode="numeric" value={clubTier} onChange={e => setClubTier(e.target.value)} placeholder="1 (top), 2, 3..." />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 4: Positions */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label>Main position</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  ref={refs.main_position}
                  value={mainPos}
                  onChange={e => setMainPos(e.target.value)}
                  placeholder="e.g., CF, CM, RW"
                  className="max-w-[220px]"
                />
                <div className="flex flex-wrap gap-1">
                  {POSITIONS.map(p => (
                    <Badge
                      key={p}
                      variant={mainPos === p ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setMainPos(p)}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Footprints className="h-4 w-4" /> Dominant foot</Label>
              <Select value={dominantFoot} onValueChange={setDominantFoot}>
                <SelectTrigger ref={refs.dominant_foot as any}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {FEET.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TagInput
            label="Alternative positions"
            placeholder="Add position code, e.g. RW"
            values={altPositions}
            setValues={setAltPositions}
          />

          <Separator />

          {/* Section 5: Contacts */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Contact phone</Label>
              <Input value={phoneNo} onChange={e => setPhoneNo(e.target.value)} placeholder="+48 600 000 000" />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Contact e-mail</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="player@mail.com" />
              {!emailValid && <p className="text-xs text-red-600">E-mail looks invalid.</p>}
            </div>
            <div className="grid gap-2">
              <Label>Facebook URL</Label>
              <Input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div className="grid gap-2">
              <Label>Instagram URL</Label>
              <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
            </div>
          </div>

          {/* Section 6: Links */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Transfermarkt link</Label>
              <Input
                ref={refs.transfermarkt_url}
                value={tm}
                onChange={e => setTm(e.target.value)}
                placeholder="https://www.transfermarkt.com/..."
              />
              {!tmValid && (
                <div className="text-xs text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> This doesn’t look like a valid Transfermarkt URL.
                </div>
              )}
              <p className="text-xs text-muted-foreground">Optional, but helps us sync details quickly.</p>
            </div>

            <TagInput
              label="Video links"
              placeholder="Paste video URL and press Enter"
              values={videoUrls}
              setValues={setVideoUrls}
              description="You can add multiple video URLs."
            />
          </div>

          <Separator />

          {/* Section 7: Contract / Agency / Coach */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Contract status</Label>
              <Input value={contractStatus} onChange={e => setContractStatus(e.target.value)} placeholder="e.g. active / free agent" />
            </div>
            <div className="grid gap-2">
              <Label>Contract until</Label>
              <Input type="date" value={contractUntil} onChange={e => setContractUntil(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Agency</Label>
              <Input value={agency} onChange={e => setAgency(e.target.value)} placeholder="Agency name" />
            </div>
            <div className="md:col-span-3 grid gap-2">
              <Label>Coach/Club contact</Label>
              <Input value={coachContact} onChange={e => setCoachContact(e.target.value)} placeholder="Name, role, phone/email" />
            </div>
          </div>

          <Separator />

          {/* Section 8: Career stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Clubs last 5 years</Label>
              <Input type="number" inputMode="numeric" value={clubsLast5} onChange={e => setClubsLast5(e.target.value)} placeholder="e.g. 3" />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Leagues played in (country + level)</Label>
              <Textarea
                value={leaguesJson}
                onChange={e => setLeaguesJson(e.target.value)}
                placeholder='Free text or JSON, e.g. [{"country":"PL","level":2}]'
              />
            </div>

            <div className="grid gap-2">
              <Label>Matches</Label>
              <Input type="number" inputMode="numeric" value={appearances} onChange={e => setAppearances(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Minutes</Label>
              <Input type="number" inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label>Played for National Team</Label>
                <p className="text-xs text-muted-foreground">Senior or youth</p>
              </div>
              <Switch checked={natCaps} onCheckedChange={setNatCaps} />
            </div>
            <div className="grid gap-2">
              <Label>National team minutes</Label>
              <Input type="number" inputMode="numeric" value={natMinutes} onChange={e => setNatMinutes(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Goals last season</Label>
              <Input type="number" inputMode="numeric" value={goals} onChange={e => setGoals(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Assists last season</Label>
              <Input type="number" inputMode="numeric" value={assists} onChange={e => setAssists(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Dribbles last season</Label>
              <Input type="number" inputMode="numeric" value={dribbles} onChange={e => setDribbles(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Injuries in last 3 years</Label>
              <Input type="number" inputMode="numeric" value={injuries3y} onChange={e => setInjuries3y(e.target.value)} />
            </div>
          </div>

          {/* Section 9: Opinion */}
          <div className="grid gap-2">
            <Label>Opinion</Label>
            <Textarea value={opinion} onChange={e => setOpinion(e.target.value)} placeholder="Short summary or notes" />
          </div>
        </Card>

        {/* RIGHT: COMPLETENESS + PHOTO */}
        <div className="space-y-6">
          {/* Photo card */}
          <Card className="p-4 rounded-2xl">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Photo
              </Label>
              <div className="flex items-center gap-3">
                <Input type="file" accept="image/*" onChange={onFileChange} />
                {preview ? (
                  <img src={preview} alt="preview" className="h-20 w-20 rounded-md object-cover border" />
                ) : (
                  <div className="h-20 w-20 rounded-md border grid place-items-center text-muted-foreground text-xs">
                    Preview
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Square (1:1) looks best. ~5MB max recommended.</p>
            </div>
          </Card>

          {/* Completeness card */}
          <Card className="p-4 rounded-2xl sticky top-6">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Completeness</div>
              <span className="text-xs text-muted-foreground">{fullName || "Unnamed player"}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Optional — fill what you know now, you can update later.
            </p>
            <div className="flex flex-wrap gap-2">
              {computeMissingKeys().length === 0 ? (
                <span className="text-xs text-muted-foreground">Looks complete!</span>
              ) : (
                computeMissingKeys().map(k => (
                  <button
                    key={k}
                    onClick={() => scrollToField(k as keyof typeof refs)}
                    className="text-[11px] rounded px-2 py-1 border bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                  >
                    {k}
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* TM Modal */}
      {tmModalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTmModalOpen(false)} />
          <div className="absolute inset-x-0 top-10 mx-auto w-[min(960px,92vw)] rounded-xl bg-background border shadow-xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Found on Transfermarkt</h3>
              <Button variant="ghost" onClick={() => setTmModalOpen(false)}>Close</Button>
            </div>

            {tmQuerying ? (
              <div className="text-sm text-muted-foreground">Searching…</div>
            ) : tmCandidates.length === 0 ? (
              <div className="text-sm">No players found for that name.</div>
            ) : (
              <>
                <div className="grid gap-3 max-h-[50vh] overflow-auto pr-1">
                  {tmCandidates.map((c) => (
                    <button
                      key={c.tm_id}
                      onClick={() => setTmChosen(c)}
                      className={`text-left border rounded-lg p-3 hover:bg-accent transition ${tmChosen?.tm_id === c.tm_id ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        {c.image_url ? (
                          <img src={c.image_url} alt="" className="h-12 w-12 rounded object-cover border" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-muted grid place-items-center text-xs text-muted-foreground">No img</div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.date_of_birth ? `DoB: ${c.date_of_birth} · ` : ""}
                            {c.position_main ? `Pos: ${c.position_main} · ` : ""}
                            {c.current_club_name ? `Club: ${c.current_club_name}` : ""}
                          </div>
                          {c.profile_url && (
                            <div className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                              <a className="underline" href={c.profile_url} target="_blank" rel="noreferrer">Open TM profile</a>
                              <ExternalLink className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {tmChosen && (
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium mb-1">Looks good?</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      We’ll prefill any matching fields. You can adjust afterwards.
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={() => setTmModalOpen(false)}>Cancel</Button>
                      <Button
                        onClick={() => {
                          prefillFromTm(tmChosen)
                          setTmModalOpen(false)
                          toast.success("Prefilled from Transfermarkt", {
                            description: `${tmChosen.name}${tmChosen.date_of_birth ? ` · ${tmChosen.date_of_birth}` : ""}`,
                          })
                        }}
                      >
                        Use this profile
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/scout/players")}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSaveDisabled}>
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Upload className="h-4 w-4 animate-pulse" /> Saving…
              </span>
            ) : ("Save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
