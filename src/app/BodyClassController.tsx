"use client"

import { useEffect } from "react"

/**
 * Put ANY body-class toggles that depend on window/localStorage here,
 * so they run only on the client after hydration.
 */
export default function BodyClassController() {
  useEffect(() => {
    // Example (uncomment if you store sidebar preference):
    // const pref = localStorage.getItem("sidebar") // "open" | "closed"
    // document.body.classList.toggle("sidebar-open", pref === "open")
  }, [])

  return null
}
