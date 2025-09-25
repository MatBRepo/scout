// src/app/auth/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logowanie — Seatly",
  description: "Zaloguj się do Seatly",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center bg-gradient-to-br from-primary/5 via-muted to-background">
      {children}
    </main>
  );
}
