// src/lib/auth/permissions.ts
export type Role = "scout" | "scout_agent" | "admin"

export const can = {
  seeDiscover: (role?: Role | null) => role === "scout_agent" || role === "admin",
  seeAdmin: (role?: Role | null) => role === "admin",
}
