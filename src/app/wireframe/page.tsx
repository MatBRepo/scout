"use client";

import { useEffect, useMemo, useState } from "react";

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
} from "lucide-react";

/**
 * S4S — Wireframes /wireframe
 * - Persistence: theme, role, players/obs views (grid/table), filters values + "open" state, columns visibility
 * - Soft delete + batch restore for players (trash scope)
 * - Toasts (undo; save)
 * - Unidentified duplicates across scouts: Admin resolves & promotes to My Base + Scout notification
 */

type Role = "Administrator" | "Scout Agent" | "Scout";
type PageKey = "players" | "add" | "unidentified" | "mybase" | "obs" | "settings" | "roles";

type NavNode = { key: string; label: string; icon?: React.ComponentType<any>; page?: PageKey; children?: NavNode[] };

type Player = {
  id: number;
  name: string;
  club: string;
  pos: "GK" | "DF" | "MF" | "FW";
  age: number;
  status: "active" | "trash";
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

// ===== Player Editor (modal) =====
function PlayerEditor({
  open,
  player,
  onClose,
  onSave,
  onAddObservation,
  toast,
}: {
  open: boolean;
  player: Player | null;
  onClose: () => void;
  onSave: (p: Player) => void;
  onAddObservation: (playerName: string) => void;
  toast: ReturnType<typeof useToasts>["show"];
}) {
  const [draft, setDraft] = useState<Player | null>(player);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  useEffect(() => setDraft(player), [player]);
  useEffect(() => {
    if (saving === "saving") {
      const t = setTimeout(() => setSaving("saved"), 800);
      return () => clearTimeout(t);
    }
  }, [saving]);
  if (!open || !draft) return null;
  function save() {
    setSaving("saving");
    setTimeout(() => {
      onSave(draft);
      toast({ message: `Zapisano ${draft.name}` });
      onClose();
    }, 250);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative z-10 w-full max-w-lg rounded-t-xl border border-gray-200 bg-white p-4 shadow dark:border-neutral-700 dark:bg-neutral-900 md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">Edytuj zawodnika</div>
          <button className="rounded p-1 hover:bg-gray-50 dark:hover:bg-neutral-800" onClick={onClose} aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-2">
          <div>
            <Label className="text-gray-700 dark:text-neutral-300">Imię i nazwisko</Label>
            <Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-700 dark:text-neutral-300">Klub</Label>
              <Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={draft.club} onChange={(e) => setDraft({ ...draft, club: e.target.value })} />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-neutral-300">Pozycja</Label>
              <Select value={draft.pos} onValueChange={(v) => setDraft({ ...draft, pos: v as Player["pos"] })}>
                <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GK">GK</SelectItem>
                  <SelectItem value="DF">DF</SelectItem>
                  <SelectItem value="MF">MF</SelectItem>
                  <SelectItem value="FW">FW</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-700 dark:text-neutral-300">Wiek</Label>
              <Input type="number" className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" value={draft.age} onChange={(e) => setDraft({ ...draft, age: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-neutral-300">Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Player["status"] })}>
                <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="trash">trash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-neutral-400">
            {saving === "saving" ? "Zapisywanie…" : saving === "saved" ? "Zapisano ✓" : " "}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 border-gray-300 dark:border-neutral-700" onClick={() => onAddObservation(draft.name)}>
              <PlusCircle className="mr-1 h-4 w-4" />
              Dodaj obserwację
            </Button>
            <Button size="sm" className="h-8 bg-gray-900 text-white hover:bg-gray-800" onClick={save}>
              Zapisz
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== My Players =====
function MyPlayers({
  players,
  onOpenAdd,
  onTrash,
  onRestore,
  onAddObservation,
  onEditPlayer,
  toasts,
}: {
  players: Player[];
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
  const playerCols = ["select", "name", "club", "pos", "age", "status", "actions"] as const;
  type PlayerCol = typeof playerCols[number];
  const [visibleCols, setVisibleCols] = useState<Record<PlayerCol, boolean>>({
    select: true,
    name: true,
    club: true,
    pos: true,
    age: true,
    status: true,
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

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "My Players" }]} />
      <Toolbar
        title="My Players"
        subtitle="Prywatna lista skauta"
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope: Active/Trash */}
            <div className="hidden overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700 md:inline-flex">
              {(["active", "trash"] as const).map((s) => (
                <button key={s} className={`px-3 py-1 text-sm ${scope === s ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setScope(s)}>
                  {s}
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
                          <span>{p}</span>
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
                Grid
              </button>
              <button className={`border-l border-gray-300 px-3 py-1 text-sm dark:border-neutral-700 ${mode === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setMode("table")}>
                Table
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
                      <span className="capitalize text-gray-800 dark:text-neutral-100">{c}</span>
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
            return (
              <Card key={r.id} className="border-gray-300 dark:border-neutral-700">
                <CardContent className="p-3">
                  <div className="mb-2 aspect-[4/3] rounded-md border border-gray-200 bg-gray-100 dark:border-neutral-700 dark:bg-neutral-800" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-neutral-100">{r.name}</div>
                      <div className="text-xs text-gray-500 dark:text-neutral-400">{r.club} — {r.pos} • {r.age}</div>
                    </div>
                    {scope === "trash" && selectMode && (
                      <input type="checkbox" checked={checked} onChange={() => toggleSel(r.id)} aria-label="Zaznacz" />
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
                {visibleCols.name && <th className="p-2 text-left font-medium">Name</th>}
                {visibleCols.club && <th className="p-2 text-left font-medium">Club</th>}
                {visibleCols.pos && <th className="p-2 text-left font-medium">Pos</th>}
                {visibleCols.age && <th className="p-2 text-left font-medium">Age</th>}
                {visibleCols.status && <th className="p-2 text-left font-medium">Status</th>}
                {visibleCols.actions && <th className="p-2 text-right font-medium">{scope === "trash" && selected.length > 0 && <Button size="sm" className="h-7 bg-gray-900 text-white hover:bg-gray-800" onClick={batchRestore}>Przywróć zaznaczone</Button>}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const checked = selected.includes(r.id);
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
                    {visibleCols.pos && <td className="p-2"><GrayTag>{r.pos}</GrayTag></td>}
                    {visibleCols.age && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.age}</td>}
                    {visibleCols.status && <td className="p-2 text-gray-700 dark:text-neutral-200">{r.status}</td>}
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
        <Select value={scope} onValueChange={(v) => setScope(v as "active" | "trash")}>
          <SelectTrigger className="w-32 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
            <SelectValue placeholder="Zakres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="trash">trash</SelectItem>
          </SelectContent>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj…" className="flex-1 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
        <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setFiltersOpen((v) => !v)}>
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

// ===== Add Player (same as before) =====
function AddPlayer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"known" | "unknown" | null>(null);
  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "My Players", href: "/players" }, { label: "Dodaj" }]} />
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
  initialQuery = "",
  startForPlayer,
  onConsumedStart,
  toasts,
}: {
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

  const [data, setData] = useState<Observation[]>([
    { id: 1, player: "Jan Kowalski", match: "U19 Liga", date: "2025-10-12", time: "14:00", status: "draft" },
    { id: 2, player: "Marco Rossi", match: "U17 Puchar", date: "2025-10-14", time: "12:15", status: "final" },
    { id: 3, player: "Ivan Petrov", match: "Sparing A", date: "2025-10-13", time: "18:30", status: "draft" },
  ]);
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
                    {s}
                  </button>
                ))}
              </div>
              <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
                <button className={`px-3 py-1 text-sm ${view === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setView("grid")}>
                  Grid
                </button>
                <button className={`border-l border-gray-300 px-3 py-1 text-sm dark:border-neutral-700 ${view === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`} onClick={() => setView("table")}>
                  Table
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
                      <span className="capitalize text-gray-800 dark:text-neutral-100">{c}</span>
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
                  <GrayTag>{r.status}</GrayTag>
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
                  {visibleCols.status && <td className="p-2"><GrayTag>{r.status}</GrayTag></td>}
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
            <SelectItem value="all">all</SelectItem>
            <SelectItem value="draft">draft</SelectItem>
            <SelectItem value="final">final</SelectItem>
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
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="final">final</SelectItem>
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
                  <div className="text-xs font-medium text-gray-700 dark:text-neutral-300">Unidentified</div>
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
                  <GrayTag key={idx}>{p.name} • {p.source === "my" ? "My" : "Unid"}</GrayTag>
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
      <Crumb items={[{ label: "Start", href: "/" }, { label: "My Players", href: "#" }, { label: "Unidentified" }]} />
      <Toolbar title="Unidentified" subtitle="Szkice dodane przez skautów (mogą się dublować)" />
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
                <GrayTag>Group: {it.group}</GrayTag>
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
      <Toolbar title="Zarządzanie (Scout Agent / Admin)" subtitle="Skauci, importy, duplikaty, Unidentified resolver" />
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
            <CardTitle className="text-gray-900 dark:text-neutral-100">Unidentified — zduplikowane szkice skautów</CardTitle>
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
                              <SelectItem value="GK">GK</SelectItem>
                              <SelectItem value="DF">DF</SelectItem>
                              <SelectItem value="MF">MF</SelectItem>
                              <SelectItem value="FW">FW</SelectItem>
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
    <div className={`fixed inset-0 z-40 transition-opacity duration-200 md:hidden ${visible ? "opacity-100" : "opacity-0"}`} aria-modal role="dialog" onClick={onClose}>
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
                <button onClick={() => setOpenGroups((o) => ({ ...o, [node.key]: !o[node.key] }))} className="mb-1 inline-flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-900">
                  <span className="inline-flex items-center gap-2">{node.icon && <node.icon className="h-4 w-4" />}{node.label}</span>
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
                onClick={() => {
                  if (node.page) onSelect(node.page);
                  onClose();
                }}
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
      </div>
    </div>
  );
}

// ===== Top-level page =====
export default function WireframePage() {
  // Theme
  const [theme, setTheme] = useState<"light" | "dark">(() => (typeof window !== "undefined" ? ((localStorage.getItem(LS.theme) as "light" | "dark") || "light") : "light"));
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS.theme, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Default page
  const [page, setPage] = useState<PageKey>("players");
  const [showAdd, setShowAdd] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<Role>(() => (typeof window !== "undefined" ? ((localStorage.getItem(LS.role) as Role) || "Administrator") : "Administrator"));
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem(LS.role, role); }, [role]);

  // Global search
  const [scope, setScope] = useState<"players" | "observations" | "mybase" | "unidentified">("players");
  const [query, setQuery] = useState("");

  // Notifications (visible to Scout)
  const notif = useNotifications();

  // Players state
  const [players, setPlayers] = useState<Player[]>(
    Array.from({ length: 12 }).map((_, i) => ({
      id: i + 1,
      name: `Player #${i + 1}`,
      club: i % 2 ? "FC Example" : "Sample United",
      pos: ["GK", "DF", "MF", "FW"][i % 4] as Player["pos"],
      age: 18 + (i % 12),
      status: "active",
    })),
  );
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [playerEditing, setPlayerEditing] = useState<Player | null>(null);
  const [obsStartForPlayer, setObsStartForPlayer] = useState<string | null>(null);

  // My Base (global) — lifted state
  const [myBase, setMyBase] = useState<MyBaseRow[]>([
    { id: 1, name: "Jan Kowalski", pos: "FW", source: "manual", sig: "a9f1c07e21" },
    { id: 2, name: "#27 (U19 Liga)", pos: "LW", source: "manual", sig: "b1aa932c88" },
    { id: 3, name: "Marco Rossi", pos: "MF", source: "LNP", sig: "c02df12b91" },
    { id: 4, name: "Ivan Petrov", pos: "DF", source: "TM", sig: "dde1100aa2" },
  ]);

  // Unidentified sketches from many scouts (with duplicates)
  const [unidentified, setUnidentified] = useState<UnidSketch[]>([
    { id: 101, group: "U19-2025-10-12-27", jersey: 27, match: "U19 Liga", date: "2025-10-12", time: "14:00", note: "Lewy skrzydłowy, szybki drybling", scout: "Scout A" },
    { id: 102, group: "U19-2025-10-12-27", jersey: 27, match: "U19 Liga", date: "2025-10-12", time: "14:00", note: "Dobre 1v1, szuka gry do środka", scout: "Scout B" },
    { id: 103, group: "U19-2025-10-12-27", jersey: 27, match: "U19 Liga", date: "2025-10-12", time: "14:00", note: "Niezły pressing, brak dośrodkowań", scout: "Scout C" },
    { id: 104, group: "U17-2025-10-14-4", jersey: 4, match: "U17 Puchar", date: "2025-10-14", time: "12:15", note: "Środkowy obrońca, wyprowadzenie ok", scout: "Scout A" },
    { id: 105, group: "U17-2025-10-14-4", jersey: 4, match: "U17 Puchar", date: "2025-10-14", time: "12:15", note: "Dobra gra głową", scout: "Scout D" },
    { id: 106, group: "Sparing-2025-10-13-9", jersey: 9, match: "Sparing A", date: "2025-10-13", time: "18:30", note: "Silny, gra tyłem do bramki", scout: "Scout B" },
  ]);

  // Toasts
  const toastApi = useToasts();

  // Nav tree (players submenu)
  const navTree: NavNode[] = useMemo(() => {
    const base: NavNode[] = [
      { key: "players", label: "Players", icon: Users, children: [{ key: "players-main", label: "My Players", icon: Users, page: "players" }, { key: "players-unid", label: "Unidentified", icon: NotebookPen, page: "unidentified" }] },
      { key: "mybase", label: "Moja baza", icon: CopyCheck, page: "mybase" },
      { key: "obs", label: "Obserwacje", icon: FileSearch, page: "obs" },
      { key: "settings", label: "Ustawienia", icon: ShieldCheck, page: "settings" },
    ];
    if (role !== "Scout") base.push({ key: "roles", label: "Zarządzanie", icon: Bug, page: "roles" });
    return base;
  }, [role]);

  function submitSearch() {
    if (scope === "players") setPage("players");
    if (scope === "observations") setPage("obs");
    if (scope === "mybase") setPage("mybase");
    if (scope === "unidentified") setPage("unidentified");
  }

  // Player handlers
  function handleTrash(id: number) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "trash" } : p)));
  }
  function handleRestore(id: number) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "active" } : p)));
  }
  function handleEditOpen(p: Player) {
    setPlayerEditing(p);
    setPlayerEditorOpen(true);
  }
  function handleSavePlayer(updated: Player) {
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }
  function handleAddObservationForPlayer(name: string) {
    setObsStartForPlayer(name);
    setPage("obs");
  }

  // Admin promotes Unidentified group -> My Base + notify scouts
  function handlePromoteGroup(group: string, canonical: UnidSketch, edited: { name: string; pos: string }) {
    // add to My Base
    setMyBase((prev) => [{ id: Math.max(0, ...prev.map((x) => x.id)) + 1, name: edited.name, pos: edited.pos, source: "global", sig: (Math.random().toString(16) + "000000000").slice(2, 12) }, ...prev]);
    // collect scouts to notify
    const scouts = Array.from(new Set(unidentified.filter((u) => u.group === group).map((u) => u.scout)));
    // remove group sketches
    setUnidentified((prev) => prev.filter((u) => u.group !== group));
    // toast for Admin
    toastApi.show({ message: `Promowano grupę ${group} do „Moja baza”` });
    // notifications (for Scout role)
    scouts.forEach((s) => {
      notif.push(`Twój szkic #${canonical.jersey} (${canonical.match}) został dodany do globalnej bazy jako ${edited.name}`);
    });
  }

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-neutral-950 text-neutral-100" : "bg-white text-gray-900"}`}>
      {/* Top bar */}
      <header className={`sticky top-0 z-50 border-b ${theme === "dark" ? "border-neutral-800 bg-neutral-950/90" : "border-gray-200 bg-white/90"} backdrop-blur`}>
        <div className="flex h-12 w-full items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <button className="rounded p-1 hover:bg-gray-50 dark:hover:bg-neutral-900 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Otwórz menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="h-6 w-6 rounded-md bg-gray-900" />
            <span className="text-sm font-semibold tracking-tight">S4S — Wireframes</span>
          </div>
          <div className="flex items-center gap-2">
            {/* scope + search */}
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="w-36 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="players">Players</SelectItem>
                <SelectItem value="observations">Observations</SelectItem>
                <SelectItem value="mybase">My Base</SelectItem>
                <SelectItem value="unidentified">Unidentified</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden items-center gap-2 md:flex">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch();
                }}
                placeholder="Szukaj…"
                className="w-64 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
              />
              <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={submitSearch}>
                <FileSearch className="mr-2 h-4 w-4" />
                Szukaj
              </Button>
            </div>
            {/* Notifications for Scout */}
            <NotificationsBell list={notif.items} onClear={notif.clear} onRemove={notif.remove} visibleForRole="Scout" role={role} />
          </div>
        </div>
      </header>

      {/* Sidebar & Mobile */}
      <SidebarNav tree={navTree} current={page} onSelect={setPage} role={role} onRoleChange={setRole} theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} tree={navTree} current={page} onSelect={setPage} role={role} onRoleChange={setRole} theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />

      {/* Content — 100% width, równe paddingi (wrapper), sidebar offset via md:ml-60 */}
      <main className="w-full py-6">
        <div className="px-3 md:ml-60 md:px-6">
          {page === "players" && (
            <MyPlayers
              players={players}
              onOpenAdd={() => { setPage("add"); setShowAdd(true); }}
              onTrash={handleTrash}
              onRestore={handleRestore}
              onAddObservation={handleAddObservationForPlayer}
              onEditPlayer={handleEditOpen}
              toasts={toastApi.show}
            />
          )}
          {page === "add" && showAdd && <AddPlayer onClose={() => { setShowAdd(false); setPage("players"); }} />}
          {page === "unidentified" && <Unidentified items={unidentified} />}
          {page === "mybase" && <MyBase rows={myBase} />}
          {page === "obs" && (
            <ObservationsPage
              initialQuery={scope === "observations" ? query : ""}
              startForPlayer={obsStartForPlayer}
              onConsumedStart={() => setObsStartForPlayer(null)}
              toasts={toastApi.show}
            />
          )}
          {page === "settings" && <AccountSettings />}
          {page === "roles" && <RolesAdmin unid={unidentified} onPromoteGroup={handlePromoteGroup} />}
        </div>
      </main>

      <footer className={`py-4 text-center text-xs ${theme === "dark" ? "border-t border-neutral-800" : "border-t border-gray-200"} md:pl-60`}>
        Grayscale UI — podgląd makiet
      </footer>

      {/* Modals + Toasts */}
      <PlayerEditor
        open={playerEditorOpen}
        player={playerEditing}
        onClose={() => setPlayerEditorOpen(false)}
        onSave={handleSavePlayer}
        onAddObservation={(name) => {
          handleAddObservationForPlayer(name);
          setPlayerEditorOpen(false);
        }}
        toast={toastApi.show}
      />
      <ToastHost toasts={toastApi.toasts} dismiss={toastApi.dismiss} />
    </div>
  );
}

// ===== Account Settings =====
function AccountSettings() {
  const [nickSeparate, setNickSeparate] = useState(true);
  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Ustawienia konta" }]} />
      <Toolbar title="Ustawienia konta" subtitle="Nick + imię/nazwisko + pełne imię" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-neutral-100">Dane profilu</CardTitle>
            <CardDescription className="text-gray-500 dark:text-neutral-400">Podstawowe informacje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-gray-700 dark:text-neutral-300">Nick (pseudonim)</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="np. MatB" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-gray-700 dark:text-neutral-300">Imię</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Jan" /></div>
              <div><Label className="text-gray-700 dark:text-neutral-300">Nazwisko</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Kowalski" /></div>
            </div>
            <div><Label className="text-gray-700 dark:text-neutral-300">Pełne imię i nazwisko (full name)</Label><Input className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Jan Kowalski" /></div>
            <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-xs text-gray-600 dark:text-neutral-300">Traktuj „Nick” jako oddzielne pole w systemie</div>
              <Switch checked={nickSeparate} onCheckedChange={setNickSeparate} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-300 dark:border-neutral-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-neutral-100">Preferencje</CardTitle>
            <CardDescription className="text-gray-500 dark:text-neutral-400">Powiadomienia, prywatność</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><div className="text-sm text-gray-700 dark:text-neutral-200">Powiadomienia e-mail</div><Switch defaultChecked /></div>
            <div className="flex items-center justify-between"><div className="text-sm text-gray-700 dark:text-neutral-200">Prywatny profil</div><Switch /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
