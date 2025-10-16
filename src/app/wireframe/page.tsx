"use client";

/**
 * NOTE about Next.js viewport/metadata:
 * Do NOT export `generateViewport` or `generateMetadata` from this client file.
 * Put them in a Server Component, e.g. app/layout.tsx (no "use client"):
 *
 * // app/layout.tsx
 * export const viewport = { width: "device-width", initialScale: 1 };
 * // or:
 * export async function generateViewport() {
 *   return { width: "device-width", initialScale: 1 };
 * }
 */

import { useEffect, useMemo, useState, type ComponentType } from "react";

// shadcn/ui
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// icons
import {
  PlusCircle,
  Users,
  Shirt,
  Calendar as CalendarIcon,
  NotebookPen,
  ListFilter,
  Save,
  Loader2,
  UserCircle2,
  UserPlus2,
  FileSearch,
  ShieldCheck,
  Bug,
  CopyCheck,
  FileInput,
  Menu,
  X,
  Pencil,
  ChevronDown,
  Star,
  Trash2,
  Undo2,
  Moon,
  Sun,
  Bell,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Link,
  Scale,
  Ruler,
  HeartPulse,
  FileText,
  BarChart3,
} from "lucide-react";

/**
 * S4S — Wireframes /wireframe
 * - Persistence: theme, role, players/obs views (grid/table), filters values + "open" state, columns visibility
 * - Soft delete + batch restore for players (trash scope)
 * - Toasts (undo; save)
 * - Unidentified duplicates across scouts: Admin resolves & promotes to My Base + Scout notification
 */

type Role = "Administrator" | "Scout Agent" | "Scout";
type PageKey = "players" | "add" | "unidentified" | "mybase" | "obs" | "settings" | "roles" | "player-editor";

type NavNode = { key: string; label: string; icon?: ComponentType<any>; page?: PageKey; children?: NavNode[] };

type Player = {
  id: number;
  name: string;
  club: string;
  pos: "GK" | "DF" | "MF" | "FW";
  age: number;
  status: "active" | "trash";
  // Extended player details
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  nationality?: string;
  height?: number;
  weight?: number;
  foot?: "left" | "right" | "both";
  // Scout notes
  scoutNotes?: ScoutNotes;
};

type ScoutNotes = {
  motorSkills: { rating: number; comment: string };
  strength: { rating: number; comment: string };
  technique: { rating: number; comment: string };
  movesWithBall: { rating: number; comment: string };
  movesWithoutBall: { rating: number; comment: string };
  setPieces: { rating: number; comment: string };
  defensivePhase: { rating: number; comment: string };
  attackingPhase: { rating: number; comment: string };
  transitionalPhases: { rating: number; comment: string };
  attitude: { rating: number; comment: string };
  finalComment: string;
};

type Observation = {
  id: number;
  player: string;
  match: string;
  date: string;
  time: string;
  status: "draft" | "final";
};

type MyBaseRow = { id: number; name: string; pos: string; source: "manual" | "LNP" | "TM" | "global"; sig: string };

type UnidSketch = {
  id: number;
  group: string; // dedupe-key
  jersey: number;
  match: string;
  date: string;
  time: string;
  note: string;
  scout: string; // who created
};

// ===== LocalStorage keys =====
const LS = {
  theme: "wireframe_theme_v2",
  role: "wireframe_role_v2",
  playersCols: "wireframe_players_cols_v2",
  playersFilters: "wireframe_players_filters_v2",
  playersFiltersOpen: "wireframe_players_filters_open_v2",
  playersView: "wireframe_players_view_v2",
  playersScope: "wireframe_players_scope_v2",
  playersSelection: "wireframe_players_sel_v2",
  obsCols: "wireframe_obs_cols_v2",
  obsFilters: "wireframe_obs_filters_v2",
  obsFiltersOpen: "wireframe_obs_filters_open_v2",
  obsView: "wireframe_obs_view_v2",
  notifications: "wireframe_notifications_v2",
};

// ===== Small helpers =====
function Crumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((it, i) => (
          <span key={i} className="flex items-center">
            <BreadcrumbItem>
              {it.href ? <BreadcrumbLink href="#">{it.label}</BreadcrumbLink> : <BreadcrumbPage>{it.label}</BreadcrumbPage>}
            </BreadcrumbItem>
            {i < items.length - 1 && <BreadcrumbSeparator />}
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function Toolbar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-neutral-100">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-neutral-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

function GrayTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
      {children}
    </span>
  );
}

// ===== Toasts =====
type ToastSpec = { id: number; message: string; actionLabel?: string; onAction?: () => void; timeout?: number };
function useToasts() {
  const [toasts, setToasts] = useState<ToastSpec[]>([]);
  function show(spec: Omit<ToastSpec, "id">) {
    const id = Date.now() + Math.random();
    const t: ToastSpec = { id, timeout: 6000, ...spec };
    setToasts((arr) => [...arr, t]);
    if (t.timeout) setTimeout(() => dismiss(id), t.timeout);
  }
  function dismiss(id: number) {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }
  return { toasts, show, dismiss };
}
function ToastHost({ toasts, dismiss }: { toasts: ToastSpec[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-900 shadow dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <span>{t.message}</span>
            <div className="ml-3 flex items-center gap-2">
              {t.actionLabel && t.onAction && (
                <button
                  className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                >
                  {t.actionLabel}
                </button>
              )}
              <button aria-label="Zamknij" className="rounded p-1 hover:bg-gray-50 dark:hover:bg-neutral-800" onClick={() => dismiss(t.id)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Notifications (for Scouts) =====
type Notification = { id: number; when: string; text: string };
function useNotifications() {
  const [items, setItems] = useState<Notification[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LS.notifications);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Notification[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS.notifications, JSON.stringify(items));
  }, [items]);
  function push(text: string) {
    setItems((arr) => [{ id: Date.now() + Math.random(), when: new Date().toLocaleString(), text }, ...arr]);
  }
  function clear() {
    setItems([]);
  }
  function remove(id: number) {
    setItems((arr) => arr.filter((n) => n.id !== id));
  }
  return { items, push, clear, remove };
}

function NotificationsBell({
  list,
  onClear,
  onRemove,
  visibleForRole,
  role,
}: {
  list: Notification[];
  onClear: () => void;
  onRemove: (id: number) => void;
  visibleForRole: Role; // role allowed to see
  role: Role;
}) {
  const [open, setOpen] = useState(false);
  const canSee = role === visibleForRole;
  if (!canSee) return null;
  return (
    <div className="relative">
      <button
        className="rounded border border-gray-300 p-1 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        onClick={() => setOpen((v) => !v)}
        aria-label="Powiadomienia"
      >
        <Bell className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border border-gray-200 bg-white p-2 shadow dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-1 flex items-center justify-between text-sm">
            <div className="font-medium">Powiadomienia</div>
            <button className="text-xs text-gray-600 hover:underline dark:text-neutral-300" onClick={onClear}>
              Wyczyść
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {list.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-neutral-400">Brak powiadomień</div>
            ) : (
              list.map((n) => (
                <div key={n.id} className="mb-1 flex items-start justify-between rounded border border-gray-200 p-2 text-sm dark:border-neutral-800">
                  <div>
                    <div className="mb-0.5 flex items-center gap-1 text-gray-800 dark:text-neutral-100">
                      <CheckCircle2 className="h-4 w-4" /> {n.text}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-neutral-400">{n.when}</div>
                  </div>
                  <button className="rounded p-1 hover:bg-gray-50 dark:hover:bg-neutral-800" onClick={() => onRemove(n.id)} aria-label="Usuń">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Player Editor Page =====
function PlayerEditorPage({
  player,
  onSave,
  onClose,
}: {
  player: Player;
  onSave: (p: Player) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState("basic");
  const [draft, setDraft] = useState<Player>(player);

  // Initialize scout notes if not present
  useEffect(() => {
    if (!draft.scoutNotes) {
      setDraft(prev => ({
        ...prev,
        scoutNotes: {
          motorSkills: { rating: 0, comment: "" },
          strength: { rating: 0, comment: "" },
          technique: { rating: 0, comment: "" },
          movesWithBall: { rating: 0, comment: "" },
          movesWithoutBall: { rating: 0, comment: "" },
          setPieces: { rating: 0, comment: "" },
          defensivePhase: { rating: 0, comment: "" },
          attackingPhase: { rating: 0, comment: "" },
          transitionalPhases: { rating: 0, comment: "" },
          attitude: { rating: 0, comment: "" },
          finalComment: "",
        }
      }));
    }
  }, [draft.scoutNotes]);

  const handleSave = () => {
    onSave(draft);
  };


const EMPTY_SCOUT_NOTES: ScoutNotes = {
  motorSkills: { rating: 0, comment: "" },
  strength: { rating: 0, comment: "" },
  technique: { rating: 0, comment: "" },
  movesWithBall: { rating: 0, comment: "" },
  movesWithoutBall: { rating: 0, comment: "" },
  setPieces: { rating: 0, comment: "" },
  defensivePhase: { rating: 0, comment: "" },
  attackingPhase: { rating: 0, comment: "" },
  transitionalPhases: { rating: 0, comment: "" },
  attitude: { rating: 0, comment: "" },
  finalComment: "",
};


type RatingNoteKey = Exclude<keyof ScoutNotes, "finalComment">;

function updateScoutNote<K extends RatingNoteKey>(category: K, field: "rating", value: number): void;
function updateScoutNote<K extends RatingNoteKey>(category: K, field: "comment", value: string): void;
function updateScoutNote<K extends RatingNoteKey>(
  category: K,
  field: "rating" | "comment",
  value: number | string
) {
  setDraft(prev => {
    const notes = prev.scoutNotes ?? EMPTY_SCOUT_NOTES;
    return {
      ...prev,
      scoutNotes: {
        ...notes,
        [category]: {
          ...notes[category],
          [field]: value as any, // safe due to overloads above
        },
      },
    };
  });
}

  return (
    <div className="w-full">
      <Crumb items={[
        { label: "Start", href: "/" }, 
        { label: "Baza zawodników", href: "#" }, 
        { label: player.name }
      ]} />
      
      <Toolbar
        title={`Edytuj zawodnika: ${player.name}`}
        subtitle="Kompleksowy profil zawodnika"
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={onClose}>
              Anuluj
            </Button>
            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Zapisz zmiany
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="basic">Podstawowe</TabsTrigger>
          <TabsTrigger value="club">Klub</TabsTrigger>
          <TabsTrigger value="physical">Fizyczne</TabsTrigger>
          <TabsTrigger value="contact">Kontakt</TabsTrigger>
          <TabsTrigger value="contract">Kontrakt</TabsTrigger>
          <TabsTrigger value="stats">Statystyki</TabsTrigger>
          <TabsTrigger value="scout">Notatki skauta</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Informacje podstawowe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Imię</Label>
                  <Input 
                    value={draft.firstName || ""} 
                    onChange={(e) => setDraft({...draft, firstName: e.target.value})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Nazwisko</Label>
                  <Input 
                    value={draft.lastName || ""} 
                    onChange={(e) => setDraft({...draft, lastName: e.target.value})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Data urodzenia</Label>
                  <Input 
                    type="date" 
                    value={draft.birthDate || ""} 
                    onChange={(e) => setDraft({...draft, birthDate: e.target.value})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Narodowość</Label>
                  <Input 
                    value={draft.nationality || ""} 
                    onChange={(e) => setDraft({...draft, nationality: e.target.value})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Pozycja</Label>
                  <Select value={draft.pos} onValueChange={(v) => setDraft({...draft, pos: v as Player["pos"]})}>
                    <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GK">Bramkarz</SelectItem>
                      <SelectItem value="DF">Obrońca</SelectItem>
                      <SelectItem value="MF">Pomocnik</SelectItem>
                      <SelectItem value="FW">Napastnik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Wiek</Label>
                  <Input 
                    type="number" 
                    value={draft.age} 
                    onChange={(e) => setDraft({...draft, age: parseInt(e.target.value) || 0})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="club" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Informacje klubowe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Aktualny klub</Label>
                <Input 
                  value={draft.club} 
                  onChange={(e) => setDraft({...draft, club: e.target.value})}
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Poprzednie kluby</Label>
                <Textarea 
                  placeholder="Wymień poprzednie kluby..."
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="physical" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Dane fizyczne</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
                    <Ruler className="h-4 w-4" />
                    Wzrost (cm)
                  </Label>
                  <Input 
                    type="number" 
                    value={draft.height || ""} 
                    onChange={(e) => setDraft({...draft, height: parseInt(e.target.value) || 0})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
                    <Scale className="h-4 w-4" />
                    Waga (kg)
                  </Label>
                  <Input 
                    type="number" 
                    value={draft.weight || ""} 
                    onChange={(e) => setDraft({...draft, weight: parseInt(e.target.value) || 0})}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" 
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Preferowana noga</Label>
                <Select value={draft.foot} onValueChange={(v) => setDraft({...draft, foot: v as any})}>
                  <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                    <SelectValue placeholder="Wybierz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Lewa</SelectItem>
                    <SelectItem value="right">Prawa</SelectItem>
                    <SelectItem value="both">Obunożny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Dane kontaktowe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
                    <Phone className="h-4 w-4" />
                    Telefon
                  </Label>
                  <Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
                <div>
                  <Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
                  <MapPin className="h-4 w-4" />
                  Adres
                </Label>
                <Textarea className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Informacje kontraktowe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Data rozpoczęcia</Label>
                  <Input type="date" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Data zakończenia</Label>
                  <Input type="date" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Wynagrodzenie</Label>
                <Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Klauzula odejścia</Label>
                <Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Statystyki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Mecze</Label>
                  <Input type="number" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Gole</Label>
                  <Input type="number" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-neutral-300">Asysty</Label>
                  <Input type="number" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Notatki do statystyk</Label>
                <Textarea className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scout" className="space-y-4">
          <Card className="border-gray-300 dark:border-neutral-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-neutral-100">Notatki skauta</CardTitle>
              <CardDescription className="text-gray-500 dark:text-neutral-400">
                Ocena w skali 1-6 (1 = słabo, 3-4 = solidnie, 6 = elitarnie)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Motor Skills */}
              <ScoutNoteSection
                title="Umiejętności motoryczne – szybkość, wytrzymałość"
                rating={draft.scoutNotes?.motorSkills.rating || 0}
                comment={draft.scoutNotes?.motorSkills.comment || ""}
                onRatingChange={(rating) => updateScoutNote('motorSkills', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('motorSkills', 'comment', comment)}
              />

              {/* Strength */}
              <ScoutNoteSection
                title="Siła, pojedynki, zwinność"
                rating={draft.scoutNotes?.strength.rating || 0}
                comment={draft.scoutNotes?.strength.comment || ""}
                onRatingChange={(rating) => updateScoutNote('strength', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('strength', 'comment', comment)}
              />

              {/* Technique */}
              <ScoutNoteSection
                title="Technika"
                rating={draft.scoutNotes?.technique.rating || 0}
                comment={draft.scoutNotes?.technique.comment || ""}
                onRatingChange={(rating) => updateScoutNote('technique', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('technique', 'comment', comment)}
              />

              {/* Moves with ball */}
              <ScoutNoteSection
                title="Ruchy z piłką"
                rating={draft.scoutNotes?.movesWithBall.rating || 0}
                comment={draft.scoutNotes?.movesWithBall.comment || ""}
                onRatingChange={(rating) => updateScoutNote('movesWithBall', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('movesWithBall', 'comment', comment)}
              />

              {/* Moves without ball */}
              <ScoutNoteSection
                title="Ruchy bez piłki"
                rating={draft.scoutNotes?.movesWithoutBall.rating || 0}
                comment={draft.scoutNotes?.movesWithoutBall.comment || ""}
                onRatingChange={(rating) => updateScoutNote('movesWithoutBall', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('movesWithoutBall', 'comment', comment)}
              />

              {/* Set pieces */}
              <ScoutNoteSection
                title="Stałe fragmenty"
                rating={draft.scoutNotes?.setPieces.rating || 0}
                comment={draft.scoutNotes?.setPieces.comment || ""}
                onRatingChange={(rating) => updateScoutNote('setPieces', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('setPieces', 'comment', comment)}
              />

              {/* Defensive phase */}
              <ScoutNoteSection
                title="Faza obrony"
                rating={draft.scoutNotes?.defensivePhase.rating || 0}
                comment={draft.scoutNotes?.defensivePhase.comment || ""}
                onRatingChange={(rating) => updateScoutNote('defensivePhase', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('defensivePhase', 'comment', comment)}
              />

              {/* Attacking phase */}
              <ScoutNoteSection
                title="Faza ataku"
                rating={draft.scoutNotes?.attackingPhase.rating || 0}
                comment={draft.scoutNotes?.attackingPhase.comment || ""}
                onRatingChange={(rating) => updateScoutNote('attackingPhase', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('attackingPhase', 'comment', comment)}
              />

              {/* Transitional phases */}
              <ScoutNoteSection
                title="Fazy przejściowe"
                rating={draft.scoutNotes?.transitionalPhases.rating || 0}
                comment={draft.scoutNotes?.transitionalPhases.comment || ""}
                onRatingChange={(rating) => updateScoutNote('transitionalPhases', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('transitionalPhases', 'comment', comment)}
              />

              {/* Attitude */}
              <ScoutNoteSection
                title="Postawa (mentalność)"
                rating={draft.scoutNotes?.attitude.rating || 0}
                comment={draft.scoutNotes?.attitude.comment || ""}
                onRatingChange={(rating) => updateScoutNote('attitude', 'rating', rating)}
                onCommentChange={(comment) => updateScoutNote('attitude', 'comment', comment)}
              />

              {/* Final comment */}
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Komentarz końcowy</Label>
                <Textarea 
                  value={draft.scoutNotes?.finalComment || ""}
                  onChange={(e) => setDraft({
                    ...draft, 
                    scoutNotes: {...draft.scoutNotes!, finalComment: e.target.value}
                  })}
                  placeholder="Podsumowanie obserwacji..."
                  className="min-h-[100px] border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoutNoteSection({
  title,
  rating,
  comment,
  onRatingChange,
  onCommentChange,
}: {
  title: string;
  rating: number;
  comment: string;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-700 dark:text-neutral-300">{title}</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5, 6].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onRatingChange(star)}
              className="p-0.5"
              title={`${star}/6`}
            >
              <Star 
                className="h-5 w-5 text-gray-900 dark:text-neutral-200" 
                fill={star <= rating ? "currentColor" : "none"} 
                strokeWidth={1.5} 
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-500 dark:text-neutral-400">{rating}/6</span>
        </div>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Krótki komentarz..."
        className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
      />
    </div>
  );
}

// ===== My Players =====
function MyPlayers({
  players,
  observations,
  onQuickAddObservation,
  onOpenObservation,
  onOpenAdd,
  onTrash,
  onRestore,
  onAddObservation,
  onEditPlayer,
  toasts,
}: {
  players: Player[];
  observations: Observation[];
  onQuickAddObservation: (playerName: string, p: { match: string; date: string; time: string; status: Observation["status"] }) => void;
  onOpenObservation: (id: number) => void;
  onOpenAdd: () => void;
  onTrash: (id: number) => void;
  onRestore: (id: number) => void;
  onAddObservation: (playerName: string) => void;
  onEditPlayer: (p: Player) => void;
  toasts: ReturnType<typeof useToasts>["show"];
}) {
  const [mode, setMode] = useState<"grid" | "table">(() => (typeof window !== "undefined" ? ((localStorage.getItem(LS.playersView) as "grid" | "table") || "grid") : "grid"));
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"active" | "trash">(() => (typeof window !== "undefined" ? ((localStorage.getItem(LS.playersScope) as "active" | "trash") || "active") : "active"));

  // filters (persist)
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => (typeof window !== "undefined" ? localStorage.getItem(LS.playersFiltersOpen) === "1" : false));
  const [pos, setPos] = useState<Record<Player["pos"], boolean>>({ GK: true, DF: true, MF: true, FW: true });
  const [club, setClub] = useState("");
  const [ageMin, setAgeMin] = useState<number | "">("");
  const [ageMax, setAgeMax] = useState<number | "">("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS.playersFilters);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        s.pos && setPos(s.pos);
        s.club && setClub(s.club);
        setAgeMin(s.ageMin ?? "");
        setAgeMax(s.ageMax ?? "");
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.playersFilters, JSON.stringify({ pos, club, ageMin, ageMax }));
  }, [pos, club, ageMin, ageMax]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS.playersFiltersOpen, filtersOpen ? "1" : "0");
  }, [filtersOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.playersView, mode);
  }, [mode]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.playersScope, scope);
  }, [scope]);

  // selection (for batch restore)
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LS.playersSelection);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS.playersSelection, JSON.stringify(selected));
  }, [selected]);

  function toggleSel(id: number) {
    setSelected((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }
  function selectAll(ids: number[]) {
    setSelected(ids);
  }
  function clearSel() {
    setSelected([]);
    setSelectMode(false);
  }
  function batchRestore() {
    selected.forEach(onRestore);
    toasts({ message: `Przywrócono ${selected.length} element(y)` });
    clearSel();
  }

  // column manager (table)
  const playerCols = ["select", "name", "club", "pos", "age", "status", "obs", "actions"] as const;
  type PlayerCol = typeof playerCols[number];
  const [visibleCols, setVisibleCols] = useState<Record<PlayerCol, boolean>>({
    select: true,
    name: true,
    club: true,
    pos: true,
    age: true,
    status: true,
    obs: true,
    actions: true,
  });
  const [openColsPanel, setOpenColsPanel] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS.playersCols);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setVisibleCols((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.playersCols, JSON.stringify(visibleCols));
  }, [visibleCols]);

  const rows = useMemo(() => players, [players]);
  const scoped = rows.filter((r) => r.status === scope);
  const filtered = scoped
    .filter((r) => pos[r.pos])
    .filter((r) => !club || r.club.toLowerCase().includes(club.toLowerCase()))
    .filter((r) => (ageMin === "" ? true : r.age >= Number(ageMin)))
    .filter((r) => (ageMax === "" ? true : r.age <= Number(ageMax)))
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q.toLowerCase()) ||
        r.club.toLowerCase().includes(q.toLowerCase()) ||
        r.pos.toLowerCase().includes(q.toLowerCase()),
    );

  // ===== NEW: profile completion + quick-add observation local state =====
  function completionFor(playerName: string) {
    const count = observations.filter((o) => o.player === playerName).length;
    return Math.min(100, 30 + count * 12); // base 30% + 12% per obs
  }
  const [quickFor, setQuickFor] = useState<number | null>(null);
  const [qa, setQa] = useState<{ match: string; date: string; time: string; status: Observation["status"] }>({
    match: "",
    date: "",
    time: "",
    status: "draft",
  });
  function submitQuick(playerName: string) {
    if (!qa.match || !qa.date || !qa.time) return;
    onQuickAddObservation(playerName, qa);
    setQuickFor(null);
    setQa({ match: "", date: "", time: "", status: "draft" });
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Baza zawodników" }]} />
      <Toolbar
        title="Baza zawodników"
        subtitle="Prywatna lista skauta"
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope: Active/Trash */}
            <div className="hidden overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700 md:inline-flex">
              {(["active", "trash"] as const).map((s) => (
                <button key={s} className={`px-3 py-1 text-sm ${scope === s ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setScope(s)}>
                  {s === "active" ? "aktywni" : "kosz"}
                </button>
              ))}
            </div>

            {/* Search + Filters */}
            <div className="hidden items-center gap-2 md:flex">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po nazwisku…" className="w-56 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              <div className="relative">
                <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setFiltersOpen((v) => !v)}>
                  <ListFilter className="mr-2 h-4 w-4" />
                  Filtry
                </Button>
                {filtersOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 text-sm shadow dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="mb-2 text-xs font-medium text-gray-500 dark:text-neutral-400">Pozycje</div>
                    <div className="mb-2 grid grid-cols-4 gap-2">
                      {(["GK", "DF", "MF", "FW"] as const).map((p) => (
                        <label key={p} className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-neutral-800">
                          <span>{p === "GK" ? "BR" : p === "DF" ? "OB" : p === "MF" ? "PO" : "NA"}</span>
                          <input type="checkbox" checked={pos[p]} onChange={(e) => setPos((prev) => ({ ...prev, [p]: e.target.checked }))} />
                        </label>
                      ))}
                    </div>
                    <div className="mb-2">
                      <Label className="text-xs text-gray-600 dark:text-neutral-300">Klub</Label>
                      <Input value={club} onChange={(e) => setClub(e.target.value)} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-neutral-300">Wiek min</Label>
                        <Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value === "" ? "" : Number(e.target.value))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-neutral-300">Wiek max</Label>
                        <Input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value === "" ? "" : Number(e.target.value))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* view toggle */}
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
              <button className={`px-3 py-1 text-sm ${mode === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setMode("grid")}>
                Siatka
              </button>
              <button className={`border-l border-gray-300 px-3 py-1 text-sm dark:border-neutral-700 ${mode === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setMode("table")}>
                Tabela
              </button>
            </div>

            {/* columns manager (table only) */}
            <div className="relative">
              <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setOpenColsPanel((v) => !v)}>
                Kolumny
              </Button>
              {openColsPanel && (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-2 shadow dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-1 text-xs font-medium text-gray-500 dark:text-neutral-400">Widoczność (tabela)</div>
                  {playerCols.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <span className="capitalize text-gray-800 dark:text-neutral-100">
                        {c === "select" ? "zaznacz" : c === "name" ? "nazwa" : c === "club" ? "klub" : c === "pos" ? "pozycja" : c === "age" ? "wiek" : c === "status" ? "status" : c === "obs" ? "obserwacje" : "akcje"}
                      </span>
                      <input type="checkbox" checked={visibleCols[c]} onChange={(e) => setVisibleCols((prev) => ({ ...prev, [c]: e.target.checked }))} />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* selection mode */}
            {scope === "trash" && (
              <>
                <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setSelectMode((v) => !v)}>
                  {selectMode ? "Zamyknij zaznaczanie" : "Zaznacz"}
                </Button>
                {selectMode && selected.length > 0 && (
                  <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={batchRestore}>
                    Przywróć zaznaczone
                  </Button>
                )}
              </>
            )}

            {/* Add button */}
            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={onOpenAdd}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Dodaj zawodnika
            </Button>
          </div>
        }
      />

      {/* GRID */}
      {mode === "grid" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {scope === "active" && <AddTile onClick={onOpenAdd} />}
          {filtered.map((r) => {
            const checked = selected.includes(r.id);
            const playerObs = observations
              .filter((o) => o.player === r.name)
              .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

            return (
              <Card key={r.id} className="border-gray-300 dark:border-neutral-700">
                <CardContent className="p-3">
                  {/* smaller photo */}
                  <div className="mb-2 aspect-[4/3] rounded-md border border-gray-200 bg-gray-100 dark:border-neutral-700 dark:bg-neutral-800" />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">{r.name}</div>
                      <div className="text-xs text-gray-500 dark:text-neutral-400">
                        {r.club} — {r.pos === "GK" ? "BR" : r.pos === "DF" ? "OB" : r.pos === "MF" ? "PO" : "NA"} • {r.age}
                      </div>
                    </div>
                    {scope === "trash" && selectMode ? (
                      <input type="checkbox" checked={checked} onChange={() => toggleSel(r.id)} aria-label="Zaznacz" />
                    ) : (
                      <GrayTag>{completionFor(r.name)}% profil</GrayTag>
                    )}
                  </div>

                  {/* observations block */}
                  <div className="mt-2 rounded-md border border-gray-200 p-2 text-xs dark:border-neutral-800">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-neutral-200">Twoje obserwacje</span>
                      <button
                        className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        onClick={() => setQuickFor(quickFor === r.id ? null : r.id)}
                      >
                        Szybkie dodaj
                      </button>
                    </div>

                    {playerObs.length === 0 ? (
                      <div className="text-gray-500 dark:text-neutral-400">Brak obserwacji</div>
                    ) : (
                      <ul className="space-y-1">
                        {playerObs.slice(0, 3).map((o) => (
                          <li key={o.id} className="flex items-center justify-between">
                            <span className="text-gray-700 dark:text-neutral-200">{o.date} · {o.match}</span>
                            <button className="rounded px-2 py-0.5 underline-offset-2 hover:underline" onClick={() => onOpenObservation(o.id)}>
                              Otwórz
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {quickFor === r.id && (
                      <div className="mt-2 rounded-md border border-gray-200 p-2 dark:border-neutral-800" onKeyDown={(e) => { if (e.key === "Enter") submitQuick(r.name); }}>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Mecz" value={qa.match} onChange={(e) => setQa((s) => ({ ...s, match: e.target.value }))} className="col-span-2 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                          <Input type="date" value={qa.date} onChange={(e) => setQa((s) => ({ ...s, date: e.target.value }))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                          <Input type="time" value={qa.time} onChange={(e) => setQa((s) => ({ ...s, time: e.target.value }))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <Select value={qa.status} onValueChange={(v) => setQa((s) => ({ ...s, status: v as Observation["status"] }))}>
                            <SelectTrigger className="w-28 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">szkic</SelectItem>
                              <SelectItem value="final">finalna</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={() => setQuickFor(null)}>Anuluj</Button>
                            <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800" onClick={() => submitQuick(r.name)}>Dodaj</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={() => onEditPlayer(r)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Otwórz
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={() => onAddObservation(r.name)}>
                        <PlusCircle className="mr-1 h-3.5 w-3.5" /> Obserwacja
                      </Button>
                    </div>
                    {scope === "active" ? (
                      <Button
                        size="sm"
                        className="h-7 bg-gray-900 text-white hover:bg-gray-800"
                        onClick={() => {
                          onTrash(r.id);
                          toasts({
                            message: `Przeniesiono ${r.name} do kosza`,
                            actionLabel: "Cofnij",
                            onAction: () => onRestore(r.id),
                          });
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Do kosza
                      </Button>
                    ) : selectMode ? (
                      <span className="text-xs text-gray-500 dark:text-neutral-400">Zaznacz, by przywrócić</span>
                    ) : (
                      <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800" onClick={() => onRestore(r.id)}>
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Przywróć
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* TABLE */}
      {mode === "table" && (
        <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                {visibleCols.select && <th className="p-2 text-left font-medium">{scope === "trash" ? <button className="rounded border px-2 py-1 text-xs dark:border-neutral-700" onClick={() => selectAll(filtered.map((r) => r.id))}>Zaznacz wszystkie</button> : null}</th>}
                {visibleCols.name && <th className="p-2 text-left font-medium">Nazwa</th>}
                {visibleCols.club && <th className="p-2 text-left font-medium">Klub</th>}
                {visibleCols.pos && <th className="p-2 text-left font-medium">Pozycja</th>}
                {visibleCols.age && <th className="p-2 text-left font-medium">Wiek</th>}
                {visibleCols.status && <th className="p-2 text-left font-medium">Status</th>}
                {visibleCols.obs && <th className="p-2 text-left font-medium">Obserwacje</th>}
                {visibleCols.actions && <th className="p-2 text-right font-medium">{scope === "trash" && selected.length > 0 && <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800" onClick={batchRestore}>Przywróć zaznaczone</Button>}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const checked = selected.includes(r.id);
                const count = observations.filter((o) => o.player === r.name).length;
                return (
                  <tr key={r.id} className="border-t border-gray-200 dark:border-neutral-700">
                    {visibleCols.select && (
                      <td className="p-2">
                        {scope === "trash" && (
                          <input type="checkbox" checked={checked} onChange={() => toggleSel(r.id)} aria-label="Zaznacz" />
                        )}
                      </td>
                    )}
                    {visibleCols.name && <td className="p-2 text-gray-900 dark:text-neutral-100">{r.name}</td>}
                    {visibleCols.club && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.club}</td>}
                    {visibleCols.pos && <td className="p-2"><GrayTag>{r.pos === "GK" ? "BR" : r.pos === "DF" ? "OB" : r.pos === "MF" ? "PO" : "NA"}</GrayTag></td>}
                    {visibleCols.age && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.age}</td>}
                    {visibleCols.status && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.status === "active" ? "aktywny" : "w koszu"}</td>}
                    {visibleCols.obs && (
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <GrayTag>{count}</GrayTag>
                          <button
                            className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            onClick={() => setQuickFor(quickFor === r.id ? null : r.id)}
                          >
                            Szybkie dodaj
                          </button>
                        </div>
                        {quickFor === r.id && (
                          <div className="mt-2 rounded-md border border-gray-200 p-2 text-xs dark:border-neutral-800">
                            <div className="grid grid-cols-3 gap-2">
                              <Input placeholder="Mecz" value={qa.match} onChange={(e) => setQa((s) => ({ ...s, match: e.target.value }))} className="col-span-3 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                              <Input type="date" value={qa.date} onChange={(e) => setQa((s) => ({ ...s, date: e.target.value }))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                              <Input type="time" value={qa.time} onChange={(e) => setQa((s) => ({ ...s, time: e.target.value }))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                              <Select value={qa.status} onValueChange={(v) => setQa((s) => ({ ...s, status: v as Observation["status"] }))}>
                                <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">szkic</SelectItem>
                                  <SelectItem value="final">finalna</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={() => setQuickFor(null)}>Anuluj</Button>
                              <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800" onClick={() => submitQuick(r.name)}>Dodaj</Button>
                            </div>
                          </div>
                        )}
                      </td>
                    )}
                    {visibleCols.actions && (
                      <td className="p-2 text-right">
                        <Button size="sm" variant="outline" className="mr-2 h-7 border-gray-300 dark:border-neutral-700" onClick={() => onEditPlayer(r)}>
                          Otwórz
                        </Button>
                        <Button size="sm" variant="outline" className="mr-2 h-7 border-gray-300 dark:border-neutral-700" onClick={() => onAddObservation(r.name)}>
                          Obserwacja
                        </Button>
                        {scope === "active" ? (
                          <Button
                            size="sm"
                            className="h-7 bg-gray-900 text-white hover:bg-gray-800"
                            onClick={() => {
                              onTrash(r.id);
                              toasts({
                                message: `Przeniesiono ${r.name} do kosza`,
                                actionLabel: "Cofnij",
                                onAction: () => onRestore(r.id),
                              });
                            }}
                          >
                            Do kosza
                          </Button>
                        ) : (
                          <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800" onClick={() => onRestore(r.id)}>
                            Przywróć
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile quick controls */}
      <div className="mt-3 flex items-center gap-2 md:hidden">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj…"
          className="flex-1 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <Select value={scope} onValueChange={(v) => setScope(v as "active" | "trash")}>
          <SelectTrigger className="w-28 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
            <SelectValue placeholder="Zakres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">aktywni</SelectItem>
            <SelectItem value="trash">kosz</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="border-gray-300 dark:border-neutral-700"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <ListFilter className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AddTile({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex aspect-[4/3] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
      <PlusCircle className="h-5 w-5" />
      <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">Dodaj zawodnika</span>
    </button>
  );
}

// ===== Add Player =====
function AddPlayer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"known" | "unknown" | null>(null);
  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Baza zawodników", href: "/players" }, { label: "Dodaj" }]} />
      <Toolbar title="Dodaj zawodnika" subtitle="Wybierz tryb" right={<Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={onClose}>Zamknij</Button>} />
      {!mode && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceTile title="Znam" desc="Mam pełne dane" onClick={() => setMode("known")} />
          <ChoiceTile title="Szkic" desc="Szybki szkic (nr koszulki, mecz)" onClick={() => setMode("unknown")} />
        </div>
      )}
      {mode === "known" && <KnownForm />}
      {mode === "unknown" && <UnknownQuickCapture />}
    </div>
  );
}
function ChoiceTile({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-gray-300 bg-white p-4 text-left hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
      <div className="mb-1 flex items-center gap-2">
        <UserPlus2 className="h-4 w-4" />
        <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">{title}</span>
      </div>
      <div className="text-xs text-gray-500 dark:text-neutral-400">{desc}</div>
    </button>
  );
}
function KnownForm() {
  return (
    <Card className="border-gray-300 dark:border-neutral-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-neutral-100">Formularz (wąski) z akordeonami</CardTitle>
        <CardDescription className="text-gray-500 dark:text-neutral-400">Podstawowe informacje + zdjęcie</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-md">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="base">
              <AccordionTrigger>Podstawowe informacje</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div><Label className="text-gray-700 dark:text-neutral-300">Imię</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Jan" /></div>
                  <div><Label className="text-gray-700 dark:text-neutral-300">Nazwisko</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Kowalski" /></div>
                  <div>
                    <Label className="text-gray-700 dark:text-neutral-300">Pozycja</Label>
                    <Select>
                      <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gk">Bramkarz</SelectItem>
                        <SelectItem value="df">Obrońca</SelectItem>
                        <SelectItem value="mf">Pomocnik</SelectItem>
                        <SelectItem value="fw">Napastnik</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="photo">
              <AccordionTrigger>Zdjęcie</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <div className="h-28 rounded-md border border-dashed border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800" />
                  <Button variant="outline" className="border-gray-300 dark:border-neutral-700"><FileInput className="mr-2 h-4 w-4" />Wgraj</Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}
function UnknownQuickCapture() {
  return (
    <Card className="border-gray-300 dark:border-neutral-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-neutral-100">Szybki szkic — nieznany zawodnik</CardTitle>
        <CardDescription className="text-gray-500 dark:text-neutral-400">Tylko to, co widzisz teraz</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-md space-y-3">
          <div><Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300"><Shirt className="h-4 w-4" />Numer na koszulce</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="np. 27" /></div>
          <div><Label className="text-gray-700 dark:text-neutral-300">Gdzie oglądam (mecz)</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Nazwa meczu / rozgrywki" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300"><CalendarIcon className="h-4 w-4" />Data</Label><Input type="date" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" /></div>
            <div><Label className="text-gray-700 dark:text-neutral-300">Godzina</Label><Input type="time" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" /></div>
          </div>
          <div><Label className="flex items-center gap-2 text-gray-700 dark:text-neutral-300"><NotebookPen className="h-4 w-4" />Notatka</Label><Textarea className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Krótka notatka…" /></div>
          <div className="flex items-center justify-between"><GrayTag>Moja baza</GrayTag><Button className="bg-gray-900 text-white hover:bg-gray-800">Zapisz szkic</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Observations (list + editor) =====
function ObservationsPage({
  data,
  setData,
  initialQuery = "",
  startForPlayer,
  onConsumedStart,
  toasts,
}: {
  data: Observation[];
  setData: React.Dispatch<React.SetStateAction<Observation[]>>;
  initialQuery?: string;
  startForPlayer?: string | null;
  onConsumedStart: () => void;
  toasts: ReturnType<typeof useToasts>["show"];
}) {
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [view, setView] = useState<"grid" | "table">(() => (typeof window !== "undefined" ? ((localStorage.getItem(LS.obsView) as "grid" | "table") || "grid") : "grid"));
  const [q, setQ] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "final">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => (typeof window !== "undefined" ? localStorage.getItem(LS.obsFiltersOpen) === "1" : false));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS.obsFilters);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        setStatusFilter(s.status ?? "all");
        setDateFrom(s.dateFrom ?? "");
        setDateTo(s.dateTo ?? "");
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.obsView, view);
  }, [view]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.obsFilters, JSON.stringify({ status: statusFilter, dateFrom, dateTo }));
  }, [statusFilter, dateFrom, dateTo]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS.obsFiltersOpen, filtersOpen ? "1" : "0");
  }, [filtersOpen]);

  const obsCols = ["player", "match", "date", "time", "status", "actions"] as const;
  type ObsCol = typeof obsCols[number];
  const [visibleCols, setVisibleCols] = useState<Record<ObsCol, boolean>>({
    player: true,
    match: true,
    date: true,
    time: true,
    status: true,
    actions: true,
  });
  const [openColsPanel, setOpenColsPanel] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS.obsCols);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setVisibleCols((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.obsCols, JSON.stringify(visibleCols));
  }, [visibleCols]);

  const [editing, setEditing] = useState<Observation | null>(null);

  useEffect(() => {
    if (startForPlayer) {
      setEditing({ id: 0, player: startForPlayer, match: "", date: "", time: "", status: "draft" });
      setMode("editor");
      onConsumedStart();
    }
  }, [startForPlayer, onConsumedStart]);

  const filtered = data
    .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
    .filter((r) => !q || r.player.toLowerCase().includes(q.toLowerCase()) || r.match.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => (dateFrom ? r.date >= dateFrom : true))
    .filter((r) => (dateTo ? r.date <= dateTo : true))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  function addNew() {
    setEditing(null);
    setMode("editor");
  }
  function editRow(row: Observation) {
    setEditing(row);
    setMode("editor");
  }
  function handleSave(o: Observation) {
    setData((prev) => {
      const exist = prev.find((x) => x.id === o.id);
      if (exist) return prev.map((x) => (x.id === o.id ? o : x));
      return [{ ...o, id: Math.max(0, ...prev.map((x) => x.id)) + 1 }, ...prev];
    });
    toasts({ message: "Zapisano obserwację" });
    setMode("list");
  }

  if (mode === "editor") {
    return <ObservationsEditor initial={editing ?? undefined} onClose={() => setMode("list")} onSave={handleSave} />;
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Obserwacje" }]} />
      <Toolbar
        title="Obserwacje"
        subtitle="Lista obserwacji (dodaj/edytuj)"
        right={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po zawodniku lub meczu…" className="w-64 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
                {(["all", "draft", "final"] as const).map((s) => (
                  <button key={s} className={`px-3 py-1 text-sm ${statusFilter === s ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setStatusFilter(s)}>
                    {s === "all" ? "wszystkie" : s === "draft" ? "szkice" : "finalne"}
                  </button>
                ))}
              </div>
              <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
                <button className={`px-3 py-1 text-sm ${view === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setView("grid")}>
                  Siatka
                </button>
                <button className={`border-l border-gray-300 px-3 py-1 text-sm dark:border-neutral-700 ${view === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setView("table")}>
                  Tabela
                </button>
              </div>

              {/* Filters panel */}
              <div className="relative">
                <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setFiltersOpen((v) => !v)}>
                  <ListFilter className="mr-2 h-4 w-4" />
                  Filtry
                </Button>
                {filtersOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 text-sm shadow dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-neutral-300">Data od</Label>
                        <Input type="date" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-neutral-300">Data do</Label>
                        <Input type="date" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-neutral-400">Status zapisuje się automatycznie.</div>
                  </div>
                )}
              </div>
            </div>

            {/* columns manager (table only) */}
            <div className="relative">
              <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setOpenColsPanel((v) => !v)}>
                Kolumny
              </Button>
              {openColsPanel && (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-2 shadow dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-1 text-xs font-medium text-gray-500 dark:text-neutral-400">Widoczność (tabela)</div>
                  {obsCols.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <span className="capitalize text-gray-800 dark:text-neutral-100">
                        {c === "player" ? "zawodnik" : c === "match" ? "mecz" : c === "date" ? "data" : c === "time" ? "czas" : c === "status" ? "status" : "akcje"}
                      </span>
                      <input type="checkbox" checked={visibleCols[c]} onChange={(e) => setVisibleCols((prev) => ({ ...prev, [c]: e.target.checked }))} />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={addNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Dodaj obserwację
            </Button>
          </div>
        }
      />

      {view === "grid" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <AddObservationTile onClick={addNew} />
          {filtered.map((r) => (
            <Card key={r.id} className="border-gray-300 dark:border-neutral-700">
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">{r.player}</div>
                  <GrayTag>{r.status === "draft" ? "szkic" : "finalna"}</GrayTag>
                </div>
                <div className="text-xs text-gray-600 dark:text-neutral-300">{r.match}</div>
                <div className="text-xs text-gray-500 dark:text-neutral-400">{r.date} {r.time}</div>
                <div className="pt-1 text-right">
                  <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={() => editRow(r)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edytuj
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === "table" && (
        <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                {visibleCols.player && <th className="p-2 text-left font-medium">Zawodnik</th>}
                {visibleCols.match && <th className="p-2 text-left font-medium">Mecz</th>}
                {visibleCols.date && <th className="p-2 text-left font-medium">Data</th>}
                {visibleCols.time && <th className="p-2 text-left font-medium">Czas</th>}
                {visibleCols.status && <th className="p-2 text-left font-medium">Status</th>}
                {visibleCols.actions && <th className="p-2 text-right font-medium">Akcje</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-200 dark:border-neutral-700">
                  {visibleCols.player && <td className="p-2 text-gray-900 dark:text-neutral-100">{r.player}</td>}
                  {visibleCols.match && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.match}</td>}
                  {visibleCols.date && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.date}</td>}
                  {visibleCols.time && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.time}</td>}
                  {visibleCols.status && <td className="p-2"><GrayTag>{r.status === "draft" ? "szkic" : "finalna"}</GrayTag></td>}
                  {visibleCols.actions && (
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={() => editRow(r)}>
                        Edytuj
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile quick controls */}
      <div className="mt-3 flex items-center gap-2 md:hidden">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj…" className="flex-1 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-28 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">wszystkie</SelectItem>
            <SelectItem value="draft">szkice</SelectItem>
            <SelectItem value="final">finalne</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setFiltersOpen((v) => !v)}>
          <ListFilter className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AddObservationTile({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex aspect-[4/3] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
      <PlusCircle className="h-5 w-5" />
      <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">Dodaj obserwację</span>
    </button>
  );
}

// ===== Editor with STAR ratings + dynamic match players =====
function ObservationsEditor({ initial, onClose, onSave }: { initial?: Observation; onClose: () => void; onSave: (obs: Observation) => void }) {
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [tags] = useState<string[]>(["Key pass", "Shot", "Tackle", "Turnover", "Dribble"]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<Array<{ min: number; note: string }>>(initial ? [] : [{ min: 12, note: "Key pass między liniami" }, { min: 38, note: "Strata pod pressingiem" }]);
  const [newMin, setNewMin] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");

  const [player, setPlayer] = useState(initial?.player ?? "");
  const [match, setMatch] = useState(initial?.match ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [status, setStatus] = useState<Observation["status"]>(initial?.status ?? "draft");

  const [ratings, setRatings] = useState<{ [k: string]: number }>({ Offense: 3, Defense: 3, Technique: 3, Motor: 3 });

  const [myPlayers, setMyPlayers] = useState<string[]>(["Jan Kowalski", "Marco Rossi", "Ivan Petrov", "Player #5", "Player #8"]);
  const [unidentified, setUnidentified] = useState<string[]>(["#27 (U19 Liga)", "#9 (Sparing A)", "#4 (U17 Puchar)"]);
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState<{ name: string; source: "my" | "unid" }[]>([]);
  const [newMyPlayer, setNewMyPlayer] = useState("");
  const [newSketchNo, setNewSketchNo] = useState("");
  const [newSketchLabel, setNewSketchLabel] = useState("");

  function toggleMatchPlayer(name: string, source: "my" | "unid") {
    setSelectedMatchPlayers((prev) => {
      const idx = prev.findIndex((p) => p.name === name && p.source === source);
      if (idx >= 0) {
        const copy = prev.slice();
        copy.splice(idx, 1);
        return copy;
      }
      return [...prev, { name, source }];
    });
  }
  function addMyPlayer() {
    const name = newMyPlayer.trim();
    if (!name) return;
    if (!myPlayers.includes(name)) setMyPlayers((arr) => [name, ...arr]);
    setSelectedMatchPlayers((arr) => [{ name, source: "my" }, ...arr.filter((p) => !(p.name === name && p.source === "my"))]);
    setNewMyPlayer("");
    setSaving("saving");
  }
  function addUnidentified() {
    const num = newSketchNo.trim();
    const lbl = newSketchLabel.trim();
    if (!num) return;
    const entry = `#${num}${lbl ? ` (${lbl})` : ""}`;
    if (!unidentified.includes(entry)) setUnidentified((arr) => [entry, ...arr]);
    setSelectedMatchPlayers((arr) => [{ name: entry, source: "unid" }, ...arr.filter((p) => !(p.name === entry && p.source === "unid"))]);
    setNewSketchNo("");
    setNewSketchLabel("");
    setSaving("saving");
  }

  useEffect(() => {
    if (saving === "saving") {
      const t = setTimeout(() => setSaving("saved"), 800);
      return () => clearTimeout(t);
    }
  }, [saving]);

  function addMoment() {
    const m = parseInt(newMin, 10);
    if (!isNaN(m) && newNote.trim()) {
      setTimeline((prev) => [...prev, { min: m, note: newNote.trim() }]);
      setNewMin("");
      setNewNote("");
      setSaving("saving");
    }
  }
  function saveAll() {
    const obj: Observation = { id: initial?.id ?? Date.now(), player: player || "Bez nazwy", match: match || "—", date: date || "2025-10-16", time: time || "00:00", status };
    setSaving("saving");
    setTimeout(() => onSave(obj), 250);
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Obserwacje", href: "#" }, { label: initial ? "Edycja" : "Nowa" }]} />
      <Toolbar
        title={initial ? "Edycja obserwacji" : "Nowa obserwacja"}
        subtitle="Bez sidebaru, pionowy układ + mikro-sekcje"
        right={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 border-gray-300 dark:border-neutral-700" onClick={onClose}>Anuluj</Button>
            <Button size="sm" className="h-8 bg-gray-900 text-white hover:bg-gray-800" onClick={saveAll}>Zapisz</Button>
            <Autosave state={saving} onSave={() => setSaving("saving")} />
          </div>
        }
      />

      <Card className="border-gray-300 dark:border-neutral-700">
        <CardContent className="space-y-4 p-4">
          {/* Wąskie pola bazowe */}
          <div className="grid gap-3">
            <Field label="Zawodnik"><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Wpisz nazwisko…" value={player} onChange={(e) => setPlayer(e.target.value)} /></Field>
            <Field label="Mecz"><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Rozgrywki / przeciwnik" value={match} onChange={(e) => setMatch(e.target.value)} /></Field>
            <Field label="Data i czas">
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input type="time" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as Observation["status"])}>
                <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">szkic</SelectItem>
                  <SelectItem value="final">finalna</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Zawodnicy meczu */}
          <div className="border-t border-gray-200 pt-2 dark:border-neutral-800">
            <div className="mb-2 text-sm font-medium text-gray-900 dark:text-neutral-100">Zawodnicy, którzy grali w tym meczu</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between border-b border-gray-200 px-2 py-1.5 dark:border-neutral-800">
                  <div className="text-xs font-medium text-gray-700 dark:text-neutral-300">Z moich zawodników</div>
                  <GrayTag>lista</GrayTag>
                </div>
                <div className="max-h-40 overflow-auto p-2 space-y-1">
                  {myPlayers.map((name) => {
                    const checked = !!selectedMatchPlayers.find((p) => p.name === name && p.source === "my");
                    return (
                      <label key={name} className="flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                        <span className="text-gray-800 dark:text-neutral-100">{name}</span>
                        <input type="checkbox" checked={checked} onChange={() => toggleMatchPlayer(name, "my")} />
                      </label>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200 p-2 dark:border-neutral-800">
                  <div className="mb-1 text-[11px] text-gray-500 dark:text-neutral-400">Szybko dodaj, jeśli nie istnieje</div>
                  <div className="flex gap-2">
                    <Input value={newMyPlayer} onChange={(e) => setNewMyPlayer(e.target.value)} placeholder="Imię i nazwisko" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                    <Button size="sm" className="h-8 bg-gray-900 text-white hover:bg-gray-800" onClick={addMyPlayer}>Dodaj</Button>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between border-b border-gray-200 px-2 py-1.5 dark:border-neutral-800">
                  <div className="text-xs font-medium text-gray-700 dark:text-neutral-300">Nieznani zawodnicy</div>
                  <GrayTag>lista</GrayTag>
                </div>
                <div className="max-h-40 overflow-auto p-2 space-y-1">
                  {unidentified.map((name) => {
                    const checked = !!selectedMatchPlayers.find((p) => p.name === name && p.source === "unid");
                    return (
                      <label key={name} className="flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                        <span className="text-gray-800 dark:text-neutral-100">{name}</span>
                        <input type="checkbox" checked={checked} onChange={() => toggleMatchPlayer(name, "unid")} />
                      </label>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200 p-2 dark:border-neutral-800">
                  <div className="mb-1 text-[11px] text-gray-500 dark:text-neutral-400">Dodaj szybki szkic</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={newSketchNo} onChange={(e) => setNewSketchNo(e.target.value)} placeholder="# (nr)" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                    <Input value={newSketchLabel} onChange={(e) => setNewSketchLabel(e.target.value)} placeholder="np. U19 Liga" className="col-span-2 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                  </div>
                  <div className="mt-2">
                    <Button size="sm" className="h-8 bg-gray-900 text-white hover:bg-gray-800" onClick={addUnidentified}>Dodaj szkic</Button>
                  </div>
                </div>
              </div>
            </div>
            {selectedMatchPlayers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedMatchPlayers.map((p, idx) => (
                  <GrayTag key={idx}>{p.name} • {p.source === "my" ? "Moja" : "Nieznany"}</GrayTag>
                ))}
              </div>
            )}
          </div>

          {/* STAR ratings */}
          <div className="border-t border-gray-200 pt-2 dark:border-neutral-800">
            <div className="mb-2 text-sm font-medium text-gray-900 dark:text-neutral-100">Ocena (4 parametry)</div>
            <div className="space-y-3">
              {Object.keys(ratings).map((key) => (
                <StarRatingRow key={key} label={key} value={ratings[key]} onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))} />
              ))}
            </div>
          </div>

          {/* Checklisty */}
          <div className="border-t border-gray-200 pt-2 dark:border-neutral-800">
            <div className="mb-2 text-sm font-medium text-gray-900 dark:text-neutral-100">Checklisty</div>
            <div className="grid grid-cols-2 gap-3">
              {["Pressing", "Work rate", "Aerial duels", "Body language"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="text-xs text-gray-700 dark:text-neutral-200">{item}</div>
                  <Switch />
                </div>
              ))}
            </div>
          </div>

          {/* Minuta-po-minucie */}
          <div className="border-t border-gray-200 pt-2 dark:border-neutral-800">
            <div className="mb-2 text-sm font-medium text-gray-900 dark:text-neutral-100">Minuta-po-minucie</div>
            <div className="mb-2 flex items-end gap-2">
              <div>
                <Label className="text-gray-700 dark:text-neutral-300">Min</Label>
                <Input value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="12" className="w-20 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <div className="flex-1">
                <Label className="text-gray-700 dark:text-neutral-300">Notatka</Label>
                <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="np. kluczowe podanie…" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={addMoment}>Dodaj</Button>
            </div>
            <div className="space-y-2">
              {timeline.slice().sort((a, b) => a.min - b.min).map((row, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-gray-200 p-2 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <GrayTag>{row.min}'</GrayTag>
                    <div className="text-sm text-gray-800 dark:text-neutral-100">{row.note}</div>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-neutral-500">Log</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tagi */}
          <div className="border-t border-gray-200 pt-2 dark:border-neutral-800">
            <div className="mb-2 text-sm font-medium text-gray-900 dark:text-neutral-100">Tagi momentów</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={
                    "rounded-md border px-2 py-1 text-xs " +
                    (activeTags.includes(t)
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StarRatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="w-28 text-xs text-gray-600 dark:text-neutral-300">{label}</div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" aria-label={`${label} ${i} star`} onClick={() => onChange(i)} className="p-0.5" title={`${i}/5`}>
            <Star className="h-5 w-5 text-gray-900 dark:text-neutral-200" fill={i <= value ? "currentColor" : "none"} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <GrayTag>{value}/5</GrayTag>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-gray-700 dark:text-neutral-300">{label}</Label>
      {children}
    </div>
  );
}
function Autosave({ state, onSave }: { state: "idle" | "saving" | "saved"; onSave: () => void }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700" onClick={onSave}>
        <Save className="mr-1 h-3.5 w-3.5" /> Zapisz
      </Button>
      {state === "saving" && <span className="inline-flex items-center gap-1 text-gray-500 dark:text-neutral-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Zapisywanie…</span>}
      {state === "saved" && <span className="text-gray-500 dark:text-neutral-400">Zapisano ✓</span>}
      {state === "idle" && <span className="text-gray-400 dark:text-neutral-500">Autozapis aktywny</span>}
    </div>
  );
}

// ===== Unidentified (list only) =====
function Unidentified({ items }: { items: UnidSketch[] }) {
  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Baza zawodników", href: "#" }, { label: "Nieznani zawodnicy" }]} />
      <Toolbar title="Nieznani zawodnicy" subtitle="Szkice dodane przez skautów (mogą się dublować)" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <Card key={it.id} className="border-gray-300 dark:border-neutral-700">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GrayTag>#{it.jersey}</GrayTag>
                  <span className="text-xs text-gray-500 dark:text-neutral-400">{it.date} {it.time}</span>
                </div>
                <GrayTag>{it.scout}</GrayTag>
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">{it.match}</div>
              <div className="text-xs text-gray-600 dark:text-neutral-300">{it.note}</div>
              <div className="flex items-center justify-between pt-2">
                <GrayTag>Grupa: {it.group}</GrayTag>
                <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700">Promuj (Admin)</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===== My Base =====
function MyBase({ rows }: { rows: MyBaseRow[] }) {
  const [source, setSource] = useState<string | undefined>(undefined);
  const filtered = source ? rows.filter((r) => r.source === source) : rows;
  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Moja baza" }]} />
      <Toolbar
        title="Moja baza"
        subtitle="Wpisy z różnych źródeł (manual / LNP / TM / global) z sygnaturą deduplikacji"
        right={
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => setSource(v)}>
              <SelectTrigger className="w-36 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                <SelectValue placeholder="Źródło" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">manual</SelectItem>
                <SelectItem value="LNP">LNP</SelectItem>
                <SelectItem value="TM">TM</SelectItem>
                <SelectItem value="global">global</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700">
              <CopyCheck className="mr-2 h-4 w-4" />
              Deduplicate now
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => (
          <Card key={r.id} className="border-gray-300 dark:border-neutral-700">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">{r.name}</div>
                <GrayTag>{r.pos}</GrayTag>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="rounded-sm border border-gray-200 bg-gray-100 px-1 dark:border-neutral-700 dark:bg-neutral-800">Źródło</span> {r.source}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="rounded-sm border border-gray-200 bg-gray-100 px-1 dark:border-neutral-700 dark:bg-neutral-800">Sig</span>{" "}
                  <span className="font-mono">{r.sig}</span>
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700">Szczegóły</Button>
                <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800">Scal z duplikatem</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===== Roles & Admin (incl. Unidentified Duplicates Resolver) =====
function RolesAdmin({
  unid,
  onPromoteGroup,
}: {
  unid: UnidSketch[];
  onPromoteGroup: (group: string, canonical: UnidSketch, edited: { name: string; pos: string }) => void;
}) {
  // group by key
  const groups = useMemo(() => {
    const by: Record<string, UnidSketch[]> = {};
    unid.forEach((u) => {
      by[u.group] = by[u.group] || [];
      by[u.group].push(u);
    });
    // only groups with duplicates
    return Object.entries(by)
      .filter(([, arr]) => arr.length > 1)
      .map(([group, arr]) => ({ group, items: arr }));
  }, [unid]);

  // edit buffers per group
  const [edits, setEdits] = useState<Record<string, { name: string; pos: string; selectedId: number | null }>>({});
  function setEdit(group: string, patch: Partial<{ name: string; pos: string; selectedId: number | null }>) {
    setEdits((prev) => ({ ...prev, [group]: { name: prev[group]?.name || "", pos: prev[group]?.pos || "MF", selectedId: prev[group]?.selectedId ?? null, ...patch } }));
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Zarządzanie" }]} />
      <Toolbar title="Zarządzanie (Scout Agent / Admin)" subtitle="Skauci, importy, duplikaty, Nieznani zawodnicy resolver" />
      <div className="grid gap-4 md:grid-cols-3">
        {/* Scouts */}
        <Card className="border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-neutral-100">Skauci</CardTitle>
            <CardDescription className="text-gray-500 dark:text-neutral-400">Dodawanie / uprawnienia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Input placeholder="E-mail skauta" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
              <Button className="bg-gray-900 text-white hover:bg-gray-800">Zaproś</Button>
            </div>
            <div className="space-y-2">
              {[{ name: "Jan Skaut", role: "Scout" }, { name: "Anna Agent", role: "Scout Agent" }].map((u, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-gray-200 p-2 dark:border-neutral-800">
                  <div className="text-sm text-gray-800 dark:text-neutral-100">{u.name}</div>
                  <GrayTag>{u.role}</GrayTag>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scraper */}
        <Card className="border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-neutral-100">Scraper LNP / Transfermarkt</CardTitle>
            <CardDescription className="text-gray-500 dark:text-neutral-400">Import profili</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-neutral-200">Włącz dostęp Scout Agent</div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="border-gray-300 dark:border-neutral-700"><Bug className="mr-2 h-4 w-4" />Test połączenia</Button>
              <Button className="bg-gray-900 text-white hover:bg-gray-800"><FileSearch className="mr-2 h-4 w-4" />Uruchom import</Button>
            </div>
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              Podgląd logów importu (szara makieta).
            </div>
          </CardContent>
        </Card>

        {/* Classic duplicates */}
        <Card className="border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-neutral-100">Zarządzanie duplikatami</CardTitle>
            <CardDescription className="text-gray-500 dark:text-neutral-400">Scalaj / oznacz jako różne</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-md border border-gray-200 p-2 dark:border-neutral-800">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-800 dark:text-neutral-100">Piłkarz A ↔ Piłkarz B</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 border-gray-300 dark:border-neutral-700">Odrzuć</Button>
                    <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800">Scal</Button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-neutral-400">Podobieństwo (fuzzy) 86%, klub/pozycja zbieżne</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Unidentified Duplicates Resolver */}
      <div className="mt-4">
        <Card className="border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-neutral-100">Nieznani zawodnicy — zduplikowane szkice skautów</CardTitle>
            <CardDescription className="text-gray-500 dark:text-neutral-400">Wybierz profil kanoniczny, edytuj i promuj do „Moja baza”</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groups.length === 0 && <div className="text-sm text-gray-500 dark:text-neutral-400">Brak grup z duplikatami.</div>}
            {groups.map(({ group, items }) => {
              const state = edits[group] || { name: "", pos: "MF", selectedId: null };
              return (
                <div key={group} className="rounded-md border border-gray-200 p-3 dark:border-neutral-800">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">Grupa: {group}</div>
                    <GrayTag>{items.length} szkice</GrayTag>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {items.map((u) => (
                      <label key={u.id} className="flex cursor-pointer flex-col gap-1 rounded-md border p-2 hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-800 dark:text-neutral-100">#{u.jersey} • {u.match}</div>
                          <input type="radio" name={`sel-${group}`} checked={state.selectedId === u.id} onChange={() => setEdit(group, { selectedId: u.id, name: state.name || `Player ${u.jersey}`, pos: state.pos || "MF" })} />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-neutral-400">{u.date} {u.time} • {u.scout}</div>
                        <div className="text-xs text-gray-600 dark:text-neutral-300">{u.note}</div>
                      </label>
                    ))}
                    {/* Edit form */}
                    <div className="rounded-md border p-2 dark:border-neutral-800">
                      <div className="mb-1 text-xs font-medium text-gray-700 dark:text-neutral-300">Edytuj przed promocją</div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-gray-600 dark:text-neutral-300">Imię i nazwisko</Label>
                          <Input value={state.name} onChange={(e) => setEdit(group, { name: e.target.value })} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="np. Jan Nowy" />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 dark:text-neutral-300">Pozycja</Label>
                          <Select value={state.pos} onValueChange={(v) => setEdit(group, { pos: v as any })}>
                            <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GK">BR</SelectItem>
                              <SelectItem value="DF">OB</SelectItem>
                              <SelectItem value="MF">PO</SelectItem>
                              <SelectItem value="FW">NA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          disabled={!state.selectedId || !state.name}
                          className="w-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                          onClick={() => {
                            const canonical = items.find((i) => i.id === state.selectedId)!;
                            onPromoteGroup(group, canonical, { name: state.name, pos: state.pos || "MF" });
                          }}
                        >
                          Promuj do „Moja baza”
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Sidebar & Mobile Nav =====
function SidebarNav({
  tree,
  current,
  onSelect,
  role,
  onRoleChange,
  theme,
  onToggleTheme,
}: {
  tree: NavNode[];
  current: PageKey;
  onSelect: (page: PageKey) => void;
  role: Role;
  onRoleChange: (r: Role) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ players: true });
  function toggle(key: string) {
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  }
  return (
    <aside className="fixed left-0 top-12 hidden h-[calc(100vh-3rem)] w-60 flex-col border-r border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 md:flex">
      <div className="px-3 py-2 text-xs text-gray-500 dark:text-neutral-400">Nawigacja</div>
      <nav className="flex-1 overflow-auto px-2 pb-3">
        {tree.map((node) =>
          node.children ? (
            <div key={node.key} className="mb-1">
              <button onClick={() => toggle(node.key)} className="mb-1 inline-flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-900">
                <span className="inline-flex items-center gap-2">
                  {node.icon && <node.icon className="h-4 w-4" />}
                  {node.label}
                </span>
                <ChevronDown className={"h-4 w-4 transition " + (open[node.key] ? "rotate-180" : "")} />
              </button>
              {open[node.key] && (
                <div className="ml-4">
                  {node.children.map((child) => {
                    const active = child.page && current === child.page;
                    return (
                      <button
                        key={child.key}
                        onClick={() => child.page && onSelect(child.page)}
                        className={
                          "mb-1 inline-flex w-full items-center gap-2 rounded-md border px-2 py-2 text-sm " +
                          (active ? "border-gray-900 bg-gray-900 text-white" : "border-transparent text-gray-800 hover:bg-gray-50 dark:text-neutral-100 dark:hover:bg-neutral-900")
                        }
                        aria-current={active ? "page" : undefined}
                      >
                        {child.icon && <child.icon className="h-4 w-4" />}
                        <span>{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <button
              key={node.key}
              onClick={() => node.page && onSelect(node.page)}
              className={
                "mb-1 inline-flex w-full items-center gap-2 rounded-md border px-2 py-2 text-sm " +
                (node.page && current === node.page ? "border-gray-900 bg-gray-900 text-white" : "border-transparent text-gray-800 hover:bg-gray-50 dark:text-neutral-100 dark:hover:bg-neutral-900")
              }
              aria-current={node.page && current === node.page ? "page" : undefined}
            >
              {node.icon && <node.icon className="h-4 w-4" />}
              <span>{node.label}</span>
            </button>
          ),
        )}
      </nav>

      {/* Bottom: theme + role + account */}
      <div className="border-t border-gray-200 p-2 dark:border-neutral-800">
        <div className="mb-2 flex items-center justify-between rounded-md border border-gray-200 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
          <span className="inline-flex items-center gap-2">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}Motyw</span>
          <Switch checked={theme === "dark"} onCheckedChange={onToggleTheme} />
        </div>
        <div className="mb-2">
          <Select value={role} onValueChange={(v) => onRoleChange(v as Role)}>
            <SelectTrigger className="w-full border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
              <SelectValue placeholder="Rola" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrator">Administrator</SelectItem>
              <SelectItem value="Scout Agent">Scout Agent</SelectItem>
              <SelectItem value="Scout">Scout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-8 w-full border-gray-300 dark:border-neutral-700">
          <UserCircle2 className="mr-1 h-4 w-4" /> Konto
        </Button>
      </div>
    </aside>
  );
}

function MobileSidebar({
  open,
  onClose,
  tree,
  current,
  onSelect,
  role,
  onRoleChange,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  tree: NavNode[];
  current: PageKey;
  onSelect: (page: PageKey) => void;
  role: Role;
  onRoleChange: (r: Role) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ players: true });

  useEffect(() => {
    if (open) {
      setRender(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setRender(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!render) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose]);

  if (!render) return null;
  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity duration-200 md:hidden ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-modal
      role="dialog"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className={`absolute left-0 top-0 flex h-full w-72 flex-col transform border-r border-gray-200 bg-white shadow transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-950 ${
          visible ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 items-center justify-between border-b border-gray-200 px-3 dark:border-neutral-800">
          <span className="text-sm font-medium">Menu</span>
          <button onClick={onClose} aria-label="Zamknij" className="rounded p-1 hover:bg-gray-50 dark:hover:bg-neutral-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-auto p-2">
          {tree.map((node) =>
            node.children ? (
              <div key={node.key} className="mb-1">
                <button
                  onClick={() => setOpenGroups((o) => ({ ...o, [node.key]: !o[node.key] }))}
                  className="mb-1 inline-flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-900"
                >
                  <span className="inline-flex items-center gap-2">
                    {node.icon && <node.icon className="h-4 w-4" />}
                    {node.label}
                  </span>
                  <ChevronDown className={"h-4 w-4 transition " + (openGroups[node.key] ? "rotate-180" : "")} />
                </button>
                {openGroups[node.key] && (
                  <div className="ml-4">
                    {node.children.map((child) => {
                      const active = child.page && current === child.page;
                      return (
                        <button
                          key={child.key}
                          onClick={() => {
                            if (child.page) onSelect(child.page);
                            onClose();
                          }}
                          className={
                            "mb-1 inline-flex w-full items-center gap-2 rounded-md border px-2 py-2 text-sm " +
                            (active
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-transparent text-gray-800 hover:bg-gray-50 dark:text-neutral-100 dark:hover:bg-neutral-900")
                          }
                          aria-current={active ? "page" : undefined}
                        >
                          {child.icon && <child.icon className="h-4 w-4" />}
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={node.key}
                onClick={() => {
                  if (node.page) onSelect(node.page);
                  onClose();
                }}
                className={
                  "mb-1 inline-flex w-full items-center gap-2 rounded-md border px-2 py-2 text-sm " +
                  (node.page && current === node.page
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-transparent text-gray-800 hover:bg-gray-50 dark:text-neutral-100 dark:hover:bg-neutral-900")
                }
                aria-current={node.page && current === node.page ? "page" : undefined}
              >
                {node.icon && <node.icon className="h-4 w-4" />}
                <span>{node.label}</span>
              </button>
            )
          )}
        </nav>

        {/* Bottom: theme + role + account */}
        <div className="border-t border-gray-200 p-2 dark:border-neutral-800">
          <div className="mb-2 flex items-center justify-between rounded-md border border-gray-200 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
            <span className="inline-flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Motyw
            </span>
            <Switch checked={theme === "dark"} onCheckedChange={onToggleTheme} />
          </div>
          <div className="mb-2">
            <Select value={role} onValueChange={(v) => onRoleChange(v as Role)}>
              <SelectTrigger className="w-full border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                <SelectValue placeholder="Rola" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Administrator">Administrator</SelectItem>
                <SelectItem value="Scout Agent">Scout Agent</SelectItem>
                <SelectItem value="Scout">Scout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" className="h-8 w-full border-gray-300 dark:border-neutral-700">
            <UserCircle2 className="mr-1 h-4 w-4" /> Konto
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==== APPEND THIS TO THE VERY END OF THE FILE ====

// --- tiny seeds so the UI boots without external data ---
const seedPlayers: Player[] = [
  { id: 1, name: "Jan Kowalski", club: "Cracovia", pos: "MF", age: 21, status: "active" },
  { id: 2, name: "Marco Rossi", club: "Torino",   pos: "FW", age: 23, status: "active" },
  { id: 3, name: "Ivan Petrov",  club: "CSKA",     pos: "DF", age: 24, status: "trash"  },
];

const seedObs: Observation[] = [
  { id: 1, player: "Jan Kowalski", match: "Liga A", date: "2025-04-01", time: "18:00", status: "final" },
  { id: 2, player: "Marco Rossi",  match: "Puchar", date: "2025-04-05", time: "16:30", status: "draft" },
];

const seedUnid: UnidSketch[] = [
  { id: 1, group: "grp-001", jersey: 27, match: "U19 Liga", date: "2025-03-10", time: "12:00", note: "Szybki skrzydłowy", scout: "Adam" },
  { id: 2, group: "grp-001", jersey: 27, match: "U19 Liga", date: "2025-03-10", time: "12:00", note: "Mocny pressing",     scout: "Kasia" },
  { id: 3, group: "grp-002", jersey: 9,  match: "Sparing A", date: "2025-03-20", time: "14:15", note: "Gra tyłem do bramki", scout: "Ola" },
];

const seedMyBase: MyBaseRow[] = [
  { id: 1, name: "Piotr Nowak", pos: "MF", source: "manual", sig: "mn-001" },
  { id: 2, name: "Luis Diaz",   pos: "FW", source: "TM",     sig: "tm-932" },
];

// --- navigation tree (uses your icons/types) ---
const navTree: NavNode[] = [
  {
    key: "players",
    label: "Zawodnicy",
    icon: Users,
    children: [
      { key: "players.list", label: "Baza zawodników", icon: Users, page: "players" },
      { key: "players.obs",  label: "Obserwacje",      icon: NotebookPen, page: "obs" },
      { key: "players.unid", label: "Nieznani",        icon: Shirt, page: "unidentified" },
    ],
  },
  { key: "mybase", label: "Moja baza", icon: CopyCheck, page: "mybase" },
  { key: "roles",  label: "Zarządzanie", icon: ShieldCheck, page: "roles" },
];

// --- default export: lightweight shell that renders your UI ---
export default function S4SWireframe() {
  // theme
  const [theme, setTheme] = useState<"light" | "dark">(
    (typeof window !== "undefined" && (localStorage.getItem(LS.theme) as "light" | "dark")) || "light"
  );
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(LS.theme, theme);
    }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // role
  const [role, setRole] = useState<Role>(
    (typeof window !== "undefined" && (localStorage.getItem(LS.role) as Role)) || "Scout"
  );
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS.role, role);
  }, [role]);

  // navigation + pages
  const [page, setPage] = useState<PageKey>("players");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // data
  const [players, setPlayers] = useState<Player[]>(seedPlayers);
  const [observations, setObservations] = useState<Observation[]>(seedObs);
  const [unid, setUnid] = useState<UnidSketch[]>(seedUnid);
  const [mybase, setMybase] = useState<MyBaseRow[]>(seedMyBase);

  // player editor
  const [editorPlayer, setEditorPlayer] = useState<Player | null>(null);

  // "start new observation for X" handoff
  const [startForPlayer, setStartForPlayer] = useState<string | null>(null);

  // notifications + toasts
  const notifs = useNotifications();
  const { toasts, show, dismiss } = useToasts();

  // handlers expected by your components
  function onQuickAddObservation(
    playerName: string,
    p: { match: string; date: string; time: string; status: Observation["status"] }
  ) {
    setObservations((prev) => [
      { id: Math.max(0, ...prev.map((x) => x.id)) + 1, player: playerName, ...p },
      ...prev,
    ]);
    show({ message: "Dodano obserwację" });
  }

  function onOpenObservation(_id: number) {
    // just jump to the list; the editor can be opened from there
    setPage("obs");
  }

  function onOpenAdd() {
    setPage("add");
  }

  function onTrash(id: number) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "trash" } : p)));
  }
  function onRestore(id: number) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "active" } : p)));
  }

  function onAddObservation(playerName: string) {
    setStartForPlayer(playerName);
    setPage("obs");
  }

  function onEditPlayer(p: Player) {
    setEditorPlayer(p);
    setPage("player-editor");
  }

  function onSavePlayer(updated: Player) {
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    show({ message: "Zapisano profil zawodnika" });
    setPage("players");
    setEditorPlayer(null);
  }

  function onPromoteGroup(group: string, canonical: UnidSketch, edited: { name: string; pos: string }) {
    // remove that group's sketches
    setUnid((prev) => prev.filter((u) => u.group !== group));
    // add to my base
    setMybase((prev) => [
      { id: Date.now(), name: edited.name, pos: edited.pos, source: "manual", sig: `grp-${group}` },
      ...prev,
    ]);
    notifs.push(`Promowano szkic #${canonical.jersey} (${group}) do „Moja baza”`);
    show({ message: "Promowano do „Moja baza”" });
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-2">
          <button
            className="rounded p-1 hover:bg-gray-50 dark:hover:bg-neutral-900 md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Otwórz menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-medium">S4S Admin (wireframe)</div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell
            list={notifs.items}
            onClear={notifs.clear}
            onRemove={notifs.remove}
            visibleForRole="Scout"
            role={role}
          />
          <button
            className="rounded border border-gray-300 p-1 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            onClick={toggleTheme}
            aria-label="Przełącz motyw"
          >
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Sidebars */}
      <SidebarNav
        tree={navTree}
        current={page}
        onSelect={(p) => setPage(p)}
        role={role}
        onRoleChange={setRole}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <MobileSidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        tree={navTree}
        current={page}
        onSelect={(p) => setPage(p)}
        role={role}
        onRoleChange={setRole}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main */}
      <main className="mx-auto max-w px-3 py-4 md:ml-60">
        {page === "players" && (
          <MyPlayers
            players={players}
            observations={observations}
            onQuickAddObservation={onQuickAddObservation}
            onOpenObservation={onOpenObservation}
            onOpenAdd={onOpenAdd}
            onTrash={onTrash}
            onRestore={onRestore}
            onAddObservation={onAddObservation}
            onEditPlayer={onEditPlayer}
            toasts={show}
          />
        )}

        {page === "player-editor" && editorPlayer && (
          <PlayerEditorPage
            player={editorPlayer}
            onSave={onSavePlayer}
            onClose={() => {
              setEditorPlayer(null);
              setPage("players");
            }}
          />
        )}

        {page === "add" && <AddPlayer onClose={() => setPage("players")} />}

        {page === "obs" && (
          <ObservationsPage
            data={observations}
            setData={setObservations}
            onConsumedStart={() => setStartForPlayer(null)}
            startForPlayer={startForPlayer}
            toasts={show}
          />
        )}

        {page === "unidentified" && <Unidentified items={unid} />}

        {page === "mybase" && <MyBase rows={mybase} />}

        {page === "roles" && <RolesAdmin unid={unid} onPromoteGroup={onPromoteGroup} />}
      </main>

      {/* Toasts */}
      <ToastHost toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
